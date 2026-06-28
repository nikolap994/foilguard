# Chrome Web Store — Listing Copy

---

## Name

FoilGuard

## Short description (132 chars max)

Blocks phishing before you reach it — typosquatting, homoglyphs, combosquatting. Runs locally. No account. No API key.

_(116 chars)_

## Category

Security

## Language

English (United States)

---

## Long description

FoilGuard blocks phishing and domain impersonation attacks before the page loads — with no account, no API key, and no browsing data sent to any server.

**What it stops**

• Typosquatting — domains 1–2 characters off a known brand (gogle.com, rnicrosoft.com)
• Digit substitution — leet-speak impersonation (g00gle.com, paypa1.com, amaz0n.com)
• Homoglyph attacks — Cyrillic, Greek, and fullwidth characters that look like Latin letters
• Combosquatting — brand names paired with deceptive keywords (paypal-login.com, amazon-security.com)
• Subdomain abuse — brands used as subdomain labels to impersonate legitimate sites
• Newly registered domains — brand-like names registered in the last 30 days

**How it works**

Every navigation is scored against a risk model in under 1 millisecond — pure local JavaScript, no cloud calls. If the score reaches the threshold, you see a clear warning page before anything loads. You decide: go back safely, or proceed knowing the risk.

Legitimate sites (mail.google.com, accounts.paypal.com, login.microsoft.com) always score 0. Subdomains of known brands are correctly identified and never blocked.

**Privacy first**

The only outbound request is a rate-limited RDAP lookup to rdap.org for newly registered domain checks — your registered domain name only, never the full URL, never the path, never query strings. Results are cached locally for 1 hour. No analytics. No telemetry. No tracking of any kind.

**Enterprise ready**

IT admins can push policy via MDM, Intune, or Group Policy:
• Set a custom block threshold
• Add an internal allowlist or domain blocklist
• Disable the "Proceed anyway" bypass option entirely
• Stream audit events (blocked / bypassed) to a SIEM endpoint

An audit log of all blocked and bypassed navigations is stored locally and exportable as JSON directly from the popup.

**Open source**

FoilGuard is MIT licensed. The full source is on GitHub. No obfuscation, no tracking scripts, no hidden network calls.

---

## Screenshots needed (1280×800 or 640×400)

1. **Popup — safe site** — show the green score circle with "No threats detected." on google.com
2. **Popup — warning** — show yellow/red score with reasons listed (use gogle.com in dev panel)
3. **Warning interstitial** — the full block page for paypal-login.com with score 70 and reason
4. **Popup — audit log** — show the "log" panel open with a few blocked entries
5. **Dev panel** — show scanning rnicrosoft.com and getting [BLOCK] score 65

## Promotional tile (440×280)

Text: "FoilGuard — Block phishing before it loads"
Subtext: "Typosquatting · Homoglyphs · Combosquatting"
Style: dark background (#0a0d14), green accent (#41d07f), monospace font

---

## Privacy practices (required fields in the Store dashboard)

**Does it collect user data?** No

**Single purpose description:**
Detects and blocks domain impersonation attacks (typosquatting, homoglyphs, combosquatting) by scoring the domain of each navigation locally before the page loads.

**Permissions justification:**

| Permission | Reason |
|---|---|
| `tabs` | Read the current tab's URL to score the domain and update the popup |
| `storage` | Cache RDAP results (session), store audit log (local), read admin policy (managed) |
| `webNavigation` | Intercept navigation before pages load to score and optionally block |
| `host_permissions: <all_urls>` | Required to intercept navigation on any domain |
