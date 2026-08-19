// api/speak.js
// Универсальный TTS API. Обратно совместим со старой версией:
// старый запрос { text, voiceId, lang, repo } работает как раньше.
//
// Добавлено:
//   save: false   → не писать в GitHub, вернуть { audio: base64 }
//   path: "..."   → своя папка/имя файла вместо audio/{lang}/{voice}/{text}.mp3
//   adminToken    → обязателен для записи, ЕСЛИ задана env ADMIN_TOKEN
//   voiceSettings → { stability, similarity_boost, style, speed, use_speaker_boost }
//   previousText / nextText → контекст для интонации, вслух НЕ читается
//   modelId       → из белого списка моделей
//
// Env vars: ELEVENLABS_API_KEY, GITHUB_TOKEN, GITHUB_REPO_DEFAULT, ADMIN_TOKEN (опц.)

const ALLOWED_VOICES = {
  'CwhRBWXzGAHq8TQ4Fs17': 'Roger',
  'FGY2WhTYpPnrIDTdsKH5': 'Laura',
  'TX3LPaxmHKxFdv7VOQHJ': 'Liam',
  'XrExE9yKIg1WjnnlVkGX': 'Matilda',
  'bIHbv24MWmeRgasZH58o': 'Will',
  'cgSgspJ2msm6clMCkdW9': 'Jessica',
  'cjVigY5qzO86Huf0OWal': 'Eric',
  'nPczCjzI2devNBz1zQrb': 'Brian',
  'onwK4e9ZLuTAKqWW03F9': 'Daniel',
  'pFZP5JQG7iQjIQuC4Bku': 'Lily',
  'pqHfZKP75CvOlQylNhV4': 'Bill',
};

const DEFAULT_VOICE = 'CwhRBWXzGAHq8TQ4Fs17'; // Roger

const ALLOWED_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];

const num = (v, min, max, dflt) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

// Путь из запроса нельзя пускать в GitHub как есть
function safePath(p) {
  if (typeof p !== 'string') return null;
  const clean = p.replace(/^\/+/, '').replace(/\\/g, '/');
  if (clean.includes('..') || clean.length > 200) return null;
  if (!/^[a-zA-Z0-9._\-/äöüÄÖÜß]+$/.test(clean)) return null;
  if (!/\.(mp3|m4a|ogg)$/i.test(clean)) return null;
  return clean;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    text,
    voiceId,
    lang = 'de',
    repo,
    path: rawPath,
    save = true,
    adminToken,
    voiceSettings,
    previousText,
    nextText,
    modelId,
  } = req.body || {};

  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });

  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVEN_API_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  // Запись в репозиторий защищена, если ADMIN_TOKEN задан в Vercel.
  // Если переменной нет — поведение как раньше, ничего не ломается.
  const ADMIN = process.env.ADMIN_TOKEN;
  if (save && ADMIN && adminToken !== ADMIN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const safeVoiceId = ALLOWED_VOICES[voiceId] ? voiceId : DEFAULT_VOICE;
  const voiceName = ALLOWED_VOICES[safeVoiceId].toLowerCase();
  const model = ALLOWED_MODELS.includes(modelId) ? modelId : 'eleven_multilingual_v2';

  // Значения по умолчанию — прежние, так что старые вызовы не меняют звучание.
  const vs = voiceSettings || {};
  const settings = {
    stability: num(vs.stability, 0, 1, 0.5),
    similarity_boost: num(vs.similarity_boost, 0, 1, 0.75),
    style: num(vs.style, 0, 1, 0),
    use_speaker_boost: vs.use_speaker_boost !== false,
  };
  const speed = num(vs.speed, 0.7, 1.2, 1);
  if (speed !== 1) settings.speed = speed;

  // ── генерация ───────────────────────────────────────────────
  async function generate() {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${safeVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: settings,
        // читается «в уме» для интонации, в звук не попадает
        ...(previousText ? { previous_text: String(previousText).slice(0, 400) } : {}),
        ...(nextText ? { next_text: String(nextText).slice(0, 400) } : {}),
      }),
    });
    if (!r.ok) {
      const details = await r.text();
      const e = new Error('ElevenLabs error');
      e.details = details;
      throw e;
    }
    return Buffer.from(await r.arrayBuffer()).toString('base64');
  }

  // ── режим без записи: отдаём звук клиенту ───────────────────
  if (!save) {
    try {
      const b64 = await generate();
      return res.json({ audio: b64, voice: voiceName, cached: false });
    } catch (e) {
      return res.status(502).json({ error: e.message, details: e.details });
    }
  }

  // ── режим с записью в GitHub (как раньше) ───────────────────
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = repo || process.env.GITHUB_REPO_DEFAULT;
  if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not set' });
  if (!GITHUB_REPO) return res.status(400).json({ error: 'repo required (or set GITHUB_REPO_DEFAULT)' });

  let AUDIO_PATH;
  if (rawPath) {
    AUDIO_PATH = safePath(rawPath);
    if (!AUDIO_PATH) return res.status(400).json({ error: 'bad path' });
  } else {
    const filename = text.trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_äöüÄÖÜß]/g, '')
      .substring(0, 60) + `_(${ALLOWED_VOICES[safeVoiceId]}).mp3`;
    AUDIO_PATH = `audio/${lang}/${voiceName}/${filename}`;
  }

  const ghHeaders = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    const check = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${AUDIO_PATH}`,
      { headers: ghHeaders }
    );
    if (check.status === 200) {
      const f = await check.json();
      return res.json({ url: f.download_url, path: AUDIO_PATH, cached: true, voice: voiceName });
    }

    const b64 = await generate();

    const save2 = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${AUDIO_PATH}`,
      {
        method: 'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `TTS [${voiceName}/${lang}]: ${text.substring(0, 50)}`,
          content: b64,
          branch: 'main',
        }),
      }
    );
    if (!save2.ok) {
      return res.status(502).json({ error: 'GitHub save error', details: await save2.text() });
    }

    const result = await save2.json();
    return res.json({ url: result.content.download_url, path: AUDIO_PATH, cached: false, voice: voiceName });

  } catch (e) {
    return res.status(500).json({ error: e.message, details: e.details });
  }
}
