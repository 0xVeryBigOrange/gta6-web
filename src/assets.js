import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL;

const OUTFITS = {
  male: { skin: 0xd7a06a, hair: 0x1b120d, cloth: 0xff6a14, pants: 0x1e2433 },
  female: { skin: 0xe8b898, hair: 0x4a2a1c, cloth: 0xff4f92, pants: 0x2a1830 },
  worker: { skin: 0xc68642, hair: 0x24160f, cloth: 0xe0a020, pants: 0x314028 },
  suit: { skin: 0xc49a74, hair: 0x141414, cloth: 0x1c3148, pants: 0x141820 },
  classy: { skin: 0xc9a07a, hair: 0x9a9a9a, cloth: 0xf2f2f4, pants: 0x1a1c22 },
  suitf: { skin: 0xe0b090, hair: 0x111111, cloth: 0xf4f0ea, pants: 0xc6a15a },
  casual2: { skin: 0xf0c2a0, hair: 0x6a3418, cloth: 0xffe14a, pants: 0xff4fad },
};

const CLIP_ALIAS = {
  Gun_Shoot: 'Shoot_OneHanded',
  HitRecieve: 'RecieveHit',
  Punch_Right: 'Punch',
};

function addTriplanarUv(geometry) {
  if (!geometry || geometry.getAttribute('uv')) return;
  const pos = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!pos) return;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = normal ? Math.abs(normal.getX(i)) : 0;
    const ny = normal ? Math.abs(normal.getY(i)) : 1;
    const nz = normal ? Math.abs(normal.getZ(i)) : 0;
    let u = x;
    let v = y;
    if (nx >= ny && nx >= nz) {
      u = z;
      v = y;
    } else if (nz >= ny) {
      u = x;
      v = y;
    } else {
      u = x;
      v = z;
    }
    uv[i * 2] = u * 3.1;
    uv[i * 2 + 1] = v * 3.1;
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

function paintMaterial(mat, outfit, meshName = '', maps = {}) {
  const next = mat.clone();
  const name = next.name || '';
  const mesh = meshName || '';
  if (/skin_darker/i.test(name)) {
    next.color.setHex(outfit.skin);
    next.color.multiplyScalar(0.72);
    next.roughness = 0.58;
    next.metalness = 0;
  } else if (/skin|face/i.test(name)) {
    next.color.setHex(outfit.skin);
    if (/face/i.test(name)) next.color.offsetHSL(0, 0.03, 0.05);
    next.roughness = 0.58;
    next.metalness = 0;
  } else if (/^eye$/i.test(name) || name === 'Eye') {
    next.color.setHex(0x16324a);
    next.emissive?.setHex(0x16324a);
    if ('emissiveIntensity' in next) next.emissiveIntensity = 0.45;
    next.roughness = 0.18;
  } else if (/hair|eyebrow|moustache/i.test(name)) {
    next.color.setHex(outfit.hair);
    next.roughness = 0.4;
    next.metalness = 0.06;
  } else if (/belt|shoe|feet/i.test(name) || /feet|shoe/i.test(mesh)) {
    next.color.setHex(0x1a1a1a);
    next.roughness = 0.48;
    next.metalness = 0.18;
  } else if (/pant/i.test(name) || /leg/i.test(mesh)) {
    next.color.setHex(outfit.pants ?? 0x1e2433);
    next.map = maps.denim || null;
    next.roughness = 0.84;
    next.metalness = 0.02;
  } else if (/shirt|vest|jacket/i.test(name)) {
    next.color.setHex(outfit.cloth);
    next.map = maps.cloth || null;
    if (/vest/i.test(name)) next.color.multiplyScalar(0.82);
    next.roughness = 0.74;
    next.metalness = 0.02;
  } else if (/black/i.test(name)) {
    next.color.setHex(outfit.cloth);
    next.color.multiplyScalar(0.45);
    next.map = maps.cloth || null;
    next.roughness = 0.62;
    next.metalness = 0.04;
  }
  if ('envMapIntensity' in next) next.envMapIntensity = next.map ? 0.28 : 0.4;
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
    for (const track of copy.tracks) {
      if (!/hips|root/i.test(track.name) || !track.name.endsWith('.position')) continue;
      const values = track.values;
      for (let i = 0; i < values.length; i += 3) {
        values[i] = 0;
        values[i + 2] = 0;
      }
    }
    out.push(copy);
  }
  return out;
}

function paintRoot(root, shirt, maps = {}) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
    addTriplanarUv(obj.geometry);
    if (Array.isArray(obj.material)) obj.material = obj.material.map((m) => paintMaterial(m, shirt, obj.name, maps));
    else if (obj.material) obj.material = paintMaterial(obj.material, shirt, obj.name, maps);
  });
}

function tuneStatic(root, veg = false) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (veg) {
        mat.roughness = 0.92;
        mat.metalness = 0;
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.22;
      } else {
        mat.roughness = Math.min(mat.roughness ?? 0.6, 0.62);
        mat.metalness = Math.max(mat.metalness ?? 0, 0.06);
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.85;
      }
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

const EXTRA_PEOPLE = ['female', 'worker', 'suit', 'classy', 'suitf', 'casual2'];

export async function loadExtraPeople(assets) {
  const loader = new GLTFLoader();
  await Promise.all(EXTRA_PEOPLE.map(async (name) => {
    if (assets.people[name]) return;
    const gltf = await loadGltf(loader, `${BASE}models/people/${name}.glb`);
    const template = SkeletonUtils.clone(gltf.scene);
    paintRoot(template, OUTFITS[name], assets.clothMaps || {});
    groundCenter(template, { axis: 'y', value: 1.84 });
    assets.people[name] = { template, clips: aliasClips(gltf.animations) };
  }));
}

export async function loadGameAssets(renderer, onProgress, quality = 'high') {
  const loader = new GLTFLoader();
  const jobs = [];
  const peopleFiles = ['male'];
  const carFiles = ['sedan', 'suv', 'hatchback-sports', 'police', 'taxi', 'race', 'sedan-sports'];
  const push = (key, url) => jobs.push({ key, url });
  for (const name of peopleFiles) push(`people:${name}`, `${BASE}models/people/${name}.glb`);
  for (const name of carFiles) push(`car:${name}`, `${BASE}models/car/${name}.glb`);
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

  const aniso = quality === 'low' ? 2 : Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 4);
  const texLoader = new THREE.TextureLoader();
  const loadSurface = async (url, colorSpace) => {
    try {
      const tex = await texLoader.loadAsync(url);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = colorSpace;
      tex.anisotropy = aniso;
      return tex;
    } catch {
      return null;
    }
  };
  onProgress?.('地面');
  const [asphalt, asphaltNor, sand, concrete, grass, plaster, cloth, denim] = await Promise.all([
    loadSurface(`${BASE}textures/asphalt.jpg`, THREE.SRGBColorSpace),
    loadSurface(`${BASE}textures/asphalt_nor.jpg`, THREE.NoColorSpace),
    loadSurface(`${BASE}textures/sand.jpg`, THREE.SRGBColorSpace),
    loadSurface(`${BASE}textures/concrete.jpg`, THREE.SRGBColorSpace),
    loadSurface(`${BASE}textures/grass.jpg`, THREE.SRGBColorSpace),
    loadSurface(`${BASE}textures/plaster.jpg`, THREE.SRGBColorSpace),
    loadSurface(`${BASE}textures/cloth.jpg`, THREE.SRGBColorSpace),
    loadSurface(`${BASE}textures/denim.jpg`, THREE.SRGBColorSpace),
  ]);
  if (cloth) cloth.repeat.set(1, 1);
  if (denim) denim.repeat.set(1, 1);
  const clothMaps = { cloth, denim };

  const people = {};
  for (const name of peopleFiles) {
    const gltf = loaded[`people:${name}`];
    const template = SkeletonUtils.clone(gltf.scene);
    paintRoot(template, OUTFITS[name], clothMaps);
    groundCenter(template, { axis: 'y', value: 1.84 });
    people[name] = { template, clips: aliasClips(gltf.animations) };
  }

  const cars = {};
  for (const name of carFiles) {
    const root = loaded[`car:${name}`].scene.clone(true);
    tuneStatic(root);
    const length = name === 'suv' ? 4.9 : name === 'sedan-sports' ? 4.7 : 4.5;
    groundCenter(root, { axis: 'z', value: length });
    cars[name] = root;
  }

  const boat = loaded.boat.scene.clone(true);
  tuneStatic(boat);
  groundCenter(boat, { axis: 'z', value: 6.2 });

  const palm = loaded.palm.scene.clone(true);
  tuneStatic(palm, true);
  groundCenter(palm, { axis: 'y', value: 12 });
  const palmTall = loaded.palmTall.scene.clone(true);
  tuneStatic(palmTall, true);
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
    let hdr;
    try {
      hdr = await new RGBELoader().loadAsync(`${BASE}models/sky/miami_day_1k.hdr`);
    } catch {
      hdr = await new RGBELoader().loadAsync(`${BASE}models/sky/venice_sunset_1k.hdr`);
    }
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
    surfaces: { asphalt, asphaltNor, sand, concrete, grass, plaster },
    clothMaps,
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
