"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RadialGauge } from "@/components/data-viz/radial-gauge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { useSession } from "@/lib/client/use-session";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { computeCalculator } from "./compute";
import { isApplicableCalculatorField, validateCalculatorInputs } from "./validation";
import { cn } from "@/lib/utils";
import type { CalculatorField } from "./registry";

/**
 * CalculatorRunner — result-before-scroll (DESIGN_BIBLE §8).
 * Live computation as inputs change; anonymous results always visible.
 * Members can save results to history (server-verified).
 */


export function CalculatorRunner({
  slug,
  inputs,
  disclaimer,
  methodNote,
}: {
  slug: string;
  inputs: CalculatorField[];
  disclaimer: string;
  methodNote: string;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      inputs.map((f) => [f.key, f.defaultValue != null ? (typeof f.defaultValue === "number" ? String(f.defaultValue) : f.defaultValue) : ""]),
    ),
  );
  const [saved, setSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const session = useSession();
  const calculatorsFlag = useFeatureFlag("CALCULATORS");
  const reduced = useReducedMotion();

  if (!calculatorsFlag) {
    return <p className="px-4 py-10 text-center text-sm text-esi-text-muted">این بخش در دسترس نیست.</p>;
  }

  const fields = inputs.filter((f) => isApplicableCalculatorField(f, values));
  const filled = fields.every((f) => values[f.key]?.trim() !== "");
  const errors = validateCalculatorInputs(fields, values);
  const valid = filled && Object.keys(errors).length === 0;
  const result = valid ? computeCalculator(slug, values) : null;

  const save = async () => {
    setSaveError(null);
    try {
      await api("/api/calculators/results", {
        method: "POST",
        json: {
          calculatorType: slug,
          calculatorVersion: "v1",
          inputs: values,
          result: result ? { headline: result.headlineValue, rows: result.rows } : {},
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(errorMessage(e));
    }
  };

  return (
    <div className="px-4 lg:px-8 pb-10 max-w-4xl mx-auto w-full">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        {/* inputs */}
        <section aria-label="ورودی‌ها" className="esi-card rounded-3xl p-6 space-y-4 h-fit">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`calc-${f.key}`} className="block text-sm font-medium mb-1.5">
                {f.label}
                {f.unit && <span className="text-esi-text-muted font-normal"> ({f.unit})</span>}
              </label>
              {f.hint && <p className="mb-2 text-[11px] text-esi-text-muted">{f.hint}</p>}
              {f.type === "select" ? (
                <select
                  id={`calc-${f.key}`}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-primary transition-colors"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`calc-${f.key}`}
                  type="text"
                  inputMode="decimal"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  aria-invalid={Boolean(values[f.key]?.trim() && errors[f.key])}
                  aria-describedby={errors[f.key] && values[f.key]?.trim() ? `calc-error-${f.key}` : undefined}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  className="h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-lg tabular-nums outline-none focus:border-primary transition-colors placeholder:text-esi-text-muted/60"
                />
              )}
              {values[f.key]?.trim() && errors[f.key] && (
                <p id={`calc-error-${f.key}`} role="alert" className="mt-1 text-xs text-destructive">{errors[f.key]}</p>
              )}
            </div>
          ))}
        </section>

        {/* result — visible before scroll */}
        <section aria-label="نتیجه" className="rounded-3xl border border-primary/25 bg-surface-1 p-6 relative overflow-hidden min-h-[280px]">
          <div aria-hidden className="absolute -top-16 -end-16 h-44 w-44 rounded-full bg-mint-400/8 blur-3xl" />
          {!filled || !result ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-3">
              <span className="text-4xl opacity-60" aria-hidden>🧮</span>
              <p className="text-sm text-esi-text-secondary max-w-[240px]">
                {filled ? "مقادیر معتبر وارد کنید تا نتیجه قابل‌اعتماد نمایش داده شود." : "همه مقادیر را وارد کنید — نتیجه همان لحظه و بدون ثبت‌نام محاسبه می‌شود."}
              </p>
            </div>
          ) : (
            <motion.div
              key={result.headlineValue}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-xs font-semibold text-primary">{result.headline}</p>
              <p className="mt-2 text-2xl font-extrabold leading-relaxed tabular-nums tracking-tight break-words sm:text-4xl">
                {result.headlineValue}
              </p>

              {result.gauge && (
                <div className="mt-4 flex justify-center">
                  <RadialGauge
                    value={result.gauge.value}
                    min={result.gauge.min}
                    max={result.gauge.max}
                    tone={result.gauge.tone}
                    size={140}
                    label={result.gauge.label}
                  />
                </div>
              )}

              <dl className="mt-5 space-y-2.5">
                {result.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
                    <dt className="text-xs text-esi-text-secondary">{row.label}</dt>
                    <dd className={cn(
                      "text-sm font-bold tabular-nums",
                      row.tone === "primary" && "text-primary",
                      row.tone === "blue" && "text-blue-400",
                      row.tone === "amber" && "text-amber-400",
                      row.tone === "red" && "text-red-400",
                      row.tone === "violet" && "text-violet-400",
                    )}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {result.table && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-esi-text-secondary mb-2">{result.table.title}</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-esi-text-muted">
                        {result.table.headers.map((h) => <th key={h} className="py-1.5 text-start font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.table.rows.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          {r.map((cell, j) => <td key={j} className="py-1.5 tabular-nums">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </section>
      </div>

      {/* method + disclaimer + save */}
      <div className="mt-5 space-y-3">
        <div className="esi-card rounded-2xl p-4">
          <p className="text-xs font-semibold text-esi-text-secondary mb-1">روش محاسبه</p>
          <p className="text-xs leading-6 text-esi-text-muted">{methodNote}</p>
        </div>
        <p className="text-[11px] leading-5 text-esi-text-muted flex gap-2">
          <Icon name="Info" size={14} className="shrink-0 mt-0.5" />
          {disclaimer}
        </p>

        {session && result && valid && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" className="h-10" onClick={() => void save()}>
              <Icon name="BookmarkPlus" size={16} />
              ذخیره نتیجه در تاریخچه
            </Button>
            {saved && <span role="status" className="text-xs text-primary">ذخیره شد ✓</span>}
            {saveError && <span role="alert" className="text-xs text-destructive">{saveError}</span>}
          </div>
        )}
        {!session && result && valid && (
          <p className="text-xs text-esi-text-muted">
            <a href="/auth/login" className="text-primary font-medium">وارد شوید</a> تا نتایج در تاریخچه ذخیره شود و با مقایسه روند ببینید.
          </p>
        )}
      </div>
    </div>
  );
}
