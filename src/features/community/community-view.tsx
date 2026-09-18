"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion/motion";

type Post = {
  id: string;
  content: string;
  workoutType: string | null;
  createdAt: string;
  author: { id: string; name: string; tier: string };
  likeCount: number;
  commentCount: number;
  comments: Array<{ id: string; content: string; author: string }>;
};

type Challenge = {
  id: string;
  name: string;
  description: string;
  metric: string;
  targetValue: number;
  emoji: string;
  participantCount: number;
  joined: boolean;
  myScore: number | null;
  leaderboard: Array<{ rank: number; name: string; tier: string; score: number }>;
  daysLeft: number;
};

export function CommunityView({ signedIn }: { signedIn: boolean }) {
  const [posts, setPosts] = React.useState<Post[] | null>(null);
  const [challenges, setChallenges] = React.useState<Challenge[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [liked, setLiked] = React.useState<Set<string>>(new Set());
  const { toast } = useToast();

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ posts: Post[] }>("/api/community/feed");
        setPosts(res.posts);
      } catch {
        setPosts([]);
      }
    })();
    void (async () => {
      try {
        const res = await api<{ challenges: Challenge[] }>("/api/community/challenges");
        setChallenges(res.challenges);
      } catch {
        setChallenges([]);
      }
    })();
  }, []);

  const publish = async () => {
    if (draft.trim().length < 3) return;
    setPosting(true);
    try {
      const res = await api<{ post: Post }>("/api/community/feed", { method: "POST", json: { content: draft.trim() } });
      setPosts((p) => [res.post, ...(p ?? [])]);
      setDraft("");
      toast({ title: "پست منتشر شد" });
    } catch (e) {
      toast({ title: "انتشار ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!signedIn) return;
    const wasLiked = liked.has(postId);
    setLiked((s) => {
      const next = new Set(s);
      if (wasLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setPosts((p) => (p ?? []).map((x) => (x.id === postId ? { ...x, likeCount: x.likeCount + (wasLiked ? -1 : 1) } : x)));
    try {
      await api("/api/community/like", { method: "POST", json: { postId, liked: !wasLiked } });
    } catch {
      // Revert optimistic update on failure.
      setLiked((s) => {
        const next = new Set(s);
        if (wasLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setPosts((p) => (p ?? []).map((x) => (x.id === postId ? { ...x, likeCount: x.likeCount + (wasLiked ? 1 : -1) } : x)));
      toast({ title: "ثبت پسند ناموفق بود", variant: "destructive" });
    }
  };

  const reduce = useReducedMotion();
  const enter = (i = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduce
      ? { duration: 0.01 }
      : { duration: MOTION.duration.enter, ease: MOTION.ease, delay: Math.min(i * 0.04, 0.28) },
  });

  const join = async (challengeId: string) => {
    if (!signedIn) {
      toast({ title: "برای عضویت در چالش وارد شوید", description: "ابتدا وارد حساب خود شوید." });
      return;
    }
    try {
      await api("/api/community/challenges", { method: "POST", json: { challengeId } });
      toast({ title: "به چالش اضافه شدید 🎯" });
      const res = await api<{ challenges: Challenge[] }>("/api/community/challenges");
      setChallenges(res.challenges);
    } catch (e) {
      toast({ title: "عضویت ناموفق", description: errorMessage(e), variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-6">
      <PageHeader title="انجمن" description="پیشرفت واقعی مردم واقعی — بدون فیلتر و ادعای غیرواقعی." backHref="/dashboard" />

      <div className="px-4 lg:px-8">
        <Tabs defaultValue="feed">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-grid mb-5 h-11">
            <TabsTrigger value="feed">جریان فعالیت</TabsTrigger>
            <TabsTrigger value="challenges">چالش‌ها</TabsTrigger>
          </TabsList>

          {/* ---------- Feed ---------- */}
          <TabsContent value="feed" className="space-y-4">
            {signedIn && (
              <div className="rounded-3xl border border-border bg-surface-1 p-4">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="امروز چه دستاوردی داشتید؟"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-esi-text-muted"
                  aria-label="متن پست جدید"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] tabular-nums text-esi-text-muted">{toPersianDigits(draft.length)}/۵۰۰</span>
                  <Button size="sm" className="h-9" disabled={posting || draft.trim().length < 3} onClick={() => void publish()}>
                    انتشار
                  </Button>
                </div>
              </div>
            )}

            {!posts ? (
              <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
            ) : posts.length === 0 ? (
              <div className="rounded-3xl border border-border bg-surface-1 p-10 text-center">
                <p className="text-sm text-esi-text-secondary">اولین پست را شما بنویسید!</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard key={post.id} post={post} liked={liked.has(post.id)} onLike={() => void toggleLike(post.id)} />
              ))
            )}
          </TabsContent>

          {/* ---------- Challenges ---------- */}
          <TabsContent value="challenges" className="space-y-4">
            {!challenges ? (
              <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}</div>
            ) : (
              challenges.map((ch) => (
                <section key={ch.id} className="rounded-3xl border border-border bg-surface-1 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl" aria-hidden>{ch.emoji}</span>
                      <div>
                        <h2 className="font-bold">{ch.name}</h2>
                        <p className="mt-1 text-sm leading-6 text-esi-text-secondary">{ch.description}</p>
                        <p className="mt-2 text-[11px] text-esi-text-muted flex items-center gap-3">
                          <span className="flex items-center gap-1"><Icon name="Users" size={12} /> {toPersianDigits(ch.participantCount)} نفر</span>
                          <span className="flex items-center gap-1"><Icon name="Clock" size={12} /> {toPersianDigits(ch.daysLeft)} روز باقی‌مانده</span>
                        </p>
                      </div>
                    </div>
                    {ch.joined ? (
                      <span className="rounded-full bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary shrink-0">عضو هستید</span>
                    ) : (
                      <Button size="sm" className="h-9 shrink-0" onClick={() => void join(ch.id)}>عضویت</Button>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold text-esi-text-secondary mb-2">برترین‌ها</p>
                    <ol className="space-y-1.5">
                      {ch.leaderboard.slice(0, 5).map((row) => (
                        <li key={row.rank} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
                          <span className={cn(
                            "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums",
                            row.rank === 1 ? "bg-amber-400/20 text-amber-400" : row.rank === 2 ? "bg-slate-400/20 text-slate-300" : row.rank === 3 ? "bg-amber-600/20 text-amber-600" : "bg-surface-3 text-esi-text-muted",
                          )}>
                            {toPersianDigits(row.rank)}
                          </span>
                          <span className="text-sm font-medium truncate flex-1">{row.name}</span>
                          <span className="text-sm font-bold tabular-nums text-primary">{toPersianDigits(row.score)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PostCard({ post, liked, onLike }: { post: Post; liked: boolean; onLike: () => void }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border bg-surface-1 p-5"
    >
      <header className="flex items-center gap-3 mb-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="esi-gradient-brand text-primary-foreground text-sm font-bold">
            {post.author.name.trim()[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{post.author.name}</p>
          <p className="text-[11px] text-esi-text-muted">{formatRelative(post.createdAt)}</p>
        </div>
        {post.workoutType && (
          <span className="ms-auto rounded-full bg-surface-2 px-2.5 py-1 text-[10px] text-esi-text-muted shrink-0">
            تمرین {post.workoutType === "chest" ? "سینه" : post.workoutType === "legs" ? "پا" : post.workoutType === "back" ? "پشت" : "عمومی"}
          </span>
        )}
      </header>
      <p className="text-sm leading-7">{post.content}</p>
      <footer className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={onLike}
          className={cn(
            "flex items-center gap-1.5 text-xs tabular-nums min-h-9 px-2 rounded-lg transition-colors",
            liked ? "text-red-400" : "text-esi-text-muted hover:text-esi-text-secondary",
          )}
          aria-pressed={liked}
          aria-label={liked ? "حذف پسند" : "پسندیدن"}
        >
          <Icon name="Heart" size={16} fill={liked ? "currentColor" : "none"} />
          {toPersianDigits(post.likeCount)}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-esi-text-muted tabular-nums">
          <Icon name="MessageCircle" size={16} />
          {toPersianDigits(post.commentCount)}
        </span>
      </footer>
      {post.comments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {post.comments.map((c) => (
            <p key={c.id} className="text-xs leading-6 text-esi-text-secondary">
              <strong className="text-esi-text-primary">{c.author}:</strong> {c.content}
            </p>
          ))}
        </div>
      )}
    </motion.article>
  );
}
