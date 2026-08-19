// api/quota.js
// Показывает остаток месячного лимита ElevenLabs.
// Ключ остаётся на сервере, в браузер уходят только цифры.
//
// GET  /api/quota
// GET  /api/quota?adminToken=...   (если задана env ADMIN_TOKEN)
//
// Env vars: ELEVENLABS_API_KEY, ADMIN_TOKEN (опц.)

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

  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': KEY },
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'ElevenLabs ' + r.status, details: (await r.text()).slice(0, 200) });
    }
    const d = await r.json();
    const used = d.character_count || 0;
    const limit = d.character_limit || 0;

    return res.json({
      used,
      limit,
      left: Math.max(0, limit - used),
      percent: limit ? Math.round(used / limit * 100) : 0,
      tier: d.tier || '—',
      status: d.status || '',
      resetUnix: d.next_character_count_reset_unix || null,
      voiceSlotsUsed: d.voice_slots_used,
      voiceLimit: d.voice_limit,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
