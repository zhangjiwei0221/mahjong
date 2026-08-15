// netlify/functions/levels.js
// 关卡共享工作台后端：list / save / delete
// 存储直接用 GitHub 仓库里的 data/levels/ 目录（每个关卡一个 JSON 文件）
// 环境变量：
//   WORKBENCH_PASSWORD  - 共享口令（必填）
//   GITHUB_TOKEN        - GitHub Personal Access Token（repo 权限，必填）
//   GITHUB_REPO        - 仓库，格式 "用户名/仓库名"，比如 "zhangjiwei0221/mahjong"（可选，自动推断也行）
//   GITHUB_BRANCH      - 分支，默认 main

const PASS_ENV = 'WORKBENCH_PASSWORD';
const LEVELS_DIR = 'data/levels';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Workbench-Pass',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  };
}

function json(status, body) {
  return { statusCode: status, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkPass(headers) {
  const expected = process.env[PASS_ENV];
  if (!expected) return { ok: false, msg: 'WORKBENCH_PASSWORD 未配置' };
  const got = headers['x-workbench-pass'] || headers['X-Workbench-Pass'];
  if (!got || got !== expected) return { ok: false, msg: '口令错误' };
  return { ok: true };
}

const GH_API = 'https://api.github.com';

function ghHeaders(token, extra) {
  return Object.assign({
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mahjong-workbench',
  }, extra || {});
}

async function ghRequest(path, opts) {
  opts = opts || {};
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN 未配置');
  const repo = process.env.GITHUB_REPO;
  if (!repo) throw new Error('GITHUB_REPO 未配置');
  const url = `${GH_API}/repos/${repo}${path}`;
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: ghHeaders(token, opts.headers || {}),
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

async function getLevelList() {
  const branch = process.env.GITHUB_BRANCH || 'main';
  try {
    const { data } = await ghRequest(`/contents/${LEVELS_DIR}?ref=${branch}`);
    if (!Array.isArray(data)) return [];
    const files = data.filter(f => f.name.endsWith('.json') && f.type === 'file');
    const levels = [];
    for (const f of files) {
      try {
        const { data: content } = await ghRequest(`/contents/${LEVELS_DIR}/${f.name}?ref=${branch}`);
        const raw = Buffer.from(content.content, 'base64').toString('utf8');
        const lv = JSON.parse(raw);
        levels.push({
          key: f.name.replace(/\.json$/, ''),
          name: lv.name,
          totalPairs: lv.totalPairs,
          tileCount: (lv.tiles || []).length,
          darkCount: (lv.specialTiles || []).filter(s => s.type === 'dark').length,
          score: lv._difficulty?.score ?? null,
          maxLayer: lv._difficulty?.maxLayer ?? 0,
          savedAt: lv.createdAt || null,
          author: lv.author || '',
        });
      } catch (_) { /* skip bad files */ }
    }
    levels.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    return levels;
  } catch (e) {
    if (e.status === 404) return []; // 目录不存在说明还没存过
    throw e;
  }
}

async function getLevel(key) {
  const branch = process.env.GITHUB_BRANCH || 'main';
  try {
    const { data } = await ghRequest(`/contents/${LEVELS_DIR}/${encodeURIComponent(key)}.json?ref=${branch}`);
    const raw = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function putLevel(key, levelObj) {
  const branch = process.env.GITHUB_BRANCH || 'main';
  const filePath = `${LEVELS_DIR}/${key}.json`;
  const content = Buffer.from(JSON.stringify(levelObj, null, 2)).toString('base64');

  // 先看文件存不存在（拿到 sha 才能更新）
  let sha = null;
  try {
    const { data: existing } = await ghRequest(`/contents/${filePath}?ref=${branch}`);
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

  await ghRequest(`/contents/${filePath}`, { method: 'PUT', body });
  return true;
}

async function deleteLevel(key) {
  const branch = process.env.GITHUB_BRANCH || 'main';
  const filePath = `${LEVELS_DIR}/${key}.json`;

  let sha;
  try {
    const { data: existing } = await ghRequest(`/contents/${filePath}?ref=${branch}`);
    sha = existing.sha;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }

  await ghRequest(`/contents/${filePath}`, {
    method: 'DELETE',
    body: {
      message: `workbench: delete level ${key}`,
      sha,
      branch,
    },
  });
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }

  const path = (event.path || '').replace(/^.*\/levels\/?/, '').replace(/\/$/, '');

  try {
    // GET /levels — 列出所有关卡
    if (event.httpMethod === 'GET' && !path) {
      const levels = await getLevelList();
      return json(200, { levels });
    }

    // GET /levels/:key — 单个完整关卡
    if (event.httpMethod === 'GET' && path) {
      const data = await getLevel(decodeURIComponent(path));
      if (!data) return json(404, { error: '关卡不存在' });
      const clean = {
        levelId: data.levelId,
        totalPairs: data.totalPairs,
        tiles: data.tiles,
        specialTiles: data.specialTiles || [],
      };
      return json(200, clean);
    }

    // POST /levels — 保存
    if (event.httpMethod === 'POST') {
      const passCheck = checkPass(event.headers);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      let body;
      try { body = JSON.parse(event.body); } catch (_) { return json(400, { error: 'JSON 格式错误' }); }
      const name = (body.name || '未命名关卡').toString().slice(0, 50);
      if (!body.tiles || !Array.isArray(body.tiles)) return json(400, { error: '缺少 tiles' });

      const key = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const payload = {
        key,
        name,
        author: (body.author || '').toString().slice(0, 20),
        levelId: body.levelId || 1,
        totalPairs: body.totalPairs || Math.floor(body.tiles.length / 2),
        tiles: body.tiles,
        specialTiles: body.specialTiles || [],
        _difficulty: body._difficulty || null,
        createdAt: new Date().toISOString(),
      };
      await putLevel(key, payload);
      return json(200, { key, name });
    }

    // DELETE /levels/:key — 删除
    if (event.httpMethod === 'DELETE' && path) {
      const passCheck = checkPass(event.headers);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      const ok = await deleteLevel(decodeURIComponent(path));
      return json(ok ? 200 : 404, { ok });
    }

    return json(405, { error: '不支持的方法' });
  } catch (e) {
    console.error('handler error:', e);
    return json(500, { error: '服务器错误: ' + (e.message || String(e)) });
  }
};
