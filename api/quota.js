// api/quota.js
// Показывает остаток месячного лимита ElevenLabs по всем аккаунтам.
// Ключи остаются на сервере, в браузер уходят только цифры и хвост ключа.
//
// GET  /api/quota
// GET  /api/quota?adminToken=...   (если задана env ADMIN_TOKEN)
//
// Ответ:
//   { accounts: [{ i, tail, ok, tier, used, limit, left, percent, resetUnix }],
//     used, limit, left, percent, tier, resetUnix, count, best }
//   Верхние поля — сумма по живым аккаунтам, чтобы старый voicegen
//   продолжал показывать общую полосу без правок.
//
// Env vars: ELEVENLABS_API_KEY(S), ADMIN_TOKEN (опц.)

function keys() {
  const out = [];
  const add = v => { const k = String(v || '').trim(); if (k && !out.includes(k)) out.push(k); };
  add(process.env.ELEVENLABS_API_KEY);
  for (let i = 2; i <= 5; i++) add(process.env['ELEVENLABS_API_KEY_' + i]);
  String(process.env.ELEVENLABS_API_KEYS || '').split(',').forEach(add);
  return out;
}
const tail = k => '…' + k.slice(-4);

async function fetchT(url, opt, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 15000);
  try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); }
  finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ADMIN = process.env.ADMIN_TOKEN;
  if (ADMIN) {
    const given = (req.query && req.query.adminToken) || (req.body && req.body.adminToken);
    if (given !== ADMIN) return res.status(401).json({ error: 'unauthorized' });
  }

  const K = keys();
  if (!K.length) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  const accounts = await Promise.all(K.map(async (k, i) => {
    try {
      const r = await fetchT('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': k },
      });
      if (!r.ok) {
        const t = (await r.text()).slice(0, 200);
        return { i, tail: tail(k), ok: false, error: 'ElevenLabs ' + r.status, details: t };
      }
      const d = await r.json();
      const used = d.character_count || 0;
      const limit = d.character_limit || 0;
      return {
        i, tail: tail(k), ok: true,
        tier: d.tier || '—',
        status: d.status || '',
        used, limit,
        left: Math.max(0, limit - used),
        percent: limit ? Math.round(used / limit * 100) : 0,
        resetUnix: d.next_character_count_reset_unix || null,
        voiceSlotsUsed: d.voice_slots_used,
        voiceLimit: d.voice_limit,
      };
    } catch (e) {
      return { i, tail: tail(k), ok: false, error: e.message };
    }
  }));

  const good = accounts.filter(a => a.ok);
  if (!good.length) {
    return res.status(502).json({
      error: accounts[0] && accounts[0].error ? accounts[0].error : 'ElevenLabs недоступен',
      accounts, count: K.length,
    });
  }

  const used = good.reduce((n, a) => n + a.used, 0);
  const limit = good.reduce((n, a) => n + a.limit, 0);
  const left = good.reduce((n, a) => n + a.left, 0);
  const best = good.slice().sort((a, b) => b.left - a.left)[0];
  const resets = good.map(a => a.resetUnix).filter(Boolean).sort((a, b) => a - b);

  return res.json({
    accounts,
    count: K.length,
    alive: good.length,
    best: best ? best.i : null,
    used, limit, left,
    percent: limit ? Math.round(used / limit * 100) : 0,
    tier: good.length === 1 ? good[0].tier : good.map(a => a.tier).join(' + '),
    status: good[0].status || '',
    resetUnix: resets.length ? resets[0] : null,
    voiceSlotsUsed: good[0].voiceSlotsUsed,
    voiceLimit: good[0].voiceLimit,
  });
}
