import { useState } from "react";

export default function BetConfirm({ label, odds, balance, submitting, onCancel, onConfirm }) {
  const [amount, setAmount] = useState(Math.min(100, balance));
  const valid = Number.isInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= balance;

  return (
    <div className="apex-bet-confirm">
      <div><span>{label}</span><b>@ {Number(odds).toFixed(2)}</b></div>
      <label>
        Monedas
        <input
          type="number"
          min="1"
          max={balance}
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <small>Saldo: {balance} · Retorno posible: {valid ? Math.round(Number(amount) * odds) : 0}</small>
      <footer>
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button type="button" disabled={!valid || submitting} onClick={() => onConfirm(Number(amount))}>
          {submitting ? "Validando..." : "Confirmar apuesta"}
        </button>
      </footer>
    </div>
  );
}
