import Link from "next/link";
import { BrandMark } from "@/components/layout/navigation";

const GROUPS = [
  {
    title: "محصول",
    links: [
      { href: "/calculators", label: "ماشین‌حساب‌های تناسب اندام" },
      { href: "/plans", label: "اشتراک و پلن‌ها" },
      { href: "/store", label: "فروشگاه" },
      { href: "/ai", label: "دستیار هوشمند" },
    ],
  },
  {
    title: "محتوا",
    links: [
      { href: "/blog", label: "مجله اسی‌فیت" },
      { href: "/blog/training", label: "مقالات تمرینی" },
      { href: "/blog/nutrition", label: "مقالات تغذیه" },
      { href: "/blog/science", label: "علم و پژوهش" },
    ],
  },
  {
    title: "حساب",
    links: [
      { href: "/auth/login", label: "ورود / ثبت‌نام" },
      { href: "/dashboard", label: "داشبورد" },
      { href: "/settings", label: "تنظیمات و حریم خصوصی" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface-1 safe-bottom">
      <div className="mx-auto max-w-6xl px-4 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <BrandMark />
            <p className="text-sm leading-6 text-esi-text-secondary max-w-xs">
              اسی‌فیت اکوسیستم جامع تناسب اندام فارسی است: تمرین حرفه‌ای، تغذیه دقیق، ریکاوری هوشمند
              و تحلیل پیشرفت — همه در یک اپلیکیشن موبایل‌پسند.
            </p>
          </div>
          {GROUPS.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <h3 className="text-sm font-semibold mb-3">{g.title}</h3>
              <ul className="space-y-2">
                {g.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-esi-text-muted hover:text-esi-text-primary transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-esi-text-muted">
          <p>© ۱۴۰۵ اسی‌فیت — ساخته‌شده با وسواس برای ورزشکاران فارسی‌زبان.</p>
          <p>محتوای آموزشی اسی‌فیت جایگزین تشخیص یا درمان پزشکی نیست.</p>
        </div>
      </div>
    </footer>
  );
}
