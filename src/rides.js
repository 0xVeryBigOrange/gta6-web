import * as THREE from 'three';

function paint(color, metal, rough) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: metal,
    roughness: rough,
    envMapIntensity: 0.8,
  });
}

export function buildBike() {
  const g = new THREE.Group();
  const steel = paint(0x2b3138, 0.72, 0.32);
  const orange = paint(0xff6a1a, 0.45, 0.38);
  const dark = paint(0x15171b, 0.4, 0.6);
  const addWheel = (z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.34, z);
    w.castShadow = true;
    g.add(w);
  };
  addWheel(0.78);
  addWheel(-0.78);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), orange);
  frame.position.set(0, 0.62, 0);
  frame.castShadow = true;
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), orange);
  tank.scale.set(0.7, 0.7, 1.3);
  tank.position.set(0, 0.78, 0.15);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.48), dark);
  seat.position.set(0, 0.78, -0.28);
  g.add(seat);
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), steel);
  fork.position.set(0, 0.62, 0.78);
  g.add(fork);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.05), steel);
  bar.position.set(0, 0.92, 0.62);
  g.add(bar);
  return g;
}

export function buildHeli() {
  const g = new THREE.Group();
  const bodyMat = paint(0xf2f4f7, 0.5, 0.34);
  const accent = paint(0xff6a1a, 0.4, 0.4);
  const dark = paint(0x1c2128, 0.6, 0.4);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fdfff,
    metalness: 0.05,
    roughness: 0.08,
    transparent: true,
    opacity: 0.45,
    envMapIntensity: 1,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), bodyMat);
  body.scale.set(0.85, 0.72, 1.35);
  body.position.y = 1.25;
  body.castShadow = true;
  g.add(body);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 2.4), bodyMat);
  boom.position.set(0, 1.35, -2.1);
  boom.castShadow = true;
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.4), accent);
  fin.position.set(0, 1.65, -3.15);
  g.add(fin);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), glass);
  canopy.scale.set(0.95, 0.7, 0.85);
  canopy.position.set(0, 1.45, 0.45);
  g.add(canopy);
  for (const x of [-0.45, 0.45]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.8), dark);
    skid.position.set(x, 0.28, 0);
    g.add(skid);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), dark);
    leg.position.set(x, 0.55, 0.2);
    g.add(leg);
  }
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.position.set(0, 2.05, 0);
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.03, 0.16), dark);
    blade.rotation.y = (i * Math.PI) / 2;
    rotor.add(blade);
  }
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.08), dark);
  tailRotor.name = 'tailRotor';
  tailRotor.position.set(0.12, 1.65, -3.15);
  g.add(tailRotor);
  return g;
}

export function buildPlane() {
  const g = new THREE.Group();
  const paintMat = paint(0xf7f4ef, 0.48, 0.32);
  const accent = paint(0xff6a1a, 0.35, 0.4);
  const dark = paint(0x22262c, 0.65, 0.35);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xb7e4ff,
    metalness: 0.08,
    roughness: 0.06,
    transparent: true,
    opacity: 0.42,
    envMapIntensity: 1,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), paintMat);
  body.scale.set(0.72, 0.62, 3.05);
  body.position.y = 1.15;
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.9, 14), accent);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 1.15, 3.35);
  g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.08, 1.25), paintMat);
  wing.position.set(0, 1.05, 0.15);
  wing.castShadow = true;
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.7), paintMat);
  tail.position.set(0, 1.55, -2.55);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.85), accent);
  fin.position.set(0, 1.95, -2.75);
  g.add(fin);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glass);
  canopy.scale.set(0.75, 0.5, 1.25);
  canopy.position.set(0, 1.62, 0.7);
  g.add(canopy);
  for (const [x, z] of [[-0.8, 0.3], [0.8, 0.3], [0, -2.1]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.16, z);
    g.add(wheel);
  }
  const prop = new THREE.Group();
  prop.name = 'propeller';
  prop.position.set(0, 1.15, 3.85);
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.04), dark));
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.04), dark));
  g.add(prop);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.2), accent);
  stripe.position.set(0, 1.72, 0.1);
  g.add(stripe);
  return g;
}

export function spinParts(vehicle, dt) {
  if (vehicle.propeller) vehicle.propeller.rotation.z += dt * (18 + Math.abs(vehicle.speed) * 0.7);
  if (vehicle.rotor) vehicle.rotor.rotation.y += dt * (10 + (vehicle.collective || 0) * 22);
  if (vehicle.tailRotor) vehicle.tailRotor.rotation.x += dt * 28;
}
