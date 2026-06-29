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

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.79.43 3.48 1.18 4.95l3.66-2.85z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.83C6.7 7.31 9.17 5.38 12 5.38z"/>
    </svg>
  );
}

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="apex-auth-card">
        <header className="apex-auth-brand">
          <div className="apex-auth-logo">A</div>
          <div className="apex-auth-brand-text">
            <strong>Apex Sports</strong>
            <p>Predicciones deportivas y social gaming</p>
          </div>
        </header>

        <nav className="apex-auth-tabs" aria-label="Modo de autenticacion">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Crear cuenta
          </button>
        </nav>

        <form className="apex-auth-form" onSubmit={submit} noValidate>
          {mode === "register" && (
            <label className="apex-auth-field">
              <span>Usuario</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Tu nombre de usuario"
                minLength={3}
                required
                autoComplete="username"
              />
            </label>
          )}

          <label className="apex-auth-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="apex-auth-field">
            <span>Contrasena</span>
            <div className="apex-auth-password">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Minimo 8 caracteres"
                minLength={8}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="apex-auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          {error && <p className="apex-auth-error" role="alert">{error}</p>}

          <button type="submit" className="apex-auth-submit" disabled={submitting}>
            {submitting ? "Enviando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        {mode === "login" && (
          <p className="apex-auth-forgot">
            <button type="button" className="apex-auth-link" onClick={() => alert("Recuperar contrasena proximamente")}>
              ¿Olvidaste tu contrasena?
            </button>
          </p>
        )}

        <div className="apex-auth-divider">
          <span>o</span>
        </div>

        {googleClientId ? (
          <div className="apex-auth-google" ref={googleButtonRef}>
            {/* Google button rendered here */}
          </div>
        ) : (
          <button
            type="button"
            className="apex-auth-google-fallback"
            onClick={() => alert("Configura VITE_GOOGLE_CLIENT_ID para habilitar Google")}
          >
            <GoogleIcon />
            <span>Continuar con Google</span>
          </button>
        )}

        <p className="apex-auth-terms">
          Al continuar, aceptas nuestros <a href="#terms">Terminos de Servicio</a> y la <a href="#privacy">Politica de Privacidad</a>.
        </p>
      </div>

      <nav className="apex-auth-footer-links" aria-label="Links adicionales">
        <a href="#support">Soporte</a>
        <a href="#about">¿Qué es Apex Sports?</a>
        <a href="#blog">Blog</a>
      </nav>
    </div>
  );
}
