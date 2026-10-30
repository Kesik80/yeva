// api/voices.js
// Голоса ElevenLabs: что есть на аккаунтах, поиск немецких в библиотеке
// и добавление голоса к себе. Ключи остаются на сервере.
//
// POST { a: 'mine' }                        → голоса всех аккаунтов
// POST { a: 'library', gender?, search? }   → немецкие голоса из библиотеки
// POST { a: 'add', owner, voice, name?, key? } → добавить голос к аккаунту
//
// Если задан ADMIN_TOKEN — нужен adminToken в теле.
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
  const t = setTimeout(() => ctl.abort(), ms || 20000);
  try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); }
  finally { clearTimeout(t); }
}
async function errOf(r) {
  let j = null;
  const t = await r.text();
  try { j = JSON.parse(t); } catch (e) {}
  const d = j && j.detail;
  const msg = (d && (d.message || (typeof d === 'string' ? d : null))) || ('ElevenLabs ' + r.status);
  const code = (d && (d.status || d.code)) || String(r.status);
  return { msg, code, raw: t.slice(0, 300) };
}

// какие языки голос точно умеет: у разных версий API поле называется по-разному
function langsOf(v) {
  const out = [];
  const push = s => { const x = String(s || '').toLowerCase().slice(0, 5); if (x && !out.includes(x)) out.push(x); };
  (v.verified_languages || []).forEach(l => push(l.language || l.locale));
  if (v.fine_tuning && v.fine_tuning.language) push(v.fine_tuning.language);
  if (v.labels && v.labels.language) push(v.labels.language);
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  const ADMIN = process.env.ADMIN_TOKEN;
  if (ADMIN && b.adminToken !== ADMIN) return res.status(401).json({ error: 'unauthorized' });

  const K = keys();
  if (!K.length) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  try {
    // ── голоса, которые уже есть на аккаунтах ────────────────
    if (b.a === 'mine') {
      const per = await Promise.all(K.map(async (k, i) => {
        try {
          const r = await fetchT('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': k } });
          if (!r.ok) { const e = await errOf(r); return { i, tail: tail(k), ok: false, error: e.msg }; }
          const j = await r.json();
          const voices = (j.voices || []).map(v => ({
            id: v.voice_id,
            name: v.name,
            cat: v.category || 'premade',
            gender: (v.labels && v.labels.gender) || '',
            accent: (v.labels && v.labels.accent) || '',
            desc: (v.labels && v.labels.description) || '',
            langs: langsOf(v),
            preview: v.preview_url || null,
            key: i,
          }));
          return { i, tail: tail(k), ok: true, voices };
        } catch (e) { return { i, tail: tail(k), ok: false, error: e.message }; }
      }));

      const seen = {};
      const voices = [];
      per.filter(p => p.ok).forEach(p => p.voices.forEach(v => {
        if (seen[v.id]) return;
        seen[v.id] = 1; voices.push(v);
      }));
      return res.json({ voices, accounts: per.map(p => ({ i: p.i, tail: p.tail, ok: p.ok, error: p.error || null })) });
    }

    // ── немецкие голоса из общей библиотеки ──────────────────
    if (b.a === 'library') {
      const qs = new URLSearchParams({ page_size: '24', language: 'de', sort: 'trending' });
      if (b.gender === 'male' || b.gender === 'female') qs.set('gender', b.gender);
      if (b.search) qs.set('search', String(b.search).slice(0, 60));
      const r = await fetchT('https://api.elevenlabs.io/v1/shared-voices?' + qs.toString(),
        { headers: { 'xi-api-key': K[0] } });
      if (!r.ok) {
        const e = await errOf(r);
        return res.status(502).json({ error: e.msg, code: e.code });
      }
      const j = await r.json();
      const voices = (j.voices || []).map(v => ({
        id: v.voice_id,
        owner: v.public_owner_id,
        name: v.name,
        gender: v.gender || '',
        accent: v.accent || '',
        age: v.age || '',
        lang: v.language || '',
        desc: v.description || '',
        uses: v.cloned_by_count || v.usage_character_count_1y || 0,
        free: v.free_users_allowed !== false,
        preview: v.preview_url || null,
      }));
      return res.json({ voices });
    }

    // ── добавить голос из библиотеки к себе ──────────────────
    if (b.a === 'add') {
      const owner = String(b.owner || '');
      const voice = String(b.voice || '');
      if (!/^[A-Za-z0-9]{10,64}$/.test(owner) || !/^[A-Za-z0-9]{15,40}$/.test(voice)) {
        return res.status(400).json({ error: 'плохой id голоса' });
      }
      const i = (Number.isInteger(b.key) && K[b.key]) ? b.key : 0;
      const name = String(b.name || 'YEVA').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 60) || 'YEVA';
      const r = await fetchT('https://api.elevenlabs.io/v1/voices/add/' + owner + '/' + voice, {
        method: 'POST',
        headers: { 'xi-api-key': K[i], 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: name }),
      }, 30000);
      if (!r.ok) {
        const e = await errOf(r);
        const paid = /paid|subscription|plan|upgrade/i.test(e.msg + e.code);
        return res.status(502).json({
          error: paid ? 'ElevenLabs не даёт добавить этот голос на текущем тарифе: ' + e.msg : e.msg,
          code: e.code, key: i,
        });
      }
      const j = await r.json().catch(() => ({}));
      return res.json({ id: j.voice_id || voice, name, key: i });
    }

    return res.status(400).json({ error: 'неизвестное действие' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export const config = { maxDuration: 30 };
