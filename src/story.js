import * as THREE from 'three';

export const CAST = [
  {
    id: 'claw',
    name: '橙爪',
    title: '散户死党',
    pack: 'male',
    cloth: '#ff6a14',
    pants: '#1c2433',
    hair: '#1b120d',
    home: { x: 18, z: 78 },
    hat: 'cap',
    blurb: '橙爪踢了踢路边的硬币：今天的盘还没开，你别先梭哈。',
  },
  {
    id: 'wang',
    name: '汪言',
    title: '模因币创始人',
    pack: 'casual2',
    cloth: '#ffe14a',
    pants: '#ff4fad',
    hair: '#4a2a1c',
    home: { x: 168, z: 214 },
    hat: 'party',
    blurb: '汪言举着扩音器：社区就是信仰，K 线只是配乐。',
  },
  {
    id: 'whale',
    name: '老鲸',
    title: '巨鲸交易员',
    pack: 'classy',
    cloth: '#f4f1ea',
    pants: '#1a1c22',
    hair: '#d0d0d0',
    home: { x: 28, z: -70 },
    hat: 'chain',
    blurb: '老鲸看都不看你：小单就别挡我的车道。',
  },
  {
    id: 'kai',
    name: '柜姐凯',
    title: '交易所老板',
    pack: 'suitf',
    cloth: '#f7f4ef',
    pants: '#d4af37',
    hair: '#111111',
    home: { x: -8, z: 70 },
    hat: 'visor',
    blurb: '柜姐凯敲了敲柜台：提现通道在维护，充值通道一直开着。',
  },
  {
    id: 'ge',
    name: '格探员',
    title: '监管对手',
    pack: 'suit',
    cloth: '#2c3848',
    pants: '#161b24',
    hair: '#0e0e0e',
    home: { x: 12, z: -140 },
    hat: 'badge',
    blurb: '格探员合上文件夹：我们只是来度假，顺便看看你的链。',
  },
  {
    id: 'zero',
    name: '零日',
    title: '黑客',
    pack: 'worker',
    cloth: '#39ff7a',
    pants: '#102018',
    hair: '#04140c',
    home: { x: -360, z: 250 },
    hat: 'hood',
    blurb: '零日盯着屏幕：门是开的。飞起来，别在地面上签名。',
  },
];

export const CHAPTERS = [
  {
    id: 'story-meet',
    giver: 'claw',
    title: '第一章 · 橙爪的局',
    kind: 'reach',
    spot: { x: 0, z: 58, r: 7 },
    objective: '故事 1/8 · 跟着黄线去交易所',
    reward: { usd: 500, rep: 20 },
    intro: [
      { who: '橙爪', text: '大橙子，别在斑马线上发呆。这城里每个人都在喊单。' },
      { who: '你', text: '那我该先干什么？' },
      { who: '橙爪', text: '先去交易所看一眼盘。看一眼就会想上车。走到门口就算到了。' },
    ],
    outro: [
      { who: '橙爪', text: '行。下一句不是我说了算，是海滩上那个戴派对帽的。' },
    ],
  },
  {
    id: 'story-hype',
    giver: 'wang',
    title: '第二章 · 汪言造势',
    kind: 'pump',
    spot: { x: 230, z: 214, r: 7 },
    objective: '故事 2/8 · 到海滩拉盘点，按 E',
    reward: { orng: 1500, rep: 22 },
    intro: [
      { who: '汪言', text: '听见没有？社区需要一个符号。大橙子币今天必须被看见。' },
      { who: '你', text: '你要我去喊？' },
      { who: '汪言', text: '去海滩那个拉盘点点一下火。别问燃料从哪来。' },
    ],
    outro: [
      { who: '汪言', text: '漂亮。等会崩不崩是后话，截图先发出去。' },
    ],
  },
  {
    id: 'story-whale',
    giver: 'whale',
    title: '第三章 · 老鲸的车道',
    kind: 'two',
    spot: { x: -380, z: 239, r: 16 },
    back: { x: 28, z: -70, r: 8 },
    mid: '码头到了。把车开回老鲸的阁楼。',
    objective: '故事 3/8 · 开车去码头',
    backText: '故事 3/8 · 开回老鲸的阁楼',
    reward: { usd: 2500, rep: 28 },
    intro: [
      { who: '老鲸', text: '我的冷钱包在码头。你去确认它还在，再开回来。' },
      { who: '你', text: '你自己不去？' },
      { who: '老鲸', text: '巨鲸不下海。海是给快艇看的。' },
    ],
    outro: [
      { who: '老鲸', text: '还在。很好。小钱你拿着，别问我仓位。' },
    ],
  },
  {
    id: 'story-cex',
    giver: 'kai',
    title: '第四章 · 柜姐的流动性',
    kind: 'bags',
    spot: { x: -8, z: 70, r: 7 },
    bags: [
      { x: 58, z: 40 },
      { x: 58, z: 78 },
      { x: 96, z: 58 },
    ],
    wanted: 2,
    objective: '故事 4/8 · 捡回三袋流动性',
    backText: '故事 4/8 · 把袋子送回柜姐凯',
    reward: { btc: 0.008, rep: 32 },
    intro: [
      { who: '柜姐凯', text: '储备证明在做审计。审计期间，那三袋流动性先放在街上了。' },
      { who: '你', text: '放在街上？' },
      { who: '柜姐凯', text: '所以才叫你去捡。捡完送回来。监管会装没看见，直到他们看见。' },
    ],
    outro: [
      { who: '柜姐凯', text: '账平了。对外就说是正常充值。对内，你没来过。' },
    ],
  },
  {
    id: 'story-sec',
    giver: 'ge',
    title: '第五章 · 格探员的假日',
    kind: 'escape',
    spot: { x: 0, z: -58, r: 7 },
    wanted: 3,
    objective: '故事 5/8 · 甩掉星星，再进安全屋',
    reward: { usd: 2000, rep: 34 },
    intro: [
      { who: '格探员', text: '橙氏基金、海滩喊单、街上的袋子。度假笔记已经够厚了。' },
      { who: '你', text: '你想怎样？' },
      { who: '格探员', text: '我想看你还能跑多远。三星。甩掉我们，回你的安全屋。' },
    ],
    outro: [
      { who: '格探员', text: '跑得掉一次。链还在，我的假日也还没结束。' },
    ],
  },
  {
    id: 'story-hack',
    giver: 'zero',
    title: '第六章 · 零日开门',
    kind: 'fly',
    spot: { x: -380, z: 239, r: 18 },
    objective: '故事 6/8 · 上码头的飞机或直升机，拉到高处',
    reward: { sol: 2, rep: 26 },
    intro: [
      { who: '零日', text: '交易所的门我开过一条缝。缝在天上，不在登录页。' },
      { who: '你', text: '我得飞？' },
      { who: '零日', text: '码头有直升机，机场有轻航。拉高过十二米，他们的雷达会当这是云。' },
    ],
    outro: [
      { who: '零日', text: '缝合上了。别把高度当利润，利润会掉下来。' },
    ],
  },
  {
    id: 'story-race',
    giver: 'claw',
    title: '第七章 · 橙爪的夜赛',
    kind: 'gates',
    gates: [
      { x: 86, z: -24, r: 8 },
      { x: 174, z: -90, r: 8 },
      { x: 174, z: -174, r: 8 },
    ],
    objective: '故事 7/8 · 穿过橙爪的光环',
    reward: { usd: 1500, rep: 24 },
    intro: [
      { who: '橙爪', text: '正经事做完了？那来点不正经的。三个环，谁先怂谁请饮料。' },
      { who: '你', text: '你开哪辆？' },
      { who: '橙爪', text: '我开嘴。你开车上路。环在南边。' },
    ],
    outro: [
      { who: '橙爪', text: '行。饮料算我的。最后一单不在赛道上，在港口。' },
    ],
  },
  {
    id: 'story-end',
    giver: 'zero',
    title: '终章 · 链还亮着',
    kind: 'finale',
    spot: { x: -400, z: 280, r: 18 },
    objective: '故事 8/8 · 去港口，再把直升机拉高离开',
    reward: { usd: 5000, btc: 0.01, rep: 50 },
    intro: [
      { who: '零日', text: '格探员的假日、柜姐的账、老鲸的冷钱包，今晚会在港口对上。' },
      { who: '橙爪', text: '你到了就别下车讲道理。上去，拉高，让霓虹留在下面。' },
      { who: '你', text: '完了呢？' },
      { who: '汪言', text: '完了就发帖。标题我都想好了：链还亮着。' },
    ],
    outro: [
      { who: '橙爪', text: '看，灯还在。没有人归零，只是这一章翻过去了。' },
      { who: '格探员', text: '笔记我会留着。下一趟假日，换一条链。' },
      { who: '你', text: '那我呢？' },
      { who: '柜姐凯', text: '你还有车，有盘，有一个昵称。城里继续营业。' },
    ],
  },
];

export function castById(id) {
  return CAST.find((item) => item.id === id) || CAST[0];
}

function paint(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08 });
}

export function tintActor(actor, look) {
  actor.model.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const mapped = list.map((mat) => {
      const next = mat.clone();
      const name = next.name || '';
      const mesh = obj.name || '';
      if (/skin|face/i.test(name) || name === 'Eye' || /^eye$/i.test(name)) {
        if (look.skin && /skin|face/i.test(name)) next.color.set(look.skin);
        return next;
      }
      if (/hair|eyebrow|moustache/i.test(name)) {
        if (look.hair) next.color.set(look.hair);
        return next;
      }
      if (/pant/i.test(name) || /leg/i.test(mesh)) {
        if (look.pants) next.color.set(look.pants);
        return next;
      }
      if (/shirt|vest|jacket|black/i.test(name)) {
        if (look.cloth) next.color.set(look.cloth);
        if (/black/i.test(name)) next.color.multiplyScalar(0.55);
        return next;
      }
      return next;
    });
    obj.material = Array.isArray(obj.material) ? mapped : mapped[0];
  });
}

export function addAccessory(actor, hat) {
  const group = new THREE.Group();
  if (hat === 'cap') {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), paint('#ff6a14'));
    crown.position.set(0, 1.74, 0.02);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.12), paint('#ff6a14'));
    brim.position.set(0, 1.7, 0.12);
    group.add(crown, brim);
  } else if (hat === 'party') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), paint('#ff4fad'));
    cone.position.set(0, 1.86, 0.02);
    group.add(cone);
  } else if (hat === 'chain') {
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.012, 6, 14),
      new THREE.MeshStandardMaterial({ color: '#ffd56a', metalness: 0.85, roughness: 0.22 }),
    );
    chain.rotation.x = Math.PI / 2;
    chain.position.set(0, 1.4, 0.11);
    group.add(chain);
  } else if (hat === 'visor') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), paint('#111111'));
    bar.position.set(0, 1.58, 0.13);
    group.add(bar);
  } else if (hat === 'badge') {
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), paint('#ff4d4d'));
    badge.position.set(0.12, 1.28, 0.14);
    group.add(badge);
  } else if (hat === 'hood') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), paint('#0c2418'));
    hood.scale.set(1, 0.75, 1);
    hood.position.set(0, 1.7, -0.04);
    group.add(hood);
  }
  actor.model.add(group);
  return group;
}

export function makeNameTag(text, color = '#ffd7a8') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(16, 10, 24, 0.78)';
  roundRect(ctx, 16, 28, 480, 72, 24);
  ctx.fill();
  ctx.font = '700 48px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || '').slice(0, 16), 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.45, 0.36, 1);
  sprite.position.y = 2.62;
  sprite.renderOrder = 12;
  sprite.userData.tagText = text;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
