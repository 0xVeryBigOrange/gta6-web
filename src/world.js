import * as THREE from 'three';
import { PIERS, WORLD, inWater } from './config.js';
import { mulberry32 } from './util.js';
import { applyNight, initFacades, makeBuilding, trackGlow } from './facades.js';

function pushRibbon(positions, normals, uvs, ax, az, bx, bz, half, y, tile) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * half;
  const nz = (dx / len) * half;
  const uLen = len / tile;
  const vSpan = (half * 2) / tile;
  const corners = [
    [ax + nx, y, az + nz, 0, 0],
    [bx + nx, y, bz + nz, uLen, 0],
    [bx - nx, y, bz - nz, uLen, vSpan],
    [ax - nx, y, az - nz, 0, vSpan],
  ];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const c = corners[i];
    positions.push(c[0], c[1], c[2]);
    normals.push(0, 1, 0);
    uvs.push(c[3], c[4]);
  }
}

function meshFrom(material, draw) {
  const positions = [];
  const normals = [];
  const uvs = [];
  draw(positions, normals, uvs);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function lines(min, max, step) {
  const out = [];
  for (let v = min; v <= max + 0.1; v += step) out.push(Math.round(v));
  return out;
}

function distToSeg(x, z, seg) {
  const dx = seg.bx - seg.ax;
  const dz = seg.bz - seg.az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((x - seg.ax) * dx + (z - seg.az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = seg.ax + dx * t;
  const pz = seg.az + dz * t;
  return Math.hypot(x - px, z - pz);
}

function repeatMat(map, normal, repeatX, repeatY, rough, color = 0xffffff) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: 0.03,
    envMapIntensity: 0.35,
  });
  if (map) {
    const tex = map.clone();
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    mat.map = tex;
  }
  if (normal) {
    const tex = normal.clone();
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    mat.normalMap = tex;
    mat.normalScale = new THREE.Vector2(0.65, 0.65);
  }
  return mat;
}

export function buildWorld(scene, assets, quality = 'high') {
  const rng = mulberry32(20261122);
  const roads = [];
  const colliders = [];
  const buildings = [];
  const chunks = new Map();
  const signals = [];
  const root = new THREE.Group();
  root.name = 'city';
  scene.add(root);
  const detail = quality === 'high' ? 380 : 210;
  initFacades(assets.surfaces?.plaster?.image || null, quality === 'high' ? 8 : 4);

  const chunkOf = (x, z) => {
    const cx = Math.floor(x / 140);
    const cz = Math.floor(z / 140);
    const key = `${cx}:${cz}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      const group = new THREE.Group();
      const props = new THREE.Group();
      group.add(props);
      root.add(group);
      chunk = { group, props, cx: cx * 140 + 70, cz: cz * 140 + 70 };
      chunks.set(key, chunk);
    }
    return chunk;
  };

  const addRoad = (ax, az, bx, bz, half) => {
    roads.push({ ax, az, bx, bz, half });
  };

  const downtownX = lines(-174, 174, 58);
  const downtownZ = lines(-174, 174, 58);
  const suburbX = lines(250, 520, 54);
  const suburbZ = lines(-150, 150, 54);

  for (const z of downtownZ) addRoad(downtownX[0], z, downtownX[downtownX.length - 1], z, 7);
  for (const x of downtownX) addRoad(x, downtownZ[0], x, downtownZ[downtownZ.length - 1], 7);
  for (const z of suburbZ) addRoad(suburbX[0], z, suburbX[suburbX.length - 1], z, 5.5);
  for (const x of suburbX) addRoad(x, suburbZ[0], x, suburbZ[suburbZ.length - 1], 5.5);
  addRoad(-580, -250, 560, -250, 11);
  addRoad(-174, -250, -174, -174, 7);
  addRoad(174, -174, 250, -150, 6);
  addRoad(-400, -250, -400, -470, 8);
  addRoad(-560, -390, -230, -390, 12);
  addRoad(-190, 196, 500, 196, 6);
  addRoad(-174, 174, -174, 196, 6);
  addRoad(-190, 210, -190, 400, 6);

  const surf = assets.surfaces || {};
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1300),
    repeatMat(surf.grass, null, 70, 65, 0.96, 0x8fbf6a),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  root.add(grass);

  const district = (x, z, w, d, map, color, repeat) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      repeatMat(map, null, w / repeat, d / repeat, 0.92, color),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.012, z);
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  district(0, 0, 420, 420, surf.concrete, 0x9aa0a6, 8);
  district(380, 300, 560, 180, surf.sand, 0xe6d2a8, 7);
  district(-400, -400, 400, 260, surf.concrete, 0x8e939a, 10);
  district(390, 0, 320, 340, surf.grass, 0x67a85a, 8);

  const roadMat = repeatMat(surf.asphalt, surf.asphaltNor, 1, 1, 0.92, 0xffffff);
  root.add(meshFrom(roadMat, (positions, normals, uvs) => {
    for (const seg of roads) pushRibbon(positions, normals, uvs, seg.ax, seg.az, seg.bx, seg.bz, seg.half, 0.03, 3.2);
  }));
  const walkMat = repeatMat(surf.concrete, null, 1, 1, 0.88, 0xffffff);
  root.add(meshFrom(walkMat, (positions, normals, uvs) => {
    for (const seg of roads) {
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const inner = seg.half + 0.35;
      const outer = seg.half + 3.1;
      for (const side of [1, -1]) {
        const mid = (inner + outer) * 0.5;
        pushRibbon(
          positions, normals, uvs,
          seg.ax + nx * side * mid, seg.az + nz * side * mid,
          seg.bx + nx * side * mid, seg.bz + nz * side * mid,
          (outer - inner) * 0.5, 0.07, 2.4,
        );
      }
    }
  }));

  const curbMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.8, metalness: 0.02 });
  const curbPos = [];
  const curbNor = [];
  for (const seg of roads) {
    const dx = seg.bx - seg.ax;
    const dz = seg.bz - seg.az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    for (const side of [1, -1]) {
      const ox = nx * side * (seg.half + 0.22);
      const oz = nz * side * (seg.half + 0.22);
      const y0 = 0.03;
      const y1 = 0.16;
      const a = [seg.ax + ox, y0, seg.az + oz];
      const b = [seg.bx + ox, y0, seg.bz + oz];
      const c = [seg.bx + ox, y1, seg.bz + oz];
      const d = [seg.ax + ox, y1, seg.az + oz];
      const quad = side > 0 ? [a, b, c, a, c, d] : [a, d, c, a, c, b];
      for (const v of quad) {
        curbPos.push(v[0], v[1], v[2]);
        curbNor.push(nx * side, 0, nz * side);
      }
    }
  }
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNor, 3));
  const curbs = new THREE.Mesh(curbGeo, curbMat);
  curbs.receiveShadow = true;
  root.add(curbs);

  const paintLine = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6, metalness: 0.02 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf0c14a, roughness: 0.5, metalness: 0.04 });
  root.add(meshFrom(paintLine, (positions, normals, uvs) => {
    for (const seg of roads) {
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      for (const side of [1, -1]) {
        const off = seg.half - 0.45;
        pushRibbon(
          positions, normals, uvs,
          seg.ax + nx * side * off, seg.az + nz * side * off,
          seg.bx + nx * side * off, seg.bz + nz * side * off,
          0.08, 0.055, 4,
        );
      }
    }
  }));
  root.add(meshFrom(dashMat, (positions, normals, uvs) => {
    for (const seg of roads) {
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz);
      if (len < 40) continue;
      const steps = Math.floor(len / 9);
      for (let i = 0; i < steps; i += 2) {
        const t0 = (i + 0.2) / steps;
        const t1 = (i + 0.75) / steps;
        pushRibbon(
          positions, normals, uvs,
          seg.ax + dx * t0, seg.az + dz * t0,
          seg.ax + dx * t1, seg.az + dz * t1,
          0.11, 0.06, 2,
        );
      }
    }
  }));

  const stripe = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.55 });
  const cross = [];
  const addStripes = (x, z, alongX) => {
    for (let i = -3; i <= 3; i += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 2.4 : 0.45, alongX ? 0.45 : 2.4), stripe);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x + (alongX ? 0 : i * 0.9), 0.06, z + (alongX ? i * 0.9 : 0));
      mesh.receiveShadow = true;
      cross.push(mesh);
    }
  };
  addStripes(0, 0, false);
  addStripes(0, 58, true);
  addStripes(58, 0, false);
  root.add(...cross);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
      uHorizon: { value: new THREE.Color(0xf0c39a) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float h = sin(p.x * 0.07 + uTime * 1.1) * 0.16 + sin(p.y * 0.05 - uTime * 0.8) * 0.1;
        float dx = cos(p.x * 0.07 + uTime * 1.1) * 0.011;
        float dy = cos(p.y * 0.05 - uTime * 0.8) * 0.005;
        p.z += h;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vPos = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * vec3(-dx, -dy, 1.0));
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uSun;
      uniform vec3 uHorizon;
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
        float wave = sin(vPos.x * 0.09 + uTime) * sin(vPos.z * 0.07 - uTime * 0.8);
        vec3 deep = mix(vec3(0.02, 0.16, 0.28), vec3(0.01, 0.04, 0.1), uNight);
        vec3 shallow = mix(vec3(0.25, 0.72, 0.74), vec3(0.05, 0.16, 0.24), uNight);
        vec3 col = mix(deep, shallow, wave * 0.5 + 0.45);
        vec3 sunDir = normalize(uSun);
        float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 90.0);
        col += vec3(1.0, 0.9, 0.7) * spec * (0.7 - uNight * 0.55);
        col = mix(col, uHorizon, fres * 0.55);
        gl_FragColor = vec4(col, 0.9);
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 280, quality === 'high' ? 48 : 18, quality === 'high' ? 12 : 6), waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(140, 0.02, 390);
  root.add(ocean);
  const harbor = new THREE.Mesh(new THREE.PlaneGeometry(400, 340, quality === 'high' ? 24 : 10, quality === 'high' ? 16 : 8), waterMat);
  harbor.rotation.x = -Math.PI / 2;
  harbor.position.set(-390, -0.04, 360);
  root.add(harbor);

  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8d7358, roughness: 0.82, metalness: 0.04 });
  for (const pier of PIERS) {
    const w = pier.x1 - pier.x0;
    const d = pier.z1 - pier.z0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), pierMat);
    mesh.position.set((pier.x0 + pier.x1) / 2, 0.2, (pier.z0 + pier.z1) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = quality === 'high';
    root.add(mesh);
    colliders.push({
      minX: pier.x0, maxX: pier.x1, minZ: pier.z0, maxZ: pier.z1, tall: false,
    });
  }

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 22),
    repeatMat(surf.asphalt, surf.asphaltNor, 18, 2, 0.7, 0x9aa0a8),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-400, 0.06, -390);
  runway.receiveShadow = true;
  root.add(runway);

  const reserved = [
    [0, 22, 10], [0, 58, 8], [58, 0, 8], [-58, 58, 14], [0, -58, 8], [0, -150, 10],
    [120, 214, 8], [230, 214, 8], [-168, 230, 8], [-500, -390, 16], [-380, 239, 8],
  ];
  const blockedSpot = (x, z, pad = 10) => reserved.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + pad);
  const nearRoad = (x, z) => roads.some((seg) => distToSeg(x, z, seg) < seg.half + 3);

  const placeBuilding = (kind, x, z) => {
    if (inWater(x, z) || blockedSpot(x, z) || nearRoad(x, z)) return;
    if (z < -360 && z > -420 && x < -220 && x > -570) return;
    if (Math.abs(z + 250) < 16 && x > -580 && x < 560) return;
    const mesh = makeBuilding(kind, rng);
    const yaw = (Math.floor(rng() * 4) * Math.PI) / 2;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    mesh.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(mesh);
    if (fitted.max.x - fitted.min.x > 30 || fitted.max.z - fitted.min.z > 30) {
      mesh.scale.multiplyScalar(0.8);
      mesh.updateMatrixWorld(true);
    }
    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push({
      minX: box.min.x + 0.4,
      maxX: box.max.x - 0.4,
      minZ: box.min.z + 0.4,
      maxZ: box.max.z - 0.4,
      tall: true,
    });
    if (quality !== 'high') {
      mesh.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = false;
      });
    }
    chunkOf(x, z).group.add(mesh);
    const height = box.max.y - box.min.y;
    buildings.push({
      mesh,
      x,
      z,
      hx: (box.max.x - box.min.x) * 0.92,
      hy: height,
      hz: (box.max.z - box.min.z) * 0.92,
      yaw,
      tint: mesh.userData.tint || '#d9c3b0',
    });
  };

  const fillGrid = (xs, zs, kind, chance, downtown = false) => {
    for (let i = 0; i < xs.length - 1; i += 1) {
      for (let j = 0; j < zs.length - 1; j += 1) {
        if (rng() > chance) continue;
        const x = (xs[i] + xs[i + 1]) / 2;
        const z = (zs[j] + zs[j + 1]) / 2;
        let use = kind;
        if (downtown && Math.hypot(x, z) < 140 && rng() > 0.42) use = 'tower';
        placeBuilding(use, x, z);
      }
    }
  };
  fillGrid(downtownX, downtownZ, 'block', 0.94, true);
  fillGrid(suburbX, suburbZ, 'house', 0.82);
  for (const x of [-150, -120]) {
    for (const z of [220, 280, 340]) placeBuilding('industry', x, z);
  }
  for (const x of [-500, -420, -340]) placeBuilding('industry', x, -470);
  for (const x of [70, 160, 260, 370]) placeBuilding('block', x, 228);

  const proxyGeo = new THREE.BoxGeometry(1, 1, 1);
  const proxyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const inst = new THREE.InstancedMesh(proxyGeo, proxyMat, Math.max(1, buildings.length));
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.count = buildings.length;
  inst.frustumCulled = false;
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  buildings.forEach((b, i) => {
    dummy.position.set(b.x, b.hy / 2, b.z);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, new THREE.Color(b.tint));
  });
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  root.add(inst);

  const placeProp = (template, x, z, yaw = 0, s = 1) => {
    if (!template || inWater(x, z)) return;
    const mesh = template.clone(true);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    mesh.scale.multiplyScalar(s);
    mesh.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = false;
    });
    chunkOf(x, z).props.add(mesh);
  };

  for (let i = 0; i < downtownX.length; i += 1) {
    for (let j = 0; j < downtownZ.length; j += 1) {
      if ((i + j) % 2 === 0) placeProp(assets.light, downtownX[i] + 9, downtownZ[j] + 9, rng() * 0.4);
    }
  }
  for (let x = -160; x <= 460; x += 34) placeProp(assets.light, x, 188, 0);
  for (let x = -150; x <= 460; x += 18) {
    placeProp(rng() > 0.45 ? assets.palm : assets.palmTall, x, 312 + (rng() - 0.5) * 16, rng() * 6, 0.9 + rng() * 0.4);
    if (rng() > 0.55) placeProp(assets.parasol, x + 5, 255, rng() * 3, 1);
  }
  for (let i = 0; i < 6; i += 1) {
    placeProp(assets.palm, -150 + i * 52, 10, rng() * 6, 0.85);
    placeProp(assets.palm, -150 + i * 52, -10, rng() * 6, 0.8);
  }
  for (let i = 0; i < 6; i += 1) placeProp(assets.awning, -16 + i * 16, 72, 0, 1);

  const lampGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const lampMat = trackGlow(new THREE.MeshStandardMaterial({
    color: 0xfff4d2,
    emissive: 0xffc56a,
    roughness: 0.25,
  }), 0.04, 2.6);
  const lamps = [];
  for (let i = 0; i < downtownX.length; i += 1) {
    for (let j = 0; j < downtownZ.length; j += 1) {
      lamps.push([downtownX[i] + 9, downtownZ[j] + 9]);
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length);
  lamps.forEach(([x, z], i) => {
    dummy.position.set(x, 6.4, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampMesh.setMatrixAt(i, dummy.matrix);
  });
  root.add(lampMesh);

  const makeSignal = (x, z, yaw) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.4 }),
    );
    pole.position.y = 2.1;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.95, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.45, metalness: 0.3 }),
    );
    box.position.y = 4.15;
    const bulbs = ['#ff4d4d', '#ffd15a', '#3dde73'].map((hex, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.05, roughness: 0.3 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat);
      bulb.position.set(0, 4.42 - i * 0.28, 0.16);
      bulb.userData.hex = hex;
      g.add(bulb);
      return bulb;
    });
    g.add(pole, box);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    root.add(g);
    signals.push(bulbs);
  };
  makeSignal(10, 10, 0.4);
  makeSignal(-10, 48, 1);
  makeSignal(48, -8, 0.2);
  makeSignal(10, -48, 2);

  const benchGeo = new THREE.BoxGeometry(1.6, 0.08, 0.45);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x8d5a32, roughness: 0.7 });
  const benches = new THREE.InstancedMesh(benchGeo, benchMat, 16);
  for (let i = 0; i < 16; i += 1) {
    dummy.position.set(-120 + (i % 8) * 30, 0.46, i < 8 ? 14 : -14);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    benches.setMatrixAt(i, dummy.matrix);
  }
  benches.castShadow = quality === 'high';
  root.add(benches);

  const signCanvas = (text, sub, bg) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(0, 0, 512, 12);
    ctx.fillStyle = '#fff6ea';
    ctx.font = '700 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 120);
    ctx.fillStyle = '#ffb15e';
    ctx.font = '36px sans-serif';
    ctx.fillText(sub, 256, 186);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const putSign = (text, sub, x, z, yaw, y = 4.2, w = 5.2) => {
    const tex = signCanvas(text, sub, '#12080f');
    const mat = trackGlow(new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      roughness: 0.4,
    }), 0.55, 1.6);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), mat);
    board.position.set(x, y, z);
    board.rotation.y = yaw;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, y, 6),
      new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.4 }),
    );
    pole.position.set(x, y / 2, z);
    root.add(board, pole);
  };
  putSign('交易所', 'ORNG', 8, 64, Math.PI);
  putSign('车行', 'CARS', -46, 68, Math.PI);
  putSign('医院', 'HOSPITAL', 8, -138, 0);
  putSign('汪言币', 'TO THE MOON', 18, 36, Math.PI, 8.5, 8);
  putSign('柜姐所', '充值一直开', -22, 34, 0, 7.2, 6.4);
  putSign('机场', 'AIRPORT', -360, -430, 0);
  putSign('港口', 'MARINA', -220, 220, -Math.PI / 2);
  putSign('ORNG', '海滩', 200, 230, Math.PI, 6, 7);

  const blocked = (x, z, radius, mode) => {
    if (x < WORLD.minX || x > WORLD.maxX || z < WORLD.minZ || z > WORLD.maxZ) return true;
    if (mode === 'fly') return false;
    if ((mode === 'walk' || mode === 'car') && inWater(x, z)) return true;
    for (const box of colliders) {
      if (!box.tall && mode === 'walk') continue;
      if (x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius) return true;
    }
    return false;
  };
  const slide = (x, z, nx, nz, radius, mode) => {
    let px = x;
    let pz = z;
    if (!blocked(nx, z, radius, mode)) px = nx;
    if (!blocked(px, nz, radius, mode)) pz = nz;
    return { x: px, z: pz };
  };

  return {
    roads,
    colliders,
    buildings,
    waterMat,
    blocked,
    slide,
    setAtmosphere({ night, sun, horizon }) {
      applyNight(night);
      waterMat.uniforms.uNight.value = night;
      waterMat.uniforms.uSun.value.copy(sun);
      waterMat.uniforms.uHorizon.value.copy(horizon);
    },
    update(px, pz, time) {
      waterMat.uniforms.uTime.value = time;
      const phase = Math.floor(time * 0.35) % 3;
      for (const bulbs of signals) {
        bulbs.forEach((bulb, i) => {
          const on = i === phase;
          bulb.material.emissiveIntensity = on ? 2.4 : 0.03;
        });
      }
      for (const chunk of chunks.values()) {
        const d = Math.hypot(chunk.cx - px, chunk.cz - pz);
        chunk.group.visible = d < 560;
        chunk.props.visible = d < 280;
      }
      for (let i = 0; i < buildings.length; i += 1) {
        const b = buildings[i];
        const d = Math.hypot(b.x - px, b.z - pz);
        const near = d < detail;
        b.mesh.visible = near;
        dummy.position.set(b.x, b.hy / 2, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(near || d > 620 ? 0 : b.hx, near || d > 620 ? 0 : b.hy, near || d > 620 ? 0 : b.hz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}
