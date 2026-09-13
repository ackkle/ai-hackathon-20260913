# Issue #2 Foundation Implementation Plan

**Goal:** Give three contributors a runnable Next.js/OpenNext foundation, frozen shared data contracts, safe browser persistence, and all 22 route shells.

**Architecture:** Thin App Router pages link through the approved flow. Shared Zod schemas validate schemaVersion 2 state. Storage returns explicit errors and never silently overwrites unreadable records. Cloudflare Workers hosts the Next.js Node runtime through OpenNext.

**Tech Stack:** Next.js, React, TypeScript, Tailwind, Zod, OpenNext Cloudflare, Wrangler, Vitest.

**Spec:** `docs/specs/mvp-spec.md` sections 7, 9, 11, 13, 14; GitHub Issue #2; `CLAUDE.md`.

## Constraints

- Work on `feat/issue-2-foundation`; submit PRs, never push directly to main or self-merge.
- Preserve other contributors' pages and files; route shells only are authorized by #2.
- Storage key `reserve-machine:v2`, schemaVersion 2; secrets ignored.
- F-18 and F-31 start off; G features start concept. Other unfinished features start mock.
- 360px viewport, visible sample labels, no false calendar success.

## Execution

- [ ] Scaffold Next.js and configure OpenNext, scripts and ignored environment files. The C3 attempt produced a generic Worker and failed during npm install; use the official existing-app OpenNext setup on a create-next-app scaffold instead.
- [ ] Add `src/shared/types/index.ts` with state and AI payload schemas, `src/shared/storage/index.ts` with `load`, `save`, `clear`, and `src/config/features.ts`. Verify missing/invalid state, round-trip retention, failed writes, and distinct empty states through Vitest tests written first.
- [ ] Share the frozen contract in a small prerequisite PR after tests and typecheck. Do not mark #2 complete until deployment and route verification are done.
- [ ] Add layout/CSS and 22 individually addressable route shells; include the sample banner and settings diagnostics. Keep shared UI owned by contributor B untouched.
- [ ] Verify `npm test`, `npm run lint`, `npm run typecheck`, Next build, Next dev and Worker preview. Visit all route shells and inspect at 360px.
- [ ] Deploy the authorized project to Cloudflare, verify returned URL, document commands and shared interfaces in README. If authentication is missing, complete local verification and request only the needed login.
- [ ] Fetch/rebase latest main, publish PR with evidence, hand review/merge to another member per CLAUDE.md. Leave issue open until acceptance criteria and merge are satisfied.
