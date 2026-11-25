import { COINS, HEADLINES, MISSIONS } from './config.js';
import { fmtNum, fmtUsd } from './util.js';

function paintTurfMap(canvas, rows, player) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const minX = -220;
  const maxX = 540;
  const minZ = -220;
  const maxZ = 260;
  const toX = (x) => ((x - minX) / (maxX - minX)) * (w - 20) + 10;
  const toY = (z) => ((z - minZ) / (maxZ - minZ)) * (h - 20) + 10;
  ctx.fillStyle = '#10261c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1c6e86';
  ctx.fillRect(toX(-210), toY(188), toX(520) - toX(-210), toY(360) - toY(188));
  for (const row of rows) {
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = row.color;
    const x0 = toX(row.x - row.hw);
    const y0 = toY(row.z - row.hd);
    ctx.fillRect(x0, y0, toX(row.x + row.hw) - x0, toY(row.z + row.hd) - y0);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6ea';
  ctx.font = '12px sans-serif';
  for (const row of rows) {
    ctx.fillText(row.name, toX(row.x) - 22, toY(row.z));
  }
  if (player) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(toX(player.x), toY(player.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createUI(root) {
  root.innerHTML = `
    <canvas id="view"></canvas>
    <div id="hud">
      <div class="brand panel"><b><span class="long">VICE CHAIN 3D</span><span class="short">VICE</span></b><small>GTA6 Web版 · 🍊 大橙子</small></div>
      <div id="ticker" class="panel"><div class="track" id="ticker-track"></div></div>
      <div id="stars" class="panel"><div id="star-row"></div><small id="headline"></small></div>
      <div id="objective" class="panel"></div>
      <div id="race-hud"></div>
      <div id="wallet" class="panel"><button type="button" id="wallet-chip" aria-expanded="false">净值</button><div id="wallet-body"></div></div>
      <div id="minimap-wrap"><canvas id="minimap" width="180" height="180"></canvas></div>
      <div id="prompt" class="panel"></div>
      <div id="speedo"></div>
      <div id="fps"></div>
      <div id="vitals" class="panel">
        <div class="bar"><span id="hp-fill"></span></div>
        <div class="bar armor"><span id="ar-fill"></span></div>
        <div id="weapon-label"></div>
      </div>
      <div id="crosshair"></div>
      <button id="btn-board" type="button">榜</button>
      <button id="btn-journal" type="button">日</button>
      <div id="who" class="panel"></div>
      <div id="toasts"></div>
      <div id="rotate-hint" class="panel"><span>横过来玩更顺手</span><button type="button" id="rotate-dismiss">知道了</button></div>
    </div>
    <div id="hurt"></div>
    <div id="title" class="overlay on">
      <div class="title-card panel">
        <div style="font-size:42px">🍊</div>
        <h1>VICE <span>CHAIN</span></h1>
        <div class="tag">GTA6 Web版 · 里昂尼达链上假日</div>
        <div class="brand-line">大橙子 · @0xVeryBigOrange</div>
        <div id="account-line" class="fine">还没登录。游客进度只留在这台设备。</div>
        <div class="actions">
          <button class="primary" id="btn-new" type="button">新游戏</button>
          <button class="ghost" id="btn-continue" type="button">继续游戏</button>
          <button class="ghost" id="btn-auth" type="button">登录 / 注册</button>
          <button class="ghost" id="btn-guest" type="button">游客游玩</button>
          <button class="ghost" id="btn-logout" type="button">退出登录</button>
          <button class="ghost" id="btn-help-title" type="button">操作说明</button>
        </div>
        <p class="fine">原创恶搞，与任何游戏发行商无关。角色、楼宇与部分载具使用 CC0 模型。<br/>不连接真实钱包，不涉及真实资金。行情只读，交易发生在本地存档里。</p>
      </div>
    </div>
    <div id="pause" class="overlay">
      <div class="menu-card panel">
        <h2>暂停</h2>
        <p id="pause-stats" class="fine"></p>
        <div class="actions">
          <button class="primary" id="btn-resume" type="button">继续</button>
          <button class="ghost" id="btn-board-pause" type="button">排行榜</button>
          <button class="ghost" id="btn-journal-pause" type="button">每日与成就</button>
          <button class="ghost" id="btn-help" type="button">操作说明</button>
          <button class="ghost" id="btn-save" type="button">立即存档</button>
          <button class="ghost" id="btn-sound" type="button">音效：开</button>
          <button class="ghost" id="btn-quit" type="button">保存并回标题</button>
        </div>
      </div>
    </div>
    <div id="help" class="overlay">
      <div class="menu-card panel">
        <h2>操作说明</h2>
        <ul class="help-list">
          <li>W A S D：行走或驾驶。Shift 冲刺，空格跳跃（手机双击摇杆）。开车时 Shift 略加速</li>
          <li>鼠标移动：视角。点击画面锁定鼠标，滚轮缩放</li>
          <li>F：上下车、上船、上飞机。征用别人的载具会增加通缉</li>
          <li>飞机：Shift 加油门，Ctrl 收油，W/S 俯仰，A/D 滚转。速度够了会离地</li>
          <li>直升机：Shift 或空格上升，Ctrl 下降，W/S 前后，A/D 转向</li>
          <li>船只能在海里和港口像样地开</li>
          <li>鼠标左键攻击。1 拳头，2 手枪，3 步枪，R 换弹</li>
          <li>E：交易所、任务、车行、房产，也可以和故事人物说话。地图上的粉标是地下赛，按 E 或互动键发车。色块是帮派地盘，走到敌旗按 E 宣战。M 任务，J 或「日」打开每日、成就和地盘，H 帮助，Esc 暂停，T 挥手</li>
          <li>倒下会在橙子医院醒来。手机：左下摇杆移动，右半屏拖动环顾，右侧按钮开火。横屏更顺手</li>
        </ul>
        <p class="fine">打开菜单时城市时间会暂停。游客进度留在本地。登录后，净值、声望和故事章节会同步到排行榜。每日三单按新加坡时间零点刷新，成就记在同一份存档里。</p>
        <button class="primary" id="btn-help-close" type="button">知道了</button>
      </div>
    </div>
    <div id="modal" class="overlay">
      <div class="modal-card panel" id="modal-body"></div>
    </div>
    <div id="auth" class="overlay">
      <div class="menu-card panel">
        <h2 id="auth-title">登录</h2>
        <p id="auth-msg" class="fine"></p>
        <form id="auth-form" class="auth-form">
          <label id="auth-email-label">邮箱<input id="auth-email" type="email" autocomplete="username" required /></label>
          <label id="auth-pass-label">密码<input id="auth-pass" type="password" autocomplete="current-password" minlength="6" required /></label>
          <label id="auth-nick-label">昵称<input id="auth-nick" type="text" maxlength="16" autocomplete="nickname" placeholder="2 到 16 个字" /></label>
          <div class="actions">
            <button class="primary" id="auth-submit" type="submit">登录</button>
            <button class="ghost" id="auth-switch" type="button">没有账号？去注册</button>
            <button class="ghost" id="auth-close" type="button">返回</button>
          </div>
        </form>
      </div>
    </div>
    <div id="board" class="overlay">
      <div class="modal-card panel">
        <h2>排行榜</h2>
        <div class="board-tabs">
          <button type="button" data-tab="net_worth">净值</button>
          <button type="button" data-tab="reputation">声望</button>
          <button type="button" data-tab="level">等级</button>
        </div>
        <p id="board-msg" class="fine"></p>
        <div id="board-list"></div>
        <div class="actions"><button class="primary" id="board-close" type="button">关闭</button></div>
      </div>
    </div>
    <div id="cutscene" class="overlay">
      <div class="cut-card panel">
        <div class="cut-row">
          <div id="cut-portrait"></div>
          <div>
            <b id="cut-who"></b>
            <p id="cut-text"></p>
          </div>
        </div>
        <button class="primary" id="cut-next" type="button">继续</button>
      </div>
    </div>
    <div id="journal" class="overlay">
      <div class="modal-card panel">
        <h2>每日与成就</h2>
        <div class="board-tabs">
          <button type="button" data-journal="daily">每日</button>
          <button type="button" data-journal="ach">成就</button>
          <button type="button" data-journal="turf">地盘</button>
        </div>
        <p id="journal-msg" class="fine"></p>
        <div id="journal-list"></div>
        <div class="actions"><button class="primary" id="journal-close" type="button">关闭</button></div>
      </div>
    </div>
    <div id="boot" class="overlay on">
      <div class="title-card panel">
        <h2>正在铺设城区…</h2>
        <p id="boot-msg" class="fine">加载角色、楼宇与天空</p>
      </div>
    </div>
    <div id="touch">
      <div id="joy"><div id="knob"></div></div>
      <div id="lookpad"></div>
      <div class="touch-buttons">
        <button type="button" id="t-fire">开火</button>
        <button type="button" id="t-run">奔跑</button>
        <button type="button" id="t-car">上车</button>
        <button type="button" id="t-use">互动</button>
        <button type="button" id="t-mission">任务</button>
        <button type="button" id="t-pause">暂停</button>
      </div>
    </div>
  `;

  const $ = (id) => root.querySelector(id);
  const canvas = $('#view');
  const minimap = $('#minimap');
  let headlineIdx = 0;

  function toast(text) {
    const stack = $('#toasts');
    const cap = document.documentElement.classList.contains('phone') ? 1 : 3;
    while (stack.children.length >= cap) stack.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function syncLayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const phone = w <= 700 || (h <= 520 && w <= 1100);
    document.documentElement.classList.toggle('phone', phone);
    document.documentElement.classList.toggle('portrait', phone && h > w);
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('vice-rotate-dismiss') === '1'; } catch { dismissed = false; }
    const playing = $('#hud').classList.contains('on');
    $('#rotate-hint').classList.toggle('show', phone && h > w && playing && !dismissed);
  }

  const api = {
    canvas,
    minimap,
    minimapCtx: minimap.getContext('2d'),
    toast,
    setPlayVisible(on) {
      $('#hud').classList.toggle('on', on);
      $('#title').classList.toggle('on', !on);
    },
    showTitle() {
      $('#pause').classList.remove('on');
      $('#help').classList.remove('on');
      $('#modal').classList.remove('on');
      $('#auth').classList.remove('on');
      $('#board').classList.remove('on');
      $('#journal').classList.remove('on');
      $('#cutscene').classList.remove('on');
      $('#title').classList.add('on');
      $('#hud').classList.remove('on');
    },
    setContinueEnabled(on) {
      $('#btn-continue').disabled = !on;
    },
    showPause(stats) {
      $('#pause-stats').textContent = stats;
      $('#pause').classList.add('on');
    },
    hidePause() {
      $('#pause').classList.remove('on');
    },
    showHelp() {
      $('#help').classList.add('on');
    },
    hideHelp() {
      $('#help').classList.remove('on');
    },
    helpOpen() {
      return $('#help').classList.contains('on');
    },
    pauseOpen() {
      return $('#pause').classList.contains('on');
    },
    modalOpen() {
      return $('#modal').classList.contains('on');
    },
    closeModal() {
      $('#modal').classList.remove('on');
      $('#modal-body').innerHTML = '';
    },
    setObjective(text) {
      const el = $('#objective');
      el.style.display = text ? 'block' : 'none';
      el.textContent = text || '';
    },
    setRace(text) {
      const el = $('#race-hud');
      el.textContent = text || '';
      el.classList.toggle('on', !!text);
    },
    setPrompt(text) {
      const el = $('#prompt');
      const value = (text || '').trim();
      el.style.display = value ? 'block' : 'none';
      el.textContent = value;
    },
    setSpeed(text) {
      const el = $('#speedo');
      const value = (text || '').trim();
      el.textContent = value;
      el.style.display = value ? 'block' : 'none';
    },
    setFps(n) {
      $('#fps').textContent = String(n);
    },
    setBoot(on, text) {
      $('#boot').classList.toggle('on', !!on);
      if (text) $('#boot-msg').textContent = text;
    },
    setVitals(hp, armor, weapon) {
      $('#hp-fill').style.width = `${Math.max(0, Math.min(100, hp))}%`;
      $('#ar-fill').style.width = `${Math.max(0, Math.min(100, armor))}%`;
      $('#weapon-label').textContent = weapon;
    },
    setCrosshair(on) {
      $('#crosshair').classList.toggle('on', !!on);
    },
    flashHurt() {
      const el = $('#hurt');
      el.classList.add('on');
      setTimeout(() => el.classList.remove('on'), 140);
    },
    setStars(level) {
      const row = $('#star-row');
      let html = '';
      for (let i = 1; i <= 5; i += 1) html += `<span class="${i <= level ? 'on' : ''}">${i <= level ? '★' : '☆'}</span>`;
      row.innerHTML = html;
    },
    setHeadline() {
      $('#headline').textContent = HEADLINES[headlineIdx % HEADLINES.length];
      headlineIdx += 1;
    },
    setTicker(prices, source, hot) {
      const bits = COINS.map((coin) => {
        const price = prices[coin.id];
        const cls = coin.id === 'ORNG' && hot ? 'hot' : '';
        return `<span class="${cls}">${coin.tick} $${fmtNum(price, coin.priceDec)}</span>`;
      }).join('   ·   ');
      const text = `${bits}    ·    行情 ${source}${hot ? '    ·    大橙子币拉盘中' : ''}`;
      $('#ticker-track').innerHTML = `${text}　　${text}`;
    },
    setWallet(model) {
      const net = fmtUsd(model.net);
      $('#wallet-chip').textContent = `净值 ${net}`;
      const lines = [`<div>现金 <strong>${fmtUsd(model.usd)}</strong></div>`];
      for (const coin of COINS) {
        lines.push(`<div><span style="color:${coin.color}">${coin.tick}</span> ${fmtNum(model.bal[coin.id], coin.dec)}</div>`);
      }
      lines.push(`<div>净值 <strong>${net}</strong></div>`);
      lines.push('<button class="link" type="button" id="btn-open-ex">打开交易所</button>');
      $('#wallet-body').innerHTML = lines.join('');
      $('#btn-open-ex').onclick = (event) => {
        event.stopPropagation();
        $('#wallet').classList.remove('open');
        $('#wallet-chip').setAttribute('aria-expanded', 'false');
        api.onOpenExchange?.();
      };
    },
    syncLayout,
    setSoundLabel(on) {
      $('#btn-sound').textContent = `音效：${on ? '开' : '关'}`;
    },
    openExchange(model) {
      const body = $('#modal-body');
      body.innerHTML = '';
      const h2 = document.createElement('h2');
      h2.textContent = '橙子交易所';
      const sub = document.createElement('p');
      sub.className = 'fine source';
      sub.textContent = `参考价来自 ${model.source}。大橙子币 ORNG 是游戏内模因币。买卖只改本地存档。`;
      body.append(h2, sub);
      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.step = 'any';
      amount.value = '1';
      amount.setAttribute('aria-label', '数量');
      const label = document.createElement('div');
      label.className = 'row';
      const span = document.createElement('span');
      span.textContent = '数量（枚）';
      label.append(span, amount);
      body.append(label);
      for (const coin of COINS) {
        const row = document.createElement('div');
        row.className = 'row';
        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'coin-name';
        name.textContent = `${coin.name} ${coin.tick}`;
        const meta = document.createElement('div');
        meta.className = 'fine';
        meta.textContent = `持有 ${fmtNum(model.bal[coin.id], coin.dec)} · $${fmtNum(model.prices[coin.id], coin.priceDec)}`;
        left.append(name, meta);
        const actions = document.createElement('div');
        const buy = document.createElement('button');
        buy.className = 'tiny';
        buy.type = 'button';
        buy.textContent = '买入';
        const sell = document.createElement('button');
        sell.className = 'tiny';
        sell.type = 'button';
        sell.textContent = '全部卖出';
        buy.onclick = () => api.onTrade?.(coin.id, 'buy', Number(amount.value));
        sell.onclick = () => api.onTrade?.(coin.id, 'sell', model.bal[coin.id]);
        actions.append(buy, document.createTextNode(' '), sell);
        row.append(left, actions);
        body.append(row);
      }
      const close = document.createElement('button');
      close.className = 'ghost';
      close.type = 'button';
      close.textContent = '离开';
      close.style.marginTop = '12px';
      close.onclick = () => api.onCloseModal?.();
      body.append(close);
      $('#modal').classList.add('on');
    },
    openMissions(model) {
      const body = $('#modal-body');
      body.innerHTML = '';
      const h2 = document.createElement('h2');
      h2.textContent = '任务终端';
      const sub = document.createElement('p');
      sub.className = 'fine';
      sub.textContent = model.active
        ? `进行中：${model.activeName}`
        : '一次一单。完成后可以再接。';
      body.append(h2, sub);
      for (const mission of MISSIONS) {
        const row = document.createElement('div');
        row.className = 'row';
        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'coin-name';
        const done = model.done.includes(mission.id);
        name.textContent = `${mission.name}${done ? ' · 已完成' : ''}`;
        const desc = document.createElement('div');
        desc.className = 'fine';
        desc.textContent = `${mission.desc} 报酬 ${mission.reward}`;
        left.append(name, desc);
        const btn = document.createElement('button');
        btn.className = 'tiny';
        btn.type = 'button';
        btn.textContent = model.active === mission.id ? '放弃' : '接受';
        btn.disabled = model.active && model.active !== mission.id;
        btn.onclick = () => {
          if (model.active === mission.id) api.onAbandon?.();
          else api.onAcceptMission?.(mission.id);
        };
        row.append(left, btn);
        body.append(row);
      }
      const close = document.createElement('button');
      close.className = 'ghost';
      close.type = 'button';
      close.textContent = '关闭';
      close.style.marginTop = '12px';
      close.onclick = () => api.onCloseModal?.();
      body.append(close);
      $('#modal').classList.add('on');
    },
    openShop(model) {
      const body = $('#modal-body');
      body.innerHTML = '';
      const h2 = document.createElement('h2');
      h2.textContent = model.title;
      const sub = document.createElement('p');
      sub.className = 'fine';
      sub.textContent = `现金 ${fmtUsd(model.usd)}。可用现金或任一币种按现价结算。`;
      body.append(h2, sub);
      for (const item of model.items) {
        const wrap = document.createElement('div');
        wrap.style.padding = '8px 0';
        wrap.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
        const name = document.createElement('div');
        name.className = 'coin-name';
        name.textContent = item.owned ? `${item.name} · 已拥有` : `${item.name} · ${fmtUsd(item.price)}`;
        const desc = document.createElement('div');
        desc.className = 'fine';
        desc.textContent = item.blurb;
        wrap.append(name, desc);
        if (!item.owned && item.price > 0) {
          const pay = document.createElement('div');
          pay.className = 'pay-row';
          const cash = document.createElement('button');
          cash.className = 'tiny';
          cash.type = 'button';
          cash.textContent = '现金';
          cash.disabled = model.usd < item.price;
          cash.onclick = () => api.onBuy?.(item.id, 'USD');
          pay.append(cash);
          for (const coin of COINS) {
            const cost = item.price / model.prices[coin.id];
            const b = document.createElement('button');
            b.className = 'tiny';
            b.type = 'button';
            b.textContent = `${coin.tick} ${fmtNum(cost, coin.dec)}`;
            b.disabled = model.bal[coin.id] + 1e-9 < cost;
            b.onclick = () => api.onBuy?.(item.id, coin.id);
            pay.append(b);
          }
          wrap.append(pay);
        }
        body.append(wrap);
      }
      const close = document.createElement('button');
      close.className = 'ghost';
      close.type = 'button';
      close.textContent = '离开';
      close.style.marginTop = '12px';
      close.onclick = () => api.onCloseModal?.();
      body.append(close);
      $('#modal').classList.add('on');
    },
    bindTouch(pad) {
      const touch = $('#touch');
      const show = () => {
        const phone = document.documentElement.classList.contains('phone');
        touch.classList.toggle('on', phone && $('#hud').classList.contains('on'));
      };
      api.setPlayVisible = (on) => {
        $('#hud').classList.toggle('on', on);
        $('#title').classList.toggle('on', !on);
        syncLayout();
        show();
      };
      const joy = $('#joy');
      const knob = $('#knob');
      let active = null;
      const place = (clientX, clientY) => {
        const rect = joy.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const max = rect.width / 2 - 8;
        const mag = Math.hypot(dx, dy) || 1;
        if (mag > max) {
          dx = (dx / mag) * max;
          dy = (dy / mag) * max;
        }
        knob.style.left = '50%';
        knob.style.top = '50%';
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        pad.x = dx / max;
        pad.y = -dy / max;
      };
      let lastJoy = 0;
      joy.addEventListener('pointerdown', (e) => {
        const now = performance.now();
        if (now - lastJoy < 280) pad.jump = true;
        lastJoy = now;
        active = e.pointerId;
        joy.setPointerCapture(e.pointerId);
        place(e.clientX, e.clientY);
      });
      joy.addEventListener('pointermove', (e) => {
        if (e.pointerId !== active) return;
        place(e.clientX, e.clientY);
      });
      const release = (e) => {
        if (active !== null && e.pointerId !== active) return;
        active = null;
        pad.x = 0;
        pad.y = 0;
        knob.style.left = '50%';
        knob.style.top = '50%';
        knob.style.transform = 'translate(-50%, -50%)';
      };
      joy.addEventListener('pointerup', release);
      joy.addEventListener('pointercancel', release);

      const look = $('#lookpad');
      let lookId = null;
      let lx = 0;
      let ly = 0;
      look.addEventListener('pointerdown', (e) => {
        lookId = e.pointerId;
        lx = e.clientX;
        ly = e.clientY;
        look.setPointerCapture(e.pointerId);
      });
      look.addEventListener('pointermove', (e) => {
        if (e.pointerId !== lookId) return;
        pad.lookX += (e.clientX - lx) * 1.4;
        pad.lookY += (e.clientY - ly) * 1.4;
        lx = e.clientX;
        ly = e.clientY;
      });
      look.addEventListener('pointerup', () => {
        lookId = null;
      });

      const hold = (id, key) => {
        const btn = $(id);
        const on = (v) => {
          pad[key] = v;
        };
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (key === 'run' || key === 'fire') on(true);
          else pad[key] = true;
        });
        btn.addEventListener('pointerup', () => {
          if (key === 'run' || key === 'fire') on(false);
        });
        btn.addEventListener('pointerleave', () => {
          if (key === 'run' || key === 'fire') on(false);
        });
      };
      hold('#t-fire', 'fire');
      hold('#t-run', 'run');
      hold('#t-car', 'car');
      hold('#t-use', 'interact');
      hold('#t-mission', 'mission');
      hold('#t-pause', 'pause');
      show();
      window.addEventListener('resize', () => {
        syncLayout();
        show();
      });
    },
    setIdentity(text) {
      const el = $('#who');
      el.textContent = text || '';
      el.style.display = text ? 'block' : 'none';
    },
    setAccountLine(text, loggedIn) {
      $('#account-line').textContent = text;
      $('#btn-logout').style.display = loggedIn ? 'inline-block' : 'none';
      $('#btn-guest').style.display = loggedIn ? 'none' : '';
      $('#btn-auth').style.display = loggedIn ? 'none' : '';
    },
    showAuth(mode, message = '') {
      paintAuth(mode, message);
    },
    hideAuth() {
      $('#auth').classList.remove('on');
    },
    showBoard(model) {
      $('#board').classList.add('on');
      $('#board-msg').textContent = model.error || '';
      $('#board').querySelectorAll('[data-tab]').forEach((btn) => {
        btn.classList.toggle('on', btn.dataset.tab === model.tab);
      });
      const list = $('#board-list');
      list.replaceChildren();
      if (!model.rows?.length) {
        const empty = document.createElement('p');
        empty.className = 'fine';
        empty.textContent = '还没有人上榜。登录后出去跑一圈就会出现。';
        list.appendChild(empty);
      } else {
        model.rows.forEach((row, index) => {
          const el = document.createElement('div');
          el.className = `board-row${row.nickname === model.me ? ' me' : ''}`;
          const rank = document.createElement('span');
          rank.textContent = String(index + 1);
          const dot = document.createElement('i');
          dot.style.background = row.avatar_color || '#ff8a00';
          const name = document.createElement('b');
          name.textContent = row.nickname;
          const value = document.createElement('em');
          if (model.tab === 'reputation') value.textContent = `${row.reputation} 声望`;
          else if (model.tab === 'level') value.textContent = `${row.level} 级`;
          else value.textContent = fmtUsd(Number(row.net_worth) || 0);
          el.append(rank, dot, name, value);
          list.appendChild(el);
        });
      }
      if (model.rank) {
        const foot = document.createElement('p');
        foot.className = 'fine';
        foot.textContent = `我的名次：第 ${model.rank}`;
        list.appendChild(foot);
      }
    },
    hideBoard() {
      $('#board').classList.remove('on');
    },
    showJournal(model) {
      journalModel = model;
      $('#journal').classList.add('on');
      const tab = journalTab;
      $('#journal').querySelectorAll('[data-journal]').forEach((btn) => {
        btn.classList.toggle('on', btn.dataset.journal === tab);
      });
      $('#journal-msg').textContent = tab === 'daily'
        ? `${model.day} · 新加坡时间 0 点刷新 · 已完成 ${model.done}/${model.total}`
        : tab === 'turf'
          ? (model.turfLine || '')
          : `已解锁 ${model.unlocked}/${model.achievements.length}`;
      const list = $('#journal-list');
      list.replaceChildren();
      if (tab === 'turf') {
        const canvas = document.createElement('canvas');
        canvas.id = 'turf-map';
        canvas.width = 560;
        canvas.height = 280;
        list.appendChild(canvas);
        paintTurfMap(canvas, model.turfs || [], model.player);
      }
      const rows = tab === 'daily' ? model.items : tab === 'turf' ? model.turfs : model.achievements;
      for (const row of rows) {
        const el = document.createElement('div');
        el.className = `journal-row${row.done ? ' done' : ''}`;
        const name = document.createElement('b');
        if (row.color) {
          const swatch = document.createElement('i');
          swatch.className = 'turf-swatch';
          swatch.style.background = row.color;
          name.append(swatch, document.createTextNode(row.done ? `${row.name} · 已占领` : row.name));
        } else name.textContent = row.done ? `${row.name} · 已完成` : row.name;
        const desc = document.createElement('span');
        desc.textContent = row.desc || `${row.have}/${row.need}`;
        const meta = document.createElement('em');
        if (row.meta) meta.textContent = row.meta;
        else meta.textContent = row.desc ? `${Math.min(row.have, row.need)}/${row.need} · +${fmtUsd(row.reward)}` : `+${fmtUsd(row.reward)}`;
        el.append(name, desc, meta);
        list.appendChild(el);
      }
    },
    hideJournal() {
      $('#journal').classList.remove('on');
    },
    showCutscene(line, color) {
      $('#cutscene').classList.add('on');
      $('#cut-who').textContent = line.who;
      $('#cut-text').textContent = line.text;
      $('#cut-portrait').style.background = color || '#ff6a14';
      $('#cut-portrait').textContent = [...(line.who || '橙')][0];
    },
    hideCutscene() {
      $('#cutscene').classList.remove('on');
    },
    onNew: null,
    onContinue: null,
    onGuest: null,
    onLogout: null,
    onAuth: null,
    onBoard: null,
    onCut: null,
    onResume: null,
    onQuit: null,
    onSave: null,
    onToggleSound: null,
    onOpenExchange: null,
    onTrade: null,
    onAcceptMission: null,
    onAbandon: null,
    onBuy: null,
    onCloseModal: null,
    onBoardClose: null,
    onJournal: null,
  };

  let journalTab = 'daily';
  let journalModel = null;

  let authMode = 'login';
  function paintAuth(mode, message) {
    authMode = mode;
    $('#auth').classList.add('on');
    $('#auth-msg').textContent = message || '';
    const nickOnly = mode === 'nick';
    $('#auth-title').textContent = mode === 'register' ? '注册' : nickOnly ? '取一个昵称' : '登录';
    $('#auth-email-label').hidden = nickOnly;
    $('#auth-pass-label').hidden = nickOnly;
    $('#auth-nick-label').hidden = mode === 'login';
    $('#auth-email').required = !nickOnly;
    $('#auth-pass').required = !nickOnly;
    $('#auth-nick').required = mode !== 'login';
    $('#auth-submit').textContent = mode === 'register' ? '注册' : nickOnly ? '进入城市' : '登录';
    $('#auth-switch').hidden = nickOnly;
    $('#auth-switch').textContent = mode === 'register' ? '已有账号？去登录' : '没有账号？去注册';
  }

  $('#auth-form').onsubmit = (event) => {
    event.preventDefault();
    api.onAuth?.({
      mode: authMode,
      email: $('#auth-email').value,
      password: $('#auth-pass').value,
      nickname: $('#auth-nick').value,
    });
  };
  $('#auth-switch').onclick = () => paintAuth(authMode === 'register' ? 'login' : 'register', '');
  $('#auth-close').onclick = () => api.hideAuth();
  $('#btn-auth').onclick = () => paintAuth('login', '');
  $('#btn-guest').onclick = () => api.onGuest?.();
  $('#btn-logout').onclick = () => api.onLogout?.();
  $('#btn-board').onclick = () => api.onBoard?.('net_worth');
  $('#btn-board-pause').onclick = () => api.onBoard?.('net_worth');
  $('#board').querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = () => api.onBoard?.(btn.dataset.tab);
  });
  $('#board-close').onclick = () => api.onBoardClose?.();
  $('#btn-journal').onclick = () => api.onJournal?.();
  $('#btn-journal-pause').onclick = () => api.onJournal?.();
  $('#journal-close').onclick = () => api.onJournal?.();
  $('#journal').querySelectorAll('[data-journal]').forEach((btn) => {
    btn.onclick = () => {
      journalTab = btn.dataset.journal;
      if (journalModel) api.showJournal(journalModel);
    };
  });
  $('#cut-next').onclick = () => api.onCut?.();

  $('#btn-new').onclick = () => api.onNew?.();
  $('#btn-continue').onclick = () => api.onContinue?.();
  $('#btn-help-title').onclick = () => api.showHelp();
  $('#btn-help').onclick = () => api.showHelp();
  $('#btn-help-close').onclick = () => api.hideHelp();
  $('#btn-resume').onclick = () => api.onResume?.();
  $('#btn-save').onclick = () => api.onSave?.();
  $('#btn-quit').onclick = () => api.onQuit?.();
  $('#btn-sound').onclick = () => api.onToggleSound?.();
  $('#wallet-chip').onclick = (event) => {
    event.stopPropagation();
    const open = $('#wallet').classList.toggle('open');
    $('#wallet-chip').setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  $('#rotate-dismiss').onclick = () => {
    try { sessionStorage.setItem('vice-rotate-dismiss', '1'); } catch { /* private mode */ }
    $('#rotate-hint').classList.remove('show');
  };
  api.setHeadline();
  syncLayout();
  return api;
}
