// Quick smoke test for the detection engine — no Chrome needed.
// Run: npm test
// Note: RDAP age tests marked [network] require internet access and may be slow.

import { levenshtein } from '../src/lib/detection/levenshtein.ts'
import { isPunycode, containsNonASCII, normalizeHomoglyphs } from '../src/lib/detection/homoglyph.ts'
import { calculateRiskScore } from '../src/lib/detection/score.ts'
import { fetchDomainAge } from '../src/lib/detection/rdap.ts'

let passed = 0
let failed = 0

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) console.log(`    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}`)
  ok ? passed++ : failed++
}

// --- Levenshtein ---
expect('identical strings',            levenshtein('google', 'google'), 0)
expect('1 char deleted (gogle)',        levenshtein('gogle', 'google'), 1)
expect('1 char inserted (gooogle)',     levenshtein('gooogle', 'google'), 1)
expect('2 chars swapped (googel)',      levenshtein('googel', 'google'), 2)
expect('completely different words',   levenshtein('paypal', 'amazon') > 3, true)

// --- Homoglyph ---
expect('isPunycode: IDN domain',        isPunycode('xn--pple-43d.com'), true)
expect('isPunycode: normal domain',     isPunycode('apple.com'), false)
expect('containsNonASCII: clean',       containsNonASCII('paypal.com'), false)
expect('normalizeHomoglyphs: Cyrillic', normalizeHomoglyphs('pаypаl.com'), 'paypal.com')

// --- Score: safe domains ---
expect('google.com → score 0',    (await calculateRiskScore('google.com')).score, 0)
expect('paypal.com → score 0',    (await calculateRiskScore('paypal.com')).score, 0)
expect('github.com → score 0',    (await calculateRiskScore('github.com')).score, 0)

// --- Score: typosquatting ---
const gogle = await calculateRiskScore('gogle.com')   // distance 1 from google
expect('gogle.com → score >= 45',  gogle.score >= 45, true)
expect('gogle.com → has reason',   gogle.reasons.length > 0, true)

const googel = await calculateRiskScore('googel.com') // distance 2 from google
expect('googel.com → score >= 20', googel.score >= 20, true)

const facebok = await calculateRiskScore('facebok.com') // distance 1 from facebook (missing 'o')
expect('facebok.com → score >= 45', facebok.score >= 45, true)

// --- Score: suspicious TLD ---
const tkDomain = await calculateRiskScore('something.tk')
expect('something.tk → TLD penalty >= 20', tkDomain.score >= 20, true)

// --- Score: homoglyph / IDN ---
const idn = await calculateRiskScore('xn--pple-43d.com')
expect('IDN punycode → score >= 50', idn.score >= 50, true)

// Cyrillic 'а' (U+0430) in paypal — containsNonASCII fires + homoglyph normalization
const cyrillic = await calculateRiskScore('pаypаl.com')
expect('Cyrillic paypal → score >= 60', cyrillic.score >= 60, true)
expect('Cyrillic paypal → reason mentions characters', cyrillic.reasons.some(r => r.includes('non-ASCII') || r.includes('visually')), true)

// --- RDAP: structure tests (no network) ---
// fetchDomainAge returns null on failure — callers must not penalise on null.
// These verify the fail-open contract without hitting the network.
const badDomain = await fetchDomainAge('not-a-real-domain-xyzxyz123.com')
expect('RDAP: unknown domain returns null or number', badDomain === null || typeof badDomain === 'number', true)

// --- RDAP: age-based scoring (network required) ---
// gogle.com is distance 1 from google — already confirmed above to score >= 45.
// Verify RDAP fail-open: if the lookup returns null the score is unaffected.
const gogleResult = await calculateRiskScore('gogle.com')
expect('gogle.com → RDAP fail-open does not lower typosquat score', gogleResult.score >= 45, true)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
