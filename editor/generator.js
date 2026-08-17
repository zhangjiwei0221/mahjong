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

  // 始终重新生成 L1+（即使模板有 L1+）
  // 第一层（底层）使用模板的 L0
  const newLayers = [{ layer: 0, cells: [...template.layers[0].cells] }];

  for (let l = 1; l < generateLayerCount; l++) {
    const lowerArr = newLayers[l - 1].cells;
    const lowerKeys = new Set(lowerArr.map(c => keyOf(c.row, c.col)));
    const count = calcCount(l, generateLayerCount);
    // L1 用 ordered 有序密排（互锁骨架，喂饱上层）；L2+ 用 random 随机有机
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

  // 同层冲突
  layerNums.forEach(l => {
    const arr = byLayer[l];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].row < arr[j].row + 2 && arr[i].row + 2 > arr[j].row &&
            arr[i].col < arr[j].col + 2 && arr[i].col + 2 > arr[j].col) {
          errors.push(`[冲突] L${l}`);
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
function backwardFill(tiles, rng) {
  const n = tiles.length;
  const totalPairs = n / 2;
  if (totalPairs !== Math.floor(totalPairs)) throw new Error(`牌数为奇数 ${n}`);

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
    shuffle(clickable, rng);
    const t1 = clickable[0], t2 = clickable[1];
    const type = typePool[pairsPlaced.length];
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
  // 阶段一:收集所有深埋对子,按覆盖率挑(随机)
  const buriedPairs = [];
  for (const k in byType) {
    const arr = byType[k];
    if (arr.length === 2 && Math.abs(arr[0].t.layer - arr[1].t.layer) >= 2) {
      buriedPairs.push(arr);
    }
  }
  shuffle(buriedPairs, rng);
  const hookTarget = Math.round(buriedPairs.length * coverageRate);
  for (let p = 0; p < hookTarget && p < buriedPairs.length; p++) {
    const arr = buriedPairs[p];
    const buried = arr[0].t.layer >= arr[1].t.layer ? arr[0] : arr[1];
    if (!marked.has(buried.i)) { darkIdx.push(buried.i); marked.add(buried.i); }
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
function evaluateDifficulty(level, darkIds = new Set(), darkWeight = DARK_WEIGHT) {
  const tiles = level.tiles;
  const total = tiles.length;
  const clickable = tiles.filter(t => isClickable(t, tiles)).length;
  const clickRatio = clickable / total;
  const maxLayer = Math.max(...tiles.map(t => t.layer));
  const byType = {};
  tiles.forEach(t => { (byType[t.typeId] ||= []).push(t); });

  let hooks = 0, darkHooks = 0;           // 原始钩子数（显示/目标匹配用）
  let effHooks = 0, effDarkHooks = 0;     // 稀缺度加权钩子数（计分用）

  for (const k in byType) {
    const arr = byType[k];
    const pairs = Math.floor(arr.length / 2);
    if (pairs < 1) continue;
    // 按层排序，找出被深埋的牌（层差 >= 2）
    arr.sort((a, b) => a.layer - b.layer);
    const topLayer = arr[0].layer;
    let buried = 0, buriedDark = 0;
    for (const t of arr) {
      if (t.layer - topLayer >= 2) {
        buried++;
        if (darkIds.has(t.id)) buriedDark++;
      }
    }
    // 钩子实例数 = min(被埋牌, 对子数)，不能超过对子数
    const hookInst = Math.min(buried, pairs);
    const darkHookInst = Math.min(buriedDark, pairs);
    hooks += hookInst;
    darkHooks += darkHookInst;
    // 稀缺度加权：每个钩子权重 = 1 / 该花色对子数
    // 整副牌只有这一对 = 1.0（满难度），有 3 对 = 0.33
    effHooks += hookInst / pairs;
    effDarkHooks += darkHookInst / pairs;
  }

  const totalPairs = Math.floor(total / 2);
  // 计分使用稀缺度加权后的有效钩子数
  const darkHookTerm = Math.min(effDarkHooks / 5, 1) * darkWeight;
  const score = Math.round(
    (1 - clickRatio) * 40 + maxLayer * 8 +
    Math.min(effHooks / 5, 1) * 30 + darkHookTerm + 10
  );
  return {
    score: Math.max(0, score),
    clickRatio: +clickRatio.toFixed(3),
    clickable, total, maxLayer,
    typeCount: Object.keys(byType).length,
    hooks, darkHooks,
    effHooks: +effHooks.toFixed(2),
    effDarkHooks: +effDarkHooks.toFixed(2),
    totalPairs,
    hookDensity: totalPairs ? +(hooks / totalPairs).toFixed(3) : 0,
    darkHookDensity: totalPairs ? +(darkHooks / totalPairs).toFixed(3) : 0,
  };
}
  // ========= 高层辅助 =========
  function fillEditorShape(editorTiles, editorSpecial, options) {
    options = options || {};
    const darkMode = options.darkMode !== false;
    const darkCoverage = options.darkCoverage != null ? options.darkCoverage : 1;
    const darkRatio = options.darkRatio;
    const darkWeight = options.darkWeight != null ? options.darkWeight : DARK_WEIGHT;
    const tiles = editorTiles.map(function (t, i) { return Object.assign({}, t, { _idx: i }); });
    const editorDarkIdx = [];
    const marked = new Set();
    (editorSpecial || []).forEach(function (s) {
      if (s.type === 'dark') {
        const i = tiles.findIndex(function (t) { return t.layer === s.layer && t.row === s.row && t.col === s.col; });
        if (i >= 0 && !marked.has(i)) { editorDarkIdx.push(i); marked.add(i); }
      }
    });
    let result = null;
    for (let seed = 1; seed <= 100 && !result; seed++) {
      result = backwardFill(tiles, makeRng(seed * 9301 + 49297));
    }
    if (!result) throw new Error('fill failed after 100 retries');
    tiles.forEach(function (t, i) { t.typeId = result.assigned[i]; });
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
    for (let seed = 1; seed <= 100 && !result; seed++) {
      result = backwardFill(level.tiles, makeRng(seed * 1000 + 42));
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
    // 编辑器形状是 std（row=纵/col=横），生成器内部用 row=横/col=纵 → swap
    const layerMap = {};
    editorTiles.forEach(function (t) {
      (layerMap[t.layer] = layerMap[t.layer] || []).push({ row: t.col, col: t.row });
    });
    const layerNums = Object.keys(layerMap).map(Number).sort(function (a, b) { return a - b; });
    if (layerNums.length === 0) throw new Error('空形状');
    if (editorTiles.length % 2 !== 0) {
      throw new Error('底座是 ' + editorTiles.length + ' 张（奇数），二消要偶数张才能成对，请加一张或删一张');
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
      // 不对称堆塔时层不镜像翻倍，总牌数可能为奇数（二消要偶数）→ 从顶层删牌凑偶
      // 必须成对删除（一张 + 它的镜像对称牌），否则破坏对称性导致校验失败
      if (shape.tiles.length % 2 !== 0) {
        const maxL = Math.max.apply(null, shape.tiles.map(function (t) { return t.layer; }));
        const topTiles = shape.tiles.filter(function (t) { return t.layer === maxL; });
        // 找一对镜像对称的牌删除（row-mirror 对称：row 相反、col 相同）
        let removed = false;
        for (let k = 0; k < topTiles.length && !removed; k++) {
          const a = topTiles[k];
          const b = topTiles.find(function (t, j) { return j !== k && t.row === -a.row && t.col === a.col; });
          if (b) {
            shape.tiles = shape.tiles.filter(function (t) { return t !== a && t !== b; });
            removed = true;
          }
        }
        // 找不到镜像对（顶层只有中轴线上的牌），则删一张中轴线牌（row=0，自身对称）
        if (!removed) {
          const axis = topTiles.find(function (t) { return t.row === 0; });
          if (axis) shape.tiles = shape.tiles.filter(function (t) { return t !== axis; });
        }
        if (shape.layerCounts) shape.layerCounts[maxL] = shape.tiles.filter(function (t) { return t.layer === maxL; }).length;
      }
      const v = validateShape(shape, { skipSymmetry: !mirror });
      if (!v.ok) continue; // 校验不过就重搭
      const level = toEditorJSON(shape, 1);
      // 填色
      for (let seed = 1; seed <= 50 && !filled; seed++) {
        const result = backwardFill(level.tiles, makeRng(seed * 1000 + 42));
        if (result) {
          filled = {
            levelId: level.levelId, totalPairs: level.totalPairs,
            tiles: level.tiles.map(function (t, j) { return Object.assign({}, t, { typeId: result.assigned[j] }); }),
            specialTiles: []
          };
        }
      }
    }
    if (!filled) throw new Error('堆塔后无法完成填色(底座可能过于复杂,试试简化底座或减少堆层数)');
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
