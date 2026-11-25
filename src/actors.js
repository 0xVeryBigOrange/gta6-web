import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function createActor(pack) {
  const model = SkeletonUtils.clone(pack.template);
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = true;
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of pack.clips) {
    actions[clip.name] = mixer.clipAction(clip);
  }
  let hand = null;
  let arm = null;
  model.traverse((obj) => {
    if (!obj.isBone) return;
    if (/fist\.r|hand\.r|right.?hand/i.test(obj.name)) hand = obj;
    else if (/lowerarm\.r|lowerarmr/i.test(obj.name)) arm = obj;
  });
  hand = hand || arm;
  return {
    model,
    mixer,
    actions,
    hand,
    current: '',
    play(name, opts = {}) {
      const next = actions[name] || actions.Idle || actions.Walk;
      if (!next) return;
      const once = !!opts.once;
      if (this.current === name && !once) return;
      const prev = actions[this.current];
      if (prev && prev !== next) prev.fadeOut(opts.fade ?? 0.16);
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = !!opts.hold;
      next.fadeIn(opts.fade ?? 0.16).play();
      this.current = name;
    },
  };
}

function findBone(model, pattern) {
  let found = null;
  model.traverse((obj) => {
    if (obj.isBone && pattern.test(obj.name)) found = obj;
  });
  return found;
}

const CAPS = [0x243044, 0xff6a14, 0xf4f1ea, 0x1f6f86, 0xc23b4e, 0x2f6b3a];

function clothMat(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.04 });
  return mat;
}

/** Hats and bags on pedestrians. No extra downloads; the mesh follows the head bone. */
export function dressPed(actor, index) {
  const kind = index % 5;
  const color = CAPS[index % CAPS.length];
  if (kind === 0 || kind === 1) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      clothMat(color),
    );
    cap.castShadow = false;
    cap.scale.set(1.2, 0.62, 1.2);
    const head = findBone(actor.model, /^Head$/);
    if (head) {
      cap.position.set(0, 0.1, 0.02);
      head.add(cap);
    } else {
      cap.position.set(0, 1.66, 0.02);
      actor.model.add(cap);
    }
    return;
  }
  if (kind === 2) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.1), clothMat(color));
    bag.castShadow = false;
    bag.position.set(0.02, 1.16, -0.18);
    actor.model.add(bag);
  }
}

/** Colored vest and cap so a turf crew reads at a glance. Material is returned for recolor. */
export function dressGang(actor, color) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.06,
    emissive: color,
    emissiveIntensity: 0.45,
  });
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.38), mat);
  vest.castShadow = false;
  vest.position.set(0, 1.16, 0.1);
  actor.model.add(vest);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    mat,
  );
  cap.castShadow = false;
  cap.scale.set(1.35, 0.72, 1.35);
  const head = findBone(actor.model, /^Head$/);
  if (head) {
    cap.position.set(0, 0.11, 0.02);
    head.add(cap);
  } else {
    cap.position.set(0, 1.7, 0.02);
    actor.model.add(cap);
  }
  return mat;
}

export function locomotion(actor, speed, lock) {
  if (lock > 0) return;
  if (speed > 6.5) {
    actor.play('Run');
    actor.actions.Run?.setEffectiveTimeScale(1.08);
  } else if (speed > 0.7) {
    actor.play('Walk');
    const scale = Math.min(1.55, Math.max(0.85, speed / 3.3));
    actor.actions.Walk?.setEffectiveTimeScale(scale);
  } else actor.play('Idle');
}
