import React, { useEffect, useMemo, useState } from "react";
import {
  useListPremiumPlans,
  useCreatePremiumCheckout,
  useGetPremiumSubscription,
  useGetPremiumBenefits,
  useCreatePremiumPortal,
  getGetBattleCreationUsageQueryKey,
  getGetAiUsageQueryKey,
} from "@workspace/api-client-react";
import { PageHeader, LoadingState, ErrorState } from "../App";
import { Crown, Check, ArrowUpRight, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import "../premium.css";

type Plan = "PREMIUM" | "PREMIUM_PRO";
type Period = "MONTHLY" | "YEARLY";

const planCopy: Record<Plan, { title: string; badge: string; button: string; description: string; features: string[] }> = {
  PREMIUM: {
    title: "Premium",
    badge: "Najpopularniejszy",
    button: "Kup Premium",
    description: "Płatna subskrypcja ZYVIO z aktywnym statusem Premium i zarządzaniem przez Stripe.",
    features: ["Status Premium na profilu", "Wszystkie aktualnie aktywne funkcje Premium", "Stripe Customer Portal"],
  },
  PREMIUM_PRO: {
    title: "Premium Pro",
    badge: "👑 Dla najbardziej aktywnych",
    button: "Kup Premium Pro",
    description: "Rozszerzony plan Premium Pro z osobnym planem, ceną i uprawnieniem po stronie backendu.",
    features: ["Wszystko z planu Premium", "Oznaczenie 👑 Premium Pro", "Osobny status i kontrola uprawnień Pro"],
  },
};

export default function PremiumPage() {
  const [billingPeriod, setBillingPeriod] = useState<Period>("MONTHLY");
  const { data: plansData, isLoading: plansLoading, isError: plansError, refetch: plansRefetch } = useListPremiumPlans();
  const { data: subData, isLoading: subLoading, isError: subError, refetch: subRefetch } = useGetPremiumSubscription();
  const { data: benefitsData, isLoading: benefitsLoading, isError: benefitsError, refetch: benefitsRefetch } = useGetPremiumBenefits();
  const qc = useQueryClient();
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: getGetBattleCreationUsageQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetAiUsageQueryKey() });
  }, [qc, subData?.plan, subData?.subscription]);
  const checkoutMut = useCreatePremiumCheckout({
    mutation: {
      onSuccess: (res) => { void qc.invalidateQueries({ queryKey: getGetBattleCreationUsageQueryKey() }); void qc.invalidateQueries({ queryKey: getGetAiUsageQueryKey() }); res.url ? window.location.assign(res.url) : toast({ title: "Błąd płatności", description: "Stripe nie zwrócił adresu Checkout.", variant: "destructive" }); },
      onError: () => toast({ title: "Nie udało się rozpocząć płatności", description: "Spróbuj ponownie za chwilę.", variant: "destructive" }),
    },
  });
  const portalMut = useCreatePremiumPortal({
    mutation: {
      onSuccess: (res) => { void qc.invalidateQueries({ queryKey: getGetBattleCreationUsageQueryKey() }); void qc.invalidateQueries({ queryKey: getGetAiUsageQueryKey() }); res.url ? window.location.assign(res.url) : toast({ title: "Błąd portalu", description: "Stripe nie zwrócił adresu Customer Portal.", variant: "destructive" }); },
      onError: () => toast({ title: "Nie udało się otworzyć portalu", description: "Sprawdź konfigurację Customer Portal w Stripe.", variant: "destructive" }),
    },
  });

  if (plansLoading || subLoading || benefitsLoading) return <LoadingState />;
  if (plansError || subError || benefitsError) return <ErrorState onRetry={() => { plansRefetch(); subRefetch(); benefitsRefetch(); }} />;

  const plans = (plansData?.plans ?? []) as Array<any>;
  const benefitPlans = (benefitsData?.plans ?? plansData?.benefits ?? []) as Array<any>;
  const subscription = (subData?.subscription ?? null) as any;
  const currentPlan = ((subData as any)?.plan ?? subscription?.plan ?? "FREE") as string;
  const hasActiveSub = subscription && ["active", "trialing"].includes(subscription.status);
  const priceFor = (plan: Plan) => plans.find((p) => p.plan === plan && ((p.recurring?.interval === "year") === (billingPeriod === "YEARLY")));
  const annualSavingsFor = (plan: Plan) => {
    const monthly = plans.find((p) => p.plan === plan && p.recurring?.interval === "month")?.unit_amount;
    const yearly = plans.find((p) => p.plan === plan && p.recurring?.interval === "year")?.unit_amount;
    if (typeof monthly !== "number" || typeof yearly !== "number" || monthly <= 0) return null;
    return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
  };
  const formatPrice = (price: any) => price?.unit_amount == null
    ? "Niedostępne"
    : new Intl.NumberFormat("pl-PL", { style: "currency", currency: String(price.currency ?? "PLN").toUpperCase() }).format(Number(price.unit_amount) / 100);
  const planCards = (["PREMIUM", "PREMIUM_PRO"] as Plan[]).map((plan) => ({
    plan,
    price: priceFor(plan),
    copy: planCopy[plan],
    benefits: benefitPlans.find((item) => item.plan === plan),
  }));
  const freeBenefits = benefitPlans.find((item) => item.plan === "FREE");

  return (
    <div className="premium-layout">
      <PageHeader eyebrow="Cennik ZYVIO" title="Wybierz swój plan" description="Ceny i dostępność są pobierane z aktywnego katalogu Stripe. Checkout nie powstaje, jeśli cena nie istnieje." />
      <div className="premium-billing-toggle" aria-label="Okres rozliczeniowy">
        <button className={billingPeriod === "MONTHLY" ? "active" : ""} onClick={() => setBillingPeriod("MONTHLY")}>Miesięcznie</button>
        <button className={billingPeriod === "YEARLY" ? "active" : ""} onClick={() => setBillingPeriod("YEARLY")}>Rocznie <span className="annual-label">korzystniej</span></button>
      </div>

      {hasActiveSub && (
        <section className="premium-active-sub">
          <div className="premium-active-sub-info">
            <h3>{currentPlan === "PREMIUM_PRO" ? "👑 Twoje Premium Pro jest aktywne" : "⭐ Twoje Premium jest aktywne"}</h3>
            <p>Status: {subscription.status}. {subscription.current_period_end ? `Następne rozliczenie: ${new Date(subscription.current_period_end * 1000).toLocaleDateString("pl-PL")}` : ""}</p>
            {subscription.cancel_at_period_end && <p>Subskrypcja została anulowana i wygaśnie po opłaconym okresie.</p>}
          </div>
          <button onClick={() => portalMut.mutate()} disabled={portalMut.isPending}>
            {portalMut.isPending ? <Loader2 className="spin" /> : "Zarządzaj subskrypcją"}
          </button>
        </section>
      )}

      <div className="premium-plans-grid">
        <div className="premium-plan-card free-card">
          <h3>Free</h3>
          <div className="price">0 zł <small>/ zawsze</small></div>
          <ul className="premium-features">
            {freeBenefits?.limits?.battleCreateDaily != null && <li><Check /> {freeBenefits.limits.battleCreateDaily} Battle dziennie</li>}
            <li><Check /> {freeBenefits?.limits?.aiDaily ?? 3} użycia AI dziennie</li>
          </ul>
          <button className="premium-checkout-btn secondary" disabled>Twój plan bez subskrypcji</button>
        </div>
        {planCards.map(({ plan, price, copy, benefits }) => (
          <div key={plan} className={`premium-plan-card ${plan === "PREMIUM_PRO" ? "is-pro" : "is-premium"}`}>
            <div className="plan-badge">{copy.badge}</div>
            <div className="plan-title-row"><h3>{plan === "PREMIUM_PRO" ? "👑 " : ""}{copy.title}</h3></div>
            <div className="price">{formatPrice(price)} <small>/ {billingPeriod === "YEARLY" ? "rok" : "miesiąc"}</small></div>
            {billingPeriod === "YEARLY" && <div className="annual-savings">{annualSavingsFor(plan) == null ? "Plan roczny" : `Oszczędzasz ${annualSavingsFor(plan)}% względem płatności miesięcznej`}</div>}
            <p className="plan-description">{copy.description}</p>
            <ul className="premium-features">
              {copy.features.map((feature) => <li key={feature}><Check /> {feature}</li>)}
              {benefits?.limits?.battleCreateDaily != null && <li><Check /> {benefits.limits.battleCreateDaily} Battle / dzień</li>}
              <li><Check /> {benefits?.limits?.aiDaily} użyć AI / dzień</li>
              <li><Check /> {benefits?.limits?.postCreateDaily} postów i {benefits?.limits?.commentCreateDaily} komentarzy / dzień</li>
              <li><Check /> XP ×{benefits?.xpMultiplier}</li>
            </ul>
            <button
              className="premium-checkout-btn primary"
              disabled={checkoutMut.isPending || !price || Boolean(hasActiveSub)}
              onClick={() => checkoutMut.mutate({ data: { plan, billingPeriod } as any })}
            >
              {checkoutMut.isPending ? <Loader2 className="spin" /> : <>{copy.button} <ArrowUpRight /></>}
            </button>
            {!price && <small className="price-unavailable">Ten plan nie ma jeszcze aktywnej ceny Stripe.</small>}
            {hasActiveSub && currentPlan !== plan && <small className="price-unavailable">Zmień plan przez Stripe Customer Portal.</small>}
          </div>
        ))}
      </div>

      <section className="premium-benefit-matrix">
        <div>
          <span className="plan-badge">PORÓWNANIE PLANÓW</span>
          <h2>Limity i funkcje są jasne</h2>
          <p>Uprawnienia są sprawdzane po stronie ZYVIO. Premium zwiększa możliwości, ale nie zmienia siły głosu ani wyniku Battle.</p>
        </div>
        <div className="premium-benefit-grid">
          {benefitPlans.map((benefit) => (
            <article key={benefit.plan}>
              <strong>{benefit.badge}</strong>
              <span>{benefit.statsTier === "pro" ? "Zaawansowane statystyki Pro" : benefit.statsTier === "advanced" ? "Zaawansowane statystyki" : "Podstawowe statystyki"}</span>
              <span>AI: {benefit.aiFeatures.join(" · ")}</span>
              <span>{benefit.profileCustomization.join(" · ")}</span>
              {benefit.exclusiveChallenges ? <span>Ekskluzywne wyzwania Pro</span> : null}
            </article>
          ))}
        </div>
      </section>

      <div className="premium-faq">
        <h2>Subskrypcje i płatności</h2>
        <div className="faq-item"><h4>Czy mogę zmienić Premium na Premium Pro?</h4><p>Tak. Przy aktywnej subskrypcji użyj przycisku „Zarządzaj subskrypcją”. Stripe Customer Portal obsługuje zmianę planu bez tworzenia drugiej subskrypcji, jeśli portal ma włączone przełączanie cen.</p></div>
        <div className="faq-item"><h4>Co dzieje się po anulowaniu?</h4><p>Anulowanie jest obsługiwane przez Stripe. Dostęp pozostaje aktywny do końca opłaconego okresu, a webhook aktualizuje status po stronie ZYVIO.</p></div>
      </div>
    </div>
  );
}