import { useEffect, useRef, useState } from "react";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const googleScriptId = "playfulbet-google-gsi";

const loadGoogleScript = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve(window.google);

  const existing = document.getElementById(googleScriptId);
  if (existing) {
    existing.addEventListener("load", () => resolve(window.google), { once: true });
    existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google")), { once: true });
    return;
  }

  const script = document.createElement("script");
  script.id = googleScriptId;
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = () => resolve(window.google);
  script.onerror = () => reject(new Error("No se pudo cargar Google"));
  document.head.appendChild(script);
});

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const googleButtonRef = useRef(null);

  const handleGoogleCredential = async (credential) => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar sesion con Google");
      onAuth(payload.user);
    } catch (nextError) {
      setError(nextError.message || "No se pudo iniciar sesion con Google");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;

    let cancelled = false;
    loadGoogleScript()
      .then((google) => {
        if (cancelled || !google?.accounts?.id || !googleButtonRef.current) return;
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => handleGoogleCredential(credential),
          ux_mode: "popup",
          auto_select: false,
        });
        googleButtonRef.current.innerHTML = "";
        google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          shape: "pill",
          size: "large",
          text: "continue_with",
          width: Math.min(396, Math.floor(googleButtonRef.current.offsetWidth || 396)),
        });
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError.message || "No se pudo cargar Google");
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar sesion");
      onAuth(payload.user);
    } catch (nextError) {
      setError(nextError.message || "No se pudo iniciar sesion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="apex-auth-shell">
      <section className="apex-auth-card">
        <div className="apex-auth-brand">
          <span className="apex-mark">P</span>
          <div>
            <strong>Playfulbet</strong>
            <p>Predicciones deportivas y social gaming</p>
          </div>
        </div>

        <div className="apex-auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Crear cuenta</button>
        </div>

        <form className="apex-auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              <span>Usuario</span>
              <input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} minLength={3} required />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
          </label>
          <label>
            <span>Contrasena</span>
            <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} minLength={8} required />
          </label>

          {error && <p className="apex-auth-error">{error}</p>}

          <button type="submit" className="apex-auth-submit" disabled={submitting}>
            {submitting ? "Enviando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div className="apex-auth-divider"><span>o</span></div>

        {googleClientId ? (
          <div className="apex-auth-google">
            <div ref={googleButtonRef} />
          </div>
        ) : (
          <p className="apex-auth-note">Configura `VITE_GOOGLE_CLIENT_ID` para activar Google.</p>
        )}
      </section>
    </div>
  );
}
