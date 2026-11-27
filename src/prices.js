import { BASE_PRICES } from './config.js';

const state = {
  live: { ...BASE_PRICES },
  source: '模拟',
  orngMult: 1,
  updatedAt: 0,
};

const shock = { BTC: 1, ETH: 1, SOL: 1, DOGE: 1, ORNG: 1 };

export function setShockMult(id, mult) {
  if (!(id in shock)) return;
  const n = Number(mult);
  shock[id] = Number.isFinite(n) ? Math.max(0.05, Math.min(8, n)) : 1;
}

export function clearShockMults() {
  for (const key of Object.keys(shock)) shock[key] = 1;
}

function drift(rng) {
  const next = { ...state.live };
  for (const key of Object.keys(next)) {
    const span = key === 'ORNG' ? 0.05 : 0.012;
    next[key] = Math.max(0.01, next[key] * (1 + (rng() - 0.5) * span));
  }
  state.live = next;
  state.source = '模拟';
  state.updatedAt = Date.now();
}

async function fromCoinGecko() {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const json = await res.json();
  if (!json?.bitcoin?.usd) throw new Error('coingecko shape');
  return {
    BTC: Number(json.bitcoin.usd),
    ETH: Number(json.ethereum.usd),
    SOL: Number(json.solana.usd),
    DOGE: Number(json.dogecoin.usd),
  };
}

async function fromBinance() {
  const symbols = encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT","DOGEUSDT"]');
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const rows = await res.json();
  const map = Object.fromEntries(rows.map((row) => [row.symbol, Number(row.price)]));
  if (!map.BTCUSDT) throw new Error('binance shape');
  return { BTC: map.BTCUSDT, ETH: map.ETHUSDT, SOL: map.SOLUSDT, DOGE: map.DOGEUSDT };
}

async function fromCryptoCompare() {
  const url = 'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH,SOL,DOGE&tsyms=USD';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`cryptocompare ${res.status}`);
  const json = await res.json();
  if (!json?.BTC?.USD) throw new Error('cryptocompare shape');
  return {
    BTC: Number(json.BTC.USD),
    ETH: Number(json.ETH.USD),
    SOL: Number(json.SOL.USD),
    DOGE: Number(json.DOGE.USD),
  };
}

export function getPrices() {
  return {
    BTC: state.live.BTC * shock.BTC,
    ETH: state.live.ETH * shock.ETH,
    SOL: state.live.SOL * shock.SOL,
    DOGE: state.live.DOGE * shock.DOGE,
    ORNG: state.live.ORNG * state.orngMult * shock.ORNG,
  };
}

export function getPriceSource() {
  return state.source;
}

export function setOrngMult(mult) {
  state.orngMult = mult;
}

export function getOrngMult() {
  return state.orngMult;
}

export async function refreshPrices(rng = Math.random) {
  const random = typeof rng === 'function' ? rng : Math.random;
  try {
    const live = await fromCoinGecko();
    state.live = { ...state.live, ...live };
    state.source = 'CoinGecko';
    state.updatedAt = Date.now();
    return state.source;
  } catch {
    /* try the next public feed */
  }
  try {
    const live = await fromBinance();
    state.live = { ...state.live, ...live };
    state.source = 'Binance';
    state.updatedAt = Date.now();
    return state.source;
  } catch {
    /* try the next public feed */
  }
  try {
    const live = await fromCryptoCompare();
    state.live = { ...state.live, ...live };
    state.source = 'CryptoCompare';
    state.updatedAt = Date.now();
    return state.source;
  } catch {
    drift(random);
    return state.source;
  }
}

export function tickSimulated(rng = Math.random) {
  const random = typeof rng === 'function' ? rng : Math.random;
  if (state.source === '模拟') {
    drift(random);
    return;
  }
  state.live.ORNG = Math.max(0.05, state.live.ORNG * (1 + (random() - 0.48) * 0.04));
}
