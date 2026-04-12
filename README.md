# spoken-token

**Nostr:** [`npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`](https://njump.me/npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2)

[![CI](https://github.com/forgesworn/spoken-token/actions/workflows/ci.yml/badge.svg)](https://github.com/forgesworn/spoken-token/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/spoken-token)](https://www.npmjs.com/package/spoken-token)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/TheCryptoDonkey?logo=githubsponsors&color=ea4aaa&label=Sponsor)](https://github.com/sponsors/TheCryptoDonkey)

TOTP but you say it out loud — derive time-rotating, human-speakable verification tokens from a shared secret.

```
npm install spoken-token
```

Zero runtime dependencies. ESM-only. Works in Node.js and the browser.

## Why spoken-token?

TOTP gives you a 6-digit code on a screen — great for typing into a website, useless for saying over a phone call. Digits are hard to speak, easy to mishear, and carry no meaning.

spoken-token replaces digits with words from a curated 2048-word English wordlist — no homophones, no phonetic near-collisions, 3–8 characters each. The derivation is the same (HMAC over a counter), but the encoding is optimised for the human voice.

---

## Quick start

### Rideshare pickup

The app derives the same word on both sides. Rider reads it aloud; driver confirms.

```typescript
import { deriveToken, getCounter } from 'spoken-token'

const counter = getCounter(Date.now() / 1000) // rotates every 7 days by default

const word = deriveToken(sharedSecret, 'rideshare:pickup', counter)
// → 'carbon'
```

### Phone call auth

Two roles, two different words — neither party can parrot the other.

```typescript
import { deriveDirectionalPair, getCounter } from 'spoken-token'

const counter = getCounter(Date.now() / 1000, 30) // 30-second rotation

const { caller, agent } = deriveDirectionalPair(sharedSecret, 'support-call', ['caller', 'agent'], counter)
// caller hears: 'timber'
// agent says:   'canyon'
```

### Courier handoff

Verify a spoken word against a secret without transmitting the secret.

```typescript
import { verifyToken, getCounter } from 'spoken-token'

const counter = getCounter(Date.now() / 1000)
const result = verifyToken(sharedSecret, 'courier:handoff', counter, spokenWord, undefined, { tolerance: 1 })

if (result.status === 'valid') {
  console.log('Package accepted')
}
```

---

## API

### `deriveToken(secret, context, counter, encoding?, identity?)`

Derive an encoded token string.

| Param | Type | Description |
|-------|------|-------------|
| `secret` | `Uint8Array \| string` | Shared secret (hex string or bytes, min 16 bytes) |
| `context` | `string` | Domain separation string |
| `counter` | `number` | Time-based or usage counter (uint32) |
| `encoding` | `TokenEncoding` | Output format (default: single word) |
| `identity` | `string?` | Optional per-member identifier |

### Identity binding with nsec-tree

When using [nsec-tree](https://github.com/forgesworn/nsec-tree) for deterministic
sub-identity derivation, a persona's npub makes a natural identity parameter —
different personas produce different tokens from the same group secret:

```typescript
import { deriveToken } from 'spoken-token'
import { fromMnemonic } from 'nsec-tree/mnemonic'
import { derivePersona } from 'nsec-tree/persona'

const root = fromMnemonic(mnemonic)
const personal = derivePersona(root, 'personal', 0)
const bitcoiner = derivePersona(root, 'bitcoiner', 0)

// Same group secret, same counter — different persona = different token
const tokenA = deriveToken(groupSecret, 'canary:verify', counter, 'words', personal.identity.npub)
const tokenB = deriveToken(groupSecret, 'canary:verify', counter, 'words', bitcoiner.identity.npub)
// tokenA !== tokenB — persona isolation
```

### `verifyToken(secret, context, counter, input, identities?, options?)`

Verify a spoken or entered token. Returns `{ status: 'valid' | 'invalid', identity?: string }`.

Options: `{ encoding?, tolerance? }` — tolerance accepts tokens within ±N counter steps (max 10).

### `deriveDirectionalPair(secret, namespace, roles, counter, encoding?)`

Derive two distinct tokens from the same secret, one per role. Roles are `[string, string]` — e.g. `['caller', 'agent']`. Returns `{ [role]: word }`.

### `getCounter(timestampSec, rotationIntervalSec?)`

Compute `floor(timestamp / interval)`. Default interval: 604800 (7 days). Pass `30` for 30-second TOTP-style rotation.

### Encoding options

```typescript
{ format: 'words', count?: number, wordlist?: string[] }  // default: 1 word
{ format: 'pin',   digits?: number }                       // default: 4 digits
{ format: 'hex',   length?: number }                       // default: 8 chars
```

---

## Wordlist

Ships `en-v1`: 2048 English words curated for spoken-word clarity — no homophones, no phonetic near-collisions, 3–8 characters each.

Supply your own via the `wordlist` option (must be exactly 2048 entries):

```typescript
deriveToken(secret, context, counter, { format: 'words', wordlist: myWordlist })
```

---

## How it works

Each token is `HMAC-SHA256(secret, utf8(context) || counter_be32)`, truncated and mapped onto a wordlist or numeric range. The counter is derived from wall-clock time divided by the rotation interval, giving both parties the same value without coordination. A tolerance window (default: 0) accepts tokens from adjacent counter steps to absorb clock skew. Directional pairs use `context = namespace + '\0' + role` so each role's token is cryptographically independent.

---

## Used by

**[canary-kit](https://github.com/forgesworn/canary-kit)** — deepfake-proof identity verification

---

## Try it

```bash
npx tsx examples/rideshare.ts
npx tsx examples/phone-auth.ts
npx tsx examples/identity-verify.ts
```

---

## Part of the ForgeSworn Toolkit

[ForgeSworn](https://forgesworn.dev) builds open-source cryptographic identity, payments, and coordination tools for Nostr.

| Library | What it does |
|---------|-------------|
| [nsec-tree](https://github.com/forgesworn/nsec-tree) | Deterministic sub-identity derivation |
| [ring-sig](https://github.com/forgesworn/ring-sig) | SAG/LSAG ring signatures on secp256k1 |
| [range-proof](https://github.com/forgesworn/range-proof) | Pedersen commitment range proofs |
| [canary-kit](https://github.com/forgesworn/canary-kit) | Coercion-resistant spoken verification |
| [spoken-token](https://github.com/forgesworn/spoken-token) | Human-speakable verification tokens |
| [toll-booth](https://github.com/forgesworn/toll-booth) | L402 payment middleware |
| [geohash-kit](https://github.com/forgesworn/geohash-kit) | Geohash toolkit with polygon coverage |
| [nostr-attestations](https://github.com/forgesworn/nostr-attestations) | NIP-VA verifiable attestations |
| [dominion](https://github.com/forgesworn/dominion) | Epoch-based encrypted access control |
| [nostr-veil](https://github.com/forgesworn/nostr-veil) | Privacy-preserving Web of Trust |

## Licence

MIT
