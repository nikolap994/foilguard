# Contributing to FoilGuard

Thank you for your interest. FoilGuard is a focused security tool — contributions that improve detection accuracy, reduce false positives, or extend enterprise support are most welcome.

---

## Before you start

- Check [existing issues](https://github.com/nikolap994/foilguard/issues) to avoid duplicate work
- For significant changes, open an issue first to discuss the approach
- All code must pass the existing 51 tests plus any new ones you add

## Setup

```bash
git clone https://github.com/nikolap994/foilguard
cd foilguard
npm install
npm run dev       # Watch mode — rebuilds on save
npm test          # Run detection tests (no browser required)
npm run type-check
npm run lint
```

Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Contribution areas

### High value
- **New homoglyph mappings** — extend `src/lib/detection/homoglyph.ts` with visually confusable characters, especially non-Latin scripts. Add test cases in `scripts/test-detection.mjs`.
- **Brand list expansion** — add brands to `src/data/top-domains.json`. Entries are bare domain names without TLD (e.g. `"paypal"`, not `"paypal.com"`). Prefer high-value, commonly impersonated brands.
- **False positive reports** — open an issue with the domain and the score FoilGuard assigned. Include the full URL if it's public.
- **Detection test cases** — add edge cases to `scripts/test-detection.mjs` that cover real-world phishing patterns you've seen.

### Policy / enterprise
- Additional managed policy keys documented in `public/managed-schema.json`
- SIEM integration improvements in `src/lib/audit.ts`

### Out of scope
- User tracking, analytics, or telemetry — FoilGuard is and will remain privacy-first
- Server-side components — detection is intentionally 100% local (except the rate-limited RDAP lookup)
- UI redesigns without a concrete UX problem to solve

## Testing

All PRs must keep the 51 tests green. Add new tests for any new detection signal.

```bash
npm test
```

Tests run in Node.js via `tsx` with a mock `chrome` global — no browser needed. See the top of `scripts/test-detection.mjs` for the mock structure if you need to add new `chrome.*` calls.

## Code style

- TypeScript strict mode
- No runtime dependencies — detection is vanilla JS
- No comments explaining what the code does; only add one if the WHY is non-obvious
- Run `npm run lint` and `npm run type-check` before submitting

## PR checklist

- [ ] `npm test` passes (51+ tests green)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes  
- [ ] New detection signals have at least 2 test cases (a positive and a negative)
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] No new runtime dependencies added

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
