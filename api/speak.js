// api/speak.js
// Универсальный TTS API. Обратно совместим со старой версией:
// старый запрос { text, voiceId, lang, repo } работает как раньше.
//
//   save: false   → не писать в GitHub, вернуть { audio: base64 }
//   path: "..."   → своя папка/имя файла вместо audio/{lang}/{voice}/{text}.mp3
//   adminToken    → обязателен для записи, ЕСЛИ задана env ADMIN_TOKEN
//   voiceSettings → { stability, similarity_boost, style, speed, use_speaker_boost }
//   previousText / nextText → контекст для интонации, вслух НЕ читается
//   modelId       → из белого списка моделей
//   lang: 'de'    → для моделей из LANG_MODELS уходит как language_code,
//                   то есть немецкий включается принудительно и «elf»
//                   больше не читается по-английски
//
// Несколько аккаунтов ElevenLabs (как в ОЗВУЧКЕ):
//   ELEVENLABS_API_KEY, ELEVENLABS_API_KEY_2 … _5
//   и/или ELEVENLABS_API_KEYS = "key1,key2,key3"
// Если у аккаунта кончились символы (quota_exceeded) или он занят (429),
// запрос молча уходит на следующий. Какой сработал — в ответе: { key, keyTail }.
//
// Env vars: ELEVENLABS_API_KEY(S), GITHUB_TOKEN, GITHUB_REPO_DEFAULT, ADMIN_TOKEN (опц.)

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

const ALLOWED_MODELS = [
  'eleven_v4',
  'eleven_v4_turbo',
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_flash_v2_5',
  'eleven_turbo_v2_5',
];
// только эти принимают language_code — остальные угадывают язык по тексту
const LANG_MODELS = ['eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];

const num = (v, min, max, dflt) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

// Все ключи: одиночный, пронумерованные и список через запятую
function keys() {
  const out = [];
  const add = v => { const k = String(v || '').trim(); if (k && !out.includes(k)) out.push(k); };
  add(process.env.ELEVENLABS_API_KEY);
  for (let i = 2; i <= 5; i++) add(process.env['ELEVENLABS_API_KEY_' + i]);
  String(process.env.ELEVENLABS_API_KEYS || '').split(',').forEach(add);
  return out;
}
const tail = k => '…' + k.slice(-4);

// кончились символы: 401/402 с quota_exceeded. 429 («слишком часто») — аккаунт жив.
function outOfCredits(status, text) {
  const t = String(text || '').toLowerCase();
  return (status === 401 || status === 402) &&
    (t.includes('quota_exceeded') || t.includes('quota exceeded') || t.includes('credits'));
}

// запрос с таймаутом: зависший провайдер иначе съедает все 60 секунд функции
async function fetchT(url, opt, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 25000);
  try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); }
  finally { clearTimeout(t); }
}

// Путь из запроса нельзя пускать в GitHub как есть
function safePath(p) {
  if (typeof p !== 'string') return null;
  const clean = p.replace(/^\/+/, '').replace(/\\/g, '/');
  if (clean.includes('..') || clean.length > 200) return null;
  if (!/^[a-zA-Z0-9._\-/äöüÄÖÜß]+$/.test(clean)) return null;
  if (!/\.(mp3|m4a|ogg)$/i.test(clean)) return null;
  return clean;
}

// ── обрезка mp3 по границе кадра ───────────────────────────────
// Кадр MP3 самодостаточен, поэтому хвост можно просто выбросить:
// перекодировать ничего не нужно, качество не меняется.
function mp3Trim(buf, seconds) {
  const BR1 = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];   // MPEG1 Layer III
  const BR2 = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0];       // MPEG2 / 2.5
  const SR = { 3: [44100,48000,32000], 2: [22050,24000,16000], 0: [11025,12000,8000] };
  let i = 0;
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {   // ID3v2
    i = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f));
  }
  let t = 0, xing = null, cut = -1;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) { i++; continue; }
    const ver = (buf[i + 1] >> 3) & 3;      // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[i + 1] >> 1) & 3;    // 1 = Layer III
    const brIdx = (buf[i + 2] >> 4) & 0xF;
    const srIdx = (buf[i + 2] >> 2) & 3;
    const pad = (buf[i + 2] >> 1) & 1;
    const sr = (SR[ver] || [])[srIdx];
    const br = (ver === 3 ? BR1[brIdx] : BR2[brIdx]) * 1000;
    if (layer !== 1 || ver === 1 || !sr || !br) { i++; continue; }
    const spf = ver === 3 ? 1152 : 576;
    const len = Math.floor(spf / 8 * br / sr) + pad;
    if (len < 24) { i++; continue; }

    // служебный кадр Xing/Info хранит длительность всего файла.
    // После обрезки она врала бы, поэтому такой кадр выбрасываем.
    const tagAt = buf.indexOf('Xing', i, 'latin1') >= 0 ? buf.indexOf('Xing', i, 'latin1') : -1;
    const infoAt = buf.indexOf('Info', i, 'latin1') >= 0 ? buf.indexOf('Info', i, 'latin1') : -1;
    const hdr = [tagAt, infoAt].filter(x => x > i && x < i + len);
    if (!xing && hdr.length) { xing = { start: i, end: i + len }; i += len; continue; }

    t += spf / sr;
    i += len;
    if (t >= seconds) { cut = i; break; }
  }
  if (cut < 0) cut = buf.length;              // не дотянули — отдаём всё, что есть
  if (!xing) return buf.slice(0, cut);
  return Buffer.concat([buf.slice(0, xing.start), buf.slice(xing.end, cut)]);
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
    accent,           // только для v3: подсказка вроде 'strong German accent'
    carrier,          // немецкий «хвост» («Uhr»): произносится вместе со словом
                      //  и отрезается от mp3 — так модель точно читает по-немецки
    key: keyWanted,   // необязательно: начать с конкретного аккаунта
    pin = false,      // true — не перебирать остальные
  } = req.body || {};

  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });

  const K = keys();
  if (!K.length) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });

  // Запись в репозиторий защищена, если ADMIN_TOKEN задан в Vercel.
  const ADMIN = process.env.ADMIN_TOKEN;
  if (save && ADMIN && adminToken !== ADMIN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // свои и библиотечные голоса не перечислены в ALLOWED_VOICES,
  // поэтому пускаем любой id правильного вида
  const VOICE_RE = /^[A-Za-z0-9]{15,40}$/;
  const safeVoiceId = ALLOWED_VOICES[voiceId] ? voiceId
    : (VOICE_RE.test(String(voiceId || '')) ? String(voiceId) : DEFAULT_VOICE);
  const voiceName = (ALLOWED_VOICES[safeVoiceId] || 'voice').toLowerCase();
  const model = ALLOWED_MODELS.includes(modelId) ? modelId : 'eleven_multilingual_v2';
  const v3 = model === 'eleven_v3';
  const v4 = model.indexOf('eleven_v4') === 0;

  // Значения по умолчанию — прежние, так что старые вызовы не меняют звучание.
  const vs = voiceSettings || {};
  let stability = num(vs.stability, 0, 1, 0.5);
  if (v3) stability = stability < 0.25 ? 0 : stability > 0.75 ? 1 : 0.5;   // v3: только 0 / 0.5 / 1

  // v4 понимает лишь ровность и похожесть: стиль, скорость и boost ему не шлём
  const settings = v4
    ? { stability, similarity_boost: num(vs.similarity_boost, 0, 1, 0.75) }
    : {
        stability,
        similarity_boost: num(vs.similarity_boost, 0, 1, 0.75),
        style: num(vs.style, 0, 1, 0),
        use_speaker_boost: vs.use_speaker_boost !== false,
      };
  const speed = num(vs.speed, 0.7, 1.2, 1);
  if (speed !== 1 && !v4) settings.speed = speed;

  // v3 понимает подсказки в квадратных скобках: «[strong German accent] Null.»
  // Остальные модели прочитали бы такую скобку вслух, поэтому им её срезаем.
  let outText = String(text);
  const tag = String(accent || '').replace(/[^\p{L} ]/gu, '').trim().slice(0, 40);
  if (v3 && tag) outText = '[' + tag + '] ' + outText;
  if (!v3) outText = outText.replace(/^\s*\[[^\]]{0,60}\]\s*/, '');

  // «elf» английский диктор читает по-английски, «elf Uhr» — уже по-немецки.
  // Хвост произносится, а потом отрезается от mp3, в файл он не попадает.
  const car = String(carrier || '').replace(/[^\p{L}\p{M} -]/gu, '').trim().slice(0, 30);
  const head = car ? outText.replace(/[.!?…]+\s*$/, '') : outText;
  if (car) outText = head + ' ' + car + '.';

  const body = { text: outText, model_id: model, voice_settings: settings };
  // жёсткий язык — главное лекарство от «elf» по-английски
  if (lang && LANG_MODELS.includes(model)) body.language_code = String(lang).slice(0, 5);
  if (!v3 && !v4) {
    // читается «в уме» для интонации, в звук не попадает; v3/v4 это не поддерживают
    if (previousText) body.previous_text = String(previousText).slice(0, 400);
    if (nextText) body.next_text = String(nextText).slice(0, 400);
  }

  // ── генерация с перебором аккаунтов ─────────────────────────
  async function generate() {
    const start = (Number.isInteger(keyWanted) && K[keyWanted]) ? keyWanted : 0;
    const order = pin ? [start] : K.map((_, n) => (start + n) % K.length);
    const t0 = Date.now();
    let last = null;

    for (const i of order) {
      const budget = 56000 - (Date.now() - t0);
      if (budget < 6000) { last = 'не хватило времени на перебор аккаунтов'; break; }
      // с хвостом нужны тайминги символов, чтобы знать, где резать
      const r = await fetchT(
        'https://api.elevenlabs.io/v1/text-to-speech/' + safeVoiceId +
          (car ? '/with-timestamps' : '') + '?output_format=mp3_44100_128',
        {
          method: 'POST',
          headers: {
            'Accept': car ? 'application/json' : 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': K[i],
          },
          body: JSON.stringify(body),
        },
        Math.min(45000, budget)
      );

      if (r.ok && car) {
        const j = await r.json();
        const raw = Buffer.from(j.audio_base_64 || j.audio_base64 || '', 'base64');
        const al = j.alignment || j.normalized_alignment || {};
        const chars = al.characters || [];
        const ends = al.character_end_times_seconds || [];
        const starts = al.character_start_times_seconds || [];
        let cut = 0;
        if (chars.length && ends.length === chars.length) {
          const idx = chars.join('').lastIndexOf(car);       // начало хвоста
          const wordEnd = idx >= 2 ? ends[idx - 2] : null;   // последняя буква слова
          const carStart = idx >= 0 ? starts[idx] : null;
          if (wordEnd != null && carStart != null && carStart >= wordEnd) {
            cut = wordEnd + Math.min(0.15, Math.max(0.03, (carStart - wordEnd) * 0.6));
          }
        }
        const out = cut > 0 ? mp3Trim(raw, cut) : raw;
        return {
          b64: out.toString('base64'), key: i, keyTail: tail(K[i]),
          trimmed: cut > 0, cutAt: cut ? +cut.toFixed(3) : null,
          said: outText,
        };
      }

      if (r.ok) {
        const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
        return { b64, key: i, keyTail: tail(K[i]) };
      }

      const full = await r.text();
      if (outOfCredits(r.status, full) && order.length > 1) {
        last = 'у аккаунта ' + (i + 1) + ' кончились символы'; continue;
      }
      if (r.status === 429 && order.length > 1) {
        last = 'аккаунт ' + (i + 1) + ' занят'; continue;
      }
      let msg = 'ElevenLabs ' + r.status;
      try { const d = JSON.parse(full).detail; if (d) msg = d.message || d.status || msg; }
      catch (e) { if (full) msg += ': ' + full.slice(0, 200); }
      const e = new Error(msg);
      e.details = full.slice(0, 400);
      e.key = i;
      throw e;
    }

    const e = new Error(order.length > 1
      ? 'все аккаунты заняты или без символов' + (last ? ' (' + last + ')' : '')
      : (last || 'озвучка не удалась'));
    e.code = 'quota_exceeded';
    throw e;
  }

  // ── режим без записи: отдаём звук клиенту ───────────────────
  if (!save) {
    try {
      const g = await generate();
      return res.json({
        audio: g.b64, voice: voiceName, model, cached: false,
        key: g.key, keyTail: g.keyTail, keys: K.length,
        said: g.said || null, trimmed: !!g.trimmed, cutAt: g.cutAt || null,
      });
    } catch (e) {
      return res.status(502).json({ error: e.message, details: e.details, code: e.code });
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

    const g = await generate();

    const save2 = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${AUDIO_PATH}`,
      {
        method: 'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `TTS [${voiceName}/${lang}]: ${text.substring(0, 50)}`,
          content: g.b64,
          branch: 'main',
        }),
      }
    );
    if (!save2.ok) {
      return res.status(502).json({ error: 'GitHub save error', details: await save2.text() });
    }

    const result = await save2.json();
    return res.json({
      url: result.content.download_url, path: AUDIO_PATH, cached: false,
      voice: voiceName, model, key: g.key, keyTail: g.keyTail,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, details: e.details, code: e.code });
  }
}

export const config = { maxDuration: 60 };
