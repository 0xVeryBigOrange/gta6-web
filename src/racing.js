/** Street races. Checkpoints sit on the road grid. Times are seconds. */

export const TRACKS = [
  {
    id: 'neon',
    activity: 'race',
    name: '霓虹环线',
    blurb: '市中心一圈，跟着黄环走',
    start: { x: 116, z: 0, yaw: Math.PI / 2 },
    cruise: 31,
    target: 22,
    prize: { win: 1800, place: 800 },
    gates: [
      { x: 174, z: 0 },
      { x: 174, z: -58 },
      { x: 174, z: -116 },
      { x: 116, z: -116 },
      { x: 58, z: -116 },
      { x: 58, z: -58 },
      { x: 58, z: 0 },
      { x: 116, z: 0 },
    ],
  },
  {
    id: 'beach',
    activity: 'race-beach',
    name: '海滩折返',
    blurb: '沿海滩大道冲出去再折回来',
    start: { x: -150, z: 196, yaw: Math.PI / 2 },
    cruise: 33,
    target: 48,
    prize: { win: 2400, place: 1000 },
    gates: [
      { x: -40, z: 196 },
      { x: 80, z: 196 },
      { x: 200, z: 196 },
      { x: 320, z: 196 },
      { x: 440, z: 196 },
      { x: 320, z: 196 },
      { x: 200, z: 196 },
      { x: 80, z: 196 },
      { x: -40, z: 196 },
      { x: -150, z: 196 },
    ],
  },
];

export function trackById(id) {
  return TRACKS.find((track) => track.id === id) || null;
}

export function formatRaceTime(seconds) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const rest = (safe - mins * 60).toFixed(1);
  if (mins <= 0) return `${rest}s`;
  return `${mins}:${rest.padStart(4, '0')}`;
}

export function readRaceBests(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const track of TRACKS) {
    const n = Number(raw[track.id]);
    if (Number.isFinite(n) && n > 0 && n < 900) out[track.id] = Math.round(n * 10) / 10;
  }
  return out;
}

/** Drive an AI car toward the next gate. `racer.i` is the next gate index. */
export function stepRacer(racer, dt) {
  const target = racer.gates[racer.i];
  if (!target || racer.done) return;
  const dx = target.x - racer.x;
  const dz = target.z - racer.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const want = Math.atan2(dx, dz);
  let diff = want - racer.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  racer.yaw += Math.max(-1, Math.min(1, diff * 3.2)) * dt * 2.2;
  const corner = Math.min(1, Math.abs(diff) / 0.85);
  const speed = racer.cruise * (1 - corner * 0.42);
  racer.speed = speed;
  racer.x += Math.sin(racer.yaw) * speed * dt;
  racer.z += Math.cos(racer.yaw) * speed * dt;
  racer.yaw = racer.yaw;
  if (dist < 8.5) {
    racer.i += 1;
    if (racer.i >= racer.gates.length) racer.done = true;
  }
}
