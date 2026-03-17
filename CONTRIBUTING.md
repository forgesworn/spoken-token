# Contributing to spoken-token

## Setup

```bash
git clone https://github.com/TheCryptoDonkey/spoken-token.git
cd spoken-token
npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | ESLint with auto-fix |

## Code conventions

- **British English** — colour, initialise, behaviour
- **ESM-only** — `import`/`export`, no CommonJS
- **Zero runtime dependencies** — all crypto is pure JS
- Commit messages use `type: description` format (`fix:`, `feat:`, `docs:`, `refactor:`, `test:`)

## Testing

Tests are co-located with source files in `src/` (e.g. `token.ts` + `token.test.ts`). Write a failing test first, then implement.

```bash
npm test              # run once
npm run test:watch    # watch mode
```

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

## Pull requests

1. Create a branch from `main`
2. Make your changes with tests
3. Ensure `npm test`, `npm run typecheck`, and `npm run lint` all pass
4. Submit a PR against `main`

## Releases

Automated via semantic-release on push to `main`. Use conventional commit types to control version bumps:

| Type | Version bump |
|------|-------------|
| `fix:` | Patch |
| `feat:` | Minor |
| `BREAKING CHANGE:` in body | Major |
| `docs:`, `chore:`, `refactor:` | None |
