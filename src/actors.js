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
