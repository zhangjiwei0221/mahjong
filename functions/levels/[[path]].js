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

async function getLevelList(env) {
  const branch = env.GITHUB_BRANCH || 'main';
  try {
    const { data } = await ghRequest(env, `/contents/${LEVELS_DIR}?ref=${branch}`);
    if (!Array.isArray(data)) return [];
    const files = data.filter(f => f.name.endsWith('.json') && f.type === 'file');
    const levels = [];
    for (const f of files) {
      try {
        const { data: content } = await ghRequest(env, `/contents/${LEVELS_DIR}/${f.name}?ref=${branch}`);
        const raw = Buffer.from(content.content, 'base64').toString('utf8');
        const lv = JSON.parse(raw);
        levels.push({
          key: f.name.replace(/\.json$/, ''),
          name: lv.name,
          totalPairs: lv.totalPairs,
          tileCount: (lv.tiles || []).length,
          darkCount: (lv.specialTiles || []).filter(s => s.type === 'dark').length,
          score: lv._difficulty?.score ?? null,
          hooks: lv._difficulty?.hooks ?? null,
          darkHooks: lv._difficulty?.darkHooks ?? null,
          hookDensity: lv._difficulty?.hookDensity ?? null,
          darkHookDensity: lv._difficulty?.darkHookDensity ?? null,
          totalPairs: lv.totalPairs,
          clickRatio: lv._difficulty?.clickRatio ?? null,
          maxLayer: lv._difficulty?.maxLayer ?? 0,
          savedAt: lv.createdAt || null,
          order: lv.order != null ? lv.order : null,
          status: pickStatus(lv.status),
          playTimeMs: lv.playTimeMs || null,
        });
      } catch (_) { /* skip bad files */ }
    }
    sortLevels(levels);
    return levels;
  } catch (e) {
    if (e.status === 404) return []; // 目录不存在说明还没存过
    throw e;
  }
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
  const branch = env.GITHUB_BRANCH || 'main';
  try {
    const { data } = await ghRequest(env, `/contents/${LEVELS_DIR}/${encodeURIComponent(key)}.json?ref=${branch}`);
    const raw = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
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
      const levels = await getLevelList(env);
      return json(200, { levels });
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
