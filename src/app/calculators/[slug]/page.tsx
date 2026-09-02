import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { CALCULATOR_CONFIGS } from "@/features/calculators/registry";
import { CalculatorRunner } from "@/features/calculators/calculator-runner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const calc = CALCULATOR_CONFIGS.find((c) => c.slug === slug);
  return calc
    ? { title: calc.metaTitle, description: calc.metaDescription }
    : { title: "ماشین‌حساب" };
}

export default async function CalculatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const calc = CALCULATOR_CONFIGS.find((c) => c.slug === slug);
  if (!calc) notFound();

  const session = await getSessionUser();

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <PageHeader
        title={calc.title}
        description={calc.tagline}
        backHref="/calculators"
      />
      <CalculatorRunner
        slug={calc.slug}
        inputs={calc.inputs}
        disclaimer={calc.disclaimer}
        methodNote={calc.methodNote}
      />
    </AppShell>
  );
}
