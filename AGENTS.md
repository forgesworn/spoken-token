# AGENTS.md: spoken-token

Instructions for AI coding agents working on this project.

## What this project does

TOTP but you say it out loud. Derive time-rotating, human-speakable verification tokens from a shared secret. Zero runtime dependencies, ESM-only, works in Node.js and the browser.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | ESLint with auto-fix |

## Structure

| File | Purpose |
|------|---------|
| `src/token.ts` | Core derivation: `deriveToken`, `deriveDirectionalPair` |
| `src/verify.ts` | Verification with tolerance window |
| `src/encoding.ts` | Output encoding (words, PIN, hex) |
| `src/wordlist.ts` | 2048-word en-v1 spoken-clarity wordlist |
| `src/counter.ts` | Time-based and event-ID counter derivation |
| `src/crypto.ts` | Pure JS SHA-256, HMAC-SHA256, hex/base64 utilities |
| `src/index.ts` | Barrel re-export |
| `PROTOCOL.md` | Full protocol specification v2.0 (SPOKEN-DERIVE, SPOKEN-ENCODE) |

## Subpath Exports

- `spoken-token`: full API (barrel re-export)
- `spoken-token/counter`: `getCounter`, `counterFromEventId`, `counterToBytes`
- `spoken-token/wordlist`: `WORDLIST`, `WORDLIST_SIZE`, `getWord`, `indexOf`
- `spoken-token/encoding`: `encodeAsWords`, `encodeAsPin`, `encodeAsHex`, `encodeToken`
- `spoken-token/crypto`: `sha256`, `hmacSha256`, `randomSeed`, `hexToBytes`, `bytesToHex`, `timingSafeEqual`, `timingSafeStringEqual`

## v2.0 Breaking Changes

These architectural decisions are non-obvious and must not be reverted:

- PIN encoding uses a `PIN_BYTES` lookup table (not a formula) to keep max per-value bias below 1% for all digit counts. The old `ceil(digits x 0.415)` formula had ~40% bias at 7 digits.
- Directional pairs use a `"pair\0"` context prefix (`pair\0namespace\0role`) to cryptographically isolate them from identity-bound tokens (`context\0identity`).
- Whitespace-only context strings, namespaces, and roles are rejected.

## Conventions

- British English: colour, initialise, behaviour, licence
- ESM-only: `import`/`export`, no CommonJS (`"type": "module"` in package.json)
- Zero runtime dependencies: all crypto is pure JS, no external packages
- TDD: write a failing test first, then implement
- Tests are co-located: `token.ts` + `token.test.ts`
- Commit messages use `type: description` format (`fix:`, `feat:`, `docs:`, `refactor:`, `test:`)
- Do not include `Co-Authored-By` lines in commits

## Security Notes

- Token verification uses timing-safe comparison (`timingSafeStringEqual`)
- HMAC intermediate buffers and SHA-256 working state are zeroed after use
- `randomSeed()` returns a 64-char hex string (32 bytes) via `crypto.getRandomValues`

## Verifying changes

Always run before submitting:

```bash
npm test && npm run typecheck && npm run lint
```

## Key Pitfalls

- PIN bias: the `PIN_BYTES` lookup table is carefully calibrated; do not replace it with a formula
- Pair prefix: the `"pair\0"` context prefix in `deriveDirectionalPair` prevents collision with identity-bound tokens; do not remove it
- Whitespace rejection: empty and whitespace-only context strings, namespaces, and roles are rejected by design
- Counter range: counters are uint32 (0 to 4,294,967,295); negative, fractional, and overflow values throw `RangeError`

## Release process

Automated via [forgesworn/anvil](https://github.com/forgesworn/anvil): `auto-release.yml` reads conventional commits on push to `main`, bumps the version, and creates a GitHub Release; `release.yml` then runs the pre-publish gates and publishes to npm via OIDC trusted publishing.

| Type | Example | Version Bump |
|------|---------|--------------|
| `fix:` | `fix: handle counter overflow` | Patch (1.0.x) |
| `feat:` | `feat: add encoding format` | Minor (1.x.0) |
| `BREAKING CHANGE:` | In commit body | Major (x.0.0) |
| `chore:`, `docs:`, `refactor:` | `docs: update README` | None |

Tests must pass before release.

## Related projects

- canary-kit extends spoken-token with duress signalling, liveness monitoring, group management, and Nostr transport. It is the generic core extracted from canary-kit: spoken-token handles derivation, encoding, and verification.
