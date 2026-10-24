import { Icon } from "@/components/ui/icon";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-wide text-primary">{eyebrow}</p>}
        <h2 className="text-2xl font-extrabold tracking-tight leading-snug sm:text-3xl lg:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-sm lg:text-base leading-7 text-esi-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
