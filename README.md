# FoilGuard

Browser extension that detects and **blocks** domain impersonation attacks before the page loads — typosquatting, homoglyphs, digit substitution, combosquatting, and subdomain abuse. Runs entirely locally. No API key, no account, no browsing history sent anywhere.

> Part of the [Foil](../) security suite.

---

## What it does

When you navigate to any HTTP/HTTPS URL, FoilGuard scores the domain against five attack signals. If the score reaches the block threshold (default 65/100), navigation is redirected to a warning interstitial **before the page loads**. You can go back safely or proceed at your own risk.

For legitimate known brands (google.com, paypal.com, etc.) the score is always 0 — no false positives on the sites you actually use.

---

## Detection signals

| Signal | Example | Score |
|---|---|---|
| **Typosquatting** — 1 char off a known brand | `gogle.com` | +75 |
| **Typosquatting** — 2 chars off a known brand | `rnicrosoft.com` | +65 |
| **Digit substitution** — leet-speak impersonation | `g00gle.com`, `paypa1.com` | +70 |
| **Homoglyph (IDN/punycode)** | `xn--pple-43d.com` | +60 |
| **Homoglyph (raw Unicode)** — Cyrillic/Greek/fullwidth | `pаypаl.com` (Cyrillic а) | +40–50 |
| **Combosquatting** — brand + deceptive keyword | `paypal-login.com`, `amazon-security.com` | +70 |
| **Subdomain abuse** — brand used as subdomain label | `paypal.evil.com` | +35 |
| **Suspicious TLD** | `.tk`, `.xyz`, `.top`, `.ml` | +20 |
| **Newly registered** — RDAP age < 30 days + brand-like | any of the above, newly registered | +40 |

Scores cap at 100. Signals combine — a newly registered combosquatting domain on a suspicious TLD can hit 100.

---

## Subdomains are handled correctly

`mail.google.com`, `accounts.google.com`, `login.microsoft.com` all score 0. The extension extracts the registrable domain (eTLD+1) using a built-in compound suffix list before scoring, so legitimate subdomains of known brands are never flagged.

---

## How it works

```
onBeforeNavigate fires
       │
       ▼
calculateRiskScoreSync(hostname)     ← pure JS, no network, < 1ms
       │
       ├── score < 65  →  allow through
       │
       └── score ≥ 65  →  redirect to warning interstitial
                              │
                  ┌───────────┴───────────┐
                  │                       │
            [Go back]           [Proceed anyway]
                                    │
                          session bypass stored for domain

onCompleted fires
       │
       ▼
calculateRiskScore(hostname)         ← adds RDAP domain age check
       │
       └── updates badge + stores result for popup
```

No backend. No server. The only outbound call is a rate-limited RDAP lookup to `rdap.org` — registered domain name only, never the full URL. Results are cached in `chrome.storage.session` for 1 hour.

---

## Enterprise features

FoilGuard supports managed deployment via `chrome.storage.managed` (MDM / Group Policy / Intune). IT admins push a JSON policy with no user interaction required:

```json
{
  "blockThreshold": 65,
  "reportOnly": false,
  "disableBypass": true,
  "customAllowlist": ["internal-tool.company.com"],
  "customBlocklist": ["known-phishing.com"],
  "reportingEndpoint": "https://siem.company.internal/foilguard"
}
```

| Key | Type | Description |
|---|---|---|
| `blockThreshold` | `integer` 0–100 | Score at which navigation is blocked (default 65) |
| `reportOnly` | `boolean` | Log without blocking — for staged rollout monitoring |
| `disableBypass` | `boolean` | Remove "Proceed anyway" — no user override possible |
| `customAllowlist` | `string[]` | Domains never flagged regardless of score |
| `customBlocklist` | `string[]` | Domains always blocked, bypass not possible |
| `reportingEndpoint` | `string` | POST audit events to a SIEM/webhook URL |

**Audit log:** every blocked / bypassed / warned event is stored in `chrome.storage.local` (ring-buffered at 500 entries). Viewable and exportable as JSON from the popup.

---

## Tech stack

| Layer | Technology |
|---|---|
| Extension | TypeScript + Manifest V3 |
| Bundler | Vite + `@crxjs/vite-plugin` |
| Detection | Levenshtein, Unicode normalization, domain parsing — vanilla JS, zero runtime dependencies |
| Domain age | RDAP via `rdap.org` — domain name only, rate-limited, session-cached with 1h TTL |
| Enterprise config | `chrome.storage.managed` |
| Audit log | `chrome.storage.local` |
| CI | GitHub Actions — security audit, type-check, lint, 51 detection tests, build |

---

## Security standards

- Detection runs **entirely in the browser** — no data leaves the device except the RDAP lookup
- RDAP sends only the **registered domain** (e.g. `evil.com`), never the full URL path or query string
- All RDAP traffic over TLS
- Strict **Content Security Policy** on all extension pages — no inline scripts, no `eval`
- `npm audit` runs in CI on every PR, blocking on high-severity findings
- No analytics, no telemetry, no tracking of any kind

---

## Development

```bash
npm install
npm run dev        # Vite watch mode — rebuilds on save
npm run build      # Production build → dist/
npm run type-check # TypeScript strict check
npm run lint       # ESLint
npm test           # 51 detection engine tests, no browser needed
```

Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

---

## Project structure

```
src/
  background/       Service worker — navigation interception + badge updates
  lib/
    detection/      Core algorithms (Levenshtein, homoglyphs, score, RDAP)
    audit.ts        Audit log
    policy.ts       Managed storage policy reader
  popup/            Extension popup
  warning/          Navigation block interstitial
  data/
    top-domains.json   ~200 high-value brand targets used for detection
public/
  managed-schema.json  Chrome managed storage schema (for IT admin tooling)
scripts/
  test-detection.mjs   Detection smoke tests
```

---

## License

MIT — see [LICENSE](LICENSE).
