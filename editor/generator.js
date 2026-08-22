// generator.js - browser port of two Node generators, Node deps stripped
// 模板 T2_gong.json 内嵌;所有函数挂到 window.GEN
(function (global) {
  'use strict';

  const TEMPLATE_T2_GONG = {"levelId":1,"totalPairs":22,"tiles":[{"id":1,"layer":0,"row":-8,"col":-5,"typeId":null},{"id":2,"layer":0,"row":-8,"col":-3,"typeId":null},{"id":3,"layer":0,"row":-8,"col":-1,"typeId":null},{"id":4,"layer":0,"row":-8,"col":1,"typeId":null},{"id":5,"layer":0,"row":-8,"col":3,"typeId":null},{"id":6,"layer":0,"row":-8,"col":5,"typeId":null},{"id":7,"layer":0,"row":-6,"col":-5,"typeId":null},{"id":8,"layer":0,"row":-6,"col":-3,"typeId":null},{"id":9,"layer":0,"row":-6,"col":-1,"typeId":null},{"id":10,"layer":0,"row":-6,"col":1,"typeId":null},{"id":11,"layer":0,"row":-6,"col":3,"typeId":null},{"id":12,"layer":0,"row":-6,"col":5,"typeId":null},{"id":13,"layer":0,"row":-4,"col":-5,"typeId":null},{"id":14,"layer":0,"row":-4,"col":-3,"typeId":null},{"id":15,"layer":0,"row":-4,"col":-1,"typeId":null},{"id":16,"layer":0,"row":-4,"col":1,"typeId":null},{"id":17,"layer":0,"row":-4,"col":3,"typeId":null},{"id":18,"layer":0,"row":-4,"col":5,"typeId":null},{"id":19,"layer":0,"row":-2,"col":-3,"typeId":null},{"id":20,"layer":0,"row":-2,"col":-1,"typeId":null},{"id":21,"layer":0,"row":-2,"col":1,"typeId":null},{"id":22,"layer":0,"row":-2,"col":3,"typeId":null},{"id":23,"layer":0,"row":0,"col":-3,"typeId":null},{"id":24,"layer":0,"row":0,"col":-1,"typeId":null},{"id":25,"layer":0,"row":0,"col":1,"typeId":null},{"id":26,"layer":0,"row":0,"col":3,"typeId":null},{"id":27,"layer":0,"row":2,"col":-5,"typeId":null},{"id":28,"layer":0,"row":2,"col":-3,"typeId":null},{"id":29,"layer":0,"row":2,"col":-1,"typeId":null},{"id":30,"layer":0,"row":2,"col":1,"typeId":null},{"id":31,"layer":0,"row":2,"col":3,"typeId":null},{"id":32,"layer":0,"row":2,"col":5,"typeId":null},{"id":33,"layer":0,"row":4,"col":-5,"typeId":null},{"id":34,"layer":0,"row":4,"col":-3,"typeId":null},{"id":35,"layer":0,"row":4,"col":-1,"typeId":null},{"id":36,"layer":0,"row":4,"col":1,"typeId":null},{"id":37,"layer":0,"row":4,"col":3,"typeId":null},{"id":38,"layer":0,"row":4,"col":5,"typeId":null},{"id":39,"layer":0,"row":6,"col":-5,"typeId":null},{"id":40,"layer":0,"row":6,"col":-3,"typeId":null},{"id":41,"layer":0,"row":6,"col":-1,"typeId":null},{"id":42,"layer":0,"row":6,"col":1,"typeId":null},{"id":43,"layer":0,"row":6,"col":3,"typeId":null},{"id":44,"layer":0,"row":6,"col":5,"typeId":null}],"specialTiles":[]};

  // ===== shape_generator =====
// shape_generator_v17_std.js  （std = 标准坐标）
// 基于模板的规则生成器 —— 与 v17 相同的算法，但导出用【标准坐标约定】：
//   row = 上下（纵），col = 左右（横）
// 内部算法仍用 row=横/col=纵 运算（不改动，风险最低），只在 toEditorJSON 导出处交换 row/col。
// 原 shape_generator_v17.js 保持不动。
//
// 输入：模板（任意 L0 形状 + 可选 L1+）
// 输出：每个种子生成不同形状的变体（JSON 为 std 坐标）


// ========== 工具 ==========
function shuffle(arr, rng) {
  rng = rng || Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function keyOf(row, col) { return `${row},${col}`; }
function mirrorRow(row) { return -row; }
function inBounds(row, col) {
  return row >= -5 && row <= 5 && col >= -8 && col <= 6;
}

// ========== 支撑（象限规则） ==========
function quadCovered(lowerArr, r, c) {
  return lowerArr.some(lt => lt.row <= r && r < lt.row + 2 && lt.col <= c && c < lt.col + 2);
}

function hasSupport(row, col, lowerArr) {
  const quads = [[row, col], [row, col + 1], [row + 1, col], [row + 1, col + 1]];
  let covered = 0;
  quads.forEach(([r, c]) => { if (quadCovered(lowerArr, r, c)) covered++; });
  return covered === 4;
}

// ========== 模板加载 ==========
function loadTemplate(jsonInput) {
  const json = jsonInput;
  const layerMap = {};
  json.tiles.forEach(t => {
    const l = t.layer;
    if (!layerMap[l]) layerMap[l] = [];
    layerMap[l].push({ row: t.row, col: t.col });
  });
  const layerNums = Object.keys(layerMap).map(Number).sort((a, b) => a - b);
  return {
    layers: layerNums.map(l => ({ layer: l, cells: layerMap[l] })),
    layerCount: layerNums.length,
  };
}

// ========== 散落策略 ==========
// 从候选位置挑牌。mode='ordered' 按行列有序密排（互锁，喂饱上一层）；mode='random' 随机有机
function generateLayer(lowerArr, lowerKeys, style, count, mode = 'ordered', mirror = true) {
  const candidates = [];
  for (let row = 0; row <= 5; row++) {
    for (let col = -8; col <= 6; col++) {
      if (!inBounds(row, col)) continue;
      if (!hasSupport(row, col, lowerArr)) continue;
      if (lowerKeys.has(keyOf(row, col))) continue;

      // 位置偏好过滤
      if (style.positionBias === 'left' && col > 0) continue;
      if (style.positionBias === 'right' && col < 0) continue;
      if (style.positionBias === 'edge' && col > -2 && col < 2) continue;

      // 行偏好：仅在排序里给偏好行靠前（不排除其他行）
      let order = Infinity;
      if (style.rowBias) {
        const idx = style.rowBias.indexOf(row);
        if (idx >= 0) order = idx;
      }

      candidates.push({ row, col, order });
    }
  }

  if (candidates.length === 0) return new Set();

  // ordered：偏好行优先，其次行列有序密排（互锁喂上层）
  // random：打乱后随机挑（有机变化）
  candidates.sort((a, b) => a.order - b.order);
  if (mode === 'random') shuffle(candidates);

  const selected = new Set();
  for (const cand of candidates) {
    if (selected.size >= count) break;
    let tooClose = false;
    for (const k of selected) {
      const [r, c] = k.split(',').map(Number);
      if (Math.abs(cand.row - r) < 2 && Math.abs(cand.col - c) < 2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    // 无全覆盖：仅镜像模式时，镜像位置也不能和下层完全重合
    if (mirror) {
      const mr = mirrorRow(cand.row); // row-mirror（内部坐标）
      if (lowerKeys.has(keyOf(mr, cand.col))) continue;
    }
    selected.add(keyOf(cand.row, cand.col));
  }

  return expandMirrorWithLimit(selected, count, mirror);
}

function expandMirrorWithLimit(left, count, mirror = true) {
  const full = new Set(left);
  if (mirror) {
    left.forEach(function(k) {
      var p = k.split(',').map(Number), r = p[0], c = p[1];
      var mr = mirrorRow(r);
      if (mr !== r) full.add(mr + ',' + c);
    });
  }
  if (full.size > 0) {
    var symmetryErrors = 0;
    full.forEach(function(k){ var p=k.split(','),r=+p[0],c=+p[1]; if(!full.has(-r+','+c)) symmetryErrors++; });
    if (symmetryErrors > 0) console.warn('[dbg] asymmetric layer! full=' + full.size + ' errors=' + symmetryErrors + ' selected=' + left.size + ' sample=' + [...left].slice(0,3).join(' '));
  }
  return full;
}

// ========== 主生成 ==========
// 从模板生成关卡（L0 保持原样，L1+ 完全随机生成）
// 无风格、无偏置：每次调用随机抽取金字塔目标和行偏好，始终保持中心化塔
function generateFromTemplate(template, options = {}) {
  const templateLayerCount = template.layerCount;
  const generateLayerCount = options.layerCount ?? templateLayerCount;
  // mirror=false：底座不对称时，上层按底座实际形状堆，不做镜像展开
  const mirror = options.mirror !== false;

  // 随机金字塔目标（镜像展开前约×2）
  // L1 是骨架要够密，往上递减；每层加随机抖动制造差异
  const baseTargets = [13, 9, 6, 4, 2]; // L1..L5 基础
  const style = {
    // 随机行偏好：从中抽 1~3 行作排序优先（只影响先填哪行，不排除其他行）
    rowBias: options.rowBias ?? [1, 3, 5].slice(0, 1 + Math.floor(Math.random() * 3)),
    colOffset: 0,
  };

  function calcCount(layerIdx, totalLayers) {
    const b = baseTargets[layerIdx - 1] ?? 2;
    const jitter = 0.7 + Math.random() * 0.6; // 0.7 ~ 1.3 随机抖动
    return Math.max(2, Math.round(b * jitter));
  }

  // 使用编辑器已有的层（L0, L1, ...），只生成缺少的层
  const newLayers = [];
  for (let l = 0; l < template.layers.length; l++) {
    newLayers.push({ layer: l, cells: [...template.layers[l].cells] });
  }
  // 如果编辑器层数不够，继续往上堆
  for (let l = template.layers.length; l < generateLayerCount; l++) {
    const lowerArr = newLayers[l - 1].cells;
    const lowerKeys = new Set(lowerArr.map(c => keyOf(c.row, c.col)));
    const count = calcCount(l, generateLayerCount);
    const mode = l === 1 ? 'ordered' : 'random';
    const selected = generateLayer(lowerArr, lowerKeys, style, count, mode, mirror);
    const arr = Array.from(selected).map(k => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    });
    newLayers.push({ layer: l, cells: arr });
  }

  // 应用 colOffset（上靠/下靠风格）：整体平移所有上层
  if (style.colOffset !== 0) {
    for (let l = 1; l < newLayers.length; l++) {
      const delta = style.colOffset;
      const left = newLayers[l].cells.filter(c => c.row >= 0);
      if (left.length === 0) continue;
      const shifted = left.map(c => ({ row: c.row, col: c.col + delta }));
      if (shifted.some(c => !inBounds(c.row, c.col))) continue;
      const lowerArr = newLayers[l - 1].cells;
      const lowerKeys = new Set(lowerArr.map(c => keyOf(c.row, c.col)));
      let overlap = false;
      for (const c of shifted) {
        if (lowerKeys.has(keyOf(c.row, c.col))) { overlap = true; break; }
      }
      if (overlap) continue;
      const newFull = [];
      for (const c of shifted) {
        newFull.push({ row: c.row, col: c.col });
        if (mirrorRow(c.row) !== c.row) {
          newFull.push({ row: mirrorRow(c.row), col: c.col });
        }
      }
      newLayers[l].cells = newFull;
    }
  }

  const tiles = [];
  newLayers.forEach(ld => {
    ld.cells.forEach(c => {
      tiles.push({ id: 0, layer: ld.layer, row: c.row, col: c.col, typeId: null });
    });
  });

  return {
    tiles,
    layers: newLayers.length,
    layerCounts: newLayers.map(l => l.cells.length),
    styleName: '随机',
    styleIdx: 0,
  };
}

// ========== 校验 ==========
function validateShape(shape, opts = {}) {
  const errors = [];
  const byLayer = {};
  shape.tiles.forEach(t => {
    if (!byLayer[t.layer]) byLayer[t.layer] = [];
    byLayer[t.layer].push(t);
  });

  const layerNums = Object.keys(byLayer).map(Number).sort((a, b) => a - b);
  if (layerNums.length === 0) return { ok: true, errors: [] };

  // 对称（skipSymmetry=true 时跳过：底座不对称时，上层按实际形状堆，不要求镜像）
  // 内部坐标用 row-mirror（对应 std 坐标的 col-mirror = 左右视觉对称），与底座检测、堆塔展开保持一致
  if (!opts.skipSymmetry) {
    layerNums.forEach(l => {
      const set = new Set(byLayer[l].map(t => keyOf(t.row, t.col)));
      byLayer[l].forEach(t => {
        if (!set.has(keyOf(mirrorRow(t.row), t.col))) {
          errors.push(`[对称] L${l}(${t.row},${t.col})`);
        }
      });
    });
  }

  // 支撑
  layerNums.forEach(l => {
    if (l === 0) return;
    byLayer[l].forEach(t => {
      if (!hasSupport(t.row, t.col, byLayer[l - 1])) {
        errors.push(`[支撑] L${l}(${t.row},${t.col})`);
      }
    });
  });

  // 同层冲突:只允许完全重合才算冲突(相邻是合法的)
  layerNums.forEach(l => {
    const arr = byLayer[l];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].row === arr[j].row && arr[i].col === arr[j].col) {
          errors.push(`[冲突] L${l}(${arr[i].row},${arr[i].col})`);
        }
      }
    }
  });

  // 全覆盖
  layerNums.forEach(l => {
    if (l === 0) return;
    const lowerKeys = new Set(byLayer[l - 1].map(t => keyOf(t.row, t.col)));
    byLayer[l].forEach(t => {
      if (lowerKeys.has(keyOf(t.row, t.col))) {
        errors.push(`[全覆盖] L${l}(${t.row},${t.col})`);
      }
    });
  });

  return { ok: errors.length === 0, errors };
}

// ========== 导出 JSON ==========
function toEditorJSON(shape, levelId = 1) {
  let tiles = shape.tiles.map(t => ({
    id: 0, layer: t.layer, row: t.row, col: t.col, typeId: null,
  }));

  if (tiles.length % 2 !== 0) {
    const subTiles = shape.tiles.map(t => ({ layer: t.layer, row: t.row, col: t.col }));
    let removedOne = false;
    for (let l = shape.layers - 1; l >= 0; l--) {
      const lt = subTiles.filter(t => t.layer === l);
      const axis = lt.find(t => mirrorRow(t.row) === t.row);
      if (axis) {
        tiles = tiles.filter(t =>
          !(t.layer === axis.layer && t.row === axis.row && t.col === axis.col)
        );
        removedOne = true;
        break;
      }
    }
    if (!removedOne) {
      let removed = 0;
      for (let l = shape.layers - 1; l >= 0 && removed < 2; l--) {
        const lt = subTiles.filter(t => t.layer === l);
        const nonAxis = lt.find(t => mirrorRow(t.row) !== t.row);
        if (nonAxis) {
          const mr = mirrorRow(nonAxis.row);
          const mirror = lt.find(t => t.row === mr && t.col === nonAxis.col);
          if (mirror) {
            tiles = tiles.filter(t =>
              !(t.layer === nonAxis.layer && t.row === nonAxis.row && t.col === nonAxis.col) &&
              !(t.layer === mirror.layer && t.row === mirror.row && t.col === mirror.col)
            );
            for (let i = subTiles.length - 1; i >= 0; i--) {
              if (subTiles[i].layer === nonAxis.layer && subTiles[i].row === nonAxis.row && subTiles[i].col === nonAxis.col) subTiles.splice(i, 1);
              if (subTiles[i].layer === mirror.layer && subTiles[i].row === mirror.row && subTiles[i].col === mirror.col) subTiles.splice(i, 1);
            }
            removed++;
          }
        }
      }
    }
  }

  tiles.sort((a, b) => a.layer - b.layer || a.row - b.row || a.col - b.col);
  tiles.forEach((t, i) => t.id = i + 1);

  // std：导出示【标准坐标】row=上下(纵)、col=左右(横)。
  // 内部运算用的是 row=横/col=纵，这里把每个牌的值交换后再导出。
  tiles.forEach(t => { const tmp = t.row; t.row = t.col; t.col = tmp; });

  return {
    levelId,
    totalPairs: Math.floor(tiles.length / 2),
    tiles,
    specialTiles: [],
  };
}

// ========== ASCII 预览 ==========
function drawShape(shape, title = '') {
  const { tiles, layers, layerCounts } = shape;
  let out = `═══ ${title} ═══\n`;
  out += `${tiles.length}张 / ${layerCounts.join(' → ')} / ${layers}层 / ${shape.styleName || ''}\n\n`;

  const minRow = -6, maxRow = 7;
  const minCol = -9, maxCol = 9;
  const w = maxRow - minRow + 1, h = maxCol - minCol + 1;
  const grid = Array.from({length: h}, () => Array(w).fill('·'));
  const chars = ['0','1','2','3','4','5','6'];

  for (const t of tiles) {
    const ch = chars[t.layer] || '?';
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const r = t.row + dr - minRow;
        const c = t.col + dc - minCol;
        if (r >= 0 && r < w && c >= 0 && c < h) {
          const cur = grid[c][r];
          const curL = cur === '·' ? -1 : parseInt(cur);
          if (t.layer > curL) grid[c][r] = ch;
        }
      }
    }
  }

  out += '┌' + '─'.repeat(w) + '┐\n';
  for (let c = 0; c < h; c++) {
    out += '│' + grid[c].join('') + '│\n';
  }
  out += '└' + '─'.repeat(w) + '┘\n';

  return out;
}

  // ===== generate_fill =====
// generate_fill_std.js —— 一键「生成布局 + 填花色」直接出成品（std 坐标）
// 用法：node generate_fill_std.js <模板名> [数量] [dark|plain]
//   <模板名>：模板/ 目录下的文件名（不带 .json），如 T2_gong
//   [数量]  ：生成的关数，默认 24（上限 200）
//   [模式]  ：dark=暗牌（默认） / plain=普通（不带暗牌）
//
// 一步到位，不再经过 batch_<TAG> 中间目录：
//   生成随机布局（内存）→ 倒推填花色（100% 可解）→ 直接写成品到 <TAG>_暗/ 或 <TAG>_填色/
// 系列 TAG = 模板名第一段（下划线前）。
// 层数自动判断：纯 L0 底子模板 → 堆 6 层；自带多层模板 → 用模板自己的层数。


// ============ 34 种麻将牌 ============
const NAMES = [];
for (let i = 1; i <= 9; i++) NAMES.push('万' + i);
for (let i = 1; i <= 9; i++) NAMES.push('条' + i);
for (let i = 1; i <= 9; i++) NAMES.push('筒' + i);
['东', '西', '南', '北', '中', '发', '白'].forEach(n => NAMES.push(n));
const TYPE_COUNT = NAMES.length; // 34

// ============ 暗牌参数（可调） ============
const DARK_RATIO_MIN = 0.10; // 每关暗牌数下限 ≈ 总牌 × 10%
const DARK_RATIO_MAX = 0.20; // 每关暗牌数上限 ≈ 总牌 × 20%（每关在区间内随机浮动）
const DARK_WEIGHT = 20;      // 暗钩子难度权重

// ============ 可种子化 RNG (mulberry32) ============
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============ 几何 ============
function covers(a, b) {
  return a.layer > b.layer && Math.abs(a.row - b.row) < 2 && Math.abs(a.col - b.col) < 2;
}

// ============ 倒推填色 ============
// slotPressure: 0~1 槽位压力偏好。越大越倾向配"层高差大"的对(一张早露、一张深埋)，
// 正向玩时玩家被迫把早露那张存进卡槽 -> 槽位占用升高、容错率降低
function backwardFill(tiles, rng, slotPressure) {
  const n = tiles.length;
  const totalPairs = n / 2;
  if (totalPairs !== Math.floor(totalPairs)) throw new Error(`牌数为奇数 ${n}`);
  slotPressure = slotPressure != null ? slotPressure : 0.5;

  const counts = new Array(TYPE_COUNT).fill(0);
  let placedPairs = 0;
  while (placedPairs < totalPairs) {
    const eligible = [];
    for (let t = 0; t < TYPE_COUNT; t++) if (counts[t] < 3) eligible.push(t);
    const t = eligible[Math.floor(rng() * eligible.length)];
    counts[t]++;
    placedPairs++;
  }
  const typePool = [];
  counts.forEach((c, t) => { for (let k = 0; k < c; k++) typePool.push(t + 1); });
  shuffle(typePool, rng);

  const assigned = new Array(n).fill(0);
  const pairsPlaced = [];
  let remaining = tiles.map((t, idx) => ({ ...t, _idx: idx }));

  let guard = 0;
  while (remaining.length > 0) {
    if (++guard > n * 4) return null;
    const clickable = remaining.filter(t => isClickable(t, remaining));
    if (clickable.length < 2) return null;

    const type = typePool[pairsPlaced.length];
    let t1, t2;

    // 叠层配对:倒推前中期(棋盘还满)按概率把一张最高层 + 一张最低层配对
    // 倒推的逆序 = 正向消除序列 -> 早配的对(带高层张)在正向玩时很晚才消,低层那张一直压着
    const progress = pairsPlaced.length / totalPairs;
    const useLayering = slotPressure > 0 && progress < 0.7 && clickable.length >= 4;

    if (useLayering) {
      const sorted = clickable.slice().sort((a, b) => a.layer - b.layer);
      const lowLayer = sorted[0].layer;
      const highLayer = sorted[sorted.length - 1].layer;
      if (highLayer - lowLayer >= 2 && rng() < slotPressure) {
        const topCandidates = sorted.filter(t => t.layer === highLayer);
        const bottomCandidates = sorted.filter(t => t.layer === lowLayer);
        shuffle(topCandidates, rng);
        t1 = topCandidates[0];
        t2 = bottomCandidates.find(c => c._idx !== t1._idx);
        if (!t2) t1 = null;
      }
    }

    if (!t1 || !t2) {
      shuffle(clickable, rng);
      t1 = clickable[0];
      t2 = clickable[1];
    }

    assigned[t1._idx] = type;
    assigned[t2._idx] = type;
    pairsPlaced.push([t1._idx, t2._idx]);
    remaining = remaining.filter(t => t !== t1 && t !== t2);
  }
  return { assigned, pairsPlaced };
}

// ============ 校验 ============
function verifyByElimination(tiles, pairsPlaced) {
  const remaining = new Map(tiles.map(t => [t.id, t]));
  for (let k = 0; k < pairsPlaced.length; k++) {
    const id1 = tiles[pairsPlaced[k][0]].id;
    const id2 = tiles[pairsPlaced[k][1]].id;
    const t1 = remaining.get(id1);
    const t2 = remaining.get(id2);
    if (!t1 || !t2) return { ok: false, reason: `牌 ${id1}/${id2} 已不在场` };
    if (t1.typeId !== t2.typeId) return { ok: false, reason: `type 不同` };
    const all = [...remaining.values()];
    if (!isClickable(t1, all) || !isClickable(t2, all)) {
      return { ok: false, reason: `牌 ${id1}/${id2} 该步不可点` };
    }
    remaining.delete(id1);
    remaining.delete(id2);
  }
  return { ok: remaining.size === 0 };
}

// 游戏规则：被更高层压住不可点；被同层左右夹住不可点
// std 坐标：row=上下(纵)，col=左右(横)。左右夹住 = 同列(col 相等)、row 相同、col±2。
function isClickable(tile, all) {
  if (all.some(o => o !== tile && o.layer > tile.layer &&
      Math.abs(o.row - tile.row) < 2 && Math.abs(o.col - tile.col) < 2)) return false;
  const same = all.filter(t => t.layer === tile.layer && t !== tile);
  const hasL = same.some(t => t.col === tile.col - 2 && t.row === tile.row);
  const hasR = same.some(t => t.col === tile.col + 2 && t.row === tile.row);
  return !(hasL && hasR);
}

// ============ 暗牌分配 ============
// options: { coverageRate: 0~1 (深埋对子覆盖率), totalCount: 暗牌总数上限(不含 null/undefined=纯钩子模式,不补随机) }
function assignDarkTiles(tiles, rng, options) {
  options = options || {};
  const coverageRate = options.coverageRate != null ? options.coverageRate : 1; // 默认全覆盖
  const totalCount = options.totalCount; // undefined = 纯钩子模式
  const byType = {};
  tiles.forEach((t, i) => { (byType[t.typeId] ||= []).push({ t, i }); });
  const darkIdx = [];
  const marked = new Set();
  // 阶段一:用新钩子定义收集所有"对中有一张被埋"的对子
  const buriedPairs = [];
  for (const k in byType) {
    const arr = byType[k];
    if (arr.length < 2) continue;
    const pairs = Math.floor(arr.length / 2);
    // 找出该花色中被埋的牌(用新定义 isTileBuried)
    const buriedInType = arr.filter(x => isTileBuried(x.t, tiles));
    // 每对中有一张被埋就算埋对,埋对最多 pairs 个
    const pairCount = Math.min(buriedInType.length, pairs);
    for (let p = 0; p < pairCount; p++) {
      buriedPairs.push(arr);
    }
  }
  shuffle(buriedPairs, rng);
  const hookTarget = Math.round(buriedPairs.length * coverageRate);
  for (let p = 0; p < hookTarget && p < buriedPairs.length; p++) {
    const arr = buriedPairs[p];
    // 找该花色中第一个被埋的牌作为暗牌
    const buried = arr.find(x => isTileBuried(x.t, tiles));
    if (buried && !marked.has(buried.i)) { darkIdx.push(buried.i); marked.add(buried.i); }
  }
  // 阶段二:补随机暗牌(纯钩子模式时跳过)
  if (totalCount != null) {
    const candidates = tiles.map((_, i) => i).filter(i => !marked.has(i));
    shuffle(candidates, rng);
    for (const i of candidates) {
      if (darkIdx.length >= totalCount) break;
      darkIdx.push(i); marked.add(i);
    }
  }
  return darkIdx;
}

// ============ 难度评估（含暗钩子权重 + 钩子稀缺度） ============
// 判断单张牌是否被埋:任意埋法(上压 / 左右夹)都算
function isTileBuried(tile, allTiles) {
  // 1. 同层被压:有上层牌覆盖
  const hasUpper = allTiles.some(other =>
    other.id !== tile.id &&
    other.layer > tile.layer &&
    Math.abs(other.row - tile.row) < 2 &&
    Math.abs(other.col - tile.col) < 2
  );
  if (hasUpper) return true;
  // 2. 左右夹:同层左右都被夹住,row 范围匹配(与 isClickable 一致)
  const sameLayer = allTiles.filter(t => t.layer === tile.layer && t.id !== tile.id);
  const hasLeft = sameLayer.some(t => t.col === tile.col - 2 && Math.abs(t.row - tile.row) < 2);
  const hasRight = sameLayer.some(t => t.col === tile.col + 2 && Math.abs(t.row - tile.row) < 2);
  return hasLeft && hasRight;
}

function evaluateDifficulty(level, darkIds = new Set(), darkWeight = DARK_WEIGHT) {
  const tiles = level.tiles;
  const total = tiles.length;
  const clickableSet = new Set(tiles.filter(t => isClickable(t, tiles)).map(t => t.id));
  const clickRatio = clickableSet.size / total;
  const maxLayer = Math.max(...tiles.map(t => t.layer));
  const byType = {};
  tiles.forEach(t => { (byType[t.typeId] ||= []).push(t); });

  let hooks = 0, darkHooks = 0;           // 原始钩子数（显示/目标匹配用）
  let effHooks = 0, effDarkHooks = 0;     // 可见伴侣加权钩子数（计分用）

  for (const k in byType) {
    const arr = byType[k];
    const pairs = Math.floor(arr.length / 2);
    if (pairs < 1) continue;
    // 新定义:一对里**两张都埋**才算钩子。一张见一张埋的不算(玩家看到那张就能联想到同色另一张)
    const buriedList = arr.filter(t => isTileBuried(t, tiles));
    const visibleCount = arr.length - buriedList.length;
    // 双埋对子数 = floor(埋的张数 / 2),上限不超过 pairs
    const doubleBuriedPairs = Math.floor(buriedList.length / 2);
    const hookInst = Math.min(doubleBuriedPairs, pairs);
    const buriedDarkList = buriedList.filter(t => darkIds.has(t.id));
    const doubleBuriedDarkPairs = Math.floor(buriedDarkList.length / 2);
    const darkHookInst = Math.min(doubleBuriedDarkPairs, pairs);
    hooks += hookInst;
    darkHooks += darkHookInst;
    // 加权:每个钩子对子的权重 = 1 / (同花色可见张数 + 1)
    // 同色可见越多 → 越容易找到伴侣 → 权重越低
    const w = 1 / (visibleCount + 1);
    effHooks += hookInst * w;
    effDarkHooks += darkHookInst * w;
  }

  const totalPairs = Math.floor(total / 2);
  // 槽位压力:最优打法下卡槽最多同时占几个花色位
  const slotsResult = computeMinSlots(tiles);
  const minSlots = slotsResult.minSlots;
  // 槽位压力项:2 槽起 0 分,每 +1 槽 +7.5 分,6 槽拿满 30 分
  const slotTerm = Math.min(Math.max(0, minSlots - 2) / 4, 1) * 30;
  // 封顶调整:5 → 8,让钩子数拉开分数差距
  const darkHookTerm = Math.min(effDarkHooks / 8, 1) * darkWeight;
  const score = Math.round(
    (1 - clickRatio) * 40 + maxLayer * 8 +
    Math.min(effHooks / 8, 1) * 30 + darkHookTerm + slotTerm + 10
  );
  return {
    score: Math.max(0, score),
    clickRatio: +clickRatio.toFixed(3),
    clickable: clickableSet.size, total, maxLayer,
    typeCount: Object.keys(byType).length,
    hooks, darkHooks,
    effHooks: +effHooks.toFixed(2),
    effDarkHooks: +effDarkHooks.toFixed(2),
    totalPairs,
    hookDensity: totalPairs ? +(hooks / totalPairs).toFixed(3) : 0,
    darkHookDensity: totalPairs ? +(darkHooks / totalPairs).toFixed(3) : 0,
    minSlots,
    slotSolvable: slotsResult.solvable,
  };
}

// ============ 最小槽位需求 ============
// 模拟一个聪明玩家的打法,统计卡槽中最大同时存在的花色数。
// 这个值越接近 7(卡槽上限),容错率越低 -- 顺序走错一步就容易把槽堆满。
// 模型:
//   board = 场上未点的牌;slot = 已进槽未配对的牌
//   1. 场上有可点的牌,其花色槽里已有 -> 点它配掉槽里那张(槽位 -1)
//   2. 场上有两张可点同花色 -> 点掉(短暂过槽即消,不计峰值)
//   3. 只能点单张 -> 选"底下压牌最多"的进槽(尽早解锁),槽位 +1
// 每次单张进槽后记录 slot.size 峰值。
// 返回 { minSlots, solvable } -- solvable=false 表示贪心走到死局(不代表关卡无解,但说明需要精确顺序)
function computeMinSlots(tiles) {
  const board = new Set(tiles.map(t => t.id));
  const tileMap = new Map(tiles.map(t => [t.id, t]));
  const slot = new Map(); // typeId -> tile(该花色槽里那张)
  let maxSlots = 0;
  let guard = 0;

  while (board.size > 0 || slot.size > 0) {
    if (++guard > tiles.length * 2 + 10) return { minSlots: 7, solvable: false };
    if (board.size === 0) break; // 槽里还有单张 = 死局(配不掉了)
    const all = tiles.filter(t => board.has(t.id));
    const clickable = all.filter(t => isClickable(t, all));
    if (clickable.length === 0) return { minSlots: 7, solvable: false };

    // 优先级 1:可点牌的花色在槽里 -> 立即配对
    let done = false;
    for (const t of clickable) {
      if (slot.has(t.typeId)) {
        slot.delete(t.typeId);
        board.delete(t.id);
        done = true;
        break;
      }
    }
    if (done) continue;

    // 优先级 2:两张可点同花色 -> 消掉
    const byType = {};
    clickable.forEach(t => { (byType[t.typeId] ||= []).push(t); });
    let pair = null;
    for (const typeId in byType) {
      if (byType[typeId].length >= 2) { pair = byType[typeId].slice(0, 2); break; }
    }
    if (pair) {
      board.delete(pair[0].id);
      board.delete(pair[1].id);
      continue;
    }

    // 优先级 3:只能点单张 -> 选底下压牌最多的进槽
    let bestTile = null, bestUnder = -1;
    for (const t of clickable) {
      let under = 0;
      for (const o of tiles) {
        if (o.id === t.id || !board.has(o.id)) continue;
        if (covers(t, o)) under++;
      }
      if (under > bestUnder) { bestUnder = under; bestTile = t; }
    }
    board.delete(bestTile.id);
    slot.set(bestTile.typeId, bestTile);
    maxSlots = Math.max(maxSlots, slot.size);
  }
  return { minSlots: Math.max(1, maxSlots), solvable: true };
}
  // ========= 高层辅助 =========
  function fillEditorShape(editorTiles, editorSpecial, options) {
    options = options || {};
    const darkMode = options.darkMode !== false;
    const darkCoverage = options.darkCoverage != null ? options.darkCoverage : 1;
    const darkRatio = options.darkRatio;
    const darkWeight = options.darkWeight != null ? options.darkWeight : DARK_WEIGHT;
    const slotPressure = options.slotPressure != null ? options.slotPressure : 0.5;
    // ===== 填色前校验（吐牌机相关）=====
    const spitterTilesAll = editorTiles.filter(function (t) { return t.type === 'spitter'; });
    // 队列牌由生成器自动生成（用户不画），所以 editorTiles 里没有队列牌
    const normalCount = editorTiles.length - spitterTilesAll.length;
    // count = 队列牌数量（全部都是吐牌机吐出的牌，初始显示第一张）
    const totalQueueTiles = spitterTilesAll.reduce(function (s, sp) { return s + (sp.count || 0); }, 0);
    // 校验：spitter count 合理性
    for (const sp of spitterTilesAll) {
      if (!sp.count || sp.count < 1 || sp.count > 8) {
        throw new Error('吐牌机 count=' + sp.count + ' 不合理(应为 1~8)');
      }
    }
    // 关键校验：fillTiles = normalCount + totalQueueTiles 必须偶数
    if ((normalCount + totalQueueTiles) % 2 !== 0) {
      throw new Error('吐牌机配置错误：普通牌(' + normalCount + ') + 队列牌(' + totalQueueTiles + ') = ' + (normalCount + totalQueueTiles) + ' 为奇数，无法配对。请调整普通牌数量或吐牌机 count');
    }
    const tiles = editorTiles.map(function (t, i) { return Object.assign({}, t, { _idx: i }); });
    const editorDarkIdx = [];
    const marked = new Set();
    (editorSpecial || []).forEach(function (s) {
      if (s.type === 'dark') {
        const i = tiles.findIndex(function (t) { return t.layer === s.layer && t.row === s.row && t.col === s.col; });
        if (i >= 0 && !marked.has(i)) { editorDarkIdx.push(i); marked.add(i); }
      }
    });
    // ===== 校验 target 位置支撑 =====
    // L1+ 的吐牌机：指向的位置必须有支撑（下方有下层牌托住），否则生成报错
    // L0 的吐牌机：target 在底层，地面就是支撑，无需校验
    for (const sp of spitterTilesAll) {
      if (sp.layer === 0) continue; // L0 无需检查支撑
      const targetRow = sp.row + ({up:-2,down:2,left:0,right:0}[sp.dir] || 0);
      const targetCol = sp.col + ({up:0,down:0,left:-2,right:2}[sp.dir] || 0);
      // 检查 target 位置在 sp.layer 层是否有支撑（象限规则：下方要有下层牌）
      const lowerTiles = editorTiles.filter(t => t.layer < sp.layer);
      if (!hasSupport(targetRow, targetCol, lowerTiles)) {
        throw new Error('吐牌机 [L' + sp.layer + ',' + sp.row + ',' + sp.col + '] 指向位置 (' + targetRow + ',' + targetCol + ') 无支撑：下方缺少下层牌托住。请在指向位置下方加牌，或调整吐牌机方向/位置');
      }
    }
    // ===== 在 backwardFill 之前生成队列牌（typeId = null，由 backwardFill 分配）=====
    // count = 队列牌数量（全部都是吐牌机吐出的牌）
    // 吐牌机机制：初始显示第一张（spitterOrder=1），点一张吐一张
    // 所有队列牌放在同一层（与 target 同层），demo 根据 spitterReleasedCount 决定显示哪张
    for (const sp of spitterTilesAll) {
      const targetRow = sp.row + ({up:-2,down:2,left:0,right:0}[sp.dir] || 0);
      const targetCol = sp.col + ({up:0,down:0,left:-2,right:2}[sp.dir] || 0);
      const queueCount = sp.count; // count = 队列牌数量
      for (let i = 1; i <= queueCount; i++) {
        tiles.push({
          id: 0,
          layer: sp.layer, // 与 target 同层（不叠放，一次只显示一张）
          row: targetRow,
          col: targetCol,
          typeId: null,
          spitterOrder: i,
        });
      }
    }

    // 吐牌机本体不参与填色（不是麻将）
    const spitterIdxSet = new Set();
    tiles.forEach((t, i) => {
      if (t.type === 'spitter') spitterIdxSet.add(i);
    });
    // fillTiles 包含：普通牌、target 位置的牌、占位牌、队列牌
    // 排除：吐牌机本体
    const fillTiles = tiles.filter(function (t, i) {
      return !spitterIdxSet.has(i);
    });

    // fillTiles 偶数校验（backwardFill 要求）
    if (fillTiles.length % 2 !== 0) {
      throw new Error('总可消除牌数 ' + fillTiles.length + ' 为奇数，无法配对。请调整普通牌数量或吐牌机 count（普通牌 + 队列牌 必须为偶数）');
    }

    let result = null;
    const startSeed = Math.floor(Math.random() * 1000) + 1;
    for (let seed = startSeed; seed <= startSeed + 100 && !result; seed++) {
      result = backwardFill(fillTiles, makeRng(seed * 9301 + 49297), slotPressure);
    }
    if (!result) throw new Error('fill failed after 100 retries');

    // 把填色结果写回非 spitter 的牌（包括普通牌、target 牌、队列牌）
    let fillIdx = 0;
    tiles.forEach(function (t, i) {
      if (spitterIdxSet.has(i)) return;
      if (result.assigned[fillIdx] !== undefined) t.typeId = result.assigned[fillIdx];
      fillIdx++;
    });

    // ===== 校验 =====
    // 1. 队列牌必须有支撑(不能悬空)——L0 除外（地面就是支撑）
    const queueTiles = tiles.filter(function (t) { return t.spitterOrder != null; });
    for (const st of queueTiles) {
      if (st.layer === 0) continue; // L0 无需检查支撑
      if (!hasSupport(st.row, st.col, tiles.filter(function (t) { return t !== st && t.layer < st.layer; }))) {
        throw new Error(`吐牌机队列牌 [L${st.layer},${st.row},${st.col}] 悬空无支撑`);
      }
    }
    // 2. 总可消除牌 = fillTiles + spitter.count,必须偶数(已在前面校验 totalElimination,这里不需要重复)

    let darkIdx = editorDarkIdx.slice();
    if (darkMode) {
      const darkRng = makeRng(99999);
      const darkOpts = { coverageRate: darkCoverage };
      if (darkRatio != null) darkOpts.totalCount = Math.max(1, Math.round(tiles.length * darkRatio));
      assignDarkTiles(tiles, darkRng, darkOpts).forEach(function (i) {
        if (!marked.has(i)) { darkIdx.push(i); marked.add(i); }
      });
    }
    const darkSet = new Set(darkIdx);
    tiles.sort(function (a, b) { return a.layer - b.layer || a.row - b.row || a.col - b.col; });
    tiles.forEach(function (t, i) { t.id = i + 1; });
    const finalTiles = tiles.map(function (t) {
      const o = Object.assign({}, t); delete o._idx;
      o.isDark = darkSet.has(t._idx);
      return o;
    });
    const specialTiles = finalTiles.filter(function (t) { return t.isDark; })
      .map(function (t) { return { id: t.id, type: 'dark', layer: t.layer, row: t.row, col: t.col }; });
    const darkIds = new Set(finalTiles.filter(function (t) { return t.isDark; }).map(function (t) { return t.id; }));
    const diff = evaluateDifficulty({ tiles: finalTiles }, darkIds, darkWeight);
    return { levelId: 1, totalPairs: Math.floor(finalTiles.length / 2), tiles: finalTiles, specialTiles: specialTiles, _difficulty: diff };
  }

  function generateAndFill(options) {
    options = options || {};
    const darkMode = options.darkMode !== false;
    const darkCoverage = options.darkCoverage != null ? options.darkCoverage : 1;
    const darkRatio = options.darkRatio;
    const darkWeight = options.darkWeight != null ? options.darkWeight : DARK_WEIGHT;
    const slotPressure = options.slotPressure != null ? options.slotPressure : 0.5;
    const layerMap = {};
    TEMPLATE_T2_GONG.tiles.forEach(function (t) {
      (layerMap[t.layer] = layerMap[t.layer] || []).push({ row: t.col, col: t.row });
    });
    const layerNums = Object.keys(layerMap).map(Number).sort(function (a, b) { return a - b; });
    const template = { layers: layerNums.map(function (l) { return { layer: l, cells: layerMap[l] }; }), layerCount: layerNums.length };
    const layers = template.layerCount === 1 ? 6 : template.layerCount;
    const shape = generateFromTemplate(template, { layerCount: layers });
    const v = validateShape(shape);
    if (!v.ok) throw new Error('validate failed: ' + v.errors.slice(0, 2).join('; '));
    const level = toEditorJSON(shape, 1);
    let result = null;
    const startSeed = Math.floor(Math.random() * 1000) + 1;
    for (let seed = startSeed; seed <= startSeed + 100 && !result; seed++) {
      result = backwardFill(level.tiles, makeRng(seed * 1000 + 42), slotPressure);
    }
    if (!result) throw new Error('fill failed');
    const filled = {
      levelId: level.levelId, totalPairs: level.totalPairs,
      tiles: level.tiles.map(function (t, j) { return Object.assign({}, t, { typeId: result.assigned[j] }); }),
      specialTiles: []
    };
    if (darkMode) {
      const darkRng = makeRng(7777);
      const darkOpts = { coverageRate: darkCoverage };
      if (darkRatio != null) darkOpts.totalCount = Math.max(1, Math.round(filled.tiles.length * darkRatio));
      const darkIdx = assignDarkTiles(filled.tiles, darkRng, darkOpts);
      const dSet = new Set(darkIdx);
      const special = [];
      darkIdx.forEach(function (j) {
        filled.tiles[j].isDark = true;
        special.push({ id: filled.tiles[j].id, type: 'dark', layer: filled.tiles[j].layer, row: filled.tiles[j].row, col: filled.tiles[j].col });
      });
      filled.tiles = filled.tiles.map(function (t, j) { return Object.assign({}, t, { isDark: dSet.has(j) }); });
      filled.specialTiles = special;
    } else {
      filled.tiles = filled.tiles.map(function (t) { return Object.assign({}, t, { isDark: false }); });
    }
    const darkIds = new Set((filled.specialTiles || []).map(function (s) { return s.id; }));
    const diff = evaluateDifficulty(filled, darkIds, darkWeight);
    filled._difficulty = diff;
    return filled;
  }

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  // ===== 堆塔生成：以用户画的形状为底，自动往上堆层 + 填色 =====
  function generateStackFromShape(editorTiles, options) {
    options = options || {};
    const darkMode = options.darkMode !== false;
    const darkCoverage = options.darkCoverage != null ? options.darkCoverage : 1;
    const darkRatio = options.darkRatio;
    const darkWeight = options.darkWeight != null ? options.darkWeight : DARK_WEIGHT;
    const layerCount = options.layerCount || 5;
    const slotPressure = options.slotPressure != null ? options.slotPressure : 0.5;
    // 吐牌机信息（从 editor 传过来）
    const editorSpitters = options.spitters || []; // [{ targetLayer, targetRow, targetCol, count }]
    const editorQueueTiles = options.queueTiles || []; // [{ layer, row, col, spitterOrder }]
    // 编辑器形状是 std（row=纵/col=横），生成器内部用 row=横/col=纵 → swap
    const layerMap = {};
    editorTiles.forEach(function (t) {
      (layerMap[t.layer] = layerMap[t.layer] || []).push({ row: t.col, col: t.row });
    });
    const layerNums = Object.keys(layerMap).map(Number).sort(function (a, b) { return a - b; });
    if (layerNums.length === 0) throw new Error('空形状');
    // ===== 底座校验（含吐牌机）=====
    const editorSpitterCount = editorTiles.filter(function (t) { return t.type === 'spitter'; }).length;
    const editorNormalCount = editorTiles.length - editorSpitterCount;
    // 校验 spitter count 合理性
    for (const sp of editorSpitters) {
      if (!sp.count || sp.count < 1 || sp.count > 8) {
        throw new Error('吐牌机 count=' + sp.count + ' 不合理(应为 1~8)');
      }
    }
    // count = 队列牌数量（全部都是吐牌机吐出的牌）
    const totalQueueTiles = editorSpitters.reduce(function (s, sp) { return s + (sp.count || 0); }, 0);
    // ===== 校验 target 位置支撑 =====
    // L1+ 的吐牌机：指向的位置必须有支撑（下方有下层牌托住），否则生成报错
    // L0 的吐牌机：target 在底层，地面就是支撑，无需校验
    for (const sp of editorSpitters) {
      if (sp.layer === 0) continue; // L0 无需检查支撑
      const targetRow = sp.row + ({up:-2,down:2,left:0,right:0}[sp.dir] || 0);
      const targetCol = sp.col + ({up:0,down:0,left:-2,right:2}[sp.dir] || 0);
      const lowerTiles = editorTiles.filter(t => t.layer < sp.layer);
      if (!hasSupport(targetRow, targetCol, lowerTiles)) {
        throw new Error('吐牌机 [L' + sp.layer + ',' + sp.row + ',' + sp.col + '] 指向位置 (' + targetRow + ',' + targetCol + ') 无支撑：下方缺少下层牌托住。请在指向位置下方加牌，或调整吐牌机方向/位置');
      }
    }
    // 关键校验：fillTiles = level.tiles + queueTiles 必须偶数
    // level.tiles 总是偶数（toEditorJSON 会删一张凑偶）
    // 所以 totalQueueTiles 必须偶数
    if (totalQueueTiles % 2 !== 0) {
      throw new Error('吐牌机配置错误：队列牌总数(' + totalQueueTiles + ') 为奇数，无法配对。请调整吐牌机 count');
    }
    const template = { layers: layerNums.map(function (l) { return { layer: l, cells: layerMap[l] }; }), layerCount: layerNums.length };
    // 检测底座是否左右对称（std 坐标：每个 (layer,row,col) 都要有 (layer,row,-col)）
    // 对称底座 → 正常镜像堆塔；不对称底座 → 关掉镜像展开、跳过对称校验，按实际形状堆
    const symSet = new Set();
    editorTiles.forEach(function (t) { symSet.add(t.layer + ',' + t.row + ',' + t.col); });
    const baseSymmetric = editorTiles.every(function (t) { return symSet.has(t.layer + ',' + t.row + ',' + (-t.col)); });
    const mirror = baseSymmetric;
    // 搭塔+填色:塔形可能不可解,需要重搭新塔形(而非同一死形重试)
    let filled = null;
    for (let attempt = 0; attempt < 30 && !filled; attempt++) {
      const shape = generateFromTemplate(template, { layerCount: layerCount, mirror: mirror });
      const v = validateShape(shape, { skipSymmetry: !mirror });
      if (!v.ok) continue; // 校验不过就重搭
      const level = toEditorJSON(shape, 1);
      // 把编辑器的吐牌机队列牌和吐牌机标记加到 stacked 结果中
      const editorSpitters = options.spitters || [];
      // 堆塔路径:spitter 本体不参与填色(保持 typeId=null,不是麻将)
      const levelSpitterIdxSet = new Set();
      level.tiles.forEach((t, i) => { if (t.type === 'spitter') levelSpitterIdxSet.add(i); });

      // ===== 在 backwardFill 之前生成队列牌和支撑牌（typeId = null，由 backwardFill 分配）=====
      // count 包含初始牌，队列牌数量 = count - 1
      // 队列牌堆叠在 target 位置上方，与普通牌视觉叠放一致
      // layer 排序：spitterOrder=1（layer 最低，紧贴 target）→ spitterOrder=count-1（layer 最高，最上面先点）
      const queueTiles = [];
      for (const sp of editorSpitters) {
        const targetRow = sp.row + ({up:-2,down:2,left:0,right:0}[sp.dir] || 0);
        const targetCol = sp.col + ({up:0,down:0,left:-2,right:2}[sp.dir] || 0);
        // 生成 count 张队列牌（count = 队列牌数量）
        // 吐牌机机制：初始显示第一张，点一张吐一张
        // 所有队列牌放在同一层（与 target 同层）
        const queueCount = sp.count;
        for (let i = 1; i <= queueCount; i++) {
          queueTiles.push({
            id: 0,
            layer: sp.layer, // 与 target 同层（不叠放，一次只显示一张）
            row: targetRow,
            col: targetCol,
            typeId: null,
            spitterOrder: i,
          });
        }
      }

      // fillTiles 包含：普通牌 + 队列牌（排除吐牌机本体）
      const fillTiles = level.tiles.filter((t, i) => !levelSpitterIdxSet.has(i)).concat(queueTiles);

      // fillTiles 偶数校验（backwardFill 要求）
      if (fillTiles.length % 2 !== 0) {
        // 奇偶不匹配，跳过此 attempt
        continue;
      }

      // 填色
      const startSeed = Math.floor(Math.random() * 1000) + 1;
      for (let seed = startSeed; seed <= startSeed + 50 && !filled; seed++) {
        const result = backwardFill(fillTiles, makeRng(seed * 1000 + 42), slotPressure);
        if (result) {
          // 把填色结果写回（跳过吐牌机）
          let fillIdx = 0;
          const assignedTiles = level.tiles.map((t, i) => {
            if (levelSpitterIdxSet.has(i)) return Object.assign({}, t, { typeId: null });
            const newT = Object.assign({}, t, { typeId: result.assigned[fillIdx] });
            fillIdx++;
            return newT;
          });
          // 把填色结果写回队列牌
          queueTiles.forEach(function (qt) {
            qt.typeId = result.assigned[fillIdx];
            fillIdx++;
          });

          // 先 push spitter 本体（不参与填色，typeId=null）
          editorSpitters.forEach(function (sp) {
            assignedTiles.push({
              id: 0, layer: sp.layer, row: sp.row, col: sp.col,
              typeId: null, type: 'spitter', dir: sp.dir, count: sp.count,
            });
          });
          // 再 push 队列牌
          queueTiles.forEach(function (qt) { assignedTiles.push(qt); });

          // 重新分配 id
          assignedTiles.forEach((t, i) => { t.id = i + 1; });
          filled = {
            levelId: level.levelId, totalPairs: level.totalPairs,
            tiles: assignedTiles,
            specialTiles: [] // spitter 标记在 level.tiles 里通过 type 字段标识
          };
        }
      }
    }
    if (!filled) throw new Error('堆塔后无法完成填色(底座形状可能导致无解,试试调整底座形状或减少堆层数)');

    // 吐牌机验证（L0 除外，地面就是支撑）
    const spitterTiles = filled.tiles.filter(t => t.spitterOrder != null);
    for (const st of spitterTiles) {
      if (st.layer === 0) continue; // L0 无需检查支撑
      if (!hasSupport(st.row, st.col, filled.tiles.filter(t => t !== st && t.layer < st.layer))) {
        throw new Error(`吐牌机队列牌 [L${st.layer},${st.row},${st.col}] 悬空无支撑`);
      }
    }
    // 总牌数校验：凑偶后 shape.tiles 必为偶数(targetParity 与队列总数一致),且 +1 spitter 本体 + queueCount → 偶数
    // 上面的循环已保证 shape.tiles.length % 2 === totalQueueCount % 2
    // 所以总牌数 = shape.tiles.length + 1(spitter) + totalQueueCount,奇偶性 = 偶 ✓
    // (堆塔路径不再额外校验)

    // 暗牌
    if (darkMode) {
      const darkRng = makeRng(7777);
      const darkOpts = { coverageRate: darkCoverage };
      if (darkRatio != null) darkOpts.totalCount = Math.max(1, Math.round(filled.tiles.length * darkRatio));
      const darkIdx = assignDarkTiles(filled.tiles, darkRng, darkOpts);
      const dSet = new Set(darkIdx);
      const special = [];
      darkIdx.forEach(function (j) {
        filled.tiles[j].isDark = true;
        special.push({ id: filled.tiles[j].id, type: 'dark', layer: filled.tiles[j].layer, row: filled.tiles[j].row, col: filled.tiles[j].col });
      });
      filled.tiles = filled.tiles.map(function (t, j) { return Object.assign({}, t, { isDark: dSet.has(j) }); });
      filled.specialTiles = special;
    } else {
      filled.tiles = filled.tiles.map(function (t) { return Object.assign({}, t, { isDark: false }); });
    }
    const darkIds = new Set((filled.specialTiles || []).map(function (s) { return s.id; }));
    const diff = evaluateDifficulty(filled, darkIds, darkWeight);
    filled._difficulty = diff;
    return filled;
  }

  global.GEN = {
    TEMPLATE_T2_GONG: TEMPLATE_T2_GONG,
    loadTemplate: loadTemplate, generateFromTemplate: generateFromTemplate, validateShape: validateShape, toEditorJSON: toEditorJSON, drawShape: drawShape,
    keyOf: keyOf, mirrorRow: mirrorRow, inBounds: inBounds, hasSupport: hasSupport, quadCovered: quadCovered,
    NAMES: NAMES, DARK_RATIO_MIN: DARK_RATIO_MIN, DARK_RATIO_MAX: DARK_RATIO_MAX, DARK_WEIGHT: DARK_WEIGHT,
    makeRng: makeRng, shuffle: shuffle, covers: covers, isClickable: isClickable,
    backwardFill: backwardFill, verifyByElimination: verifyByElimination, assignDarkTiles: assignDarkTiles, evaluateDifficulty: evaluateDifficulty,
    fillEditorShape: fillEditorShape, generateAndFill: generateAndFill, generateStackFromShape: generateStackFromShape, downloadJSON: downloadJSON,
  };
})(typeof window !== 'undefined' ? window : globalThis);
