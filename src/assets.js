import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;

const OUTFITS = {
  male: { skin: 0xd7a06a, hair: 0x1b120d, cloth: 0xff6a14, pants: 0x1e2433, mix: 1 },
  female: { skin: 0xe4b48e, hair: 0x4a2a1c, cloth: 0xff4f92, pants: 0x2a1830, mix: 0.92 },
  worker: { skin: 0xc68642, hair: 0x24160f, cloth: 0xe0a020, mix: 0.22 },
  suit: { skin: 0xb98a62, hair: 0x141414, cloth: 0x1c2433, mix: 0.55 },
};

const CLIP_ALIAS = {
  Gun_Shoot: 'Shoot_OneHanded',
  HitRecieve: 'RecieveHit',
  Punch_Right: 'Punch',
};

function paintMaterial(mat, outfit, meshName = '') {
  const next = mat.clone();
  const name = next.name || '';
  if (/skin_darker/i.test(name)) {
    next.color.setHex(outfit.skin);
    next.color.multiplyScalar(0.72);
    next.roughness = 0.48;
    next.metalness = 0;
  } else if (/skin/i.test(name)) {
    next.color.setHex(outfit.skin);
    next.roughness = 0.5;
    next.metalness = 0;
  } else if (/^eye$/i.test(name) || name === 'Eye') {
    next.color.setHex(0x16324a);
    next.emissive?.setHex(0x16324a);
    if ('emissiveIntensity' in next) next.emissiveIntensity = 0.45;
    next.roughness = 0.18;
  } else if (/hair|eyebrow|moustache/i.test(name)) {
    next.color.setHex(outfit.hair);
    next.roughness = 0.48;
    next.metalness = 0;
  } else if (outfit.pants != null && /leg/i.test(meshName)) {
    next.color.setHex(outfit.pants);
    next.roughness = 0.72;
    next.metalness = 0.02;
  } else if (/feet|shoe/i.test(meshName)) {
    next.color.setHex(0x161616);
    next.roughness = 0.6;
    next.metalness = 0.08;
  } else {
    next.color.lerp(new THREE.Color(outfit.cloth), outfit.mix);
    next.roughness = 0.62;
    next.metalness = 0.04;
  }
  if ('envMapIntensity' in next) next.envMapIntensity = 0.45;
  return next;
}

function aliasClips(clips) {
  const seen = new Set();
  const out = [];
  for (const clip of clips) {
    const raw = clip.name.includes('|') ? clip.name.split('|').pop() : clip.name;
    const name = CLIP_ALIAS[raw] || raw;
    if (seen.has(name)) continue;
    seen.add(name);
    const copy = clip.clone();
    copy.name = name;
    copy.tracks = copy.tracks.filter((track) => !track.name.endsWith('.scale'));
    out.push(copy);
  }
  return out;
}

function paintRoot(root, shirt) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
    if (Array.isArray(obj.material)) obj.material = obj.material.map((m) => paintMaterial(m, shirt, obj.name));
    else if (obj.material) obj.material = paintMaterial(obj.material, shirt, obj.name);
  });
}

function tuneStatic(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if ('envMapIntensity' in mat) mat.envMapIntensity = 0.7;
      mat.needsUpdate = true;
    }
  });
}

function groundCenter(root, scale, yaw = 0) {
  root.rotation.set(0, yaw, 0);
  root.scale.setScalar(1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.z);
  const s = scale.axis === 'y' ? scale.value / Math.max(0.001, size.y) : scale.value / Math.max(0.001, longest);
  root.scale.setScalar(s);
  if (scale.axis !== 'y' && size.x > size.z) root.rotation.y += Math.PI / 2;
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= fitted.min.y;
  root.updateMatrixWorld(true);
  const done = new THREE.Box3().setFromObject(root);
  const foot = Math.max(done.max.x - done.min.x, done.max.z - done.min.z);
  if (scale.maxFoot && foot > scale.maxFoot) {
    const shrink = scale.maxFoot / foot;
    root.scale.multiplyScalar(shrink);
    root.position.multiplyScalar(shrink);
    root.updateMatrixWorld(true);
  }
  return root;
}

async function loadGltf(loader, url) {
  return loader.loadAsync(url);
}

export async function loadGameAssets(renderer, onProgress) {
  const loader = new GLTFLoader();
  const jobs = [];
  const peopleFiles = ['male', 'female', 'worker', 'suit'];
  const carFiles = ['sedan', 'suv', 'hatchback-sports', 'police', 'taxi', 'race'];
  const commercial = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c'];
  const suburban = ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e', 'building-type-f'];
  const industrial = ['building-a', 'building-b', 'building-c', 'building-d'];
  const push = (key, url) => jobs.push({ key, url });
  for (const name of peopleFiles) push(`people:${name}`, `${BASE}models/people/${name}.glb`);
  for (const name of carFiles) push(`car:${name}`, `${BASE}models/car/${name}.glb`);
  for (const name of commercial) push(`shop:${name}`, `${BASE}models/commercial/${name}.glb`);
  for (const name of suburban) push(`house:${name}`, `${BASE}models/suburban/${name}.glb`);
  for (const name of industrial) push(`industry:${name}`, `${BASE}models/industrial/${name}.glb`);
  push('boat', `${BASE}models/watercraft/boat-speed-a.glb`);
  push('palm', `${BASE}models/nature/tree_palmDetailedTall.glb`);
  push('palmTall', `${BASE}models/nature/tree_palmTall.glb`);
  push('pistol', `${BASE}models/weapon/pistol.glb`);
  push('light', `${BASE}models/roads/light-curved.glb`);
  push('sign', `${BASE}models/roads/sign-highway.glb`);
  push('awning', `${BASE}models/commercial/detail-awning.glb`);
  push('parasol', `${BASE}models/commercial/detail-parasol-a.glb`);

  const loaded = {};
  let done = 0;
  await Promise.all(jobs.map(async (job) => {
    const gltf = await loadGltf(loader, job.url);
    loaded[job.key] = gltf;
    done += 1;
    onProgress?.(`模型 ${done}/${jobs.length}`);
  }));

  const people = {};
  for (const name of peopleFiles) {
    const gltf = loaded[`people:${name}`];
    const template = SkeletonUtils.clone(gltf.scene);
    paintRoot(template, OUTFITS[name]);
    groundCenter(template, { axis: 'y', value: 1.84 });
    people[name] = { template, clips: aliasClips(gltf.animations) };
  }

  const cars = {};
  for (const name of carFiles) {
    const root = loaded[`car:${name}`].scene.clone(true);
    tuneStatic(root);
    groundCenter(root, { axis: 'z', value: name === 'suv' ? 4.9 : 4.5 });
    cars[name] = root;
  }

  const fitBuilding = (gltf, height, foot) => {
    const root = gltf.scene.clone(true);
    tuneStatic(root);
    groundCenter(root, { axis: 'y', value: height, maxFoot: foot });
    return root;
  };

  const shops = commercial.map((name) => fitBuilding(loaded[`shop:${name}`], name.includes('skyscraper') ? 46 : 13, name.includes('skyscraper') ? 18 : 15));
  const towers = shops.filter((_, i) => commercial[i].includes('skyscraper'));
  const blocks = shops.filter((_, i) => !commercial[i].includes('skyscraper'));
  const houses = suburban.map((name) => fitBuilding(loaded[`house:${name}`], 8.2, 13));
  const industry = industrial.map((name) => fitBuilding(loaded[`industry:${name}`], 12, 20));

  const boat = loaded.boat.scene.clone(true);
  tuneStatic(boat);
  groundCenter(boat, { axis: 'z', value: 6.2 });

  const palm = loaded.palm.scene.clone(true);
  tuneStatic(palm);
  groundCenter(palm, { axis: 'y', value: 12 });
  const palmTall = loaded.palmTall.scene.clone(true);
  tuneStatic(palmTall);
  groundCenter(palmTall, { axis: 'y', value: 14 });

  const pistol = loaded.pistol.scene.clone(true);
  tuneStatic(pistol);
  groundCenter(pistol, { axis: 'z', value: 0.32 });

  const light = loaded.light.scene.clone(true);
  tuneStatic(light);
  groundCenter(light, { axis: 'y', value: 7.5 });
  const sign = loaded.sign.scene.clone(true);
  tuneStatic(sign);
  groundCenter(sign, { axis: 'y', value: 4.2 });
  const awning = loaded.awning.scene.clone(true);
  tuneStatic(awning);
  groundCenter(awning, { axis: 'z', value: 3.2 });
  const parasol = loaded.parasol.scene.clone(true);
  tuneStatic(parasol);
  groundCenter(parasol, { axis: 'y', value: 2.6 });

  let environment = null;
  try {
    onProgress?.('天空');
    const hdr = await new RGBELoader().loadAsync(`${BASE}models/sky/venice_sunset_1k.hdr`);
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
  } catch {
    environment = null;
  }

  return {
    people,
    cars,
    boat,
    towers,
    blocks,
    houses,
    industry,
    palm,
    palmTall,
    pistol,
    light,
    sign,
    awning,
    parasol,
    environment,
  };
}
