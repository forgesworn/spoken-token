# CLAUDE.md — spoken-token

TOTP but you say it out loud. Generic spoken verification tokens from a shared secret.

## Commands

- `npm run build` — compile TypeScript to dist/
- `npm test` — run all tests (vitest)
- `npm run test:watch` — watch mode
- `npm run typecheck` — type-check without emitting
- `npm run lint` — run ESLint
- `npm run lint:fix` — run ESLint with auto-fix

## Dependencies

**Zero runtime dependencies.** Pure JS SHA-256, HMAC-SHA256, and encoding.

## Structure

- `src/token.ts` — core derivation: `derive(secret, context, counter)` → token bytes
- `src/verify.ts` — verification with tolerance window
- `src/encoding.ts` — output encoding (words, PIN, hex)
- `src/wordlist.ts` — 2048-word en-v1 spoken-clarity wordlist
- `src/counter.ts` — time-based counter derivation (`getTimeCounter`)
- `src/crypto.ts` — pure JS SHA-256, HMAC-SHA256, hex/base64 utilities
- `src/index.ts` — barrel re-export
- `PROTOCOL.md` — full protocol specification v2.0 (SPOKEN-DERIVE, SPOKEN-ENCODE)

## v2.0 Breaking Changes

These architectural decisions are non-obvious and must not be reverted:

- **PIN encoding** uses a `PIN_BYTES` lookup table (not a formula) to keep max per-value bias below 1% for all digit counts. The old `ceil(digits × 0.415)` formula had ~40% bias at 7 digits.
- **Directional pairs** use a `"pair\0"` context prefix (`pair\0namespace\0role`) to cryptographically isolate them from identity-bound tokens (`context\0identity`).
- **Whitespace-only** context strings, namespaces, and roles are rejected.

## Conventions

- **British English** — colour, initialise, behaviour, licence
- **ESM-only** — `"type": "module"` in package.json
- **TDD** — write failing test first, then implement
- **Zero dependencies** — all crypto is pure JS, no external packages
- **Git:** commit messages use `type: description` format
- **Git:** Do NOT include `Co-Authored-By` lines in commits

## Release & Versioning

**Automated via [forgesworn/anvil](https://github.com/forgesworn/anvil)** — `auto-release.yml` reads conventional commits on push to `main`, bumps the version, and creates a GitHub Release; `release.yml` then runs the pre-publish gates and publishes to npm via OIDC trusted publishing.

| Type | Example | Version Bump |
|------|---------|--------------|
| `fix:` | `fix: handle counter overflow` | Patch (1.0.x) |
| `feat:` | `feat: add encoding format` | Minor (1.x.0) |
| `BREAKING CHANGE:` | In commit body | Major (x.0.0) |
| `chore:`, `docs:`, `refactor:` | `docs: update README` | None |

Tests must pass before release.

## Relationship to canary-kit

`spoken-token` is the generic core extracted from `canary-kit`. It handles derivation, encoding, and verification. `canary-kit` extends it with duress signalling, liveness monitoring, group management, Nostr transport, and threat-profile presets.
