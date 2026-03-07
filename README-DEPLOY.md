# PropelAI — Deploy & Launch Guide
# ════════════════════════════════════

## What You're Deploying

```
propelai/
├── api/
│   ├── generate.js     ← AI proxy (YOUR key stays here, hidden forever)
│   └── validate.js     ← License key checker
├── public/
│   └── index.html      ← Landing page + full app
└── vercel.json         ← Routing config
```

---

## STEP 1 — Push to GitHub (2 min)

1. Go to https://github.com → New repository → name it "propelai"
2. In terminal:
   ```bash
   cd propelai
   git init
   git add .
   git commit -m "Initial PropelAI release"
   git remote add origin https://github.com/YOUR_USERNAME/propelai.git
   git push -u origin main
   ```

---

## STEP 2 — Deploy to Vercel (3 min)

1. Go to https://vercel.com → Log in with GitHub
2. Click "Add New Project" → Import your `propelai` repo
3. Leave all settings as default → click **Deploy**
4. Vercel will give you a URL like: `https://propelai-abc123.vercel.app`

---

## STEP 3 — Set Environment Variables (2 min)

In your Vercel project → Settings → Environment Variables, add:

### Variable 1: Your Anthropic API Key
```
Name:  ANTHROPIC_API_KEY
Value: sk-ant-api03-YOUR-KEY-HERE
```
Get your key at: https://console.anthropic.com

### Variable 2: License Keys (JSON)
```
Name:  PROPELAI_KEYS
Value: (see format below)
```

**License key JSON format:**
```json
{
  "PROPEL-2025-BASIC-001": {
    "plan": "basic",
    "uses": 0,
    "maxUses": 100,
    "active": true
  },
  "PROPEL-2025-PRO-001": {
    "plan": "pro",
    "uses": 0,
    "maxUses": 500,
    "active": true
  },
  "PROPEL-2025-UNLTD-001": {
    "plan": "unlimited",
    "uses": 0,
    "maxUses": null,
    "active": true
  }
}
```

**Tip:** Generate unique keys with any key generator or use this format:
`PROPEL-[YEAR]-[PLAN]-[3-DIGIT-NUMBER]`
Example: `PROPEL-2025-PRO-047`

### Optional Variable 3: Rate Limit
```
Name:  RATE_LIMIT_PER_KEY
Value: 10
```
(Max proposals per key per hour. Default: 10)

After adding variables → click **Save** → **Redeploy**

---

## STEP 4 — Update Your Frontend URL (1 min)

In `public/index.html`, find this line near the bottom:
```javascript
const API_BASE = 'https://your-project.vercel.app';
```

Replace with your actual Vercel URL:
```javascript
const API_BASE = 'https://propelai-abc123.vercel.app';
```

Commit and push → Vercel auto-redeploys.

---

## STEP 5 — Test It

1. Open your Vercel URL
2. Click "Get Access"
3. Enter one of your license keys
4. Generate a proposal ✓

---

## SELLING ON GUMROAD

### Setup:
1. Go to https://gumroad.com → Create product
2. Name: "PropelAI — AI Proposal Writer for Freelancers"
3. Price: $19 (or your choice)
4. Delivery: Use "Custom fields" to auto-deliver license keys
   - OR: manually email a key after each purchase

### Pro tip — Automate key delivery:
Use Gumroad webhooks + a simple script to:
1. Receive purchase notification
2. Pick next unused key from your list
3. Email it to the buyer automatically

---

## MANAGING LICENSE KEYS

### Add new keys (when you sell more):
1. Go to Vercel → Settings → Environment Variables
2. Edit `PROPELAI_KEYS`
3. Add new key entries to the JSON
4. Save → Redeploy

### Revoke a key (refund / abuse):
Change `"active": true` to `"active": false` for that key.

### Upgrading to a database (recommended at 50+ customers):
Replace the JSON env var with Vercel KV (free tier) or Supabase.
This gives you persistent usage tracking and a proper admin dashboard.

---

## PRICING TIERS (recommended)

| Plan     | Key Format              | Uses    | Price  |
|----------|-------------------------|---------|--------|
| Starter  | PROPEL-2025-STRT-XXX    | 50      | $9     |
| Basic    | PROPEL-2025-BSIC-XXX    | 150     | $19    |
| Pro      | PROPEL-2025-PRO-XXX     | 500     | $39    |
| Unlimited| PROPEL-2025-UNLTD-XXX   | ∞       | $69    |

---

## SECURITY SUMMARY

✅ Your Anthropic API key = stored ONLY in Vercel env vars
✅ Buyers never see your API key — not in HTML, not in requests
✅ Every request validates a license key server-side
✅ Rate limiting prevents abuse (10 req/hour per key default)
✅ Input sanitization prevents prompt injection attacks
✅ You can revoke any key instantly

---

## SUPPORT

Questions? Issues? 
- Vercel docs: https://vercel.com/docs
- Anthropic API: https://docs.anthropic.com
- Gumroad help: https://help.gumroad.com
