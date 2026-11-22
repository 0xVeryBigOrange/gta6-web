const MOVE = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

export function createInput(canvas) {
  const keys = new Set();
  const edges = new Set();
  const mouse = { dx: 0, dy: 0, wheel: 0 };
  const pad = {
    x: 0,
    y: 0,
    lookX: 0,
    lookY: 0,
    run: false,
    interact: false,
    car: false,
    mission: false,
    pause: false,
    horn: false,
  };
  let dragging = false;

  function down(e) {
    if (MOVE.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    edges.add(e.code);
  }
  function up(e) {
    keys.delete(e.code);
  }
  function blur() {
    keys.clear();
  }
  function move(e) {
    if (document.pointerLockElement === canvas || dragging) {
      mouse.dx += e.movementX || 0;
      mouse.dy += e.movementY || 0;
    }
  }
  function wheel(e) {
    mouse.wheel += Math.sign(e.deltaY);
  }
  function pointerDown(e) {
    if (e.button !== 0) return;
    if (e.target !== canvas) return;
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
  }
  function pointerUp() {
    dragging = false;
  }

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  window.addEventListener('mousemove', move);
  canvas.addEventListener('wheel', wheel, { passive: true });
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    pad,
    locked() {
      return document.pointerLockElement === canvas;
    },
    requestLock() {
      if (matchMedia('(pointer: coarse)').matches) return;
      try {
        const pending = canvas.requestPointerLock?.();
        if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      } catch {
        /* pointer lock needs a user gesture in some browsers */
      }
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock?.();
    },
    held() {
      return [...keys];
    },
    axis() {
      let x = pad.x;
      let y = pad.y;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      const mag = Math.hypot(x, y);
      if (mag > 1) {
        x /= mag;
        y /= mag;
      }
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || pad.run;
      return { x, y, run };
    },
    horn() {
      return keys.has('Space') || pad.horn;
    },
    pressed(code) {
      return edges.has(code);
    },
    endFrame() {
      edges.clear();
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.wheel = 0;
      pad.lookX = 0;
      pad.lookY = 0;
      pad.interact = false;
      pad.car = false;
      pad.mission = false;
      pad.pause = false;
      pad.horn = false;
    },
    consumeLook() {
      const look = { x: mouse.dx + pad.lookX, y: mouse.dy + pad.lookY, wheel: mouse.wheel };
      return look;
    },
    clearKeys() {
      keys.clear();
    },
  };
}
