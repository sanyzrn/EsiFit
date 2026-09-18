"use client";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary — Persian, on-brand, with a recovery CTA.
 * Next.js mounts this when a page segment throws during render/navigation.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-4xl" aria-hidden>
        ⚠️
      </div>
      <h1 className="text-xl font-bold">خطایی رخ داد</h1>
      <p className="max-w-md text-sm leading-6 text-esi-text-secondary">
        مشکلی در بارگذاری این بخش پیش آمد. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت بعداً سر بزنید.
      </p>
      {error?.digest ? (
        <p className="text-[11px] text-esi-text-muted font-mono" dir="ltr">
          {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} className="mt-2">
        تلاش دوباره
      </Button>
    </div>
  );
}
