// netlify/functions/levels.js
// 关卡共享工作台后端：list / save / delete，用 Netlify Blobs 存
// 共享口令放在环境变量 WORKBENCH_PASSWORD 里，所有写操作带 X-Workbench-Pass 校验
const { getStore } = require('@netlify/blobs');

const PASS_ENV = 'WORKBENCH_PASSWORD';
const STORE_NAME = 'level-workbench';

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }

  const store = getStore({ name: STORE_NAME });
  const path = (event.path || '').replace(/^.*\/levels\/?/, '').replace(/\/$/, '');

  try {
    // GET /levels — 列出所有关卡（只返回元信息，不含 tiles 大对象）
    if (event.httpMethod === 'GET' && !path) {
      const { blobs } = await store.list();
      const levels = [];
      for (const b of blobs) {
        try {
          const data = await store.get(b.key, { type: 'json' });
          levels.push({
            key: b.key,
            name: data.name,
            totalPairs: data.totalPairs,
            tileCount: data.tiles?.length ?? 0,
            darkCount: (data.specialTiles || []).filter(s => s.type === 'dark').length,
            score: data._difficulty?.score ?? null,
            maxLayer: data._difficulty?.maxLayer ?? 0,
            savedAt: b.etag ? String(b.etag) : null,
            author: data.author || '',
          });
        } catch (_) { /* skip bad entries */ }
      }
      levels.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
      return json(200, { levels });
    }

    // GET /levels/:key — 下载单个完整关卡 JSON
    if (event.httpMethod === 'GET' && path) {
      try {
        const data = await store.get(decodeURIComponent(path), { type: 'json' });
        // 去掉内部辅助字段
        const clean = {
          levelId: data.levelId,
          totalPairs: data.totalPairs,
          tiles: data.tiles,
          specialTiles: data.specialTiles || [],
        };
        return json(200, clean);
      } catch (e) {
        return json(404, { error: '关卡不存在' });
      }
    }

    // POST /levels — 保存新关卡（需要口令）
    if (event.httpMethod === 'POST') {
      const passCheck = checkPass(event.headers);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      let body;
      try { body = JSON.parse(event.body); } catch (_) { return json(400, { error: 'JSON 格式错误' }); }
      const name = (body.name || '未命名关卡').toString().slice(0, 50);
      if (!body.tiles || !Array.isArray(body.tiles)) return json(400, { error: '缺少 tiles' });

      // key 用时间戳 + 随机后缀，避免重名覆盖
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
      await store.setJSON(key, payload);
      return json(200, { key, name });
    }

    // DELETE /levels/:key — 删除（需要口令）
    if (event.httpMethod === 'DELETE' && path) {
      const passCheck = checkPass(event.headers);
      if (!passCheck.ok) return json(401, { error: passCheck.msg });
      try {
        await store.delete(decodeURIComponent(path));
        return json(200, { ok: true });
      } catch (e) {
        return json(404, { error: '关卡不存在' });
      }
    }

    return json(405, { error: '不支持的方法' });
  } catch (e) {
    console.error('handler error:', e);
    return json(500, { error: '服务器错误: ' + (e.message || String(e)) });
  }
};
