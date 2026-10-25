import Link from "next/link";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
export default function NotFound() {
  return <PublicPageShell session={null} showFooter={false}>
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <BrandMark /><p className="font-display text-6xl text-primary" aria-hidden>۴۰۴</p>
      <h1 className="text-2xl font-bold">این صفحه پیدا نشد</h1>
      <p className="text-sm leading-7 text-esi-text-secondary">ممکن است نشانی تغییر کرده باشد یا صفحه دیگر در دسترس نباشد. از صفحه اصلی یا داشبورد ادامه بدهید.</p>
      <div className="flex flex-wrap justify-center gap-3"><Button asChild><Link href="/">صفحه اصلی</Link></Button><Button asChild variant="secondary"><Link href="/dashboard">رفتن به داشبورد</Link></Button></div>
    </section>
  </PublicPageShell>;
}
