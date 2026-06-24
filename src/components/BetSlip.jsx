import { useState, useMemo, useEffect } from "react";
import { X, Receipt, Trash2, Zap, Trophy } from "lucide-react";

const MIN_BET = 50;

const SELECTION_LABELS = {
  "1": "Local",
  "X": "Empate",
  "2": "Visitante",
};

const MARKET_LABELS = {
  "1X2": "Ganador (1X2)",
};

export default function BetSlip({ open, onClose, items, onRemoveItem, onClear, onConfirm, user, submitting }) {
  const [amount, setAmount] = useState(100);
  const [mode, setMode] = useState("simples");

  const balance = user?.points || 0;

  useEffect(() => {
    if (items.length === 0) {
      setAmount(100);
      setMode("simples");
    }
  }, [items.length]);

  const combinedOdds = useMemo(() => {
    if (items.length === 0) return 0;
    return items.reduce((acc, item) => acc * (item.odd || 1), 1);
  }, [items]);

  const displayOdds = mode === "multiple" ? combinedOdds : items[0]?.odd || 0;
  const totalStake = mode === "multiple" ? amount : amount * items.length;
  const potentialWin = mode === "multiple"
    ? Math.round(amount * combinedOdds)
    : items.reduce((sum, item) => sum + Math.round(amount * (item.odd || 0)), 0);

  const isValid = items.length > 0 && amount >= MIN_BET && totalStake <= balance;

  const addAmount = (delta) => {
    setAmount((prev) => Math.max(MIN_BET, Math.min(balance, prev + delta)));
  };

  const setAllIn = () => {
    if (mode === "multiple" || items.length === 0) {
      setAmount(Math.max(MIN_BET, balance));
    } else {
      setAmount(Math.max(MIN_BET, Math.floor(balance / items.length)));
    }
  };

  const handleAmountChange = (e) => {
    const val = Number(e.target.value) || 0;
    setAmount(Math.max(MIN_BET, Math.min(balance, val)));
  };

  if (!open) return null;

  return (
    <>
      <div className="apex-betslip-overlay" onClick={onClose} />
      <aside className="apex-betslip" role="dialog" aria-label="Cupón de apuesta">
        <header className="apex-betslip-header">
          <div className="apex-betslip-title">
            <Receipt size={18} />
            <span>Cupón de Apuesta</span>
            <span className="apex-betslip-badge">
              {items.length} {items.length === 1 ? "SELECCIÓN" : "SELECCIONES"}
            </span>
          </div>
          <button type="button" className="apex-betslip-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="apex-betslip-body">
          {items.length === 0 ? (
            <div className="apex-betslip-empty">
              <Receipt size={32} />
              <p>Tu cupón está vacío</p>
              <small>Selecciona una cuota para añadir una apuesta</small>
            </div>
          ) : (
            <>
              <div className="apex-betslip-selections">
                {items.map((item, index) => (
                  <div key={`${item.eventId}-${item.selection}`} className="apex-betslip-selection">
                    <div className="apex-betslip-selection-header">
                      <div className="apex-betslip-selection-meta">
                        <span className="apex-betslip-league">
                          {item.sportLabel || item.sport || "EVENTO"} · {item.league || "LIGA"}
                        </span>
                        <strong>{item.home} vs {item.away}</strong>
                        <small>Mercado: {MARKET_LABELS["1X2"]}</small>
                        <small>Selección: <b>{SELECTION_LABELS[item.selection] || item.selection}</b></small>
                      </div>
                      <div className="apex-betslip-selection-odd">{item.odd?.toFixed(2)}</div>
                    </div>
                    <button type="button" className="apex-betslip-remove" onClick={() => onRemoveItem(index)}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                ))}
              </div>

              {items.length > 1 && (
                <div className="apex-betslip-tabs">
                  {[
                    { key: "simples", label: "Simples" },
                    { key: "multiple", label: "Múltiple" },
                    { key: "sistemas", label: "Sistemas" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={mode === tab.key ? "active" : ""}
                      onClick={() => setMode(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="apex-betslip-amount">
                <div className="apex-betslip-amount-header">
                  <span>Monto de la Apuesta</span>
                  <small>Max: {balance.toLocaleString("es-ES")} Coins</small>
                </div>
                <div className="apex-betslip-amount-input">
                  <input
                    type="number"
                    min={MIN_BET}
                    max={balance}
                    step={50}
                    value={amount}
                    onChange={handleAmountChange}
                  />
                  <span className="apex-betslip-amount-suffix">COINS</span>
                </div>
                <div className="apex-betslip-presets">
                  <button type="button" onClick={() => addAmount(100)}>+100</button>
                  <button type="button" onClick={() => addAmount(500)}>+500</button>
                  <button type="button" onClick={() => addAmount(1000)}>+1k</button>
                  <button type="button" className="all-in" onClick={setAllIn}>ALL-IN</button>
                </div>
              </div>

              <div className="apex-betslip-balance">
                <Zap size={14} />
                <span>Saldo disponible: <b>{balance.toLocaleString("es-ES")} Coins</b></span>
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <footer className="apex-betslip-footer">
            <div className="apex-betslip-totals">
              <div>
                <span>Total Apostado</span>
                <b>{totalStake.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Coins</b>
              </div>
              <div>
                <span>Cuota Total</span>
                <b>{displayOdds.toFixed(2)}</b>
              </div>
            </div>
            <div className="apex-betslip-win">
              <span>Ganancia Potencial</span>
              <b className="apex-betslip-win-value">
                {potentialWin.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Coins
              </b>
            </div>
            <button
              type="button"
              className="apex-betslip-confirm"
              disabled={!isValid || submitting}
              onClick={() => onConfirm(amount, mode)}
            >
              <Zap size={16} /> {submitting ? "Validando..." : "Realizar Predicción"}
            </button>
            <small className="apex-betslip-disclaimer">
              Al confirmar, aceptas nuestros términos de predicción deportiva. Las cuotas están sujetas a cambios según el tiempo real.
            </small>
          </footer>
        )}
      </aside>
    </>
  );
}
