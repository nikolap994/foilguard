/**
 * FoilGuard Detection Benchmark
 *
 * Measures precision, recall, and F1 against a labeled dataset of phishing
 * and legitimate domains. Uses calculateRiskScoreSync (no network) for speed.
 *
 * Usage:
 *   node scripts/benchmark.mjs                   # default threshold 65
 *   node scripts/benchmark.mjs --threshold 55    # custom threshold
 *   node scripts/benchmark.mjs --verbose         # show per-domain scores
 */

// ── Chrome API mock (required for detection modules) ──────────────────────
globalThis.chrome = {
  storage: {
    session: { get: async () => ({}), set: async () => {} },
    local:   { get: async () => ({}), set: async () => {} },
    managed: { get: async () => { throw new Error('not managed') } },
  },
}

import { calculateRiskScoreSync } from '../src/lib/detection/score.ts'

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const thresholdIdx = args.indexOf('--threshold')
const THRESHOLD = thresholdIdx !== -1 ? Number(args[thresholdIdx + 1]) : 65
const VERBOSE = args.includes('--verbose')

// ── Dataset ────────────────────────────────────────────────────────────────
// PHISHING: known impersonation patterns — expected score >= THRESHOLD
const phishing = [
  // Digit substitution
  { domain: 'paypa1.com',         pattern: 'digit-sub' },
  { domain: 'g00gle.com',         pattern: 'digit-sub' },
  { domain: 'rnicr0s0ft.com',     pattern: 'digit-sub' },
  { domain: 'amaz0n.com',         pattern: 'digit-sub' },
  { domain: 'netfl1x.com',        pattern: 'digit-sub' },
  { domain: 'faceb00k.com',       pattern: 'digit-sub' },

  // Character omission / insertion
  { domain: 'gogle.com',          pattern: 'omission' },
  { domain: 'instagramm.com',     pattern: 'insertion' },
  { domain: 'netflx.com',         pattern: 'omission' },
  { domain: 'amazoon.com',        pattern: 'insertion' },
  { domain: 'micosoft.com',       pattern: 'omission' },
  { domain: 'paypall.com',        pattern: 'insertion' },

  // Character swap / transposition
  { domain: 'googel.com',         pattern: 'transposition' },
  { domain: 'paypla.com',         pattern: 'transposition' },
  { domain: 'amzon.com',          pattern: 'transposition' },

  // l/I/1 substitution (common visual attack)
  { domain: 'paypai.com',         pattern: 'visual-sub' },
  { domain: 'micros0ft.com',      pattern: 'visual-sub' },
  { domain: 'arnazon.com',        pattern: 'visual-sub' },

  // rn → m lookalike
  { domain: 'rnicrosoft.com',     pattern: 'rn-m' },
  { domain: 'arnazon.com',        pattern: 'rn-m' },

  // Combosquatting — brand + deceptive keyword
  { domain: 'paypal-secure.com',  pattern: 'combosquat' },
  { domain: 'amazon-login.com',   pattern: 'combosquat' },
  { domain: 'facebook-support.com', pattern: 'combosquat' },
  { domain: 'appleid-verify.com', pattern: 'combosquat' },
  { domain: 'microsoft-update.com', pattern: 'combosquat' },
  { domain: 'google-signin.com',  pattern: 'combosquat' },
  { domain: 'netflix-billing.com', pattern: 'combosquat' },
  { domain: 'paypal-account.com', pattern: 'combosquat' },
  { domain: 'amazon-prime-login.com', pattern: 'combosquat' },
  { domain: 'secure-paypal-update.com', pattern: 'combosquat' },

  // Brand prefix abuse
  { domain: 'loginpaypal.com',    pattern: 'prefix' },
  { domain: 'signin-amazon.com',  pattern: 'prefix' },
  { domain: 'accountgoogle.com',  pattern: 'prefix' },
]

// LEGITIMATE: known safe brands — expected score < THRESHOLD
const legitimate = [
  { domain: 'google.com' },
  { domain: 'amazon.com' },
  { domain: 'facebook.com' },
  { domain: 'paypal.com' },
  { domain: 'microsoft.com' },
  { domain: 'apple.com' },
  { domain: 'netflix.com' },
  { domain: 'instagram.com' },
  { domain: 'twitter.com' },
  { domain: 'linkedin.com' },
  { domain: 'github.com' },
  { domain: 'stackoverflow.com' },
  { domain: 'cloudflare.com' },
  { domain: 'mozilla.org' },
  { domain: 'wikipedia.org' },
  { domain: 'youtube.com' },
  { domain: 'reddit.com' },
  { domain: 'slack.com' },
  { domain: 'dropbox.com' },
  { domain: 'stripe.com' },
  { domain: 'shopify.com' },
  { domain: 'twitch.tv' },
  { domain: 'zoom.us' },
  { domain: 'notion.so' },
  { domain: 'figma.com' },
  { domain: 'vercel.com' },
  { domain: 'netlify.com' },
  { domain: 'heroku.com' },
  { domain: 'digitalocean.com' },
  { domain: 'linode.com' },
  // Legitimate subdomains that should never trigger
  { domain: 'mail.google.com' },
  { domain: 'accounts.paypal.com' },
  { domain: 'login.microsoftonline.com' },
]

// ── Run benchmark ──────────────────────────────────────────────────────────
console.log(`\nFoilGuard Detection Benchmark`)
console.log(`Threshold: ${THRESHOLD}  |  Phishing: ${phishing.length}  |  Legitimate: ${legitimate.length}`)
console.log('─'.repeat(64))

let tp = 0, fn = 0, tn = 0, fp = 0
const results = { tp: [], fn: [], tn: [], fp: [] }

for (const { domain, pattern } of phishing) {
  const result = calculateRiskScoreSync(domain)
  const score = typeof result === 'number' ? result : (result?.score ?? 0)
  const caught = score >= THRESHOLD
  if (caught) { tp++; results.tp.push({ domain, score, pattern }) }
  else        { fn++; results.fn.push({ domain, score, pattern }) }
}

for (const { domain } of legitimate) {
  const result = calculateRiskScoreSync(domain)
  const score = typeof result === 'number' ? result : (result?.score ?? 0)
  const blocked = score >= THRESHOLD
  if (!blocked) { tn++; results.tn.push({ domain, score }) }
  else          { fp++; results.fp.push({ domain, score }) }
}

// ── Metrics ────────────────────────────────────────────────────────────────
const precision = tp / (tp + fp) || 0
const recall    = tp / (tp + fn) || 0
const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0
const fpr       = fp / (fp + tn) || 0  // false positive rate

console.log('\nConfusion matrix:')
console.log(`  True  Positives (phishing caught):   ${String(tp).padStart(3)}`)
console.log(`  False Negatives (phishing missed):   ${String(fn).padStart(3)}`)
console.log(`  True  Negatives (legit allowed):     ${String(tn).padStart(3)}`)
console.log(`  False Positives (legit blocked):     ${String(fp).padStart(3)}`)

console.log('\nMetrics:')
console.log(`  Precision:             ${(precision * 100).toFixed(1)}%`)
console.log(`  Recall:                ${(recall    * 100).toFixed(1)}%`)
console.log(`  F1 score:              ${(f1        * 100).toFixed(1)}%`)
console.log(`  False positive rate:   ${(fpr       * 100).toFixed(1)}%`)

if (VERBOSE || results.fn.length > 0) {
  console.log('\nMissed phishing (false negatives):')
  if (results.fn.length === 0) console.log('  (none)')
  else results.fn.forEach(r => console.log(`  ${r.domain.padEnd(34)} score=${r.score}  pattern=${r.pattern}`))
}

if (VERBOSE || results.fp.length > 0) {
  console.log('\nFalse positives (legitimate domains blocked):')
  if (results.fp.length === 0) console.log('  (none)')
  else results.fp.forEach(r => console.log(`  ${r.domain.padEnd(34)} score=${r.score}`))
}

if (VERBOSE) {
  console.log('\nAll phishing scores:')
  ;[...results.tp, ...results.fn]
    .sort((a, b) => b.score - a.score)
    .forEach(r => console.log(`  ${r.domain.padEnd(34)} score=${r.score}  ${r.score >= THRESHOLD ? '✓' : '✗ MISSED'}`))
}

console.log('')
process.exit(fn + fp > 0 ? 0 : 0)  // always exit 0; CI interprets results separately
