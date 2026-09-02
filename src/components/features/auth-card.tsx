"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BrandMark } from "@/components/layout/navigation";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits, toLatinDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * AuthCard — mobile + OTP first-party sign-in.
 * Dev mode surfaces the OTP inline (never in production).
 * Cooldown timer mirrors the server's 60s resend window.
 */

type Step = "phone" | "code";

export function AuthCard() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const codeRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const requestOtp = async () => {
    setError(null);
    if (!/^09\d{9}$/.test(toLatinDigits(phone))) {
      setError("شماره موبایل را با ۰۹ و ۱۱ رقم وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ devCode?: string; resendAfterSeconds: number }>("/api/auth/request-otp", {
        method: "POST",
        json: { phone: toLatinDigits(phone) },
      });
      setStep("code");
      setCooldown(res.resendAfterSeconds ?? 60);
      setDevCode(res.devCode ?? null);
      setTimeout(() => codeRef.current?.focus(), 120);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (value: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ isNewUser: boolean }>("/api/auth/verify-otp", {
        method: "POST",
        json: { phone: toLatinDigits(phone), code: value },
      });
      router.push(res.isNewUser ? "/auth/onboarding" : "/dashboard");
    } catch (e) {
      setError(errorMessage(e));
      setCode("");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-center mb-8">
        <BrandMark />
      </div>
      <div className="rounded-3xl border border-border bg-surface-1 p-8 shadow-[var(--shadow-float)]">
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="text-2xl font-bold">ورود یا ثبت‌نام</h1>
              <p className="mt-2 text-sm leading-6 text-esi-text-secondary">
                فقط با شماره موبایل — بدون رمز عبور. کد یک‌بارمصرف پیامک می‌شود.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void requestOtp();
                }}
              >
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">
                    شماره موبایل
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="09xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={cn(
                      "h-12 w-full rounded-xl border bg-surface-2 px-4 text-left text-lg tracking-widest outline-none transition-colors",
                      "focus:border-primary focus:ring-2 focus:ring-[var(--focus)]/30",
                      error ? "border-destructive" : "border-border",
                    )}
                  />
                  {error && (
                    <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>
                  )}
                </div>
                <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={loading}>
                  {loading ? "در حال ارسال کد…" : "دریافت کد ورود"}
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="text-2xl font-bold">کد را وارد کنید</h1>
              <p className="mt-2 text-sm leading-6 text-esi-text-secondary">
                کد ۶ رقمی به شماره <span dir="ltr" className="font-medium">{toPersianDigits(toLatinDigits(phone))}</span> پیامک شد.
              </p>

              {devCode && (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-xs text-amber-400" role="status">
                  محیط دمو: کد شما <strong className="tabular-nums text-sm">{toPersianDigits(devCode)}</strong> است
                  (در محیط واقعی فقط پیامک ارسال می‌شود).
                </div>
              )}

              <form
                className="mt-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.length === 6) void verify(code);
                }}
              >
                <div className="flex justify-center" dir="ltr">
                  <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); if (v.length === 6) void verify(v); }} disabled={loading}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} ref={codeRef} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error && (
                  <p role="alert" className="mt-4 text-center text-xs text-destructive">{error}</p>
                )}
                <Button type="submit" size="lg" className="mt-6 w-full h-12 text-base" disabled={loading || code.length !== 6}>
                  {loading ? "بررسی کد…" : "ورود به اسی‌فیت"}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-esi-text-secondary hover:text-esi-text-primary transition-colors"
                  onClick={() => { setStep("phone"); setCode(""); setError(null); }}
                >
                  تغییر شماره
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  className={cn("font-medium transition-colors", cooldown > 0 ? "text-esi-text-muted" : "text-primary hover:opacity-80")}
                  onClick={() => void requestOtp()}
                >
                  {cooldown > 0 ? `ارسال مجدد تا ${toPersianDigits(cooldown)} ثانیه` : "ارسال مجدد کد"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-6 text-center text-xs leading-5 text-esi-text-muted">
        با ورود، قوانین و سیاست حریم خصوصی اسی‌فیت را می‌پذیرید.
        <br />
        داده‌های سلامت شما فقط با اجازه شما استفاده می‌شود.
      </p>
    </div>
  );
}
