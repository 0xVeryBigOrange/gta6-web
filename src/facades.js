import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STYLES = [
  { wall: '#f6d7c4', trim: '#c4564a', glass: '#173044', shop: '#4a2430' },
  { wall: '#f4efe2', trim: '#c9844a', glass: '#1d3c46', shop: '#3d3428' },
  { wall: '#d5ebe6', trim: '#d36b58', glass: '#12383c', shop: '#1d3c40' },
  { wall: '#f3e4ee', trim: '#8a3d5c', glass: '#2a1830', shop: '#3a2030' },
  { wall: '#efe4cc', trim: '#1f6f6a', glass: '#102830', shop: '#243430' },
  { wall: '#e7eef6', trim: '#2c4f86', glass: '#101e33', shop: '#1a2740' },
];

const ADS = [
  ['汪言币', '社区即信仰'],
  ['柜姐所', '充值通道开着'],
  ['ORNG', '海滩夜光'],
  ['橙爪', '今晚不梭哈'],
  ['格氏假日', '笔记还没合上'],
];

const glowMats = [];

export function trackGlow(mat, base, gain) {
  mat.userData.glowBase = base;
  mat.userData.glowGain = gain;
  mat.emissiveIntensity = base;
  glowMats.push(mat);
  return mat;
}

export function applyNight(night) {
  const t = Math.max(0, Math.min(1, night));
  for (const mat of glowMats) {
    mat.emissiveIntensity = mat.userData.glowBase + t * mat.userData.glowGain;
  }
}

function canvasTex(canvas, anisotropy) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

function paintFacade(style, plaster, anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, 256, 512);
  if (plaster) {
    ctx.globalAlpha = 0.28;
    ctx.drawImage(plaster, 0, 0, 256, 512);
    ctx.globalAlpha = 1;
  }
  const emit = document.createElement('canvas');
  emit.width = 256;
  emit.height = 512;
  const eg = emit.getContext('2d');
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, 256, 512);
  const floors = 8;
  const fh = 512 / floors;
  for (let f = 0; f < floors; f += 1) {
    const y = f * fh;
    ctx.fillStyle = style.trim;
    ctx.fillRect(0, y, 256, 5);
    for (let k = 0; k < 4; k += 1) {
      const x = 16 + k * 60;
      const wy = y + 14;
      const ww = 42;
      const wh = fh - 26;
      ctx.fillStyle = style.glass;
      ctx.fillRect(x, wy, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x + 3, wy + 3, 7, wh - 8);
      ctx.strokeStyle = style.trim;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(x + ww / 2, wy);
      ctx.lineTo(x + ww / 2, wy + wh);
      ctx.moveTo(x, wy + wh * 0.42);
      ctx.lineTo(x + ww, wy + wh * 0.42);
      ctx.stroke();
      if ((f * 5 + k * 3) % 4 !== 0) {
        const lit = 150 + ((f * 17 + k * 29) % 80);
        eg.fillStyle = `rgb(${lit}, ${Math.round(lit * 0.78)}, ${Math.round(lit * 0.45)})`;
        eg.fillRect(x + 4, wy + 4, ww - 8, wh - 8);
      }
    }
  }
  return {
    map: canvasTex(canvas, anisotropy),
    emissive: canvasTex(emit, anisotropy),
  };
}

function paintShop(style, anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = style.shop;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = style.trim;
  ctx.fillRect(0, 0, 256, 8);
  ctx.fillStyle = style.glass;
  ctx.fillRect(18, 22, 96, 86);
  ctx.fillRect(142, 22, 96, 86);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(24, 28, 14, 74);
  ctx.fillRect(148, 28, 14, 74);
  const emit = document.createElement('canvas');
  emit.width = 256;
  emit.height = 128;
  const eg = emit.getContext('2d');
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, 256, 128);
  eg.fillStyle = '#ffd2a0';
  eg.fillRect(22, 26, 88, 78);
  eg.fillRect(146, 26, 88, 78);
  return { map: canvasTex(canvas, anisotropy), emissive: canvasTex(emit, anisotropy) };
}

function paintRoof(anisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b85a45';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#8d3d32';
  for (let y = 0; y < 128; y += 10) ctx.fillRect(0, y, 128, 3);
  const tex = canvasTex(canvas, anisotropy);
  return tex;
}

let styles = null;
let roofTex = null;
let anisotropy = 4;

export function initFacades(plasterImage, aniso = 4) {
  anisotropy = aniso;
  roofTex = paintRoof(aniso);
  styles = STYLES.map((style) => ({
    ...style,
    hex: style.wall,
    trimHex: style.trim,
    wall: paintFacade(style, plasterImage, aniso),
    shop: paintShop(style, aniso),
    trim: new THREE.MeshStandardMaterial({
      color: style.trim,
      roughness: 0.55,
      metalness: 0.08,
      envMapIntensity: 0.4,
    }),
    roof: new THREE.MeshStandardMaterial({
      map: roofTex,
      roughness: 0.8,
      metalness: 0.02,
      color: 0xffffff,
    }),
  }));
}

function wallMaterial(style, w, h) {
  const map = style.wall.map.clone();
  const emissive = style.wall.emissive.clone();
  map.repeat.set(Math.max(1, w / 7.5), Math.max(1, h / 6.5));
  emissive.repeat.copy(map.repeat);
  map.needsUpdate = true;
  emissive.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: emissive,
    emissive: 0xffe2c0,
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.4,
  });
  return trackGlow(mat, 0.08, 0.85);
}

function shopMaterial(style, w) {
  const map = style.shop.map.clone();
  const emissive = style.shop.emissive.clone();
  map.repeat.set(Math.max(1, w / 8), 1);
  emissive.repeat.copy(map.repeat);
  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: emissive,
    emissive: 0xfff0d8,
    roughness: 0.45,
    metalness: 0.08,
    envMapIntensity: 0.55,
  });
  return trackGlow(mat, 0.25, 1.1);
}

function addBox(group, w, h, d, y, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addSign(group, style, w, y, z, rng) {
  const ad = ADS[Math.floor(rng() * ADS.length)];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14080f';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = style.trimHex;
  ctx.fillRect(0, 0, 512, 8);
  ctx.fillRect(0, 152, 512, 8);
  ctx.fillStyle = '#ffe7c2';
  ctx.font = '700 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ad[0], 256, 78);
  ctx.fillStyle = style.trimHex;
  ctx.font = '32px sans-serif';
  ctx.fillText(ad[1], 256, 124);
  const tex = canvasTex(canvas, anisotropy);
  const mat = trackGlow(new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    roughness: 0.35,
    metalness: 0.05,
  }), 0.7, 1.8);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 7.5), 2.1), mat);
  board.position.set(0, y, z);
  group.add(board);
}

export function makeBuilding(kind, rng) {
  const style = styles[Math.floor(rng() * styles.length)];
  const group = new THREE.Group();
  group.userData.tint = style.hex;
  if (kind === 'tower') {
    const w = 14 + rng() * 4;
    const d = 12 + rng() * 4;
    const h = 32 + rng() * 22;
    addBox(group, w, h, d, h / 2, wallMaterial(style, w, h));
    addBox(group, w * 0.68, h * 0.22, d * 0.68, h + h * 0.11, wallMaterial(style, w * 0.7, h * 0.22));
    addBox(group, w * 0.38, 2.4, d * 0.38, h + h * 0.22 + 1.3, style.trim);
    addBox(group, w + 0.5, 0.45, d + 0.5, h + 0.2, style.trim);
    if (rng() > 0.35) addSign(group, style, w, h * 0.72, d / 2 + 0.08, rng);
  } else if (kind === 'house') {
    const w = 11 + rng() * 3;
    const d = 9 + rng() * 2;
    const h = 6.5 + rng() * 2.2;
    addBox(group, w, h, d, h / 2, wallMaterial(style, w, h));
    addBox(group, w + 0.7, 0.4, d + 0.7, h + 0.15, style.trim);
    addBox(group, w * 0.92, 0.35, d * 0.92, h + 0.45, style.roof);
    addBox(group, 0.7, 1.6, 0.7, h + 1.3, style.trim);
    const front = addBox(group, w * 0.72, 2.2, 0.12, 1.4, shopMaterial(style, w));
    front.position.z = d / 2 + 0.04;
  } else if (kind === 'industry') {
    const w = 18 + rng() * 8;
    const d = 14 + rng() * 4;
    const h = 8 + rng() * 4;
    const mat = wallMaterial(style, w, h);
    mat.color.set('#c5c8ce');
    addBox(group, w, h, d, h / 2, mat);
    addBox(group, 1.4, h + 4, 1.4, (h + 4) / 2, style.trim);
    addBox(group, w, 0.35, d + 0.4, h + 0.1, style.roof);
  } else {
    const w = 16 + rng() * 6;
    const d = 13 + rng() * 4;
    const h = 11 + rng() * 8;
    addBox(group, w + 0.4, 3.3, d + 0.4, 1.65, shopMaterial(style, w));
    addBox(group, w, h, d, 3.3 + h / 2, wallMaterial(style, w, h));
    addBox(group, w + 0.8, 0.55, d + 0.8, 3.3 + h + 0.25, style.trim);
    addBox(group, w * 0.55, 1.4, d * 0.55, 3.3 + h + 1.15, style.trim);
    const floors = Math.floor(h / 3.2);
    for (let i = 1; i < floors; i += 2) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.1, 0.65), style.trim);
      slab.position.set(0, 3.5 + i * 3.1, d / 2 + 0.2);
      slab.castShadow = true;
      group.add(slab);
    }
    if (rng() > 0.4) addSign(group, style, w, 3.3 + h * 0.62, d / 2 + 0.28, rng);
  }
  collapseBuilding(group);
  return group;
}

function collapseBuilding(group) {
  const buckets = new Map();
  const meshes = [];
  group.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj);
  });
  for (const mesh of meshes) {
    const list = buckets.get(mesh.material) || [];
    list.push(mesh);
    buckets.set(mesh.material, list);
  }
  for (const [material, list] of buckets) {
    if (list.length < 2) continue;
    const geos = [];
    for (const mesh of list) {
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrix);
      geos.push(geo);
    }
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (const old of list) old.removeFromParent();
    group.add(mesh);
    for (const geo of geos) geo.dispose();
  }
}
