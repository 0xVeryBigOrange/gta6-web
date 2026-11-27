/** Live market shocks. Counters are optional save fields; missing values stay at zero. */

export const DROP_SPOTS = [
  { x: 16, z: 36, name: '市中心' },
  { x: -40, z: 90, name: '西区街口' },
  { x: 168, z: 200, name: '海滩大道' },
  { x: 58, z: -58, name: '南边路口' },
  { x: 250, z: 20, name: '郊区入口' },
];

export const PUMP_SPOTS = [
  { x: 230, z: 214, name: '海滩拉盘点' },
  { x: 8, z: 78, name: '交易所门口' },
  { x: -20, z: 40, name: '出租车站' },
];

export const CRASH_COINS = ['BTC', 'ETH', 'SOL', 'DOGE'];

function count(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(999, Math.round(n));
}

export function readShocks(raw) {
  return {
    claimed: count(raw?.claimed),
    crashes: count(raw?.crashes),
    pumps: count(raw?.pumps),
  };
}

export function rollShock(rng, previous) {
  const kinds = ['crash', 'drop', 'pump'];
  let kind = kinds[Math.floor(rng() * kinds.length)];
  if (kind === previous) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
  return kind;
}
