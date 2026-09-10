import React, { useState } from "react";
import { 
  useListPremiumPlans, 
  useCreatePremiumCheckout, 
  useGetPremiumSubscription, 
  useCreatePremiumPortal 
} from "@workspace/api-client-react";
// These are exported from App.tsx via a script I will write. Wait, if I don't export them from App, I can't use them.
// But I will export them using a shell script that modifies App.tsx.
import { PageHeader, LoadingState, ErrorState } from "../App";
import { Crown, Check, ArrowUpRight, Zap, Loader2, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import "../premium.css";

export default function PremiumPage() {
  const [billingPeriod, setBillingPeriod] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const { data: plansData, isLoading: plansLoading, isError: plansError, refetch: plansRefetch } = useListPremiumPlans();
  const { data: subData, isLoading: subLoading, isError: subError, refetch: subRefetch } = useGetPremiumSubscription();
  
  const checkoutMut = useCreatePremiumCheckout({
    mutation: {
      onSuccess: (res) => {
        if (res.url) {
          window.location.assign(res.url);
        } else {
          toast({ title: "Błąd", description: "Brak linku do płatności.", variant: "destructive" });
        }
      },
      onError: () => toast({ title: "Błąd", description: "Nie udało się rozpocząć płatności.", variant: "destructive" })
    }
  });

  const portalMut = useCreatePremiumPortal({
    mutation: {
      onSuccess: (res) => {
        if (res.url) {
          window.location.assign(res.url);
        } else {
          toast({ title: "Błąd", description: "Brak linku do portalu.", variant: "destructive" });
        }
      },
      onError: () => toast({ title: "Błąd", description: "Nie udało się otworzyć portalu.", variant: "destructive" })
    }
  });

  if (plansLoading || subLoading) return <LoadingState />;
  if (plansError || subError) return <ErrorState onRetry={() => { plansRefetch(); subRefetch(); }} />;
  
  const plans = plansData?.plans || [];
  if (plans.length === 0) {
    return (
      <div className="premium-empty-state">
        <div className="premium-empty-icon"><X /></div>
        <h2>Brak skonfigurowanych planów</h2>
        <p>Integracja Stripe nie jest w pełni gotowa. Spróbuj ponownie później.</p>
      </div>
    );
  }

  const sub = subData?.subscription as any;
  const hasActiveSub = sub && (sub.status === 'active' || sub.status === 'trialing');

  const activePlan = plans.find(p => {
    const interval = (p.recurring as any)?.interval;
    return billingPeriod === "MONTHLY" ? interval === "month" : interval === "year";
  }) || plans[0];

  const formatPrice = (amount: number | null, currency: string) => {
    if (amount === null) return "$0.00";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
  };

  const activePriceFormatted = formatPrice(activePlan.unit_amount, activePlan.currency);
  const activeInterval = (activePlan.recurring as any)?.interval === "year" ? "rok" : "m-c";

  return (
    <div className="premium-layout">
      <PageHeader eyebrow="Premium" title="More room to play" description="Wybierz plan, który odpowiada Twojemu VYBE." />
      {hasActiveSub ? (
        <section className="premium-active-sub">
          <div className="premium-active-sub-info">
            <h3>Jesteś członkiem VYBE Premium</h3>
            <p>Odnowienie: {sub.current_period_end ? new Date(sub.current_period_end * 1000).toLocaleDateString() : 'N/A'}</p>
            {sub.cancel_at_period_end && (
              <p style={{ color: '#c74437' }}>Subskrypcja wygasa: {new Date(sub.current_period_end * 1000).toLocaleDateString()}</p>
            )}
          </div>
          <button onClick={() => portalMut.mutate()} disabled={portalMut.isPending}>
            {portalMut.isPending ? <Loader2 className="spin" /> : "Zarządzaj subskrypcją"}
          </button>
        </section>
      ) : null}

      <div className="premium-hero">
        <div className="premium-badge-icon"><Crown /></div>
        <h1>Zdobądź przewagę. <span>VYBE Premium.</span></h1>
        <p>Odblokuj ekskluzywne funkcje, wyróżnij swój profil i zyskaj priorytetowy dostęp do nowości. Stworzone dla najlepszych twórców.</p>
        
        {!hasActiveSub && (
          <div className="premium-billing-toggle">
            <button className={billingPeriod === "MONTHLY" ? "active" : ""} onClick={() => setBillingPeriod("MONTHLY")}>Miesięcznie</button>
            <button className={billingPeriod === "YEARLY" ? "active" : ""} onClick={() => setBillingPeriod("YEARLY")}>Rocznie (Oszczędzasz 20%)</button>
          </div>
        )}
      </div>

      {!hasActiveSub && (
        <div className="premium-plans-grid">
          <div className="premium-plan-card">
            <h3>Standard</h3>
            <div className="price">$0.00 <small>/ {activeInterval}</small></div>
            <ul className="premium-features">
              <li><Check /> Dostęp do publicznych bitew</li>
              <li><Check /> Standardowy profil twórcy</li>
              <li><Check /> Głosowanie społecznościowe</li>
            </ul>
            <button className="premium-checkout-btn secondary" disabled>Twój obecny plan</button>
          </div>

          <div className="premium-plan-card is-premium">
            <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--lime)', color: '#1c1826', fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>Najlepszy wybór</div>
            <h3>Premium</h3>
            <div className="price">{activePriceFormatted} <small>/ {activeInterval}</small></div>
            <ul className="premium-features">
              <li><Check /> Unikalny badge Premium</li>
              <li><Check /> Priorytetowy matchmaking</li>
              <li><Check /> Dostęp do ukrytych, zablokowanych funkcji (Future-gating)</li>
              <li><Check /> Zamknięte bitwy tylko dla Premium</li>
            </ul>
            <button className="premium-checkout-btn primary" onClick={() => checkoutMut.mutate({ data: { billingPeriod } })} disabled={checkoutMut.isPending}>
              {checkoutMut.isPending ? <Loader2 className="spin" /> : <>Rozpocznij Premium <ArrowUpRight /></>}
            </button>
          </div>
        </div>
      )}

      <div className="premium-faq">
        <h2>Często zadawane pytania</h2>
        <div className="faq-item">
          <h4>Czy mogę anulować subskrypcję w dowolnym momencie?</h4>
          <p>Tak, możesz zrezygnować z Premium w dowolnej chwili z poziomu ustawień profilu. Dostęp do funkcji Premium zachowasz do końca opłaconego okresu rozliczeniowego.</p>
        </div>
        <div className="faq-item">
          <h4>Czym są zablokowane funkcje (future-gating)?</h4>
          <p>Cały czas rozwijamy nowe formaty bitew i narzędzia dla twórców. Jako użytkownik Premium, zyskasz do nich dostęp w pierwszej kolejności, zanim zostaną udostępnione szerszej publiczności (lub jako funkcja ekskluzywna na zawsze).</p>
        </div>
      </div>
    </div>
  );
}
