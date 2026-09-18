"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { formatRelative } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_META: Record<string, { icon: string; color: string }> = {
  achievement: { icon: "Trophy", color: "text-amber-400" },
  social: { icon: "Heart", color: "text-red-400" },
  reminder: { icon: "Bell", color: "text-blue-400" },
  system: { icon: "Info", color: "text-esi-text-secondary" },
  info: { icon: "Info", color: "text-esi-text-secondary" },
};

export function NotificationsView() {
  const [items, setItems] = React.useState<Notification[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api<{ notifications: Notification[] }>("/api/notifications");
      setItems(res.notifications);
    } catch {
      setItems([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const markAll = async () => {
    await api("/api/notifications", { method: "POST", json: { all: true } }).catch(() => undefined);
    await load();
  };

  const unread = (items ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="max-w-2xl mx-auto w-full pb-6">
      <PageHeader
        title="اعلان‌ها"
        description={unread > 0 ? `${unread} اعلان خوانده‌نشده` : "همه اعلان‌ها خوانده شده‌اند"}
        backHref="/dashboard"
        action={
          unread > 0 ? (
            <Button variant="secondary" size="sm" className="h-9" onClick={() => void markAll()}>
              خواندن همه
            </Button>
          ) : undefined
        }
      />
      <div className="px-4 lg:px-8 space-y-2.5">
        {!items ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface-1 p-10 text-center space-y-4">
            <span className="text-3xl" aria-hidden>🔔</span>
            <p className="text-sm text-esi-text-secondary">هنوز اعلانی ندارید — اولین تمرین را ثبت کنید!</p>
            <Button asChild className="h-11">
              <Link href="/workouts">شروع تمرین</Link>
            </Button>
          </div>
        ) : (
          items.map((n, i) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.info;
            const content = (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                  n.readAt ? "border-border bg-surface-1" : "border-primary/30 bg-primary/5",
                )}
              >
                <span className={cn("mt-0.5 shrink-0", meta.color)}>
                  <Icon name={meta.icon} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", n.readAt ? "font-medium" : "font-bold")}>{n.title}</p>
                    {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-label="خوانده‌نشده" />}
                  </div>
                  <p className="mt-0.5 text-xs leading-6 text-esi-text-secondary">{n.body}</p>
                  <p className="mt-1 text-[10px] text-esi-text-muted">{formatRelative(n.createdAt)}</p>
                </div>
              </motion.div>
            );
            return n.actionUrl ? (
              <Link
                key={n.id}
                href={n.actionUrl}
                className="block"
                onClick={() => void api("/api/notifications", { method: "POST", json: { id: n.id } }).catch(() => undefined)}
              >
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })
        )}
      </div>
    </div>
  );
}
