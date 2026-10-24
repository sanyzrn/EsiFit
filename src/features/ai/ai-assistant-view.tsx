"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

type Message = { id: string; role: string; content: string; status?: string };
type Action = {
  id: string;
  preview: string;
  status: string;
  expiresAt: string;
  resultJson?: string | null;
};
type Quota = {
  used: number;
  limit: number;
  monthUsed: number;
  monthlyLimit: number;
};
type ChatState = {
  available: boolean;
  reason?: string;
  conversations: { id: string; title: string }[];
  conversationId?: string;
  messages: Message[];
  actions: Action[];
  provider?: { id: string; label: string };
  providers: { id: string; label: string }[];
  quota?: Quota;
};
const ROLE_TEXT: Record<string, string> = {
  member: "همراه تمرین و تغذیهٔ شما",
  coach: "دستیار مربی و ورزشکاران شما",
  admin: "دستیار مدیریت اسی‌فیت",
};
const SUGGESTIONS: Record<string, string[]> = {
  member: [
    "برنامه و تمرین‌های اخیرم را بررسی کن",
    "برای بهتر انجام‌دادن حرکت اسکوات کمکم کن",
    "تغذیهٔ روزهای اخیرم چطور بوده؟",
    "چطور از پلیر تمرین و ثبت ست استفاده کنم؟",
  ],
  coach: [
    "کدام ورزشکارانم به پیگیری نیاز دارند؟",
    "فهرست ورزشکاران و برنامه‌هایشان را نشان بده",
    "قبل از تغییر برنامه چه چیزهایی را بررسی کنم؟",
    "برای ورزشکارم برنامهٔ بالاتنه/پایین‌تنه پیشنهاد بده",
  ],
  admin: [
    "وضعیت کلی سایت را گزارش بده",
    "مربی‌ها و تخصیص ورزشکاران را بررسی کن",
    "اتصال‌ها و دسترسی‌های همپا را نشان بده",
    "محتوای اخیر انجمن را برای بررسی نشان بده",
  ],
};
const STATUS: Record<string, string> = {
  pending: "منتظر تأیید شما",
  executing: "در حال اجرا؛ وضعیت پنل را بررسی کنید",
  succeeded: "با موفقیت اجرا شد",
  failed: "اجرا کامل نشد؛ وضعیت پنل را بررسی کنید",
  cancelled: "لغو شد",
};

export function AIAssistantView({ role }: { role: string }) {
  const [state, setState] = React.useState<ChatState | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [actions, setActions] = React.useState<Action[]>([]);
  const [conversationId, setConversationId] = React.useState<string>();
  const [providerId, setProviderId] = React.useState("");
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [acting, setActing] = React.useState<string>();
  const [confirmation, setConfirmation] = React.useState<Action>();
  const [error, setError] = React.useState<string>();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const load = React.useCallback(async (id?: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api<ChatState>(
        `/api/ai/chat${id ? `?conversationId=${encodeURIComponent(id)}` : ""}`,
      );
      setState(res);
      setMessages(res.messages);
      setActions(res.actions);
      setConversationId(res.conversationId);
      setProviderId((current) => current || res.provider?.id || "");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, actions]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending || !state?.available) return;
    setSending(true);
    setError(undefined);
    setInput("");
    const optimistic = { id: `tmp-${Date.now()}`, role: "user", content };
    setMessages((items) => [...items, optimistic]);
    try {
      const res = await api<{
        conversationId: string;
        userMessageId: string;
        message: { id: string; content: string };
        actions: Action[];
        quota: Quota;
      }>("/api/ai/chat", {
        method: "POST",
        json: {
          conversationId,
          message: content,
          ...(role === "admin" && providerId ? { providerId } : {}),
        },
      });
      setConversationId(res.conversationId);
      setMessages((items) => [
        ...items.map((item) =>
          item.id === optimistic.id ? { ...item, id: res.userMessageId } : item,
        ),
        { ...res.message, role: "assistant" },
      ]);
      setActions((items) => [
        ...items.filter(
          (item) => !res.actions.some((newAction) => newAction.id === item.id),
        ),
        ...res.actions,
      ]);
      setState((current) =>
        current
          ? {
              ...current,
              quota: res.quota,
              conversations: current.conversations.some(
                (item) => item.id === res.conversationId,
              )
                ? current.conversations
                : [
                    { id: res.conversationId, title: content.slice(0, 50) },
                    ...current.conversations,
                  ],
            }
          : current,
      );
    } catch (e) {
      setError(errorMessage(e));
      setInput(content);
      setMessages((items) => items.filter((item) => item.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }
  async function act(action: Action, confirm: boolean) {
    setActing(action.id);
    setError(undefined);
    try {
      const res = await api<{ action: { id: string; status: string } }>(
        "/api/ai/actions",
        { method: "POST", json: { id: action.id, confirm } },
      );
      setActions((items) =>
        items.map((item) =>
          item.id === action.id ? { ...item, status: res.action.status } : item,
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setActing(undefined);
      setConfirmation(undefined);
    }
  }
  const quota = state?.quota;
  const exhausted =
    quota &&
    (quota.used >= quota.limit || quota.monthUsed >= quota.monthlyLimit);
  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] min-h-[24rem] lg:h-[calc(100dvh-3rem)] w-full max-w-4xl flex-col pb-5">
      <PageHeader
        title="همپا"
        description={ROLE_TEXT[role]}
        backHref={
          role === "admin"
            ? "/admin"
            : role === "coach"
              ? "/coach"
              : "/dashboard"
        }
        action={
          <span className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
            <Icon name="Sparkles" size={15} /> اسی‌فیت
          </span>
        }
      />
      <div className="mb-5 space-y-3 px-4 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="گفت‌وگوهای قبلی"
            value={conversationId ?? ""}
            disabled={sending || loading || Boolean(acting)}
            onChange={(e) => void load(e.target.value || undefined)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-1 px-3 text-xs"
          >
            <option value="">گفت‌وگوی جدید</option>
            {state?.conversations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={sending || loading || Boolean(acting)}
            onClick={() => void load()}
          >
            گفت‌وگوی جدید
          </Button>
          {role === "admin" && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin?tab=ai">تنظیم اتصال و مجوزها</Link>
            </Button>
          )}
        </div>
        {role === "admin" && Boolean(state?.providers.length) && (
          <label className="flex items-center gap-3 text-xs text-esi-text-secondary">
            اتصال فعال
            <select
              aria-label="انتخاب اتصال هوش مصنوعی"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={sending}
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-1 px-3"
            >
              {state?.providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {quota && (
          <div className="rounded-2xl border border-border bg-surface-1 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-[11px] text-esi-text-secondary">
              <span>
                امروز {toPersianDigits(quota.used)} /{" "}
                {toPersianDigits(quota.limit)}
              </span>
              <span>
                این ماه {toPersianDigits(quota.monthUsed)} /{" "}
                {toPersianDigits(quota.monthlyLimit)}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-primary"
                style={{
                  width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        {state && !state.available && (
          <div
            role="status"
            className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm leading-7"
          >
            {state.reason}
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 lg:px-8"
        aria-live="polite"
        aria-busy={loading || sending}
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-esi-text-muted">
            در حال آماده‌سازی همپا…
          </p>
        ) : (
          messages.length === 0 && (
            <div>
              <div className="rounded-3xl border border-border bg-surface-1 p-6">
                <Icon name="Sparkles" size={28} className="text-primary" />
                <h2 className="mt-4 font-display text-2xl">
                  یک همراه، در جریان مسیر شما.
                </h2>
                <p className="mt-3 text-sm leading-7 text-esi-text-secondary">
                  {role === "admin"
                    ? "اطلاعات سایت را می‌خوانم، برای مدیریت کمک می‌کنم و تغییرات را پیش از اجرا برای تأیید شما می‌فرستم."
                    : role === "coach"
                      ? "برنامه و پیشرفت ورزشکاران خودتان را بررسی می‌کنم؛ تخصیص برنامه با تأیید نهایی شما انجام می‌شود."
                      : "برای شناخت حرکات، بررسی برنامه و تغذیه و استفاده از اسی‌فیت کنارتان هستم. برای بررسی شخصی، اطلاعات ثبت‌شدهٔ خودتان را می‌خوانم."}
                </p>
                <p className="mt-3 text-[11px] leading-6 text-esi-text-muted">
                  اطلاعات مرتبط برای پردازش به مدل انتخاب‌شده توسط مدیر ارسال
                  می‌شود. کلید یا رمز را در گفت‌وگو ننویسید.
                </p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(SUGGESTIONS[role] ?? SUGGESTIONS.member).map((text, i) => (
                  <button
                    key={text}
                    disabled={
                      !state?.available || sending || Boolean(exhausted)
                    }
                    onClick={() => void send(text)}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-start text-sm leading-6 transition-colors hover:border-primary/40 disabled:opacity-50"
                  >
                    <span className="text-xs text-primary">
                      {toPersianDigits(i + 1)}
                    </span>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-start" : "justify-end",
            )}
          >
            <div
              className={cn(
                "max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[85%]",
                message.role === "user"
                  ? "rounded-ss-sm bg-surface-2"
                  : "rounded-se-sm border border-primary/20 bg-primary/5",
              )}
            >
              <p className="mb-1 text-[10px] font-semibold text-esi-text-muted">
                {message.role === "user"
                  ? "شما"
                  : message.role === "assistant"
                    ? "همپا"
                    : "وضعیت سیستم"}
              </p>
              {message.content}
              {message.status === "failed" && (
                <p className="mt-2 text-[10px] text-destructive">
                  این پیام کامل پردازش نشد؛ سهمیه‌ای مصرف نشده است.
                </p>
              )}
            </div>
          </div>
        ))}
        {actions.map((action) => {
          const expired = new Date(action.expiresAt) <= new Date();
          return (
            <div
              key={action.id}
              className="rounded-2xl border border-primary/30 bg-surface-1 p-4"
            >
              <p className="text-xs font-bold text-primary">
                {action.status === "pending" && expired
                  ? "پیشنهاد منقضی شده"
                  : (STATUS[action.status] ?? action.status)}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                {action.preview}
              </p>
              {action.status === "pending" && !expired && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={Boolean(acting) || sending}
                    onClick={() => setConfirmation(action)}
                  >
                    بررسی و تأیید
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(acting) || sending}
                    onClick={() => void act(action, false)}
                  >
                    لغو پیشنهاد
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {sending && (
          <p role="status" className="py-4 text-end text-xs text-primary">
            همپا در حال بررسی است…
          </p>
        )}
      </div>
      <div className="mt-5 border-t border-border bg-background px-4 pt-4 lg:px-8">
        {error && (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-2 text-xs leading-6 text-destructive"
          >
            <span>{error}</span>
            {!state && (
              <Button variant="ghost" size="sm" onClick={() => void load()}>
                تلاش دوباره
              </Button>
            )}
          </div>
        )}
        {exhausted && (
          <p className="mb-2 text-xs text-esi-text-secondary">
            سهمیهٔ روزانه یا ماهانه تمام شده است؛ برای افزایش با مدیر تماس
            بگیرید.
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={1200}
            aria-label="پیام به همپا"
            placeholder="دربارهٔ اسی‌فیت بپرسید…"
            disabled={loading || !state?.available || Boolean(exhausted)}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-surface-1 px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="size-12 rounded-2xl"
            disabled={
              sending ||
              loading ||
              !state?.available ||
              Boolean(exhausted) ||
              !input.trim()
            }
            aria-label="ارسال پیام"
          >
            <Icon name="SendHorizontal" size={18} className="rotate-180" />
          </Button>
        </form>
        <p className="mt-2 text-center text-[10px] leading-5 text-esi-text-muted">
          پاسخ‌ها جایگزین تشخیص پزشکی نیستند. تاریخچهٔ این گفت‌وگو برای ادامهٔ
          گفتگو ذخیره می‌شود.
        </p>
      </div>
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !acting) setConfirmation(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>اجرای این تغییر را تأیید می‌کنید؟</AlertDialogTitle>
          <AlertDialogDescription className="break-words leading-7">
            {confirmation?.preview}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(acting)}>
              بازگشت
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(acting)}
              onClick={(event) => {
                event.preventDefault();
                if (confirmation) void act(confirmation, true);
              }}
            >
              {acting ? "در حال اجرا…" : "تأیید و اجرا"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
