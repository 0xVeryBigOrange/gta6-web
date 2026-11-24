/** Tutorial steps, side jobs, and a road GPS. */

export const GUIDE = [
  { id: 'sprint', text: '教程 1/4 · 移动过去。Shift 冲刺，空格或双击摇杆跳。', x: 0, z: 58, r: 8 },
  { id: 'car', text: '教程 2/4 · 靠近路边的车，按 F 上车。', x: 4, z: 40, r: 9, until: 'vehicle' },
  { id: 'drive', text: '教程 3/4 · 跟着黄线，把车开到任务终端。', x: 58, z: 0, r: 9 },
  { id: 'job', text: '教程 4/4 · 按 E。然后按 M 接任务，或去 ATM、竞速、出租。', x: 58, z: 0, r: 7, until: 'interact' },
];

export const ACTIVITIES = [
  { id: 'atm-west', kind: 'atm', name: '西区加密 ATM', x: -96, z: 36, r: 3.4 },
  { id: 'atm-beach', kind: 'atm', name: '海滩 ATM', x: 148, z: 206, r: 3.4 },
  { id: 'race', kind: 'race', track: 'neon', name: '地下赛 · 霓虹环线', x: 116, z: 0, r: 9 },
  { id: 'race-beach', kind: 'race', track: 'beach', name: '地下赛 · 海滩折返', x: -150, z: 196, r: 9 },
  { id: 'taxi', kind: 'taxi', name: '夜班出租', x: -28, z: 34, r: 4.5, drop: { x: 120, z: 214 } },
  { id: 'stunt', kind: 'stunt', name: '高速特技门', x: 240, z: -250, r: 10 },
  { id: 'guns', kind: 'guns', name: '武器店', x: 112, z: 52, r: 4.2 },
  { id: 'clothes', kind: 'clothes', name: '服装店', x: -42, z: 86, r: 4.2 },
  { id: 'gallery', kind: 'gallery', name: 'NFT 画廊', x: 64, z: -96, r: 4.4 },
];

const DAILY = [
  { id: 'coins', name: '捡 3 枚路边硬币', need: 3 },
  { id: 'atm', name: '用一次加密 ATM', need: 1 },
  { id: 'race', name: '跑完一场街头竞速', need: 1 },
];

export function dailyFor(day) {
  let hash = 0;
  for (let i = 0; i < day.length; i += 1) hash = (hash * 33 + day.charCodeAt(i)) >>> 0;
  return { ...DAILY[hash % DAILY.length], day, have: 0 };
}

export function levelFromRep(rep) {
  return 1 + Math.floor(Math.max(0, rep) / 80);
}

function buildGraph(roads) {
  const pos = new Map();
  const next = new Map();
  const keyOf = (x, z) => `${Math.round(x)}:${Math.round(z)}`;
  const join = (a, b, w) => {
    if (!next.has(a)) next.set(a, []);
    next.get(a).push({ to: b, w });
  };
  for (const seg of roads) {
    const a = keyOf(seg.ax, seg.az);
    const b = keyOf(seg.bx, seg.bz);
    pos.set(a, { x: seg.ax, z: seg.az });
    pos.set(b, { x: seg.bx, z: seg.bz });
    const w = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az) || 1;
    join(a, b, w);
    join(b, a, w);
  }
  return { pos, next };
}

function nearest(graph, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const [key, p] of graph.pos) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}

export function routeOnRoads(roads, ax, az, bx, bz) {
  if (!roads?.length) return [{ x: ax, z: az }, { x: bx, z: bz }];
  if (!roads.gpsGraph) roads.gpsGraph = buildGraph(roads);
  const graph = roads.gpsGraph;
  const start = nearest(graph, ax, az);
  const goal = nearest(graph, bx, bz);
  if (!start || !goal) return [{ x: ax, z: az }, { x: bx, z: bz }];
  if (start === goal) return [{ x: ax, z: az }, graph.pos.get(goal), { x: bx, z: bz }];
  const goalPos = graph.pos.get(goal);
  const open = [start];
  const came = new Map();
  const score = new Map([[start, 0]]);
  const guess = new Map([[start, Math.hypot(graph.pos.get(start).x - goalPos.x, graph.pos.get(start).z - goalPos.z)]]);
  const seen = new Set();
  let guard = 0;
  while (open.length && guard < 800) {
    guard += 1;
    open.sort((a, b) => (guess.get(a) || 0) - (guess.get(b) || 0));
    const cur = open.shift();
    if (cur === goal) break;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const edge of graph.next.get(cur) || []) {
      const nextScore = (score.get(cur) || 0) + edge.w;
      if (nextScore >= (score.get(edge.to) ?? Infinity)) continue;
      came.set(edge.to, cur);
      score.set(edge.to, nextScore);
      const p = graph.pos.get(edge.to);
      guess.set(edge.to, nextScore + Math.hypot(p.x - goalPos.x, p.z - goalPos.z));
      open.push(edge.to);
    }
  }
  if (!came.has(goal) && start !== goal) return [{ x: ax, z: az }, { x: bx, z: bz }];
  const keys = [goal];
  let walk = goal;
  while (came.has(walk) && keys.length < 80) {
    walk = came.get(walk);
    keys.push(walk);
    if (walk === start) break;
  }
  keys.reverse();
  const points = [{ x: ax, z: az }];
  for (const key of keys) points.push(graph.pos.get(key));
  points.push({ x: bx, z: bz });
  return points;
}
