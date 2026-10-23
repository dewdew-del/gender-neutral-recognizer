// Serverless function (Vercel). Holds the Groq key so visitors don't need their own.
// Set GROQ_API_KEY in the host's environment variables; never commit it.
const { TERMS } = require('../js/terms.js');
const Assistant = require('../js/assistant.js');

const hits = new Map(); // ip -> [timestamps]; best-effort limit per warm instance
const LIMIT = 15;
const WINDOW_MS = 60 * 1000;

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'The helper is not configured.' });
  const ip = String((req.headers['x-forwarded-for'] || 'unknown')).split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests' });

  let clean;
  try {
    clean = Assistant.sanitizeRequest(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  try {
    const messages = Assistant.buildMessages(clean.question, clean.history, TERMS);
    const reply = await Assistant.askGroq({ key, messages });
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
