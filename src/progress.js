/** Daily quests and achievements. New save fields only; the legacy `daily` object stays untouched. */

export const QUEST_POOL = [
  { id: 'coins', name: '捡 3 枚路边硬币', need: 3, reward: 500, track: 'coins' },
  { id: 'atm', name: '用一次加密 ATM', need: 1, reward: 450, track: 'atm' },
  { id: 'race', name: '跑完一场街头竞速', need: 1, reward: 900, track: 'race' },
  { id: 'racewin', name: '赢下一场地下赛', need: 1, reward: 1100, track: 'raceWin' },
  { id: 'drive', name: '开车或骑行 500 米', need: 500, reward: 650, track: 'drive' },
  { id: 'talk', name: '和故事人物说一次话', need: 1, reward: 400, track: 'talk' },
  { id: 'trade', name: '在交易所成交一次', need: 1, reward: 600, track: 'trade' },
  { id: 'job', name: '做完一件路边差事', need: 1, reward: 550, track: 'job' },
  { id: 'clear', name: '甩掉一次通缉', need: 1, reward: 800, track: 'clear' },
];

export const ACHIEVEMENTS = [
  { id: 'first_coin', name: '第一枚零钱', desc: '捡到路边的币', stat: 'coins', need: 1, reward: 200 },
  { id: 'coin_purse', name: '路边金库', desc: '累计捡到 12 枚硬币', stat: 'coins', need: 12, reward: 800 },
  { id: 'atm_run', name: 'ATM 常客', desc: '使用加密 ATM 3 次', stat: 'atms', need: 3, reward: 400 },
  { id: 'wheel', name: '黄环车手', desc: '跑完一场街头竞速', stat: 'races', need: 1, reward: 500 },
  { id: 'champ', name: '夜赛冠军', desc: '赢下一场地下赛', stat: 'raceWins', need: 1, reward: 900 },
  { id: 'hotlap', name: '标杆圈速', desc: '把一条赛道跑进标杆时间', stat: 'hotlaps', need: 1, reward: 1200 },
  { id: 'cab', name: '夜班司机', desc: '送完一单出租', stat: 'taxis', need: 1, reward: 400 },
  { id: 'desk', name: '柜台上的人', desc: '在交易所成交 3 次', stat: 'trades', need: 3, reward: 700 },
  { id: 'miles', name: '城里的路', desc: '累计开车或骑行 2000 米', stat: 'drives', need: 2000, reward: 800 },
  { id: 'clean', name: '甩掉星星', desc: '累计摆脱通缉 3 次', stat: 'clears', need: 3, reward: 600 },
  { id: 'heard', name: '故事听到一半', desc: '完成 4 章主线', stat: 'chapters', need: 4, reward: 1000 },
  { id: 'vault', name: '金库空了', desc: '完成交易所金库抢劫', stat: 'vaults', need: 1, reward: 1500 },
  { id: 'finale', name: '九章之后', desc: '完成全部九章主线', stat: 'chapters', need: 9, reward: 2000 },
  { id: 'streak', name: '今日三单', desc: '同一天做完 3 个每日任务', stat: 'fullDays', need: 1, reward: 600 },
  { id: 'rep', name: '声望起来了', desc: '升到 5 级', stat: 'level', need: 5, reward: 900 },
];

const TRACK_STAT = {
  coins: 'coins',
  atm: 'atms',
  race: 'races',
  raceWin: 'raceWins',
  hotlap: 'hotlaps',
  drive: 'drives',
  talk: 'talks',
  trade: 'trades',
  job: 'jobs',
  clear: 'clears',
  taxi: 'taxis',
  vault: 'vaults',
};

const FULL_DAY_BONUS = 800;

export function emptyStats() {
  return {
    coins: 0,
    atms: 0,
    races: 0,
    raceWins: 0,
    hotlaps: 0,
    drives: 0,
    talks: 0,
    trades: 0,
    jobs: 0,
    clears: 0,
    taxis: 0,
    vaults: 0,
    chapters: 0,
    fullDays: 0,
  };
}

export function gameDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function questById(id) {
  return QUEST_POOL.find((item) => item.id === id) || null;
}

export function pickQuestIds(day) {
  let hash = 2166136261;
  for (let i = 0; i < day.length; i += 1) hash = Math.imul(hash ^ day.charCodeAt(i), 16777619) >>> 0;
  const ids = [];
  let cursor = hash % QUEST_POOL.length;
  let guard = 0;
  while (ids.length < 3 && guard < 24) {
    const id = QUEST_POOL[cursor % QUEST_POOL.length].id;
    if (!ids.includes(id)) ids.push(id);
    cursor += 1 + (hash % 3);
    guard += 1;
  }
  return ids;
}

export function freshQuests(day = gameDay()) {
  return {
    day,
    fullPaid: false,
    items: pickQuestIds(day).map((id) => ({ id, have: 0, paid: false })),
  };
}

function saneQuests(raw, day) {
  if (!raw || raw.day !== day || !Array.isArray(raw.items) || raw.items.length !== 3) return null;
  const items = [];
  for (const item of raw.items) {
    const def = questById(item?.id);
    if (!def || items.some((have) => have.id === def.id)) return null;
    items.push({
      id: def.id,
      have: Math.max(0, Math.min(def.need, Number(item.have) || 0)),
      paid: !!item.paid,
    });
  }
  return { day, fullPaid: !!raw.fullPaid, items };
}

export function restoreProgress(data) {
  const stats = { ...emptyStats(), ...(data?.stats && typeof data.stats === 'object' ? data.stats : {}) };
  for (const key of Object.keys(emptyStats())) {
    const n = Number(stats[key]);
    stats[key] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  stats.chapters = Math.max(stats.chapters, Number(data?.storyChapter) || 0);
  const known = new Set(ACHIEVEMENTS.map((item) => item.id));
  const achievements = Array.isArray(data?.achievements)
    ? data.achievements.filter((id) => known.has(id))
    : [];
  const quests = saneQuests(data?.quests, gameDay()) || freshQuests();
  return { stats, achievements, quests };
}

export function grantProgress(progress, track, amount = 0, ctx = {}) {
  const gained = [];
  let usd = 0;
  let changed = false;
  if (ctx.chapters != null) {
    const next = Math.max(progress.stats.chapters || 0, ctx.chapters || 0);
    if (next !== progress.stats.chapters) {
      progress.stats.chapters = next;
      changed = true;
    }
  }
  const statKey = track ? TRACK_STAT[track] : null;
  if (statKey && amount > 0) {
    progress.stats[statKey] = (progress.stats[statKey] || 0) + amount;
    changed = true;
    for (const item of progress.quests.items) {
      const def = questById(item.id);
      if (!def || def.track !== track || item.paid) continue;
      const before = item.have;
      item.have = Math.min(def.need, item.have + amount);
      if (item.have !== before) changed = true;
      if (item.have >= def.need && !item.paid) {
        item.paid = true;
        usd += def.reward;
        gained.push({ kind: 'quest', name: def.name, reward: def.reward });
      }
    }
    if (!progress.quests.fullPaid && progress.quests.items.every((item) => item.paid)) {
      progress.quests.fullPaid = true;
      progress.stats.fullDays = (progress.stats.fullDays || 0) + 1;
      usd += FULL_DAY_BONUS;
      gained.push({ kind: 'quest', name: '今日三单齐了', reward: FULL_DAY_BONUS });
    }
  }
  const level = ctx.level || 1;
  for (const ach of ACHIEVEMENTS) {
    if (progress.achievements.includes(ach.id)) continue;
    const value = ach.stat === 'level' ? level : (progress.stats[ach.stat] || 0);
    if (value < ach.need) continue;
    progress.achievements.push(ach.id);
    usd += ach.reward;
    gained.push({ kind: 'ach', name: ach.name, reward: ach.reward });
    changed = true;
  }
  return { usd, gained, changed };
}
