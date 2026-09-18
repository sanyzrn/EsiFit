import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { getSmsProvider } from "@/lib/sms/provider";
import { serverSecret } from "@/lib/auth/session";

/**
 * OTP flow with abuse protection:
 * - Iranian mobile normalization/validation (09xxxxxxxxx / +98 / 0098).
 * - Per-phone cooldown (60s), per-phone hourly cap (5), per-IP hourly cap (20).
 * - 6-digit code, HMAC-hashed at rest (never stored raw), 2-minute expiry,
 *   max 5 verification attempts, single-use consumption.
 * - Verify attempts against missing/expired codes are still rate-limited.
 */

const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const PHONE_HOURLY_LIMIT = 5;
const IP_HOURLY_LIMIT = 20;
const VERIFY_HOURLY_LIMIT = 20;

export function normalizeIranMobile(input: string): string | null {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\d+]/g, "");
  let phone = digits;
  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("0098")) phone = "0" + phone.slice(4);
  else if (phone.startsWith("98") && phone.length === 12) phone = "0" + phone.slice(2);
  else if (phone.startsWith("9") && phone.length === 10) phone = "0" + phone;
  if (!/^09\d{9}$/.test(phone)) return null;
  // Iranian operator prefixes: 091x/090x/093x/094x/092x/099x
  if (!/^09(0[0-5]|1[0-9]|2[0-3]|3[0-9]|9[0-9])\d{7}$/.test(phone)) return null;
  return phone;
}

function hashCode(phone: string, code: string): string {
  return createHmac("sha256", serverSecret()).update(`${phone}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export type RequestOtpResult = {
  phone: string;
  resendAfterSeconds: number;
  /** dev-only convenience; undefined in production */
  devCode?: string;
};

export async function requestOtp(rawPhone: string, ip: string | null): Promise<RequestOtpResult> {
  const phone = normalizeIranMobile(rawPhone);
  if (!phone) {
    throw new AppError("validation", { userMessage: "شماره موبایل معتبر نیست. با ۰۹ شروع شود و ۱۱ رقم باشد." });
  }

  const now = Date.now();

  // Per-phone cooldown: last OTP within 60s blocks resend.
  const last = await db.otpCode.findFirst({
    where: { phone, createdAt: { gt: new Date(now - RESEND_COOLDOWN_MS) } },
  });
  if (last) {
    const wait = Math.ceil((last.createdAt.getTime() + RESEND_COOLDOWN_MS - now) / 1000);
    throw new AppError("rate_limit", {
      userMessage: `کد قبلی هنوز معتبر است. ${wait} ثانیه دیگر دوباره تلاش کنید.`,
      retryAfterSeconds: wait,
    });
  }

  // Hourly caps. Missing IP is a shared "unknown" bucket — never unlimited.
  const ipKey = ip && ip.length > 0 ? ip : "unknown";
  const hourAgo = new Date(now - 3_600_000);
  const [phoneCount, ipCount] = await Promise.all([
    db.otpRequestLog.count({ where: { phone, createdAt: { gt: hourAgo } } }),
    db.otpRequestLog.count({ where: { ip: ipKey, createdAt: { gt: hourAgo } } }),
  ]);
  if (phoneCount >= PHONE_HOURLY_LIMIT) {
    throw new AppError("rate_limit", { userMessage: "تعداد درخواست کد برای این شماره زیاد بوده است. یک ساعت دیگر تلاش کنید." });
  }
  if (ipCount >= IP_HOURLY_LIMIT) {
    throw new AppError("rate_limit", { userMessage: "درخواست‌های زیادی از این شبکه ثبت شده است. بعداً تلاش کنید." });
  }

  const code = String(randomInt(100000, 999999));
  await db.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(phone, code),
      expiresAt: new Date(now + OTP_TTL_MS),
    },
  });
  await db.otpRequestLog.create({ data: { phone, ip: ipKey } });

  const provider = getSmsProvider();
  try {
    await provider.sendOtp(phone, code);
  } catch (error) {
    console.error("[otp] sms provider failure", { provider: provider.name });
    throw new AppError("provider", { userMessage: "ارسال پیامک با مشکل مواجه شد. لطفاً دوباره تلاش کنید.", cause: error });
  }

  // Deliberately does NOT report whether the phone already has an account:
  // an unauthenticated caller must not be able to enumerate registered users.
  return {
    phone,
    resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  };
}

export type VerifyOtpResult = { phone: string; isNewUser: boolean };

export async function verifyOtp(rawPhone: string, rawCode: string, ip: string | null = null): Promise<VerifyOtpResult> {
  const phone = normalizeIranMobile(rawPhone);
  if (!phone) throw new AppError("validation", { userMessage: "شماره موبایل معتبر نیست." });

  const code = rawCode
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
  if (code.length !== 6) {
    throw new AppError("validation", { userMessage: "کد ۶ رقمی را کامل وارد کنید." });
  }

  // Rate-limit verify attempts even when no live OTP row exists.
  const hourAgo = new Date(Date.now() - 3_600_000);
  const ipKey = ip && ip.length > 0 ? ip : "unknown";
  const [recentPhone, recentIp] = await Promise.all([
    db.otpRequestLog.count({ where: { phone, purpose: "verify", createdAt: { gt: hourAgo } } }),
    db.otpRequestLog.count({ where: { ip: ipKey, purpose: "verify", createdAt: { gt: hourAgo } } }),
  ]);
  if (recentPhone >= VERIFY_HOURLY_LIMIT || recentIp >= VERIFY_HOURLY_LIMIT) {
    throw new AppError("rate_limit", { userMessage: "تلاش‌های زیادی برای ورود ثبت شده است. بعداً تلاش کنید." });
  }

  const record = await db.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    await db.otpRequestLog.create({ data: { phone, ip: ipKey, purpose: "verify" } }).catch(() => undefined);
    throw new AppError("validation", { userMessage: "کد منقضی شده است. کد جدید بگیرید." });
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError("rate_limit", { userMessage: "تلاش‌های بیش از حد. کد جدید درخواست کنید." });
  }

  if (!safeEqualHex(hashCode(phone, code), record.codeHash)) {
    await db.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    await db.otpRequestLog.create({ data: { phone, ip: ipKey, purpose: "verify" } }).catch(() => undefined);
    throw new AppError("validation", { userMessage: "کد واردشده درست نیست." });
  }

  // Atomic single-use consume: concurrent verifies cannot both succeed.
  const claimed = await db.otpCode.updateMany({
    where: { id: record.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new AppError("validation", { userMessage: "کد قبلاً استفاده شده است. کد جدید بگیرید." });
  }

  const isNewUser = !(await db.user.findUnique({ where: { phone } }));
  return { phone, isNewUser };
}
