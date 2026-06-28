# FoilGuard Privacy Policy

_Last updated: 2026-06-28_

---

## Summary

FoilGuard does not collect, transmit, or sell any personal data. The only outbound network request it makes is a domain age lookup described below.

---

## What data is processed

### Domain names (RDAP lookup)

When you navigate to a website that FoilGuard identifies as potentially brand-similar, it may perform a single RDAP (Registration Data Access Protocol) lookup to check how recently the domain was registered.

- **What is sent:** the registered domain name only (e.g. `evil.com`) — never the full URL, never the path, never query strings, never cookies, never your IP address beyond what any HTTP request carries
- **Where it is sent:** `rdap.org`, a public RDAP aggregator operated by ARIN. Their privacy policy is at https://www.arin.net/participate/intl/privacy/
- **When it is sent:** only for domains that score above a minimum threshold on other signals, and only once per domain per hour (results are cached locally)
- **What happens to it:** the result (domain registration age in days) is stored in `chrome.storage.session` on your device and discarded when the browser closes

All other scoring (typosquatting, homoglyphs, combosquatting, subdomain abuse) happens entirely on your device with no outbound communication of any kind.

### Audit log (local only)

If navigation is blocked or you choose to proceed past a warning, FoilGuard stores a record in `chrome.storage.local` on your device:

- Timestamp
- Domain name
- Risk score
- Risk reasons (text)
- Action taken (blocked / bypassed / warned)

This data never leaves your device unless you manually export it using the popup's "Export log as JSON" button, or unless an enterprise admin has configured a `reportingEndpoint` policy (see below).

---

## Enterprise deployments

If your organisation has deployed FoilGuard with a managed policy that includes a `reportingEndpoint`, audit events are forwarded to that URL via HTTPS POST. The data sent is identical to the local audit log entry described above. This is configured and controlled entirely by your organisation's IT administrator.

---

## What we do NOT collect

- Your browsing history
- Full URLs or page content
- Search queries
- Passwords or credentials
- Location data
- Device identifiers
- Analytics or usage metrics of any kind

---

## Data retention

- RDAP cache: cleared when the browser session ends (uses `chrome.storage.session`)
- Audit log: stored until you clear extension data or until the ring-buffer capacity (500 entries) is exceeded, at which point the oldest entries are removed

---

## Third-party services

The only third-party service FoilGuard contacts is `rdap.org`. No other services, SDKs, or analytics tools are included.

---

## Changes

If this policy changes materially, the extension version will be incremented and the "Last updated" date above will be revised.

---

## Contact

For questions about privacy: open an issue at https://github.com/nikolap994/foilguard
