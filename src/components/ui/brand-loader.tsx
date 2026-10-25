import { BrandLogo } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";

/** Shared, theme-aware waiting state. Never delays a completed operation. */
export function BrandLoader({ label = "در حال آماده‌سازی…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-4 px-6 py-16 text-center", className)}>
      <div aria-hidden="true" className="esi-brand-loader-symbol flex size-24 items-center justify-center rounded-3xl border border-border bg-surface-1">
        <BrandLogo size={64} />
      </div>
      <div aria-hidden="true" className="esi-brand-loader-track flex h-1 w-24 gap-1 overflow-hidden rounded-full" dir="rtl">
        <span /><span /><span />
      </div>
      <p aria-hidden="true" className="font-display text-2xl text-esi-text-primary">اسی‌فیت</p>
      <p className="text-sm text-esi-text-secondary">{label}</p>
    </div>
  );
}
