"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

type Message = { id: string; role: "user" | "assistant" | "system_notice"; content: string };

const QUICK_PROMPTS = [
  { icon: "🏋️", text: "برای امروز پلن تمرینی پیشنهاد بده" },
  { icon: "🍗", text: "چطور پروتئین روزانه‌ام را بیشتر کنم؟" },
  { icon: "😴", text: "خوابم کم است؛ تمرین سنگین بزنم؟" },
  { icon: "📈", text: "چرا پرس سینه‌ام متوقف شده؟" },
];

export function AIAssistantView({ tier }: { tier: string }) {
  const ent = getEntitlements(tier as UserTier);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [conversationId, setConversationId] = React.useState<string | undefined>();
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [used, setUsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setError(null);
    const optimistic: Message = { id: `tmp-${Date.now()}`, role: "user", content };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await api<{
        conversationId: string;
        message: { id: string; content: string };
        quota: { used: number; limit: number };
      }>("/api/ai/chat", { method: "POST", json: { conversationId, message: content } });
      setConversationId(res.conversationId);
      setUsed(res.quota.used);
      setMessages((m) => [
        ...m.map((x) => (x.id === optimistic.id ? { ...x, id: `u-${res.message.id}` } : x)),
        { id: res.message.id, role: "assistant", content: res.message.content },
      ]);
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(content);
      toast({ title: "ارسال ناموفق", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const pct = Math.min(100, (used / ent.aiMessagesPerDay) * 100);

  return (
    <div className="max-w-3xl mx-auto w-full pb-6 flex flex-col min-h-[calc(100dvh-8rem)]">
      <PageHeader
        title="دستیار هوشمند"
        description="مربی فارسی‌زبان مبتنی بر هوش مصنوعی — با خط قرمزهای ایمنی سلامت."
        action={
          <div className="text-end">
            <p className="text-xs text-esi-text-muted tabular-nums">
              {toPersianDigits(used)} از {toPersianDigits(ent.aiMessagesPerDay)} پیام امروز
            </p>
            <div className="mt-1 h-1.5 w-28 rounded-full bg-surface-3 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", pct > 85 ? "bg-amber-400" : "bg-violet-400")}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
              />
            </div>
          </div>
        }
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-8 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="pt-8">
            <div className="rounded-3xl border border-border bg-surface-1 p-6 text-center">
              <span className="text-3xl" aria-hidden>🤖</span>
              <p className="mt-3 text-sm leading-6 text-esi-text-secondary max-w-md mx-auto">
                سلام! من مربی اسی‌فیت هستم. درباره تمرین، تغذیه و ریکاوری بپرسید.
                من تشخیص پزشکی نمی‌دهم و در موارد درد، تمرین را متوقف و پزشک را توصیه می‌کنم.
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.text}
                  type="button"
                  onClick={() => void send(p.text)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3 text-start text-sm transition-all hover:border-primary/50 hover:bg-surface-2"
                >
                  <span aria-hidden>{p.icon}</span>
                  {p.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-3xl px-5 py-3.5 text-sm leading-7",
                m.role === "user"
                  ? "bg-surface-2 rounded-bl-md"
                  : "bg-primary/10 border border-primary/20 rounded-br-md",
              )}
            >
              {m.content.split("\n").map((line, i) => (
                <p key={i} className={line.startsWith("-") || /^\d/.test(line) ? "ps-3" : ""}>{line}</p>
              ))}
            </div>
          </motion.div>
        ))}

        {sending && (
          <div className="flex justify-end">
            <div className="rounded-3xl rounded-br-md bg-primary/10 border border-primary/20 px-5 py-4 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 pt-4 mt-4 esi-glass border-t border-border px-4 lg:px-8 py-3">
        {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="سوال خود را بنویسید…"
            maxLength={1200}
            aria-label="پیام به دستیار"
            className="h-12 flex-1 rounded-2xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-primary transition-colors"
          />
          <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-2xl" disabled={sending || !input.trim()} aria-label="ارسال">
            <Icon name="SendHorizontal" size={18} className="rotate-180" />
          </Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-esi-text-muted">
          پاسخ هوش مصنوعی توصیه عمومی است، نه تشخیص پزشکی.
        </p>
      </div>
    </div>
  );
}
