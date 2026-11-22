import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://gtdvykkdvpzsnhlqlgun.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_i5XDXdgwAMTA0PHFCWTeew_qDAv9-pU';
export const EMAIL_REDIRECT = 'https://0xverybigorange.github.io/gta6-web/';

export const cloud = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const BOARD_COLUMNS = {
  net_worth: 'net_worth',
  reputation: 'reputation',
  level: 'level',
};

export function validNick(raw) {
  const nick = String(raw || '').trim();
  const len = [...nick].length;
  if (len < 2 || len > 16) return '';
  if (!/^[\p{L}\p{N}_]+$/u.test(nick)) return '';
  return nick;
}

export function explainAuthError(error) {
  const msg = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  if (!error) return '';
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) return '请到邮箱点确认链接，然后再登录。';
  if (msg.includes('already registered') || msg.includes('user already')) return '这个邮箱已经注册过，直接登录就行。';
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return '邮箱或密码不对。';
  if (msg.includes('password') && (msg.includes('6') || msg.includes('weak') || msg.includes('short'))) return '密码至少 6 位。';
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) return '这个邮箱格式不对。';
  if (msg.includes('rate limit') || msg.includes('too many')) return '试得太勤了，稍等再来。';
  return '登录没有成功，检查一下邮箱和密码。';
}

export function explainNickError(error) {
  const msg = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  if (msg.includes('duplicate') || msg.includes('23505') || msg.includes('unique')) return '这个昵称已经被占用。';
  if (msg.includes('check') || msg.includes('23514')) return '昵称要 2 到 16 个字，不要带空格。';
  return '昵称没有保存成功。';
}

export async function signUp(email, password, nickname) {
  const { data, error } = await cloud.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: EMAIL_REDIRECT,
      data: { nickname },
    },
  });
  if (error) return { error: explainAuthError(error) };
  return { user: data.user, session: data.session, confirm: !data.session };
}

export async function signIn(email, password) {
  const { data, error } = await cloud.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: explainAuthError(error) };
  return { user: data.user, session: data.session };
}

export async function signOut() {
  await cloud.auth.signOut();
}

export async function fetchProfile(userId) {
  const { data, error } = await cloud.from('gta6_profiles').select('id,nickname,avatar_color').eq('id', userId).maybeSingle();
  if (error) return { error: error.message };
  return { profile: data };
}

export async function createProfile(userId, nickname, avatarColor) {
  const { data, error } = await cloud
    .from('gta6_profiles')
    .insert({ id: userId, nickname, avatar_color: avatarColor })
    .select('id,nickname,avatar_color')
    .single();
  if (error) return { error: explainNickError(error) };
  return { profile: data };
}

export async function fetchScore(userId) {
  const { data, error } = await cloud.from('gta6_scores').select('*').eq('user_id', userId).maybeSingle();
  if (error) return { error: error.message };
  return { score: data };
}

export async function pushScore(row) {
  const { error } = await cloud.from('gta6_scores').upsert(row, { onConflict: 'user_id' });
  return { error: error ? error.message : '' };
}

export async function fetchBoard(tab) {
  const column = BOARD_COLUMNS[tab] || 'net_worth';
  const { data, error } = await cloud
    .from('gta6_leaderboard')
    .select('nickname,avatar_color,net_worth,reputation,level,missions_done,story_chapter')
    .order(column, { ascending: false })
    .limit(50);
  if (error) return { error: error.message, rows: [] };
  return { rows: data || [], column };
}

export async function fetchRank(tab, value) {
  const column = BOARD_COLUMNS[tab] || 'net_worth';
  const { count, error } = await cloud
    .from('gta6_leaderboard')
    .select('nickname', { count: 'exact', head: true })
    .gt(column, value);
  if (error) return { error: error.message, rank: null };
  return { rank: (count || 0) + 1 };
}

export function joinWorld(userId, onPose, onPresence) {
  const channel = cloud.channel('gta6-world', {
    config: {
      presence: { key: userId },
      broadcast: { self: false },
    },
  });
  channel.on('broadcast', { event: 'pose' }, ({ payload }) => {
    if (payload) onPose(payload);
  });
  channel.on('presence', { event: 'sync' }, () => {
    onPresence(channel.presenceState());
  });
  return channel;
}
