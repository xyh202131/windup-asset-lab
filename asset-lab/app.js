// 《点灯人》人物资产实验室 —— 逐帧审核、几何质检、图集导出与 Cocos 引擎联调。
// 纯前端单文件应用，无构建步骤，直接由静态服务器托管。

// ────────────────────────────────────────────────────────────
// 数据：资产库与动作定义
// ────────────────────────────────────────────────────────────

const root = '../assets/resources/character';
const FIXED_FPS = 8;

// 按 `<base>/<prefix>-01.png` 约定生成一组帧路径。
const makeFrames = (base, prefix, count = 8) =>
  Array.from({ length: count }, (_, index) => `${base}/${prefix}-${String(index + 1).padStart(2, '0')}.png`);

// 三种视角 × 若干动作。每个资产记录帧序、FPS、是否循环、生成批次号，
// 以及首次进入审核台时的默认状态（initial / rejected）。
const lamplighterLibrary = {
  side: {
    label: '横屏侧视资产', truth: '真实侧视序列帧',
    idle: { label: '呼吸待机', key: 'idle', frames: makeFrames(`${root}/views/side`, 'idle'), fps: 8, loop: true, batch: 'B-20260713-11', initial: 'pending' },
    walk: { label: '行走', key: 'walk', frames: makeFrames(`${root}/frames`, 'walk'), fps: 8, loop: true, batch: 'B-20260713-05', initial: 'pass' },
    run: { label: '奔跑', key: 'run', frames: makeFrames(`${root}/views/side`, 'run'), fps: 8, loop: true, batch: 'B-20260713-09', initial: 'pending' },
    jump: { label: '跳跃', key: 'jump', frames: makeFrames(`${root}/views/side`, 'jump'), fps: 8, loop: false, batch: 'B-20260713-12', initial: 'pending' },
    lantern: { label: '举灯点亮', key: 'lantern', frames: makeFrames(`${root}/views/side`, 'lantern'), fps: 8, loop: false, batch: 'B-20260713-10', initial: 'pending', rejected: [4] },
  },
  topdown: {
    label: '真实俯视资产', truth: '母版约束的独立俯视绘制',
    walk: { label: '行走', key: 'walk', frames: makeFrames(`${root}/views/topdown`, 'walk'), fps: 8, loop: true, batch: 'B-20260713-07', initial: 'pending' },
    run: { label: '奔跑', key: 'run', frames: makeFrames(`${root}/views/topdown`, 'run'), fps: 8, loop: true, batch: 'B-20260713-13', initial: 'pending' },
  },
  isometric: {
    label: '真实 2.5D 资产', truth: '母版约束的独立 3/4 绘制',
    walk: { label: '行走', key: 'walk', frames: makeFrames(`${root}/views/isometric`, 'walk'), fps: 8, loop: true, batch: 'B-20260713-08', initial: 'pending' },
    run: { label: '奔跑', key: 'run', frames: makeFrames(`${root}/views/isometric`, 'run'), fps: 8, loop: true, batch: 'B-20260713-14', initial: 'pending' },
  },
};

const teammateRoot = '../assets/resources/characters';
const emptyView = (label, truth) => ({ label, truth });
const teammateLibrary = (character, count = 8) => ({
  side: {
    label: '横屏侧视资产', truth: '队友 Windup 管线生成 · 保留溯源',
    walk: { label: '行走', key: 'walk', frames: makeFrames(`${teammateRoot}/${character}/views/side`, 'walk', count), fps: 8, loop: true, batch: `TEAM-${character.toUpperCase()}-WALK`, initial: 'pending' },
  },
  topdown: emptyView('真实俯视资产', '尚未生成：不使用伪透视替代'),
  isometric: emptyView('真实 2.5D 资产', '尚未生成：不使用伪透视替代'),
});

const characterCatalog = {
  lamplighter: { label: '点灯少年', base: `${root}/frames/walk-01.png`, library: lamplighterLibrary },
  boy: { label: 'Boy · 队友资产', base: `${teammateRoot}/boy/base.png`, library: teammateLibrary('boy') },
  skeleton: { label: 'Skeleton · 队友资产', base: `${teammateRoot}/skeleton/base.png`, library: teammateLibrary('skeleton') },
  lirael: { label: 'Lirael · 队友资产', base: `${teammateRoot}/lirael/base.png`, library: teammateLibrary('lirael', 4) },
};

let activeCharacterId = 'lamplighter';
let library = characterCatalog[activeCharacterId].library;

const actionOrder = ['idle', 'walk', 'run', 'jump', 'lantern'];
const actionLabels = {
  idle: ['呼吸待机', '标准动作'],
  walk: ['行走', '标准动作'],
  run: ['奔跑', '标准动作'],
  jump: ['跳跃', '标准动作'],
  lantern: ['举灯点亮', '自定义动作'],
};

// 审核状态文案。详情区用完整词，时间轴缩略图空间小用短词。
const REVIEW_LABELS = { pass: '通过', pending: '待审核', reject: '退回' };
const REVIEW_LABELS_SHORT = { pass: '通过', pending: '待审', reject: '退回' };

// Windup 资产实验室与 Cocos 引擎联调的 postMessage 协议前缀。
const PREVIEW_NS = 'windup';
const GAME_ORIGIN = 'http://127.0.0.1:4173';

// ────────────────────────────────────────────────────────────
// 运行时状态
// ────────────────────────────────────────────────────────────

const state = {
  view: 'side',
  action: 'idle',
  frame: 0,
  playing: false,
  timer: null,
  reviews: JSON.parse(localStorage.getItem('windup-review-state') || '{}'),
};

const generationState = { job: null, poll: null };
const bootState = { complete: false, choiceMade: false };

const movement = { x: 0, direction: 1, left: false, right: false, auto: false, wasMoving: false, lastTime: performance.now() };

// 逐帧像素微调（按 动作_视角_帧 存偏移）与全局脚底锚点，供图集导出写入 metadata。
const frameOffsets = {};
const baseAnchor = { x: 128, y: 238 };
// 舞台上拖拽人物 = 调整锚点；记录拖拽过程以便与「点击切换动作」区分。
const drag = { active: false, moved: false, startX: 0, startY: 0, anchorX: 0, anchorY: 0 };

// ────────────────────────────────────────────────────────────
// DOM 引用（单一入口）
// ────────────────────────────────────────────────────────────

const collect = (ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const els = collect([
  // 布局与抽屉
  'assetDrawer', 'sidebarToggle', 'sidebarReveal', 'drawerHotspot',
  // 侧栏动作列表与批次
  'actionList', 'batchId', 'batchRoute', 'actionName', 'characterSelect', 'characterName', 'openGenerateBtn',
  // 顶部操作
  'exportBtn', 'gamePreviewBtn', 'enterGameBtn',
  // Cocos 联调面板
  'gameDock', 'gameFrame', 'gameStatus', 'closeGameBtn', 'sendGameBtn',
  // 视角与舞台
  'viewTabs', 'gridToggle', 'checkerToggle', 'stage', 'viewLabel', 'viewTruth', 'characterFrame', 'missingState',
  'modeCards', 'generationModeCard', 'editorModeCard',
  // 播放控制
  'firstBtn', 'prevBtn', 'playBtn', 'nextBtn', 'lastBtn', 'moveLeftBtn', 'moveRightBtn', 'autoWalkBtn',
  'frameCounter', 'timeCounter', 'fpsSlider', 'fpsValue', 'loopToggle',
  // 时间轴与规格
  'timeline', 'specName', 'instanceStatus', 'specFrames', 'specPlayback',
  // 质检
  'qcSummary', 'qcChecks',
  // 逐帧审核
  'selectedFrame', 'frameBatch', 'frameState', 'reviewNote', 'rejectBtn', 'approveBtn', 'regenerateFrameBtn',
  // 导出门禁
  'gateMessage', 'approvalProgress', 'approvalText',
  // 洋葱皮 / 图集打包 / 锚点
  'onionToggle', 'onionPrev', 'onionNext',
  'packerModal', 'closePackerBtn', 'spriteCanvas', 'spriteJson', 'spriteMeta', 'downloadPackBtn', 'anchorCoords',
  // 生成中心
  'generationModal', 'closeGenerateBtn', 'providerDot', 'providerStatus', 'genPortrait', 'genCharacterName',
  'genView', 'genAction', 'genMode', 'genFrameField', 'genFrame', 'startGenerationBtn', 'genBatch',
  'genPercent', 'genProgress', 'genMessage', 'candidateGrid', 'promoteJobBtn',
]);

// ────────────────────────────────────────────────────────────
// 资产与审核状态辅助
// ────────────────────────────────────────────────────────────

function currentAsset() {
  return library[state.view]?.[state.action] || null;
}

function reviewKey() {
  return `${activeCharacterId}:${state.view}:${state.action}`;
}

function frameSrc(asset, index) {
  const source = asset.frames[index];
  return asset.revision ? `${source}?v=${asset.revision}` : source;
}

// 惰性初始化某资产的逐帧审核数组：预置退回帧，其余用资产的默认状态。
function ensureReviews(asset) {
  if (!state.reviews[reviewKey()]) {
    state.reviews[reviewKey()] = asset.frames.map((_, index) =>
      asset.rejected?.includes(index) ? 'reject' : asset.initial);
  }
  return state.reviews[reviewKey()];
}

// ────────────────────────────────────────────────────────────
// 渲染
// ────────────────────────────────────────────────────────────

function renderActions() {
  els.actionList.innerHTML = actionOrder.map((key) => {
    const asset = library[state.view][key];
    const [label, type] = actionLabels[key];
    return `<button class="action-item ${state.action === key ? 'active' : ''}" data-action="${key}"><span><b>${label}</b><small>${type}</small></span><em class="${asset ? 'ready' : 'gap'}">${asset ? `${asset.frames.length} 帧` : '缺口'}</em></button>`;
  }).join('');
  els.actionList.querySelectorAll('button').forEach((button) =>
    button.addEventListener('click', () => {
      state.action = button.dataset.action;
      state.frame = 0;
      render();
    }));
}

function renderTimeline(asset) {
  const reviews = ensureReviews(asset);
  els.timeline.innerHTML = asset.frames.map((_, index) =>
    `<button class="frame-tile ${index === state.frame ? 'active' : ''}" data-frame="${index}"><img src="${frameSrc(asset, index)}" alt="第 ${index + 1} 帧"><i class="${reviews[index]}"></i><span><b>#${String(index + 1).padStart(2, '0')}</b><small>${REVIEW_LABELS_SHORT[reviews[index]]}</small></span></button>`).join('');
  els.timeline.querySelectorAll('button').forEach((button) =>
    button.addEventListener('click', () => {
      pauseForReview();
      state.frame = Number(button.dataset.frame);
      renderFrameOnly();
    }));
}

// 只刷新「当前帧」相关视图：主画面、计数、审核态、时间轴选中项、洋葱皮与微调。
// 播放循环与舞台移动都走这里，避免重建整条时间轴。
function renderFrameOnly() {
  const asset = currentAsset();
  if (!asset) return;

  els.characterFrame.src = frameSrc(asset, state.frame);
  els.frameCounter.textContent = `${String(state.frame + 1).padStart(2, '0')} / ${String(asset.frames.length).padStart(2, '0')}`;
  els.timeCounter.textContent = `${(state.frame / FIXED_FPS).toFixed(2)} s`;
  els.selectedFrame.textContent = `#${String(state.frame + 1).padStart(2, '0')}`;

  const reviews = ensureReviews(asset);
  els.frameState.textContent = REVIEW_LABELS[reviews[state.frame]];

  // 时间轴选中项高亮，并把它滚动到可视区中央。
  els.timeline.querySelectorAll('.frame-tile').forEach((tile, index) => {
    tile.classList.toggle('active', index === state.frame);
    if (index === state.frame) {
      const panel = tile.closest('.timeline-viewport');
      if (panel) {
        const targetTop = tile.offsetTop - panel.clientHeight / 2 + tile.clientHeight / 2;
        panel.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }
  });

  // 洋葱皮：叠加前后帧的半透明轮廓，辅助判断相位连续性。
  if (els.onionToggle.checked) {
    const prevIdx = (state.frame - 1 + asset.frames.length) % asset.frames.length;
    const nextIdx = (state.frame + 1) % asset.frames.length;
    els.onionPrev.src = frameSrc(asset, prevIdx);
    els.onionNext.src = frameSrc(asset, nextIdx);
    els.onionPrev.classList.add('show');
    els.onionNext.classList.add('show');
  } else {
    els.onionPrev.classList.remove('show');
    els.onionNext.classList.remove('show');
  }

  // 逐帧微调偏移 + 舞台位移 + 朝向，合成到 transform（各分量走 CSS 变量，便于移动循环独立更新）。
  applyPlayerTransform();
  const offset = frameOffsets[`${state.action}_${state.view}_${state.frame}`] || { x: 0, y: 0 };
  els.characterFrame.style.setProperty('--nudge-x', `${offset.x}px`);
  els.characterFrame.style.setProperty('--nudge-y', `${offset.y}px`);
  els.characterFrame.style.transform =
    'translateX(calc(-50% + var(--player-x, 0px) + var(--nudge-x, 0px))) translateY(var(--nudge-y, 0px)) scaleX(var(--facing, 1))';
  els.anchorCoords.textContent = `${baseAnchor.x}, ${baseAnchor.y}`;
}

// 只更新舞台位移与朝向两个 CSS 变量（移动循环每帧调用，成本低）。
function applyPlayerTransform() {
  els.characterFrame.style.setProperty('--player-x', `${movement.x}px`);
  els.characterFrame.style.setProperty('--facing', movement.direction);
}

// 全量渲染：切换视角 / 动作时重建整个视图。
function render() {
  renderActions();
  const asset = currentAsset();
  const view = library[state.view];
  els.characterName.textContent = characterCatalog[activeCharacterId].label;
  els.characterSelect.value = activeCharacterId;

  els.viewTabs.querySelectorAll('button').forEach((button) =>
    button.classList.toggle('active', button.dataset.view === state.view));
  els.stage.className = `stage mode-${state.view} ${els.gridToggle.checked ? 'show-grid' : ''} ${els.checkerToggle.checked ? 'checker' : ''}`;
  els.viewLabel.textContent = view.label;
  els.viewTruth.textContent = view.truth;
  els.missingState.hidden = Boolean(asset);
  els.characterFrame.hidden = !asset;

  // 该视角下缺此动作：显示缺口态，禁用导出。
  if (!asset) {
    clearInterval(state.timer);
    els.actionName.textContent = `${view.label} · ${actionLabels[state.action][0]}（缺口）`;
    els.timeline.innerHTML = '';
    els.exportBtn.disabled = true;
    return;
  }

  state.frame = Math.min(state.frame, asset.frames.length - 1);
  els.actionName.textContent = `${view.label} · ${asset.label}`;
  els.batchId.textContent = asset.batch;
  els.frameBatch.textContent = asset.batch;
  els.specName.textContent = `${asset.key} / ${state.view}`;
  els.specFrames.textContent = asset.frames.length;
  els.fpsSlider.value = FIXED_FPS;
  els.fpsValue.textContent = FIXED_FPS;
  els.loopToggle.checked = asset.loop;
  els.specPlayback.textContent = `${FIXED_FPS} FPS · ${asset.loop ? '循环' : '单次'}`;
  els.playBtn.textContent = state.playing ? '暂停' : '播放';

  renderTimeline(asset);
  renderFrameOnly();
  updateGate(asset);
  analyze(asset);
  setPlayback();
  if (!els.gameDock.hidden) setTimeout(syncGame, 0);
}

// ────────────────────────────────────────────────────────────
// 几何质检：在浏览器内逐帧扫描像素，输出连续性指标
// ────────────────────────────────────────────────────────────

async function analyze(asset) {
  const results = await Promise.all(asset.frames.map((_, index) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minY = canvas.height, maxY = -1, maxX = -1, minX = canvas.width, opaque = 0, sumX = 0, sumY = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 24) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            opaque++;
            sumX += x;
            sumY += y;
          }
        }
      }
      resolve({ width: canvas.width, height: canvas.height, minX, maxX, minY, maxY, opaque, cx: sumX / opaque, cy: sumY / opaque });
    };
    image.onerror = () => resolve(null);
    image.src = frameSrc(asset, index);
  })));

  const valid = results.filter(Boolean);
  const feet = valid.map((item) => item.maxY);
  const heights = valid.map((item) => item.maxY - item.minY + 1);
  const footDrift = Math.max(...feet) - Math.min(...feet);
  const heightDrift = Math.max(...heights) - Math.min(...heights);

  // 相邻帧质心位移：连续性靠「最大位移不超过中值的一定倍数」判断。
  const steps = valid.slice(1).map((item, index) => Math.hypot(item.cx - valid[index].cx, item.cy - valid[index].cy));
  const sortedSteps = [...steps].sort((a, b) => a - b);
  const medianStep = sortedSteps[Math.floor(sortedSteps.length / 2)] || 0;
  const maxStep = Math.max(...steps, 0);

  // 相邻帧不透明面积波动。
  const areaDeltas = valid.slice(1).map((item, index) =>
    Math.abs(item.opaque - valid[index].opaque) / Math.max(item.opaque, valid[index].opaque) * 100);
  const maxAreaDelta = Math.max(...areaDeltas, 0);

  // 循环动作的首尾接缝（仅 loop 资产适用）。
  const first = valid[0], last = valid.at(-1);
  const seam = Math.hypot(first.cx - last.cx, first.cy - last.cy);
  const seamArea = Math.abs(first.opaque - last.opaque) / Math.max(first.opaque, last.opaque) * 100;

  const continuityPass = maxStep <= medianStep * 2.6 + 2;
  const areaPass = maxAreaDelta <= (asset.loop ? 18 : 28);
  const seamPass = !asset.loop || (seam <= 10 && seamArea <= 14);

  const checks = [
    ['画布一致', valid.length === asset.frames.length && valid.every((item) => item.width === 256 && item.height === 256), `${valid.length}/${asset.frames.length} · 256×256`],
    ['透明背景', valid.every((item) => item.opaque < 256 * 256 * 0.65), 'Alpha 通道可用'],
    ['脚底线偏差', footDrift <= 3, `${footDrift}px / 阈值 3px`],
    ['主体高度偏差', heightDrift <= 7, `${heightDrift}px / 阈值 7px`],
    ['相邻帧位移连续性', continuityPass, `最大 ${maxStep.toFixed(1)}px · 中值 ${medianStep.toFixed(1)}px`],
    ['轮廓面积波动', areaPass, `最大 ${maxAreaDelta.toFixed(1)}%`],
    ['循环首尾接缝', seamPass, asset.loop ? `位移 ${seam.toFixed(1)}px · 面积 ${seamArea.toFixed(1)}%` : '单次动作·不适用'],
  ];

  els.qcChecks.innerHTML = checks.map(([name, pass, detail]) =>
    `<div class="qc-row ${pass ? 'pass' : 'warn'}"><i>${pass ? '✓' : '!'}</i><b>${name}</b><span>${detail}</span></div>`).join('');
  const passed = checks.filter((check) => check[1]).length;
  const score = Math.round((Number(continuityPass) + Number(areaPass) + Number(seamPass)) / 3 * 100);
  els.qcSummary.textContent = `${passed} / ${checks.length} 项通过 · 几何连续性 ${score}`;
}

// ────────────────────────────────────────────────────────────
// 导出门禁：全部帧通过审核才允许导出图集
// ────────────────────────────────────────────────────────────

function updateGate(asset) {
  const reviews = ensureReviews(asset);
  const passed = reviews.filter((value) => value === 'pass').length;
  const allPass = passed === reviews.length;

  els.approvalProgress.style.width = `${passed / reviews.length * 100}%`;
  els.approvalText.textContent = `${passed} / ${reviews.length} 帧通过`;
  els.exportBtn.disabled = !allPass;
  els.gateMessage.textContent = allPass
    ? '动作已满足导出条件，可生成 Cocos 图集与 metadata。'
    : '全部帧通过后才可导出，避免残缺动作进入项目。';

  const hasReject = reviews.includes('reject');
  els.instanceStatus.className = `status ${allPass ? 'pass' : hasReject ? 'reject' : 'pending'}`;
  els.instanceStatus.textContent = allPass ? '已通过' : hasReject ? '有退回帧' : '待审核';
}

// ────────────────────────────────────────────────────────────
// 播放与角色移动
// ────────────────────────────────────────────────────────────

function setPlayback() {
  clearInterval(state.timer);
  const asset = currentAsset();
  if (!asset || !state.playing) return;
  state.timer = setInterval(() => {
    // 非循环动作播到最后一帧即停。
    if (state.frame >= asset.frames.length - 1 && !els.loopToggle.checked) {
      state.playing = false;
      els.playBtn.textContent = '播放';
      clearInterval(state.timer);
      return;
    }
    state.frame = (state.frame + 1) % asset.frames.length;
    renderFrameOnly();
  }, 1000 / FIXED_FPS);
}

function pauseForReview() {
  state.playing = false;
  clearInterval(state.timer);
  els.playBtn.textContent = '播放';
}

// 舞台上「开始移动 / 停止」时切换到合适的动作（有 idle 用 idle，否则退回 walk）。
function switchMovementAction(isMoving) {
  if (isMoving) {
    state.playing = true;
    if (state.action !== 'walk' && library[state.view].walk) {
      state.action = 'walk';
      state.frame = 0;
      render();
    } else {
      setPlayback();
    }
  } else if (library[state.view].idle) {
    state.playing = true;
    if (state.action !== 'idle') {
      state.action = 'idle';
      state.frame = 0;
      render();
    } else {
      setPlayback();
    }
  } else {
    state.playing = false;
    els.playBtn.textContent = '播放';
    setPlayback();
  }
}

// 舞台角色横向移动的主循环：键盘/按钮/自动巡走三种输入汇成一个方向轴。
function movementLoop(now) {
  const delta = Math.min((now - movement.lastTime) / 1000, 0.05);
  movement.lastTime = now;
  if (!bootState.complete) {
    requestAnimationFrame(movementLoop);
    return;
  }
  const axis = Number(movement.right) - Number(movement.left);
  const moving = movement.auto || axis !== 0;

  if (moving !== movement.wasMoving) {
    movement.wasMoving = moving;
    switchMovementAction(moving);
  }

  if (moving && state.playing) {
    if (!movement.auto) movement.direction = axis > 0 ? 1 : -1;
    movement.x += movement.direction * 145 * delta;
    const edge = Math.max(80, els.stage.clientWidth / 2 - 145);
    if (movement.x >= edge) { movement.x = edge; movement.direction = -1; }
    if (movement.x <= -edge) { movement.x = -edge; movement.direction = 1; }
    applyPlayerTransform();
  }

  requestAnimationFrame(movementLoop);
}

// 手动方向键/按钮：按下即退出自动巡走。
function setMoveKey(direction, pressed) {
  movement[direction] = pressed;
  if (pressed) movement.auto = false;
  els.autoWalkBtn.classList.toggle('active', movement.auto);
  if (!movement.auto) els.autoWalkBtn.textContent = '自动巡走';
}

// ────────────────────────────────────────────────────────────
// Cocos 引擎联调（postMessage 桥）
// ────────────────────────────────────────────────────────────

function gamePayload() {
  const asset = currentAsset();
  if (!asset) return null;
  return { type: `${PREVIEW_NS}:preview-animation`, character: activeCharacterId, action: asset.key, view: state.view, fps: FIXED_FPS, loop: els.loopToggle.checked };
}

function syncGame() {
  const payload = gamePayload();
  if (!payload) {
    els.gameStatus.textContent = '缺少该视角资产';
    return;
  }
  els.gameStatus.textContent = '正在同步…';
  els.gameFrame.contentWindow?.postMessage(payload, GAME_ORIGIN);
}

// ────────────────────────────────────────────────────────────
// 资产抽屉（macOS 毛玻璃式：热区展开、移出收回）
// ────────────────────────────────────────────────────────────

let drawerCloseTimer = null;
let drawerOpenAnimationTimer = null;

function setDrawer(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  els.sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  els.sidebarReveal.setAttribute('aria-expanded', String(!collapsed));
}

function openDrawer() {
  clearTimeout(drawerCloseTimer);
  clearTimeout(drawerOpenAnimationTimer);
  document.body.classList.remove('drawer-opening');
  void document.body.offsetWidth;
  document.body.classList.add('drawer-opening');
  setDrawer(false);
  drawerOpenAnimationTimer = setTimeout(() => {
    document.body.classList.remove('drawer-opening');
  }, 560);
}

function scheduleDrawerClose() {
  clearTimeout(drawerCloseTimer);
  drawerCloseTimer = setTimeout(() => setDrawer(true), 260);
}

// ────────────────────────────────────────────────────────────
// 启动引导：聚光灯揭示 + 自动起步
// ────────────────────────────────────────────────────────────

function showModeCards() {
  els.modeCards.hidden = false;
  requestAnimationFrame(() => els.modeCards.classList.add('visible'));
  setTimeout(showCharacterClickGuide, 360);
}

function closeModeCards(callback) {
  if (bootState.choiceMade) return;
  bootState.choiceMade = true;
  els.modeCards.classList.remove('visible');
  els.modeCards.classList.add('leaving');
  setTimeout(() => {
    els.modeCards.hidden = true;
    els.modeCards.classList.remove('leaving');
    callback?.();
  }, 220);
}

function bootReveal() {
  // 聚光灯期间固定在 idle 第 1 帧，不启动播放或自动巡走。
  state.playing = false;
  state.frame = 0;
  movement.auto = false;
  movement.left = false;
  movement.right = false;
  clearInterval(state.timer);
  renderFrameOnly();
  els.playBtn.textContent = '播放';

  const rect = els.characterFrame.getBoundingClientRect();
  const spotlight = document.createElement('div');
  spotlight.className = 'dynamic-spotlight';
  spotlight.style.left = `${rect.left + rect.width / 2}px`;
  spotlight.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(spotlight);

  const bootScreen = document.getElementById('bootScreen');
  const bootWordmark = document.getElementById('bootWordmark');
  if (bootScreen) setTimeout(() => bootScreen.remove(), 100);
  setTimeout(() => {
    spotlight.remove();
    bootWordmark?.remove();
    bootState.complete = true;
    showModeCards();
  }, 3000);
}

// 舞台上的一次性浮动提示气泡。
function showClickPrompt(text, left, top, ttl) {
  const prompt = document.createElement('div');
  prompt.textContent = text;
  prompt.className = 'click-prompt';
  prompt.style.left = left;
  prompt.style.top = top;
  document.body.appendChild(prompt);
  setTimeout(() => prompt.remove(), ttl);
}

let characterClickGuide = null;

function hideCharacterClickGuide() {
  if (!characterClickGuide) return;
  characterClickGuide.classList.add('leaving');
  const guide = characterClickGuide;
  characterClickGuide = null;
  setTimeout(() => guide.remove(), 220);
}

function showCharacterClickGuide() {
  hideCharacterClickGuide();
  const guide = document.createElement('div');
  guide.className = 'character-click-guide';
  guide.innerHTML = '<span class="guide-ripple"></span><i class="guide-cursor"></i><b>点击人物开始移动</b>';
  els.stage.appendChild(guide);
  characterClickGuide = guide;
  setTimeout(() => {
    if (characterClickGuide === guide) hideCharacterClickGuide();
  }, 5200);
}

function startCharacterWalk() {
  if (!library[state.view]?.walk) return;
  hideCharacterClickGuide();
  state.action = 'walk';
  state.frame = 0;
  state.playing = true;
  movement.x = 0;
  movement.direction = 1;
  movement.auto = true;
  movement.wasMoving = false;
  els.autoWalkBtn.classList.add('active');
  els.autoWalkBtn.textContent = '停止巡走';
  render();
}

// ────────────────────────────────────────────────────────────
// 图集打包导出（仅在导出门禁开启时可触发）
// ────────────────────────────────────────────────────────────

async function exportSpriteSheet() {
  const asset = currentAsset();
  const reviews = ensureReviews(asset);
  if (reviews.some((value) => value !== 'pass')) return;

  els.packerModal.showModal();
  els.spriteMeta.textContent = '打包中...';
  const canvas = els.spriteCanvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const imgs = await Promise.all(asset.frames.map((_, index) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = frameSrc(asset, index);
  })));

  const w = 256, h = 256;
  canvas.width = w * imgs.length;
  canvas.height = h;

  const json = {
    frames: {},
    meta: { app: 'Windup Asset Lab', image: `${activeCharacterId}-${asset.key}.png`, format: 'RGBA8888', size: { w: canvas.width, h: canvas.height }, scale: '1' },
  };

  imgs.forEach((img, i) => {
    const offset = frameOffsets[`${state.action}_${state.view}_${i}`] || { x: 0, y: 0 };
    ctx.drawImage(img, i * w + offset.x, offset.y, w, h);
    json.frames[`${asset.key}_${String(i + 1).padStart(2, '0')}.png`] = {
      frame: { x: i * w, y: 0, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
      anchor: { x: (baseAnchor.x / w).toFixed(2), y: ((h - baseAnchor.y) / h).toFixed(2) },
    };
  });

  const dataUrl = canvas.toDataURL('image/png');
  const bytes = Math.round(dataUrl.length * 0.75);
  els.spriteMeta.textContent = `${canvas.width} x ${canvas.height} · ${(bytes / 1024).toFixed(1)} KB`;
  els.spriteJson.value = JSON.stringify(json, null, 2);

  els.downloadPackBtn.onclick = () => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${activeCharacterId}-${asset.key}.png`;
    link.click();
    const jsonLink = document.createElement('a');
    jsonLink.href = URL.createObjectURL(new Blob([els.spriteJson.value], { type: 'application/json' }));
    jsonLink.download = `${activeCharacterId}-${asset.key}.json`;
    jsonLink.click();
  };
}

// 逐帧写入/读取审核结论并持久化。
function setReview(value) {
  pauseForReview();
  const asset = currentAsset();
  ensureReviews(asset)[state.frame] = value;
  localStorage.setItem('windup-review-state', JSON.stringify(state.reviews));
  renderTimeline(asset);
  renderFrameOnly();
  updateGate(asset);
}

// ────────────────────────────────────────────────────────────
// 多角色目录与生成中心
function firstAvailableAction(view = state.view) {
  return actionOrder.find((key) => library[view]?.[key]) || null;
}

function switchCharacter(characterId) {
  activeCharacterId = characterId;
  library = characterCatalog[characterId].library;
  state.action = library[state.view]?.[state.action] ? state.action : firstAvailableAction() || 'walk';
  state.frame = 0;
  movement.x = 0;
  render();
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function setGenerationMode() {
  const single = els.genMode.value === 'single';
  els.genFrameField.style.opacity = single ? '1' : '.38';
  els.genFrame.disabled = !single;
}

async function openGenerationStudio(singleFrame = false) {
  const character = characterCatalog[activeCharacterId];
  els.genPortrait.src = character.base;
  els.genCharacterName.textContent = character.label;
  els.genView.value = state.view;
  els.genAction.value = state.action;
  els.genMode.value = singleFrame ? 'single' : 'full';
  els.genFrame.value = state.frame + 1;
  setGenerationMode();
  els.generationModal.showModal();
  try {
    const health = await requestJson('/api/health');
    els.providerDot.className = 'ready';
    els.providerStatus.textContent = health.demo
      ? 'Demo 管线已就绪 · 不消耗 API'
      : health.configured ? `${health.model} · 已配置` : '后端已就绪 · 待配置密钥';
  } catch (error) {
    els.providerDot.className = 'error';
    els.providerStatus.textContent = '生成后端未启动';
    els.genMessage.textContent = `请用 python3 server/app.py --demo 启动完整服务。${error.message}`;
  }
}

function renderGenerationJob(job) {
  generationState.job = job;
  els.genBatch.textContent = job.batch || job.id;
  els.genPercent.textContent = `${job.progress || 0}%`;
  els.genProgress.style.width = `${job.progress || 0}%`;
  els.genMessage.textContent = job.message || '';
  els.startGenerationBtn.disabled = ['queued', 'generating', 'processing'].includes(job.status);
  els.promoteJobBtn.disabled = job.status !== 'awaiting_review';
  if (job.outputs?.length) {
    els.candidateGrid.innerHTML = job.outputs.map((output) => `
      <article class="candidate-card">
        <img src="${output.url}?v=${job.updatedAt || Date.now()}" alt="候选第 ${output.frameIndex + 1} 帧">
        <div><b>#${String(output.frameIndex + 1).padStart(2, '0')}</b><span>${job.request.mode === 'single' ? '单帧修复' : '动作相位'}</span></div>
      </article>`).join('');
  }
}

async function pollGeneration(jobId) {
  clearTimeout(generationState.poll);
  try {
    const job = await requestJson(`/api/generations/${jobId}`);
    renderGenerationJob(job);
    if (['queued', 'generating', 'processing'].includes(job.status)) generationState.poll = setTimeout(() => pollGeneration(jobId), 700);
  } catch (error) {
    els.startGenerationBtn.disabled = false;
    els.genMessage.textContent = `任务查询失败：${error.message}`;
  }
}

async function startGeneration() {
  els.startGenerationBtn.disabled = true;
  els.promoteJobBtn.disabled = true;
  els.candidateGrid.innerHTML = '<div class="candidate-empty">正在创建任务…</div>';
  try {
    const job = await requestJson('/api/generations', {
      method: 'POST',
      body: JSON.stringify({ character: activeCharacterId, view: els.genView.value, action: els.genAction.value,
        mode: els.genMode.value, frameIndex: Math.max(0, Math.min(7, Number(els.genFrame.value) - 1)) }),
    });
    renderGenerationJob(job);
    pollGeneration(job.id);
  } catch (error) {
    els.startGenerationBtn.disabled = false;
    els.candidateGrid.innerHTML = '<div class="candidate-empty">任务未创建</div>';
    els.genMessage.textContent = `生成失败：${error.message}`;
  }
}

function officialFrames(characterId, view, action, count) {
  if (characterId === 'lamplighter') {
    const base = view === 'side' && action === 'walk' ? `${root}/frames` : `${root}/views/${view}`;
    return makeFrames(base, action, count);
  }
  return makeFrames(`${teammateRoot}/${characterId}/views/${view}`, action, count);
}

function adoptJobInLibrary(job) {
  const { view, action, mode, frameIndex } = job.request;
  const viewLibrary = library[view];
  let asset = viewLibrary[action];
  const count = mode === 'full' ? Math.max(8, job.outputs.length) : Math.max(asset?.frames.length || 0, frameIndex + 1);
  if (!asset) {
    asset = viewLibrary[action] = { label: actionLabels[action][0], key: action,
      frames: officialFrames(activeCharacterId, view, action, count), fps: 8,
      loop: !['jump', 'lantern'].includes(action), batch: job.batch, initial: 'pending' };
  } else if (mode === 'full' || asset.frames.length < count) {
    asset.frames = officialFrames(activeCharacterId, view, action, count);
  }
  asset.batch = job.batch;
  asset.revision = Date.now();
  state.view = view;
  state.action = action;
  state.frame = mode === 'single' ? frameIndex : 0;
  if (mode === 'full') state.reviews[reviewKey()] = asset.frames.map(() => 'pending');
  else ensureReviews(asset)[frameIndex] = 'pending';
  localStorage.setItem('windup-review-state', JSON.stringify(state.reviews));
  render();
}

async function promoteGeneration() {
  const job = generationState.job;
  if (!job) return;
  els.promoteJobBtn.disabled = true;
  els.promoteJobBtn.textContent = '正在采用…';
  try {
    const approved = await requestJson(`/api/generations/${job.id}/promote`, { method: 'POST', body: '{}' });
    renderGenerationJob(approved);
    adoptJobInLibrary(approved);
    els.promoteJobBtn.textContent = '已进入审核台';
    els.genMessage.textContent = '候选资产已采用，原文件已自动备份。';
  } catch (error) {
    els.promoteJobBtn.disabled = false;
    els.promoteJobBtn.textContent = '接受候选资产';
    els.genMessage.textContent = `采用失败：${error.message}`;
  }
}

// 事件绑定
// ────────────────────────────────────────────────────────────

els.characterSelect.innerHTML = Object.entries(characterCatalog)
  .map(([id, character]) => `<option value="${id}">${character.label}</option>`).join('');
els.characterSelect.addEventListener('change', () => switchCharacter(els.characterSelect.value));
els.openGenerateBtn.addEventListener('click', () => openGenerationStudio(false));
els.generationModeCard.addEventListener('click', (event) => {
  event.stopPropagation();
  closeModeCards(() => openGenerationStudio(false));
});
els.editorModeCard.addEventListener('click', (event) => {
  event.stopPropagation();
  closeModeCards(() => setDrawer(false));
});
els.regenerateFrameBtn.addEventListener('click', () => openGenerationStudio(true));
els.closeGenerateBtn.addEventListener('click', () => els.generationModal.close());
els.genMode.addEventListener('change', setGenerationMode);
els.startGenerationBtn.addEventListener('click', startGeneration);
els.promoteJobBtn.addEventListener('click', promoteGeneration);

// 视角切换：带离场/入场过渡动画。
els.viewTabs.querySelectorAll('button').forEach((button) =>
  button.addEventListener('click', () => {
    if (button.dataset.view === state.view) return;
    els.stage.classList.add('view-leave');
    setTimeout(() => {
      state.view = button.dataset.view;
      if (!library[state.view][state.action]) state.action = 'walk';
      state.frame = 0;
      render();
      els.stage.classList.remove('view-leave');
      els.stage.classList.add('view-enter');
      setTimeout(() => els.stage.classList.remove('view-enter'), 260);
    }, 180);
  }));

// 播放控制。
els.playBtn.addEventListener('click', () => {
  if (!bootState.complete) return;
  state.playing = !state.playing;
  els.playBtn.textContent = state.playing ? '暂停' : '播放';
  setPlayback();
});
els.firstBtn.addEventListener('click', () => { pauseForReview(); state.frame = 0; renderFrameOnly(); });
els.lastBtn.addEventListener('click', () => { pauseForReview(); state.frame = currentAsset().frames.length - 1; renderFrameOnly(); });
els.prevBtn.addEventListener('click', () => { pauseForReview(); state.frame = (state.frame - 1 + currentAsset().frames.length) % currentAsset().frames.length; renderFrameOnly(); });
els.nextBtn.addEventListener('click', () => { pauseForReview(); state.frame = (state.frame + 1) % currentAsset().frames.length; renderFrameOnly(); });
els.fpsSlider.addEventListener('input', () => { els.fpsValue.textContent = els.fpsSlider.value; setPlayback(); });
els.loopToggle.addEventListener('change', setPlayback);
els.gridToggle.addEventListener('change', render);
els.checkerToggle.addEventListener('change', render);
els.onionToggle.addEventListener('change', renderFrameOnly);

// 逐帧审核。
els.approveBtn.addEventListener('click', () => setReview('pass'));
els.rejectBtn.addEventListener('click', () => setReview('reject'));

// 舞台拖拽人物 = 调整脚底锚点。
els.characterFrame.addEventListener('mousedown', (event) => {
  event.preventDefault(); // 阻止图片原生拖拽，抢占自定义拖拽
  drag.active = true;
  drag.moved = false;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.anchorX = baseAnchor.x;
  drag.anchorY = baseAnchor.y;
  els.characterFrame.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (event) => {
  if (!drag.active) return;
  if (Math.abs(event.clientX - drag.startX) > 3 || Math.abs(event.clientY - drag.startY) > 3) drag.moved = true;
  baseAnchor.x = Math.round(drag.anchorX - (event.clientX - drag.startX));
  baseAnchor.y = Math.round(drag.anchorY - (event.clientY - drag.startY));
  els.anchorCoords.textContent = `${baseAnchor.x}, ${baseAnchor.y}`;
});
window.addEventListener('mouseup', () => {
  drag.active = false;
  els.characterFrame.style.cursor = '';
});

els.characterFrame.addEventListener('click', (event) => {
  if (drag.moved || !bootState.complete) return;
  event.stopPropagation();
  startCharacterWalk();
});

// 点击舞台空白处：在 idle / walk / run 之间循环切换（拖拽过则忽略这次点击）。
els.stage.addEventListener('click', (event) => {
  if (!bootState.complete || !bootState.choiceMade) return;
  if (drag.moved) return;
  if (event.target.closest('.sidebar, .inspector, .topbar, .view-toolbar, .playback, .timeline-panel, .tool-toggles')) return;

  const viewLib = library[state.view];
  let targetAction = state.action;
  let isMoving = true;

  if (state.action === 'idle') {
    if (viewLib.walk) targetAction = 'walk';
  } else if (state.action === 'walk') {
    if (viewLib.idle) { targetAction = 'idle'; isMoving = false; }
    else if (viewLib.run) targetAction = 'run';
  } else if (state.action === 'run') {
    if (viewLib.idle) { targetAction = 'idle'; isMoving = false; }
    else if (viewLib.walk) targetAction = 'walk';
  }

  if (targetAction !== state.action) {
    state.action = targetAction;
    movement.auto = isMoving;
    els.autoWalkBtn.classList.toggle('active', isMoving);
    els.autoWalkBtn.textContent = isMoving ? '停止巡走' : '自动巡走';
    render();
  }

  showClickPrompt(isMoving ? `▶ 开始${actionLabels[state.action][0]}` : '⏸ 停止动画', `${event.clientX}px`, `${event.clientY - 20}px`, 1000);
});

// 导出与图集打包弹窗。
els.exportBtn.addEventListener('click', exportSpriteSheet);
els.closePackerBtn.addEventListener('click', () => els.packerModal.close());

// Cocos 联调面板。
els.gamePreviewBtn.addEventListener('click', () => { els.gameDock.hidden = false; setTimeout(syncGame, 350); });
els.closeGameBtn.addEventListener('click', () => { els.gameDock.hidden = true; });
els.sendGameBtn.addEventListener('click', syncGame);
els.gameFrame.addEventListener('load', syncGame);
els.enterGameBtn.addEventListener('click', () => {
  const payload = gamePayload();
  const game = window.open(`${GAME_ORIGIN}/`, 'windup-cocos-game');
  if (!game || !payload) return;
  [700, 1400, 2400].forEach((delay) => setTimeout(() => game.postMessage(payload, GAME_ORIGIN), delay));
});

// 来自 Cocos 的联调回执。
window.addEventListener('message', (event) => {
  if (event.origin !== GAME_ORIGIN) return;
  const type = event.data?.type;
  if (type === `${PREVIEW_NS}:preview-ready`) els.gameStatus.textContent = '游戏已连接';
  else if (type === `${PREVIEW_NS}:preview-applied`) els.gameStatus.textContent = `已同步 ${event.data.view} / ${event.data.action} · ${event.data.frames}帧`;
  else if (type === `${PREVIEW_NS}:preview-error`) els.gameStatus.textContent = `同步失败·${event.data.reason}`;
});

// 资产抽屉热区。
els.sidebarToggle.addEventListener('click', () => setDrawer(true));
els.sidebarReveal.addEventListener('mouseenter', openDrawer);
els.sidebarReveal.addEventListener('focus', openDrawer);
els.drawerHotspot.addEventListener('mouseenter', openDrawer);
els.assetDrawer.addEventListener('mouseenter', () => clearTimeout(drawerCloseTimer));
els.assetDrawer.addEventListener('mouseleave', scheduleDrawerClose);

// 移动按钮（指针按住 = 持续移动）。
[['moveLeftBtn', 'left'], ['moveRightBtn', 'right']].forEach(([id, direction]) => {
  const button = els[id];
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setMoveKey(direction, true);
  });
  button.addEventListener('pointerup', () => setMoveKey(direction, false));
  button.addEventListener('pointercancel', () => setMoveKey(direction, false));
});
els.autoWalkBtn.addEventListener('click', () => {
  if (!bootState.complete) return;
  movement.auto = !movement.auto;
  movement.left = false;
  movement.right = false;
  els.autoWalkBtn.classList.toggle('active', movement.auto);
  els.autoWalkBtn.textContent = movement.auto ? '停止巡走' : '自动巡走';
});

// 键盘：暂停时方向键微调当前帧偏移；播放时方向键/AD 驱动移动，空格切播放。
window.addEventListener('keydown', (event) => {
  if (!bootState.complete) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

  if (!state.playing && event.code.startsWith('Arrow')) {
    const key = `${state.action}_${state.view}_${state.frame}`;
    if (!frameOffsets[key]) frameOffsets[key] = { x: 0, y: 0 };
    if (event.code === 'ArrowUp') frameOffsets[key].y -= 1;
    else if (event.code === 'ArrowDown') frameOffsets[key].y += 1;
    else if (event.code === 'ArrowLeft') frameOffsets[key].x -= 1;
    else if (event.code === 'ArrowRight') frameOffsets[key].x += 1;
    event.preventDefault();
    renderFrameOnly();
    return;
  }

  if (event.code === 'Space') { event.preventDefault(); els.playBtn.click(); }
  if (event.code === 'ArrowRight' || event.code === 'KeyD') { event.preventDefault(); setMoveKey('right', true); }
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') { event.preventDefault(); setMoveKey('left', true); }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowRight' || event.code === 'KeyD') setMoveKey('right', false);
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') setMoveKey('left', false);
});

// ────────────────────────────────────────────────────────────
// 启动
// ────────────────────────────────────────────────────────────

render();
setDrawer(true);
setTimeout(bootReveal, 100);
requestAnimationFrame(movementLoop);
