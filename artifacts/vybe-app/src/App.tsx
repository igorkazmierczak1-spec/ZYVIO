import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  useCreateBattle,
  useGenerateIdeas,
  useGetBattle,
  useGetDashboard,
  useGetLeaderboard,
  useGetProfile,
  useJoinBattle,
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
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
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

export function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark"><span /></div>
      <span>VYBE</span>
    </div>
  );
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
  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
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
          <Logo />
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
              <Icon /><span>{label}</span>{label === "Notifications" && <span className="notification-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="season-card">
          <div className="season-orbit"><Sparkles /></div>
          <span className="eyebrow">Season 04</span>
          <strong>Make it memorable.</strong>
          <span className="season-meta">12 days remaining</span>
          <div className="season-progress"><span style={{ width: "68%" }} /></div>
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
          <div className="mobile-brand"><IconButton label="Open menu" onClick={() => setSidebarOpen(true)}><Menu /></IconButton><Logo /></div>
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
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => <button key={href} className={isCurrent(href) ? "is-current" : ""} onClick={() => navigate(href)}><Icon /><span>{label}</span></button>)}
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
  const dashboard = useGetDashboard();
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError || !dashboard.data) return <ErrorState onRetry={() => void dashboard.refetch()} />;
  const data = dashboard.data as Dashboard;
  const profile = data.profile;
  const levelTarget = (profile.level + 1) * 320;
  const levelProgress = Math.min(100, Math.round((profile.xp % 320) / 320 * 100));
  return <div className="dashboard-page">
    <div className="welcome-row"><div><span className="eyebrow">Tuesday, 08 September 2026</span><h1>Good evening, {profile.displayName.split(" ")[0]}<span className="title-dot">.</span></h1><p>Your next great VYBE is closer than you think.</p></div><Button className="create-cta" onClick={() => navigate("/battles/new")}><Plus /> Create battle</Button></div>
    <section className="hero-card">
      <div className="hero-copy"><span className="eyebrow">Your momentum</span><h2>Keep the streak<br /><em>alive.</em></h2><p>You are 160 XP away from level {profile.level + 1}. One more bold move today.</p><Button variant="secondary" onClick={() => navigate("/battles")}>Find your next battle <ArrowUpRight /></Button></div>
      <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-orbit orbit-three" />
      <div className="level-card"><div className="level-ring"><strong>{profile.level}</strong><span>level</span></div><div><span className="eyebrow">Gold league</span><strong>{profile.xp.toLocaleString()} XP</strong><div className="level-bar"><span style={{ width: `${levelProgress}%` }} /></div><small>{(levelTarget - profile.xp % levelTarget).toLocaleString()} XP to next level</small></div></div>
    </section>
    <div className="stats-grid"><StatCard icon={Swords} label="Active battles" value={data.stats.activeBattles} detail="2 new today" accent="violet" /><StatCard icon={Zap} label="Weekly XP" value={data.stats.weeklyXp.toLocaleString()} detail="+18% from last week" accent="lime" /><StatCard icon={Target} label="Win rate" value={`${data.stats.winRate}%`} detail="Top 14% globally" accent="coral" /><StatCard icon={Trophy} label="Global rank" value={`#${data.stats.globalRank}`} detail="Up 12 places" accent="cyan" /></div>
    <div className="section-heading"><div><span className="eyebrow">Picked for you</span><h2>Featured battles</h2></div><button className="text-button" onClick={() => navigate("/battles")}>View all <ArrowUpRight /></button></div>
    <div className="battle-grid">{data.featuredBattles.map((battle) => <BattleCard key={battle.id} battle={battle} />)}</div>
    <div className="dashboard-lower">
      <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">Your loop</span><h2>Recent activity</h2></div><IconButton label="Activity options"><Settings2 /></IconButton></div>{data.activity.map((item) => <div className="activity-row" key={item.id}><div className={`activity-mark mark-${item.kind}`}><Zap /></div><div><strong>{item.text}</strong><small>{item.time}</small></div><ChevronRight /></div>)}</section>
      <section className="panel ranking-panel"><div className="panel-heading"><div><span className="eyebrow">This week</span><h2>Leaderboard</h2></div><button className="text-button" onClick={() => navigate("/leaderboard")}>Full ranking <ArrowUpRight /></button></div>{data.leaderboardPreview.map((entry, index) => <div className="rank-row" key={entry.user.id}><span className={`rank-number ${index < 3 ? "top-rank" : ""}`}>{String(entry.position).padStart(2, "0")}</span><Avatar name={entry.user.displayName} size="sm" accent={index === 1 ? "coral" : index === 2 ? "cyan" : "violet"} /><div><strong>{entry.user.displayName}</strong><small>Level {entry.user.level} · {entry.league}</small></div><span className="rank-xp">{entry.xp.toLocaleString()} <small>XP</small></span></div>)}</section>
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
  const [form, setForm] = useState<BattleInput>({ title: "", category: "Creativity", prompt: "", endsAt: new Date(Date.now() + 48 * 3600000).toISOString(), maxParticipants: 8 });
  const create = useCreateBattle({ mutation: { onSuccess: (battle) => { toast({ title: "Battle created", description: "Your arena is ready for challengers." }); navigate(`/battles/${battle.id}`); } } });
  const setField = (field: keyof BattleInput, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  return <div className="form-page"><PageHeader eyebrow="Create" title="Start a new battle" description="A great prompt makes people want to show up." /><form className="create-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ data: form }); }}><div className="form-main"><label>Battle title<input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Give it a name people remember" required minLength={3} /></label><label>Category<div className="category-select-grid">{["Photo", "Music", "Creativity", "Text", "AI", "Quiz"].map((item) => <button type="button" key={item} className={form.category === item ? "selected" : ""} onClick={() => setField("category", item)}>{item}</button>)}</div></label><label>Challenge prompt<textarea value={form.prompt} onChange={(event) => setField("prompt", event.target.value)} placeholder="What will challengers need to make, answer, or prove?" rows={5} required minLength={5} /></label></div><aside className="form-aside panel"><span className="eyebrow">Battle settings</span><label>Closes on<input type="datetime-local" value={form.endsAt.slice(0, 16)} onChange={(event) => setField("endsAt", new Date(event.target.value).toISOString())} /></label><label>Max participants<select value={form.maxParticipants} onChange={(event) => setField("maxParticipants", Number(event.target.value))}><option value={2}>2 — One vs one</option><option value={8}>8 — Small room</option><option value={16}>16 — Open arena</option><option value={32}>32 — Full lobby</option></select></label><div className="form-tip"><Sparkles /><div><strong>Make it specific</strong><p>Prompts with a clear constraint get 2.4x more entries.</p></div></div><Button className="form-submit" type="submit" disabled={create.isPending}>{create.isPending ? <><Loader2 className="spin" /> Creating...</> : <>Publish battle <ArrowUpRight /></>}</Button></aside></form></div>;
}

function BattleDetailPage() {
  const [, params] = useRoute("/battles/:id");
  const id = params?.id ?? "";
  const battle = useGetBattle(id, { query: { enabled: Boolean(id), queryKey: getGetBattleQueryKey(id) } });
  const qc = useQueryClient();
  const join = useJoinBattle({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetBattleQueryKey(id) }); toast({ title: "You are in", description: "Your entry is ready." }); } } });
  const vote = useVoteBattle({ mutation: { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetBattleQueryKey(id) }); toast({ title: "Vote counted", description: "You earned XP for showing up." }); } } });
  if (battle.isLoading) return <LoadingState />;
  if (battle.isError || !battle.data) return <ErrorState onRetry={() => void battle.refetch()} />;
  const data = battle.data;
  return <div><PageHeader eyebrow={`${data.category} battle`} title={data.title} description={data.prompt} action={<Button variant="secondary" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => toast({ title: "Link copied" }))}><Share2 /> Share</Button>} /><div className="battle-detail-grid"><section className={`battle-stage tone-${data.coverTone ?? "violet"}`}><div className="battle-stage-pattern" /><div className="stage-top"><span className={`status-pill status-${data.status}`}>{data.status === "live" ? "Live now" : data.status}</span><span className="stage-time"><Clock3 /> {formatTimeLeft(data.endsAt)}</span></div><div className="stage-center"><div className="stage-orb"><Swords /></div><span className="eyebrow">The prompt</span><h2>{data.prompt}</h2><p>Make a move that only you could make.</p></div><div className="stage-bottom"><span><Users /> {data.participantCount} / {data.maxParticipants} challengers</span><span><Zap /> +{data.rewardXp ?? 250} XP</span></div></section><section className="panel participants-panel"><div className="panel-heading"><div><span className="eyebrow">The arena</span><h2>Entries</h2></div>{!data.isJoined && <Button size="sm" onClick={() => join.mutate({ battleId: id })}>{join.isPending ? <Loader2 className="spin" /> : <><Swords /> Join</>}</Button>}</div>{data.participants.map((participant) => <div className="participant-row" key={participant.id}><Avatar name={participant.user.displayName} size="md" accent={participant.user.username === "igor" ? "violet" : "coral"} /><div className="participant-copy"><strong>{participant.user.displayName}</strong><small>{participant.submissionLabel}</small></div><div className="participant-score"><strong>{participant.score}</strong><small>{participant.votes} votes</small></div><Button size="sm" variant="ghost" disabled={vote.isPending || participant.user.username === "igor"} onClick={() => vote.mutate({ battleId: id, data: { participantId: participant.id } })}><Heart /> Vote</Button></div>)}{data.participants.length === 0 && <div className="mini-empty">Be the first one in.</div>}</section></div></div>;
}

function LeaderboardPage() {
  const [scope, setScope] = useState<"global" | "country">("global");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "all-time">("weekly");
  const leaderboard = useGetLeaderboard({ scope, period }, { query: { queryKey: getGetLeaderboardQueryKey({ scope, period }) } });
  const data = leaderboard.data as Leaderboard | undefined;
  return <div><PageHeader eyebrow="Leaderboard" title="Make your mark" description="Every vote, battle, and comeback moves the board." action={<div className="segmented"><button className={scope === "global" ? "is-selected" : ""} onClick={() => setScope("global")}><Globe2 /> Global</button><button className={scope === "country" ? "is-selected" : ""} onClick={() => setScope("country")}><Target /> Country</button></div>} /><div className="leaderboard-toolbar"><div className="league-banner"><div className="league-emblem"><Crown /></div><div><span className="eyebrow">Your league</span><strong>Gold</strong><small>Top 15% this season</small></div><div className="league-progress"><span style={{ width: "72%" }} /></div><span className="league-next">Platinum <ChevronRight /></span></div><div className="period-tabs">{(["weekly", "monthly", "all-time"] as const).map((item) => <button key={item} className={period === item ? "is-selected" : ""} onClick={() => setPeriod(item)}>{item.replace("-", " ")}</button>)}</div></div>{leaderboard.isLoading ? <LoadingState /> : leaderboard.isError || !data ? <ErrorState onRetry={() => void leaderboard.refetch()} /> : <div className="leaderboard-table panel"><div className="leaderboard-head"><span>Rank</span><span>Creator</span><span>League</span><span>Wins</span><span>XP</span></div>{data.entries.map((entry) => <div className={`leaderboard-row ${entry.user.id === data.currentUser.user.id ? "current-user" : ""}`} key={entry.user.id}><strong className="leaderboard-rank">{entry.position < 4 ? <Crown /> : `#${entry.position}`}</strong><div className="leaderboard-user"><Avatar name={entry.user.displayName} size="sm" accent={entry.position === 2 ? "coral" : entry.position === 3 ? "cyan" : "violet"} /><span><strong>{entry.user.displayName}</strong><small>@{entry.user.username}</small></span></div><span className={`league-text league-${entry.league.toLowerCase()}`}>{entry.league}</span><span>{entry.wins}</span><strong>{entry.xp.toLocaleString()}</strong></div>)}<div className="your-rank"><span>Your position</span><strong>#{data.currentUser.position}</strong><span>{data.currentUser.xp.toLocaleString()} XP</span><button>View profile <ArrowUpRight /></button></div></div>}</div>;
}

function ProfilePage() {
  const profile = useGetProfile();
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
  const hasActiveSub = sub && (sub.status === 'active' || sub.status === 'trialing');
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
            <h2 style={{ color: '#293b09' }}>VYBE Premium Aktywne</h2>
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
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Odblokuj ekskluzywne badge, priorytetowy dostęp do nowych funkcji i zyskaj przewagę.</p>
      </section>
    )}

    <div className="profile-stat-grid"><StatCard icon={Zap} label="Total XP" value={data.xp.toLocaleString()} detail={`Level ${data.level}`} accent="lime" /><StatCard icon={Trophy} label="Wins" value={data.wins} detail={`${winRate}% win rate`} accent="violet" /><StatCard icon={Flame} label="Streak" value={`${data.streak} days`} detail="Personal best" accent="coral" /><StatCard icon={Swords} label="Battles" value={data.wins + data.losses} detail={`${data.losses} losses`} accent="cyan" /></div>
    <section className="panel badges-panel"><div className="panel-heading"><div><span className="eyebrow">Proof of play</span><h2>Badges & achievements</h2></div><span className="badge-count">{data.badges.length} unlocked</span></div><div className="badge-grid">{data.badges.map((badge) => <div className="achievement" key={badge}><div className="achievement-icon"><Check /></div><strong>{badge}</strong><small>Achievement unlocked</small></div>)}</div></section>
  </div>;
}

function NotificationsPage() {
  const notifications = useListNotifications();
  const data = (notifications.data ?? []) as Notification[];
  return <div><PageHeader eyebrow="Inbox" title="Stay in the loop" description="The moments that keep your VYBE moving forward." /><section className="panel notification-list">{notifications.isLoading ? <LoadingState /> : data.map((item) => <div className={`notification-row ${item.read ? "" : "unread"}`} key={item.id}><div className={`notification-icon notification-${item.kind}`}><Bell /></div><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleDateString()}</small></div>{!item.read && <span className="unread-dot" />}</div>)}</section></div>;
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
        : <AppShell><ErrorBoundary><Switch><Route path="/" component={DashboardPage} /><Route path="/battles" component={DiscoverPage} /><Route path="/battles/new" component={CreateBattlePage} /><Route path="/battles/:id" component={BattleDetailPage} /><Route path="/leaderboard" component={LeaderboardPage} /><Route path="/profile" component={ProfilePage} /><Route path="/notifications" component={NotificationsPage} /><Route path="/ai" component={AiPage} /><Route path="/premium" component={PremiumPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></ErrorBoundary></AppShell>}
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