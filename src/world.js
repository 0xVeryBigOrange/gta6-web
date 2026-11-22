import * as THREE from 'three';
import {
  BLOCK_HALF,
  BUILD_LIMIT,
  CELL,
  LINES,
  ORIGIN,
  PROPS,
  ROAD_W,
  SPOTS,
  WORLD,
  linePos,
} from './config.js';
import { mulberry32 } from './util.js';

const SIGN_FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

function canvasTex(draw, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFacade(wall, win, seed) {
  const rng = mulberry32(seed);
  const color = canvasTex((ctx, w, h) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, 10, h);
    ctx.fillRect(w - 10, 0, 10, h);
    for (let y = 12; y < h - 8; y += 22) {
      for (let x = 18; x < w - 14; x += 20) {
        const lit = rng() > 0.3;
        ctx.fillStyle = lit ? win : '#120c18';
        ctx.fillRect(x, y, 10, 14);
      }
    }
  }, 128, 256);
  const rng2 = mulberry32(seed ^ 0x9e3779b9);
  const glow = canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 8; y += 22) {
      for (let x = 18; x < w - 14; x += 20) {
        if (rng2() > 0.3) {
          ctx.fillStyle = win;
          ctx.fillRect(x, y, 10, 14);
        }
      }
    }
  }, 128, 256);
  color.wrapS = THREE.RepeatWrapping;
  color.wrapT = THREE.RepeatWrapping;
  glow.wrapS = THREE.RepeatWrapping;
  glow.wrapT = THREE.RepeatWrapping;
  return { color, glow, win };
}

function makeSign(text, bg, fg) {
  const tex = canvasTex((ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg;
    ctx.font = `700 58px ${SIGN_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  }, 512, 160);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.7), mat);
  return mesh;
}

function mergePalm(geometries) {
  let count = 0;
  for (const geometry of geometries) count += geometry.attributes.position.count;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const indices = [];
  let vertex = 0;
  for (const geometry of geometries) {
    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    for (let i = 0; i < pos.count; i += 1) {
      positions[(vertex + i) * 3] = pos.getX(i);
      positions[(vertex + i) * 3 + 1] = pos.getY(i);
      positions[(vertex + i) * 3 + 2] = pos.getZ(i);
      normals[(vertex + i) * 3] = nor.getX(i);
      normals[(vertex + i) * 3 + 1] = nor.getY(i);
      normals[(vertex + i) * 3 + 2] = nor.getZ(i);
    }
    const index = geometry.index;
    if (index) {
      for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + vertex);
    }
    vertex += pos.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

function makeBillboard(lines, bg, fg) {
  const tex = canvasTex((ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? 700 : 600} ${i === 0 ? 54 : 36}px ${SIGN_FONT}`;
      ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 58);
    });
  }, 512, 256);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  return new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mat);
}

export function createWorld(scene) {
  const rng = mulberry32(0x0e5c7a11);
  const colliders = [];
  const box = new THREE.BoxGeometry(1, 1, 1);

  scene.background = new THREE.Color(0xf0a07a);
  scene.fog = new THREE.Fog(0xf0a07a, 78, 250);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 28, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#24124a') },
        mid: { value: new THREE.Color('#ff4f8b') },
        horizon: { value: new THREE.Color('#ffb15e') },
        bottom: { value: new THREE.Color('#3a2158') },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 horizon;
        uniform vec3 bottom;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = mix(horizon, mid, smoothstep(0.02, 0.28, h));
          col = mix(col, top, smoothstep(0.22, 0.82, h));
          col = mix(bottom, col, smoothstep(-0.25, 0.08, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(16, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
  );
  sunDisc.position.set(-150, 42, -70);
  scene.add(sunDisc);

  const hemi = new THREE.HemisphereLight(0xffc2a0, 0x2a1844, 0.78);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffd0c2, 0.22));
  const sun = new THREE.DirectionalLight(0xffe2c2, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.12;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x7aa2ff, 0.22);
  fill.position.set(60, 30, -40);
  scene.add(fill);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 70),
    new THREE.MeshStandardMaterial({ color: 0xe7c48a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 158);
  sand.receiveShadow = true;
  scene.add(sand);

  const oceanGeo = new THREE.PlaneGeometry(420, 240, 48, 24);
  const oceanMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color('#2a9ec4') },
      uDeep: { value: new THREE.Color('#0c3c66') },
    },
    vertexShader: `
      uniform float uTime;
      varying float vH;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.18 + uTime * 1.4) * 0.22 + cos(p.y * 0.14 + uTime) * 0.18;
        p.z += w;
        vH = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying float vH;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      void main() {
        vec3 col = mix(uDeep, uShallow, clamp(vH * 2.0 + 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col, 0.92);
      }
    `,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.35, 300);
  scene.add(ocean);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x4c5568, roughness: 0.9 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf4e2a8 });
  for (let i = 0; i < LINES; i += 1) {
    const p = linePos(i);
    const span = (LINES - 1) * CELL + ROAD_W;
    const hRoad = new THREE.Mesh(box, roadMat);
    hRoad.scale.set(span, 0.08, ROAD_W);
    hRoad.position.set(0, 0.04, p);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
    const vRoad = new THREE.Mesh(box, roadMat);
    vRoad.scale.set(ROAD_W, 0.09, span);
    vRoad.position.set(p, 0.045, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);
  }

  const dashes = [];
  const roadCoords = Array.from({ length: LINES }, (_, i) => linePos(i));
  const crossing = (value) => roadCoords.some((road) => Math.abs(road - value) < 10);
  for (let i = 0; i < LINES; i += 1) {
    const p = linePos(i);
    for (let t = ORIGIN; t <= -ORIGIN; t += 8) {
      if (crossing(t)) continue;
      dashes.push([t, p, 2.4, 0.32]);
      dashes.push([p, t, 0.32, 2.4]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(box, dashMat, dashes.length);
  const dummy = new THREE.Object3D();
  dashes.forEach((d, i) => {
    dummy.position.set(d[0], 0.1, d[1]);
    dummy.scale.set(d[2], 0.04, d[3]);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashMesh);

  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xd9c7b0, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x22182e, roughness: 0.7 });
  const palette = [
    ['#2a2140', '#ff4f9a'],
    ['#241c38', '#3df0ff'],
    ['#2c2038', '#ff8a1e'],
    ['#1c243c', '#c084fc'],
    ['#33243c', '#ffe27a'],
    ['#1a2838', '#7dffa6'],
  ];
  const facades = palette.map((pair, i) => makeFacade(pair[0], pair[1], 1000 + i * 97));

  function addBuilding(x, z, w, d, h, facadeIndex) {
    const facade = facades[facadeIndex % facades.length];
    const map = facade.color.clone();
    const glow = facade.glow.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    glow.wrapS = glow.wrapT = THREE.RepeatWrapping;
    map.repeat.set(Math.max(1, w / 7), Math.max(1, h / 10));
    glow.repeat.copy(map.repeat);
    map.colorSpace = THREE.SRGBColorSpace;
    glow.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissive: new THREE.Color(facade.win),
      emissiveMap: glow,
      emissiveIntensity: 0.7,
      roughness: 0.82,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(box, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2 + 0.08, z);
    mesh.castShadow = false;
    scene.add(mesh);
    const roof = new THREE.Mesh(box, roofMat);
    roof.scale.set(w * 1.04, 0.7, d * 1.04);
    roof.position.set(x, h + 0.4, z);
    scene.add(roof);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
    return mesh;
  }

  for (let ix = 0; ix < LINES - 1; ix += 1) {
    for (let iz = 0; iz < LINES - 1; iz += 1) {
      const cx = ORIGIN + (ix + 0.5) * CELL;
      const cz = ORIGIN + (iz + 0.5) * CELL;
      const slab = new THREE.Mesh(box, sidewalkMat);
      slab.scale.set(BLOCK_HALF * 2, 0.12, BLOCK_HALF * 2);
      slab.position.set(cx, 0.06, cz);
      slab.receiveShadow = true;
      scene.add(slab);

      const landmark =
        (ix === 2 && iz === 2) || (ix === 4 && iz === 3) || (ix === 1 && iz === 1) || (ix === 3 && iz === 4);
      if (ix === 2 && iz === 2) {
        addBuilding(cx, cz, 16, 16, 34, 2);
        const trim = new THREE.Mesh(
          box,
          new THREE.MeshBasicMaterial({ color: 0xff8a1e }),
        );
        trim.scale.set(16.4, 0.4, 16.4);
        trim.position.set(cx, 8, cz);
        scene.add(trim);
      } else if (ix === 4 && iz === 3) {
        addBuilding(cx, cz, 18, 14, 26, 0);
      } else if (ix === 1 && iz === 1) {
        addBuilding(cx, cz - 2, 12, 12, 62, 3);
      } else if (ix === 3 && iz === 4) {
        addBuilding(cx, cz, 20, 12, 18, 1);
      }

      const lots = landmark ? 1 : 2 + (rng() > 0.55 ? 1 : 0);
      for (let n = 0; n < lots; n += 1) {
        const ang = rng() * Math.PI * 2;
        const rad = rng() * (BUILD_LIMIT * 0.45);
        const w = 6 + rng() * 6;
        const d = 6 + rng() * 6;
        const h = 7 + rng() ** 1.4 * (landmark ? 16 : 48);
        let x = cx + Math.cos(ang) * rad;
        let z = cz + Math.sin(ang) * rad;
        x = Math.max(cx - BUILD_LIMIT + w / 2, Math.min(cx + BUILD_LIMIT - w / 2, x));
        z = Math.max(cz - BUILD_LIMIT + d / 2, Math.min(cz + BUILD_LIMIT - d / 2, z));
        const overlap = colliders.some((c) => {
          return x + w / 2 > c.minX + 0.4 && x - w / 2 < c.maxX - 0.4 && z + d / 2 > c.minZ + 0.4 && z - d / 2 < c.maxZ - 0.4;
        });
        if (overlap) continue;
        addBuilding(x, z, w, d, h, Math.floor(rng() * facades.length));
      }
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.2, 4.6, 6);
  trunkGeo.translate(0, 2.3, 0);
  const frondBase = new THREE.ConeGeometry(0.22, 2.5, 5);
  frondBase.translate(0, 1.15, 0);
  const frondParts = [];
  for (let k = 0; k < 7; k += 1) {
    const frond = frondBase.clone();
    frond.rotateX(1.25);
    frond.rotateY((k / 7) * Math.PI * 2);
    frond.translate(0, 4.45, 0);
    frondParts.push(frond);
  }
  const leafGeo = mergePalm(frondParts);
  const trunks = [];
  for (let i = 0; i < 18; i += 1) {
    trunks.push([-130 + i * 15, 146 + (i % 3) * 4]);
    trunks.push([-120 + i * 14, 168]);
  }
  for (let i = 0; i < LINES; i += 1) {
    const p = linePos(i);
    for (let t = -2; t <= 2; t += 1) {
      if (rng() > 0.4) trunks.push([p + 10, ORIGIN + (t + 2.2) * CELL]);
      if (rng() > 0.4) trunks.push([ORIGIN + (t + 2.2) * CELL, p + 10]);
    }
  }
  const trunkMesh = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x6d4a2e, roughness: 1 }),
    trunks.length,
  );
  const leafMesh = new THREE.InstancedMesh(
    leafGeo,
    new THREE.MeshStandardMaterial({ color: 0x1fa85a, roughness: 0.75 }),
    trunks.length,
  );
  trunks.forEach((pos, i) => {
    dummy.position.set(pos[0], 0, pos[1]);
    dummy.rotation.set(0, i * 0.4, 0.05 * ((i % 5) - 2));
    dummy.scale.set(1, 0.9 + (i % 4) * 0.08, 1);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(pos[0], 0, pos[1]);
    dummy.rotation.set(0, i, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  scene.add(trunkMesh);
  scene.add(leafMesh);

  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6a3d78, roughness: 1 });
  for (let i = 0; i < 8; i += 1) {
    const h = 36 + rng() * 48;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(26 + rng() * 18, h, 5), hillMat);
    hill.position.set(-200 + i * 58, h / 2 - 8, -230);
    scene.add(hill);
  }

  function kiosk(x, z, color, label, bg, fg) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 1.3, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3, emissive: color, emissiveIntensity: 0.25 }),
    );
    base.position.y = 0.7;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.35, 10, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 6;
    const sign = makeSign(label, bg, fg);
    sign.position.y = 2.5;
    group.add(base, beam, sign);
    group.position.set(x, 0, z);
    scene.add(group);
    return group;
  }

  kiosk(SPOTS.exchange.x, SPOTS.exchange.z, 0xff8a1e, '交易所', '#1a1030', '#ffb15e');
  kiosk(SPOTS.kiosk.x, SPOTS.kiosk.z, 0xff2d95, '任务', '#1a1030', '#ff8ad2');
  kiosk(SPOTS.dealer.x, SPOTS.dealer.z, 0x3df0ff, '车行', '#062028', '#d8fbff');
  kiosk(SPOTS.safehouse.x, SPOTS.safehouse.z, 0xff8a1e, '安全屋', '#2a1408', '#ffd7a8');
  kiosk(PROPS[0].x, PROPS[0].z, 0xffe27a, '海滩公寓', '#2a1408', '#fff1c4');
  kiosk(PROPS[1].x, PROPS[1].z, 0xc084fc, '霓虹阁楼', '#1a1030', '#f0d8ff');
  kiosk(SPOTS.coldPickup.x, SPOTS.coldPickup.z, 0x8aa4ff, '冷钱包', '#101828', '#dce6ff');
  kiosk(SPOTS.pump.x, SPOTS.pump.z, 0xff2d95, '拉盘点', '#2a0820', '#ffd0ea');
  kiosk(SPOTS.rug.x, SPOTS.rug.z, 0xff4d4d, '橙氏基金', '#280808', '#ffd0d0');

  const boards = [
    makeBillboard(['ORNG', '大橙子币'], '#ff8a1e', '#1a1030'),
    makeBillboard(['HODL', '别在日落前卖飞'], '#1a1030', '#3df0ff'),
    makeBillboard(['BUY THE DIP', '或者成为那个 dip'], '#ff2d95', '#fff'),
    makeBillboard(['VICE CHAIN', 'GTA6 Web版'], '#141028', '#ffb15e'),
  ];
  boards[0].position.set(-20, 8, 14);
  boards[1].position.set(70, 7, 20);
  boards[1].rotation.y = -Math.PI / 2;
  boards[2].position.set(96, 9, 70);
  boards[3].position.set(20, 6, 150);
  boards[3].rotation.y = Math.PI;
  boards.forEach((b) => scene.add(b));

  const orange = new THREE.Group();
  const fruit = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.45, emissive: 0xff6a00, emissiveIntensity: 0.18 }),
  );
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x2f9e44 }),
  );
  leaf.scale.set(1.4, 0.45, 0.8);
  leaf.position.set(0.4, 3.1, 0);
  orange.add(fruit, leaf);
  orange.position.set(-20, 3.3, 160);
  scene.add(orange);
  const plaque = makeSign('大橙子广场', '#1a1030', '#ffb15e');
  plaque.position.set(-20, 1.4, 166);
  scene.add(plaque);

  for (let i = 0; i < 5; i += 1) {
    const umbrella = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
    );
    pole.position.y = 1.1;
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff2d95 : 0x3df0ff }),
    );
    cap.position.y = 2.2;
    umbrella.add(pole, cap);
    umbrella.position.set(-70 + i * 28, 0, 150);
    scene.add(umbrella);
  }

  function boat(x, z, color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.45, 4.2),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 }),
    );
    hull.position.y = 0.2;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.45, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f8 }),
    );
    cabin.position.set(0, 0.55, -0.3);
    g.add(hull, cabin);
    g.position.set(x, -0.15, z);
    scene.add(g);
    return g;
  }
  const boats = [boat(-30, 230, 0xfff3e0), boat(50, 260, 0xff8a1e)];

  function blocked(x, z, radius) {
    if (x < WORLD.minX + radius || x > WORLD.maxX - radius || z < WORLD.minZ + radius || z > WORLD.maxZ - radius) {
      return true;
    }
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  }

  return {
    colliders,
    blocked,
    sun,
    oceanMat,
    orange,
    boats,
    update(time) {
      oceanMat.uniforms.uTime.value = time;
      orange.rotation.y = time * 0.35;
      boats[0].position.x = -30 + Math.sin(time * 0.25) * 8;
      boats[1].position.x = 50 + Math.cos(time * 0.2) * 10;
    },
    followSun(x, z) {
      sun.position.set(x - 30, 52, z + 12);
      sun.target.position.set(x, 0, z);
      sun.target.updateMatrixWorld();
    },
  };
}
