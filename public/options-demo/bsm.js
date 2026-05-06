// Black-Scholes math + multi-leg strategy P&L for the demo.
// Single-file, no deps. Pricing only — Greeks left out for the demo.

const SQRT2 = Math.SQRT2;

function erf(x) {
  // Abramowitz & Stegun 7.1.26
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-ax*ax);
  return sign * y;
}

function N(x) { return 0.5 * (1 + erf(x / SQRT2)); }

export function bsmCall(S, K, T, r, sigma) {
  if (T <= 1e-9 || sigma <= 1e-9) return Math.max(S - K, 0);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*sqrtT);
  const d2 = d1 - sigma*sqrtT;
  return S*N(d1) - K*Math.exp(-r*T)*N(d2);
}

export function bsmPut(S, K, T, r, sigma) {
  if (T <= 1e-9 || sigma <= 1e-9) return Math.max(K - S, 0);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*sqrtT);
  const d2 = d1 - sigma*sqrtT;
  return K*Math.exp(-r*T)*N(-d2) - S*N(-d1);
}

// Strategy = list of legs. Each leg: { type: 'C'|'P', side: 1|-1, K, qty }
// Returns net premium of holding the position right now.
export function strategyValue(legs, S, T, r, sigma) {
  let v = 0;
  for (const leg of legs) {
    const price = leg.type === 'C' ? bsmCall(S, leg.K, T, r, sigma) : bsmPut(S, leg.K, T, r, sigma);
    v += leg.side * leg.qty * price;
  }
  return v;
}

// Strategy presets. K's keyed off ATM so we can swap underlying easily.
export function presetLegs(strategy, atm) {
  const round = (x) => Math.round(x / 50) * 50; // TXO 履約價間距 50
  switch (strategy) {
    case 'bull-call':
      return [
        { type: 'C', side:  1, K: round(atm - 50),  qty: 1 },
        { type: 'C', side: -1, K: round(atm + 150), qty: 1 },
      ];
    case 'bear-put':
      return [
        { type: 'P', side:  1, K: round(atm + 50),  qty: 1 },
        { type: 'P', side: -1, K: round(atm - 150), qty: 1 },
      ];
    case 'long-call':
      return [{ type: 'C', side: 1, K: round(atm), qty: 1 }];
    case 'long-put':
      return [{ type: 'P', side: 1, K: round(atm), qty: 1 }];
    case 'straddle':
      return [
        { type: 'C', side: 1, K: round(atm), qty: 1 },
        { type: 'P', side: 1, K: round(atm), qty: 1 },
      ];
    case 'iron-condor':
      return [
        { type: 'P', side: -1, K: round(atm - 100), qty: 1 },
        { type: 'P', side:  1, K: round(atm - 250), qty: 1 },
        { type: 'C', side: -1, K: round(atm + 100), qty: 1 },
        { type: 'C', side:  1, K: round(atm + 250), qty: 1 },
      ];
    default:
      return [];
  }
}
