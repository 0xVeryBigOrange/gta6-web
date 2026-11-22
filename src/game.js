import * as THREE from 'three';
import { createWorld } from './world.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { getOrngMult, getPriceSource, getPrices, refreshPrices, setOrngMult, tickSimulated } from './prices.js';
import {
  BUILD_LIMIT,
  CARS,
  CELL,
  COINS,
  LINES,
  MISSIONS,
  ORIGIN,
  PROPS,
  SPOTS,
  STARTING,
  WORLD,
  linePos,
  roadSegments,
} from './config.js';
import { angNorm, clamp, dist2, fmtNum, fmtUsd, mulberry32 } from './util.js';

const DROPS = [
  { id: 'BTC', amt: 0.0015 },
  { id: 'ETH', amt: 0.02 },
  { id: 'SOL', amt: 0.35 },
  { id: 'DOGE', amt: 60 },
  { id: 'ORNG', amt: 80 },
];

function missionName(id) {
  return MISSIONS.find((m) => m.id === id)?.name || id;
}

export class Game {
  constructor(root) {
    this.root = root;
    this.ui = createUI(root);
    this.input = createInput(this.ui.canvas);
    this.ui.bindTouch(this.input.pad);
    this.audio = createAudio();
    this.mode = 'title';
    this.started = false;
    this.time = 0;
    this.camYaw = 0.6;
    this.camPitch = -0.22;
    this.camDist = 8;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.mission = null;
    this.vehicle = null;
    this.freezePolice = false;
    this.confirmNew = false;
    this.walletSig = '';
    this.objectiveSig = '';
    this.promptSig = '';
    this.starSig = -1;
    this.coinSweep = false;
    this.crashed = null;
    this.fpsFrames = 0;
    this.fpsWall = performance.now();
    this.priceTimer = 30;
    this.simTimer = 0;
    this.saveTimer = 0;
    this.headlineTimer = 0;
    this.suppressLock = false;
    this.rng = mulberry32(0x51ce5);

    this.usd = STARTING.usd;
    this.bal = { ...STARTING.bal };
    this.ownedCars = new Set(['runner']);
    this.ownedProps = new Set();
    this.done = new Set();
    this.collected = new Set();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setSize(root.clientWidth, root.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
    this.world = createWorld(this.scene);
    this.player = this.createPlayer();
    this.scene.add(this.player.mesh);
    this.cars = [];
    this.garage = [];
    this.police = [];
    this.peds = [];
    this.coins = [];
    this.spawnGarage();
    this.spawnTraffic(8);
    this.spawnPeds(16);
    this.spawnCoins();
    this.spawnProps();
    this.beacon = this.createBeacon();
    this.scene.add(this.beacon);

    this.clock = new THREE.Clock();
    this.bindUI();
    this.ui.setContinueEnabled(!!loadSave());
    this.ui.setSoundLabel(true);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.mode === 'play' && !this.suppressLock) this.pause();
    });

    this.debug = {
      tp: (x, z) => this.teleport(x, z),
      setWanted: (n) => {
        this.wanted = clamp(n, 0, 5);
        this.wantedTimer = 0;
        this.ensurePolice();
      },
      setFreezePolice: (v) => {
        this.freezePolice = v;
      },
      cam: (yaw, pitch, dist) => {
        if (yaw != null) this.camYaw = yaw;
        if (pitch != null) this.camPitch = pitch;
        if (dist != null) this.camDist = dist;
      },
      snapshot: () => this.snapshot(),
    };
  }

  start() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.time += dt;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    refreshPrices(this.rng).then(() => this.pushPrices());
  }

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  bindUI() {
    this.ui.onNew = () => {
      if (loadSave() && !this.confirmNew) {
        this.confirmNew = true;
        this.ui.toast('再点一次「新游戏」会覆盖本地存档');
        return;
      }
      this.confirmNew = false;
      this.newGame();
    };
    this.ui.onContinue = () => {
      const data = loadSave();
      if (!data) return;
      this.applyState(data, false);
      this.beginPlay('存档已读取');
    };
    this.ui.onResume = () => this.resume();
    this.ui.onQuit = () => {
      if (this.started) this.save();
      this.started = false;
      this.mode = 'title';
      this.vehicle = null;
      this.player.mesh.visible = true;
      this.ui.hidePause();
      this.ui.hideHelp();
      this.ui.closeModal();
      this.ui.showTitle();
      this.ui.setContinueEnabled(!!loadSave());
      this.audio.setEngine(0);
      this.audio.setSiren(0);
    };
    this.ui.onSave = () => {
      this.save();
      this.ui.toast('已写入本地存档');
    };
    this.ui.onToggleSound = () => {
      const on = this.audio.toggle();
      this.ui.setSoundLabel(on);
    };
    this.ui.onOpenExchange = () => {
      if (this.mode !== 'play') return;
      this.openModal('exchange');
    };
    this.ui.onCloseModal = () => this.closeModal();
    this.ui.onTrade = (id, side, amount) => this.trade(id, side, amount);
    this.ui.onAcceptMission = (id) => this.acceptMission(id);
    this.ui.onAbandon = () => this.abandonMission();
    this.ui.onBuy = (id, pay) => this.buy(id, pay);
  }

  newGame() {
    this.applyState(
      {
        usd: STARTING.usd,
        bal: { ...STARTING.bal },
        ownedCars: ['runner'],
        ownedProps: [],
        done: [],
        collected: [],
        wanted: 0,
        mission: null,
        orngMult: 1,
        player: { x: SPOTS.spawn.x, z: SPOTS.spawn.z, camYaw: 0.4, camPitch: -0.22 },
      },
      true,
    );
    this.coinSweep = false;
    this.beginPlay('欢迎来到 Vice Chain。路边的橙行者按 F 就能开。');
  }

  beginPlay(message) {
    this.started = true;
    this.mode = 'play';
    this.ui.hideHelp();
    this.ui.hidePause();
    this.ui.closeModal();
    this.ui.setPlayVisible(true);
    this.audio.resume();
    this.input.requestLock();
    this.pushPrices();
    this.ui.toast(message);
    this.save();
  }

  applyState(data, reset) {
    this.usd = data.usd;
    this.bal = { ...STARTING.bal, ...data.bal };
    this.ownedCars = new Set(data.ownedCars || ['runner']);
    this.ownedProps = new Set(data.ownedProps || []);
    this.done = new Set(data.done || []);
    this.collected = new Set(data.collected || []);
    this.wanted = data.wanted || 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.mission = data.mission ? structuredClone(data.mission) : null;
    setOrngMult(data.orngMult || 1);
    this.vehicle = null;
    this.player.mesh.visible = true;
    for (const coin of this.coins) {
      coin.got = this.collected.has(coin.id);
      coin.mesh.visible = !coin.got;
    }
    if (reset) {
      for (const car of this.garage) {
        const def = CARS.find((c) => c.id === car.defId);
        car.x = def.x;
        car.z = def.z;
        car.yaw = def.yaw;
        car.speed = 0;
      }
      this.teleport(SPOTS.spawn.x, SPOTS.spawn.z);
      this.camYaw = 0.4;
      this.camPitch = -0.22;
    } else if (data.player) {
      this.teleport(data.player.x, data.player.z);
      this.camYaw = data.player.camYaw ?? 0.4;
      this.camPitch = data.player.camPitch ?? -0.22;
      for (const saved of data.cars || []) {
        const car = this.garage.find((c) => c.defId === saved.id);
        if (!car) continue;
        car.x = saved.x;
        car.z = saved.z;
        car.yaw = saved.yaw;
        car.speed = 0;
      }
    }
    this.ensurePolice();
    this.walletSig = '';
  }

  frame(dt) {
    this.handleGlobalKeys();
    if (!this.started) {
      this.syncCars(0);
      this.updateCinematic(dt);
    } else if (this.mode === 'play') {
      if (!this.crashed) {
        try {
          this.updateSim(dt);
        } catch (err) {
          this.crashed = err;
          console.error(err);
          this.ui.toast(`出错了：${err.message}`);
          this.pause();
        }
      }
    } else {
      this.syncCars(0);
      this.world.update(this.time);
      this.audio.setEngine(0);
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
    this.fpsFrames += 1;
    const now = performance.now();
    if (now - this.fpsWall >= 500) {
      this.ui.setFps(Math.round((this.fpsFrames * 1000) / (now - this.fpsWall)));
      this.fpsFrames = 0;
      this.fpsWall = now;
    }
  }

  handleGlobalKeys() {
    if (!this.started) return;
    const esc = this.input.pressed('Escape') || this.input.pad.pause;
    const help = this.input.pressed('KeyH');
    if (esc) {
      if (this.ui.modalOpen()) this.closeModal();
      else if (this.ui.helpOpen()) this.ui.hideHelp();
      else if (this.mode === 'play') this.pause();
      else if (this.mode === 'pause') this.resume();
    } else if (help && this.mode !== 'title') {
      this.ui.showHelp();
    }
  }

  pause() {
    if (!this.started || this.mode === 'pause') return;
    this.suppressLock = true;
    this.mode = 'pause';
    this.input.clearKeys();
    this.input.exitLock();
    this.audio.setEngine(0);
    this.audio.setSiren(0);
    const net = this.netWorth();
    this.ui.showPause(`现金 ${fmtUsd(this.usd)} · 净值 ${fmtUsd(net)} · 通缉 ${this.wanted} 星 · 任务完成 ${this.done.size}/4`);
    setTimeout(() => {
      this.suppressLock = false;
    }, 0);
  }

  resume() {
    this.ui.hideHelp();
    this.ui.hidePause();
    this.ui.closeModal();
    this.mode = 'play';
    this.input.requestLock();
  }

  openModal(kind) {
    if (this.mode !== 'play' && this.mode !== 'modal') return;
    this.suppressLock = true;
    this.mode = 'modal';
    this.input.clearKeys();
    this.input.exitLock();
    this.audio.setEngine(0);
    if (kind === 'exchange') this.ui.openExchange(this.marketModel());
    if (kind === 'missions') {
      this.ui.openMissions({
        active: this.mission?.id || null,
        activeName: this.mission ? missionName(this.mission.id) : '',
        done: [...this.done],
      });
    }
    if (kind === 'dealer') {
      this.ui.openShop({
        title: '车行 · 用加密货币或现金提车',
        usd: this.usd,
        bal: this.bal,
        prices: getPrices(),
        items: CARS.map((car) => ({
          id: car.id,
          name: car.name,
          blurb: car.blurb,
          price: car.price,
          owned: this.ownedCars.has(car.id),
        })),
      });
    }
    setTimeout(() => {
      this.suppressLock = false;
    }, 0);
  }

  closeModal() {
    this.ui.closeModal();
    if (this.started && this.mode === 'modal') {
      this.mode = 'play';
      this.input.requestLock();
    }
  }

  updateCinematic() {
    const ang = this.time * 0.08;
    this.camera.position.set(Math.sin(ang) * 96, 34, 48 + Math.cos(ang) * 46);
    this.camera.lookAt(0, 8, 24);
    this.world.update(this.time);
    this.world.followSun(0, 20);
  }

  updateSim(dt) {
    const look = this.input.consumeLook();
    this.camYaw -= look.x * 0.0022;
    this.camPitch = clamp(this.camPitch - look.y * 0.0016, -0.55, 0.7);
    this.camDist = clamp(this.camDist + look.wheel * 0.55, 4.2, 16);
    if (this.input.pressed('KeyE') || this.input.pad.interact) this.interact();
    if (this.input.pressed('KeyF') || this.input.pad.car) this.toggleVehicle();
    if (this.input.pressed('KeyM') || this.input.pad.mission) this.openModal('missions');
    if (this.input.pressed('Space') && this.vehicle) this.audio.horn();

    const axis = this.input.axis();
    if (!this.vehicle) this.movePlayer(axis, dt);
    else this.drive(axis, dt, look);

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    this.updateWanted(dt);
    this.updateCoins(dt);
    this.updateMission(dt);
    this.syncCars(dt);
    this.updateCamera();
    this.world.update(this.time);
    this.world.followSun(this.player.x, this.player.z);
    this.audio.setEngine(this.vehicle ? Math.abs(this.vehicle.speed) : 0);
    this.audio.setSiren(this.wanted);
    this.updateHud(dt);

    this.priceTimer += dt;
    this.simTimer += dt;
    this.saveTimer += dt;
    if (this.simTimer > 8) {
      this.simTimer = 0;
      tickSimulated(this.rng);
      this.pushPrices();
    }
    if (this.priceTimer > 45) {
      this.priceTimer = 0;
      refreshPrices(this.rng).then(() => this.pushPrices());
    }
    if (this.saveTimer > 8) {
      this.saveTimer = 0;
      this.save();
    }
  }

  movePlayer(axis, dt) {
    const speed = axis.run ? 12.2 : 6.3;
    const sy = Math.sin(this.camYaw);
    const cy = Math.cos(this.camYaw);
    const dx = (sy * axis.y + cy * axis.x) * speed * dt;
    const dz = (cy * axis.y - sy * axis.x) * speed * dt;
    let nx = this.player.x + dx;
    let nz = this.player.z + dz;
    if (this.blocked(nx, this.player.z, 0.42) || this.hitsAnyCar(nx, this.player.z)) nx = this.player.x;
    if (this.blocked(nx, nz, 0.42) || this.hitsAnyCar(nx, nz)) nz = this.player.z;
    const moved = Math.hypot(nx - this.player.x, nz - this.player.z);
    this.player.x = nx;
    this.player.z = nz;
    if (moved > 0.001) this.player.yaw = Math.atan2(dx, dz);
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.rotation.y = this.player.yaw;
    const swing = moved > 0.001 ? Math.sin(this.time * (axis.run ? 14 : 9)) : 0;
    const limbs = this.player.mesh.userData.limbs;
    limbs.legL.rotation.x = swing * 0.7;
    limbs.legR.rotation.x = -swing * 0.7;
    limbs.armL.rotation.x = -swing * 0.55;
    limbs.armR.rotation.x = swing * 0.55;
    this.player.walking = moved > 0.001;
  }

  drive(axis, dt, look) {
    const car = this.vehicle;
    if (axis.y !== 0) car.speed += axis.y * car.accel * dt;
    else car.speed *= Math.max(0, 1 - 1.7 * dt);
    if (Math.abs(car.speed) < 0.12) car.speed = 0;
    car.speed = clamp(car.speed, -car.max * 0.42, car.max);
    const steerSense = Math.min(1, Math.abs(car.speed) / 4.5) * (car.grip || 1);
    car.yaw += axis.x * steerSense * 1.85 * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    if (!this.carBlocked(nx, car.z, car)) car.x = nx;
    else car.speed *= 0.4;
    if (!this.carBlocked(car.x, nz, car)) car.z = nz;
    else car.speed *= 0.4;
    this.player.x = car.x;
    this.player.z = car.z;
    if (Math.abs(look.x) < 0.4 && Math.abs(look.y) < 0.4) {
      this.camYaw += angNorm(car.yaw - this.camYaw) * Math.min(1, dt * 2.6);
    }
  }

  updateTraffic(dt) {
    for (const car of this.cars) {
      if (!car.traffic || car === this.vehicle) continue;
      car.speed = car.cruise;
      const step = car.dir * car.speed * dt;
      const nx = car.axis === 'x' ? car.x + step : car.x;
      const nz = car.axis === 'z' ? car.z + step : car.z;
      const edge =
        car.axis === 'x'
          ? nx < WORLD.minX + 12 || nx > WORLD.maxX - 12
          : nz < WORLD.minZ + 12 || nz > 118;
      if (edge || this.carBlocked(nx, nz, car, 1.15)) {
        car.wait = (car.wait || 0) + dt;
        if (car.wait > 0.45) {
          car.dir *= -1;
          car.wait = 0;
        }
      } else {
        car.wait = 0;
        car.x = nx;
        car.z = nz;
      }
      if (car.axis === 'x') car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      else car.yaw = car.dir > 0 ? 0 : Math.PI;
    }
  }

  updatePeds(dt) {
    const car = this.vehicle;
    for (const ped of this.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        ped.mesh.rotation.x = 1.15;
        if (ped.down <= 0) {
          ped.mesh.rotation.x = 0;
          const spot = this.randomSidewalk();
          ped.x = spot.x;
          ped.z = spot.z;
        }
        ped.mesh.position.set(ped.x, 0, ped.z);
        continue;
      }
      ped.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      if (this.blocked(ped.x, ped.z, 0.35)) {
        ped.x -= Math.sin(ped.yaw) * ped.speed * dt;
        ped.z -= Math.cos(ped.yaw) * ped.speed * dt;
        ped.yaw += Math.PI * (0.5 + Math.random() * 0.5);
      } else if (Math.random() < dt * 0.35) {
        ped.yaw += (Math.random() - 0.5) * 1.4;
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.yaw;
      const swing = Math.sin(this.time * 6 + ped.phase);
      ped.mesh.userData.limbs.legL.rotation.x = swing * 0.6;
      ped.mesh.userData.limbs.legR.rotation.x = -swing * 0.6;
      if (car && Math.abs(car.speed) > 8 && dist2(car.x, car.z, ped.x, ped.z) < 1.7 * 1.7) {
        ped.down = 3;
        this.addWanted(1, '开车撞到了行人');
      }
    }
  }

  updatePolice(dt) {
    this.ensurePolice();
    for (const car of this.police) {
      const dx = this.player.x - car.x;
      const dz = this.player.z - car.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      if (this.freezePolice) {
        car.mesh.position.set(car.x, 0, car.z);
        continue;
      }
      if (dist + 0.8 < (car.bestDist || Infinity)) {
        car.bestDist = dist;
        car.stuck = 0;
      } else car.stuck = (car.stuck || 0) + dt;
      if (dist > 100 || (car.stuck > 4 && dist > 14 && dist < 42)) {
        const spot = this.roadPoint(34, 62);
        car.x = spot.x;
        car.z = spot.z;
        car.stuck = 0;
        car.bestDist = Math.hypot(this.player.x - car.x, this.player.z - car.z);
      }
      const desired = Math.atan2(dx, dz);
      let chosen = desired;
      const options = [0, 0.6, -0.6, 1.2, -1.2, 2.1, -2.1];
      for (const off of options) {
        const a = desired + off;
        const ax = car.x + Math.sin(a) * 2.8;
        const az = car.z + Math.cos(a) * 2.8;
        if (!this.world.blocked(ax, az, 1.1)) {
          chosen = a;
          break;
        }
      }
      car.yaw += clamp(angNorm(chosen - car.yaw), -2.1 * dt, 2.1 * dt);
      const max = 16 + this.wanted * 1.25;
      car.speed = Math.min(max, (car.speed || 0) + 16 * dt);
      const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
      const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
      if (!this.world.blocked(nx, nz, 1.15)) {
        car.x = nx;
        car.z = nz;
      } else car.speed *= 0.4;
      const flash = Math.sin(this.time * 14) > 0;
      car.red.material.emissiveIntensity = flash ? 2.4 : 0.05;
      car.blue.material.emissiveIntensity = flash ? 0.05 : 2.4;
    }
  }

  updateWanted(dt) {
    let nearest = Infinity;
    for (const car of this.police) {
      nearest = Math.min(nearest, Math.hypot(car.x - this.player.x, car.z - this.player.z));
    }
    if (this.wanted > 0 && nearest > 54) this.wantedTimer += dt;
    else this.wantedTimer = 0;
    const need = this.ownedProps.size > 0 ? 3.5 : 6;
    if (this.wanted > 0 && this.wantedTimer >= need) {
      this.wanted -= 1;
      this.wantedTimer = 0;
      this.ensurePolice();
      if (this.wanted === 0) this.ui.toast('通缉解除');
    }
    const speed = this.vehicle ? Math.abs(this.vehicle.speed) : this.player.walking ? 6 : 0;
    if (this.wanted > 0 && nearest < 3.25 && speed < 5.5) this.bustTimer += dt;
    else this.bustTimer = Math.max(0, this.bustTimer - dt);
    if (this.bustTimer > 1.55) this.bust();
    if (this.mission?.id === 'sec' && this.wanted === 0) this.completeMission();
  }

  updateCoins() {
    for (const coin of this.coins) {
      if (coin.got) continue;
      coin.mesh.position.y = 0.85 + Math.sin(this.time * 2.2 + coin.phase) * 0.12;
      coin.mesh.rotation.y = this.time * 1.6 + coin.phase;
      if (dist2(coin.x, coin.z, this.player.x, this.player.z) < 1.45 * 1.45) {
        coin.got = true;
        coin.mesh.visible = false;
        this.collected.add(coin.id);
        this.bal[coin.drop.id] += coin.drop.amt;
        this.audio.coin();
        this.ui.toast(`捡到 ${fmtNum(coin.drop.amt, COINS.find((c) => c.id === coin.drop.id).dec)} ${coin.drop.id}`);
        this.walletSig = '';
      }
    }
    if (!this.coinSweep && this.collected.size >= this.coins.length) {
      this.coinSweep = true;
      this.ui.toast('街上的币捡完了');
    }
  }

  updateMission(dt) {
    const mission = this.mission;
    this.bags.forEach((bag, i) => {
      const show = mission?.id === 'rug' && mission.phase === 'loot' && !mission.got[i];
      bag.visible = show;
      bag.rotation.y = this.time;
    });
    this.caseMesh.visible = mission?.id === 'cold' && mission.phase === 'pickup';
    if (!mission) {
      this.beacon.visible = false;
      this.missionTarget = null;
      return;
    }
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
        text = `冷钱包专送 · 去北码头取货 · ${Math.ceil(mission.time)}s`;
        if (dist2(this.player.x, this.player.z, target.x, target.z) < target.r * target.r) {
          mission.phase = 'deliver';
          this.ui.toast('拿到冷钱包，送到海滩公寓');
        }
      } else {
        target = SPOTS.coldDrop;
        text = `冷钱包专送 · 送到海滩公寓 · ${Math.ceil(mission.time)}s`;
        if (dist2(this.player.x, this.player.z, target.x, target.z) < target.r * target.r) {
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
          if (dist2(this.player.x, this.player.z, spot.x, spot.z) < 3.1 * 3.1) mission.got[i] = true;
        });
        if (mission.got.every(Boolean)) {
          mission.phase = 'escape';
          this.wanted = Math.max(this.wanted, 4);
          this.ensurePolice();
          this.ui.toast('袋子齐了，回安全屋');
        }
      } else {
        target = SPOTS.safehouse;
        text = 'Rug Pull · 逃回橙子安全屋';
        if (dist2(this.player.x, this.player.z, target.x, target.z) < target.r * target.r) {
          this.completeMission();
          return;
        }
      }
    }
    this.missionTarget = target;
    this.beacon.visible = !!target;
    if (target) {
      this.beacon.position.set(target.x, 0, target.z);
      this.beacon.rotation.y = this.time;
    }
    if (text !== this.objectiveSig) {
      this.objectiveSig = text;
      this.ui.setObjective(text);
    }
  }

  updateCamera() {
    const focusX = this.player.x;
    const focusZ = this.player.z;
    const pitch = this.camPitch;
    const yaw = this.camYaw;
    let dist = this.vehicle ? Math.max(8.5, this.camDist + 2) : this.camDist;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < 5; i += 1) {
      cx = focusX - sy * cp * dist;
      cz = focusZ - cy * cp * dist;
      if (!this.world.blocked(cx, cz, 0.35)) break;
      dist *= 0.72;
    }
    const cyPos = 1.5 - sp * dist;
    this.camera.position.set(cx, Math.max(0.6, cyPos), cz);
    this.camera.lookAt(focusX, 1.35, focusZ);
  }

  updateHud(dt) {
    const sig = `${this.usd.toFixed(0)}|${COINS.map((c) => this.bal[c.id].toFixed(4)).join(',')}|${getOrngMult()}`;
    if (sig !== this.walletSig) {
      this.walletSig = sig;
      const prices = getPrices();
      let net = this.usd;
      for (const coin of COINS) net += this.bal[coin.id] * prices[coin.id];
      this.ui.setWallet({ usd: this.usd, bal: this.bal, net });
    }
    if (!this.mission && this.objectiveSig !== 'idle') {
      this.objectiveSig = 'idle';
      this.ui.setObjective('收集硬币，按 M 接任务。市中心有橙子交易所。');
    }
    if (this.wanted !== this.starSig) {
      this.starSig = this.wanted;
      this.ui.setStars(this.wanted);
    }
    const prompt = this.currentPrompt();
    if (prompt !== this.promptSig) {
      this.promptSig = prompt;
      this.ui.setPrompt(prompt);
    }
    this.ui.setSpeed(this.vehicle ? `${Math.round(Math.abs(this.vehicle.speed) * 3.6)} km/h` : '');
    this.drawMinimap();
    this.headlineTimer += dt;
    if (this.headlineTimer > 14) {
      this.headlineTimer = 0;
      this.ui.setHeadline();
    }
  }

  currentPrompt() {
    const bits = [];
    if (!this.vehicle) {
      const car = this.nearestCar();
      if (car) {
        if (car.defId && !this.ownedCars.has(car.defId)) bits.push('这辆还没买 · 去车行');
        else bits.push('按 F 上车');
      }
    } else bits.push('按 F 下车');
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
      { ...PROPS[0], r: 4.2, prompt: '按 E 看海滩公寓' },
      { ...PROPS[1], r: 4.2, prompt: '按 E 看霓虹阁楼' },
    ];
    let best = null;
    let bestD = Infinity;
    for (const spot of spots) {
      const d = dist2(this.player.x, this.player.z, spot.x, spot.z);
      const r = spot.r || 4;
      if (d < r * r && d < bestD) {
        best = spot;
        bestD = d;
      }
    }
    return best;
  }

  interact() {
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
    if (spot.name === '橙子交易所' || spot.x === SPOTS.exchange.x && spot.z === SPOTS.exchange.z) {
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
    const prop = PROPS.find((p) => p.x === spot.x && p.z === spot.z);
    if (prop) {
      this.suppressLock = true;
      this.mode = 'modal';
      this.input.exitLock();
      this.ui.openShop({
        title: prop.name,
        usd: this.usd,
        bal: this.bal,
        prices: getPrices(),
        items: [{ ...prop, owned: this.ownedProps.has(prop.id) }],
      });
      setTimeout(() => {
        this.suppressLock = false;
      }, 0);
    }
  }

  toggleVehicle() {
    if (this.vehicle) {
      const car = this.vehicle;
      const side = car.yaw + Math.PI / 2;
      let x = car.x + Math.sin(side) * 2.3;
      let z = car.z + Math.cos(side) * 2.3;
      if (this.blocked(x, z, 0.45)) {
        x = car.x - Math.sin(side) * 2.3;
        z = car.z - Math.cos(side) * 2.3;
      }
      this.player.x = x;
      this.player.z = z;
      this.player.yaw = car.yaw;
      this.player.mesh.visible = true;
      this.player.mesh.position.set(x, 0, z);
      this.vehicle = null;
      car.speed = 0;
      return;
    }
    const car = this.nearestCar();
    if (!car) return;
    if (car.defId && !this.ownedCars.has(car.defId)) {
      this.ui.toast(`${car.name} 还停在车行账上`);
      return;
    }
    if (car.traffic) {
      car.traffic = false;
      car.stolen = true;
      this.addWanted(1, '征用了一辆车');
      this.spawnTraffic(1);
    }
    this.vehicle = car;
    this.player.mesh.visible = false;
    this.camYaw = car.yaw;
  }

  nearestCar() {
    let best = null;
    let bestD = 4.8 * 4.8;
    for (const car of this.cars) {
      if (car.police) continue;
      const d = dist2(car.x, car.z, this.player.x, this.player.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
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
    const car = CARS.find((c) => c.id === id);
    const prop = PROPS.find((p) => p.id === id);
    const item = car || prop;
    if (!item || item.price <= 0) return;
    if ((car && this.ownedCars.has(id)) || (prop && this.ownedProps.has(id))) return;
    const price = item.price;
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
    if (id === 'cold') this.mission = { id, phase: 'pickup', time: 80 };
    if (id === 'sec') {
      this.mission = { id, phase: 'escape' };
      this.wanted = Math.max(this.wanted, 3);
      this.ensurePolice();
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
      this.ensurePolice();
    }
    this.objectiveSig = '';
    this.ui.toast(`已接受：${missionName(id)}`);
    this.audio.buy();
    this.closeModal();
    this.save();
  }

  abandonMission() {
    if (!this.mission) return;
    if (this.mission.id === 'pump') setOrngMult(1);
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
    this.done.add(mission.id);
    this.mission = null;
    this.objectiveSig = '';
    this.walletSig = '';
    this.audio.success();
    this.ui.toast(`任务完成：${missionName(mission.id)}`);
    if (this.done.size >= 4) this.ui.toast('四单都做完了。海边的霓虹还亮着。');
    this.pushPrices();
    if (this.ui.modalOpen()) this.closeModal();
    this.save();
  }

  failMission(reason) {
    if (this.mission?.id === 'pump') setOrngMult(1);
    this.mission = null;
    this.objectiveSig = '';
    this.audio.fail();
    this.ui.toast(reason);
    this.pushPrices();
    this.save();
  }

  bust() {
    this.bustTimer = 0;
    this.wanted = 0;
    this.ensurePolice();
    const fine = Math.min(this.usd, Math.max(150, this.usd * 0.12));
    this.usd -= fine;
    this.walletSig = '';
    if (this.vehicle) {
      this.vehicle.speed = 0;
      this.player.mesh.visible = true;
      this.vehicle = null;
    }
    this.teleport(SPOTS.safehouse.x + 8, SPOTS.safehouse.z);
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
    this.ensurePolice();
    if (reason) this.ui.toast(`${reason} · ${this.wanted} 星`);
  }

  ensurePolice() {
    const need = this.wanted === 0 ? 0 : Math.min(4, this.wanted);
    while (this.police.length < need) {
      const spot = this.roadPoint(36, 68);
      const car = this.makeCar(0x142033, { police: true, cast: true });
      car.police = true;
      car.x = spot.x;
      car.z = spot.z;
      car.yaw = 0;
      car.speed = 0;
      car.max = 22;
      car.accel = 16;
      this.cars.push(car);
      this.police.push(car);
      this.scene.add(car.mesh);
    }
    while (this.police.length > need) {
      const car = this.police.pop();
      this.scene.remove(car.mesh);
      this.cars = this.cars.filter((item) => item !== car);
      if (this.vehicle === car) this.vehicle = null;
    }
  }

  marketModel() {
    return { prices: getPrices(), bal: { ...this.bal }, usd: this.usd, source: getPriceSource() };
  }

  pushPrices() {
    this.ui.setTicker(getPrices(), getPriceSource(), getOrngMult() >= 3);
    this.walletSig = '';
  }

  netWorth() {
    const prices = getPrices();
    return COINS.reduce((sum, coin) => sum + this.bal[coin.id] * prices[coin.id], this.usd);
  }

  save() {
    const data = {
      v: 1,
      usd: this.usd,
      bal: this.bal,
      ownedCars: [...this.ownedCars],
      ownedProps: [...this.ownedProps],
      done: [...this.done],
      collected: [...this.collected],
      wanted: this.wanted,
      mission: this.mission ? structuredClone(this.mission) : null,
      orngMult: getOrngMult(),
      player: { x: this.player.x, z: this.player.z, camYaw: this.camYaw, camPitch: this.camPitch },
      cars: this.garage.map((car) => ({ id: car.defId, x: car.x, z: car.z, yaw: car.yaw })),
    };
    writeSave(data);
    this.ui.setContinueEnabled(true);
  }

  snapshot() {
    return {
      mode: this.mode,
      started: this.started,
      x: this.player.x,
      z: this.player.z,
      usd: this.usd,
      bal: { ...this.bal },
      wanted: this.wanted,
      mission: this.mission ? { ...this.mission, got: this.mission.got ? [...this.mission.got] : null } : null,
      done: [...this.done],
      collected: this.collected.size,
      vehicle: this.vehicle ? this.vehicle.defId || 'traffic' : null,
      speed: this.vehicle ? this.vehicle.speed : 0,
      source: getPriceSource(),
      orngMult: getOrngMult(),
      police: this.police.length,
      ownedCars: [...this.ownedCars],
      ownedProps: [...this.ownedProps],
      camYaw: this.camYaw,
    };
  }

  teleport(x, z) {
    this.player.x = x;
    this.player.z = z;
    this.player.mesh.position.set(x, 0, z);
    if (this.vehicle) {
      this.vehicle.x = x;
      this.vehicle.z = z;
      this.vehicle.speed = 0;
      this.vehicle.mesh.position.set(x, 0, z);
    }
  }

  blocked(x, z, radius) {
    return this.world.blocked(x, z, radius);
  }

  hitsAnyCar(x, z) {
    for (const car of this.cars) {
      if (dist2(x, z, car.x, car.z) < 1.55 * 1.55) return true;
    }
    return false;
  }

  carBlocked(x, z, self, radius = 1.25) {
    if (this.world.blocked(x, z, radius)) return true;
    for (const other of this.cars) {
      if (other === self) continue;
      if (dist2(x, z, other.x, other.z) < (radius + 1.15) ** 2) return true;
    }
    return false;
  }

  roadPoint(minDist, maxDist) {
    for (let n = 0; n < 40; n += 1) {
      const p = linePos(Math.floor(Math.random() * LINES));
      const along = ORIGIN + Math.random() * (LINES - 1) * CELL;
      const horizontal = Math.random() < 0.5;
      const x = horizontal ? along : p + (Math.random() < 0.5 ? -3 : 3);
      const z = horizontal ? p + (Math.random() < 0.5 ? -3 : 3) : along;
      const d = Math.hypot(x - this.player.x, z - this.player.z);
      if (d >= minDist && d <= maxDist && !this.world.blocked(x, z, 1.3)) return { x, z };
    }
    return { x: clamp(this.player.x + 40, WORLD.minX + 10, WORLD.maxX - 10), z: clamp(this.player.z, WORLD.minZ + 10, 100) };
  }

  randomSidewalk() {
    const ix = Math.floor(Math.random() * (LINES - 1));
    const iz = Math.floor(Math.random() * (LINES - 1));
    const cx = ORIGIN + (ix + 0.5) * CELL;
    const cz = ORIGIN + (iz + 0.5) * CELL;
    const o = BUILD_LIMIT + 2.2;
    const options = [
      [cx + o, cz],
      [cx - o, cz],
      [cx, cz + o],
      [cx, cz - o],
    ];
    const pick = options[Math.floor(Math.random() * options.length)];
    return { x: pick[0], z: pick[1] };
  }

  spawnGarage() {
    for (const def of CARS) {
      const car = this.makeCar(def.color, { cast: true });
      car.defId = def.id;
      car.name = def.name;
      car.max = def.max;
      car.accel = def.accel;
      car.grip = def.grip;
      car.x = def.x;
      car.z = def.z;
      car.yaw = def.yaw;
      car.speed = 0;
      this.cars.push(car);
      this.garage.push(car);
      this.scene.add(car.mesh);
    }
  }

  spawnTraffic(count) {
    const colors = [0xf2f2f4, 0xcfd6e4, 0xf0d15a, 0x69d2c4, 0xe25b5b, 0x20242e];
    for (let i = 0; i < count; i += 1) {
      const horizontal = Math.random() < 0.5;
      const p = linePos(Math.floor(Math.random() * LINES));
      const along = ORIGIN + Math.random() * (LINES - 1) * CELL;
      const side = Math.random() < 0.5 ? 3.1 : -3.1;
      const car = this.makeCar(colors[i % colors.length], { cast: false });
      car.traffic = true;
      car.axis = horizontal ? 'x' : 'z';
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.cruise = 7 + Math.random() * 5;
      car.speed = car.cruise;
      car.max = 22;
      car.accel = 16;
      if (horizontal) {
        car.x = along;
        car.z = p + side;
        car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = p + side;
        car.z = along;
        car.yaw = car.dir > 0 ? 0 : Math.PI;
      }
      this.cars.push(car);
      this.scene.add(car.mesh);
    }
  }

  spawnPeds(count) {
    const colors = [0xff8a1e, 0x3df0ff, 0xff2d95, 0xffe27a, 0x9ad07a, 0xffffff];
    for (let i = 0; i < count; i += 1) {
      const spot = this.randomSidewalk();
      const mesh = this.createPerson(colors[i % colors.length]);
      mesh.position.set(spot.x, 0, spot.z);
      this.scene.add(mesh);
      this.peds.push({
        mesh,
        x: spot.x,
        z: spot.z,
        yaw: Math.random() * Math.PI * 2,
        speed: 1.1 + Math.random() * 0.7,
        phase: Math.random() * 6,
        down: 0,
      });
    }
  }

  spawnCoins() {
    const rng = mulberry32(0xc01d5eed);
    const pts = [];
    for (let ix = 0; ix < LINES - 1; ix += 1) {
      for (let iz = 0; iz < LINES - 1; iz += 1) {
        const cx = ORIGIN + (ix + 0.5) * CELL;
        const cz = ORIGIN + (iz + 0.5) * CELL;
        const o = BUILD_LIMIT + 2.3;
        pts.push([cx + o, cz], [cx - o, cz], [cx, cz + o], [cx, cz - o]);
      }
    }
    pts.push([20, 150], [-10, 162], [70, 148], [-40, 155], [90, 158]);
    for (let i = pts.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const chosen = pts.filter((p) => !this.world.blocked(p[0], p[1], 0.4)).slice(0, 36);
    chosen.forEach((p, index) => {
      const drop = DROPS[index % DROPS.length];
      const color = new THREE.Color(COINS.find((c) => c.id === drop.id).color);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.1, 14),
        new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28, emissive: color, emissiveIntensity: 0.35 }),
      );
      mesh.position.set(p[0], 0.85, p[1]);
      this.scene.add(mesh);
      this.coins.push({ id: index, x: p[0], z: p[1], mesh, drop, got: false, phase: index });
    });
  }

  spawnProps() {
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xff8a1e, emissiveIntensity: 0.45 });
    this.bags = SPOTS.loot.map((spot) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.48), bagMat);
      mesh.position.set(spot.x, 0.45, spot.z);
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });
    this.caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.38, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xd7e1ff, emissive: 0x8aa4ff, emissiveIntensity: 0.4, metalness: 0.4 }),
    );
    this.caseMesh.position.set(SPOTS.coldPickup.x, 0.7, SPOTS.coldPickup.z);
    this.caseMesh.visible = false;
    this.scene.add(this.caseMesh);
  }

  createBeacon() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.7, 16, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff2d95, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 8;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.55, 24),
      new THREE.MeshBasicMaterial({ color: 0xff2d95, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    group.add(beam, ring);
    group.visible = false;
    return group;
  }

  createPlayer() {
    const mesh = this.createPerson(0xff8a1e);
    mesh.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = true;
    });
    return { mesh, x: SPOTS.spawn.x, z: SPOTS.spawn.z, yaw: 0, walking: false };
  }

  createPerson(color) {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0c7a4, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x242838, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.28), cloth);
    torso.position.y = 1.18;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skin);
    head.position.y = 1.66;
    const legGeo = new THREE.BoxGeometry(0.16, 0.58, 0.18);
    legGeo.translate(0, -0.29, 0);
    const armGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
    armGeo.translate(0, -0.25, 0);
    const legL = new THREE.Mesh(legGeo, pants);
    const legR = new THREE.Mesh(legGeo, pants);
    legL.position.set(-0.12, 0.78, 0);
    legR.position.set(0.12, 0.78, 0);
    const armL = new THREE.Mesh(armGeo, cloth);
    const armR = new THREE.Mesh(armGeo, cloth);
    armL.position.set(-0.36, 1.38, 0);
    armR.position.set(0.36, 1.38, 0);
    group.add(torso, head, legL, legR, armL, armR);
    group.userData.limbs = { legL, legR, armL, armR };
    return group;
  }

  makeCar(color, { police = false, cast = false } = {}) {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.42, 3.8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.48 }),
    );
    body.position.y = 0.55;
    body.castShadow = cast;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.36, 1.65),
      new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.18, metalness: 0.55 }),
    );
    cabin.position.set(0, 0.9, -0.12);
    cabin.castShadow = cast;
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.7 });
    const wheels = [];
    [[-0.78, 1.15], [0.78, 1.15], [-0.78, -1.15], [0.78, -1.15]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, 0.3, z);
      mesh.add(wheel);
      wheels.push(wheel);
    });
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xfff3cc }),
    );
    lamp.position.set(-0.5, 0.58, 1.9);
    const lamp2 = lamp.clone();
    lamp2.position.x = 0.5;
    mesh.add(body, cabin, lamp, lamp2);
    let red = null;
    let blue = null;
    if (police) {
      red = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.12, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x330008, emissive: 0xff2244, emissiveIntensity: 1 }),
      );
      blue = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.12, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x001033, emissive: 0x2266ff, emissiveIntensity: 1 }),
      );
      red.position.set(-0.24, 1.18, 0);
      blue.position.set(0.24, 1.18, 0);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.32),
        new THREE.MeshBasicMaterial({ map: secTexture() }),
      );
      decal.position.set(0, 0.62, 1.91);
      mesh.add(red, blue, decal);
    }
    mesh.userData.wheels = wheels;
    return {
      mesh,
      wheels,
      red,
      blue,
      x: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      max: 20,
      accel: 16,
      spin: 0,
      police,
      traffic: false,
    };
  }

  syncCars(dt) {
    for (const car of this.cars) {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.yaw;
      car.spin += car.speed * dt * 1.4;
      for (const wheel of car.wheels) wheel.rotation.x = car.spin;
    }
  }

  drawMinimap() {
    const ctx = this.ui.minimapCtx;
    const px = this.player.x;
    const pz = this.player.z;
    ctx.clearRect(0, 0, 180, 180);
    ctx.save();
    ctx.beginPath();
    ctx.arc(90, 90, 88, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(14, 8, 24, 0.94)';
    ctx.fillRect(0, 0, 180, 180);
    ctx.save();
    ctx.translate(90, 90);
    ctx.rotate(-this.camYaw);
    ctx.scale(0.7, -0.7);
    ctx.fillStyle = '#e7c48a';
    ctx.fillRect(-150 - px, 132 - pz, 300, 48);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 8;
    for (const seg of roadSegments()) {
      ctx.beginPath();
      ctx.moveTo(seg.x1 - px, seg.z1 - pz);
      ctx.lineTo(seg.x2 - px, seg.z2 - pz);
      ctx.stroke();
    }
    const blip = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x - px, z - pz, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const coin of this.coins) if (!coin.got) blip(coin.x, coin.z, '#ffe27a', 2.3);
    blip(SPOTS.exchange.x, SPOTS.exchange.z, '#3df0ff', 4.2);
    blip(SPOTS.safehouse.x, SPOTS.safehouse.z, '#ff8a1e', 4);
    blip(SPOTS.kiosk.x, SPOTS.kiosk.z, '#ff2d95', 3.2);
    if (this.missionTarget) blip(this.missionTarget.x, this.missionTarget.z, '#ffffff', 5);
    for (const car of this.cars) {
      if (car === this.vehicle) continue;
      blip(car.x, car.z, car.police ? '#ff3355' : '#aeb6c8', car.police ? 3.4 : 2.2);
    }
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(90, 72);
    ctx.lineTo(81, 98);
    ctx.lineTo(90, 91);
    ctx.lineTo(99, 98);
    ctx.fill();
  }
}

let cachedSec = null;
function secTexture() {
  if (cachedSec) return cachedSec;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#ffd24a';
  ctx.font = '700 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SEC', 64, 34);
  cachedSec = new THREE.CanvasTexture(canvas);
  cachedSec.colorSpace = THREE.SRGBColorSpace;
  return cachedSec;
}
