/** Gang territories. Ownership is a new save field; missing data means the player only holds the home block. */

export const GANGS = {
  flame: { id: 'flame', name: '橙焰帮', color: '#ff6a14', hex: 0xff6a14 },
  short: { id: 'short', name: '空头帮', color: '#ff4fad', hex: 0xff4fad },
  mine: { id: 'mine', name: '矿工帮', color: '#3ec6ff', hex: 0x3ec6ff },
  doge: { id: 'doge', name: '土狗帮', color: '#e7c15a', hex: 0xe7c15a },
};

export const HOME_TURF = 'safe';

export const TURFS = [
  {
    id: 'safe',
    name: '安全屋街区',
    gang: 'flame',
    home: true,
    x: 0,
    z: -16,
    hw: 46,
    hd: 32,
    flag: { x: 14, z: -12 },
    income: 28,
    prize: 0,
  },
  {
    id: 'west',
    name: '西岸账本',
    gang: 'short',
    x: -116,
    z: 58,
    hw: 46,
    hd: 70,
    flag: { x: -128, z: 70 },
    income: 55,
    prize: 1400,
  },
  {
    id: 'core',
    name: '霓虹核心',
    gang: 'short',
    x: 0,
    z: 100,
    hw: 46,
    hd: 48,
    flag: { x: 14, z: 74 },
    income: 72,
    prize: 1800,
  },
  {
    id: 'east',
    name: '东市矿脉',
    gang: 'mine',
    x: 116,
    z: 20,
    hw: 46,
    hd: 78,
    flag: { x: 128, z: 46 },
    income: 60,
    prize: 1500,
  },
  {
    id: 'south',
    name: '南岸矿场',
    gang: 'mine',
    x: 0,
    z: -116,
    hw: 80,
    hd: 40,
    flag: { x: 14, z: -104 },
    income: 58,
    prize: 1500,
  },
  {
    id: 'beach',
    name: '海滩狗窝',
    gang: 'doge',
    x: 160,
    z: 196,
    hw: 110,
    hd: 28,
    flag: { x: 210, z: 185 },
    income: 64,
    prize: 1600,
  },
  {
    id: 'suburb',
    name: '郊区土狗',
    gang: 'doge',
    x: 380,
    z: 0,
    hw: 90,
    hd: 64,
    flag: { x: 370, z: 24 },
    income: 48,
    prize: 1300,
  },
];

const KNOWN = new Set(TURFS.map((turf) => turf.id));

export function turfById(id) {
  return TURFS.find((turf) => turf.id === id) || null;
}

export function gangOf(id) {
  return GANGS[id] || GANGS.flame;
}

export function readTurf(raw) {
  const owned = new Set([HOME_TURF]);
  if (raw && Array.isArray(raw.owned)) {
    for (const id of raw.owned) {
      if (KNOWN.has(id)) owned.add(id);
    }
  }
  const taken = Number(raw?.taken);
  const defended = Number(raw?.defended);
  return {
    owned,
    taken: Number.isFinite(taken) && taken > 0 ? Math.min(99, Math.round(taken)) : 0,
    defended: Number.isFinite(defended) && defended > 0 ? Math.min(99, Math.round(defended)) : 0,
  };
}

export function flagHere(x, z, reach = 7.2) {
  const reach2 = reach * reach;
  let best = null;
  let bestD = reach2;
  for (const turf of TURFS) {
    if (turf.home) continue;
    const d = (x - turf.flag.x) ** 2 + (z - turf.flag.z) ** 2;
    if (d <= bestD) {
      best = turf;
      bestD = d;
    }
  }
  return best;
}

export function outsideTurf(turf, x, z) {
  const dx = Math.max(Math.abs(x - turf.x) - turf.hw, 0);
  const dz = Math.max(Math.abs(z - turf.z) - turf.hd, 0);
  return Math.hypot(dx, dz);
}

export function waveSize(low) {
  return low ? 4 : 5;
}

export function wavePoints(turf, count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + 0.35;
    const radius = 8 + (i % 2) * 2.4;
    points.push({
      x: turf.flag.x + Math.sin(angle) * radius,
      z: turf.flag.z + Math.cos(angle) * radius,
    });
  }
  return points;
}

export function incomePerMin(owned) {
  let sum = 0;
  for (const turf of TURFS) {
    if (owned.has(turf.id)) sum += turf.income;
  }
  return sum;
}
