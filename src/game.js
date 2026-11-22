import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadGameAssets } from './assets.js';
import { buildWorld } from './world.js';
import { createActor, locomotion } from './actors.js';
import { buildBike, buildHeli, buildPlane, spinParts } from './rides.js';
import {
  COINS,
  GATES,
  GUARD_SPOTS,
  MISSIONS,
  PROPS,
  SPOTS,
  STARTING,
  VEHICLES,
  inWater,
  missionName,
} from './config.js';
import { getOrngMult, getPriceSource, getPrices, refreshPrices, setOrngMult, tickSimulated } from './prices.js';
import { loadSave, writeSave } from './save.js';
import { angNorm, clamp, dist2, fmtNum, fmtUsd, mulberry32 } from './util.js';
import { ACTIVITIES, GUIDE, RACE_GATES, dailyFor, levelFromRep, routeOnRoads } from './citylife.js';
import {
  cloud,
  createProfile,
  fetchBoard,
  fetchProfile,
  fetchRank,
  fetchScore,
  joinWorld,
  pushScore,
  signIn,
  signOut,
  signUp,
  validNick,
} from './cloud.js';
import { CAST, CHAPTERS, addAccessory, castById, makeNameTag, tintActor } from './story.js';

const WEAPONS = {
  fist: { name: '拳头', dmg: 24, cd: 0.48, range: 2.3 },
  pistol: { name: '手枪', dmg: 28, cd: 0.32, range: 70, mag: 12 },
  rifle: { name: '步枪', dmg: 16, cd: 0.1, range: 110, mag: 30 },
};

const PACK = { male: 'male', female: 'female', worker: 'worker', suit: 'suit' };

export class Game {
  constructor(root) {
    this.root = root;
    this.ui = createUI(root);
    this.input = createInput(this.ui.canvas);
    this.audio = createAudio();
    this.ui.bindTouch(this.input.pad);
    this.mode = 'boot';
    this.ready = false;
    this.time = 0;
    this.last = 0;
    this.frameDt = 0;
    this.camYaw = 0.4;
    this.camPitch = 0.35;
    this.camDist = 7.2;
    this.layoutMode = null;
    this.confirmNew = false;
    this.freezePolice = false;
    this.script = null;
    this.fireLatch = false;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.combatWantedCd = 0;
    this.invuln = 0;
    this.downTimer = 0;
    this.weapon = 'fist';
    this.cooldown = 0;
    this.reload = 0;
    this.animLock = 0;
    this.ammo = {
      pistol: { mag: 12, res: 48 },
      rifle: { mag: 30, res: 90 },
    };
    this.mission = null;
    this.done = new Set();
    this.collected = new Set();
    this.ownedCars = new Set(['sedan']);
    this.ownedProps = new Set();
    this.usd = STARTING.usd;
    this.bal = { ...STARTING.bal };
    this.objectiveSig = '';
    this.walletSig = '';
    this.promptSig = '';
    this.starSig = -1;
    this.headlineTimer = 0;
    this.priceTimer = 0;
    this.tod = 0.56;
    this.vehicles = [];
    this.npcs = [];
    this.coins = [];
    this.police = [];
    this.guards = [];
    this.sparks = [];
    this.player = { x: SPOTS.spawn.x, z: SPOTS.spawn.z, y: 0, vy: 0, yaw: 0, speed: 0, glide: 0, hp: 100, armor: 25 };
    this.guideStep = 0;
    this.rep = 0;
    this.finishedJobs = new Set();
    this.race = null;
    this.taxi = null;
    this.atmUse = 0;
    this.eventTimer = 20;
    this.daily = null;
    this.storyChapter = 0;
    this.asGuest = true;
    this.session = null;
    this.profile = null;
    this.scoreFloor = null;
    this.storyCast = [];
    this.remotes = new Map();
    this.worldChannel = null;
    this.poseTimer = 0;
    this.cloudTimer = 0;
    this.cutscene = null;
    this.boardReturn = 'play';
    this.onlineCount = 0;
    this.localTag = null;
    this.remoteCap = Math.min(window.innerWidth, window.innerHeight) <= 520 || window.innerWidth <= 700 ? 4 : 8;
    this.vehicle = null;
    this.rng = mulberry32(11);
    this.wireUi();
    this.ui.setContinueEnabled(!!loadSave());
    this.ui.setBoot(true, '正在铺设城区…');
    this.debug = this.makeDebug();
  }

  wireUi() {
    this.ui.onNew = () => this.newGame();
    this.ui.onContinue = () => this.continueGame();
    this.ui.onResume = () => this.setMode('play');
    this.ui.onQuit = () => {
      this.save();
      this.setMode('title');
    };
    this.ui.onSave = () => {
      this.save();
      this.ui.toast('已写入本地存档');
    };
    this.ui.onToggleSound = () => this.ui.setSoundLabel(this.audio.toggle());
    this.ui.onOpenExchange = () => this.openModal('exchange');
    this.ui.onTrade = (id, side, amount) => this.trade(id, side, amount);
    this.ui.onAcceptMission = (id) => this.acceptMission(id);
    this.ui.onAbandon = () => this.abandonMission();
    this.ui.onBuy = (id, pay) => this.buy(id, pay);
    this.ui.onCloseModal = () => this.closeModal();
    this.ui.onGuest = () => this.playGuest();
    this.ui.onLogout = () => this.logout();
    this.ui.onAuth = (form) => this.submitAuth(form);
    this.ui.onBoard = (tab) => this.openBoard(tab);
    this.ui.onBoardClose = () => this.closeBoard();
    this.ui.onCut = () => this.advanceCutscene();
    this.ui.setSoundLabel(true);
    this.ui.setAccountLine('还没登录。游客进度只留在这台设备。', false);
  }

  makeDebug() {
    return {
      tp: (x, z, y = null) => this.teleport(x, z, y),
      cam: (yaw, pitch, dist) => {
        if (yaw != null) this.camYaw = yaw;
        if (pitch != null) this.camPitch = pitch;
        if (dist != null) this.camDist = dist;
      },
      setWanted: (n) => {
        this.wanted = clamp(n, 0, 5);
        this.wantedTimer = 0;
        this.ensurePolice(true);
      },
      setFreezePolice: (v) => {
        this.freezePolice = !!v;
      },
      holdFor: (seconds, spec = {}) => {
        this.script = {
          until: this.time + seconds,
          axis: spec.axis || { x: 0, y: 0 },
          fire: !!spec.fire,
          boost: !!spec.boost,
          descend: !!spec.descend,
          jump: !!spec.jump,
        };
      },
      clearHold: () => {
        this.script = null;
      },
      give: (weapon) => {
        if (WEAPONS[weapon]) this.weapon = weapon;
      },
      hurt: (n) => this.hurt(n),
      enter: () => this.toggleVehicle(),
      interact: () => this.interact(),
      spawnDummy: (dist = 6) => this.spawnDummy(dist),
      snapshot: () => this.snapshot(),
      signUp: (email, password, nickname) => this.submitAuth({ mode: 'register', email, password, nickname }),
      signIn: (email, password) => this.submitAuth({ mode: 'login', email, password }),
      setNick: (nickname) => this.submitAuth({ mode: 'nick', nickname }),
    };
  }

  async boot() {
    this.setupThree();
    try {
      this.assets = await loadGameAssets(this.renderer, (text) => this.ui.setBoot(true, text));
    } catch (error) {
      this.ui.setBoot(true, '城区加载失败');
      throw error;
    }
    if (this.assets.environment) this.scene.environment = this.assets.environment;
    this.world = buildWorld(this.scene, this.assets);
    this.prepareTemplates();
    this.spawnCast();
    this.ready = true;
    this.mode = 'title';
    this.ui.setBoot(false);
    this.ui.showTitle();
    this.pushPrices();
    refreshPrices(this.rng).then(() => {
      if (this.mode !== 'boot') this.pushPrices();
    });
    this.last = performance.now();
    this.loop();
    this.bindAccount();
  }

  setupThree() {
    const lite = window.innerWidth <= 700 || (window.innerHeight <= 520 && window.innerWidth <= 1100);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd7c2a4, 0.00235);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2200);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui.canvas,
      antialias: !lite,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun = new THREE.DirectionalLight(0xfff1dd, 2.5);
    this.sun.castShadow = true;
    const shadow = (window.innerWidth <= 700 || (window.innerHeight <= 520 && window.innerWidth <= 1100)) ? 512 : 1024;
    this.sun.shadow.mapSize.set(shadow, shadow);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 140;
    this.sun.shadow.camera.left = -48;
    this.sun.shadow.camera.right = 48;
    this.sun.shadow.camera.top = 48;
    this.sun.shadow.camera.bottom = -48;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5438, 0.7);
    this.scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0x88b4ff, 0.25);
    this.scene.add(this.fill);
    this.scene.add(this.fill.target);
    const skyGeo = new THREE.SphereGeometry(900, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x6eb6e6) },
        uHorizon: { value: new THREE.Color(0xf0c39a) },
        uSun: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vPos = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSun;
        void main() {
          vec3 n = normalize(vPos);
          float h = smoothstep(-0.08, 0.55, n.y);
          vec3 col = mix(uHorizon, uTop, h);
          float sun = pow(max(dot(n, normalize(uSun)), 0.0), 140.0);
          col += vec3(1.0, 0.82, 0.55) * sun;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.22, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.ui?.syncLayout?.();
    const canvas = this.ui.canvas;
    const w = canvas.clientWidth || window.innerWidth;
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);
    const phone = document.documentElement.classList.contains('phone');
    const portrait = document.documentElement.classList.contains('portrait');
    const mode = phone ? (portrait ? 'port' : 'land') : 'desk';
    if (mode !== this.layoutMode) {
      this.layoutMode = mode;
      if (mode === 'port') {
        this.camDist = 11;
        this.camPitch = -0.22;
        this.camera.fov = 68;
      } else if (mode === 'land') {
        this.camDist = 9.4;
        this.camPitch = -0.18;
        this.camera.fov = 64;
      } else {
        this.camDist = 7.2;
        this.camPitch = 0.35;
        this.camera.fov = 62;
      }
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const cap = phone ? (portrait ? 1 : 1.15) : 1.35;
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    const shadow = phone ? 512 : 1024;
    if (this.sun.shadow.mapSize.x !== shadow) {
      this.sun.shadow.mapSize.set(shadow, shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.bloom.strength = phone ? 0.08 : 0.22;
    this.bloom.enabled = !phone;
    this.renderer.toneMappingExposure = phone ? 1.24 : 1.05;
  }

  prepareTemplates() {
    this.templates = {
      sedan: this.assets.cars.sedan,
      suv: this.assets.cars.suv,
      sport: this.assets.cars['hatchback-sports'],
      taxi: this.assets.cars.taxi,
      race: this.assets.cars.race,
      police: this.assets.cars.police,
      boat: this.assets.boat,
      bike: buildBike(),
      heli: buildHeli(),
      plane: buildPlane(),
    };
  }

  makeVehicle(id, x, z, yaw, flags = {}) {
    const def = VEHICLES.find((item) => item.id === id);
    const mesh = this.templates[id].clone(true);
    mesh.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    this.scene.add(mesh);
    const vehicle = {
      id,
      def,
      kind: def.kind,
      mesh,
      x,
      z,
      y: def.kind === 'boat' ? 0.2 : def.kind === 'heli' ? 0.35 : 0,
      yaw,
      speed: 0,
      throttle: 0,
      pitch: 0,
      roll: 0,
      vy: 0,
      collective: 0.42,
      personal: !!flags.personal,
      traffic: !!flags.traffic,
      police: !!flags.police,
      hotwired: !!flags.personal && this.ownedCars.has(id),
      seg: Math.floor(this.rng() * Math.max(1, this.world.roads.length)),
      segT: this.rng(),
      dir: this.rng() > 0.5 ? 1 : -1,
      propeller: null,
      rotor: null,
      tailRotor: null,
    };
    vehicle.propeller = mesh.getObjectByName('propeller');
    vehicle.rotor = mesh.getObjectByName('rotor');
    vehicle.tailRotor = mesh.getObjectByName('tailRotor');
    this.vehicles.push(vehicle);
    this.syncRide(vehicle, 0);
    return vehicle;
  }

  makeNpc(kind, dummy = false) {
    const actor = createActor(this.assets.people[PACK[kind] || 'male']);
    this.scene.add(actor.model);
    const npc = {
      actor,
      kind,
      x: 0,
      z: 0,
      yaw: 0,
      hp: 100,
      alive: true,
      team: 'civ',
      state: 'walk',
      behavior: 'walk',
      brave: this.rng() > 0.7,
      armed: false,
      speed: 0,
      tx: 0,
      tz: 0,
      timer: 2,
      shootCd: 1,
      animLock: 0,
      down: 0,
      active: true,
      placed: false,
      dummy,
    };
    actor.model.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = false;
    });
    actor.play('Idle');
    return npc;
  }

  spawnCast() {
    this.actor = createActor(this.assets.people.male);
    this.scene.add(this.actor.model);
    this.gun = this.assets.pistol.clone(true);
    this.gun.position.set(0.02, 0.04, 0.08);
    this.rifle = new THREE.Group();
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x24282e, metalness: 0.65, roughness: 0.38 });
    const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.62), rifleMat);
    rifleBody.position.z = 0.16;
    this.rifle.add(rifleBody);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), rifleMat);
    stock.position.set(0, -0.02, -0.12);
    this.rifle.add(stock);
    this.scene.add(this.gun, this.rifle);
    this.dressHero(this.actor);
    this.gun.visible = false;
    this.rifle.visible = false;

    this.makeVehicle('sedan', 4, 40, 0, { personal: true });
    this.makeVehicle('suv', -50, 36, Math.PI, { personal: true });
    this.makeVehicle('sport', -50, 48, Math.PI, { personal: true });
    this.makeVehicle('taxi', -66, 36, 0, { personal: true });
    this.makeVehicle('race', -66, 48, 0, { personal: true });
    this.makeVehicle('bike', -50, 22, 0.2, { personal: true });
    this.makeVehicle('boat', -400, 280, 0.4, { personal: true });
    this.makeVehicle('heli', -380, 239, Math.PI / 2, { personal: true });
    this.makeVehicle('plane', -510, -390, Math.PI / 2, { personal: true });
    this.makeVehicle('police', 86, -36, Math.PI, { police: true });
    const lite = Math.min(window.innerWidth, window.innerHeight) <= 520 || window.innerWidth <= 700;
    const trafficN = lite ? 8 : 14;
    for (let i = 0; i < trafficN; i += 1) {
      const id = ['sedan', 'taxi', 'suv', 'sport'][i % 4];
      const car = this.makeVehicle(id, 0, 0, 0, { traffic: true });
      car.mesh.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = false;
      });
      this.parkOnRoad(car);
    }
    for (let i = 0; i < (lite ? 4 : 8); i += 1) {
      const id = ['sedan', 'taxi', 'suv'][i % 3];
      const car = this.makeVehicle(id, 0, 0, 0, { parked: true });
      car.parked = true;
      car.mesh.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = false;
      });
      this.parkOnRoad(car);
      const seg = this.world.roads[car.seg % this.world.roads.length];
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      car.x += (-dz / len) * (seg.half + 1.6);
      car.z += (dx / len) * (seg.half + 1.6);
      car.yaw = Math.atan2(dx, dz);
    }

    const kinds = ['female', 'worker', 'male', 'suit', 'female', 'worker', 'male', 'suit'];
    const behaviors = ['walk', 'jog', 'chat', 'idle'];
    const crowd = lite ? 12 : 24;
    for (let i = 0; i < crowd; i += 1) {
      const npc = this.makeNpc(kinds[i % kinds.length]);
      npc.behavior = behaviors[i % behaviors.length];
      this.placeWalker(npc, i);
      if (i < 10) {
        const ang = (i / 10) * Math.PI * 2;
        npc.x = Math.cos(ang) * (6 + (i % 3) * 2);
        npc.z = 24 + Math.sin(ang) * (5 + (i % 2) * 3);
        npc.tx = npc.x + 6;
        npc.tz = npc.z + 4;
      } else if (i % 5 === 0) {
        npc.x = 96 + (i % 4) * 6;
        npc.z = 208;
        npc.behavior = 'idle';
      }
      this.npcs.push(npc);
    }
    for (let i = 0; i < 4; i += 1) {
      const cop = this.makeNpc('suit');
      cop.team = 'police';
      cop.armed = true;
      cop.hp = 80;
      cop.active = false;
      cop.actor.model.visible = false;
      this.npcs.push(cop);
      this.police.push(cop);
    }

    const coinGeo = new THREE.TorusGeometry(0.38, 0.12, 8, 14);
    const drops = [
      { id: 'ORNG', amt: 40 },
      { id: 'DOGE', amt: 25 },
      { id: 'SOL', amt: 0.2 },
      { id: 'ETH', amt: 0.01 },
      { id: 'BTC', amt: 0.0004 },
    ];
    this.world.roads.forEach((seg, i) => {
      if (i % 3 !== 0 || this.coins.length >= 16) return;
      const t = 0.35 + (i % 4) * 0.12;
      const drop = drops[this.coins.length % drops.length];
      const color = new THREE.Color(COINS.find((c) => c.id === drop.id).color);
      const mesh = new THREE.Mesh(
        coinGeo,
        new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.25, emissive: color, emissiveIntensity: 0.25 }),
      );
      mesh.rotation.x = Math.PI / 2;
      const coin = {
        id: `c${i}`,
        drop,
        mesh,
        x: seg.ax + (seg.bx - seg.ax) * t,
        z: seg.az + (seg.bz - seg.az) * t,
      };
      this.scene.add(mesh);
      this.coins.push(coin);
    });

    this.beacon = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xff8a1e, emissive: 0xff6a00, emissiveIntensity: 0.6 }),
    );
    this.beacon.position.y = 2.4;
    this.scene.add(this.beacon);
    this.rings = GATES.map((gate) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(7, 0.25, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xff8a1e, emissive: 0xff6a00, emissiveIntensity: 0.8 }),
      );
      mesh.position.set(gate.x, gate.y, gate.z);
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });
    this.bags = SPOTS.loot.map((spot) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.45, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xffb020, roughness: 0.5 }),
      );
      mesh.position.set(spot.x, 0.4, spot.z);
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });
    this.caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x222833, metalness: 0.5, roughness: 0.35 }),
    );
    this.caseMesh.visible = false;
    this.scene.add(this.caseMesh);
    this.buildLife();
    const sparkGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc14a });
    for (let i = 0; i < 8; i += 1) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, life: 0 });
    }
  }

  parkOnRoad(vehicle) {
    const seg = this.world.roads[vehicle.seg % this.world.roads.length];
    vehicle.x = seg.ax + (seg.bx - seg.ax) * vehicle.segT;
    vehicle.z = seg.az + (seg.bz - seg.az) * vehicle.segT;
    vehicle.yaw = Math.atan2(seg.bx - seg.ax, seg.bz - seg.az);
  }

  placeWalker(npc, index) {
    const seg = this.world.roads[(index * 3) % this.world.roads.length];
    const t = 0.2 + this.rng() * 0.6;
    npc.x = seg.ax + (seg.bx - seg.ax) * t + 8;
    npc.z = seg.az + (seg.bz - seg.az) * t + (index % 2 ? 8 : -8);
    if (inWater(npc.x, npc.z) || this.world.blocked(npc.x, npc.z, 0.4, 'walk')) {
      npc.x = SPOTS.spawn.x + 6 + index;
      npc.z = SPOTS.spawn.z + 4;
    }
    npc.tx = npc.x + 12;
    npc.tz = npc.z;
  }

  loop = (now) => {
    requestAnimationFrame(this.loop);
    const wall = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    this.frameDt = wall;
    const step = this.mode === 'play' ? wall : 0;
    if (step) this.time += step;
    this.update(step, wall);
    this.composer.render();
    this.fpsAccum = (this.fpsAccum || 0) + wall;
    this.fpsFrames = (this.fpsFrames || 0) + 1;
    if (this.fpsAccum > 0.4) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      const clock = this.clockLabel();
      this.ui.setFps(`${this.fps} FPS · ${clock}`);
    }
  };

  clockLabel() {
    const mins = Math.floor(this.tod * 24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt, wall) {
    this.consumeKeys();
    if (this.mode === 'title') {
      this.camYaw += wall * 0.05;
      this.focusAt(SPOTS.spawn.x, 0, SPOTS.spawn.z);
    } else if (this.mode === 'play') {
      const ctrl = this.controls();
      if (this.downTimer > 0) {
        this.downTimer -= dt;
        if (this.downTimer <= 0) this.respawn();
      } else {
        this.updateRideOrPlayer(dt, ctrl);
        this.updateCombat(dt, ctrl);
      }
      this.updateTraffic(dt);
      this.updateNpcs(dt);
      this.updateWanted(dt);
      this.updateMission(dt);
      this.updateLife(dt);
      this.updateGps();
      this.updateCoins();
      this.updateRemotes(dt);
      this.poseTimer += dt;
      if (this.poseTimer > 0.12) {
        this.poseTimer = 0;
        this.sendPose();
      }
      this.cloudTimer += dt;
      if (this.cloudTimer > 20) {
        this.cloudTimer = 0;
        this.syncScore();
      }
      this.invuln = Math.max(0, this.invuln - dt);
      this.combatWantedCd = Math.max(0, this.combatWantedCd - dt);
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.reload = Math.max(0, this.reload - dt);
      this.animLock = Math.max(0, this.animLock - dt);
      this.priceTimer += dt;
      if (this.priceTimer > 24) {
        this.priceTimer = 0;
        tickSimulated(this.rng);
        refreshPrices(this.rng).then(() => this.pushPrices());
      }
    }
    this.syncActors(dt);
    this.updateCamera(wall);
    this.updateTod(wall);
    const focus = this.focus();
    this.world.update(focus.x, focus.z, this.time);
    this.updateSparks(wall);
    this.updateHud(dt);
    this.input.endFrame();
    this.fireLatch = false;
  }

  controls() {
    if (this.script && this.time < this.script.until) {
      return {
        axis: this.script.axis,
        fire: this.script.fire,
        boost: this.script.boost,
        descend: this.script.descend,
        jump: this.script.jump,
      };
    }
    return {
      axis: this.input.axis(),
      fire: this.input.fireHeld() || this.fireLatch,
      boost: this.input.boost(),
      descend: this.input.descend(),
      jump: this.input.jumpHeld(),
    };
  }

  consumeKeys() {
    if (!this.ready) return;
    if (this.input.pressed('Escape')) {
      if (this.ui.modalOpen()) this.closeModal();
      else if (this.ui.helpOpen()) this.ui.hideHelp();
      else if (this.mode === 'play') this.setMode('pause');
      else if (this.mode === 'pause') this.setMode('play');
    }
    if (this.mode === 'cutscene' && (this.input.pressed('Space') || this.input.pressed('KeyE') || this.input.clicked())) {
      this.advanceCutscene();
      return;
    }
    if (this.mode !== 'play') return;
    if (this.input.pressed('KeyT')) this.sendEmote();
    if (this.input.clicked()) this.input.requestLock();
    if (this.input.pressed('KeyH')) this.ui.showHelp();
    if (this.input.pressed('Escape')) return;
    if (this.input.pressed('KeyP') || this.input.pad.pause) this.setMode('pause');
    if (this.input.pressed('KeyM') || this.input.pad.mission) this.openModal('missions');
    if (this.input.pressed('KeyE') || this.input.pad.interact) this.interact();
    if (this.input.pressed('KeyF') || this.input.pad.car) this.toggleVehicle();
    if (this.input.pressed('Digit1')) this.weapon = 'fist';
    if (this.input.pressed('Digit2')) this.weapon = 'pistol';
    if (this.input.pressed('Digit3')) this.weapon = 'rifle';
    if (this.input.pressed('KeyR')) this.startReload();
    if (this.input.pressed('Space') && this.vehicle && this.vehicle.kind !== 'heli' && this.vehicle.kind !== 'plane') this.audio.horn();
  }

  updateRideOrPlayer(dt, ctrl) {
    if (this.vehicle) this.updateVehicle(this.vehicle, dt, ctrl);
    else this.updatePlayer(dt, ctrl);
  }

  updatePlayer(dt, ctrl) {
    const moving = Math.hypot(ctrl.axis.x, ctrl.axis.y) > 0.08;
    const wish = moving ? (ctrl.boost ? 8.8 : 5.25) : 0;
    const rate = wish > this.player.glide ? 18 : 11;
    this.player.glide = THREE.MathUtils.damp(this.player.glide, wish, rate, dt);
    const yaw = this.camYaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const mx = sin * ctrl.axis.y + cos * ctrl.axis.x;
    const mz = cos * ctrl.axis.y - sin * ctrl.axis.x;
    if (moving) {
      const face = Math.atan2(mx, mz);
      this.player.yaw += angNorm(face - this.player.yaw) * Math.min(1, dt * 16);
      this.player.pushX = mx;
      this.player.pushZ = mz;
    }
    const airborne = this.player.y > 0.08;
    const spd = airborne ? Math.max(this.player.glide, 4.2) : this.player.glide;
    const ix = moving ? mx : (this.player.pushX || 0);
    const iz = moving ? mz : (this.player.pushZ || 0);
    const nx = this.player.x + ix * spd * dt;
    const nz = this.player.z + iz * spd * dt;
    const next = this.world.slide(this.player.x, this.player.z, nx, nz, 0.38, 'walk');
    const blocked = Math.hypot(next.x - nx, next.z - nz) > 0.12;
    if (blocked && airborne && spd > 3) {
      this.player.x = nx;
      this.player.z = nz;
    } else {
      this.player.x = next.x;
      this.player.z = next.z;
    }
    if (ctrl.jump && this.player.y <= 0.04) {
      this.player.vy = blocked ? 8.2 : 7.5;
      this.actor?.play('Roll', { once: true, fade: 0.06 });
      this.animLock = 0.32;
    }
    this.player.vy -= 26 * dt;
    this.player.y = Math.max(0, this.player.y + this.player.vy * dt);
    if (this.player.y <= 0) this.player.vy = 0;
    const moved = Math.hypot(this.player.x - (this.player.prevX ?? this.player.x), this.player.z - (this.player.prevZ ?? this.player.z));
    this.player.prevX = this.player.x;
    this.player.prevZ = this.player.z;
    this.player.speed = dt > 0 ? moved / dt : 0;
  }

  updateVehicle(v, dt, ctrl) {
    if (v.kind === 'plane') this.updatePlane(v, dt, ctrl);
    else if (v.kind === 'heli') this.updateHeli(v, dt, ctrl);
    else this.updateGround(v, dt, ctrl);
    this.player.x = v.x;
    this.player.z = v.z;
    this.player.y = v.y;
    this.player.speed = Math.abs(v.speed);
    this.player.yaw = v.yaw;
  }

  updateGround(v, dt, ctrl) {
    const water = inWater(v.x, v.z);
    let accel = v.def.accel;
    let max = v.def.max;
    if (v.kind === 'boat') {
      if (!water) {
        accel *= 0.05;
        max = 2.4;
      }
    } else if (water) {
      accel *= 0.08;
      max = 3;
    }
    if (ctrl.boost && v.kind !== 'boat') max *= 1.06;
    const throttle = ctrl.axis.y;
    if (throttle > 0.05) v.speed += accel * throttle * dt;
    else if (throttle < -0.05) v.speed -= accel * 0.7 * dt;
    else v.speed *= Math.pow(0.5, dt);
    v.speed = clamp(v.speed, -max * 0.35, max);
    const steer = ctrl.axis.x * (v.kind === 'bike' ? 2.7 : 2.2);
    if (Math.abs(v.speed) > 0.4) v.yaw += steer * dt * clamp(v.speed, -10, 10) / 10;
    v.roll = v.kind === 'bike' ? -ctrl.axis.x * Math.min(1, Math.abs(v.speed) / 12) * 0.45 : 0;
    v.pitch = 0;
    v.y = v.kind === 'boat' && water ? 0.18 + Math.sin(this.time * 2.2) * 0.05 : 0;
    this.moveRide(v, dt, v.kind === 'boat' ? 'boat' : 'car');
  }

  updatePlane(v, dt, ctrl) {
    if (ctrl.boost) v.throttle = Math.min(1, v.throttle + dt * 0.4);
    if (ctrl.descend) v.throttle = Math.max(0, v.throttle - dt * 0.5);
    v.pitch = clamp(v.pitch + ctrl.axis.y * dt * 0.85, -0.75, 0.85);
    v.roll = clamp(v.roll + ctrl.axis.x * dt * 1.25, -1.05, 1.05);
    if (Math.abs(ctrl.axis.x) < 0.08) v.roll *= Math.pow(0.18, dt);
    if (Math.abs(ctrl.axis.y) < 0.08) v.pitch *= Math.pow(0.4, dt);
    v.yaw += -v.roll * dt * 0.85;
    const target = v.throttle * v.def.max;
    v.speed += (target - v.speed) * Math.min(1, dt * 0.4);
    const airborne = v.speed > 23 || v.y > 1.2;
    if (!airborne) {
      v.y = 0;
      v.vy = 0;
    } else {
      const climb = Math.max(0, v.speed - 21) * 0.24 + v.pitch * 18;
      v.y = Math.max(0, v.y + climb * dt);
    }
    this.moveRide(v, dt, v.y > 3 ? 'fly' : 'car');
  }

  updateHeli(v, dt, ctrl) {
    const up = ctrl.boost || this.input.horn() || (this.script && this.time < this.script.until && this.script.boost);
    if (up) v.collective = Math.min(1, v.collective + dt * 0.5);
    if (ctrl.descend) v.collective = Math.max(0, v.collective - dt * 0.55);
    const lift = (v.collective - 0.48) * 16;
    v.vy += (lift - v.vy) * Math.min(1, dt * 2.2);
    v.y += v.vy * dt;
    if (v.y < 0.35) {
      v.y = 0.35;
      v.vy = Math.max(0, v.vy);
    }
    v.yaw += ctrl.axis.x * dt * 1.35;
    v.pitch = THREE.MathUtils.lerp(v.pitch, -ctrl.axis.y * 0.4, Math.min(1, dt * 3));
    v.roll = THREE.MathUtils.lerp(v.roll, ctrl.axis.x * 0.28, Math.min(1, dt * 3));
    v.speed = ctrl.axis.y * 30;
    const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
    const mode = v.y > 4 ? 'fly' : 'walk';
    const next = this.world.slide(v.x, v.z, nx, nz, 1.4, mode);
    v.x = next.x;
    v.z = next.z;
  }

  moveRide(v, dt, mode) {
    const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
    const radius = v.kind === 'bike' ? 0.55 : v.kind === 'plane' ? 1.6 : 1.2;
    const next = this.world.slide(v.x, v.z, nx, nz, radius, mode);
    if (Math.abs(v.speed) > 3 && next.x === v.x && next.z === v.z) v.speed *= 0.55;
    v.x = next.x;
    v.z = next.z;
  }

  updateTraffic(dt) {
    const focus = this.focus();
    for (const v of this.vehicles) {
      if (!v.traffic || v === this.vehicle) continue;
      const seg = this.world.roads[v.seg % this.world.roads.length];
      if (!seg) continue;
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      const red = this.signalRed && this.signals?.some((light) => Math.hypot(light.x - v.x, light.z - v.z) < 12);
      v.speed = red ? 1.4 : 16;
      v.segT += v.dir * (v.speed * dt) / len;
      if (v.segT > 1 || v.segT < 0) {
        v.segT = clamp(v.segT, 0, 1);
        v.dir *= -1;
        if (this.rng() > 0.4) v.seg = (v.seg + 1 + Math.floor(this.rng() * 4)) % this.world.roads.length;
      }
      v.x = seg.ax + dx * v.segT;
      v.z = seg.az + dz * v.segT;
      v.yaw = Math.atan2(dx * v.dir, dz * v.dir);
      v.y = 0;
      if (Math.hypot(v.x - focus.x, v.z - focus.z) > 190) {
        v.seg = Math.floor(this.rng() * this.world.roads.length);
        v.segT = this.rng();
        this.parkOnRoad(v);
      }
    }
    if (this.wanted >= 2 && !this.freezePolice) {
      const car = this.vehicles.find((item) => item.police && item !== this.vehicle);
      if (car) {
        const dx = focus.x - car.x;
        const dz = focus.z - car.z;
        car.yaw = Math.atan2(dx, dz);
        car.speed = 16;
        this.moveRide(car, dt, 'car');
      }
    }
  }

  updateNpcs(dt) {
    const focus = this.focus();
    for (const npc of this.npcs) {
      if (npc.team === 'story') {
        const d = Math.hypot(npc.x - focus.x, npc.z - focus.z);
        npc.actor.model.visible = d < 170;
        npc.actor.model.position.set(npc.x, 0, npc.z);
        npc.actor.model.rotation.y = npc.yaw;
        if (d < 72) npc.actor.mixer.update(dt);
        continue;
      }
      if (npc.team === 'police' && !npc.active) {
        npc.actor.model.visible = false;
        continue;
      }
      if (npc.team === 'guard' && this.mission?.id !== 'harbor') {
        npc.actor.model.visible = false;
        continue;
      }
      const d = Math.hypot(npc.x - focus.x, npc.z - focus.z);
      npc.actor.model.visible = d < 120;
      if (!npc.alive) {
        npc.down += dt;
        npc.animLock = 5;
        if (npc.down > 12 && npc.team === 'civ' && !npc.dummy) this.placeWalker(npc, Math.floor(this.rng() * 20));
        if (npc.down > 12 && npc.team === 'civ' && !npc.dummy) {
          npc.alive = true;
          npc.hp = 100;
          npc.state = 'walk';
          npc.down = 0;
          npc.animLock = 0;
        }
        continue;
      }
      if (d > 95) continue;
      npc.animLock = Math.max(0, npc.animLock - dt);
      npc.shootCd = Math.max(0, npc.shootCd - dt);
      const hostile = npc.state === 'fight' || (npc.team !== 'civ' && d < 55);
      if (npc.state === 'flee') {
        npc.timer -= dt;
        const away = Math.atan2(npc.x - focus.x, npc.z - focus.z);
        this.stepNpc(npc, away, 5.2, dt);
        if (npc.timer <= 0) npc.state = 'walk';
      } else if (hostile && !this.freezePolice) {
        const toward = Math.atan2(focus.x - npc.x, focus.z - npc.z);
        npc.yaw = toward;
        if (d > 12 && npc.armed) this.stepNpc(npc, toward, 4.4, dt);
        else if (d > 2.1 && !npc.armed) this.stepNpc(npc, toward, 4.6, dt);
        else npc.speed = 0;
        if (npc.armed && d < 26 && npc.shootCd <= 0 && this.clearLos(npc.x, npc.z, focus.x, focus.z)) {
          npc.shootCd = 0.95;
          npc.actor.play('Shoot_OneHanded', { once: true, fade: 0.05 });
          npc.animLock = 0.35;
          this.spark(focus.x, 1.2, focus.z);
          if (this.invuln <= 0 && d < 28) this.hurt(npc.team === 'police' ? 8 : 7);
        } else if (!npc.armed && d < 2.05 && npc.shootCd <= 0) {
          npc.shootCd = 0.7;
          npc.actor.play('Punch', { once: true, fade: 0.05 });
          npc.animLock = 0.4;
          if (this.invuln <= 0) this.hurt(12);
        }
      } else if (npc.state !== 'fight') {
        npc.timer -= dt;
        if (npc.behavior === 'idle' || npc.behavior === 'chat') {
          npc.speed = 0;
          if (npc.behavior === 'chat' && npc.animLock <= 0 && Math.floor(this.time + npc.x) % 7 === 0) {
            npc.actor.play('Wave', { once: true, fade: 0.08 });
            npc.animLock = 1.15;
          }
        } else {
          const pace = npc.behavior === 'jog' ? 3.6 : 2.35;
          const toward = Math.atan2(npc.tx - npc.x, npc.tz - npc.z);
          this.stepNpc(npc, toward, pace, dt);
          if (npc.timer <= 0 || Math.hypot(npc.tx - npc.x, npc.tz - npc.z) < 1.4) {
            npc.tx = npc.x + (this.rng() - 0.5) * 28;
            npc.tz = npc.z + (this.rng() - 0.5) * 28;
            npc.timer = 2.4 + this.rng() * 3.5;
          }
        }
        if (this.weapon !== 'fist' && d < 10 && this.rng() > 0.4 && npc.team === 'civ') {
          npc.state = 'flee';
          npc.timer = 4;
        }
      }
      if (npc.alive) locomotion(npc.actor, npc.speed, npc.animLock);
    }
  }

  stepNpc(npc, yaw, speed, dt) {
    npc.yaw = yaw;
    npc.speed = speed;
    const nx = npc.x + Math.sin(yaw) * speed * dt;
    const nz = npc.z + Math.cos(yaw) * speed * dt;
    const next = this.world.slide(npc.x, npc.z, nx, nz, 0.4, 'walk');
    npc.x = next.x;
    npc.z = next.z;
  }

  updateCombat(dt, ctrl) {
    if (!ctrl.fire || this.downTimer > 0) return;
    if (this.cooldown > 0 || this.reload > 0) return;
    const spec = WEAPONS[this.weapon];
    if (this.weapon !== 'fist') {
      const mag = this.ammo[this.weapon];
      if (mag.mag <= 0) {
        this.startReload();
        return;
      }
      mag.mag -= 1;
      this.actor.play('Shoot_OneHanded', { once: true, fade: 0.04 });
      this.animLock = 0.22;
      this.audio.shot(this.weapon);
      this.rayDamage(spec);
    } else {
      this.actor.play('Punch', { once: true, fade: 0.04 });
      this.animLock = 0.42;
      this.melee(spec);
    }
    this.cooldown = spec.cd;
  }

  rayDamage(spec) {
    this.camera.updateMatrixWorld();
    const origin = this.camera.position;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let best = null;
    let bestT = spec.range;
    for (const npc of this.npcs) {
      if (!npc.alive || !npc.actor.model.visible) continue;
      const ox = npc.x - origin.x;
      const oy = 1.05 - origin.y;
      const oz = npc.z - origin.z;
      const b = ox * dir.x + oy * dir.y + oz * dir.z;
      const c = ox * ox + oy * oy + oz * oz - 0.6 * 0.6;
      const h = b * b - c;
      if (h < 0) continue;
      const t = b - Math.sqrt(h);
      if (t > 0.6 && t < bestT) {
        bestT = t;
        best = npc;
      }
    }
    const hit = origin.clone().addScaledVector(dir, Math.min(bestT, 12));
    this.spark(hit.x, hit.y, hit.z);
    if (!best) return;
    if (!this.clearLos(origin.x, origin.z, best.x, best.z)) return;
    this.damageNpc(best, spec.dmg);
  }

  melee(spec) {
    const fx = Math.sin(this.player.yaw);
    const fz = Math.cos(this.player.yaw);
    let hit = false;
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const dx = npc.x - this.player.x;
      const dz = npc.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > spec.range) continue;
      const dot = (dx * fx + dz * fz) / (dist || 1);
      if (dot < 0.2 && dist > 1.2) continue;
      this.damageNpc(npc, spec.dmg);
      this.spark(npc.x, 1.2, npc.z);
      hit = true;
    }
    if (hit) this.audio.shot('fist');
  }

  damageNpc(npc, amount) {
    npc.hp -= amount;
    this.spark(npc.x, 1.3, npc.z);
    const dead = npc.hp <= 0;
    if (npc.team === 'civ' || npc.team === 'guard') {
      if (this.combatWantedCd <= 0) {
        this.addWanted(dead ? 2 : 1, dead ? '有人倒下了' : '动手了');
        this.combatWantedCd = dead ? 1 : 2.2;
      }
    }
    if (dead) {
      npc.alive = false;
      npc.down = 0;
      npc.hp = 0;
      npc.actor.play('Death', { once: true, hold: true, fade: 0.05 });
      npc.animLock = 8;
      if (npc.team === 'police') this.player.armor = Math.min(100, this.player.armor + 15);
      return;
    }
    npc.actor.play('RecieveHit', { once: true, fade: 0.04 });
    npc.animLock = 0.35;
    if (npc.team === 'civ') {
      npc.state = npc.brave ? 'fight' : 'flee';
      npc.timer = 5;
      npc.armed = false;
    }
  }

  startReload() {
    if (this.weapon === 'fist' || this.reload > 0) return;
    const mag = this.ammo[this.weapon];
    const size = WEAPONS[this.weapon].mag;
    if (mag.mag >= size || mag.res <= 0) return;
    this.reload = this.weapon === 'rifle' ? 1.5 : 1.05;
    const need = size - mag.mag;
    const take = Math.min(need, mag.res);
    mag.mag += take;
    mag.res -= take;
    this.ui.toast(this.weapon === 'rifle' ? '步枪换弹' : '手枪换弹');
  }

  hurt(amount) {
    if (this.invuln > 0 || this.downTimer > 0 || this.player.hp <= 0) return;
    let left = amount;
    if (this.player.armor > 0) {
      const soak = Math.min(this.player.armor, left * 0.65);
      this.player.armor -= soak;
      left -= soak;
    }
    this.player.hp = Math.max(0, this.player.hp - left);
    this.ui.flashHurt();
    this.actor.play('RecieveHit', { once: true, fade: 0.04 });
    this.animLock = 0.25;
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.downTimer = 1.15;
      this.actor.play('Death', { once: true, hold: true, fade: 0.05 });
      this.audio.fail();
      this.ui.toast('你倒下了');
    }
  }

  respawn() {
    const fine = Math.min(this.usd, Math.max(100, this.usd * 0.12));
    this.usd -= fine;
    this.walletSig = '';
    this.player.hp = 100;
    this.player.armor = Math.max(this.player.armor, 10);
    this.wanted = Math.max(0, this.wanted - 2);
    this.invuln = 2.5;
    this.downTimer = 0;
    this.ammo.pistol.mag = WEAPONS.pistol.mag;
    this.ammo.rifle.mag = WEAPONS.rifle.mag;
    if (this.vehicle) this.exitVehicle();
    this.teleport(SPOTS.hospital.x, SPOTS.hospital.z, 0);
    this.ensurePolice(true);
    const failed = this.mission && ['sec', 'rug', 'harbor'].includes(this.mission.id);
    if (failed) this.failMission('送到医院，任务失败');
    this.ui.toast(`橙子医院把你捞回来了，账单 ${fmtUsd(fine)}`);
    this.actor.play('Idle', { fade: 0.05 });
    this.animLock = 0;
  }

  clearLos(ax, az, bx, bz) {
    const steps = 7;
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (this.world.blocked(x, z, 0.2, 'walk')) return false;
    }
    return true;
  }

  spark(x, y, z) {
    const spark = this.sparks.find((item) => item.life <= 0) || this.sparks[0];
    spark.life = 0.16;
    spark.mesh.visible = true;
    spark.mesh.position.set(x, y, z);
  }

  updateSparks(dt) {
    for (const spark of this.sparks) {
      if (spark.life <= 0) continue;
      spark.life -= dt;
      spark.mesh.scale.setScalar(1 + (0.16 - spark.life) * 6);
      if (spark.life <= 0) spark.mesh.visible = false;
    }
  }

  updateWanted(dt) {
    this.ensurePolice(false);
    let nearest = Infinity;
    for (const cop of this.police) {
      if (!cop.active || !cop.alive) continue;
      nearest = Math.min(nearest, Math.hypot(cop.x - this.player.x, cop.z - this.player.z));
    }
    const need = this.ownedProps.size ? 3.5 : 6;
    if (this.wanted > 0 && nearest > 54) this.wantedTimer += dt;
    else this.wantedTimer = 0;
    if (this.wanted > 0 && this.wantedTimer >= need) {
      this.wanted -= 1;
      this.wantedTimer = 0;
      if (this.wanted === 0) this.ui.toast('通缉解除');
    }
    const speed = this.vehicle ? Math.abs(this.vehicle.speed) : this.player.speed;
    const airborne = this.vehicle && this.vehicle.y > 3;
    if (this.wanted > 0 && nearest < 2.7 && speed < 4 && !airborne) this.bustTimer += dt;
    else this.bustTimer = Math.max(0, this.bustTimer - dt);
    if (this.bustTimer > 1.55) this.bust();
    if (this.mission?.id === 'sec' && this.wanted === 0) this.completeMission();
  }

  ensurePolice(forcePlace) {
    const need = this.wanted === 0 ? 0 : Math.min(4, this.wanted);
    const focus = this.focus();
    this.police.forEach((cop, index) => {
      const active = index < need;
      if (!active) {
        cop.active = false;
        cop.placed = false;
        return;
      }
      cop.active = true;
      if (!cop.alive && cop.down > 5) cop.placed = false;
      const dist = Math.hypot(cop.x - focus.x, cop.z - focus.z);
      if (!cop.placed || forcePlace || (!this.freezePolice && dist > 110)) {
        const ang = this.rng() * Math.PI * 2;
        const distOut = 32 + this.rng() * 10;
        cop.x = focus.x + Math.cos(ang) * distOut;
        cop.z = focus.z + Math.sin(ang) * distOut;
        if (this.world.blocked(cop.x, cop.z, 0.4, 'walk') || inWater(cop.x, cop.z)) {
          cop.x = focus.x + 28;
          cop.z = focus.z;
        }
        cop.placed = true;
        cop.alive = true;
        cop.hp = 80;
        cop.down = 0;
      }
    });
  }

  bust() {
    this.bustTimer = 0;
    this.wanted = 0;
    const fine = Math.min(this.usd, Math.max(150, this.usd * 0.12));
    this.usd -= fine;
    this.walletSig = '';
    if (this.vehicle) this.exitVehicle();
    this.teleport(SPOTS.safehouse.x + 6, SPOTS.safehouse.z, 0);
    this.ensurePolice(true);
    const failed = this.mission && (this.mission.id === 'sec' || this.mission.id === 'rug');
    if (failed) this.failMission('被 SEC 约谈，任务失败');
    this.audio.fail();
    this.ui.toast(`约谈结束，罚款 ${fmtUsd(fine)}`);
  }

  addWanted(amount, reason) {
    const next = clamp(this.wanted + amount, 0, 5);
    if (next === this.wanted) return;
    this.wanted = next;
    this.wantedTimer = 0;
    this.ensurePolice(false);
    if (reason) this.ui.toast(`${reason} · ${this.wanted} 星`);
  }

  updateMission(dt) {
    const mission = this.mission;
    this.bags.forEach((bag, i) => {
      bag.visible = mission?.id === 'rug' && mission.phase === 'loot' && !mission.got[i];
      bag.rotation.y = this.time;
    });
    this.caseMesh.visible = mission?.id === 'cold' && mission.phase === 'pickup';
    if (this.caseMesh.visible) this.caseMesh.position.set(SPOTS.coldPickup.x, 0.4, SPOTS.coldPickup.z);
    this.rings.forEach((ring, i) => {
      ring.visible = mission?.id === 'sky' && mission.phase === 'gates' && i >= mission.gate;
      ring.rotation.y = this.time * 0.4;
    });
    if (mission?.id && String(mission.id).startsWith('story-')) {
      this.updateStoryMission(mission);
      return;
    }
    if (!mission) {
      this.beacon.visible = false;
      if (this.objectiveSig !== 'idle') {
        this.objectiveSig = 'idle';
        this.ui.setObjective('收集硬币，按 M 接任务。市中心有橙子交易所。');
      }
      return;
    }
    const here = this.focus();
    let target = null;
    let text = '';
    if (mission.id === 'cold') {
      mission.time -= dt;
      if (mission.time <= 0) {
        this.failMission('冷钱包专送超时');
        return;
      }
      if (mission.phase === 'pickup') {
        target = SPOTS.coldPickup;
        text = `冷钱包专送 · 去港口取货 · ${Math.ceil(mission.time)}s`;
        if (dist2(here.x, here.z, target.x, target.z) < target.r * target.r) {
          mission.phase = 'deliver';
          this.ui.toast('拿到冷钱包，送到海滩公寓');
        }
      } else {
        target = SPOTS.coldDrop;
        text = `冷钱包专送 · 送到海滩公寓 · ${Math.ceil(mission.time)}s`;
        if (dist2(here.x, here.z, target.x, target.z) < target.r * target.r) {
          this.completeMission();
          return;
        }
      }
    } else if (mission.id === 'sec') {
      text = `甩掉 SEC · 当前 ${this.wanted} 星，拉开距离直到归零`;
    } else if (mission.id === 'pump') {
      if (mission.phase === 'goto') {
        target = SPOTS.pump;
        text = '模因币拉盘 · 到海滩拉盘点按 E';
      } else if (mission.phase === 'sell') {
        mission.time -= dt;
        target = SPOTS.exchange;
        text = `拉盘中 · 到交易所卖掉至少 1000 ORNG · ${Math.ceil(mission.time)}s`;
        if (mission.time <= 0) {
          setOrngMult(0.22);
          mission.phase = 'dump';
          mission.time = 8;
          this.ui.toast('崩了。大橙子币正在归零');
          this.pushPrices();
        }
      } else if (mission.phase === 'dump') {
        mission.time -= dt;
        text = '已经崩盘。这次拉盘失败了';
        if (mission.time <= 0) this.failMission('拉盘窗口错过了');
      }
    } else if (mission.id === 'rug') {
      if (mission.phase === 'loot') {
        const left = mission.got.findIndex((flag) => !flag);
        target = SPOTS.loot[left];
        text = `Rug Pull · 抢走资金袋 ${mission.got.filter(Boolean).length}/3`;
        mission.got.forEach((flag, i) => {
          if (flag) return;
          const spot = SPOTS.loot[i];
          if (dist2(here.x, here.z, spot.x, spot.z) < 3.2 * 3.2) mission.got[i] = true;
        });
        if (mission.got.every(Boolean)) {
          mission.phase = 'escape';
          this.wanted = Math.max(this.wanted, 4);
          this.ensurePolice(true);
          this.ui.toast('袋子齐了，回安全屋');
        }
      } else {
        target = SPOTS.safehouse;
        text = 'Rug Pull · 逃回橙子安全屋';
        if (dist2(here.x, here.z, target.x, target.z) < target.r * target.r) {
          this.completeMission();
          return;
        }
      }
    } else if (mission.id === 'sky') {
      if (mission.phase === 'board') {
        target = SPOTS.airport;
        text = '航线投送 · 到机场登上轻航';
        if (this.vehicle?.kind === 'plane') {
          mission.phase = 'gates';
          mission.gate = 0;
          this.ui.toast('拉满油门，穿过三道橙环');
        }
      } else {
        const gate = GATES[mission.gate];
        target = gate;
        text = `航线投送 · 穿过橙环 ${mission.gate + 1}/3`;
        if (this.vehicle?.kind === 'plane' && here.y > 8) {
          const d = Math.hypot(here.x - gate.x, here.y - gate.y, here.z - gate.z);
          if (d < 16) {
            mission.gate += 1;
            this.ui.toast(`橙环 ${mission.gate}/3`);
            if (mission.gate >= GATES.length) {
              this.completeMission();
              return;
            }
          }
        }
      }
    } else if (mission.id === 'harbor') {
      if (mission.phase === 'go') {
        target = SPOTS.marina;
        text = '港口清场 · 前往码头';
        if (dist2(here.x, here.z, target.x, target.z) < target.r * target.r) {
          mission.phase = 'clear';
          this.spawnGuards();
          this.ui.toast('护卫在码头上');
        }
      } else if (mission.phase === 'clear') {
        const left = this.guards.filter((npc) => npc.alive).length;
        text = `港口清场 · 剩余护卫 ${left}`;
        if (left === 0 && this.guards.length) {
          mission.phase = 'lift';
          this.ui.toast('上去，把直升机拉高');
        }
      } else {
        target = SPOTS.marina;
        text = '港口清场 · 直升机拉到 12 米以上';
        if (this.vehicle?.kind === 'heli' && here.y > 12) {
          this.completeMission();
          return;
        }
      }
    }
    this.beacon.visible = !!target;
    if (target) {
      this.beacon.position.set(target.x, (target.y || 0) + 2.6, target.z);
      this.beacon.rotation.y = this.time;
    }
    if (text !== this.objectiveSig) {
      this.objectiveSig = text;
      this.ui.setObjective(text);
    }
  }

  spawnGuards() {
    this.guards.forEach((npc) => {
      npc.alive = false;
      npc.actor.model.visible = false;
    });
    this.guards = [];
    GUARD_SPOTS.forEach((spot) => {
      const npc = this.makeNpc('worker');
      npc.team = 'guard';
      npc.armed = true;
      npc.state = 'fight';
      npc.hp = 70;
      npc.x = spot.x;
      npc.z = spot.z;
      this.npcs.push(npc);
      this.guards.push(npc);
    });
  }

  updateCoins() {
    const here = this.focus();
    for (const coin of this.coins) {
      const got = this.collected.has(coin.id);
      coin.mesh.visible = !got;
      if (got) continue;
      coin.mesh.position.set(coin.x, 0.8 + Math.sin(this.time * 2 + coin.x) * 0.15, coin.z);
      coin.mesh.rotation.z = this.time;
      if (!this.vehicle && dist2(here.x, here.z, coin.x, coin.z) < 1.6 * 1.6) {
        this.collected.add(coin.id);
        this.bal[coin.drop.id] += coin.drop.amt;
        this.audio.coin();
        const meta = COINS.find((c) => c.id === coin.drop.id);
        this.ui.toast(`捡到 ${fmtNum(coin.drop.amt, meta.dec)} ${coin.drop.id}`);
        this.noteDaily('coins');
        this.rep += 2;
        this.walletSig = '';
      }
    }
  }

  syncActors(dt) {
    const step = this.mode === 'play' ? dt : 0;
    if (this.vehicle) {
      const sink = this.vehicle.kind === 'car' ? -0.55 : 0;
      this.actor.model.position.set(0, this.vehicle.def.seat + sink, 0.05);
      this.actor.model.rotation.set(0, 0, 0);
      const seated = this.actor.current === 'SitDown' || this.actor.current === 'Idle' || this.actor.current === 'Death';
      if (this.animLock <= 0 && !seated) {
        this.actor.play(this.actor.actions.SitDown ? 'SitDown' : 'Idle', { once: true, hold: true });
      }
    } else {
      if (this.actor.model.parent !== this.scene) this.scene.add(this.actor.model);
      this.actor.model.position.set(this.player.x, this.player.y, this.player.z);
      this.actor.model.rotation.set(0, this.player.yaw, 0);
      if (this.downTimer <= 0) locomotion(this.actor, this.player.speed, this.animLock);
    }
    this.gun.visible = !this.vehicle && this.weapon === 'pistol';
    this.rifle.visible = !this.vehicle && this.weapon === 'rifle';
    this.actor.mixer.update(step);
    this.placeWeapon(this.weapon === 'rifle' ? this.rifle : this.gun);
    if (this.localTag) this.localTag.position.y = this.vehicle ? 3.15 : 2.2;
    for (const npc of this.npcs) {
      if (!npc.actor.model.visible) continue;
      npc.actor.model.position.set(npc.x, 0, npc.z);
      npc.actor.model.rotation.y = npc.yaw;
      if (Math.hypot(npc.x - this.player.x, npc.z - this.player.z) < 72) npc.actor.mixer.update(step);
    }
    for (const v of this.vehicles) {
      const far = Math.hypot(v.x - this.player.x, v.z - this.player.z) > 220 && v !== this.vehicle;
      v.mesh.visible = !far;
      if (far) continue;
      this.syncRide(v, step);
    }
  }

  syncRide(v, dt) {
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.order = 'YXZ';
    v.mesh.rotation.set(v.pitch || 0, v.yaw, v.roll || 0);
    if (dt) spinParts(v, dt);
  }

  focus() {
    if (this.vehicle) return { x: this.vehicle.x, y: this.vehicle.y, z: this.vehicle.z };
    return { x: this.player.x, y: this.player.y, z: this.player.z };
  }

  focusAt(x, y, z) {
    this.player.x = x;
    this.player.y = y;
    this.player.z = z;
  }

  updateCamera(wall) {
    const look = this.input.consumeLook();
    const phone = this.layoutMode === 'port' || this.layoutMode === 'land';
    if (this.mode === 'play') {
      this.camYaw -= look.x * 0.0022;
      this.camPitch = clamp(this.camPitch - look.y * 0.0016, phone ? -0.55 : -0.35, phone ? 0.85 : 1.05);
      const minDist = this.layoutMode === 'port' ? 8.5 : this.layoutMode === 'land' ? 7.4 : 2.8;
      this.camDist = clamp(this.camDist + look.wheel * 0.55, minDist, 18);
    }
    const focus = this.focus();
    if (this.vehicle && this.mode === 'play') {
      this.camYaw += angNorm(this.vehicle.yaw - this.camYaw) * Math.min(1, wall * 2.4);
    }
    if (!this.lookSmooth) this.lookSmooth = new THREE.Vector3(focus.x, focus.y, focus.z);
    const ease = 1 - Math.exp(-9 * Math.max(0.001, wall));
    this.lookSmooth.x += (focus.x - this.lookSmooth.x) * ease;
    this.lookSmooth.y += (focus.y - this.lookSmooth.y) * ease;
    this.lookSmooth.z += (focus.z - this.lookSmooth.z) * ease;
    let dist = this.camDist + Math.min(phone ? 1.6 : 3.2, Math.abs(this.player.speed) * 0.16);
    if (this.vehicle?.kind === 'plane') dist = Math.max(dist, 14);
    else if (this.vehicle?.kind === 'heli') dist = Math.max(dist, 11);
    else if (this.vehicle) dist = Math.max(dist, phone ? 9.2 : 8);
    const cp = Math.cos(this.camPitch);
    const sp = Math.sin(this.camPitch);
    const fx = this.lookSmooth.x;
    const fy = this.lookSmooth.y;
    const fz = this.lookSmooth.z;
    let cx = fx - Math.sin(this.camYaw) * cp * dist;
    let cz = fz - Math.cos(this.camYaw) * cp * dist;
    let cy = fy + (phone ? 2.05 : 1.6) - sp * dist;
    const floorY = phone ? 1.8 : 0.45;
    if (cy < floorY) cy = floorY;
    this.camera.position.set(cx, cy, cz);
    const lookH = phone ? 1.45 : 1.35;
    this.camera.lookAt(fx, fy + lookH, fz);
    if (phone) {
      this.fill.color.set(0xfff1dc);
      this.fill.intensity = 1.2;
      this.fill.position.set(cx + 1.6, cy + 1.1, cz + 1.4);
      this.fill.target.position.set(focus.x, focus.y + 1.3, focus.z);
    } else {
      this.fill.color.set(0xfff4e4);
      this.fill.intensity = 0.72;
      this.fill.position.set(cx + 2.2, cy + 1.4, cz + 1.2);
      this.fill.target.position.set(fx, fy + 1.45, fz);
    }
    this.sky.position.copy(this.camera.position);
  }

  updateTod(wall) {
    if (this.mode === 'play') this.tod = (this.tod + wall * 0.004) % 1;
    const elev = Math.sin(this.tod * Math.PI);
    const az = this.tod * Math.PI * 2;
    const day = clamp(elev, 0, 1);
    const focus = this.focus();
    const phone = this.layoutMode === 'port' || this.layoutMode === 'land';
    this.sun.intensity = 0.18 + day * 2.35;
    this.hemi.intensity = (0.22 + day * 0.5) * (phone ? 1.75 : 1);
    this.renderer.toneMappingExposure = phone ? 1.24 : 1.05;
    this.sun.position.set(focus.x + Math.cos(az) * 70, 10 + Math.max(0.15, elev) * 80, focus.z + Math.sin(az) * 36);
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.shadow.camera.updateProjectionMatrix();
    const horizon = new THREE.Color().setHSL(0.08, 0.5, 0.22 + day * 0.42);
    const top = new THREE.Color().setHSL(0.57, 0.55, 0.08 + day * 0.42);
    this.sky.material.uniforms.uTop.value.copy(top);
    this.sky.material.uniforms.uHorizon.value.copy(horizon);
    this.sky.material.uniforms.uSun.value.set(Math.cos(az), Math.max(0.05, elev), Math.sin(az) * 0.6);
    this.scene.fog.color.copy(horizon);
  }

  updateHud(dt) {
    const prices = getPrices();
    const sig = `${this.usd.toFixed(0)}|${COINS.map((c) => this.bal[c.id].toFixed(4)).join(',')}|${getOrngMult()}`;
    if (sig !== this.walletSig) {
      this.walletSig = sig;
      let net = this.usd;
      for (const coin of COINS) net += this.bal[coin.id] * prices[coin.id];
      this.ui.setWallet({ usd: this.usd, bal: this.bal, net });
    }
    if (this.wanted !== this.starSig) {
      this.starSig = this.wanted;
      this.ui.setStars(this.wanted);
    }
    const weapon = WEAPONS[this.weapon];
    const ammo = this.weapon === 'fist' ? '近战' : `${this.ammo[this.weapon].mag}/${this.ammo[this.weapon].res}`;
    this.ui.setVitals(this.player.hp, this.player.armor, `${weapon.name} ${ammo}`);
    this.ui.setCrosshair(this.mode === 'play' && this.weapon !== 'fist');
    const prompt = this.mode === 'play' ? this.currentPrompt() : '';
    if (prompt !== this.promptSig) {
      this.promptSig = prompt;
      this.ui.setPrompt(prompt);
    }
    const speed = this.vehicle ? Math.abs(this.vehicle.speed) : 0;
    const extra = this.vehicle?.kind === 'plane' || this.vehicle?.kind === 'heli' ? ` · ${Math.round(this.vehicle.y)} m` : '';
    this.ui.setSpeed(this.vehicle ? `${Math.round(speed * 3.6)} km/h${extra}` : '');
    this.drawMinimap();
    this.headlineTimer += dt;
    if (this.headlineTimer > 14) {
      this.headlineTimer = 0;
      this.ui.setHeadline();
    }
    this.audio.setSiren(this.mode === 'play' ? this.wanted : 0);
    this.audio.setEngine(this.mode === 'play' && this.vehicle ? Math.abs(this.vehicle.speed) : 0);
    const bed = this.mode !== 'play' ? 'off' : this.vehicle?.kind === 'car' || this.vehicle?.kind === 'bike' ? 'car' : 'foot';
    this.audio.setBed(bed);
  }

  currentPrompt() {
    const bits = [];
    if (!this.vehicle) {
      const car = this.nearestVehicle();
      if (car) bits.push(`按 F 进入${car.def.name}`);
    } else if (this.vehicle.y > 3) bits.push('按住 Shift / Ctrl 控制高度，降落后再按 F');
    else bits.push('按 F 下车');
    if (this.vehicle?.kind === 'plane') bits.push('Shift 油门，W/S 俯仰，A/D 滚转');
    if (this.vehicle?.kind === 'heli') bits.push('Shift 或空格上升，Ctrl 下降');
    if (this.vehicle?.kind === 'boat' && !inWater(this.vehicle.x, this.vehicle.z)) bits.push('快艇离开水面几乎不动');
    const here = this.nearestSpot();
    if (here) bits.push(here.prompt);
    if (this.mission?.id === 'pump' && this.mission.phase === 'goto') {
      const d = dist2(this.player.x, this.player.z, SPOTS.pump.x, SPOTS.pump.z);
      if (d < SPOTS.pump.r * SPOTS.pump.r) bits.push('按 E 启动拉盘');
    }
    return bits.join('  ·  ');
  }

  nearestSpot() {
    const spots = [
      { ...SPOTS.exchange, prompt: '按 E 打开交易所' },
      { ...SPOTS.kiosk, prompt: '按 E 任务终端' },
      { ...SPOTS.dealer, prompt: '按 E 车行' },
      { ...SPOTS.safehouse, prompt: '按 E 在安全屋存档' },
      { ...PROPS[0], r: 5, prompt: '按 E 看海滩公寓' },
      { ...PROPS[1], r: 5, prompt: '按 E 看霓虹阁楼' },
    ];
    let best = null;
    let bestD = Infinity;
    const here = this.focus();
    for (const spot of spots) {
      const d = dist2(here.x, here.z, spot.x, spot.z);
      const r = spot.r || 4.5;
      if (d < r * r && d < bestD) {
        best = spot;
        bestD = d;
      }
    }
    return best;
  }

  nearestVehicle() {
    let best = null;
    let bestD = Infinity;
    const here = this.focus();
    for (const v of this.vehicles) {
      if (v === this.vehicle) continue;
      const reach = v.kind === 'plane' || v.kind === 'heli' ? 9 : v.kind === 'boat' ? 7 : 4.8;
      const d = Math.hypot(v.x - here.x, v.z - here.z);
      if (d < reach && d < bestD) {
        best = v;
        bestD = d;
      }
    }
    return best;
  }

  interact() {
    if (this.mode === 'cutscene') {
      this.advanceCutscene();
      return;
    }
    if (this.tryStoryTalk()) return;
    if (this.storyInteract()) return;
    if (this.tryActivity()) return;
    if (!this.mission && this.guideStep < GUIDE.length && GUIDE[this.guideStep].until === 'interact') {
      this.guideStep += 1;
      this.rep += 40;
      this.audio.success();
      this.ui.toast('教程完成。按 M 接任务，或按 E 做路边的活。');
    }
    if (this.mission?.id === 'pump' && this.mission.phase === 'goto') {
      const d = dist2(this.player.x, this.player.z, SPOTS.pump.x, SPOTS.pump.z);
      if (d < SPOTS.pump.r * SPOTS.pump.r) {
        this.mission.phase = 'sell';
        this.mission.time = 22;
        setOrngMult(7);
        this.pushPrices();
        this.audio.success();
        this.ui.toast('拉盘开始！22 秒内把 ORNG 卖掉');
        return;
      }
    }
    const spot = this.nearestSpot();
    if (!spot) return;
    if (spot.x === SPOTS.exchange.x && spot.z === SPOTS.exchange.z) {
      this.openModal('exchange');
      return;
    }
    if (spot.x === SPOTS.kiosk.x && spot.z === SPOTS.kiosk.z) {
      this.openModal('missions');
      return;
    }
    if (spot.x === SPOTS.dealer.x && spot.z === SPOTS.dealer.z) {
      this.openModal('dealer');
      return;
    }
    if (spot.x === SPOTS.safehouse.x && spot.z === SPOTS.safehouse.z) {
      this.save();
      this.ui.toast('安全屋已存档');
      return;
    }
    const prop = PROPS.find((item) => item.x === spot.x && item.z === spot.z);
    if (prop) {
      this.mode = 'modal';
      this.input.exitLock();
      this.ui.openShop({
        title: prop.name,
        usd: this.usd,
        bal: this.bal,
        prices: getPrices(),
        items: [{ ...prop, owned: this.ownedProps.has(prop.id) }],
      });
    }
  }

  toggleVehicle() {
    if (this.vehicle) {
      if (this.vehicle.y > 2.5) {
        this.ui.toast('先降落再下车');
        return;
      }
      this.exitVehicle();
      return;
    }
    const car = this.nearestVehicle();
    if (!car) return;
    const owned = car.personal && this.ownedCars.has(car.id);
    if (!owned && !car.hotwired) {
      const waived = (this.mission?.id === 'sky' && car.kind === 'plane')
        || (this.mission?.id === 'harbor' && car.kind === 'heli')
        || (this.mission?.id === 'story-hack' && (car.kind === 'heli' || car.kind === 'plane'))
        || (this.mission?.id === 'story-end' && (car.kind === 'heli' || car.kind === 'plane'));
      if (!waived) this.addWanted(1, `征用${car.def.name}`);
      car.hotwired = true;
    }
    if (car.traffic) {
      car.traffic = false;
      this.makeVehicle(['sedan', 'taxi', 'suv'][Math.floor(this.rng() * 3)], 0, 0, 0, { traffic: true });
    }
    this.vehicle = car;
    car.mesh.add(this.actor.model);
    this.actor.play('SitDown', { once: true, hold: true, fade: 0.1 });
    this.camYaw = car.yaw;
    this.audio.resume();
  }

  exitVehicle() {
    const car = this.vehicle;
    if (!car) return;
    const side = car.yaw + Math.PI / 2;
    let x = car.x + Math.sin(side) * 2.4;
    let z = car.z + Math.cos(side) * 2.4;
    if (this.world.blocked(x, z, 0.4, 'walk')) {
      x = car.x - Math.sin(side) * 2.4;
      z = car.z - Math.cos(side) * 2.4;
    }
    this.scene.add(this.actor.model);
    this.player.x = x;
    this.player.z = z;
    this.player.y = 0;
    this.player.vy = 0;
    this.player.yaw = car.yaw;
    car.speed = 0;
    this.vehicle = null;
    this.actor.play('Idle', { fade: 0.1 });
  }

  teleport(x, z, y = null) {
    if (this.vehicle) {
      this.vehicle.x = x;
      this.vehicle.z = z;
      if (y != null) this.vehicle.y = y;
    this.player.x = x;
    this.player.z = z;
    this.player.y = this.vehicle.y;
    this.player.vy = 0;
    this.lookSmooth?.set(x, this.player.y, z);
    return;
  }
  this.player.x = x;
  this.player.z = z;
  this.player.vy = 0;
  if (y != null) this.player.y = y;
  this.lookSmooth?.set(x, this.player.y, z);
  }

  trade(id, side, amount) {
    const coin = COINS.find((c) => c.id === id);
    if (!coin || !Number.isFinite(amount) || amount <= 0) {
      this.ui.toast('数量不对');
      return;
    }
    const price = getPrices()[id];
    if (side === 'buy') {
      const cost = amount * price;
      if (this.usd + 1e-6 < cost) {
        this.ui.toast('现金不够');
        return;
      }
      this.usd -= cost;
      this.bal[id] += amount;
      this.ui.toast(`买入 ${fmtNum(amount, coin.dec)} ${id}`);
    } else {
      const qty = Math.min(amount, this.bal[id]);
      if (qty <= 0) {
        this.ui.toast('没有仓位');
        return;
      }
      this.bal[id] -= qty;
      this.usd += qty * price;
      this.ui.toast(`卖出 ${fmtNum(qty, coin.dec)} ${id}，到账 ${fmtUsd(qty * price)}`);
      if (this.mission?.id === 'pump' && this.mission.phase === 'sell' && id === 'ORNG' && qty >= 1000) {
        this.audio.buy();
        this.completeMission();
        return;
      }
    }
    this.audio.buy();
    this.walletSig = '';
    this.save();
    if (this.mode === 'modal') this.ui.openExchange(this.marketModel());
  }

  buy(id, payWith) {
    const car = VEHICLES.find((item) => item.id === id && !item.unsold);
    const prop = PROPS.find((item) => item.id === id);
    const item = car || prop;
    if (!item) return;
    if ((car && this.ownedCars.has(id)) || (prop && this.ownedProps.has(id))) return;
    const price = item.price;
    if (price <= 0) {
      this.ownedCars.add(id);
      return;
    }
    if (payWith === 'USD') {
      if (this.usd < price) {
        this.ui.toast('现金不够');
        return;
      }
      this.usd -= price;
    } else {
      const cost = price / getPrices()[payWith];
      if (this.bal[payWith] + 1e-9 < cost) {
        this.ui.toast('币不够');
        return;
      }
      this.bal[payWith] -= cost;
    }
    if (car) this.ownedCars.add(id);
    if (prop) this.ownedProps.add(id);
    this.audio.success();
    this.ui.toast(`已买入 ${item.name}`);
    this.walletSig = '';
    this.save();
    this.closeModal();
  }

  acceptMission(id) {
    if (this.mission) {
      this.ui.toast('先完成或放弃当前任务');
      return;
    }
    if (this.done.has(id)) {
      /* 可以重做已经完成的单 */
    }
    if (id === 'cold') this.mission = { id, phase: 'pickup', time: 110 };
    if (id === 'sec') {
      this.mission = { id, phase: 'escape' };
      this.wanted = Math.max(this.wanted, 3);
      this.ensurePolice(true);
    }
    if (id === 'pump') {
      if (this.bal.ORNG < 4000) {
        this.bal.ORNG = 4000;
        this.ui.toast('空投 4000 ORNG，拿去拉盘');
      }
      this.mission = { id, phase: 'goto', time: 0 };
    }
    if (id === 'rug') {
      this.mission = { id, phase: 'loot', got: [false, false, false] };
      this.wanted = Math.max(this.wanted, 2);
      this.ensurePolice(true);
    }
    if (id === 'sky') this.mission = { id, phase: 'board', gate: 0 };
    if (id === 'harbor') this.mission = { id, phase: 'go' };
    if (!this.mission) return;
    this.objectiveSig = '';
    this.ui.toast(`已接受：${missionName(id)}`);
    this.audio.buy();
    this.closeModal();
    this.save();
  }

  abandonMission() {
    if (!this.mission) return;
    if (this.mission.id === 'pump') setOrngMult(1);
    if (this.mission.id === 'harbor') {
      for (const npc of this.guards) npc.alive = false;
    }
    this.ui.toast(`已放弃 ${missionName(this.mission.id)}`);
    this.mission = null;
    this.objectiveSig = '';
    this.pushPrices();
    this.closeModal();
    this.save();
  }

  completeMission() {
    const mission = this.mission;
    if (!mission) return;
    if (String(mission.id).startsWith('story-')) {
      const chapter = CHAPTERS.find((item) => item.id === mission.id);
      if (chapter) this.finishStory(chapter);
      return;
    }
    if (mission.id === 'cold') this.bal.ETH += 0.2;
    if (mission.id === 'sec') {
      this.bal.SOL += 3;
      this.usd += 2000;
    }
    if (mission.id === 'pump') {
      this.usd += 3000;
      setOrngMult(1);
    }
    if (mission.id === 'rug') this.bal.BTC += 0.015;
    if (mission.id === 'sky') this.bal.BTC += 0.02;
    if (mission.id === 'harbor') this.bal.SOL += 5;
    this.done.add(mission.id);
    this.mission = null;
    this.objectiveSig = '';
    this.walletSig = '';
    this.audio.success();
    this.ui.toast(`任务完成：${missionName(mission.id)}`);
    if (this.done.size >= MISSIONS.length) this.ui.toast('六单都做完了。海边的霓虹还亮着。');
    this.pushPrices();
    if (this.ui.modalOpen()) this.closeModal();
    this.save();
  }

  failMission(reason) {
    if (this.mission?.id === 'pump') setOrngMult(1);
    if (this.mission?.id === 'harbor') {
      for (const npc of this.guards) npc.alive = false;
    }
    this.mission = null;
    this.objectiveSig = '';
    this.audio.fail();
    this.ui.toast(reason);
    this.pushPrices();
    this.save();
  }

  openModal(kind) {
    this.mode = 'modal';
    this.input.exitLock();
    if (kind === 'exchange') this.ui.openExchange(this.marketModel());
    if (kind === 'missions') {
      this.ui.openMissions({
        active: this.mission?.id || '',
        activeName: this.mission ? missionName(this.mission.id) : '',
        done: [...this.done],
      });
    }
    if (kind === 'dealer') {
      this.ui.openShop({
        title: '车行',
        usd: this.usd,
        bal: this.bal,
        prices: getPrices(),
        items: VEHICLES.filter((item) => !item.unsold).map((item) => ({
          ...item,
          owned: this.ownedCars.has(item.id),
        })),
      });
    }
  }

  closeModal() {
    this.ui.closeModal();
    if (this.mode === 'modal') this.setMode('play');
  }

  marketModel() {
    return { prices: getPrices(), bal: { ...this.bal }, usd: this.usd, source: getPriceSource() };
  }

  pushPrices() {
    this.ui.setTicker(getPrices(), getPriceSource(), getOrngMult() >= 3);
    this.walletSig = '';
  }

  setMode(mode) {
    if (!this.ready && mode !== 'boot') return;
    this.mode = mode;
    if (mode === 'play') {
      this.ui.hidePause();
      this.ui.closeModal();
      this.ui.setPlayVisible(true);
      this.audio.resume();
    } else if (mode === 'pause') {
      this.input.exitLock();
      const net = COINS.reduce((sum, coin) => sum + this.bal[coin.id] * getPrices()[coin.id], this.usd);
      this.ui.showPause(`${this.displayName()} · 现金 ${fmtUsd(this.usd)} · 净值 ${fmtUsd(net)} · 声望 ${this.rep} · 故事 ${Math.min(this.storyChapter + 1, CHAPTERS.length)}/${CHAPTERS.length}`);
    } else if (mode === 'title') {
      this.input.exitLock();
      this.ui.showTitle();
      this.vehicle = null;
      this.leavePresence();
    }
  }

  newGame() {
    if (!this.ready) return;
    if (this.session && this.profile) this.asGuest = false;
    if (loadSave(this.saveUserId()) && !this.confirmNew) {
      this.confirmNew = true;
      this.ui.toast('再点一次新游戏，将覆盖存档');
      return;
    }
    this.confirmNew = false;
    this.resetProgress();
    if (this.vehicle) this.exitVehicle();
    this.teleport(SPOTS.spawn.x, SPOTS.spawn.z, 0);
    this.objectiveSig = '';
    this.walletSig = '';
    this.setMode('play');
    this.ui.toast('跟着橙色光柱。Shift 冲刺，空格跳跃，F 上车。');
    this.refreshIdentity();
    this.joinPresence();
    this.save();
  }

  continueGame() {
    if (this.session && this.profile) this.asGuest = false;
    const data = loadSave(this.saveUserId());
    if (!data && !(this.session && !this.asGuest && this.scoreFloor)) {
      this.ui.toast('没有存档');
      return;
    }
    if (data) this.applySave(data);
    else this.resetProgress();
    this.applyCloudFloor();
    this.setMode('play');
    this.refreshIdentity();
    this.joinPresence();
    this.ui.toast(this.session && !this.asGuest ? '已接上云端进度' : '继续本地进度');
  }

  applySave(data) {
    this.usd = data.usd;
    this.bal = { ...data.bal };
    this.ownedCars = new Set(data.ownedCars || ['sedan']);
    this.ownedProps = new Set(data.ownedProps || []);
    this.done = new Set(data.done || []);
    this.collected = new Set(data.collected || []);
    this.wanted = data.wanted || 0;
    this.mission = data.mission || null;
    this.rep = data.rep || 0;
    this.guideStep = data.guideStep ?? (data.done?.length ? GUIDE.length : 0);
    this.finishedJobs = new Set(data.finishedJobs || []);
    this.storyChapter = data.storyChapter || 0;
    this.daily = data.daily || null;
    this.player.hp = data.hp ?? 100;
    this.player.armor = data.armor ?? 0;
    this.weapon = data.weapon || 'fist';
    if (data.ammo) this.ammo = data.ammo;
    setOrngMult(data.orngMult || 1);
    if (this.vehicle) this.exitVehicle();
    this.teleport(data.player?.x ?? SPOTS.spawn.x, data.player?.z ?? SPOTS.spawn.z, 0);
    if (data.player?.camYaw != null) this.camYaw = data.player.camYaw;
    this.objectiveSig = '';
    this.walletSig = '';
    this.ensurePolice(true);
    this.pushPrices();
  }

  save() {
    if (!this.ready || this.mode === 'boot') return;
    const here = this.focus();
    writeSave({
      v: 2,
      usd: this.usd,
      bal: this.bal,
      ownedCars: [...this.ownedCars],
      ownedProps: [...this.ownedProps],
      done: [...this.done],
      collected: [...this.collected],
      wanted: this.wanted,
      mission: this.mission ? structuredClone(this.mission) : null,
      rep: this.rep,
      guideStep: this.guideStep,
      finishedJobs: [...this.finishedJobs],
      storyChapter: this.storyChapter,
      daily: this.daily,
      orngMult: getOrngMult(),
      hp: this.player.hp,
      armor: this.player.armor,
      weapon: this.weapon,
      ammo: this.ammo,
      player: { x: here.x, z: here.z, camYaw: this.camYaw, camPitch: this.camPitch },
    }, this.saveUserId());
    this.ui.setContinueEnabled(true);
    this.syncScore();
  }

  spawnDummy(dist) {
    let npc = this.npcs.find((item) => item.dummy);
    if (!npc) {
      npc = this.makeNpc('worker', true);
      npc.dummy = true;
      this.npcs.push(npc);
    }
    const here = this.focus();
    const yaw = this.vehicle ? this.vehicle.yaw : this.camYaw;
    if (!this.vehicle) this.player.yaw = yaw;
    npc.x = here.x + Math.sin(yaw) * dist;
    npc.z = here.z + Math.cos(yaw) * dist;
    npc.hp = 48;
    npc.alive = true;
    npc.state = 'idle';
    npc.team = 'civ';
    npc.armed = false;
    npc.down = 0;
    npc.animLock = 0;
    npc.actor.model.visible = true;
    npc.actor.play('Idle', { fade: 0.05 });
    return npc;
  }

  dressHero(actor) {
    const cloth = new THREE.MeshStandardMaterial({ color: 0xff6a14, roughness: 0.55 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.14), cloth);
    bag.castShadow = true;
    bag.position.set(0, 1.18, -0.2);
    actor.model.add(bag);
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.012, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xffd56a, metalness: 0.85, roughness: 0.22 }),
    );
    chain.rotation.x = Math.PI / 2;
    chain.position.set(0, 1.4, 0.1);
    actor.model.add(chain);
    this.localTag = makeNameTag(this.displayName(), '#ff6a14');
    actor.model.add(this.localTag);
  }

  placeWeapon(mesh) {
    const hand = this.actor?.hand;
    if (!mesh || !hand) return;
    hand.updateWorldMatrix(true, false);
    if (!this.weaponPos) {
      this.weaponPos = new THREE.Vector3();
      this.weaponQuat = new THREE.Quaternion();
      this.weaponOff = new THREE.Vector3();
    }
    hand.getWorldPosition(this.weaponPos);
    hand.getWorldQuaternion(this.weaponQuat);
    this.weaponOff.set(0.02, 0.03, 0.08).applyQuaternion(this.weaponQuat);
    mesh.position.copy(this.weaponPos).add(this.weaponOff);
    mesh.quaternion.copy(this.weaponQuat);
    mesh.scale.set(1, 1, 1);
  }

  buildLife() {
    this.signals = [
      [8, 8],
      [66, 8],
      [-50, 8],
      [8, 66],
    ].map(([x, z]) => {
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 3.4, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 }),
      );
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.42, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x39ff7a, emissive: 0x1ecf5a, emissiveIntensity: 0.9 }),
      );
      pole.position.set(x, 1.7, z);
      lamp.position.set(x, 3.45, z);
      this.scene.add(pole, lamp);
      return { x, z, lamp };
    });
    const birdGeo = new THREE.ConeGeometry(0.18, 0.55, 4);
    birdGeo.rotateX(Math.PI / 2);
    this.birds = new THREE.InstancedMesh(
      birdGeo,
      new THREE.MeshBasicMaterial({ color: 0xf7f3ea }),
      8,
    );
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.birds);
    this.birdDummy = new THREE.Object3D();
    const routeMax = 64;
    const routeGeo = new THREE.BufferGeometry();
    routeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(routeMax * 2 * 3), 3));
    const routeIndex = [];
    for (let i = 0; i < routeMax - 1; i += 1) {
      const a = i * 2;
      routeIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    routeGeo.setIndex(routeIndex);
    this.route = new THREE.Mesh(
      routeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd15a,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    this.route.frustumCulled = false;
    this.route.renderOrder = 2;
    this.route.visible = false;
    this.scene.add(this.route);
    this.routeMax = routeMax;
    this.routeCount = 0;
    this.jobMarks = ACTIVITIES.map((job) => {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.85),
        new THREE.MeshStandardMaterial({ color: 0x3df0ff, emissive: 0x1490aa, emissiveIntensity: 0.7 }),
      );
      mesh.position.set(job.x, 2.2, job.z);
      this.scene.add(mesh);
      return { job, mesh };
    });
    this.raceMarks = RACE_GATES.map((gate) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.16, 6, 16),
        new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffb000, emissiveIntensity: 0.8 }),
      );
      mesh.position.set(gate.x, 1.6, gate.z);
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });
    const flyer = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.45, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.4 }),
    );
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 6.4),
      new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.45 }),
    );
    flyer.add(body, wing);
    this.airliner = flyer;
    this.scene.add(flyer);
    const skiff = this.templates.boat.clone(true);
    skiff.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = false;
    });
    this.skiff = skiff;
    this.scene.add(skiff);
    this.spawnStoryCast();
  }

  level() {
    return levelFromRep(this.rep);
  }

  noteDaily(kind) {
    if (!this.daily || this.daily.id !== kind || this.daily.have >= this.daily.need) return;
    this.daily.have += 1;
    if (this.daily.have >= this.daily.need) {
      this.rep += 25;
      this.usd += 500;
      this.walletSig = '';
      this.ui.toast(`今日挑战完成：${this.daily.name}，+$500`);
      this.audio.success();
    }
  }

  showMarker(target, text) {
    if (target) {
      this.beacon.visible = true;
      this.beacon.position.set(target.x, (target.y || 0) + 2.6, target.z);
      this.beacon.rotation.y = this.time;
      this.goal = target;
    }
    if (text && text !== this.objectiveSig) {
      this.objectiveSig = text;
      this.ui.setObjective(text);
    }
  }

  updateLife(dt) {
    if (!this.daily) this.daily = dailyFor(new Date().toISOString().slice(0, 10));
    this.signalRed = Math.floor(this.time / 6) % 2 === 0;
    for (const light of this.signals || []) {
      const color = this.signalRed ? 0xff3344 : 0x39ff7a;
      light.lamp.material.color.setHex(color);
      light.lamp.material.emissive.setHex(color);
    }
    const here = this.focus();
    if (this.birds) {
      for (let i = 0; i < 8; i += 1) {
        const a = this.time * 0.7 + i;
        this.birdDummy.position.set(here.x + Math.cos(a) * (18 + i * 3), 14 + (i % 3) * 2, here.z + Math.sin(a * 1.3) * (16 + i));
        this.birdDummy.lookAt(here.x, 12, here.z);
        this.birdDummy.updateMatrix();
        this.birds.setMatrixAt(i, this.birdDummy.matrix);
      }
      this.birds.instanceMatrix.needsUpdate = true;
    }
    if (this.airliner) {
      const a = this.time * 0.08;
      this.airliner.position.set(Math.cos(a) * 220, 48, Math.sin(a) * 180);
      this.airliner.rotation.y = -a;
    }
    if (this.skiff) {
      const t = (this.time * 4) % 180;
      this.skiff.position.set(-420 + t, 0.2, 260);
      this.skiff.rotation.y = Math.PI / 2;
    }
    for (const mark of this.jobMarks || []) {
      const done = this.finishedJobs.has(mark.job.id) && mark.job.kind !== 'atm' && mark.job.kind !== 'guns' && mark.job.kind !== 'clothes';
      mark.mesh.visible = !done && Math.hypot(mark.job.x - here.x, mark.job.z - here.z) < 220;
      mark.mesh.rotation.y = this.time;
      mark.mesh.position.y = 2.1 + Math.sin(this.time * 2 + mark.job.x) * 0.15;
    }
    if (this.race) {
      const gate = RACE_GATES[this.race.i];
      this.raceMarks.forEach((mesh, i) => {
        mesh.visible = i === this.race.i;
      });
      if (gate && dist2(here.x, here.z, gate.x, gate.z) < 6 * 6) {
        this.race.i += 1;
        if (this.race.i >= RACE_GATES.length) {
          const seconds = Math.max(1, this.time - this.race.t0);
          this.race = null;
          this.usd += 1200;
          this.rep += 30;
          this.finishedJobs.add('race');
          this.noteDaily('race');
          this.walletSig = '';
          this.audio.success();
          this.ui.toast(`竞速完成 ${seconds.toFixed(1)} 秒，+$1,200`);
        }
      }
    } else this.raceMarks?.forEach((mesh) => {
      mesh.visible = false;
    });
    if (this.mission) return;
    if (this.guideStep < GUIDE.length) {
      const step = GUIDE[this.guideStep];
      let done = false;
      if (step.until === 'vehicle') done = !!this.vehicle;
      else if (step.until !== 'interact') done = dist2(here.x, here.z, step.x, step.z) < step.r * step.r;
      if (done) {
        this.guideStep += 1;
        this.ui.toast(this.guideStep >= GUIDE.length ? '教程完成' : '好，下一步');
        if (this.guideStep >= GUIDE.length) {
          this.rep += 40;
          this.audio.success();
        }
      }
    }
    if (this.guideStep < GUIDE.length) {
      const step = GUIDE[this.guideStep];
      this.showMarker(step, step.text);
      return;
    }
    if (this.storyChapter < CHAPTERS.length) {
      const chapter = CHAPTERS[this.storyChapter];
      const who = castById(chapter.giver);
      this.showMarker(who.home, `故事 ${this.storyChapter + 1}/8 · 去找${who.name}`);
      return;
    }
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = 70 + this.rng() * 40;
      if (this.rng() > 0.5) {
        this.ui.toast('巨鲸抛售：大橙子币跳水，交易所可以抄底');
        this.goalHint = { name: '去交易所看巨鲸抛售', x: SPOTS.exchange.x, z: SPOTS.exchange.z, r: 6 };
      } else {
        this.ui.toast('有人在街上跑路，追上他');
        this.goalHint = { name: '追上跑路的人', x: here.x + 18, z: here.z + 8, r: 4, id: 'runner' };
      }
    }
    const goal = this.nearestJob(here) || this.goalHint || { name: '按 M 接冷钱包专送', x: SPOTS.kiosk.x, z: SPOTS.kiosk.z, r: 5 };
    const daily = this.daily.have >= this.daily.need ? '今日已完成' : `今日 ${this.daily.have}/${this.daily.need} ${this.daily.name}`;
    this.showMarker(goal, `等级 ${this.level()} · 下一步：${goal.name} · ${daily}`);
  }

  nearestJob(here) {
    let best = null;
    let bestD = Infinity;
    for (const job of ACTIVITIES) {
      if (this.finishedJobs.has(job.id) && job.kind !== 'atm' && job.kind !== 'guns' && job.kind !== 'clothes' && job.kind !== 'stunt') continue;
      const d = dist2(here.x, here.z, job.x, job.z);
      if (d < bestD) {
        bestD = d;
        best = job;
      }
    }
    return best;
  }

  updateGps() {
    if (!this.route || !this.beacon?.visible) {
      if (this.route) this.route.visible = false;
      this.routeCount = 0;
      this.routePoints = null;
      return;
    }
    const here = this.focus();
    const points = routeOnRoads(this.world.roads, here.x, here.z, this.beacon.position.x, this.beacon.position.z);
    const attr = this.route.geometry.getAttribute('position');
    const maxPts = this.routeMax || 64;
    const n = Math.min(points.length, maxPts);
    const half = 0.55;
    for (let i = 0; i < n; i += 1) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      attr.setXYZ(i * 2, points[i].x - dz * half, 0.42, points[i].z + dx * half);
      attr.setXYZ(i * 2 + 1, points[i].x + dz * half, 0.42, points[i].z - dx * half);
    }
    if (n > 0) {
      for (let i = n; i < maxPts; i += 1) {
        attr.copyAt(i * 2, attr, (n - 1) * 2);
        attr.copyAt(i * 2 + 1, attr, (n - 1) * 2 + 1);
      }
    }
    attr.needsUpdate = true;
    this.route.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.route.visible = n > 1;
    this.routeCount = n;
    this.routePoints = points;
  }

  tryActivity() {
    const here = this.focus();
    for (const job of ACTIVITIES) {
      if (dist2(here.x, here.z, job.x, job.z) > job.r * job.r) continue;
      if (job.kind === 'atm') {
        if (this.time < this.atmUse) {
          this.ui.toast('这台 ATM 还在结算');
          return true;
        }
        this.atmUse = this.time + 18;
        this.usd += 220;
        this.rep += 8;
        this.walletSig = '';
        this.noteDaily('atm');
        this.audio.coin();
        this.ui.toast('ATM 兑出 $220');
        return true;
      }
      if (job.kind === 'race') {
        this.race = { i: 0, t0: this.time };
        this.ui.toast('竞速开始，穿过黄色环');
        return true;
      }
      if (job.kind === 'taxi') {
        if (!this.vehicle) {
          this.ui.toast('先上车，再来接这一单');
          return true;
        }
        this.taxi = { drop: job.drop };
        this.finishedJobs.add(job.id);
        this.ui.toast('乘客上车了。送到海滩公寓');
        this.goalHint = { name: '把乘客送到海滩', x: job.drop.x, z: job.drop.z, r: 8, id: 'taxi-drop' };
        return true;
      }
      if (job.kind === 'guns') {
        if (this.usd < 400) {
          this.ui.toast('补弹需要 $400');
          return true;
        }
        this.usd -= 400;
        this.ammo.pistol.res += 36;
        this.ammo.rifle.res += 60;
        this.walletSig = '';
        this.audio.buy();
        this.ui.toast('子弹补上了');
        return true;
      }
      if (job.kind === 'clothes') {
        this.rep += 4;
        this.ui.toast('换了一件更橙的外套');
        this.audio.buy();
        return true;
      }
      if (job.kind === 'gallery') {
        if (this.finishedJobs.has(job.id)) {
          this.ui.toast('画廊已经空了');
          return true;
        }
        this.finishedJobs.add(job.id);
        this.bal.BTC += 0.01;
        this.rep += 22;
        this.wanted = Math.max(this.wanted, 2);
        this.ensurePolice(true);
        this.walletSig = '';
        this.audio.success();
        this.ui.toast('NFT 被你卷走了。SEC 盯上了画廊');
        return true;
      }
      if (job.kind === 'stunt') {
        const fast = Math.abs(this.vehicle?.speed || 0) > 28;
        if (!fast) {
          this.ui.toast('速度不够。冲过这道门再按 E');
          return true;
        }
        this.finishedJobs.add(job.id);
        this.usd += 800;
        this.rep += 18;
        this.walletSig = '';
        this.audio.success();
        this.ui.toast('特技门通过，+$800');
        return true;
      }
    }
    if (this.goalHint?.id === 'taxi-drop' && this.taxi && dist2(here.x, here.z, this.taxi.drop.x, this.taxi.drop.z) < 10 * 10) {
      this.taxi = null;
      this.goalHint = null;
      this.usd += 450;
      this.rep += 16;
      this.walletSig = '';
      this.audio.success();
      this.ui.toast('乘客下车，车费 $450');
      return true;
    }
    if (this.goalHint?.id === 'runner' && dist2(here.x, here.z, this.goalHint.x, this.goalHint.z) < 5 * 5) {
      this.goalHint = null;
      this.usd += 300;
      this.rep += 12;
      this.walletSig = '';
      this.ui.toast('追上了跑路的人，搜出 $300');
      return true;
    }
    return false;
  }

  drawMinimap() {
    const ctx = this.ui.minimapCtx;
    const w = this.ui.minimap.width;
    const h = this.ui.minimap.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#123226';
    ctx.fillRect(0, 0, w, h);
    const focus = this.focus();
    const scale = 0.42;
    const toX = (x) => w / 2 + (x - focus.x) * scale;
    const toY = (z) => h / 2 + (z - focus.z) * scale;
    ctx.fillStyle = '#1c6e86';
    ctx.fillRect(toX(-600), toY(348), 1200 * scale, 200 * scale);
    ctx.strokeStyle = 'rgba(230,230,230,0.35)';
    ctx.lineWidth = 2;
    for (const seg of this.world?.roads || []) {
      ctx.beginPath();
      ctx.moveTo(toX(seg.ax), toY(seg.az));
      ctx.lineTo(toX(seg.bx), toY(seg.bz));
      ctx.stroke();
    }
    if (this.routePoints?.length) {
      ctx.strokeStyle = '#ffd15a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.routePoints.forEach((p, i) => {
        const x = toX(p.x);
        const y = toY(p.z);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    if (this.beacon?.visible) {
      ctx.fillStyle = '#ff8a1e';
      ctx.beginPath();
      ctx.arc(toX(this.beacon.position.x), toY(this.beacon.position.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd56a';
    for (const person of CAST) {
      ctx.beginPath();
      ctx.arc(toX(person.home.x), toY(person.home.z), person.id === CHAPTERS[this.storyChapter]?.giver ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7dffa6';
    for (const remote of this.remotes.values()) {
      ctx.fillRect(toX(remote.x) - 2, toY(remote.z) - 2, 4, 4);
    }
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-this.camYaw);
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.fill();
    ctx.restore();
  }

  saveUserId() {
    return this.session && this.profile && !this.asGuest ? this.session.user.id : null;
  }

  displayName() {
    return this.profile && !this.asGuest ? this.profile.nickname : '游客';
  }

  colorFor(nick) {
    const palette = ['#ff6a14', '#ff4fad', '#3df0ff', '#ffe14a', '#7dffa6', '#8aa4ff', '#ff5a6a'];
    let hash = 0;
    for (const ch of nick) hash = (hash * 33 + ch.codePointAt(0)) >>> 0;
    return palette[hash % palette.length];
  }

  netWorth() {
    return COINS.reduce((sum, coin) => sum + (this.bal[coin.id] || 0) * (getPrices()[coin.id] || 0), this.usd);
  }

  resetProgress() {
    this.usd = STARTING.usd;
    this.bal = { ...STARTING.bal };
    this.ownedCars = new Set(['sedan']);
    this.ownedProps = new Set();
    this.done = new Set();
    this.collected = new Set();
    this.wanted = 0;
    this.mission = null;
    this.guideStep = 0;
    this.rep = 0;
    this.finishedJobs = new Set();
    this.race = null;
    this.taxi = null;
    this.goalHint = null;
    this.storyChapter = 0;
    this.daily = dailyFor(new Date().toISOString().slice(0, 10));
    this.player.hp = 100;
    this.player.armor = 25;
    this.weapon = 'fist';
    this.ammo.pistol = { mag: 12, res: 48 };
    this.ammo.rifle = { mag: 30, res: 90 };
    setOrngMult(1);
  }

  refreshIdentity() {
    const name = this.displayName();
    const online = this.onlineCount > 0 ? `在线 ${this.onlineCount}` : '单机';
    this.ui.setIdentity(`${name} · ${online}`);
    if (this.localTag && this.localTag.userData.tagText !== name) {
      this.localTag.removeFromParent();
      this.localTag.material.map?.dispose();
      this.localTag.material.dispose();
      this.localTag = makeNameTag(name, this.profile?.avatar_color || '#ff6a14');
      this.actor?.model.add(this.localTag);
    }
  }

  refreshAccountLine() {
    const loggedIn = !!(this.session && this.profile);
    this.ui.setAccountLine(
      loggedIn ? `已登录：${this.profile.nickname}。新游戏和继续会记入排行榜。` : '还没登录。游客进度只留在这台设备。',
      loggedIn,
    );
    const slot = loggedIn ? this.session.user.id : null;
    this.ui.setContinueEnabled(!!loadSave(slot) || !!(loggedIn && this.scoreFloor));
    this.refreshIdentity();
  }

  async bindAccount() {
    const { data } = await cloud.auth.getSession();
    this.session = data.session || null;
    if (this.session) await this.ensureProfile();
    this.refreshAccountLine();
    cloud.auth.onAuthStateChange(async (_event, session) => {
      this.session = session;
      if (session) await this.ensureProfile();
      else {
        this.profile = null;
        this.asGuest = true;
        this.scoreFloor = null;
        this.leavePresence();
      }
      this.refreshAccountLine();
    });
  }

  async ensureProfile() {
    const user = this.session?.user;
    if (!user) return;
    const got = await fetchProfile(user.id);
    if (got.profile) {
      this.profile = got.profile;
      const score = await fetchScore(user.id);
      this.scoreFloor = score.score || this.scoreFloor;
      return;
    }
    const nick = validNick(user.user_metadata?.nickname || '');
    if (nick) {
      const made = await createProfile(user.id, nick, this.colorFor(nick));
      if (made.profile) {
        this.profile = made.profile;
        return;
      }
      this.ui.showAuth('nick', made.error || '这个昵称已经被占用。');
      return;
    }
    this.ui.showAuth('nick', '先取一个别人没用过的昵称。');
  }

  async submitAuth(form) {
    if (form.mode === 'nick') {
      const nick = validNick(form.nickname);
      if (!nick || !this.session?.user) {
        this.ui.showAuth('nick', '昵称要 2 到 16 个字，不要带空格。');
        return { error: 'nick' };
      }
      const made = await createProfile(this.session.user.id, nick, this.colorFor(nick));
      if (made.error) {
        this.ui.showAuth('nick', made.error);
        return made;
      }
      this.profile = made.profile;
      this.asGuest = false;
      this.ui.hideAuth();
      this.refreshAccountLine();
      this.ui.toast(`昵称定了：${nick}`);
      return made;
    }
    if (form.mode === 'register') {
      const nick = validNick(form.nickname);
      if (!nick) {
        this.ui.showAuth('register', '注册时就要定昵称，2 到 16 个字。');
        return { error: 'nick' };
      }
      if (!form.password || form.password.length < 6) {
        this.ui.showAuth('register', '密码至少 6 位。');
        return { error: 'password' };
      }
      const result = await signUp(form.email, form.password, nick);
      if (result.error) {
        this.ui.showAuth('register', result.error);
        return result;
      }
      if (result.confirm || !result.session) {
        this.ui.showAuth('login', '请到邮箱点确认链接，然后再登录。确认后会回到游戏页面。');
        return result;
      }
      this.session = result.session;
      this.asGuest = false;
      await this.ensureProfile();
      if (this.profile) this.ui.hideAuth();
      this.refreshAccountLine();
      this.ui.toast('注册成功');
      return result;
    }
    const result = await signIn(form.email, form.password);
    if (result.error) {
      this.ui.showAuth('login', result.error);
      return result;
    }
    this.session = result.session;
    this.asGuest = false;
    await this.ensureProfile();
    if (this.profile) this.ui.hideAuth();
    this.refreshAccountLine();
    this.ui.toast(this.profile ? `欢迎回来，${this.profile.nickname}` : '登录成功');
    return result;
  }

  async logout() {
    await signOut();
    this.session = null;
    this.profile = null;
    this.asGuest = true;
    this.scoreFloor = null;
    this.leavePresence();
    this.refreshAccountLine();
    if (this.mode !== 'title') this.setMode('title');
    this.ui.toast('已退出登录');
  }

  playGuest() {
    this.asGuest = true;
    this.leavePresence();
    const data = loadSave(null);
    if (data) {
      this.applySave(data);
      this.setMode('play');
      this.refreshIdentity();
      this.ui.toast('以游客身份继续，进度只留在这台设备');
      return;
    }
    this.confirmNew = true;
    this.resetProgress();
    if (this.vehicle) this.exitVehicle();
    this.teleport(SPOTS.spawn.x, SPOTS.spawn.z, 0);
    this.setMode('play');
    this.refreshIdentity();
    this.save();
    this.ui.toast('以游客身份开始，进度只留在这台设备');
  }

  applyCloudFloor() {
    const row = this.scoreFloor;
    if (!row || this.asGuest) return;
    if ((row.story_chapter || 0) > this.storyChapter) this.storyChapter = row.story_chapter;
    if ((row.reputation || 0) > this.rep) this.rep = row.reputation;
    const net = Number(row.net_worth || 0);
    const local = this.netWorth();
    if (net > local + 1) this.usd += net - local;
    this.walletSig = '';
  }

  async syncScore() {
    if (!this.session || !this.profile || this.asGuest || !this.ready || this.mode === 'boot') return;
    const floor = this.scoreFloor || {};
    const row = {
      user_id: this.session.user.id,
      net_worth: Math.max(Math.round(this.netWorth()), Math.round(Number(floor.net_worth || 0))),
      reputation: Math.max(this.rep | 0, floor.reputation || 0),
      level: Math.max(this.level(), floor.level || 1),
      missions_done: Math.max(this.done.size + this.storyChapter, floor.missions_done || 0),
      story_chapter: Math.max(this.storyChapter, floor.story_chapter || 0),
      updated_at: new Date().toISOString(),
    };
    const result = await pushScore(row);
    if (!result.error) this.scoreFloor = row;
  }

  async openBoard(tab = 'net_worth') {
    this.boardReturn = this.mode === 'title' || this.mode === 'pause' ? this.mode : 'play';
    this.mode = 'board';
    this.input.exitLock();
    const result = await fetchBoard(tab);
    let rank = null;
    if (this.profile && !this.asGuest) {
      const mine = (result.rows || []).findIndex((row) => row.nickname === this.profile.nickname);
      if (mine >= 0) rank = mine + 1;
      else {
        const value = tab === 'reputation' ? this.rep : tab === 'level' ? this.level() : this.netWorth();
        const placed = await fetchRank(tab, value);
        rank = placed.rank;
      }
    }
    this.ui.showBoard({
      tab,
      rows: result.rows || [],
      error: result.error || '',
      me: this.profile?.nickname || '',
      rank,
    });
  }

  closeBoard() {
    this.ui.hideBoard();
    const back = this.boardReturn || 'play';
    this.boardReturn = 'play';
    this.setMode(back);
  }

  async joinPresence() {
    this.leavePresence();
    if (!this.session || !this.profile || this.asGuest) return;
    const channel = joinWorld(
      this.session.user.id,
      (pose) => this.onPose(pose),
      (state) => this.onPresence(state),
    );
    this.worldChannel = channel;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') this.sendPose(true);
    });
  }

  leavePresence() {
    if (this.worldChannel) {
      cloud.removeChannel(this.worldChannel);
      this.worldChannel = null;
    }
    for (const remote of this.remotes.values()) this.disposeRemote(remote);
    this.remotes.clear();
    this.onlineCount = this.session && this.profile && !this.asGuest ? 1 : 0;
  }

  sendPose(track = false) {
    if (!this.worldChannel || !this.session || !this.profile) return;
    const here = this.focus();
    const payload = {
      id: this.session.user.id,
      nick: this.profile.nickname,
      color: this.profile.avatar_color || '#ff6a14',
      x: Math.round(here.x * 10) / 10,
      z: Math.round(here.z * 10) / 10,
      y: Math.round((here.y || 0) * 10) / 10,
      yaw: Math.round((this.vehicle?.yaw ?? this.player.yaw) * 100) / 100,
      v: this.vehicle?.kind || '',
      e: this.emote || '',
    };
    this.worldChannel.send({ type: 'broadcast', event: 'pose', payload });
    if (track) this.worldChannel.track(payload);
    this.emote = '';
  }

  sendEmote() {
    this.emote = 'wave';
    this.actor?.play('Wave', { once: true, fade: 0.08 });
    this.animLock = 1.1;
    this.sendPose(true);
  }

  onPresence(state) {
    const ids = Object.keys(state || {});
    this.onlineCount = Math.max(ids.length, 1);
    this.refreshIdentity();
    for (const id of ids) {
      if (id === this.session?.user?.id) continue;
      const meta = state[id]?.[0];
      if (meta) this.onPose({ ...meta, id });
    }
  }

  onPose(pose) {
    if (!pose?.id || pose.id === this.session?.user?.id) return;
    let remote = this.remotes.get(pose.id);
    if (!remote) {
      if (this.remotes.size >= this.remoteCap) return;
      remote = this.createRemote(pose);
      this.remotes.set(pose.id, remote);
    }
    remote.tx = pose.x || 0;
    remote.tz = pose.z || 0;
    remote.ty = pose.y || 0;
    remote.tyaw = pose.yaw || 0;
    remote.nick = pose.nick || remote.nick;
    remote.kind = pose.v || '';
    remote.seen = this.time;
    if (!remote.ready) {
      remote.x = remote.tx;
      remote.z = remote.tz;
      remote.y = remote.ty;
      remote.yaw = remote.tyaw;
      remote.ready = true;
    }
    if (pose.e === 'wave') remote.actor.play('Wave', { once: true, fade: 0.1 });
    if (remote.tag && remote.tag.userData.tagText !== remote.nick) {
      remote.tag.removeFromParent();
      remote.tag.material.map?.dispose();
      remote.tag.material.dispose();
      remote.tag = makeNameTag(remote.nick, pose.color || '#ffd7a8');
      (remote.car || remote.actor.model).add(remote.tag);
    }
    this.syncRemoteRide(remote);
  }

  createRemote(pose) {
    const actor = createActor(this.assets.people.male);
    tintActor(actor, { cloth: pose.color || '#8aa4ff', pants: '#1c2433', hair: '#1b120d' });
    const tag = makeNameTag(pose.nick || '玩家', pose.color || '#ffd7a8');
    actor.model.add(tag);
    this.scene.add(actor.model);
    actor.play('Idle');
    return {
      id: pose.id,
      actor,
      tag,
      car: null,
      shown: '',
      nick: pose.nick || '玩家',
      kind: '',
      x: pose.x || 0,
      z: pose.z || 0,
      y: pose.y || 0,
      yaw: pose.yaw || 0,
      tx: pose.x || 0,
      tz: pose.z || 0,
      ty: pose.y || 0,
      tyaw: pose.yaw || 0,
      seen: this.time,
      ready: false,
    };
  }

  syncRemoteRide(remote) {
    if (remote.shown === remote.kind) return;
    if (remote.car) {
      this.scene.add(remote.actor.model);
      remote.car.removeFromParent();
      remote.car = null;
    }
    remote.shown = remote.kind;
    if (!remote.kind) return;
    const key = ['bike', 'boat', 'heli', 'plane'].includes(remote.kind) ? remote.kind : 'sedan';
    const mesh = this.templates[key]?.clone(true);
    if (!mesh) return;
    mesh.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = false;
    });
    this.scene.add(mesh);
    mesh.add(remote.actor.model);
    remote.actor.model.position.set(0, key === 'bike' ? 0.55 : 0.15, 0.05);
    remote.tag.position.y = 3.2;
    remote.car = mesh;
  }

  disposeRemote(remote) {
    remote.car?.removeFromParent();
    remote.actor.model.removeFromParent();
  }

  updateRemotes(dt) {
    const k = 1 - Math.exp(-8 * Math.max(dt, 0.001));
    for (const [id, remote] of this.remotes) {
      if (this.time - remote.seen > 8) {
        this.disposeRemote(remote);
        this.remotes.delete(id);
        continue;
      }
      remote.x += (remote.tx - remote.x) * k;
      remote.z += (remote.tz - remote.z) * k;
      remote.y += (remote.ty - remote.y) * k;
      remote.yaw += angNorm(remote.tyaw - remote.yaw) * Math.min(1, dt * 8);
      const speed = Math.hypot(remote.tx - remote.x, remote.tz - remote.z);
      if (remote.car) {
        remote.car.position.set(remote.x, remote.y, remote.z);
        remote.car.rotation.y = remote.yaw;
      } else {
        remote.actor.model.position.set(remote.x, remote.y, remote.z);
        remote.actor.model.rotation.y = remote.yaw;
        if (remote.tag) remote.tag.position.y = 2.2;
      }
      locomotion(remote.actor, remote.car ? 0 : Math.min(6, speed * 8), 0);
      remote.actor.mixer.update(dt);
    }
  }

  spawnStoryCast() {
    this.storyCast = CAST.map((person) => {
      const npc = this.makeNpc(person.pack);
      npc.team = 'story';
      npc.castId = person.id;
      npc.name = person.name;
      npc.x = person.home.x;
      npc.z = person.home.z;
      npc.yaw = Math.PI;
      tintActor(npc.actor, person);
      addAccessory(npc.actor, person.hat);
      npc.actor.model.add(makeNameTag(person.name, person.cloth));
      npc.actor.play('Idle');
      this.npcs.push(npc);
      return npc;
    });
  }

  tryStoryTalk() {
    const here = this.focus();
    const npc = (this.storyCast || []).find((item) => dist2(here.x, here.z, item.x, item.z) < 16);
    if (!npc) return false;
    const person = castById(npc.castId);
    const chapter = CHAPTERS[this.storyChapter];
    if (this.mission) {
      this.ui.toast('先把眼前这单做完');
      return true;
    }
    if (!chapter || chapter.giver !== npc.castId) {
      this.playCutscene([{ who: person.name, text: person.blurb }], person.cloth, () => this.setMode('play'));
      return true;
    }
    if (this.guideStep < GUIDE.length) {
      this.ui.toast('先跟着橙色光柱做完教程');
      return true;
    }
    this.beginChapter(chapter);
    return true;
  }

  beginChapter(chapter) {
    const person = castById(chapter.giver);
    this.playCutscene(chapter.intro, person.cloth, () => {
      this.mission = {
        id: chapter.id,
        phase: 'go',
        got: chapter.bags ? chapter.bags.map(() => false) : null,
        gate: 0,
      };
      if (chapter.wanted) {
        this.wanted = Math.max(this.wanted, chapter.wanted);
        this.ensurePolice(true);
      }
      this.objectiveSig = '';
      this.setMode('play');
      this.ui.toast(chapter.title);
    });
  }

  playCutscene(lines, color, done) {
    this.cutscene = { lines, i: 0, color, done };
    this.mode = 'cutscene';
    this.input.exitLock();
    this.ui.showCutscene(lines[0], color);
  }

  advanceCutscene() {
    if (!this.cutscene) return;
    this.cutscene.i += 1;
    const line = this.cutscene.lines[this.cutscene.i];
    if (!line) {
      const done = this.cutscene.done;
      this.cutscene = null;
      this.ui.hideCutscene();
      done?.();
      return;
    }
    const who = CAST.find((item) => item.name === line.who);
    this.ui.showCutscene(line, who?.cloth || this.cutscene.color);
  }

  storyInteract() {
    const chapter = CHAPTERS.find((item) => item.id === this.mission?.id);
    if (!chapter || chapter.kind !== 'pump') return false;
    const here = this.focus();
    if (dist2(here.x, here.z, chapter.spot.x, chapter.spot.z) > chapter.spot.r ** 2) return false;
    this.finishStory(chapter);
    return true;
  }

  updateStoryMission(mission) {
    const chapter = CHAPTERS.find((item) => item.id === mission.id);
    if (!chapter) return;
    const here = this.focus();
    let target = chapter.spot;
    let text = chapter.objective;
    let done = false;
    if (chapter.kind === 'reach') {
      done = dist2(here.x, here.z, chapter.spot.x, chapter.spot.z) < chapter.spot.r ** 2;
    } else if (chapter.kind === 'two') {
      if (mission.phase !== 'back') {
        if (dist2(here.x, here.z, chapter.spot.x, chapter.spot.z) < chapter.spot.r ** 2) {
          mission.phase = 'back';
          this.ui.toast(chapter.mid);
        }
      } else {
        target = chapter.back;
        text = chapter.backText;
        done = dist2(here.x, here.z, chapter.back.x, chapter.back.z) < chapter.back.r ** 2;
      }
    } else if (chapter.kind === 'bags') {
      const left = mission.got.findIndex((flag) => !flag);
      if (left >= 0) {
        target = chapter.bags[left];
        text = `${chapter.objective} ${mission.got.filter(Boolean).length}/3`;
        chapter.bags.forEach((spot, index) => {
          if (!mission.got[index] && dist2(here.x, here.z, spot.x, spot.z) < 12) mission.got[index] = true;
        });
      } else {
        target = chapter.spot;
        text = chapter.backText;
        done = dist2(here.x, here.z, chapter.spot.x, chapter.spot.z) < chapter.spot.r ** 2;
      }
    } else if (chapter.kind === 'escape') {
      text = `故事 5/8 · ${this.wanted} 星，甩掉后再进安全屋`;
      done = this.wanted === 0 && dist2(here.x, here.z, chapter.spot.x, chapter.spot.z) < chapter.spot.r ** 2;
    } else if (chapter.kind === 'fly') {
      const flying = this.vehicle && (this.vehicle.kind === 'heli' || this.vehicle.kind === 'plane');
      text = flying ? '故事 6/8 · 继续拉高，超过 12 米' : chapter.objective;
      done = !!flying && here.y > 12;
    } else if (chapter.kind === 'gates') {
      const gate = chapter.gates[Math.min(mission.gate, chapter.gates.length - 1)];
      target = gate;
      text = `故事 7/8 · 光环 ${Math.min(mission.gate + 1, chapter.gates.length)}/${chapter.gates.length}`;
      if (mission.gate < chapter.gates.length && dist2(here.x, here.z, gate.x, gate.z) < gate.r ** 2) {
        mission.gate += 1;
        if (mission.gate >= chapter.gates.length) done = true;
      }
    } else if (chapter.kind === 'finale') {
      if (mission.phase !== 'fly') {
        if (dist2(here.x, here.z, chapter.spot.x, chapter.spot.z) < chapter.spot.r ** 2) {
          mission.phase = 'fly';
          this.ui.toast('上直升机，拉高离开');
        }
      } else {
        const flying = this.vehicle && (this.vehicle.kind === 'heli' || this.vehicle.kind === 'plane');
        text = '故事 8/8 · 拉高离开港口';
        done = !!flying && here.y > 12;
      }
    }
    if (done) {
      this.finishStory(chapter);
      return;
    }
    this.beacon.visible = !!target;
    if (target) {
      this.beacon.position.set(target.x, 2.6, target.z);
      this.beacon.rotation.y = this.time;
    }
    if (text !== this.objectiveSig) {
      this.objectiveSig = text;
      this.ui.setObjective(text);
    }
  }

  finishStory(chapter) {
    if (!this.mission || this.mission.id !== chapter.id) return;
    this.mission = null;
    const reward = chapter.reward || {};
    if (reward.usd) this.usd += reward.usd;
    if (reward.rep) this.rep += reward.rep;
    if (reward.orng) this.bal.ORNG += reward.orng;
    if (reward.btc) this.bal.BTC += reward.btc;
    if (reward.sol) this.bal.SOL += reward.sol;
    this.storyChapter = Math.max(this.storyChapter, CHAPTERS.indexOf(chapter) + 1);
    this.walletSig = '';
    this.objectiveSig = '';
    this.audio.success();
    this.ui.toast(`${chapter.title} 完成`);
    this.save();
    const next = () => this.setMode('play');
    if (chapter.outro?.length) this.playCutscene(chapter.outro, castById(chapter.giver).cloth, next);
    else next();
  }

  snapshot() {
    const here = this.focus();
    const dummy = this.npcs.find((npc) => npc.dummy);
    return {
      ready: this.ready,
      mode: this.mode,
      x: here.x,
      z: here.z,
      y: here.y,
      speed: this.vehicle ? this.vehicle.speed : this.player.speed,
      vehicle: this.vehicle?.id || null,
      kind: this.vehicle?.kind || null,
      altitude: here.y,
      wanted: this.wanted,
      hp: this.player.hp,
      armor: this.player.armor,
      weapon: this.weapon,
      ammo: this.ammo,
      mission: this.mission ? { ...this.mission } : null,
      usd: this.usd,
      bal: { ...this.bal },
      time: this.time,
      fps: this.fps || 0,
      draws: this.renderer?.info?.render?.calls || 0,
      dummyHp: dummy ? dummy.hp : null,
      dummyAlive: dummy ? dummy.alive : null,
      source: getPriceSource(),
      buildings: this.world?.buildings?.length || 0,
      npcs: this.npcs.filter((npc) => npc.alive && npc.actor.model.visible).length,
      guideStep: this.guideStep,
      rep: this.rep,
      story: this.storyChapter,
      nick: this.displayName(),
      online: this.onlineCount,
      remotes: [...this.remotes.values()].map((item) => item.nick),
      level: this.level(),
      route: this.routeCount || 0,
      jumpY: this.player.y,
    };
  }
}
