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
        {eyebrow && (
          <p className="text-xs font-semibold tracking-wide text-primary mb-2">{eyebrow}</p>
        )}
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-sm leading-7 text-esi-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
