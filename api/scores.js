// Online-Rangliste (Vercel Function).
//
//   GET  /api/scores?mode=endless|level      → { entries: [{ name, value }] }   (Top 10)
//   POST /api/scores { mode, name, value, elapsedMs }
//                                            → { rank, best, entries }
//
// Speicher: Upstash Redis (Vercel Marketplace), angesprochen über die REST-API —
// keine npm-Abhängigkeiten. Pro Spielername wird nur der Bestwert gehalten
// (Sorted Set, ZADD GT/LT). Env-Variablen setzt die Vercel-Integration automatisch.

const crypto = require('crypto');

const TOP_N = 10;
const KEEP_MAX = 1000;          // Sorted Sets auf diese Größe begrenzen
const RATE_LIMIT_PER_MIN = 10;  // Einträge pro IP und Minute

const MODES = {
  // Distanz in Metern, mehr ist besser
  endless: { key: 'liane:lb:endless', higherIsBetter: true },
  // Zeit in ms, weniger ist besser
  level: { key: 'liane:lb:level', higherIsBetter: false },
};

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cfg, commands) {
  const r = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis_http_${r.status}`);
  const out = await r.json();
  return out.map(x => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

function topCommand(m) {
  const cmd = ['ZRANGE', m.key, '0', String(TOP_N - 1)];
  if (m.higherIsBetter) cmd.push('REV');
  cmd.push('WITHSCORES');
  return cmd;
}

function parseTop(flat) {
  const entries = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) {
    entries.push({ name: flat[i], value: Number(flat[i + 1]) });
  }
  return entries;
}

// Buchstaben, Ziffern, Leerzeichen und ein paar Satzzeichen; max. 16 Zeichen.
function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC')
    .replace(/[^\p{L}\p{N} ._\-!?]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name.length ? name : null;
}

// Grobe Plausibilitätsprüfung — verhindert offensichtlich gefälschte Werte,
// ist aber kein echter Cheat-Schutz (der Client ist nicht vertrauenswürdig).
function isPlausible(mode, value, elapsedMs) {
  if (!Number.isInteger(value) || !Number.isFinite(elapsedMs)) return false;
  if (mode === 'endless') {
    // max. ~40 m/s (schneller als jeder Schwung), max. 100 km
    return value >= 1 && value <= 100000 && elapsedMs >= value * 25;
  }
  // Level: mindestens 8 s, höchstens 1 h; die gemeldete Zeit ist die Laufzeit
  return value >= 8000 && value <= 3600000;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const cfg = redisConfig();
  if (!cfg) {
    res.status(503).json({ error: 'leaderboard_not_configured' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const m = MODES[req.query && req.query.mode];
      if (!m) { res.status(400).json({ error: 'bad_mode' }); return; }
      const [top] = await redis(cfg, [topCommand(m)]);
      res.status(200).json({ entries: parseTop(top) });
      return;
    }

    if (req.method === 'POST') {
      const body = readBody(req);
      const m = MODES[body.mode];
      const name = sanitizeName(body.name);
      const value = Number(body.value);
      const elapsedMs = Number(body.elapsedMs);
      if (!m) { res.status(400).json({ error: 'bad_mode' }); return; }
      if (!name) { res.status(400).json({ error: 'bad_name' }); return; }
      if (!isPlausible(body.mode, value, elapsedMs)) { res.status(400).json({ error: 'implausible' }); return; }

      // IP nur gehasht und nur 60 s lang speichern (reines Rate-Limit)
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
      const rlKey = `liane:rl:${ipHash}`;
      const [count] = await redis(cfg, [['INCR', rlKey], ['EXPIRE', rlKey, '60']]);
      if (count > RATE_LIMIT_PER_MIN) { res.status(429).json({ error: 'rate_limited' }); return; }

      const trim = m.higherIsBetter
        ? ['ZREMRANGEBYRANK', m.key, '0', String(-(KEEP_MAX + 1))]   // schlechteste (niedrigste) raus
        : ['ZREMRANGEBYRANK', m.key, String(KEEP_MAX), '-1'];         // schlechteste (höchste) raus
      const results = await redis(cfg, [
        // Nur speichern, wenn besser als der bisherige Wert dieses Namens
        ['ZADD', m.key, m.higherIsBetter ? 'GT' : 'LT', String(value), name],
        trim,
        [m.higherIsBetter ? 'ZREVRANK' : 'ZRANK', m.key, name],
        ['ZSCORE', m.key, name],
        topCommand(m),
      ]);
      const rank = results[2];
      const best = results[3];
      res.status(200).json({
        rank: rank === null ? null : Number(rank),
        best: best === null ? null : Number(best),
        name,
        entries: parseTop(results[4]),
      });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('leaderboard error', err);
    res.status(502).json({ error: 'storage_error' });
  }
};
