// /api/maps-key.js — безопасно отдаёт Google Maps API ключ клиенту
// Ключ хранится в Vercel env: GOOGLE_MAPS_API_KEY

module.exports = (req, res) => {
  // В README/деплое переменная называлась по-разному — принимаем оба имени
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY / GOOGLE_API_KEY не задан в Vercel env' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // кешируем 1 час
  res.json({ key });
};
