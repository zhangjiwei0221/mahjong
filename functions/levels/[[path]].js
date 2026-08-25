// Cloudflare Pages Function —— 关卡工作台后端
// 存储：直接用 GitHub 仓库 data/levels/ 目录（每个关卡一个 JSON 文件）
// 路由：/levels（列表/新增）、/levels/:key（读取/改元数据/删除）
// 环境变量（Cloudflare 项目 Settings → Environment variables）：
//   WORKBENCH_PASSWORD  - 共享口令（读写都要）
//   GITHUB_TOKEN        - GitHub Personal Access Token（repo 权限，建议设为 Secret）
//   GITHUB_REPO         - 仓库，格式 "用户名/仓库名"，如 "zhangjiwei0221/mahjong"
//   GITHUB_BRANCH       - 分支，默认 main

const LEVELS_DIR = 'data/levels';

// 制作进度状态（前端已不用，字段保留兼容旧数据）
const STATUS_LIST = ['wip', 'test', 'done'];
function pickStatus(v) { return STATUS_LIST.includes(v) ? v : 'wip'; }
function pickOrder(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Workbench-Pass',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store', // 禁止 Cloudflare 边缘缓存：列表要实时反映 GitHub 新保存的关
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  });
}

function checkPass(headers, env) {
  const expected = env.WORKBENCH_PASSWORD;
  if (!expected) return { ok: false, msg: 'WORKBENCH_PASSWORD 未配置' };
  const got = headers.get('x-workbench-pass') || headers.get('X-Workbench-Pass');
  if (!got || got !== expected) return { ok: false, msg: '口令错误' };
  return { ok: true };
}

const GH_API = 'https://api.github.com';

async function ghRequest(env, path, opts) {
  opts = opts || {};
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN 未配置');
  const repo = env.GITHUB_REPO;
  if (!repo) throw new Error('GITHUB_REPO 未配置');
  const url = `${GH_API}/repos/${repo}${path}`;
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mahjong-workbench',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store', // 防止 GitHub 目录列表子请求被 Cloudflare 缓存返回旧快照(之前列表一直停在旧文件数)
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = text; }
  if (!r.ok) {
    const msg = (data && data.message) ? data.message : ('HTTP ' + r.status);
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return { data, status: r.status };
}

// 读 _index.json
// 根因(2026-08-25 实测定案): Pages Functions 对 api.github.com「首次 fetch 到的那个 URL」的
// 子响应会在边缘缓存, cache:'no-store' 压不住(写请求不受影响,所以保存一直没问题;
// 新的关卡 key 每次都是新 URL 自然缓存未命中→单关读取实时)。
// 但 _index.json 是固定 URL → 被缓存成旧快照 → 列表永远停在旧版。
// 解法: 改从 **raw.githubusercontent.com** 读(不同主机=不同缓存键), 且每次带 _t 时间戳
// 破缓存(伪随机/bfCache 都不靠, 直接新 URL)。raw 会忽略查询串仍返回该文件最新字节。
// 从 raw.githubusercontent.com 读文件(纯文本)。不同主机+每次 _t 破缓存。
// 列表/content 都走这里,绕开 api.github.com 的边缘缓存(它对新近提交的关卡会回陈旧错误)。
async function fetchRawLevel(env, key) {
  const branch = env.GITHUB_BRANCH || 'main';
  const repo = env.GITHUB_REPO;
  if (!repo) return null;
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${LEVELS_DIR}/${key}.json?_=${Date.now()}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'mahjong-workbench' }, cache: 'no-store' });
    if (!r.ok) return null;
    const text = await r.text();
    return JSON.parse(text);
  } catch (_) { return null; }
}

async function readIndex(env) {
  const branch = env.GITHUB_BRANCH || 'main';
  const repo = env.GITHUB_REPO;
  if (!repo) return null;
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${LEVELS_DIR}/_index.json?_=${Date.now()}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'mahjong-workbench' }, cache: 'no-store' });
    if (!r.ok) return null;
    const idx = await r.json();
    return Array.isArray(idx.keys) ? idx.keys : null;
  } catch (_) { return null; }
}

// 向 _index.json 追加一个 key（读-改-写，带 sha；冲突重试）。失败只影响索引，不影响关卡本身已保存。
async function appendIndex(env, key) {
  const branch = env.GITHUB_BRANCH || 'main';
  const filePath = `${LEVELS_DIR}/_index.json`;
  for (let att = 0; att < 3; att++) {
    let sha = null, keys = [];
    try {
      const { data } = await ghRequest(env, `/contents/${filePath}?ref=${branch}`);
      sha = data.sha;
      const raw = Buffer.from(data.content, 'base64').toString('utf8');
      const idx = JSON.parse(raw);
      if (Array.isArray(idx.keys)) keys = idx.keys;
    } catch (e) { if (e.status !== 404) return false; } // 不存在 → 新建
    if (keys.includes(key)) return true;
    keys.push(key);
    const body = {
      message: `workbench: idx add ${key}`,
      content: Buffer.from(JSON.stringify({ keys: keys.sort() }, null, 2)).toString('base64'),
      branch,
    };
    if (sha) body.sha = sha;
    try { await ghRequest(env, `/contents/${filePath}`, { method: 'PUT', body }); return true; }
    catch (_) { if (att >= 2) return false; } // sha 冲突 → 重读重试
  }
  return false;
}

async function getLevelList(env) {
  const branch = env.GITHUB_BRANCH || 'main';
  const levels = [];
  const diag = { readIndexSource: 'none', readIndexCount: 0 };
  let keys = await readIndex(env);
  diag.readIndexCount = Array.isArray(keys) ? keys.length : 0;
  diag.readIndexSource = Array.isArray(keys) ? 'raw' : 'missing';
  // _index.json 缺失/损坏或 raw 读取失败 → 回退 git trees 枚举（可能陈旧，至少能列出已有的）
  if (!keys || keys.length === 0) {
    diag.readIndexSource = 'trees-fallback';
    keys = [];
    try {
      const { data: tree } = await ghRequest(env, `/git/trees/${branch}?recursive=1&_t=${Date.now()}`);
      if (Array.isArray(tree && tree.tree)) {
        tree.tree.forEach(function (x) {
          if (x.type === 'blob' && x.path && x.path.indexOf(LEVELS_DIR + '/') === 0 && x.path.endsWith('.json') && x.path.indexOf('_index.json') < 0) {
            keys.push(x.path.slice(LEVELS_DIR.length + 1).replace(/\.json$/, ''));
          }
        });
      }
      diag.readIndexCount = keys.length;
    } catch (_) {}
  } else {
    diag.readIndexSource = 'raw';
  }
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const lv = await fetchRawLevel(env, key);
    if (!lv) { diag.skipped = diag.skipped || []; if (diag.skipped.length < 30) diag.skipped.push(key); continue; }
    levels.push({
      key, name: lv.name,
      totalPairs: lv.totalPairs,
      tileCount: (lv.tiles || []).length,
      darkCount: (lv.specialTiles || []).filter(s => s.type === 'dark').length,
      score: lv._difficulty?.score ?? null,
      hooks: lv._difficulty?.hooks ?? null,
      darkHooks: lv._difficulty?.darkHooks ?? null,
      hookDensity: lv._difficulty?.hookDensity ?? null,
      darkHookDensity: lv._difficulty?.darkHookDensity ?? null,
      clickRatio: lv._difficulty?.clickRatio ?? null,
      maxLayer: lv._difficulty?.maxLayer ?? 0,
      savedAt: lv.createdAt || null,
      order: lv.order != null ? lv.order : null,
      status: pickStatus(lv.status),
      playTimeMs: lv.playTimeMs || null,
    });
  }
  // 诊断：用 diag 里 key 命中数/失败数，好判断 raw 读取或单关读取在哪一环丢数据
  diag.readFailures = keys.length - levels.length;
  diag.finalCount = levels.length;
  sortLevels(levels);
  return { levels, diag };
}

function sortLevels(levels) {
  levels.sort((a, b) => {
    const ao = a.order == null ? Infinity : a.order;
    const bo = b.order == null ? Infinity : b.order;
    if (ao !== bo) return ao - bo;
    return (b.savedAt || '').localeCompare(a.savedAt || '');
  });
}

async function getLevel(env, key) {
  // 也走 raw(见 fetchRawLevel 注释:api.github /contents 对最新关卡可能回陈旧错误,单关读取也要实时)
  return fetchRawLevel(env, key);
}

async function putLevel(env, key, levelObj) {
  const branch = env.GITHUB_BRANCH || 'main';
  const filePath = `${LEVELS_DIR}/${key}.json`;
  const content = Buffer.from(JSON.stringify(levelObj, null, 2)).toString('base64');

  let sha = null;
  try {
    const { data: existing } = await ghRequest(env, `/contents/${filePath}?ref=${branch}`);
    sha = existing.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const body = {
    message: `workbench: ${sha ? 'update' : 'add'} level ${key}`,
    content,
    branch,
  };
  if (sha) body.sha = sha;

  await ghRequest(env, `/contents/${filePath}`, { method: 'PUT', body });
  return true;
}

async function deleteLevel(env, key) {
  const branch = env.GITHUB_BRANCH || 'main';
  const filePath = `${LEVELS_DIR}/${key}.json`;

  let sha;
  try {
    const { data: existing } = await ghRequest(env, `/contents/${filePath}?ref=${branch}`);
    sha = existing.sha;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }

  await ghRequest(env, `/contents/${filePath}`, {
    method: 'DELETE',
    body: { message: `workbench: delete level ${key}`, sha, branch },
  });
  return true;
}

async function readBody(request) {
  try { return await request.json(); } catch (_) { return null; }
}

// 入口：/levels 与 /levels/:key
export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  const segs = Array.isArray(params && params.path) ? params.path : [];
  const key = segs.length ? decodeURIComponent(segs[0]) : '';
  const path = key ? '/' + key : '';

  try {
    // GET /levels —— 列出所有关卡（公开，无需口令）
    if (request.method === 'GET' && !key) {
      const { levels, diag } = await getLevelList(env);
      return json(200, { levels, _diag: diag });
    }

    // GET /levels/:key —— 单个完整关卡
    if (request.method === 'GET' && key) {
      const data = await getLevel(env, key);
      if (!data) return json(404, { error: '关卡不存在' });
      const clean = {
        levelId: data.levelId,
        totalPairs: data.totalPairs,
        tiles: data.tiles,
        specialTiles: data.specialTiles || [],
      };
      return json(200, clean);
    }

    // POST /levels —— 保存
    if (request.method === 'POST') {
      const passCheck = checkPass(request.headers, env);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      const body = await readBody(request);
      if (!body) return json(400, { error: 'JSON 格式错误' });
      const name = (body.name || '未命名关卡').toString().slice(0, 50);
      if (!body.tiles || !Array.isArray(body.tiles)) return json(400, { error: '缺少 tiles' });

      const k = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const payload = {
        key: k,
        name,
        levelId: body.levelId || 1,
        totalPairs: body.totalPairs || Math.floor(body.tiles.length / 2),
        tiles: body.tiles,
        specialTiles: body.specialTiles || [],
        _difficulty: body._difficulty || null,
        order: pickOrder(body.order),
        status: pickStatus(body.status),
        playTimeMs: body.playTimeMs || null,
        createdAt: new Date().toISOString(),
      };
      await putLevel(env, k, payload);
      await appendIndex(env, k); // 把新关 key 加进索引,工作台列表就能立刻实时看到
      return json(200, { key: k, name });
    }

    // PATCH /levels/:key —— 更新元数据（序号/名称/试玩时长），不动关卡数据
    if (request.method === 'PATCH' && key) {
      const passCheck = checkPass(request.headers, env);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      const body = await readBody(request);
      if (!body) return json(400, { error: 'JSON 格式错误' });
      const cur = await getLevel(env, key);
      if (!cur) return json(404, { error: '关卡不存在' });
      const merged = {
        ...cur,
        name: body.name !== undefined ? String(body.name).slice(0, 50) : cur.name,
        order: body.order !== undefined ? pickOrder(body.order) : (cur.order != null ? cur.order : null),
        status: body.status !== undefined ? pickStatus(body.status) : (cur.status || 'wip'),
        playTimeMs: body.playTimeMs !== undefined ? (body.playTimeMs || null) : (cur.playTimeMs || null),
        updatedAt: new Date().toISOString(),
      };
      await putLevel(env, key, merged);
      return json(200, { ok: true });
    }

    // DELETE /levels/:key —— 删除
    if (request.method === 'DELETE' && key) {
      const passCheck = checkPass(request.headers, env);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      const ok = await deleteLevel(env, key);
      return json(ok ? 200 : 404, { ok });
    }

    return json(405, { error: '不支持的方法' });
  } catch (e) {
    console.error('handler error:', e);
    return json(500, { error: '服务器错误: ' + (e.message || String(e)) });
  }
}
