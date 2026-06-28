## What this changes

<!-- Brief description of what this PR does and why -->

## Type of change

- [ ] Bug fix (wrong score, false positive/negative, extension malfunction)
- [ ] New detection signal
- [ ] Performance improvement
- [ ] Enterprise / policy feature
- [ ] Docs / test only

## Checklist

- [ ] `npm test` passes (all tests green)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] New detection signals have test cases (positive + negative)
- [ ] No runtime dependencies added
- [ ] `CHANGELOG.md` updated

## Test cases added / changed

<!-- List the test domains and expected scores you added or modified -->

| Domain | Expected score | Signal tested |
|---|---|---|
| | | |

## False positive / negative verification

<!-- If this touches scoring weights or the brand list, confirm these still score correctly -->

- `mail.google.com` → 0
- `google.com` → 0
- `gogle.com` → ≥ 65
- `g00gle.com` → ≥ 65
- `paypal-login.com` → ≥ 65
