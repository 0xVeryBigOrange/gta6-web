/** City grid and gameplay constants. All original / procedural. */

export const CELL = 48;
export const ROAD_W = 16;
export const LINES = 6;
export const ORIGIN = -((LINES - 1) / 2) * CELL;
export const BLOCK_HALF = (CELL - ROAD_W) / 2;
export const BUILD_LIMIT = BLOCK_HALF * 0.68;

export const WORLD = {
  minX: -148,
  maxX: 148,
  minZ: -148,
  maxZ: 176,
  beachZ: 132,
  waterZ: 188,
};

export const COINS = [
  { id: 'BTC', name: '比特币', tick: 'BTC', dec: 4, priceDec: 0, color: '#f2a900' },
  { id: 'ETH', name: '以太坊', tick: 'ETH', dec: 3, priceDec: 0, color: '#8aa4ff' },
  { id: 'SOL', name: 'Solana', tick: 'SOL', dec: 2, priceDec: 2, color: '#c084fc' },
  { id: 'DOGE', name: '狗狗币', tick: 'DOGE', dec: 1, priceDec: 4, color: '#e7c15a' },
  { id: 'ORNG', name: '大橙子币', tick: 'ORNG', dec: 1, priceDec: 4, color: '#ff8a1e' },
];

export const BASE_PRICES = {
  BTC: 67200,
  ETH: 3240,
  SOL: 178,
  DOGE: 0.162,
  ORNG: 0.42,
};

export const STARTING = {
  usd: 2500,
  bal: { BTC: 0.012, ETH: 0.25, SOL: 3, DOGE: 800, ORNG: 1200 },
};

export const CARS = [
  {
    id: 'runner',
    name: '橙行者',
    blurb: '起步赠送的海滩通勤车',
    price: 0,
    max: 24,
    accel: 20,
    grip: 1,
    color: 0xff8a1e,
    x: 8,
    z: 34,
    yaw: Math.PI,
  },
  {
    id: 'suv',
    name: '链上越野',
    blurb: '稳、宽、适合甩掉监管',
    price: 8000,
    max: 28,
    accel: 17,
    grip: 1.15,
    color: 0x20e0c0,
    x: -58,
    z: 34,
    yaw: 0,
  },
  {
    id: 'sport',
    name: '落日超跑',
    blurb: '霓虹粉，拉盘专用',
    price: 18000,
    max: 36,
    accel: 28,
    grip: 0.92,
    color: 0xff2d95,
    x: -44,
    z: 34,
    yaw: 0,
  },
];

export const PROPS = [
  {
    id: 'beach',
    name: '海滩公寓',
    blurb: '正对日落。拥有后通缉消退更快。',
    price: 6000,
    x: 52,
    z: 156,
  },
  {
    id: 'pent',
    name: '霓虹阁楼',
    blurb: '市中心天际线，纯炫耀资产。',
    price: 26000,
    x: -48,
    z: -24,
  },
];

export const SPOTS = {
  spawn: { x: 30, z: 30 },
  exchange: { x: 0, z: 18, r: 4.2, name: '橙子交易所' },
  kiosk: { x: 24, z: 46, r: 3.6, name: '任务终端' },
  dealer: { x: -48, z: 26, r: 4.4, name: '车行' },
  safehouse: { x: 42, z: 24, r: 4.2, name: '橙子安全屋' },
  coldPickup: { x: -72, z: -100, r: 3.4 },
  coldDrop: { x: 52, z: 156, r: 4.2 },
  pump: { x: 108, z: 164, r: 4.2 },
  rug: { x: 72, z: 48, r: 3.6 },
  loot: [
    { x: 72, z: 36 },
    { x: 72, z: 60 },
    { x: 120, z: 48 },
  ],
};

export const MISSIONS = [
  {
    id: 'cold',
    name: '冷钱包专送',
    desc: '北码头有一枚硬件钱包。取回后送到海滩公寓的保险箱，限时完成。',
    reward: '0.20 ETH',
  },
  {
    id: 'sec',
    name: '甩掉 SEC',
    desc: '监管把你标成三星。开车甩开他们，让通缉归零。被贴住会约谈失败。',
    reward: '3 SOL + $2,000',
  },
  {
    id: 'pump',
    name: '模因币拉盘',
    desc: '去海滩拉盘点点燃大橙子币。暴涨窗口里赶到交易所卖掉至少 1000 ORNG。',
    reward: '价差利润 + $3,000',
  },
  {
    id: 'rug',
    name: 'Rug Pull 劫案',
    desc: '橙氏基金门口有三袋「流动性」。抢走后逃回安全屋。监管会立刻盯上你。',
    reward: '0.015 BTC',
  },
];

export const HEADLINES = [
  '链上晚报：海滩 NFT 日落又归零了',
  'SEC 发言人：我们只是来度假，顺便冻结你',
  '大橙子：今天的 K 线很橙',
  '分析师上调 ORNG 目标价，理由是「闻起来像柑橘」',
  '本地新闻：有人用冷钱包换了一客虾',
  '链上越野缺货，车行只收游戏里的钱',
  '谣言：橙氏基金的流动性在后备箱里',
  '气象：霓虹日落持续，适合跑路',
];

export const SAVE_KEY = 'vice-chain-3d-save-v1';

export function linePos(i) {
  return ORIGIN + i * CELL;
}

export function roadSegments() {
  const lines = [];
  const a = ORIGIN - 8;
  const b = ORIGIN + (LINES - 1) * CELL + 8;
  for (let i = 0; i < LINES; i += 1) {
    const p = linePos(i);
    lines.push({ x1: a, z1: p, x2: b, z2: p });
    lines.push({ x1: p, z1: a, x2: p, z2: b });
  }
  return lines;
}
