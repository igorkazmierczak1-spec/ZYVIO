import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  useCreateBattle,
  useGenerateIdeas,
  useGetBattle,
  useGetDashboard,
  useGetLeaderboard,
  useGetProfile,
  useJoinBattle,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useListBattles,
  useListNotifications,
  useUpdateProfile,
  useVoteBattle,
  useListPremiumPlans,
  useGetPremiumSubscription,
  useCreatePremiumCheckout,
  useCreatePremiumPortal,
  getGetBattleQueryKey,
  getGetDashboardQueryKey,
  getGetLeaderboardQueryKey,
  getGetProfileQueryKey,
  getListBattlesQueryKey,
  getListNotificationsQueryKey,
  getGetPremiumSubscriptionQueryKey,
} from "@workspace/api-client-react";
import type {
  Battle,
  BattleInput,
  Dashboard,
  Leaderboard,
  Notification,
  Profile,
} from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Compass,
  CreditCard,
  Crown,
  Flame,
  Globe2,
  Heart,
  Languages,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";
import {
  Route,
  Redirect,
  Switch,
  useLocation,
  useRoute,
  Router as WouterRouter,
} from "wouter";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import { AdminDashboardPage } from "@/pages/admin-dashboard";
import PremiumPage from "@/pages/premium";
import { SocialFeedPage, SocialPostPage, SocialProfilePage } from "@/pages/social";
import MessagesPage from "@/pages/messages";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    queryClient.clear();
    try {
      await signOut({ redirectUrl: `${basePath}/sign-in` });
    } catch {
      setIsSigningOut(false);
      toast({
        title: "Nie udało się wylogować",
        description: "Spróbuj ponownie za chwilę.",
        variant: "destructive",
      });
    }
  };

  if (compact) {
    return <button type="button" className="logout-button" onClick={handleLogout} disabled={isSigningOut}>{isSigningOut ? <Loader2 className="spin" /> : <LogOut />} {isSigningOut ? "Wylogowywanie..." : "Wyloguj"}</button>;
  }

  return <Button type="button" variant="secondary" className="profile-logout-button" onClick={handleLogout} disabled={isSigningOut}>{isSigningOut ? <Loader2 className="spin" /> : <LogOut />} {isSigningOut ? "Wylogowywanie..." : "Wyloguj"}</Button>;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
  },
  variables: {
    colorPrimary: "#7357ff",
    colorForeground: "#16131f",
    colorMutedForeground: "#7a7487",
    colorDanger: "#c74437",
    colorBackground: "#ffffff",
    colorInput: "#f6f5f8",
    colorInputForeground: "#16131f",
    colorNeutral: "#ebe8f0",
     fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "12px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#16131f]",
    headerSubtitle: "text-[#7a7487]",
    socialButtonsBlockButtonText: "text-[#16131f]",
    formFieldLabel: "text-[#4c4658]",
    footerActionLink: "text-[#5b43d2]",
    footerActionText: "text-[#7a7487]",
    dividerText: "text-[#7a7487]",
    identityPreviewEditButton: "text-[#5b43d2]",
    formFieldSuccessText: "text-[#537514]",
    alertText: "text-[#9d382e]",
    logoBox: "h-10",
    logoImage: "h-9",
    socialButtonsBlockButton: "border-[#ebe8f0]",
    formButtonPrimary: "bg-[#7357ff] hover:bg-[#5b43d2]",
    formFieldInput: "border-[#ebe8f0] bg-[#f6f5f8] text-[#16131f]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#ebe8f0]",
    alert: "bg-[#fff0ed] border-[#ffc9c0]",
    otpCodeFieldInput: "border-[#ebe8f0]",
    formFieldRow: "text-[#16131f]",
    main: "gap-5",
  },
};

const categoryFilters = ["All", "Photo", "Creativity", "Text", "AI", "Music"];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTimeLeft(endsAt: string) {
  const hours = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 3600000));
  if (hours < 1) return "ending soon";
  if (hours < 24) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export function Avatar({ name, size = "md", accent = "violet" }: { name: string; size?: "sm" | "md" | "lg"; accent?: string }) {
  return <div className={`avatar avatar-${size} avatar-${accent}`}>{initials(name)}</div>;
}

export function Logo({ onClick }: { onClick?: () => void }) {
  const content = (
    <div className="brand">
      <div className="brand-mark"><span /></div>
      <span>VYBE</span>
    </div>
  );
  if (!onClick) return content;
  return <button type="button" className="brand-button" aria-label="Go to VYBE home" onClick={onClick}>{content}</button>;
}

function IconButton({ label, children, onClick, active = false }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean }) {
  return <button aria-label={label} className={`icon-button ${active ? "is-active" : ""}`} onClick={onClick}>{children}</button>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: profile } = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: notifications } = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
      staleTime: 30_000,
    },
  });
  const hasUnreadNotifications = notifications?.some((notification) => !notification.read) ?? false;
  const navItems = [
    { href: "/feed", label: "Feed", icon: MessageCircle },
    { href: "/messages", label: "Messages", icon: Send },
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/battles", label: "Discover", icon: Compass },
    { href: "/battles/new", label: "Create battle", icon: Plus },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/profile", label: "Profile", icon: UserRound },
  ];
  const secondaryItems = [
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/ai", label: "VYBE AI", icon: Bot },
    { href: "/premium", label: "Premium", icon: Crown },
    { href: "/settings", label: "Settings", icon: Settings2 },
    ...(profile?.role === "ADMIN"
      ? [{ href: "/admin", label: "Panel administratora", icon: ShieldCheck }]
      : []),
  ];
  const isCurrent = (href: string) => href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Logo onClick={() => navigate("/")} />
          <IconButton label="Close menu" onClick={() => setSidebarOpen(false)}><X /></IconButton>
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav className="main-nav">
          {navItems.map(({ href, label, icon: Icon }) => (
            <button key={href} className={`nav-item ${isCurrent(href) ? "is-current" : ""}`} onClick={() => { navigate(href); setSidebarOpen(false); }}>
              <Icon /><span>{label}</span>{href === "/battles/new" && <span className="nav-plus">+</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-label secondary-label">More</div>
        <nav className="main-nav">
          {secondaryItems.map(({ href, label, icon: Icon }) => (
            <button key={href} className={`nav-item ${isCurrent(href) ? "is-current" : ""}`} onClick={() => { navigate(href); setSidebarOpen(false); }}>
               <Icon /><span>{label}</span>{label === "Notifications" && hasUnreadNotifications && <span className="notification-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
         <div className="season-card">
          <div className="season-orbit"><Sparkles /></div>
           <span className="eyebrow">Your momentum</span>
           <strong>{profile ? `${profile.streak} day streak` : "Loading your streak"}</strong>
           <span className="season-meta">{profile ? `${profile.xp.toLocaleString()} XP · level ${profile.level}` : "Loading your progress"}</span>
           <div className="season-progress"><span style={{ width: `${profile?.progress ?? 0}%` }} /></div>
        </div>
        <button className="sidebar-profile" onClick={() => navigate("/profile")}>
          <Avatar name={profile?.displayName ?? "VYBE User"} size="sm" />
          <span><strong>{profile?.displayName ?? "VYBE User"}{profile?.role === "ADMIN" && <span className="sidebar-admin-badge">ADMIN</span>}</strong><small>@{profile?.username ?? "account"}</small></span>
          <ChevronRight />
        </button>
        <LogoutButton compact />
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><IconButton label="Open menu" onClick={() => setSidebarOpen(true)}><Menu /></IconButton><Logo onClick={() => navigate("/")} /></div>
          <div className="topbar-search"><Search /><input placeholder="Search battles, creators, ideas..." aria-label="Search" /></div>
          <div className="topbar-actions">
            <IconButton label="Toggle theme" onClick={() => document.documentElement.classList.toggle("dark")}><Moon /></IconButton>
            <IconButton label="Notifications" active={location === "/notifications"} onClick={() => navigate("/notifications")}><Bell /><span className="icon-dot" /></IconButton>
            <button className="topbar-avatar" onClick={() => navigate("/profile")}><Avatar name={profile?.displayName ?? "VYBE User"} size="sm" /></button>
          </div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
      <nav className="mobile-nav">
        {navItems.filter(({ href }) => href !== "/battles/new").slice(0, 5).map(({ href, label, icon: Icon }) => <button key={href} className={isCurrent(href) ? "is-current" : ""} onClick={() => navigate(href)}><Icon /><span>{label}</span></button>)}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function LoadingState() {
  return <div className="loading-stack"><div className="skeleton skeleton-hero" /><div className="skeleton-grid"><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></div></div>;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <div className="empty-state error-state"><div className="empty-icon"><Zap /></div><h2>Something went off-beat</h2><p>We could not load this view. Try again in a moment.</p>{onRetry && <Button onClick={onRetry}>Try again</Button>}</div>;
}

export function StatCard({ icon: Icon, label, value, detail, accent }: { icon: typeof Zap; label: string; value: string | number; detail: string; accent: string }) {
  return <div className={`stat-card stat-${accent}`}><div className="stat-icon"><Icon /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function BattleCard({ battle, compact = false }: { battle: Battle; compact?: boolean }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const join = useJoinBattle({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListBattlesQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast({ title: "Battle joined", description: "Your spot is locked in." }); } } });
  const isBusy = join.isPending;
  return <article className={`battle-card tone-${battle.coverTone ?? "violet"} ${compact ? "battle-card-compact" : ""}`} onClick={() => navigate(`/battles/${battle.id}`)}>
    <div className="battle-card-glow" />
    <div className="battle-card-top"><span className="category-pill">{battle.category}</span><span className={`status-pill status-${battle.status}`}>{battle.status === "live" ? "Live now" : battle.status}</span></div>
    <div className="battle-card-copy"><h3>{battle.title}</h3><p>{battle.prompt}</p></div>
    <div className="battle-card-bottom"><div className="stacked-avatars">{battle.participants.slice(0, 3).map((participant, index) => <Avatar key={participant.id} name={participant.user.displayName} size="sm" accent={index === 1 ? "coral" : index === 2 ? "cyan" : "violet"} />)}<span className="participant-count">{battle.participantCount}/{battle.maxParticipants}</span></div><span className="battle-time"><Clock3 /> {formatTimeLeft(battle.endsAt)}</span></div>
    <div className="battle-card-footer"><span><Zap /> +{battle.rewardXp ?? 250} XP</span>{!compact && <Button size="sm" variant={battle.isJoined ? "secondary" : "default"} disabled={battle.isJoined || isBusy} onClick={(event) => { event.stopPropagation(); if (!battle.isJoined) join.mutate({ battleId: battle.id }); }}>{isBusy ? <Loader2 className="spin" /> : battle.isJoined ? <><Check /> Joined</> : <>Join battle <ArrowUpRight /></>}</Button>}</div>
  </article>;
}

function DashboardPage() {
  const [, navigate] = useLocation();
  const dashboard = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError || !dashboard.data) return <ErrorState onRetry={() => void dashboard.refetch()} />;
  const data = dashboard.data as Dashboard;
  const profile = data.profile;
  const levelProgress = Math.max(0, Math.min(100, profile.progress));
  return <div className="dashboard-page">
     <div className="welcome-row"><div><span className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><h1>Good evening, {profile.displayName.split(" ")[0]}<span className="title-dot">.</span></h1><p>Your next great VYBE is closer than you think.</p></div><Button className="create-cta" onClick={() => navigate("/battles/new")}><Plus /> Create battle</Button></div>
    <section className="hero-card">
       <div className="hero-copy"><span className="eyebrow">Your momentum</span><h2>Keep the streak<br /><em>alive.</em></h2><p>{profile.streak > 0 ? `${profile.streak} day streak. ` : "Start your streak today. "}{profile.xpForNextLevel.toLocaleString()} XP to the next level.</p><Button variant="secondary" onClick={() => navigate("/battles")}>Find your next battle <ArrowUpRight /></Button></div>
      <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-orbit orbit-three" />
       <div className="level-card"><div className="level-ring"><strong>{profile.level}</strong><span>level</span></div><div><span className="eyebrow">{profile.league} league</span><strong>{profile.xp.toLocaleString()} XP</strong><div className="level-bar"><span style={{ width: `${levelProgress}%` }} /></div><small>{profile.xpForNextLevel.toLocaleString()} XP to next level</small></div></div>
    </section>
     <div className="stats-grid"><StatCard icon={Swords} label="Active battles" value={data.stats.activeBattles} detail="From your dashboard" accent="violet" /><StatCard icon={Zap} label="Weekly XP" value={data.stats.weeklyXp.toLocaleString()} detail="Earned this week" accent="lime" /><StatCard icon={Target} label="Win rate" value={`${data.stats.winRate}%`} detail={`${profile.wins} wins · ${profile.losses} losses`} accent="coral" /><StatCard icon={Trophy} label="Global rank" value={`#${data.stats.globalRank}`} detail={`${profile.rankingPoints.toLocaleString()} ranking points`} accent="cyan" /></div>
     <div className="section-heading"><div><span className="eyebrow">Picked for you</span><h2>Featured battles</h2></div><button className="text-button" onClick={() => navigate("/battles")}>View all <ArrowUpRight /></button></div>
     {data.featuredBattles.length === 0 ? <div className="empty-state"><div className="empty-icon"><Compass /></div><h2>No active battles yet</h2><p>Start a 1v1 battle and invite a creator to make the next move.</p><Button onClick={() => navigate("/battles/new")}><Plus /> Create battle</Button></div> : <div className="battle-grid">{data.featuredBattles.map((battle) => <BattleCard key={battle.id} battle={battle} />)}</div>}
    <div className="dashboard-lower">
       <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">Your loop</span><h2>Recent activity</h2></div><IconButton label="Activity options"><Settings2 /></IconButton></div>{data.activity.length === 0 ? <div className="mini-empty">Your next vote or battle will appear here.</div> : data.activity.map((item) => <div className="activity-row" key={item.id}><div className={`activity-mark mark-${item.kind}`}><Zap /></div><div><strong>{item.text}</strong><small>{item.time}</small></div><ChevronRight /></div>)}</section>
       <section className="panel ranking-panel"><div className="panel-heading"><div><span className="eyebrow">This week</span><h2>Leaderboard</h2></div><button className="text-button" onClick={() => navigate("/leaderboard")}>Full ranking <ArrowUpRight /></button></div>{data.leaderboardPreview.length === 0 ? <div className="mini-empty">No ranking entries yet.</div> : data.leaderboardPreview.map((entry, index) => <div className="rank-row" key={entry.user.id}><span className={`rank-number ${index < 3 ? "top-rank" : ""}`}>{String(entry.position).padStart(2, "0")}</span><Avatar name={entry.user.displayName} size="sm" accent={index === 1 ? "coral" : index === 2 ? "cyan" : "violet"} /><div><strong>{entry.user.displayName}</strong><small>Level {entry.user.level} · {entry.league}</small></div><span className="rank-xp">{entry.xp.toLocaleString()} <small>XP</small></span></div>)}</section>
    </div>
  </div>;
}

function DiscoverPage() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState("All");
  const filters = category === "All" ? {} : { category };
  const battles = useListBattles(filters, { query: { queryKey: getListBattlesQueryKey(filters) } });
  const list = battles.data ?? [];
  return <div><PageHeader eyebrow="Discover" title="Find your next edge" description="Step into a live prompt, meet your match, and leave a mark." action={<Button onClick={() => navigate("/battles/new")}><Plus /> Create battle</Button>} /><div className="filter-row">{categoryFilters.map((item) => <button key={item} className={`filter-chip ${category === item ? "is-selected" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>{battles.isLoading ? <LoadingState /> : battles.isError ? <ErrorState onRetry={() => void battles.refetch()} /> : list.length === 0 ? <div className="empty-state"><div className="empty-icon"><Compass /></div><h2>No battles in this lane yet</h2><p>Start the next one and make the category yours.</p></div> : <div className="battle-grid discover-grid">{list.map((battle) => <BattleCard key={battle.id} battle={battle} />)}</div>}</div>;
}

function CreateBattlePage() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<BattleInput>({ title: "", category: "Creativity", prompt: "", endsAt: new Date(Date.now() + 48 * 3600000).toISOString(), maxParticipants: 2 });
  const qc = useQueryClient();
  const create = useCreateBattle({ mutation: { onSuccess: (battle) => { void qc.invalidateQueries({ queryKey: getListBattlesQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast({ title: "Battle created", description: "Your 1v1 arena is ready for a challenger." }); navigate(`/battles/${battle.id}`); }, onError: () => toast({ title: "Could not create battle", description: "Check the fields and try again.", variant: "destructive" }) } });
  const setField = (field: keyof BattleInput, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  return <div className="form-page"><PageHeader eyebrow="Create" title="Start a new 1v1 battle" description="Set one clear challenge. One challenger. One winner." /><form className="create-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ data: { ...form, maxParticipants: 2 } }); }}><div className="form-main"><div className="one-v-one-note"><Swords /> 1v1 format · two creator slots</div><label>Battle title<input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Give it a name people remember" required minLength={3} /></label><label>Category<div className="category-select-grid">{["Photo", "Music", "Creativity", "Text", "AI", "Quiz"].map((item) => <button type="button" key={item} className={form.category === item ? "selected" : ""} onClick={() => setField("category", item)}>{item}</button>)}</div></label><label>Challenge prompt<textarea value={form.prompt} onChange={(event) => setField("prompt", event.target.value)} placeholder="What will the two creators make, answer, or prove?" rows={5} required minLength={5} /></label></div><aside className="form-aside panel"><span className="eyebrow">1v1 battle settings</span><label>Closes on<input type="datetime-local" value={form.endsAt.slice(0, 16)} onChange={(event) => setField("endsAt", new Date(event.target.value).toISOString())} /></label><div className="one-v-one-note"><Users /> Exactly 2 participants</div><div className="form-tip"><Sparkles /><div><strong>Make it specific</strong><p>A focused prompt gives both creators a fair lane to stand out.</p></div></div><Button className="form-submit" type="submit" disabled={create.isPending}>{create.isPending ? <><Loader2 className="spin" /> Creating...</> : <>Publish battle <ArrowUpRight /></>}</Button></aside></form></div>;
}

function BattleDetailPage() {
  const [, params] = useRoute("/battles/:id");
  const id = params?.id ?? "";
  const battle = useGetBattle(id, { query: { enabled: Boolean(id), queryKey: getGetBattleQueryKey(id) } });
  const qc = useQueryClient();
  const join = useJoinBattle({ mutation: { onSuccess: (updatedBattle) => { qc.setQueryData(getGetBattleQueryKey(id), updatedBattle); void qc.invalidateQueries({ queryKey: getListBattlesQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast({ title: "You are in", description: "Your entry is ready." }); }, onError: () => toast({ title: "Could not join", description: "This battle may already be full.", variant: "destructive" }) } });
  const vote = useVoteBattle({ mutation: { onSuccess: (updatedBattle) => { qc.setQueryData(getGetBattleQueryKey(id), updatedBattle); void qc.invalidateQueries({ queryKey: getGetBattleQueryKey(id) }); void qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); void qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() }); toast({ title: updatedBattle.status === "completed" ? "Battle complete" : "Vote counted", description: updatedBattle.status === "completed" ? "The result is in." : "Your vote has been recorded." }); }, onError: () => toast({ title: "Vote not counted", description: "Try again when both entries are ready.", variant: "destructive" }) } });
  if (battle.isLoading) return <LoadingState />;
  if (battle.isError || !battle.data) return <ErrorState onRetry={() => void battle.refetch()} />;
  const data = battle.data;
  const winner = data.participants.find((participant) => participant.id === data.winnerParticipantId);
  const canJoin = !data.isJoined && data.status !== "completed" && data.participantCount < data.maxParticipants;
  const shareBattle = async () => {
    const shareData = { title: data.title, text: `Join this 1v1 battle on VYBE: ${data.title}`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Battle link is ready to share." });
    } catch {
      toast({ title: "Could not share", description: "Copy the URL from your browser and send it to your challenger.", variant: "destructive" });
    }
  };
  return <div><PageHeader eyebrow={`${data.category} · 1v1 battle`} title={data.title} description={data.prompt} action={<Button variant="secondary" onClick={() => void shareBattle()}><Share2 /> Share</Button>} />{data.status === "completed" && <section className="battle-result"><strong>{winner ? `${winner.user.displayName} takes the win.` : "This battle is complete."}</strong><p>{winner ? "The final result has been recorded by VYBE." : "The final result will appear when the backend provides a winner."}</p><div className="result-meta"><span><Trophy /> {winner ? `${winner.score} score` : "Result recorded"}</span><span><Zap /> +{data.rewardXp ?? 0} XP reward</span></div></section>}<div className="battle-detail-grid"><section className={`battle-stage tone-${data.coverTone ?? "violet"}`}><div className="battle-stage-pattern" /><div className="stage-top"><span className={`status-pill status-${data.status}`}>{data.status === "live" ? "Live now" : data.status}</span><span className="stage-time"><Clock3 /> {data.status === "completed" ? "Closed" : formatTimeLeft(data.endsAt)}</span></div><div className="stage-center"><div className="stage-orb"><Swords /></div><span className="eyebrow">The prompt</span><h2>{data.prompt}</h2><p>Two creators enter. One point of view wins the room.</p></div><div className="stage-bottom"><span><Users /> {data.participantCount} / {data.maxParticipants} challengers</span><span><Zap /> +{data.rewardXp ?? 0} XP</span></div></section><section className="panel participants-panel"><div className="panel-heading"><div><span className="eyebrow">The arena</span><h2>Entries</h2></div>{canJoin && <Button size="sm" onClick={() => join.mutate({ battleId: id })}>{join.isPending ? <Loader2 className="spin" /> : <><Swords /> Join</>}</Button>}</div>{data.participants.map((participant, index) => <div className={`participant-row ${participant.id === data.winnerParticipantId ? "participant-winner" : ""}`} key={participant.id}><Avatar name={participant.user.displayName} size="md" accent={index % 2 === 0 ? "violet" : "coral"} /><div className="participant-copy"><strong>{participant.user.displayName}{participant.id === data.winnerParticipantId ? " · Winner" : ""}</strong><small>{participant.submissionLabel}</small></div><div className="participant-score"><strong>{participant.score}</strong><small>{participant.votes} votes</small></div><Button size="sm" variant="ghost" disabled={vote.isPending || data.status === "completed"} onClick={() => vote.mutate({ battleId: id, data: { participantId: participant.id } })}><Heart /> Vote</Button></div>)}{data.participants.length === 0 && <div className="mini-empty">Be the first one in.</div>}{data.status !== "completed" && data.participants.length === 1 && <div className="mini-empty">Waiting for one challenger before voting opens.</div>}</section></div></div>;
}

function LeaderboardPage() {
  const [scope, setScope] = useState<"global" | "country">("global");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "all-time">("weekly");
  const [, navigate] = useLocation();
  const params = { scope, period };
  const leaderboard = useGetLeaderboard(params, { query: { queryKey: getGetLeaderboardQueryKey(params), refetchOnWindowFocus: true } });
  const data = leaderboard.data as Leaderboard | undefined;
  return <div><PageHeader eyebrow="Leaderboard" title="Make your mark" description="Every vote, battle, and comeback moves the board." action={<div className="segmented"><button className={scope === "global" ? "is-selected" : ""} onClick={() => setScope("global")}><Globe2 /> Global</button><button className={scope === "country" ? "is-selected" : ""} onClick={() => setScope("country")}><Target /> Country</button></div>} /><div className="leaderboard-toolbar"><div className="league-banner"><div className="league-emblem"><Crown /></div><div><span className="eyebrow">Your league</span><strong>{data?.currentUser.league ?? "—"}</strong><small>{data ? `${data.currentUser.rankingPoints.toLocaleString()} ranking points` : "Loading your position"}</small></div><div className="league-progress"><span style={{ width: `${data?.currentUser.streak ? Math.min(100, data.currentUser.streak * 8) : 0}%` }} /></div><span className="league-next">Current <ChevronRight /></span></div><div className="period-tabs">{(["weekly", "monthly", "all-time"] as const).map((item) => <button key={item} className={period === item ? "is-selected" : ""} onClick={() => setPeriod(item)}>{item.replace("-", " ")}</button>)}</div></div>{leaderboard.isLoading ? <LoadingState /> : leaderboard.isError || !data ? <ErrorState onRetry={() => void leaderboard.refetch()} /> : data.entries.length === 0 ? <div className="empty-state"><div className="empty-icon"><Trophy /></div><h2>No rankings in this period yet</h2><p>Enter a battle to put your name on the board.</p></div> : <div className="leaderboard-table panel"><div className="leaderboard-head"><span>Rank</span><span>Creator</span><span>League</span><span>Wins</span><span>Losses</span><span>Win rate</span><span>Points</span></div>{data.entries.map((entry) => <div className={`leaderboard-row ${entry.user.id === data.currentUser.user.id ? "current-user" : ""}`} key={entry.user.id}><strong className="leaderboard-rank">{entry.position < 4 ? <Crown /> : `#${entry.position}`}</strong><div className="leaderboard-user"><Avatar name={entry.user.displayName} size="sm" accent={entry.position === 2 ? "coral" : entry.position === 3 ? "cyan" : "violet"} /><span><strong>{entry.user.displayName}</strong><small>@{entry.user.username} · {entry.xp.toLocaleString()} XP</small></span></div><span className={`league-text league-${entry.league.toLowerCase()}`}>{entry.league}</span><span>{entry.wins}</span><span>{entry.losses}</span><span>{entry.winRate}%</span><strong className="mono-value">{entry.rankingPoints.toLocaleString()}</strong></div>)}<div className="your-rank"><span>Your position</span><strong>#{data.currentUser.position}</strong><span>{data.currentUser.rankingPoints.toLocaleString()} points · {data.currentUser.winRate}% win rate</span><button onClick={() => navigate("/profile")}>View profile <ArrowUpRight /></button></div></div>}</div>;
}

function ProfilePage() {
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), refetchOnWindowFocus: true } });
  const [, navigate] = useLocation();
  const { data: subData } = useGetPremiumSubscription();
  const portalMut = useCreatePremiumPortal({
    mutation: {
      onSuccess: (res) => { if (res.url) window.location.assign(res.url); }
    }
  });

  const data = profile.data as Profile | undefined;
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !data) return <ErrorState onRetry={() => void profile.refetch()} />;

  const sub = subData?.subscription as any;
  const currentPlan = (subData as any)?.plan ?? sub?.plan ?? "FREE";
  const hasActiveSub = sub && ['active', 'trialing', 'past_due'].includes(sub.status);
  const winRate = Math.round(data.wins / Math.max(1, data.wins + data.losses) * 100);

  return <div>
    <PageHeader eyebrow="Your profile" title="Build your legend" action={<div className="profile-actions"><Button variant="secondary" onClick={() => navigate("/settings")}><Settings2 /> Edit profile</Button><LogoutButton /></div>} />

    <section className="profile-hero panel">
      <div className="profile-identity">
        <Avatar name={data.displayName} size="lg" />
        <div>
          <span className="eyebrow">@{data.username}</span>
          <h2>{data.displayName}</h2>
          <p>{data.bio}</p>
          <div className="profile-meta">
            <span><Globe2 /> {data.country}</span>
            <span><Crown /> {data.league} league</span>
            {data.role === "ADMIN" && <span className="profile-admin-badge"><ShieldCheck /> ADMIN</span>}
          </div>
        </div>
      </div>
      <div className="profile-rank">
        <span className="eyebrow">Rola konta</span>
        <strong className={data.role === "ADMIN" ? "admin-role-text" : ""}>{data.role}</strong>
        <small>{data.role === "ADMIN" ? "Pełny dostęp administracyjny" : "Konto użytkownika"}</small>
      </div>
    </section>

    {hasActiveSub ? (
      <section className="panel" style={{ padding: '24px', marginBottom: '14px', border: '1px solid var(--lime)', background: '#f1f9d4' }}>
        <div className="panel-heading" style={{ margin: 0, marginBottom: '16px' }}>
          <div>
            <span className="eyebrow" style={{ color: '#537514' }}>Subskrypcja</span>
           <h2 style={{ color: '#293b09' }}>{currentPlan === "PREMIUM_PRO" ? "VYBE Premium Pro aktywne" : "VYBE Premium aktywne"}</h2>
            {sub.cancel_at_period_end && <p style={{ color: '#c74437', fontSize: '12px', marginTop: '4px' }}>Anulowano - wygasa: {new Date(sub.current_period_end * 1000).toLocaleDateString()}</p>}
          </div>
          <Button onClick={() => portalMut.mutate()} disabled={portalMut.isPending} style={{ background: '#293b09', color: 'var(--lime)' }}>
            {portalMut.isPending ? <Loader2 className="spin" /> : <><CreditCard /> Zarządzaj</>}
          </Button>
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#537514' }}>
          <span><strong>Okres rozliczeniowy:</strong> {(sub.plan?.interval === 'year' || sub.plan?.recurring?.interval === 'year') ? 'Roczny' : 'Miesięczny'}</span>
          <span><strong>Odnowienie:</strong> {sub.current_period_end ? new Date(sub.current_period_end * 1000).toLocaleDateString() : 'N/A'}</span>
        </div>
      </section>
    ) : (
      <section className="panel" style={{ padding: '24px', marginBottom: '14px', border: '1px solid #e0dbf0', background: '#f6f4fa' }}>
        <div className="panel-heading" style={{ margin: 0, marginBottom: '8px' }}>
          <div>
            <span className="eyebrow">Upgrade</span>
            <h2>Dołącz do VYBE Premium</h2>
          </div>
          <Button onClick={() => navigate("/premium")}><Crown /> Zobacz ofertę</Button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Wybierz Premium lub Premium Pro, aby rozpocząć prawdziwą subskrypcję przez Stripe.</p>
      </section>
    )}

     <div className="profile-stat-grid"><StatCard icon={Zap} label="Level & XP" value={`Lvl ${data.level}`} detail={`${data.xp.toLocaleString()} XP · ${data.xpForNextLevel.toLocaleString()} to next`} accent="lime" /><StatCard icon={Trophy} label="Record" value={`${data.wins}–${data.losses}`} detail={`${winRate}% win rate`} accent="violet" /><StatCard icon={Flame} label="Streak" value={`${data.streak} days`} detail={`Best: ${data.bestStreak} days`} accent="coral" /><StatCard icon={Target} label="Ranking" value={`#${data.rank}`} detail={`${data.rankingPoints.toLocaleString()} points`} accent="cyan" /></div>
     <section className="panel badges-panel"><div className="panel-heading"><div><span className="eyebrow">Proof of play</span><h2>Badges & achievements</h2></div><span className="badge-count">{data.badges.length} unlocked · {data.activeDays} active days</span></div>{data.badges.length === 0 ? <div className="mini-empty">Your first badge is waiting for your next battle.</div> : <div className="badge-grid">{data.badges.map((badge) => <div className="achievement" key={badge}><div className="achievement-icon"><Check /></div><strong>{badge}</strong><small>Achievement unlocked</small></div>)}</div>}</section>
  </div>;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const notifications = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), refetchOnWindowFocus: true } });
  const data = (notifications.data ?? []) as Notification[];
  const markRead = useMarkNotificationRead({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }); }, onError: () => toast({ title: "Could not update notification", description: "Try again in a moment.", variant: "destructive" }) } });
  const markAllRead = useMarkAllNotificationsRead({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }); toast({ title: "Inbox cleared", description: "All notifications are marked as read." }); }, onError: () => toast({ title: "Could not update inbox", description: "Try again in a moment.", variant: "destructive" }) } });
  const unreadCount = data.filter((item) => !item.read).length;
  return <div><PageHeader eyebrow="Inbox" title="Stay in the loop" description="The moments that keep your VYBE moving forward." /><section className="panel notification-list">{notifications.isLoading ? <LoadingState /> : notifications.isError ? <ErrorState onRetry={() => void notifications.refetch()} /> : <><div className="notification-list-header"><p>{unreadCount === 0 ? "You are all caught up." : `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}`}</p>{unreadCount > 0 && <Button variant="secondary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>{markAllRead.isPending ? <Loader2 className="spin" /> : <Check />} Mark all read</Button>}</div>{data.length === 0 ? <div className="empty-state"><div className="empty-icon"><Bell /></div><h2>Your inbox is quiet</h2><p>Battle updates and ranking moments will show up here.</p></div> : data.map((item) => <div className={`notification-row ${item.read ? "" : "unread"}`} key={item.id}><div className={`notification-icon notification-${item.kind}`}><Bell /></div><div className="notification-main"><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleDateString()}</small></div><div className="notification-actions">{!item.read && <><span className="unread-dot" /><button className="notification-read-button" onClick={() => markRead.mutate({ notificationId: item.id })} disabled={markRead.isPending}>Mark read</button></>}</div></div>)}</>}</section></div>;
}

function AiPage() {
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Creativity");
  const ideas = useGenerateIdeas();
  return <div><PageHeader eyebrow="VYBE AI" title="Turn sparks into battles" description="Give the studio a direction. VYBE AI will shape it into something people want to enter." /><section className="ai-workspace"><div className="ai-intro"><div className="ai-symbol"><Bot /></div><span className="eyebrow">Creative studio</span><h2>What are you curious about?</h2><p>Describe a mood, theme, or weird idea. Your battle concepts stay yours until you publish.</p><div className="ai-example-row"><button onClick={() => setTopic("a rainy city at midnight")}>Rainy city at midnight</button><button onClick={() => setTopic("objects with secret lives")}>Objects with secret lives</button><button onClick={() => setTopic("the future of friendship")}>Future of friendship</button></div></div><form className="ai-form" onSubmit={(event) => { event.preventDefault(); if (topic.trim()) ideas.mutate({ data: { topic, category } }); }}><label>Theme or starting point<textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Try: a battle for people who notice the small things" rows={4} /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categoryFilters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><Button type="submit" disabled={ideas.isPending || !topic.trim()}>{ideas.isPending ? <><Loader2 className="spin" /> Thinking...</> : <><Sparkles /> Generate ideas</>}</Button></form></section>{ideas.data?.ideas && <section className="panel idea-results"><div className="panel-heading"><div><span className="eyebrow">Five directions</span><h2>Pick the one that pulls you in</h2></div><IconButton label="Clear ideas" onClick={() => ideas.reset()}><X /></IconButton></div>{ideas.data.ideas.map((idea, index) => <button className="idea-row" key={idea} onClick={() => setTopic(idea)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{idea}</strong><ArrowUpRight /></button>)}</section>}{ideas.isError && <div className="inline-error">VYBE AI is configured, but the provider has no remaining credits. Add provider credits to generate ideas.</div>}</div>;
}

function SettingsPage() {
  const profile = useGetProfile();
  const qc = useQueryClient();
  const update = useUpdateProfile({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast({ title: "Profile updated", description: "Your preferences are saved." }); } } });
  const [language, setLanguage] = useState(() => localStorage.getItem("vybe-language") ?? "en");
  const [publicProfile, setPublicProfile] = useState(true);
  const [battleReminders, setBattleReminders] = useState(true);
  if (!profile.data) return <LoadingState />;
  const data = profile.data;
  return <div><PageHeader eyebrow="Settings" title="Make VYBE yours" description="Language, privacy, and the details people see when you enter a room." /><div className="settings-grid"><section className="panel settings-panel"><div className="settings-heading"><div className="setting-symbol"><Languages /></div><div><h2>Language & region</h2><p>Choose how VYBE speaks to you.</p></div></div><label>Interface language<select value={language} onChange={(event) => { setLanguage(event.target.value); localStorage.setItem("vybe-language", event.target.value); }}><option value="en">English</option><option value="pl">Polski</option></select></label><label>Country<select defaultValue={data.country} onChange={(event) => update.mutate({ data: { country: event.target.value } })}><option>PL</option><option>US</option><option>GB</option><option>DE</option><option>FR</option></select></label></section><section className="panel settings-panel"><div className="settings-heading"><div className="setting-symbol"><UserRound /></div><div><h2>Profile details</h2><p>Keep your public identity fresh.</p></div></div><label>Display name<input defaultValue={data.displayName} onBlur={(event) => update.mutate({ data: { displayName: event.target.value } })} /></label><label>Bio<textarea defaultValue={data.bio} rows={3} onBlur={(event) => update.mutate({ data: { bio: event.target.value } })} /></label></section><section className="panel settings-panel"><div className="settings-heading"><div className="setting-symbol"><ShieldIcon /></div><div><h2>Privacy & safety</h2><p>You decide what gets shared.</p></div></div><div className="setting-toggle"><span><strong>Public profile</strong><small>Let new creators discover your profile</small></span><button aria-pressed={publicProfile} className={`toggle ${publicProfile ? "on" : ""}`} onClick={() => setPublicProfile((current) => !current)}><span /></button></div><div className="setting-toggle"><span><strong>Battle reminders</strong><small>Get notified when a round is ending</small></span><button aria-pressed={battleReminders} className={`toggle ${battleReminders ? "on" : ""}`} onClick={() => setBattleReminders((current) => !current)}><span /></button></div></section><section className="panel settings-panel settings-account-panel"><div className="settings-heading"><div className="setting-symbol account-symbol"><LogOut /></div><div><h2>Sesja konta</h2><p>Wyloguj się z VYBE na tym urządzeniu.</p></div></div><LogoutButton /></section></div></div>;
}

function ShieldIcon() { return <CircleDollarSign />; }

function PublicLanding() {
  const [, navigate] = useLocation();
  return <main className="auth-landing"><div className="auth-landing-panel"><Logo /><span className="eyebrow">Global creative competition</span><h1>Make your move.<br /><em>Own your VYBE.</em></h1><p>Join creative battles, earn XP, and build a profile that reflects what you can do.</p><div className="auth-actions"><Button onClick={() => navigate("/sign-up")}>Create account <ArrowUpRight /></Button><Button variant="secondary" onClick={() => navigate("/sign-in")}>Sign in</Button></div></div><div className="auth-visual"><div className="auth-orbit orbit-a" /><div className="auth-orbit orbit-b" /><div className="auth-orbit orbit-c" /><div className="auth-visual-mark"><Swords /><span>VYBE</span></div></div></main>;
}

function SignInPage() {
  return <main className="auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></main>;
}

function SignUpPage() {
  return <main className="auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></main>;
}

function AdminRoute() {
  const profile = useGetProfile();
  if (profile.isLoading) return <LoadingState />;
  if (!profile.data || profile.data.role !== "ADMIN") {
    return <div className="empty-state error-state"><div className="empty-icon"><Crown /></div><h2>Administrator access required</h2><p>This route is available only to accounts with the backend role ADMIN.</p></div>;
  }
  return <AdminDashboardPage />;
}

function ProtectedApplication() {
  const [location] = useLocation();
  return <>
    <Show when="signed-in">
      {location === "/admin"
        ? <ErrorBoundary><AdminRoute /></ErrorBoundary>
        : <AppShell><ErrorBoundary><Switch><Route path="/feed/:id" component={SocialPostPage} /><Route path="/feed" component={SocialFeedPage} /><Route path="/messages" component={MessagesPage} /><Route path="/profile/:id" component={SocialProfilePage} /><Route path="/" component={DashboardPage} /><Route path="/battles" component={DiscoverPage} /><Route path="/battles/new" component={CreateBattlePage} /><Route path="/battles/:id" component={BattleDetailPage} /><Route path="/leaderboard" component={LeaderboardPage} /><Route path="/profile" component={ProfilePage} /><Route path="/notifications" component={NotificationsPage} /><Route path="/ai" component={AiPage} /><Route path="/premium" component={PremiumPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></ErrorBoundary></AppShell>}
    </Show>
    <Show when="signed-out"><Redirect to="/sign-in" /></Show>
  </>;
}

function HomeRoute() {
  return <>
    <Show when="signed-in"><ProtectedApplication /></Show>
    <Show when="signed-out"><PublicLanding /></Show>
  </>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }), [addListener]);
  return null;
}

function Router() {
  return <Switch><Route path="/" component={HomeRoute} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route component={ProtectedApplication} /></Switch>;
}

function ClerkApplication() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: "Welcome back to VYBE", subtitle: "Sign in to continue" } }, signUp: { start: { title: "Create your VYBE account", subtitle: "Join the creative competition" } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator /><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkApplication /></WouterRouter>;
}

export default App;