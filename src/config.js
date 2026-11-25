/** Vice Chain districts, economy, and missions. Coordinates are meters. */

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

export const WORLD = {
  minX: -600,
  maxX: 580,
  minZ: -540,
  maxZ: 560,
};

export const VEHICLES = [
  { id: 'sedan', name: '街车', blurb: '起步就停在路边的轿车', price: 0, kind: 'car', file: 'sedan', max: 42, accel: 26, grip: 1.05, seat: 0.15 },
  { id: 'suv', name: '链上越野', blurb: '高车身，甩监管更稳', price: 8000, kind: 'car', file: 'suv', max: 40, accel: 22, grip: 1.28, seat: 0.28 },
  { id: 'sport', name: '落日掀背', blurb: '直道凶，弯里要收油', price: 16000, kind: 'car', file: 'hatchback-sports', max: 58, accel: 36, grip: 0.88, seat: 0.12 },
  { id: 'taxi', name: '夜班出租', blurb: '市区巡游，转向老实', price: 4500, kind: 'car', file: 'taxi', max: 44, accel: 24, grip: 1, seat: 0.15 },
  { id: 'race', name: '赛道橙', blurb: '油门很冲，抓地一般', price: 24000, kind: 'car', file: 'race', max: 68, accel: 44, grip: 0.8, seat: 0.08 },
  { id: 'flame', name: '橙焰超跑', blurb: '地下赛的车。直道极快，弯里要收一点', price: 36000, kind: 'car', file: 'sedan-sports', max: 78, accel: 52, grip: 0.94, seat: 0.1 },
  { id: 'police', name: 'SEC 巡逻车', blurb: '征用来的，车行不卖', price: 0, kind: 'car', file: 'police', max: 52, accel: 32, grip: 1.1, seat: 0.15, unsold: true },
  { id: 'bike', name: '链轮摩托', blurb: '窄、快、会侧倾', price: 5000, kind: 'bike', max: 56, accel: 40, grip: 0.7, seat: 0.42 },
  { id: 'boat', name: '海岸快艇', blurb: '离开水面就几乎爬不动', price: 12000, kind: 'boat', file: 'boat-speed-a', max: 38, accel: 18, grip: 0.55, seat: 0.55 },
  { id: 'heli', name: '橙翼直升机', blurb: '能悬停。Shift 上升，Ctrl 下降', price: 42000, kind: 'heli', max: 42, accel: 12, grip: 1, seat: 0.35 },
  { id: 'plane', name: '落日轻航', blurb: '到机场跑道拉满油门再抬头', price: 56000, kind: 'plane', max: 78, accel: 14, grip: 1, seat: 0.45 },
];

export const PROPS = [
  {
    id: 'beach',
    name: '海滩公寓',
    blurb: '正对日落。拥有后通缉消退更快。',
    price: 6000,
    x: 120,
    z: 214,
  },
  {
    id: 'pent',
    name: '霓虹阁楼',
    blurb: '市中心天际线，纯炫耀资产。',
    price: 26000,
    x: 20,
    z: -58,
  },
];

export const SPOTS = {
  spawn: { x: 0, z: 22 },
  exchange: { x: 0, z: 58, r: 5.2, name: '橙子交易所' },
  kiosk: { x: 58, z: 0, r: 4.4, name: '任务终端' },
  dealer: { x: -58, z: 58, r: 5.5, name: '车行' },
  safehouse: { x: 0, z: -58, r: 5, name: '橙子安全屋' },
  hospital: { x: 0, z: -150, r: 6, name: '橙子医院' },
  coldPickup: { x: -168, z: 230, r: 5 },
  coldDrop: { x: 120, z: 214, r: 6 },
  pump: { x: 230, z: 214, r: 5.5 },
  rug: { x: 58, z: 58, r: 4 },
  loot: [
    { x: 58, z: 40 },
    { x: 58, z: 78 },
    { x: 96, z: 58 },
  ],
  airport: { x: -500, z: -390, r: 12 },
  marina: { x: -380, z: 239, r: 10 },
};

export const GATES = [
  { x: 40, y: 24, z: 430 },
  { x: 240, y: 32, z: 510 },
  { x: -140, y: 28, z: 470 },
];

export const GUARD_SPOTS = [
  { x: -450, z: 239 },
  { x: -360, z: 239 },
  { x: -320, z: 307 },
];

export const PIERS = [
  { x0: -520, x1: -210, z0: 230, z1: 248 },
  { x0: -500, x1: -210, z0: 298, z1: 316 },
  { x0: -470, x1: -230, z0: 366, z1: 384 },
];

export const MISSIONS = [
  {
    id: 'cold',
    name: '冷钱包专送',
    desc: '港口有一枚硬件钱包。取回后送到海滩公寓的保险箱，限时完成。',
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
  {
    id: 'sky',
    name: '航线投送',
    desc: '到机场登上轻航，拉起来，穿过海上的三道橙环。',
    reward: '0.020 BTC',
  },
  {
    id: 'harbor',
    name: '港口清场',
    desc: '码头有三名护卫。解决他们，再把直升机拉到 12 米以上离开。',
    reward: '5 SOL',
  },
];

export const HEADLINES = [
  '链上晚报：海滩 NFT 日落又归零了',
  'SEC 发言人：我们只是来度假，顺便冻结你',
  '大橙子：今天的 K 线很橙',
  '机场通报：有人把轻航当成了冷钱包',
  '本地新闻：港口护卫不收狗狗币',
  '链上越野缺货，车行只收游戏里的钱',
  '谣言：橙氏基金的流动性在后备箱里',
  '气象：霓虹日落会转夜，适合跑路',
  '街头：空头帮和矿工帮又在换旗',
];

export const SAVE_KEY = 'vice-chain-3d-save-v2';

export function inWater(x, z) {
  if (PIERS.some((p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1)) return false;
  if (z > 348 && x > -200) return true;
  if (x < -210 && z > 188 && z < 530 && x > -590) return true;
  return false;
}

export function missionName(id) {
  return MISSIONS.find((m) => m.id === id)?.name || id;
}
