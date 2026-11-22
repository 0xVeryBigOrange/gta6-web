import * as THREE from 'three';
import { PIERS, WORLD, inWater } from './config.js';
import { mulberry32 } from './util.js';

function ribbon(positions, normals, ax, az, bx, bz, half, y) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * half;
  const nz = (dx / len) * half;
  const verts = [
    [ax + nx, y, az + nz],
    [bx + nx, y, bz + nz],
    [bx - nx, y, bz - nz],
    [ax + nx, y, az + nz],
    [bx - nx, y, bz - nz],
    [ax - nx, y, az - nz],
  ];
  for (const v of verts) {
    positions.push(v[0], v[1], v[2]);
    normals.push(0, 1, 0);
  }
}

function meshFromRibbons(material, draw) {
  const positions = [];
  const normals = [];
  draw(positions, normals);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function asphalt() {
  return new THREE.MeshStandardMaterial({ color: 0x343a44, roughness: 0.94, metalness: 0.02 });
}

function sidewalkMat() {
  return new THREE.MeshStandardMaterial({ color: 0xb7b3aa, roughness: 0.88, metalness: 0.02 });
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

export function buildWorld(scene, assets) {
  const rng = mulberry32(20261122);
  const roads = [];
  const colliders = [];
  const buildings = [];
  const chunks = new Map();
  const root = new THREE.Group();
  root.name = 'city';
  scene.add(root);

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
      chunk = {
        group,
        props,
        cx: cx * 140 + 70,
        cz: cz * 140 + 70,
      };
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

  const pushSidewalk = (positions, normals, seg) => {
    const dx = seg.bx - seg.ax;
    const dz = seg.bz - seg.az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const inner = seg.half + 0.4;
    const outer = seg.half + 2.6;
    for (const side of [1, -1]) {
      ribbon(
        positions,
        normals,
        seg.ax + nx * side * (inner + outer) * 0.5,
        seg.az + nz * side * (inner + outer) * 0.5,
        seg.bx + nx * side * (inner + outer) * 0.5,
        seg.bz + nz * side * (inner + outer) * 0.5,
        (outer - inner) * 0.5,
        0.045,
      );
    }
  };

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1300),
    new THREE.MeshStandardMaterial({ color: 0x3d7a3a, roughness: 0.96, metalness: 0 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0;
  grass.receiveShadow = true;
  root.add(grass);

  const district = (x, z, w, d, color, y = 0.012) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0.02 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  district(0, 0, 390, 390, 0x3a3e46, 0.015);
  district(380, 280, 520, 150, 0xd2b47a, 0.016);
  district(-400, -400, 380, 250, 0x8e939a, 0.016);
  district(390, 0, 300, 320, 0x4e8a45, 0.014);

  root.add(meshFromRibbons(asphalt(), (positions, normals) => {
    for (const seg of roads) ribbon(positions, normals, seg.ax, seg.az, seg.bx, seg.bz, seg.half, 0.03);
  }));
  root.add(meshFromRibbons(sidewalkMat(), (positions, normals) => {
    for (const seg of roads) pushSidewalk(positions, normals, seg);
  }));
  root.add(meshFromRibbons(new THREE.MeshStandardMaterial({ color: 0xe6c14a, roughness: 0.55, metalness: 0.05 }), (positions, normals) => {
    for (const seg of roads) {
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz);
      if (len < 48) continue;
      const steps = Math.floor(len / 10);
      for (let i = 0; i < steps; i += 2) {
        const t0 = (i + 0.15) / steps;
        const t1 = (i + 0.7) / steps;
        ribbon(
          positions,
          normals,
          seg.ax + dx * t0,
          seg.az + dz * t0,
          seg.ax + dx * t1,
          seg.az + dz * t1,
          0.12,
          0.06,
        );
      }
    }
  }));

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      uniform float uTime;
      void main() {
        vec3 p = position;
        p.z += sin(position.x * 0.08 + uTime) * 0.15;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform float uTime;
      void main() {
        float w = sin(vPos.x * 0.12 + uTime * 1.3) * sin(vPos.z * 0.09 - uTime);
        vec3 deep = vec3(0.03, 0.22, 0.36);
        vec3 shallow = vec3(0.18, 0.62, 0.68);
        vec3 col = mix(deep, shallow, w * 0.5 + 0.5);
        gl_FragColor = vec4(col, 0.9);
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 280, 24, 8), waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(80, 0.02, 470);
  root.add(ocean);
  const harbor = new THREE.Mesh(new THREE.PlaneGeometry(400, 340, 12, 10), waterMat);
  harbor.rotation.x = -Math.PI / 2;
  harbor.position.set(-390, 0.02, 360);
  root.add(harbor);

  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a7358, roughness: 0.84, metalness: 0.04 });
  for (const pier of PIERS) {
    const w = pier.x1 - pier.x0;
    const d = pier.z1 - pier.z0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), pierMat);
    mesh.position.set((pier.x0 + pier.x1) / 2, 0.2, (pier.z0 + pier.z1) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);
    colliders.push({
      minX: pier.x0,
      maxX: pier.x1,
      minZ: pier.z0,
      maxZ: pier.z1,
      tall: false,
    });
  }

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 22),
    new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.7, metalness: 0.08 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-400, 0.06, -390);
  runway.receiveShadow = true;
  root.add(runway);

  const reserved = [
    [0, 22, 10],
    [0, 58, 8],
    [58, 0, 8],
    [-58, 58, 14],
    [0, -58, 8],
    [0, -150, 10],
    [120, 214, 8],
    [230, 214, 8],
    [-168, 230, 8],
    [-500, -390, 16],
    [-380, 239, 8],
  ];

  const blockedSpot = (x, z, pad = 10) => reserved.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + pad);
  const nearRoad = (x, z) => roads.some((seg) => distToSeg(x, z, seg) < seg.half + 3);

  const proxyGeo = new THREE.BoxGeometry(1, 1, 1);
  const proxyMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.8, metalness: 0.08 });
  const proxies = [];

  const placeBuilding = (template, x, z, yawScale = 1) => {
    if (inWater(x, z) || blockedSpot(x, z) || nearRoad(x, z)) return;
    if (z < -360 && z > -420 && x < -220 && x > -570) return;
    if (Math.abs(z + 250) < 16 && x > -580 && x < 560) return;
    const mesh = template.clone(true);
    const yaw = (Math.floor(rng() * 4) * Math.PI) / 2;
    const s = yawScale * (0.92 + rng() * 0.16);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    mesh.scale.multiplyScalar(s);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.max.x - box.min.x > 28 || box.max.z - box.min.z > 28) {
      mesh.scale.multiplyScalar(0.72);
      mesh.updateMatrixWorld(true);
    }
    const fitted = new THREE.Box3().setFromObject(mesh);
    colliders.push({
      minX: fitted.min.x + 0.3,
      maxX: fitted.max.x - 0.3,
      minZ: fitted.min.z + 0.3,
      maxZ: fitted.max.z - 0.3,
      tall: true,
    });
    chunkOf(x, z).group.add(mesh);
    const height = fitted.max.y - fitted.min.y;
    buildings.push({
      mesh,
      x,
      z,
      hx: (fitted.max.x - fitted.min.x) * 0.92,
      hy: height,
      hz: (fitted.max.z - fitted.min.z) * 0.92,
      yaw,
    });
    proxies.push(buildings[buildings.length - 1]);
  };

  const fillGrid = (xs, zs, templates, chance = 1) => {
    for (let i = 0; i < xs.length - 1; i += 1) {
      for (let j = 0; j < zs.length - 1; j += 1) {
        if (rng() > chance) continue;
        const x = (xs[i] + xs[i + 1]) / 2;
        const z = (zs[j] + zs[j + 1]) / 2;
        const tower = Math.hypot(x, z) < 120 && rng() > 0.45 && assets.towers.length;
        const list = tower ? assets.towers : templates;
        placeBuilding(list[Math.floor(rng() * list.length)], x, z);
      }
    }
  };

  fillGrid(downtownX, downtownZ, assets.blocks, 0.92);
  fillGrid(suburbX, suburbZ, assets.houses, 0.8);
  for (const x of [-150, -120]) {
    for (const z of [220, 280, 340]) placeBuilding(assets.industry[Math.floor(rng() * assets.industry.length)], x, z);
  }
  for (const x of [-500, -420, -340]) placeBuilding(assets.industry[Math.floor(rng() * assets.industry.length)], x, -470);
  for (const x of [70, 160, 260, 370]) placeBuilding(assets.blocks[Math.floor(rng() * assets.blocks.length)], x, 228, 0.85);

  const inst = new THREE.InstancedMesh(proxyGeo, proxyMat, Math.max(1, proxies.length));
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.count = proxies.length;
  inst.frustumCulled = false;
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  proxies.forEach((b, i) => {
    dummy.position.set(b.x, b.hy / 2, b.z);
    dummy.rotation.set(0, b.yaw, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, new THREE.Color().setHSL(0.08, 0.05, 0.45 + (i % 5) * 0.04));
  });
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  root.add(inst);

  const placeProp = (template, x, z, yaw = 0, s = 1) => {
    if (inWater(x, z)) return;
    const mesh = template.clone(true);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    mesh.scale.multiplyScalar(s);
    chunkOf(x, z).props.add(mesh);
  };

  for (let i = 0; i < downtownX.length; i += 2) {
    for (let j = 0; j < downtownZ.length; j += 2) {
      placeProp(assets.light, downtownX[i] + 8, downtownZ[j] + 8, rng() * Math.PI);
    }
  }
  for (let x = -160; x <= 460; x += 36) placeProp(assets.light, x, 188, 0);
  for (let x = -140; x <= 460; x += 22) {
    placeProp(rng() > 0.5 ? assets.palm : assets.palmTall, x, 300 + (rng() - 0.5) * 18, rng() * 6, 0.85 + rng() * 0.35);
    if (rng() > 0.4) placeProp(assets.parasol, x + 6, 250, rng() * 3, 1);
  }
  for (let i = 0; i < 8; i += 1) placeProp(assets.awning, -20 + i * 18, 70, 0, 1);

  const benchGeo = new THREE.BoxGeometry(1.4, 0.08, 0.42);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x8d5a32, roughness: 0.7, metalness: 0.05 });
  const benches = new THREE.InstancedMesh(benchGeo, benchMat, 18);
  const backGeo = new THREE.BoxGeometry(1.4, 0.4, 0.06);
  const backs = new THREE.InstancedMesh(backGeo, benchMat, 18);
  for (let i = 0; i < 18; i += 1) {
    const x = -140 + (i % 9) * 32;
    const z = i < 9 ? 12 : -12;
    dummy.position.set(x, 0.48, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    benches.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.72, z - 0.18);
    dummy.updateMatrix();
    backs.setMatrixAt(i, dummy.matrix);
  }
  benches.castShadow = true;
  backs.castShadow = true;
  root.add(benches, backs);

  const hydrantGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.55, 8);
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xc4322c, roughness: 0.45, metalness: 0.25 });
  const hydrants = new THREE.InstancedMesh(hydrantGeo, hydrantMat, 14);
  for (let i = 0; i < 14; i += 1) {
    dummy.position.set(-150 + i * 22, 0.28, 20);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hydrants.setMatrixAt(i, dummy.matrix);
  }
  hydrants.castShadow = true;
  root.add(hydrants);

  const signCanvas = (text, sub) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#14181f';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(0, 0, 512, 10);
    ctx.fillStyle = '#f4f7fb';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 120);
    ctx.fillStyle = '#ffb15e';
    ctx.font = '36px sans-serif';
    ctx.fillText(sub, 256, 190);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const putSign = (text, sub, x, z, yaw = 0) => {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 2.2),
      new THREE.MeshStandardMaterial({ map: signCanvas(text, sub), roughness: 0.55, metalness: 0.1 }),
    );
    board.position.set(x, 3.2, z);
    board.rotation.y = yaw;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5, metalness: 0.4 }),
    );
    pole.position.set(x, 1.6, z);
    root.add(board, pole);
  };
  putSign('交易所', 'ORNG', 6, 66, Math.PI);
  putSign('车行', 'CARS', -48, 70, Math.PI);
  putSign('医院', 'HOSPITAL', 8, -140, 0);
  putSign('机场', 'AIRPORT', -360, -430, 0);
  putSign('港口', 'MARINA', -220, 220, -Math.PI / 2);
  putSign('ORNG', '海滩', 200, 230, Math.PI);

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
    update(px, pz, time) {
      waterMat.uniforms.uTime.value = time;
      for (const chunk of chunks.values()) {
        const d = Math.hypot(chunk.cx - px, chunk.cz - pz);
        chunk.group.visible = d < 520;
        chunk.props.visible = d < 240;
      }
      for (let i = 0; i < buildings.length; i += 1) {
        const b = buildings[i];
        const d = Math.hypot(b.x - px, b.z - pz);
        const near = d < 200;
        b.mesh.visible = near;
        dummy.position.set(b.x, b.hy / 2, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(near || d > 540 ? 0 : b.hx, near || d > 540 ? 0 : b.hy, near || d > 540 ? 0 : b.hz);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}
