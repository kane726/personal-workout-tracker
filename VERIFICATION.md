# Verification report

Verified on August 23, 2026 with Node.js 22.

## Automated tests

Command represented by the package script: `node --import tsx --test src/tests/*.test.ts`

- Tests: 14
- Passed: 14
- Failed: 0
- Skipped: 0

The passing cases cover exclusion state, draft behavior, substitution eligibility, inherited slot targets, load-field modes, exact template rendering, authenticated-user RLS policy coverage, and GitHub Pages navigation/build configuration.

## Production build

The production gate ran TypeScript project compilation followed by the Vite production build.

- TypeScript compilation: passed
- Vite build: passed
- Modules transformed: 80
- Output: `dist/index.html` plus versioned CSS, JavaScript, and source-map assets

## Environment-dependent validation

No live Supabase project or GitHub repository was supplied with the build request. Therefore, the migration was not applied to a remote database, a real email magic link was not delivered, and the GitHub Pages workflow was not deployed to a live repository during this build. Exact setup and verification steps for those environment-dependent actions are in `README.md`.
