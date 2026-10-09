# Verification report

Verified on September 1, 2026.

## Automated tests

Command run:

```bash
npm test
```

- Tests: 25
- Passed: 25
- Failed: 0
- Cancelled: 0
- Skipped: 0

The passing cases cover existing exclusion, substitution, template, security, and GitHub Pages behavior plus:

- every five-minute timer phase boundary;
- the prominent Exercise 2 and next-round visual notifications;
- no automatic round-timer restart;
- overall timer start, pause, resume, and pause exclusion;
- timestamp-based state restoration;
- saved workout duration and legacy `null` duration display;
- all 47 stable exercise IDs, 44 researched links, and 3 explicit unresolved entries;
- additive migration parity with application catalog data; and
- safe new-tab link attributes and the unresolved-link fallback.

## Production build

Command run:

```bash
npm run build
```

- TypeScript compilation: passed
- Vite production build: passed
- Modules transformed: 84
- Output: `dist/index.html`, versioned CSS, JavaScript, and source-map assets

## Migration audit

- The SHA-256 digest of `202608230001_initial_workout_schema.sql` matches the attached source ZIP exactly: `4ff42ded553c4e5da495067bdd36d50e9c517942f76d9727c1a05111f78cb337`.
- The new `202609010001_add_workout_duration_and_demonstration_links.sql` migration is additive.
- Existing rows retain a `null` duration, and Row Level Security policies are not changed.

## Environment-dependent validation

No access to the user’s live Supabase project or GitHub repository was provided. The migration was not applied remotely, authenticated browser flows were not exercised against production data, and the GitHub Pages workflow was not deployed. Exact SQL Editor application and verification steps are in `README.md`.
