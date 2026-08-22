// api/commit.js
// Пишет пачку файлов в GitHub ОДНИМ коммитом (Git Data API).
// Нужен затем, чтобы 50 озвученных слов не превратились в 50 коммитов
// и 50 пересборок на Vercel.
//
// POST { repo?, branch?, message?, adminToken?,
//        files: [{ path, content }],     // content — base64 без префикса data:
//        deletes: [ "malen/1.png" ] }    // что удалить тем же коммитом
//
// Env vars: GITHUB_TOKEN, GITHUB_REPO_DEFAULT, ADMIN_TOKEN (опц.)
//
// Блобы заливаются пачками по 6 параллельно: 85 файлов подряд по одному
// не укладывались в лимит времени функции, и коммит обрывался на хвосте.

export const config = { maxDuration: 60 };

function safePath(p) {
  if (typeof p !== 'string') return null;
  const clean = p.replace(/^\/+/, '').replace(/\\/g, '/');
  if (clean.includes('..') || clean.length > 200) return null;
  if (!/^[a-zA-Z0-9._\-/äöüÄÖÜß]+$/.test(clean)) return null;
  // звук и картинки: функция общая для голосов и раскрасок
  if (!/\.(mp3|m4a|ogg|png|jpe?g|webp|svg|gif)$/i.test(clean)) return null;
  return clean;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    repo,
    branch = 'main',
    message = 'Add generated audio',
    files,
    deletes,
    adminToken,
  } = req.body || {};

  const ADMIN = process.env.ADMIN_TOKEN;
  if (ADMIN && adminToken !== ADMIN) return res.status(401).json({ error: 'unauthorized' });

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = repo || process.env.GITHUB_REPO_DEFAULT;
  if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set' });
  if (!GITHUB_REPO) return res.status(400).json({ error: 'repo required' });
  const dels = Array.isArray(deletes) ? deletes : [];
  if ((!Array.isArray(files) || !files.length) && !dels.length) {
    return res.status(400).json({ error: 'files or deletes required' });
  }
  if ((files || []).length > 200 || dels.length > 200) return res.status(400).json({ error: 'too many files' });

  const gone = [];
  for (const d of dels) {
    const p = safePath(d);
    if (!p) return res.status(400).json({ error: 'bad path: ' + d });
    gone.push(p);
  }

  const clean = [];
  for (const f of (files || [])) {
    const p = safePath(f && f.path);
    if (!p) return res.status(400).json({ error: 'bad path: ' + (f && f.path) });
    if (typeof f.content !== 'string' || !f.content.length) {
      return res.status(400).json({ error: 'bad content for ' + p });
    }
    clean.push({ path: p, content: f.content });
  }

  const H = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const base = `https://api.github.com/repos/${GITHUB_REPO}`;

  async function gh(url, init) {
    const r = await fetch(url, { headers: H, ...init });
    if (!r.ok) {
      const e = new Error(`GitHub ${r.status} на ${url.replace(base, '')}`);
      e.details = await r.text();
      throw e;
    }
    return r.json();
  }

  try {
    // 1. где сейчас ветка
    const ref = await gh(`${base}/git/ref/heads/${branch}`);
    const headSha = ref.object.sha;
    const headCommit = await gh(`${base}/git/commits/${headSha}`);

    // 2. заливаем файлы как blob'ы, по 6 одновременно
    const tree = new Array(clean.length);
    const queue = clean.map((f, i) => ({ f, i }));
    const failed = [];

    async function worker() {
      while (queue.length) {
        const { f, i } = queue.shift();
        try {
          const blob = await gh(`${base}/git/blobs`, {
            method: 'POST',
            body: JSON.stringify({ content: f.content, encoding: 'base64' }),
          });
          tree[i] = { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
        } catch (e) {
          failed.push({ path: f.path, error: e.message });
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

    const good = tree.filter(Boolean);
    // удаление в Git Data API — запись в дереве с sha: null
    gone.forEach(p => good.push({ path: p, mode: '100644', type: 'blob', sha: null }));
    if (!good.length) {
      return res.status(502).json({ error: 'ни один файл не залился', failed });
    }

    // 3. одно дерево, один коммит
    const newTree = await gh(`${base}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: good }),
    });
    const commit = await gh(`${base}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
    });
    await gh(`${base}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });

    return res.json({
      ok: true,
      commit: commit.sha,
      count: clean.length ? good.length - gone.length : 0,
      deleted: gone,
      requested: clean.length,
      failed,                       // что не долетело — видно сразу
      paths: good.map(f => f.path),
    });

  } catch (e) {
    return res.status(502).json({ error: e.message, details: e.details });
  }
}
