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
  model.traverse((obj) => {
    if (hand || !obj.isBone) return;
    if (/right.?hand/i.test(obj.name)) hand = obj;
  });
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
  if (speed > 4.2) actor.play('Run');
  else if (speed > 0.45) actor.play('Walk');
  else actor.play('Idle');
}
