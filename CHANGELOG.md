# Changelog

All notable changes to FoilGuard are documented here.

---

## [0.4.0] — 2026-06-30

### Added
- **Benchmark script** (`scripts/benchmark.mjs`) — 66 labeled domains (33 phishing + 33 legitimate); reports precision, recall, F1, FPR, and confusion matrix; run with `npm run benchmark` or `--verbose`
- **Detection architecture blog post** — published to FoilSuite site; covers 6-signal scoring, weight rationale, and benchmark results (97% precision, 90.9% recall, 93.8% F1, 3% FPR)
- **Firefox CI job** — second GitHub Actions job builds the Firefox artifact (`npm run build:firefox`) on every push
- **Test step in CI** — Chrome build job now runs `npm test` (51 detection tests) before completing

### Changed
- CI `node-version`: 20 → 22 (Astro and modern tooling require ≥22.12.0)
- CONTRIBUTING.md: added Firefox build and load instructions (`about:debugging → Load Temporary Add-on`)

---

## [0.3.0] — 2026-06-28

### Added
- **Onboarding page** — opens automatically on first install, explains what FoilGuard does and confirms protection is active
- **Options page** — personal allowlist, personal blocklist, and custom block threshold (no MDM required)
- **Context menu** — right-click any link → "Check this link with FoilGuard" → instant risk notification
- **Keyboard shortcut** — `Alt+Shift+F` opens the popup
- **Firefox support** — `browser_specific_settings` in manifest; compatible with Firefox 109+

### Changed
- Popup: dev panel removed from user-facing UI; replaced ⚙ icon with direct link to options page
- Popup: audit toggle relabelled to "log" for clarity
- All warning page reason messages rewritten in plain English (no security jargon)
- Warning page logo: now uses 48px icon (was 16px, appeared blurry); header opacity removed
- Policy layer: personal options page settings now merged below managed policy

---

## [0.2.0] — 2026-06-28

### Added
- **Navigation blocking** — high-risk domains are intercepted by `onBeforeNavigate` before the page loads (was warn-only in 0.1)
- **Warning interstitial** — full-page block screen with score, domain, reason list, and go-back / proceed buttons
- **Combosquatting detection** — flags brand + phishing-keyword hyphenated domains (`paypal-login.com`, `amazon-security.com`)
- **Digit substitution detection** — catches leet-speak impersonation (`g00gle.com`, `paypa1.com`, `amaz0n.com`)
- **Subdomain abuse detection** — flags brand names used as subdomain labels (`paypal.evil.com`)
- **Expanded homoglyph map** — 60+ Cyrillic, Greek, Latin variant, and fullwidth ASCII mappings
- **PSL-aware eTLD+1 extraction** — `mail.google.com` correctly resolves to `google.com`; never false-positive on legitimate subdomains
- **Enterprise policy** (`chrome.storage.managed`) — `blockThreshold`, `reportOnly`, `disableBypass`, `customAllowlist`, `customBlocklist`, `reportingEndpoint`
- **Audit log** — ring-buffered (500 entries) in `chrome.storage.local`; viewable and exportable as JSON from popup
- **Audit log viewer** in popup — toggle panel, last 10 entries, export button
- **RDAP domain age check** — brands registered within 30 days get +40 to score
- **RDAP session cache** — persists across service worker restarts via `chrome.storage.session`
- **RDAP rate limiter** — max 2 concurrent outbound lookups to avoid hammering rdap.org
- **Top-domains JSON** — brand list moved from inline TypeScript to `src/data/top-domains.json`
- **CI test step** — 51 detection engine tests run on every push via GitHub Actions

### Changed
- Score weights updated: dist-1 typosquatting +75 (was +40), dist-2 +65 (was +20)
- Block threshold: 65 (default, configurable via policy)
- `TOP_DOMAINS` converted from `string[]` to `Set<string>` — O(1) brand lookups throughout detection
- Levenshtein loop adds length-based pruning — skips brands whose length difference exceeds the min detectable distance
- Manifest description updated to reflect blocking capability

### Fixed
- `mail.google.com` was scoring 45 — now scores 0 (subdomain extraction fix)
- `rnicrosoft.com` was scoring 20 — now scores 65+ (dist-2 weight raised)
- `g00gle.com` was scoring 20 — now scores 70 (digit substitution detection added)
- `managed-schema.json` missing from dist — moved to `public/` so Vite copies it

---

## [0.1.0] — 2026-06-01

### Added
- Initial release
- Typosquatting detection via Levenshtein distance
- Basic homoglyph detection (10 mappings)
- Badge score display in popup
- Dev panel with manual domain tester
- Build pipeline with Vite + `@crxjs/vite-plugin`
