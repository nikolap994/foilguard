# FoilGuard — Chrome Web Store Listing

## Name
FoilGuard

## Short description (132 chars max)
Blocks typosquatting, homoglyph, and combosquatting attacks before the page loads. No account. No API key. Fully local.

## Category
Productivity → Security

## Language
English

---

## Full description

FoilGuard protects you from domain impersonation attacks — the technique behind the majority of phishing campaigns. Before a page loads, FoilGuard scores the domain and blocks it if it looks like it's impersonating a real brand.

**What it detects:**
• Typosquatting — domains one or two characters off from real brands (gogle.com, rnicrosoft.com)
• Digit substitution — leet-speak replacements (paypa1.com, g00gle.com)
• Look-alike characters — Cyrillic, Greek, and other scripts visually identical to Latin letters
• Combosquatting — real brand name combined with deceptive words (paypal-login.com, amazon-security.com)
• Newly registered domains — brand-like domains registered in the last 30 days
• Subdomain abuse — suspicious use of subdomains to mimic real sites
• Redirect chain attacks — pages reached through 3+ rapid automatic redirects
• Plain-HTTP brand impersonation — known brands served over unencrypted HTTP

**What it does not do:**
• Does not send your browsing history anywhere
• Does not require an account or API key
• Does not use third-party analytics or telemetry
• Legitimate sites are never blocked — mail.google.com, accounts.paypal.com score 0

**Features:**
• Risk score 0–100 shown in the popup for any site you visit
• Quick scan — check any domain before clicking (right-click menu or popup search bar)
• Audit log — every blocked domain logged with timestamp and reason, export as JSON or CSV
• Allowlist / blocklist — fine-grained per-domain control
• Drive-by popup blocker — suppresses window.open() abuse from suspicious pages
• Google Safe Browsing integration — optional, bring your own API key (10k lookups/day free)
• Enterprise MDM policy support — deploy and lock settings via Google Admin
• Side panel — scan links without leaving the current page (Chrome 114+)
• Weekly digest notification — summary of threats blocked over the past 7 days
• Firefox compatible — install the Firefox build from the GitHub releases page

**Privacy:**
All detection runs locally in your browser. The only network request FoilGuard makes is a once-daily fetch of an updated domain list from its public GitHub repository — no personal data included. Google Safe Browsing is opt-in with your own key. Full privacy policy: foilsuite.netlify.app/privacy

**Open source:**
Full source code at github.com/nikolap994/foilguard — MIT licensed.

---

## Screenshots needed

1. **Popup — safe site:** Score circle shows 0 with a green ring. Dashboard with today's block count.
2. **Popup — blocked domain:** Score circle shows 85 in red. Reason list explaining the signals.
3. **Warning page:** Full interception page with domain, risk score, reason list, Go back / Proceed buttons.
4. **Options page:** Block threshold slider, allowlist/blocklist editors, Safe Browsing API field, export.
5. **Audit log:** List of blocked domains with action type, timestamp, JSON/CSV export buttons.

## Promotional tile (440×280)
Background: #08090d
FoilGuard logo centered
Tagline: "Block domain impersonation — before the page loads"

---

## URLs

- **Privacy policy:** https://foilsuite.netlify.app/privacy
- **Homepage:** https://foilsuite.netlify.app
- **Support:** https://github.com/nikolap994/foilguard/issues
