import type * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  backHref,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-4 lg:px-8 pt-6 pb-4 max-w-6xl mx-auto w-full",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-esi-text-muted hover:text-esi-text-primary mb-1 transition-colors min-h-11"
          >
            {/* RTL: chevron points toward the start (right) */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="rtl:rotate-180">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            بازگشت
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight leading-snug sm:text-3xl lg:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-esi-text-secondary">{description}</p>}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div> : null}
    </div>
  );
}

