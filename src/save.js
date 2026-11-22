import { SAVE_KEY } from './config.js';

export function slotKey(userId) {
  return userId ? `${SAVE_KEY}:${userId}` : SAVE_KEY;
}

export function loadSave(userId = null) {
  try {
    const raw = localStorage.getItem(slotKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 2 || !data.bal) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data, userId = null) {
  localStorage.setItem(slotKey(userId), JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
