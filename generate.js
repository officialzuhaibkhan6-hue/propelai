/**
 * PropelAI — Secure AI Generation Proxy
 * Vercel Serverless Function: /api/generate
 *
 * Your Anthropic API key NEVER leaves this server.
 * Buyers authenticate with their license key — they never see the AI key.
 *
 * Required Environment Variables (set in Vercel dashboard):
 *   ANTHROPIC_API_KEY  — your Anthropic API key (sk-ant-...)
 *   PROPELAI_KEYS      — JSON object of license keys (see validate.js)
 *
 * Optional:
 *   RATE_LIMIT_PER_KEY — max proposals per key per hour (default: 10)
 */

// In-memory rate limiter (resets on cold start — fine for Vercel)
const rateLimitStore = new Map();

function checkRateLimit(key) {
  const limit = parseInt(process.env.RATE_LIMIT_PER_KEY || '10');
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window

  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  // Reset window if expired
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  if (record.count >= limit) {
    const minutesLeft = Math.ceil((record.resetAt - now) / 60000);
    return { allowed: false, minutesLeft };
  }

  record.count++;
  rateLimitStore.set(key, record);
  return { allowed: true, remaining: limit - record.count };
}

function validatePromptInput(body) {
  const required = ['licenseKey', 'name', 'client', 'title', 'service', 'desc', 'tone', 'length'];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim().length === 0) {
      return `Missing or invalid field: ${field}`;
    }
  }
  // Sanity length checks — prevent prompt injection via huge inputs
  if (body.name.length > 100) return 'Name too long';
  if (body.client.length > 100) return 'Client name too long';
  if (body.title.length > 150) return 'Project title too long';
  if (body.desc.length > 700) return 'Description too long';
  if (body.exp && body.exp.length > 500) return 'Experience too long';
  if (body.budget && body.budget.length > 100) return 'Budget too long';
  return null;
}

function buildPrompt(body) {
  const lengthMap = {
    short: '300–400 words',
    medium: '500–700 words',
    long: '800–1000 words'
  };

  // Sanitize inputs — strip any prompt injection attempts
  const sanitize = (s) => (s || '').replace(/[<>]/g, '').trim();

  return `You are an expert freelance proposal writer. Write a compelling proposal for the brief below.

FREELANCER: ${sanitize(body.name)}
CLIENT: ${sanitize(body.client)}
PROJECT: ${sanitize(body.title)}
SERVICE TYPE: ${sanitize(body.service)}
DESCRIPTION: ${sanitize(body.desc)}
EXPERIENCE: ${sanitize(body.exp) || 'Not specified'}
BUDGET: ${sanitize(body.budget) || 'To be discussed'}
TIMELINE: ${sanitize(body.timeline) || 'To be discussed'}
TONE: ${sanitize(body.tone)}
TARGET LENGTH: ~${lengthMap[body.length] || '500–700 words'}
SECTIONS: ${(Array.isArray(body.sections) ? body.sections.map(sanitize).join(', ') : 'All standard sections')}

Rules:
- Write ONLY the proposal. No preamble, no meta-commentary.
- Use ## for section headings
- Use bullet points ONLY for deliverables
- Be specific, human, and persuasive — not generic or templated
- Reflect the ${sanitize(body.tone)} tone throughout
- End with a clear call to action`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // ── 1. Validate license key ──────────────────────────
    const licenseKey = (body.licenseKey || '').trim().toUpperCase();
    if (!licenseKey) {
      return res.status(401).json({ error: 'License key is required.' });
    }

    const rawKeys = process.env.PROPELAI_KEYS;
    if (!rawKeys) {
      return res.status(500).json({ error: 'Server misconfiguration.' });
    }

    let keys;
    try { keys = JSON.parse(rawKeys); }
    catch (e) { return res.status(500).json({ error: 'Server misconfiguration.' }); }

    const keyData = keys[licenseKey];
    if (!keyData || !keyData.active) {
      return res.status(403).json({ error: 'Invalid or inactive license key.' });
    }
    if (keyData.maxUses && keyData.uses >= keyData.maxUses) {
      return res.status(403).json({ error: `Usage limit reached. Upgrade your plan.` });
    }

    // ── 2. Rate limit ────────────────────────────────────
    const rateCheck = checkRateLimit(licenseKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many requests. Please wait ${rateCheck.minutesLeft} minutes.`
      });
    }

    // ── 3. Validate input fields ─────────────────────────
    const inputError = validatePromptInput(body);
    if (inputError) {
      return res.status(400).json({ error: inputError });
    }

    // ── 4. Call Anthropic — key is NEVER sent to client ──
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(500).json({ error: 'AI service not configured.' });
    }

    const prompt = buildPrompt(body);

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiResponse.ok) {
      const errData = await aiResponse.json().catch(() => ({}));
      console.error('Anthropic error:', errData);
      return res.status(502).json({ error: 'AI generation failed. Please try again.' });
    }

    const aiData = await aiResponse.json();
    const proposal = aiData.content?.[0]?.text;

    if (!proposal) {
      return res.status(502).json({ error: 'AI returned empty response. Please try again.' });
    }

    // ── 5. Increment usage count (best-effort) ───────────
    // Note: for a production app, use a database (Vercel KV, Supabase, etc.)
    // This in-memory increment doesn't persist across cold starts.
    keys[licenseKey].uses = (keys[licenseKey].uses || 0) + 1;

    // ── 6. Return proposal ───────────────────────────────
    return res.status(200).json({
      proposal,
      usesRemaining: keyData.maxUses ? keyData.maxUses - keys[licenseKey].uses : 'unlimited'
    });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
