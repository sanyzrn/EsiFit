import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function ArticleCard({
  href,
  emoji,
  title,
  excerpt,
  category,
  minutes,
  date,
}: {
  href: string;
  emoji: string;
  title: string;
  excerpt: string;
  category: string;
  minutes: string;
  date: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-3xl border border-border bg-surface-1 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)] focus-visible:outline-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-3xl" aria-hidden>{emoji}</span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-esi-text-secondary">{category}</span>
      </div>
      <h3 className="mt-4 text-base font-bold leading-7 group-hover:text-primary transition-colors">{title}</h3>
      <p className="mt-2 flex-1 text-[13px] leading-6 text-esi-text-secondary line-clamp-3">{excerpt}</p>
      <div className="mt-4 flex items-center justify-between text-[11px] text-esi-text-muted">
        <span>{date}</span>
        <span className="flex items-center gap-1">
          <Icon name="Clock" size={12} />
          {minutes} دقیقه مطالعه
        </span>
      </div>
    </Link>
  );
}
