/**
 * Typed application error model per TECH_ARCHITECTURE §8.
 * Expected errors are modeled, never thrown as generic strings.
 */

export type AppErrorCode =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "network"
  | "provider"
  | "quota"
  | "unexpected";

const FA_MESSAGES: Record<AppErrorCode, string> = {
  validation: "اطلاعات واردشده کامل و درست نیست.",
  authentication: "برای ادامه باید وارد حساب خود شوید.",
  authorization: "شما به این بخش دسترسی ندارید.",
  not_found: "چیزی که دنبالش بودید پیدا نشد.",
  conflict: "این اطلاعات قبلاً ثبت شده است.",
  rate_limit: "چند لحظه صبر کنید و دوباره تلاش کنید.",
  network: "ارتباط برقرار نشد. اتصال اینترنت را بررسی کنید.",
  provider: "سرویس موقتاً در دسترس نیست. کمی بعد تلاش کنید.",
  quota: "سهمیه استفاده از این قابلیت تمام شده است.",
  unexpected: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;
  readonly details?: Record<string, unknown>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AppErrorCode,
    options?: {
      userMessage?: string;
      details?: Record<string, unknown>;
      retryAfterSeconds?: number;
      cause?: unknown;
    },
  ) {
    super(options?.userMessage ?? FA_MESSAGES[code], { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.userMessage = options?.userMessage ?? FA_MESSAGES[code];
    this.details = options?.details;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }

  static from(code: AppErrorCode, userMessage?: string): AppError {
    return new AppError(code, { userMessage });
  }

  /** Client-safe payload (no technical leakage). */
  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}

/** Map any thrown value to an AppError (route handler boundary). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  // Zod validation errors → user-facing validation message (never a 500).
  if (error != null && typeof error === "object" && (error as { name?: string }).name === "ZodError") {
    return new AppError("validation", { details: { issues: (error as { issues?: unknown }).issues }, cause: error });
  }
  return new AppError("unexpected", { cause: error });
}
