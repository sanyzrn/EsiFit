/**
 * SMS provider adapter — Iranian vendors behind one interface.
 * Vendors: kavenegar | melipayamak | smsir | dev (console).
 * Selected via SMS_PROVIDER env; secrets are server-only env vars.
 * Adding a vendor = adding one factory branch; no app coupling.
 */

export type SmsProviderName = "kavenegar" | "melipayamak" | "smsir" | "dev";

export interface SmsProvider {
  readonly name: SmsProviderName;
  /** Send an OTP message. Returns provider message id or throws AppError. */
  sendOtp(phone: string, code: string): Promise<{ messageId: string }>;
  /** Send an arbitrary verified template message (future: reminders). */
  sendTemplate(phone: string, template: string, tokens: Record<string, string>): Promise<{ messageId: string }>;
}

class DevSmsProvider implements SmsProvider {
  readonly name: SmsProviderName = "dev";

  async sendOtp(phone: string, code: string): Promise<{ messageId: string }> {
    // Never a real SMS: surfaced in API response only outside production.
    console.info(`[sms:dev] OTP for ${phone}: ${code}`);
    return { messageId: `dev-${Date.now()}` };
  }

  async sendTemplate(phone: string, template: string, tokens: Record<string, string>): Promise<{ messageId: string }> {
    console.info(`[sms:dev] template=${template} to=${phone}`, tokens);
    return { messageId: `dev-${Date.now()}` };
  }
}

class KavenegarProvider implements SmsProvider {
  readonly name: SmsProviderName = "kavenegar";
  private apiKey = process.env.KAVENEGAR_API_KEY ?? "";
  private sender = process.env.KAVENEGAR_SENDER ?? "";

  private async call(method: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://api.kavenegar.com/v1/${this.apiKey}/${method}.json`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`kavenegar_http_${res.status}`);
    const json = (await res.json()) as { return?: { status?: number; message?: string[] } };
    if (json.return?.status && json.return.status >= 200 && json.return.status < 300) {
      return json.return.message;
    }
    throw new Error(`kavenegar_api_${json.return?.status ?? "unknown"}`);
  }

  async sendOtp(phone: string, code: string): Promise<{ messageId: string }> {
    await this.call("sms/send", {
      receptor: phone,
      sender: this.sender,
      message: `اسی‌فیت\nکد ورود شما: ${code}\nاین کد را با کسی به اشتراک نگذارید.`,
    });
    return { messageId: `kavenegar-${Date.now()}` };
  }

  async sendTemplate(phone: string, template: string, tokens: Record<string, string>): Promise<{ messageId: string }> {
    await this.call("verify/lookup", {
      receptor: phone,
      token: tokens.token1 ?? "",
      token2: tokens.token2 ?? "",
      token3: tokens.token3 ?? "",
      template,
    });
    return { messageId: `kavenegar-${Date.now()}` };
  }
}

class MelipayamakProvider implements SmsProvider {
  readonly name: SmsProviderName = "melipayamak";
  private username = process.env.MELIPAYAMAK_USERNAME ?? "";
  private password = process.env.MELIPAYAMAK_PASSWORD ?? "";
  private from = process.env.MELIPAYAMAK_FROM ?? "";

  async sendOtp(phone: string, code: string): Promise<{ messageId: string }> {
    const res = await fetch("https://rest.payamak-panel.com/api/SendSMS/SendSMS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
        to: phone,
        from: this.from,
        text: `اسی‌فیت — کد ورود: ${code}`,
        isflash: false,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`melipayamak_http_${res.status}`);
    return { messageId: `melipayamak-${Date.now()}` };
  }

  async sendTemplate(phone: string, template: string, tokens: Record<string, string>): Promise<{ messageId: string }> {
    // Melipayamak advanced REST endpoint for template-based OTP.
    const res = await fetch("https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
        text: template,
        to: phone,
        bodyId: process.env.MELIPAYAMAK_OTP_BODY_ID ?? "",
        ...tokens,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`melipayamak_http_${res.status}`);
    return { messageId: `melipayamak-${Date.now()}` };
  }
}

class SmsIrProvider implements SmsProvider {
  readonly name: SmsProviderName = "smsir";
  private apiKey = process.env.SMSIR_API_KEY ?? "";
  private lineNumber = process.env.SMSIR_LINE ?? "";

  async sendOtp(phone: string, code: string): Promise<{ messageId: string }> {
    const res = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ mobile: phone, templateId: process.env.SMSIR_OTP_TEMPLATE_ID ?? "", parameters: [{ name: "CODE", value: code }] }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`smsir_http_${res.status}`);
    return { messageId: `smsir-${Date.now()}` };
  }

  async sendTemplate(phone: string, template: string, tokens: Record<string, string>): Promise<{ messageId: string }> {
    // UltraFastSend equivalent.
    const res = await fetch("https://api.sms.ir/v1/send/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ lineNumber: this.lineNumber, messageText: template, mobiles: [phone] }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`smsir_http_${res.status}`);
    return { messageId: `smsir-${Date.now()}` };
  }
}

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const name = (process.env.SMS_PROVIDER as SmsProviderName | undefined) ?? "dev";
  // Fail closed in production: log-printed OTPs are full account takeover.
  if (process.env.NODE_ENV === "production" && (name === "dev" || !name)) {
    throw new Error(
      "[esifit] FATAL: SMS_PROVIDER is 'dev' or unset in production. OTP codes would be written to logs. Set a real SMS provider.",
    );
  }
  switch (name) {
    case "kavenegar":
      cached = new KavenegarProvider();
      break;
    case "melipayamak":
      cached = new MelipayamakProvider();
      break;
    case "smsir":
      cached = new SmsIrProvider();
      break;
    default:
      cached = new DevSmsProvider();
  }
  return cached;
}
