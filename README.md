# FoilGuard

Browser extension for detecting domain impersonation attacks — runs locally, no API key required, no URLs sent to external servers.

> Part of the [Foil](../) security suite.

---

## Goals

1. **Protect users before they enter credentials** on a fake site that visually or textually imitates a legitimate one
2. **Works without configuration** — install and forget, no account, no API key
3. **Preserves privacy** — URLs are never sent anywhere except to the standardized RDAP server for domain age checks
4. **Builds brand and user base** for other Foil products via in-extension links

---

## Target audience

| Segment | Description |
|---------|-------------|
| **Primary** | Technical users who want active protection without sending browsing data to an external service |
| **Secondary** | General users who install a security extension on recommendation — zero configuration needed |
| **Distribution** | CTF community (FoilLab) and security enthusiasts who are natural early adopters |

---

## Tech stack

| Layer | Technology | Why |
|-------|------------|-----|
| Extension | **TypeScript** + Manifest v3 | Type safety, modern Chrome API, long-term support |
| Detection | Vanilla algorithms (Levenshtein, Unicode normalization) | No dependencies, works offline |
| Backend | **Node.js** + Express | Lightweight RDAP lookup microservice |
| Cache | In-memory → Redis (when scaling) | Avoids redundant RDAP calls for the same domain |
| CI/CD | **GitHub Actions** | Automated lint, build, and Chrome Web Store packaging |
| Bundler | **Vite** | Fast, lightweight extension bundling |

---

## What it detects

- **Typosquatting** — Levenshtein distance ≤ 2 against the top 5,000 known domains
- **Homoglyph attacks** — Unicode characters that visually resemble Latin letters (e.g. Cyrillic `а` vs Latin `a`)
- **Newly registered domains** — RDAP age < 30 days combined with a brand-like name
- **Suspicious TLDs** — `.tk`, `.xyz`, `.top`, `.ml`, `.ga` combined with a brand keyword in the domain

**Output:** Risk score 0–100 displayed as a badge on the extension icon (green / yellow / red) with an explanation popup.

---

## Security standards

- All RDAP communication over **TLS 1.3** exclusively
- No user URLs are logged or persisted on the backend
- Risk score is calculated locally — backend receives only the domain, never the full URL path
- Strict **Content Security Policy** in `manifest.json` prevents XSS in extension UI
- `npm audit` runs in CI on every PR

---

## Integration with other Foil projects

- Popup includes a link to **FoilLab** ("Test your skills →")
- **FoilVault** calls the FoilGuard risk API before every autofill and blocks if score > 60
