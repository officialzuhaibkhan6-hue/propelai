/**
 * PropelAI — License Key Validator
 * Vercel Serverless Function: /api/validate
 *
 * Validates a buyer's license key.
 * Keys are stored in the PROPELAI_KEYS environment variable as a
 * JSON string, e.g.:
 *   PROPELAI_KEYS = {"PROPEL-XXXX-YYYY":{"plan":"pro","uses":0,"maxUses":500,"active":true},...}
 *
 * Set this env var in your Vercel dashboard → Project → Settings → Environment Variables
 */

export default async function handler(req, res) {
  // CORS — allow your frontend origin only (update if you have a custom domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { licenseKey } = req.body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ valid: false, error: 'License key is required.' });
    }

    const normalizedKey = licenseKey.trim().toUpperCase();

    // Load keys from environment variable
    const rawKeys = process.env.PROPELAI_KEYS;
    if (!rawKeys) {
      console.error('PROPELAI_KEYS env variable not set');
      return res.status(500).json({ valid: false, error: 'Server misconfiguration. Contact support.' });
    }

    let keys;
    try {
      keys = JSON.parse(rawKeys);
    } catch (e) {
      console.error('Failed to parse PROPELAI_KEYS:', e);
      return res.status(500).json({ valid: false, error: 'Server misconfiguration. Contact support.' });
    }

    const keyData = keys[normalizedKey];

    if (!keyData) {
      return res.status(200).json({ valid: false, error: 'Invalid license key. Check your purchase email.' });
    }

    if (!keyData.active) {
      return res.status(200).json({ valid: false, error: 'This license key has been deactivated. Contact support.' });
    }

    if (keyData.maxUses && keyData.uses >= keyData.maxUses) {
      return res.status(200).json({ valid: false, error: `Usage limit reached (${keyData.maxUses} proposals). Upgrade your plan.` });
    }

    // Key is valid — return plan info
    return res.status(200).json({
      valid: true,
      plan: keyData.plan || 'basic',
      usesRemaining: keyData.maxUses ? keyData.maxUses - keyData.uses : 'unlimited',
      message: `Welcome! Your ${keyData.plan || 'basic'} plan is active.`
    });

  } catch (err) {
    console.error('Validate error:', err);
    return res.status(500).json({ valid: false, error: 'Server error. Please try again.' });
  }
}
