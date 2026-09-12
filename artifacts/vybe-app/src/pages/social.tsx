import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Send,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  getGetSocialFeedQueryKey,
  getGetProfileQueryKey,
  getGetSocialPostQueryKey,
  getGetSocialProfileQueryKey,
  getListSocialCommentsQueryKey,
  useBlockSocialProfile,
  useCreateSocialComment,
  useCreateSocialPost,
  useDeleteSocialComment,
  useDeleteSocialPost,
  useFollowSocialProfile,
  useGetSocialFeed,
  useGetProfile,
  useGetSocialPost,
  useGetSocialProfile,
  useLikeSocialPost,
  useListSocialComments,
  useUnblockSocialProfile,
  useUnlikeSocialPost,
  useUnfollowSocialProfile,
  useUpdateSocialPost,
} from "@workspace/api-client-react";
import type { SocialPost, SocialPostInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const feedFilters = [
  { value: "for-you" as const, label: "For You" },
  { value: "following" as const, label: "Following" },
  { value: "trending" as const, label: "Trending" },
  { value: "latest" as const, label: "Latest" },
];
const categories = ["All", "Creativity", "Photo", "Text", "AI", "Music"];

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "V";
}

function LocalAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return <div className={`avatar avatar-${size} avatar-violet`}>{initials(name)}</div>;
}

function LoadingState() {
  return <div className="loading-stack"><div className="skeleton skeleton-hero" /><div className="skeleton-grid"><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></div></div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="empty-state error-state"><div className="empty-icon"><X /></div><h2>Something went off-beat</h2><p>We could not load this view. Try again in a moment.</p><Button onClick={onRetry}>Try again</Button></div>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function SocialAvatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  if (!avatarUrl || failed) return <LocalAvatar name={name} size={size} />;
  return <img className={`social-avatar social-avatar-${size}`} src={avatarUrl} alt={`${name} avatar`} onError={() => setFailed(true)} />;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function sharePost(post: SocialPost) {
  const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
  return (async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Post by ${post.author.displayName}`, text: post.body, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "The post link is ready to share." });
    } catch {
      toast({ title: "Could not share post", description: "Try copying the page address.", variant: "destructive" });
    }
  })();
}

function CommentList({ postId, currentProfileId }: { postId: string; currentProfileId?: string }) {
  const qc = useQueryClient();
  const comments = useListSocialComments(postId, {
    query: { enabled: true, queryKey: getListSocialCommentsQueryKey(postId) },
  });
  const remove = useDeleteSocialComment({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListSocialCommentsQueryKey(postId) });
        void qc.invalidateQueries({ queryKey: getGetSocialPostQueryKey(postId) });
        void qc.invalidateQueries({ queryKey: ["/api/social/feed"] });
      },
      onError: () => toast({ title: "Could not remove comment", description: "Try again in a moment.", variant: "destructive" }),
    },
  });
  if (comments.isLoading) return <div className="social-comments-loading"><span /><span /><span /></div>;
  if (comments.isError) return <p className="social-inline-error">Comments could not be loaded.</p>;
  if (!comments.data?.length) return <p className="social-comment-empty">No comments yet. Start the conversation.</p>;
  return <div className="social-comment-list">{comments.data.map((comment) => <div className="social-comment" key={comment.id}>
    <SocialAvatar name={comment.author.displayName} avatarUrl={comment.author.avatarUrl} size="sm" />
    <div className="social-comment-body"><div><strong>{comment.author.displayName}</strong><span>@{comment.author.username} · {relativeTime(comment.createdAt)}</span></div><p>{comment.body}</p></div>
    {comment.author.id === currentProfileId && <button className="social-delete-comment" aria-label="Delete comment" onClick={() => remove.mutate({ commentId: comment.id })} disabled={remove.isPending}><Trash2 /></button>}
  </div>)}</div>;
}

function CommentComposer({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const create = useCreateSocialComment({
    mutation: {
      onSuccess: () => {
        setBody("");
        void qc.invalidateQueries({ queryKey: getListSocialCommentsQueryKey(postId) });
        void qc.invalidateQueries({ queryKey: getGetSocialPostQueryKey(postId) });
        void qc.invalidateQueries({ queryKey: ["/api/social/feed"] });
      },
      onError: () => toast({ title: "Could not add comment", description: "Keep it under 500 characters.", variant: "destructive" }),
    },
  });
  return <form className="social-comment-composer" onSubmit={(event) => {
    event.preventDefault();
    if (!body.trim()) return;
    create.mutate({ postId, data: { body: body.trim() } });
  }}>
    <input value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} placeholder="Add a thoughtful comment..." aria-label="Comment" />
    <button type="submit" disabled={create.isPending || !body.trim()} aria-label="Publish comment">{create.isPending ? <Loader2 className="spin" /> : <ArrowUpRight />}</button>
  </form>;
}

function SocialPostCard({ post, currentProfileId }: { post: SocialPost; currentProfileId?: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [editCategory, setEditCategory] = useState(post.category);
  const isOwner = post.author.id === currentProfileId;
  const like = useLikeSocialPost({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: ["/api/social/feed"] }); void qc.invalidateQueries({ queryKey: getGetSocialPostQueryKey(post.id) }); } } });
  const unlike = useUnlikeSocialPost({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: ["/api/social/feed"] }); void qc.invalidateQueries({ queryKey: getGetSocialPostQueryKey(post.id) }); } } });
  const update = useUpdateSocialPost({
    mutation: {
      onSuccess: () => {
        setEditing(false);
        void qc.invalidateQueries({ queryKey: ["/api/social/feed"] });
        void qc.invalidateQueries({ queryKey: getGetSocialPostQueryKey(post.id) });
        toast({ title: "Post updated", description: "Your changes are live." });
      },
      onError: () => toast({ title: "Could not update post", description: "Check the post text and try again.", variant: "destructive" }),
    },
  });
  const remove = useDeleteSocialPost({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["/api/social/feed"] });
        toast({ title: "Post deleted", description: "The post has been removed." });
      },
      onError: () => toast({ title: "Could not delete post", description: "Try again in a moment.", variant: "destructive" }),
    },
  });
  const toggleLike = () => (post.liked ? unlike.mutate({ postId: post.id }) : like.mutate({ postId: post.id }));
  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editBody.trim()) return;
    update.mutate({ postId: post.id, data: { body: editBody.trim(), category: editCategory } });
  };
  return <article className="social-post-card" id={`post-${post.id}`}>
    <div className="social-post-header">
      <button className="social-author" onClick={() => navigate(`/profile/${post.author.id}`)}>
        <SocialAvatar name={post.author.displayName} avatarUrl={post.author.avatarUrl} size="md" />
        <span><strong>{post.author.displayName}</strong><small>@{post.author.username} · {relativeTime(post.createdAt)}</small></span>
      </button>
      <div className="social-post-header-actions">
        <span className="social-category">{post.category}</span>
        <button className="social-more" aria-label="More post actions" onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal /></button>
        {menuOpen && <div className="social-more-menu">
          <button onClick={() => { void sharePost(post); setMenuOpen(false); }}><Share2 /> Share</button>
          {isOwner && <button onClick={() => { setEditing(true); setMenuOpen(false); }}><ArrowUpRight /> Edit</button>}
          {isOwner && <button className="danger" onClick={() => { if (window.confirm("Delete this post?")) remove.mutate({ postId: post.id }); setMenuOpen(false); }}><Trash2 /> Delete</button>}
        </div>}
      </div>
    </div>
    {editing ? <form className="social-edit-form" onSubmit={saveEdit}>
      <textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={4} maxLength={2000} />
      <div className="social-edit-actions"><select value={editCategory} onChange={(event) => setEditCategory(event.target.value)}>{categories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select><Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setEditBody(post.body); }}><X /> Cancel</Button><Button type="submit" size="sm" disabled={update.isPending}>{update.isPending ? <Loader2 className="spin" /> : <Check />} Save</Button></div>
    </form> : <p className="social-post-body">{post.body}</p>}
    <div className="social-post-actions">
      <button className={post.liked ? "is-liked" : ""} onClick={toggleLike} disabled={like.isPending || unlike.isPending}><Heart /> <span>{post.likeCount}</span></button>
      <button className={commentsOpen ? "is-open" : ""} onClick={() => setCommentsOpen((open) => !open)}><MessageCircle /> <span>{post.commentCount}</span></button>
      <button onClick={() => void sharePost(post)}><Share2 /> <span>Share</span></button>
    </div>
    {commentsOpen && <div className="social-comments-panel"><CommentList postId={post.id} currentProfileId={currentProfileId} /><CommentComposer postId={post.id} /></div>}
  </article>;
}

function Composer() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Creativity");
  const create = useCreateSocialPost({
    mutation: {
      onSuccess: () => {
        setBody("");
        void qc.invalidateQueries({ queryKey: ["/api/social/feed"] });
        toast({ title: "Post published", description: "Your thought is now in the ZYVIO feed." });
      },
      onError: () => toast({ title: "Could not publish post", description: "Add between 1 and 2,000 characters.", variant: "destructive" }),
    },
  });
  return <form className="social-composer panel" onSubmit={(event) => {
    event.preventDefault();
    if (!body.trim()) return;
    const data: SocialPostInput = { body: body.trim(), category };
    create.mutate({ data });
  }}>
    <div className="social-composer-heading"><span className="eyebrow">Share a signal</span><span>{body.length}/2000</span></div>
    <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} placeholder="What are you making, learning, or noticing?" />
    <div className="social-composer-footer"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Post category">{categories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select><Button type="submit" disabled={create.isPending || !body.trim()}>{create.isPending ? <Loader2 className="spin" /> : <ArrowUpRight />} Publish</Button></div>
  </form>;
}

export function SocialFeedPage() {
  const [filter, setFilter] = useState<"for-you" | "following" | "trending" | "latest">("for-you");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();
  const params = useMemo(() => ({ filter, category: category === "All" ? undefined : category, page }), [filter, category, page]);
  const feed = useGetSocialFeed(params, { query: { queryKey: getGetSocialFeedQueryKey(params), refetchOnWindowFocus: true, staleTime: 10_000 } });
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), staleTime: 30_000 } });
  const items = feed.data?.items ?? [];
  return <div className="social-page">
    <PageHeader eyebrow="Social / live" title="The ZYVIO feed" description="Find the people, ideas, and works moving the room." action={<Button onClick={() => document.getElementById("social-composer")?.scrollIntoView({ behavior: "smooth" })}><ArrowUpRight /> Share a thought</Button>} />
    <Composer />
    <div id="social-composer" className="social-toolbar">
      <div className="social-filter-tabs">{feedFilters.map((item) => <button key={item.value} className={filter === item.value ? "is-selected" : ""} onClick={() => { setFilter(item.value); setPage(1); }}>{item.label}</button>)}</div>
      <div className="social-category-tabs">{categories.map((item) => <button key={item} className={category === item ? "is-selected" : ""} onClick={() => { setCategory(item); setPage(1); }}>{item}</button>)}</div>
    </div>
    {feed.isLoading ? <div className="social-feed-list"><LoadingState /></div> : feed.isError ? <ErrorState onRetry={() => void feed.refetch()} /> : items.length === 0 ? <div className="empty-state social-empty"><div className="empty-icon"><MessageCircle /></div><h2>No posts in this lane yet</h2><p>Follow a creator or publish the first signal for this filter.</p><Button onClick={() => document.querySelector<HTMLTextAreaElement>(".social-composer textarea")?.focus()}>Write the first post</Button></div> : <div className="social-feed-layout"><main className="social-feed-list">{items.map((post) => <SocialPostCard key={post.id} post={post} currentProfileId={profile.data?.id} />)}<div className="social-pagination"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft /> Previous</Button><span>Page {feed.data?.page ?? page}</span><Button variant="secondary" size="sm" disabled={!feed.data?.hasMore} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight /></Button></div></main><aside className="social-side-note panel"><span className="eyebrow">Your social loop</span><h2>Stay close to the work.</h2><p>Following keeps your feed focused. Trending shows what the wider ZYVIO is responding to.</p><button onClick={() => navigate("/leaderboard")}>See the leaderboard <ArrowUpRight /></button></aside></div>}
  </div>;
}

export function SocialPostPage() {
  const [, params] = useRoute("/feed/:id");
  const id = params?.id ?? "";
  const post = useGetSocialPost(id, { query: { enabled: Boolean(id), queryKey: getGetSocialPostQueryKey(id) } });
  if (post.isLoading) return <LoadingState />;
  if (post.isError || !post.data) return <ErrorState onRetry={() => void post.refetch()} />;
  return <div className="social-single-page"><PageHeader eyebrow={`${post.data.category} / post`} title="One thought, up close." description="A single post from the ZYVIO community." /><SocialPostCard post={post.data} /></div>;
}

export function SocialProfilePage() {
  const [, params] = useRoute("/profile/:id");
  const profileId = params?.id ?? "";
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const profile = useGetSocialProfile(profileId, { query: { enabled: Boolean(profileId), queryKey: getGetSocialProfileQueryKey(profileId), refetchOnWindowFocus: true } });
  const [blocked, setBlocked] = useState(false);
  const follow = useFollowSocialProfile({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetSocialProfileQueryKey(profileId) }); void qc.invalidateQueries({ queryKey: ["/api/social/feed"] }); } } });
  const unfollow = useUnfollowSocialProfile({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetSocialProfileQueryKey(profileId) }); void qc.invalidateQueries({ queryKey: ["/api/social/feed"] }); } } });
  const block = useBlockSocialProfile({ mutation: { onSuccess: () => { setBlocked(true); toast({ title: "Profile blocked", description: "You will no longer see this creator in your social loop." }); } } });
  const unblock = useUnblockSocialProfile({ mutation: { onSuccess: () => { setBlocked(false); toast({ title: "Profile unblocked", description: "This creator can appear in your feed again." }); } } });
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !profile.data) return <ErrorState onRetry={() => void profile.refetch()} />;
  const data = profile.data;
  return <div className="social-profile-page"><button className="social-back-button" onClick={() => navigate("/feed")}><ChevronLeft /> Back to feed</button><section className="social-profile-hero panel"><SocialAvatar name={data.displayName} avatarUrl={data.avatarUrl} size="lg" /><div className="social-profile-copy"><span className="eyebrow">@{data.username}</span><h1>{data.displayName}</h1><p>{data.bio || "This creator has not added a bio yet."}</p><div className="social-profile-stats"><span><strong>{data.followerCount}</strong> followers</span><span><strong>{data.followingCount}</strong> following</span><span><strong>{data.rankingPoints.toLocaleString()}</strong> points</span></div></div><div className="social-profile-actions"><Button onClick={() => navigate(`/messages?profile=${encodeURIComponent(profileId)}`)}><Send /> Message</Button><Button onClick={() => (data.isFollowing ? unfollow.mutate({ profileId }) : follow.mutate({ profileId }))} disabled={follow.isPending || unfollow.isPending}>{data.isFollowing ? <Check /> : <UserPlus />} {data.isFollowing ? "Unfollow" : "Follow"}</Button><Button variant="secondary" onClick={() => { if (window.confirm(`${blocked ? "Unblock" : "Block"} @${data.username}?`)) (blocked ? unblock : block).mutate({ profileId }); }} disabled={block.isPending || unblock.isPending}><Shield /> {blocked ? "Unblock" : "Block"}</Button></div></section><div className="social-profile-grid"><div className="social-profile-stat panel"><span className="eyebrow">Creator level</span><strong>{data.level}</strong><small>{data.league} league · {data.winRate}% win rate</small></div><div className="social-profile-stat panel"><span className="eyebrow">Momentum</span><strong>{data.streak} days</strong><small>{data.wins} wins · {data.losses} losses</small></div></div></div>;
}
