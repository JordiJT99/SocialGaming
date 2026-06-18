import { Menu, ShieldCheck, Trophy, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

const features = [
  {
    icon: Trophy,
    label: "Predicciones",
    title: "El ritual diario",
    text: "Partidos destacados, picks 1X2, marcador exacto y puntos por acierto para volver cada jornada.",
  },
  {
    icon: Users,
    label: "Ligas",
    title: "Competicion entre amigos",
    text: "Ligas privadas con invitaciones, clasificacion semanal y piques sanos alrededor de LaLiga y Champions.",
  },
  {
    icon: ShieldCheck,
    label: "Social gaming",
    title: "Puntos virtuales",
    text: "Economia cerrada, sin cashout y preparada para recompensas, boosts y torneos de entrada.",
  },
];

const rewards = [
  { points: "500", title: "Sorteos", text: "Entradas accesibles para mantener movimiento en la economia." },
  { points: "15k", title: "Gift cards", text: "Premios puntuales ligados a partners, ads y offerwall." },
  { points: "20k", title: "Camisetas", text: "Recompensas aspiracionales para usuarios de alta actividad." },
];

const roadmap = [
  ["01", "Predicciones + ranking", "Core diario con partidos, perfil, puntos y clasificacion global."],
  ["02", "Ligas privadas", "Invitaciones, rankings por grupo y competicion semanal."],
  ["03", "Fantasy + offerwall", "Retencion semanal, rewarded ads, tareas y capa premium."],
];

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""} ${open ? "nav-open" : ""}`}>
      <a className="brand" href="#inicio" onClick={close} aria-label="Playfulbet inicio">
        <span className="brand-mark">P</span>
        <span>Playfulbet</span>
      </a>

      <button
        className="nav-toggle"
        type="button"
        aria-label={open ? "Cerrar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav className="main-nav" aria-label="Navegacion principal">
        <a href="#producto" onClick={close}>
          Producto
        </a>
        <a href="#ligas" onClick={close}>
          Ligas
        </a>
        <a href="#recompensas" onClick={close}>
          Recompensas
        </a>
        <a href="#mvp" onClick={close}>
          MVP
        </a>
      </nav>

      <a className="header-cta" href="#waitlist" onClick={close}>
        Unirme
      </a>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="hero-field" aria-hidden="true">
        <span className="field-line" />
        <span className="field-circle" />
        <span className="field-dot dot-a" />
        <span className="field-dot dot-b" />
        <span className="field-dot dot-c" />
      </div>

      <div className="hero-content">
        <p className="eyebrow">Social gaming deportivo</p>
        <h1>Playfulbet</h1>
        <p className="hero-copy">
          Predice partidos, reta a tus amigos y escala rankings con puntos virtuales, ligas privadas y recompensas
          pensadas para competir cada jornada.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#waitlist">
            Entrar al MVP
          </a>
          <a className="btn btn-secondary" href="#producto">
            Ver concepto
          </a>
        </div>
      </div>

      <aside className="live-board" aria-label="Vista previa de Playfulbet">
        <div className="board-topline">
          <span>Jornada activa</span>
          <strong>12.480 pts</strong>
        </div>

        <div className="match-card">
          <span className="league">LaLiga</span>
          <h2>Barca vs Madrid</h2>
          <div className="odds-row" aria-label="Opciones de prediccion">
            <button type="button">1</button>
            <button type="button">X</button>
            <button type="button" className="selected">
              2
            </button>
          </div>
        </div>

        <div className="prediction-strip">
          <span>Racha diaria</span>
          <strong>+320</strong>
        </div>

        <div className="rank-list">
          {[
            ["1", "Jordi", "18.2k"],
            ["2", "Marina", "17.6k"],
            ["3", "Alex", "16.9k"],
          ].map(([position, name, points]) => (
            <div key={name}>
              <span>{position}</span>
              <strong>{name}</strong>
              <em>{points}</em>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function Waitlist() {
  const [note, setNote] = useState("Sin apuestas con dinero real en el MVP inicial.");

  function submitWaitlist(event) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setNote(`${email} queda apuntado para el acceso temprano.`);
    event.currentTarget.reset();
  }

  return (
    <section className="waitlist" id="waitlist">
      <div>
        <span className="section-kicker">Acceso temprano</span>
        <h2>Construyamos el MVP de Playfulbet jornada a jornada.</h2>
      </div>
      <form className="waitlist-form" onSubmit={submitWaitlist}>
        <label htmlFor="email">Email</label>
        <div>
          <input id="email" name="email" type="email" placeholder="tu@email.com" required />
          <button className="btn btn-primary" type="submit">
            Apuntarme
          </button>
        </div>
        <p className="form-note">{note}</p>
      </form>
    </section>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />

        <section className="section intro" id="producto">
          <div className="section-kicker">MVP inicial</div>
          <div className="section-heading">
            <h2>La experiencia empieza con predicciones simples y mucha rivalidad social.</h2>
            <p>
              La primera version se centra en el loop diario: elegir resultados, ganar puntos, comparar ranking y volver
              cuando haya nuevos partidos.
            </p>
          </div>

          <div className="feature-grid">
            {features.map(({ icon: Icon, label, title, text }) => (
              <article className="feature-card" key={title}>
                <span className="feature-icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <small>{label}</small>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section social-band" id="ligas">
          <div className="social-copy">
            <div className="section-kicker">Viralidad</div>
            <h2>Las ligas privadas convierten cada partido en una excusa para volver.</h2>
            <p>
              El producto prioriza grupos pequenos, rankings visibles y competicion directa. La gracia no es solo
              acertar: es ganar al amigo que va primero.
            </p>
          </div>

          <div className="league-preview" aria-label="Ejemplo de liga privada">
            <div className="league-header">
              <span>Peña Champions</span>
              <strong>8 jugadores</strong>
            </div>
            {[
              ["01", "Jordi", "42 pts"],
              ["02", "Claudia", "39 pts"],
              ["03", "Marc", "36 pts"],
              ["04", "Nora", "34 pts"],
            ].map(([position, name, points], index) => (
              <div className={`league-row ${index === 0 ? "active" : ""}`} key={name}>
                <span>{position}</span>
                <b>{name}</b>
                <em>{points}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="section rewards" id="recompensas">
          <div className="section-kicker">Puntos y recompensas</div>
          <div className="section-heading compact">
            <h2>Monetizacion con offerwall, ads y premios no monetarios.</h2>
            <p>
              El modelo se mantiene en social gaming: puntos virtuales, recompensas no lineales, sorteos y premios de
              marca sin conversion directa a dinero real.
            </p>
          </div>

          <div className="reward-track" aria-label="Ejemplos de recompensas">
            {rewards.map((reward) => (
              <article key={reward.title}>
                <span>{reward.points}</span>
                <h3>{reward.title}</h3>
                <p>{reward.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section roadmap" id="mvp">
          <div className="section-kicker">Fases</div>
          <h2>Un lanzamiento pequeno, medible y con espacio para crecer.</h2>

          <div className="timeline">
            {roadmap.map(([step, title, text]) => (
              <article key={step}>
                <span>{step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <Waitlist />
      </main>

      <footer className="site-footer">
        <span>Playfulbet</span>
        <p>Social gaming deportivo con puntos virtuales y recompensas.</p>
      </footer>
    </>
  );
}
