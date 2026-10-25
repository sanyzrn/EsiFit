"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { api, errorMessage, isApiError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { formatRelative } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";
import type {
  CommunityPost as Post,
  CommunityComment,
  CommunityFeed,
} from "./types";

function communityError(error: unknown): string {
  return isApiError(error) && error.code === "network"
    ? "اتصال برقرار نشد. اینترنت را بررسی کن و دوباره تلاش کن."
    : errorMessage(error);
}

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
  leaderboard: Array<{
    rank: number;
    name: string;
    tier: string;
    score: number;
    isMe: boolean;
  }>;
  daysLeft: number;
};

export function CommunityView({ signedIn }: { signedIn: boolean }) {
  const challengesEnabled = useFeatureFlag("CHALLENGES");
  const [scope, setScope] = React.useState<"all" | "mine">("all");
  const [posts, setPosts] = React.useState<Post[] | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [feedError, setFeedError] = React.useState<string | null>(null);
  const [challenges, setChallenges] = React.useState<Challenge[] | null>(null);
  const [challengeError, setChallengeError] = React.useState<string | null>(
    null,
  );
  const [joining, setJoining] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [pendingLikes, setPendingLikes] = React.useState<Set<string>>(
    new Set(),
  );
  const generation = React.useRef(0);
  const likeLocks = React.useRef(new Set<string>());
  const postingLock = React.useRef(false);
  const { toast } = useToast();

  const loadFeed = React.useCallback(
    async (cursor?: string) => {
      const version = cursor ? generation.current : ++generation.current;
      setFeedError(null);
      if (cursor) setLoadingMore(true);
      else setPosts(null);
      try {
        const query = new URLSearchParams({
          scope,
          ...(cursor ? { cursor } : {}),
        });
        const res = await api<CommunityFeed>(`/api/community/feed?${query}`);
        if (version !== generation.current) return;
        setPosts((previous) =>
          cursor
            ? [
                ...(previous ?? []),
                ...res.posts.filter(
                  (p) => !previous?.some((old) => old.id === p.id),
                ),
              ]
            : res.posts,
        );
        setNextCursor(res.nextCursor);
      } catch (error) {
        if (version === generation.current) setFeedError(communityError(error));
      } finally {
        if (version === generation.current) setLoadingMore(false);
      }
    },
    [scope],
  );

  const loadChallenges = React.useCallback(async () => {
    setChallengeError(null);
    try {
      const res = await api<{ challenges: Challenge[] }>(
        "/api/community/challenges",
      );
      setChallenges(res.challenges);
    } catch (error) {
      setChallengeError(communityError(error));
    }
  }, []);

  React.useEffect(() => {
    void loadFeed();
    return () => {
      generation.current++;
    };
  }, [loadFeed]);
  React.useEffect(() => {
    if (challengesEnabled) void loadChallenges();
  }, [loadChallenges, challengesEnabled]);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (postingLock.current || draft.trim().length < 3) return;
    postingLock.current = true;
    setPosting(true);
    try {
      const res = await api<{ post: Post }>("/api/community/feed", {
        method: "POST",
        json: { content: draft.trim() },
      });
      setPosts((previous) => [res.post, ...(previous ?? [])]);
      setDraft("");
      toast({ title: "پست منتشر شد" });
    } catch (error) {
      toast({
        title: "انتشار ناموفق",
        description: communityError(error),
        variant: "destructive",
      });
    } finally {
      postingLock.current = false;
      setPosting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    if (!signedIn || likeLocks.current.has(post.id)) return;
    likeLocks.current.add(post.id);
    setPendingLikes(new Set(likeLocks.current));
    const patch = (change: Partial<Post>) =>
      setPosts(
        (previous) =>
          previous?.map((p) => (p.id === post.id ? { ...p, ...change } : p)) ??
          null,
      );
    patch({
      liked: !post.liked,
      likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)),
    });
    try {
      const res = await api<{ likeCount: number }>("/api/community/like", {
        method: "POST",
        json: { postId: post.id, liked: !post.liked },
      });
      patch({ likeCount: res.likeCount });
    } catch (error) {
      patch({ liked: post.liked, likeCount: post.likeCount });
      toast({
        title: "ثبت پسند ناموفق بود",
        description: communityError(error),
        variant: "destructive",
      });
    } finally {
      likeLocks.current.delete(post.id);
      setPendingLikes(new Set(likeLocks.current));
    }
  };

  const join = async (id: string) => {
    if (!signedIn || joining) return;
    setJoining(id);
    try {
      await api("/api/community/challenges", {
        method: "POST",
        json: { challengeId: id },
      });
      await loadChallenges();
      toast({ title: "به چالش اضافه شدی 🎯" });
    } catch (error) {
      toast({
        title: "عضویت ناموفق",
        description: communityError(error),
        variant: "destructive",
      });
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-6">
      <PageHeader
        title="با هم، یک قدم جلوتر"
        description="تمرین امروزت، تجربه فردای یکی دیگه‌ست. مسیرت رو با انجمن اسی‌فیت شریک شو."
      />
      <div className="space-y-5 px-4 lg:px-8">
        <Tabs defaultValue="feed">
          <TabsList
            className={cn(
              "mb-5 grid h-12 w-full",
              challengesEnabled ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <TabsTrigger value="feed" className="gap-2">
              <Icon name="MessagesSquare" size={17} />
              انجمن
            </TabsTrigger>
            {challengesEnabled && (
              <TabsTrigger value="challenges" className="gap-2">
                <Icon name="Trophy" size={17} />
                چالش‌ها
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="feed" className="space-y-4">
            {signedIn ? (
              <form
                onSubmit={(event) => void publish(event)}
                className="rounded-2xl border border-border bg-surface-1 p-4"
              >
                <label
                  htmlFor="community-draft"
                  className="mb-3 block text-sm font-bold"
                >
                  امروز به چی افتخار می‌کنی؟
                </label>
                <textarea
                  id="community-draft"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={posting}
                  placeholder="یک رکورد تازه، یک قدم کوچک یا سوالی از بقیه…"
                  rows={3}
                  maxLength={500}
                  className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs tabular-nums text-esi-text-muted">
                    {toPersianDigits(draft.length)} / ۵۰۰ · عمومی
                  </span>
                  <Button
                    type="submit"
                    disabled={posting || draft.trim().length < 3}
                    className="min-h-11 gap-2"
                  >
                    <Icon name="SendHorizontal" size={16} />
                    {posting ? "در حال انتشار…" : "انتشار پست"}
                  </Button>
                </div>
              </form>
            ) : (
              <Button asChild>
                <Link href="/auth/login">برای مشارکت وارد شو</Link>
              </Button>
            )}
            <div className="flex items-center justify-between gap-2">
              <div
                className="flex gap-2"
                role="group"
                aria-label="فیلتر پست‌ها"
              >
                {(["all", "mine"] as const)
                  .filter((value) => signedIn || value === "all")
                  .map((value) => (
                    <Button
                      key={value}
                      variant={scope === value ? "secondary" : "ghost"}
                      aria-pressed={scope === value}
                      onClick={() => setScope(value)}
                      className="min-h-11 text-xs"
                    >
                      {value === "all" ? "همه پست‌ها" : "پست‌های من"}
                    </Button>
                  ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="تازه‌کردن پست‌ها"
                onClick={() => void loadFeed()}
                className="size-11"
              >
                <Icon name="RefreshCw" size={17} />
              </Button>
            </div>
            {feedError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 p-4 text-sm"
              >
                <p>{feedError}</p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() =>
                    void loadFeed(nextCursor && posts ? nextCursor : undefined)
                  }
                >
                  تلاش دوباره
                </Button>
              </div>
            )}
            {!posts && !feedError ? (
              <div className="space-y-4" aria-label="بارگذاری پست‌ها">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </div>
            ) : posts?.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <Icon
                  name="MessagesSquare"
                  size={36}
                  className="mx-auto mb-4 text-primary"
                />
                <h2 className="font-bold">
                  {scope === "mine"
                    ? "داستان تو از همین‌جا شروع می‌شه"
                    : "اولین جرقه انجمن رو تو بزن"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-esi-text-secondary">
                  از تجربه تمرینت بنویس یا سوالی که توی ذهنت هست بپرس.
                </p>
              </div>
            ) : (
              posts?.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  signedIn={signedIn}
                  likePending={pendingLikes.has(post.id)}
                  onLike={() => void toggleLike(post)}
                  onDelete={() =>
                    setPosts(
                      (previous) =>
                        previous?.filter((p) => p.id !== post.id) ?? null,
                    )
                  }
                  onCommentCount={(count) =>
                    setPosts(
                      (previous) =>
                        previous?.map((p) =>
                          p.id === post.id ? { ...p, commentCount: count } : p,
                        ) ?? null,
                    )
                  }
                />
              ))
            )}
            {nextCursor && posts && (
              <Button
                variant="secondary"
                disabled={loadingMore}
                className="min-h-12 w-full"
                onClick={() => void loadFeed(nextCursor)}
              >
                {loadingMore ? "در حال دریافت…" : "پست‌های بیشتر"}
              </Button>
            )}
          </TabsContent>
          {challengesEnabled && (
            <TabsContent value="challenges" className="space-y-4">
              {challengeError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-border p-5"
                >
                  <p>{challengeError}</p>
                  <Button
                    className="mt-3"
                    onClick={() => void loadChallenges()}
                  >
                    تلاش دوباره
                  </Button>
                </div>
              ) : !challenges ? (
                <Skeleton className="h-52 rounded-2xl" />
              ) : challenges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                  <Icon
                    name="Flag"
                    className="mx-auto mb-4 text-primary"
                    size={36}
                  />
                  <h2 className="font-bold">فعلاً چالش فعالی نداریم</h2>
                  <p className="mt-2 text-sm text-esi-text-secondary">
                    تا چالش بعدی، پیشرفتت رو در انجمن به اشتراک بذار.
                  </p>
                </div>
              ) : (
                challenges.map((ch) => (
                  <section
                    key={ch.id}
                    className="rounded-2xl border border-border bg-surface-1 p-4 sm:p-6"
                  >
                    <header className="flex flex-wrap items-start gap-3">
                      <span className="text-3xl" aria-hidden>
                        {ch.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold">{ch.name}</h2>
                        <p className="mt-1 text-sm leading-7 text-esi-text-secondary">
                          {ch.description}
                        </p>
                      </div>
                      {ch.joined ? (
                        <span className="rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                          عضو هستی
                        </span>
                      ) : (
                        <Button
                          disabled={Boolean(joining) || !signedIn}
                          onClick={() => void join(ch.id)}
                        >
                          {joining === ch.id ? "در حال عضویت…" : "شرکت می‌کنم"}
                        </Button>
                      )}
                    </header>
                    <p className="mt-4 text-xs text-esi-text-muted">
                      {toPersianDigits(ch.participantCount)} شرکت‌کننده ·{" "}
                      {toPersianDigits(ch.daysLeft)} روز باقی‌مانده
                    </p>
                    {ch.joined && (
                      <div className="mt-4 rounded-xl bg-surface-2 p-4">
                        <p className="text-sm font-bold">
                          امتیاز تو: {toPersianDigits(ch.myScore ?? 0)} /{" "}
                          {toPersianDigits(ch.targetValue)}
                        </p>
                        <progress
                          aria-label="پیشرفت تو در چالش"
                          className="mt-3 h-2 w-full accent-primary"
                          max={Math.max(1, ch.targetValue)}
                          value={Math.max(
                            0,
                            Math.min(ch.myScore ?? 0, ch.targetValue),
                          )}
                        />
                      </div>
                    )}
                    <h3 className="mb-2 mt-5 text-xs font-bold text-esi-text-secondary">
                      برترین‌ها
                    </h3>
                    {ch.leaderboard.length === 0 ? (
                      <p className="py-3 text-xs text-esi-text-muted">
                        هنوز امتیازی ثبت نشده؛ تو شروع کن.
                      </p>
                    ) : (
                      <ol className="space-y-2">
                        {ch.leaderboard.slice(0, 5).map((row) => (
                          <li
                            key={row.rank}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-3",
                              row.isMe ? "bg-primary/10" : "bg-surface-2",
                            )}
                          >
                            <span className="text-primary">
                              {toPersianDigits(row.rank)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {row.name}
                              {row.isMe && " (تو)"}
                            </span>
                            <strong className="text-sm tabular-nums">
                              {toPersianDigits(row.score)}
                            </strong>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function PostCard({
  post,
  signedIn,
  likePending,
  onLike,
  onDelete,
  onCommentCount,
}: {
  post: Post;
  signedIn: boolean;
  likePending: boolean;
  onLike: () => void;
  onDelete: () => void;
  onCommentCount: (count: number) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [comments, setComments] = React.useState(post.comments);
  const [cursor, setCursor] = React.useState<number | null>(0);
  const [commentLoading, setCommentLoading] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const commentLock = React.useRef(false);
  const { toast } = useToast();

  const loadComments = async (offset = 0) => {
    if (commentLock.current) return;
    commentLock.current = true;
    setCommentLoading(true);
    setError(null);
    try {
      const res = await api<{
        comments: CommunityComment[];
        nextCursor: number | null;
      }>(
        `/api/community/comment?postId=${encodeURIComponent(post.id)}&cursor=${offset}`,
      );
      setComments((previous) =>
        offset === 0
          ? res.comments
          : [
              ...previous,
              ...res.comments.filter(
                (c) => !previous.some((old) => old.id === c.id),
              ),
            ],
      );
      setCursor(res.nextCursor);
    } catch (e) {
      setError(communityError(e));
    } finally {
      commentLock.current = false;
      setCommentLoading(false);
    }
  };
  const sendComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (commentLock.current || sending || !commentDraft.trim()) return;
    commentLock.current = true;
    setSending(true);
    setError(null);
    try {
      const res = await api<{
        comment: CommunityComment;
        commentCount: number;
      }>("/api/community/comment", {
        method: "POST",
        json: { postId: post.id, content: commentDraft.trim() },
      });
      setComments((previous) => [...previous, res.comment]);
      onCommentCount(res.commentCount);
      setCommentDraft("");
    } catch (e) {
      setError(communityError(e));
    } finally {
      commentLock.current = false;
      setSending(false);
    }
  };
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api("/api/community/feed", {
        method: "DELETE",
        json: { postId: post.id },
      });
      onDelete();
    } catch (e) {
      setError(communityError(e));
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };
  const share = async () => {
    try {
      const url = `${window.location.origin}/community`;
      if (navigator.share)
        await navigator.share({
          title: "انجمن اسی‌فیت",
          text: post.content,
          url,
        });
      else {
        await navigator.clipboard.writeText(`${post.content}\n${url}`);
        toast({ title: "متن و پیوند پست کپی شد" });
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        toast({ title: "اشتراک‌گذاری ممکن نشد", variant: "destructive" });
    }
  };

  return (
    <article
      id={`post-${post.id}`}
      className="scroll-mt-24 rounded-2xl border border-border bg-surface-1 p-4 sm:p-5"
    >
      <header className="mb-4 flex items-center gap-3">
        <Avatar className="size-11">
          <AvatarFallback className="bg-primary/10 font-bold text-primary">
            {post.author.name.trim()[0] ?? "؟"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{post.author.name}</p>
          <time
            dateTime={post.createdAt}
            className="text-[11px] text-esi-text-muted"
          >
            {formatRelative(post.createdAt)}
          </time>
        </div>
        {post.isOwner && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="حذف پست من"
            onClick={() => setDeleteOpen(true)}
            className="size-11 text-esi-text-muted"
          >
            <Icon name="Trash2" size={16} />
          </Button>
        )}
      </header>
      <p className="whitespace-pre-wrap break-words text-sm leading-8 [overflow-wrap:anywhere]">
        {post.content}
      </p>
      <footer className="mt-4 flex items-center gap-2 border-t border-border pt-2">
        <Button
          variant="ghost"
          disabled={!signedIn || likePending}
          onClick={onLike}
          aria-pressed={post.liked}
          aria-label={post.liked ? "حذف پسند" : "پسندیدن"}
          className={cn(
            "min-h-11 gap-2 px-3 text-xs",
            post.liked && "text-coral",
          )}
        >
          <Icon
            name="Heart"
            size={18}
            fill={post.liked ? "currentColor" : "none"}
          />
          {toPersianDigits(post.likeCount)}
        </Button>
        <Button
          variant="ghost"
          className="min-h-11 gap-2 px-3 text-xs"
          aria-expanded={expanded}
          aria-controls={`comments-${post.id}`}
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded && cursor === 0) void loadComments();
          }}
        >
          <Icon name="MessageCircle" size={18} />
          {toPersianDigits(post.commentCount)} نظر
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ms-auto size-11"
          aria-label="اشتراک‌گذاری پست"
          onClick={() => void share()}
        >
          <Icon name="Share2" size={18} />
        </Button>
      </footer>
      {expanded && (
        <section
          id={`comments-${post.id}`}
          className="mt-3 space-y-3 border-t border-border pt-4"
          aria-label="گفت‌وگوی پست"
        >
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl bg-surface-2 px-3 py-2 text-xs leading-7"
            >
              <strong>{c.author}</strong>
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {c.content}
              </p>
            </div>
          ))}
          {!commentLoading && comments.length === 0 && (
            <p className="text-xs text-esi-text-muted">
              اولین نظر رو تو بنویس.
            </p>
          )}
          {commentLoading && (
            <p role="status" className="text-xs text-esi-text-muted">
              در حال دریافت نظرها…
            </p>
          )}
          {cursor !== null && (
            <Button
              variant="ghost"
              disabled={commentLoading}
              className="min-h-11 w-full text-xs"
              onClick={() => void loadComments(cursor)}
            >
              {cursor === 0 ? "دریافت نظرها" : "نظرهای بیشتر"}
            </Button>
          )}
          {signedIn && (
            <form
              onSubmit={(event) => void sendComment(event)}
              className="space-y-2"
            >
              <label
                htmlFor={`comment-${post.id}`}
                className="block text-xs font-semibold"
              >
                نظر تو
              </label>
              <textarea
                id={`comment-${post.id}`}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                maxLength={300}
                rows={2}
                disabled={sending}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-esi-text-muted">
                  {toPersianDigits(commentDraft.length)} / ۳۰۰
                </span>
                <Button
                  type="submit"
                  disabled={sending || commentLoading || !commentDraft.trim()}
                  className="min-h-11"
                >
                  {sending ? "در حال ارسال…" : "ارسال نظر"}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs leading-6 text-destructive">
          {error}
        </p>
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>پستت حذف بشه؟</AlertDialogTitle>
            <AlertDialogDescription>
              پست و نظرهای زیرش حذف می‌شن و قابل بازگردانی نیستند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {deleting ? "در حال حذف…" : "حذف پست"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
