import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Logo } from "@/App";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const homeUrl = `${basePath}/` || "/";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Polityka prywatności | VYBE";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="legal-page">
      <header className="legal-header">
        <Logo onClick={() => navigate("/")} />
        <a className="legal-back-link" href={homeUrl}>
          Wróć do VYBE <ArrowUpRight />
        </a>
      </header>

      <article className="legal-document">
        <div className="legal-intro">
          <div className="legal-icon"><ShieldCheck /></div>
          <span className="eyebrow">VYBE · Dokument prawny</span>
          <h1>Polityka prywatności</h1>
          <p>
            Ta polityka wyjaśnia, jakie dane przetwarzamy w VYBE, dlaczego to robimy
            i jakie prawa przysługują użytkownikom.
          </p>
          <span className="legal-updated">Obowiązuje od: 11 września 2026 r.</span>
        </div>

        <Section title="1. Administrator danych">
          <p>
            Administratorem danych związanych z korzystaniem z VYBE jest Igor Paradowski,
            osoba fizyczna prowadząca serwis VYBE („VYBE”, „my” lub „nas”). W sprawach
            prywatności możesz
            skontaktować się z nami pod adresem{" "}
            <a href="mailto:Igor.kazmierczak1@onet.com.pl">Igor.kazmierczak1@onet.com.pl</a>.
          </p>
        </Section>

        <Section title="2. Jakie dane przetwarzamy">
          <ul>
            <li>
              <strong>Dane konta:</strong> adres e-mail, identyfikator konta,
              nazwa wyświetlana, nazwa użytkownika i dane logowania obsługiwane przez Clerk.
            </li>
            <li>
              <strong>Dane profilu:</strong> bio, kraj, avatar oraz informacje,
              które użytkownik dobrowolnie publikuje w swoim profilu.
            </li>
            <li>
              <strong>Aktywność w VYBE:</strong> Battle, głosy, wyniki, XP, poziomy,
              rankingi, streaki, badges, obserwowanie, blokowanie i powiadomienia.
            </li>
            <li>
              <strong>Treści użytkownika:</strong> posty, komentarze, reakcje,
              zgłoszenia moderacyjne i wiadomości wysyłane innym użytkownikom.
            </li>
            <li>
              <strong>Dane płatności:</strong> informacje o planie, statusie
              subskrypcji i fakturach. Dane kart płatniczych obsługuje Stripe —
              VYBE nie przechowuje pełnych danych karty.
            </li>
            <li>
              <strong>Dane techniczne:</strong> adres IP, typ urządzenia, przeglądarka,
              logi bezpieczeństwa i informacje potrzebne do działania sesji.
            </li>
          </ul>
        </Section>

        <Section title="3. W jakim celu używamy danych">
          <ul>
            <li>tworzymy i zabezpieczamy konto użytkownika;</li>
            <li>udostępniamy Feed, profile, Battle, wiadomości, rankingi i powiadomienia;</li>
            <li>naliczamy XP, poziomy, streaki, wyniki i odznaki;</li>
            <li>obsługujemy Premium, płatności i Customer Portal przez Stripe;</li>
            <li>wykrywamy nadużycia, spam, próby manipulowania wynikami i naruszenia zasad;</li>
            <li>odpowiadamy na zgłoszenia oraz zapewniamy bezpieczeństwo serwisu;</li>
            <li>generujemy propozycje w VYBE AI, gdy użytkownik korzysta z tej funkcji.</li>
          </ul>
        </Section>

        <Section title="4. Podstawy prawne">
          <p>
            Przetwarzamy dane, gdy jest to potrzebne do wykonania umowy z użytkownikiem,
            spełnienia obowiązków prawnych, ochrony uzasadnionych interesów VYBE
            (w tym bezpieczeństwa i moderacji) albo na podstawie zgody użytkownika.
            Użytkownik może wycofać zgodę w dowolnym momencie, bez wpływu na zgodność
            wcześniejszego przetwarzania z prawem.
          </p>
        </Section>

        <Section title="5. Dostawcy usług">
          <p>
            Korzystamy z zaufanych dostawców, którzy pomagają nam świadczyć usługę:
          </p>
          <ul>
            <li><strong>Clerk</strong> — uwierzytelnianie i zarządzanie kontem;</li>
            <li><strong>Stripe</strong> — płatności, subskrypcje i faktury;</li>
            <li><strong>OpenAI lub inny skonfigurowany dostawca AI</strong> — generowanie pomysłów w VYBE AI;</li>
            <li><strong>Replit i dostawcy infrastruktury</strong> — hosting, baza danych, logi i bezpieczeństwo.</li>
          </ul>
          <p>
            Dostawcy otrzymują tylko dane potrzebne do realizacji swoich usług i
            przetwarzają je zgodnie z własnymi politykami prywatności oraz naszymi
            instrukcjami, gdy działają jako podmioty przetwarzające.
          </p>
        </Section>

        <Section title="6. Treści publiczne i wiadomości prywatne">
          <p>
            Posty, komentarze, profil publiczny, wyniki Battle i inne treści oznaczone
            jako publiczne mogą być widoczne dla innych użytkowników. Wiadomości
            prywatne są przeznaczone dla uczestników danej rozmowy, ale mogą zostać
            przetworzone w celu bezpieczeństwa, obsługi zgłoszenia lub wykonania
            obowiązku prawnego. Nie udostępniamy ich publicznie jako elementu Feed.
          </p>
        </Section>

        <Section title="7. Przechowywanie danych">
          <p>
            Przechowujemy dane tak długo, jak jest to potrzebne do prowadzenia konta,
            świadczenia funkcji VYBE, rozliczeń, bezpieczeństwa i rozwiązywania sporów.
            Po usunięciu konta usuwamy lub anonimizujemy dane zgodnie z obowiązującymi
            wymogami prawnymi. Niektóre informacje mogą pozostać w kopiach zapasowych
            przez ograniczony czas.
          </p>
        </Section>

        <Section title="8. Twoje prawa">
          <p>
            W zależności od miejsca zamieszkania możesz mieć prawo do dostępu do danych,
            ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia,
            sprzeciwu oraz wycofania zgody. Możesz także złożyć skargę do właściwego
            organu ochrony danych. Aby skorzystać z praw, napisz na{" "}
            <a href="mailto:Igor.kazmierczak1@onet.com.pl">Igor.kazmierczak1@onet.com.pl</a>.
          </p>
        </Section>

        <Section title="9. Pliki cookie i pamięć urządzenia">
          <p>
            VYBE używa niezbędnych plików cookie, tokenów sesji i pamięci urządzenia
            do logowania, ochrony konta, zapamiętania ustawień oraz prawidłowego
            działania aplikacji. Nie używamy tych mechanizmów do sprzedawania danych
            osobowych.
          </p>
        </Section>

        <Section title="10. Dzieci">
          <p>
            VYBE nie jest przeznaczone dla osób poniżej minimalnego wieku wymaganego
            przez prawo w ich kraju. Nie zbieramy świadomie danych dzieci. Jeśli
            podejrzewasz, że dziecko przekazało nam dane, skontaktuj się z nami.
          </p>
        </Section>

        <Section title="11. Zmiany polityki">
          <p>
            Możemy aktualizować tę politykę, gdy zmieniają się funkcje VYBE, przepisy
            lub dostawcy usług. Nową wersję opublikujemy na tej stronie i zaktualizujemy
            datę obowiązywania. Jeżeli zmiana będzie istotna, możemy poinformować
            użytkowników także w aplikacji.
          </p>
        </Section>

        <footer className="legal-footer">
          <span>Masz pytanie dotyczące prywatności?</span>
          <a href="mailto:Igor.kazmierczak1@onet.com.pl">Napisz do nas <ArrowUpRight /></a>
        </footer>
      </article>
    </main>
  );
}