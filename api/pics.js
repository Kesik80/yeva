// api/pics.js
// Отдаёт список картинок из папки репозитория — чтобы не вести list.json руками.
// Статический сайт содержимое папки не видит, поэтому спрашиваем у GitHub.
//
// GET /api/pics            → папка malen
// GET /api/pics?dir=malen2 → другая папка
//
// Env vars: GITHUB_TOKEN (необязателен, но без него лимит 60 запросов в час),
//           GITHUB_REPO_DEFAULT

const OK_EXT = /\.(svg|png|jpe?g|webp|gif)$/i;

// blume_gross.jpg -> "Blume gross"
function prettyName(file) {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const dir = String((req.query && req.query.dir) || 'malen').replace(/[^a-zA-Z0-9._/-]/g, '');
  if (!dir || dir.includes('..')) return res.status(400).json({ error: 'bad dir' });

  const repo = (req.query && req.query.repo) || process.env.GITHUB_REPO_DEFAULT;
  if (!repo) return res.status(400).json({ error: 'repo required' });

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'yeva',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/${dir}`, { headers });
    if (r.status === 404) return res.json({ dir, items: [] });     // папки ещё нет — это не ошибка
    if (!r.ok) {
      return res.status(502).json({ error: 'GitHub ' + r.status, details: (await r.text()).slice(0, 200) });
    }
    const data = await r.json();
    const items = (Array.isArray(data) ? data : [])
      .filter(f => f.type === 'file' && OK_EXT.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }))
      // sha меняется при каждой замене файла — по нему игра поймёт,
      // что картинку пора перечитать, а не брать из кэша
      .map(f => ({ file: f.name, name: prettyName(f.name), size: f.size, sha: (f.sha || '').slice(0, 10) }));

    return res.json({ dir, items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
