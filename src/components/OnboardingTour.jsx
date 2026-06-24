import { useEffect, useState } from "react";
import { X, ChevronRight } from "lucide-react";

const STEPS = [
  {
    id: "welcome",
    title: "Bienvenido a Playfulbet",
    text: "Aquí puedes apostar con monedas virtuales. Sin dinero real, solo diversión.",
    anchor: null,
  },
  {
    id: "coins",
    title: "Tus monedas",
    text: "Empiezas con 1500 coins. Cuando se te acaben, puedes ganar más viendo anuncios o completando misiones.",
    anchor: ".apex-coins",
  },
  {
    id: "events",
    title: "Eventos deportivos",
    text: "Explora partidos en directo, próximos y populares. Haz clic en las cuotas para añadir a tu quiniela.",
    anchor: ".eventos-content",
  },
  {
    id: "earn",
    title: "Gana más monedas",
    text: "Mira videos, completa encuestas y consigue monedas gratis para seguir apostando.",
    anchor: ".apex-watch-video-cta",
  },
];

export default function OnboardingTour({ onDismiss }) {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("pb_onboarded") === "1");

  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => {}, 0);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (dismissed || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const advance = () => {
    if (isLast) {
      localStorage.setItem("pb_onboarded", "1");
      setDismissed(true);
      onDismiss?.();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <>
      <div className="apex-onboard-scrim" />
      <div className="apex-onboard-card">
        <button type="button" className="apex-onboard-skip" onClick={() => { localStorage.setItem("pb_onboarded", "1"); setDismissed(true); onDismiss?.(); }} aria-label="Saltar">
          <X size={16} />
        </button>
        <div className="apex-onboard-step">{step + 1} / {STEPS.length}</div>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <button type="button" className="apex-onboard-next" onClick={advance}>
          {isLast ? "Empezar a jugar" : "Siguiente"}
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
