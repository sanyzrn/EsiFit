"use client";

import * as React from "react";
import Link from "next/link";
import { useAppShellFocus } from "@/components/layout/app-shell";
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
import { api, errorMessage, isApiError } from "@/lib/client/api";
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
  recoveryStatus?:string;
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
    "گزارش عملیاتی هفت روز اخیر و وضعیت برنامه‌ریز را نشان بده",
    "محصول‌ها و مقاله‌ها را برای ویرایش نشان بده",
  ],
};
const STATUS: Record<string, string> = {
  pending: "منتظر تأیید شما",
  executing: "در حال اجرا؛ وضعیت پنل را بررسی کنید",
  succeeded: "با موفقیت اجرا شد",
  failed: "اجرا کامل نشد؛ وضعیت پنل را بررسی کنید",
  cancelled: "لغو شد",
};

export function AIAssistantView({ role, userId }: { role: string; userId:string }) {
  const { focusMode, setFocusMode } = useAppShellFocus();
  const [controlsOpen, setControlsOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const focusToggleRef = React.useRef<HTMLButtonElement>(null);
  const controlsId = React.useId();
  const pendingRequest=React.useRef<{id:string;content:string}|null>(null);
  const [recoveryId,setRecoveryId]=React.useState<string>();
  const [online,setOnline]=React.useState(true);
  React.useEffect(()=>{try{setRecoveryId(sessionStorage.getItem(`esifit:hampa-request:${userId}`)??undefined)}catch{}const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)}},[userId]);
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
  React.useEffect(() => () => setFocusMode(false), [setFocusMode]);
  React.useEffect(() => {
    if (!focusMode) return;
    const panel = panelRef.current;
    if (!panel) return;
    const viewport = window.visualViewport;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Android/iOS keyboards shrink the visual viewport without resizing 100dvh.
        panel.style.height = `${viewport?.height ?? window.innerHeight}px`;
        panel.style.top = `${viewport?.offsetTop ?? 0}px`;
        if (document.activeElement === inputRef.current) {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }
      });
    };
    const escape = (event: KeyboardEvent) => {
      // Let the existing confirmation dialog handle its own Escape first.
      if (event.key === "Escape" && !document.querySelector('[role="alertdialog"]')) {
        inputRef.current?.blur();
        setFocusMode(false);
        focusToggleRef.current?.focus();
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      panel.style.removeProperty("height");
      panel.style.removeProperty("top");
    };
  }, [focusMode, setFocusMode]);
  const load = React.useCallback(async (id?: string, recover?:string) => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api<ChatState>(
        `/api/ai/chat${recover?`?requestId=${encodeURIComponent(recover)}`:id ? `?conversationId=${encodeURIComponent(id)}` : ""}`,
      );
      if(recover&&res.recoveryStatus==="success"){pendingRequest.current=null;setInput("");}
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
    if (!content || sending || !state?.available || !online) return;
    if(!pendingRequest.current||pendingRequest.current.content!==content)pendingRequest.current={id:crypto.randomUUID(),content};
    const requestId=pendingRequest.current.id;setRecoveryId(requestId);try{sessionStorage.setItem(`esifit:hampa-request:${userId}`,requestId)}catch{}
    setSending(true);
    setError(undefined);
    setInput("");
    const optimistic = { id: `tmp-${Date.now()}`, role: "user", content };
    setMessages((items) => [...items, optimistic]);
    try {
      const res = await api<{
        pending?:boolean;
        conversationId: string;
        userMessageId: string;
        message: { id: string; content: string };
        actions: Action[];
        quota: Quota;
      }>("/api/ai/chat", {
        method: "POST",
        json: {
          requestId,
          conversationId,
          message: content,
          ...(role === "admin" && providerId ? { providerId } : {}),
        },
      });
      if(res.pending){setMessages(items=>items.filter(item=>item.id!==optimistic.id));setInput(content);setError("درخواست قبلی هنوز در حال انجام است؛ با بازیابی گفتگو نتیجه را ببین. پیام دوباره برای مدل ارسال نشد.");if(res.conversationId)setConversationId(res.conversationId);return;}
      pendingRequest.current=null;
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
      if(isApiError(e)&&e.status!==0)pendingRequest.current=null;
      setError(`${errorMessage(e)} پیش از تکرار، «بازیابی گفتگو» را بزن؛ ممکن است پاسخ در سرور ذخیره شده باشد.`);
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
    <div
      ref={panelRef}
      data-chat-focus={focusMode}
      className={cn(
        "flex w-full min-h-0 flex-col bg-background",
        focusMode
          ? "fixed inset-x-0 top-0 z-40 h-dvh safe-top safe-x"
          : "mx-auto h-[calc(100dvh-9.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-4xl lg:h-[calc(100dvh-2.5rem)]",
      )}
    >
      <header className="shrink-0 border-b border-border px-4 py-3 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {!focusMode && <Button variant="ghost" size="icon" asChild><Link aria-label="بازگشت از همپا" href={role === "admin" ? "/admin" : role === "coach" ? "/coach" : "/dashboard"}><Icon name="ChevronRight" className="ltr:rotate-180" /></Link></Button>}
            <Icon name="Sparkles" className="shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold">همپا</h1>
              {!focusMode && <p className="truncate text-xs text-esi-text-muted">{ROLE_TEXT[role]}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!focusMode && <Button variant="ghost" size="icon" aria-label="گزینه‌های گفتگو" aria-expanded={controlsOpen} aria-controls={controlsId} onClick={() => setControlsOpen(open => !open)}><Icon name="Settings" /></Button>}
            <Button
              ref={focusToggleRef}
              variant="secondary"
              className="min-h-11 px-3"
              aria-pressed={focusMode}
              onClick={() => {
                if (focusMode) inputRef.current?.blur();
                setFocusMode(focused => !focused);
              }}
            >
              <Icon name={focusMode ? "X" : "Maximize2"} />
              {focusMode ? "خروج از حالت چت" : "فقط چت"}
            </Button>
          </div>
        </div>
      </header>
      <div id={controlsId} hidden={focusMode || !controlsOpen} className="max-h-[40dvh] shrink-0 space-y-3 overflow-y-auto border-b border-border px-4 py-3 lg:px-8">
        <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" asChild><Link href={role === "admin" ? "/admin?tab=ai" : role === "coach" ? "/coach" : "/workouts"}>{role === "admin" ? "مدیریت برنامه‌ریز مستقل" : role === "coach" ? "برنامه‌ریز در پروندهٔ ورزشکار" : "ساخت و بازسازی برنامهٔ تمرین"}</Link></Button>{recoveryId&&<Button variant="ghost" size="sm" disabled={sending||loading||!online} onClick={()=>void load(undefined,recoveryId)}>بازیابی گفتگو</Button>}</div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="گفت‌وگوهای قبلی"
            value={conversationId ?? ""}
            disabled={!online || sending || loading || Boolean(acting)}
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
            disabled={!online || sending || loading || Boolean(acting)}
            onClick={() => {pendingRequest.current=null;setInput("");void load()}}
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
      </div>
      {!online && <p role="status" className="mx-4 my-2 shrink-0 text-xs leading-6 text-esi-text-secondary">اینترنت قطع است؛ متن پیام حفظ می‌شود. ارسال مجدد خودکار انجام نمی‌شود.</p>}
      {state && !state.available && (
          <div
            role="status"
            className="mx-4 my-2 max-h-24 shrink-0 overflow-y-auto rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs leading-6"
          >
            {state.reason}
          </div>
        )}
      <div
        ref={scrollRef}
        className="mx-auto min-h-0 w-full max-w-4xl flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 lg:px-8"
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
      <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
        {error && (
          <div
            role="alert"
            className="mb-3 flex max-h-24 items-start justify-between gap-2 overflow-y-auto text-xs leading-6 text-destructive"
          >
            <span>{error}</span>
            {recoveryId ? (
              <Button variant="ghost" size="sm" disabled={sending || loading || !online} onClick={() => void load(undefined, recoveryId)}>بازیابی گفتگو</Button>
            ) : !state && (
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
            ref={inputRef}
            value={input}
            onFocus={() => {
              if (window.matchMedia("(max-width: 1023px)").matches) setFocusMode(true);
            }}
            onChange={(event) => setInput(event.target.value)}
            maxLength={1200}
            aria-label="پیام به همپا"
            placeholder="پیامت رو برای همپا بنویس…"
            disabled={loading || !state?.available || Boolean(exhausted)}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-surface-1 px-4 text-base outline-none focus:border-primary disabled:opacity-50"
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
        <p hidden={focusMode} className="mt-2 text-center text-[10px] leading-5 text-esi-text-muted">
          پاسخ‌ها جایگزین تشخیص پزشکی نیستند. تاریخچهٔ این گفت‌وگو برای ادامهٔ
          گفتگو ذخیره می‌شود.
        </p>
        </div>
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
