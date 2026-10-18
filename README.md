# spoken-token

**Nostr:** [`npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`](https://njump.me/npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2)

[![CI](https://github.com/forgesworn/spoken-token/actions/workflows/ci.yml/badge.svg)](https://github.com/forgesworn/spoken-token/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/spoken-token)](https://www.npmjs.com/package/spoken-token)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/TheCryptoDonkey?logo=githubsponsors&color=ea4aaa&label=Sponsor)](https://github.com/sponsors/TheCryptoDonkey)

TOTP but you say it out loud — derive time-rotating, human-speakable verification tokens from a shared secret.

```
npm install spoken-token
```

Zero runtime dependencies. ESM-only. Requires Node.js 22 or later (the package `engines` field) and also works in the browser. Only `randomSeed()` needs a global Web Crypto API (`crypto.getRandomValues`); everything else is pure JavaScript.

## Why spoken-token?

TOTP gives you a 6-digit code on a screen — great for typing into a website, useless for saying over a phone call. Digits are hard to speak, easy to mishear, and carry no meaning.

spoken-token replaces digits with words from a curated 2048-word English wordlist — no homophones, no phonetic near-collisions, 3–8 characters each. The derivation is the same (HMAC over a counter), but the encoding is optimised for the human voice.

---

## Quick start

Every snippet below is self-contained. `secret` arguments are a hex string or a `Uint8Array` of at least 16 bytes. A plain-text passphrase is not accepted: strings are decoded as hex, so a non-hex string throws. `randomSeed()` returns a suitable 64-character hex string (32 random bytes); generate it once and share it with the other party over a secure channel.

### Rideshare pickup

The app derives the same word on both sides. Rider reads it aloud; driver confirms.

```typescript
import { deriveToken, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed() // generate once, then share with the other party securely
const counter = getCounter(Date.now() / 1000) // rotates every 7 days by default

const word = deriveToken(sharedSecret, 'rideshare:pickup', counter)
// → a word from the wordlist, e.g. 'carbon'
```

### Phone call auth

Two roles, two different words — neither party can parrot the other.

```typescript
import { deriveDirectionalPair, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed() // generate once, then share with the other party securely
const counter = getCounter(Date.now() / 1000, 30) // 30-second rotation

const { caller, agent } = deriveDirectionalPair(sharedSecret, 'support-call', ['caller', 'agent'], counter)
// caller hears: a word, e.g. 'timber'
// agent says:   a different word, e.g. 'canyon'
```

To check one of these words, see [Verifying a directional-pair token](#verifying-a-directional-pair-token). `verifyToken` cannot do it.

### Courier handoff

Verify a spoken word against a secret without transmitting the secret.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed() // generate once, then share with the other party securely
const counter = getCounter(Date.now() / 1000)

// Recipient's device derives the word and reads it aloud...
const spokenWord = deriveToken(sharedSecret, 'courier:handoff', counter)

// ...courier's device checks what it heard
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
| `context` | `string` | Domain separation string (non-empty, no null bytes) |
| `counter` | `number` | Time-based or usage counter (uint32) |
| `encoding` | `TokenEncoding` | Output format (default: single word) |
| `identity` | `string?` | Optional per-member identifier (non-empty, no null bytes) |

See [Errors](#errors) for what it throws.

### Identity binding with nsec-tree

When using [nsec-tree](https://github.com/forgesworn/nsec-tree) for deterministic
sub-identity derivation, a persona's npub makes a natural identity parameter —
different personas produce different tokens from the same group secret:

```typescript
import { deriveToken, getCounter, randomSeed } from 'spoken-token'
import { fromMnemonic } from 'nsec-tree/mnemonic'
import { derivePersona } from 'nsec-tree/persona'

// BIP-39 mnemonic loaded from secure storage, never hard-coded
const mnemonic = process.env.NSEC_TREE_MNEMONIC
if (!mnemonic) throw new Error('NSEC_TREE_MNEMONIC is not set')

const groupSecret = randomSeed() // shared with the group out of band
const counter = getCounter(Date.now() / 1000)

const root = fromMnemonic(mnemonic)
const personal = derivePersona(root, 'personal', 0)
const bitcoiner = derivePersona(root, 'bitcoiner', 0)

// Same group secret, same counter — different persona = different token
const tokenA = deriveToken(groupSecret, 'canary:verify', counter, undefined, personal.identity.npub)
const tokenB = deriveToken(groupSecret, 'canary:verify', counter, undefined, bitcoiner.identity.npub)
// tokenA !== tokenB — persona isolation
```

Identity binding is label/domain separation, not proof of identity by itself. If
multiple parties know the same group secret, each party can derive tokens for any
public identity label. Use per-member secrets or signatures when attribution must
be cryptographically enforced.

### `verifyToken(secret, context, counter, input, identities?, options?)`

Verify a spoken or entered token. Returns `{ status: 'valid' | 'invalid', identity?: string }`.

| Param | Type | Description |
|-------|------|-------------|
| `secret` | `Uint8Array \| string` | Shared secret (hex string or bytes, min 16 bytes) |
| `context` | `string` | Context the token was derived with (non-empty, no null bytes) |
| `counter` | `number` | Current counter (uint32) |
| `input` | `string` | The spoken or entered token |
| `identities` | `string[]?` | Member identities to check, at most 100. Each must be a non-empty string without null bytes. Must be a mutable `string[]`, not `readonly string[]` |
| `options` | `VerifyOptions?` | `{ encoding?, tolerance?, identityMode? }` |

`identity` in the result is the entry from `identities` whose token matched. With
low-entropy encodings two identities can collide at the same counter; the first
matching entry in the array wins, so use multi-word or PIN encoding when
attribution matters.

**Input normalisation.** Before comparison, `input` is lower-cased, trimmed, and
every run of whitespace is collapsed to a single space, so `'  CARBON '` matches
`'carbon'` and `'carbon   timber'` matches `'carbon timber'`. Whitespace is
collapsed, not removed: a PIN or hex token with spaces inside it (`'04 78'`) will
not match `'0478'`. Because only the input is lower-cased, a custom wordlist must
contain lower-case words or its tokens will never verify. Input longer than the
limit (`MAX_INPUT_CHARS`, 512 characters, raised for long multi-word encodings)
returns `{ status: 'invalid' }` without throwing.

**Tolerance.** `tolerance` accepts tokens within ±N counter steps (integer 0 to
`MAX_TOLERANCE`, which is 10). The window is in counter steps, not seconds, and it
includes future counters as well as past ones. See [Security model](#security-model)
for how long that keeps a token valid.

**Identity mode.** `identityMode` is `'with-group-fallback'` (the default, kept for
backwards compatibility) or `'identity-only'`. With the default, supplying
`identities` does not make verification identity-only: identity-bound tokens are
checked first, but the group-wide token (derived with no identity) is also
accepted, and in that case the result is `{ status: 'valid' }` with no `identity`.
Anyone who holds the group secret can derive that token. If a valid result must
mean "one of these identities", pass `identityMode: 'identity-only'`:

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const groupSecret = randomSeed() // shared with all members out of band
const counter = getCounter(Date.now() / 1000)
const members = ['alice@example.com', 'bob@example.com']

// Alice's device derives her word and she reads it aloud
const spokenWord = deriveToken(groupSecret, 'event:access', counter, undefined, 'alice@example.com')

// The door system checks it against the member list only
const result = verifyToken(groupSecret, 'event:access', counter, spokenWord, members, {
  tolerance: 1,
  identityMode: 'identity-only',
})
// → { status: 'valid', identity: 'alice@example.com' }
```

### `estimateVerificationRisk(options?)`

Estimate how many token values a verification call accepts and the single-attempt
online guessing probability. Use this when combining identities, tolerance, and
short encodings. Options: `{ encoding?, tolerance?, identities?, identityMode? }`,
where `identities` is a count or an array. It returns `{ candidates, tokenSpace,
singleAttemptSuccessProbability, effectiveBits }`.

```typescript
import { estimateVerificationRisk } from 'spoken-token'

estimateVerificationRisk({
  identities: 100,
  tolerance: 1,
  encoding: { format: 'words', count: 1 },
})
// → candidates: 303, singleAttemptSuccessProbability: ~13.8%
```

The 303 candidates are 100 identities × 3 counters, plus 3 group-wide tokens from
the default `'with-group-fallback'` mode. It models the full window, so it slightly
overstates the risk right at counter 0 or the uint32 maximum.

### `deriveDirectionalPair(secret, namespace, roles, counter, encoding?)`

Derive two distinct tokens from the same secret, one per role. Roles are `[string, string]`, for example `['caller', 'agent']`. Returns `{ [role]: word }`. The namespace and both roles must be non-empty, non-whitespace-only strings without null bytes, and the roles must differ.

#### Verifying a directional-pair token

There is no `verifyDirectionalPair`, and `verifyToken` cannot check these tokens.
A pair token is derived under the context `"pair\0" + namespace + "\0" + role`,
so `verifyToken` with a plain context such as `'support-call'` never matches, and
`verifyToken` rejects the null bytes you would need to pass the real context.
Instead, derive the pair on the verifying side and compare with a timing-safe
equality check, applying the same normalisation as `verifyToken`:

```typescript
import { deriveDirectionalPair, getCounter, randomSeed, timingSafeStringEqual } from 'spoken-token'

/** Check a heard word for one role of a directional pair, allowing ±tolerance counter steps. */
function verifyPairToken(
  secret: Uint8Array | string,
  namespace: string,
  roles: [string, string],
  role: string,
  counter: number,
  heard: string,
  tolerance = 0,
): boolean {
  if (role !== roles[0] && role !== roles[1]) throw new RangeError('role must be one of roles')
  const input = heard.toLowerCase().trim().replace(/\s+/g, ' ')
  let match = false
  for (let c = Math.max(0, counter - tolerance); c <= Math.min(0xFFFFFFFF, counter + tolerance); c++) {
    const expected = deriveDirectionalPair(secret, namespace, roles, c)[role]
    if (timingSafeStringEqual(input, expected)) match = true // no early exit
  }
  return match
}

const sharedSecret = randomSeed() // generate once, then share with the other party securely
const roles: [string, string] = ['caller', 'agent']
const counter = getCounter(Date.now() / 1000, 30)

// The caller's device derives its word and the caller reads it aloud
const heard = deriveDirectionalPair(sharedSecret, 'support-call', roles, counter).caller

verifyPairToken(sharedSecret, 'support-call', roles, 'caller', counter, heard, 1) // → true
verifyPairToken(sharedSecret, 'support-call', roles, 'agent', counter, heard, 1)  // → false
```

Pass an `encoding` through to `deriveDirectionalPair` in the same way if you use
one other than the default. Tolerance and the replay and rate-limiting caveats
below apply here too.

### `getCounter(timestampSec, rotationIntervalSec?)`

Compute `floor(timestamp / interval)`. Default interval: 604800 (7 days). Pass `30` for 30-second TOTP-style rotation.

### Encoding options

```typescript
{ format: 'words', count?: number, wordlist?: readonly string[] }  // default: 1 word
{ format: 'pin',   digits?: number }                       // default: 4 digits
{ format: 'hex',   length?: number }                       // default: 8 chars
```

Ranges: `count` 1 to 16, `digits` 1 to 10, `length` 1 to 64. Out-of-range values throw `RangeError`.

### Other exports and subpaths

Everything below is also exported from the package root (`spoken-token`), except
`deriveTokenBytes`, `MAX_TOLERANCE` and `MAX_INPUT_CHARS`, which are root-only.
Subpaths let you import one area without the rest:

| Import | Exports |
|--------|---------|
| `spoken-token/counter` | `getCounter`, `counterFromEventId`, `counterToBytes`, `DEFAULT_ROTATION_INTERVAL`, `MAX_COUNTER_OFFSET` |
| `spoken-token/wordlist` | `WORDLIST`, `WORDLIST_SIZE`, `getWord`, `indexOf` |
| `spoken-token/encoding` | `encodeAsWords`, `encodeAsPin`, `encodeAsHex`, `encodeToken`, `DEFAULT_ENCODING`, `TokenEncoding` |
| `spoken-token/crypto` | `sha256`, `hmacSha256`, `randomSeed`, `hexToBytes`, `bytesToHex`, `readUint16BE`, `concatBytes`, `bytesToBase64`, `base64ToBytes`, `timingSafeEqual`, `timingSafeStringEqual` |

- `randomSeed()` returns a fresh secret: a 64-character lowercase hex string (32 random bytes). It takes no arguments.
- `counterFromEventId(eventId)` derives a uint32 counter from the SHA-256 of an event identifier (for example a task ID or Nostr event ID). Tokens derived from it do not rotate with time.
- `counterToBytes(counter)` serialises a counter to 8 big-endian bytes, as in RFC 6238.
- `deriveTokenBytes(secret, context, counter, identity?)` returns the raw 32-byte HMAC-SHA256 digest, before encoding.
- `timingSafeEqual(a, b)` and `timingSafeStringEqual(a, b)` are best-effort constant-time comparisons for bytes and strings.
- `hexToBytes(hex)` and `bytesToHex(bytes)` convert between hex strings and bytes.
- `getWord(index)` returns the word at an index (0 to 2047) and `indexOf(word)` returns a word's index, or -1.

### Errors

Invalid arguments throw rather than returning a value:

| Condition | Thrown |
|-----------|--------|
| Empty or whitespace-only `context`, `namespace`, role or `identity` | `Error` |
| Null byte (`\0`) in `context`, `namespace`, role or `identity` | `Error` |
| Identical roles in `deriveDirectionalPair` | `Error` |
| `counter` not an integer from 0 to 4294967295 (uint32), including negative, fractional and overflowing values | `RangeError` |
| `secret` shorter than 16 bytes | `RangeError` |
| `secret` string that is not valid hex: odd length / non-hex character | `Error` / `TypeError` |
| `tolerance` not an integer from 0 to 10 | `RangeError` |
| More than 100 `identities` | `RangeError` |
| Empty, whitespace-only or null-byte entry in `identities` | `Error` |
| Unsupported `identityMode` | `Error` |
| Encoding `count`, `digits` or `length` out of range, or a custom wordlist that is not exactly 2048 entries | `RangeError` |
| `getCounter` with a negative or non-finite timestamp, a non-positive interval, or a result above uint32 | `RangeError` |
| `counterFromEventId` with an empty string | `RangeError` |

`verifyToken` returns `{ status: 'invalid' }` for a wrong token and for over-long input. It does not throw for either.

---

## Wordlist

Ships `en-v1`: 2048 English words curated for spoken-word clarity — no homophones, no phonetic near-collisions, 3–8 characters each.

Supply your own via the `wordlist` option (must be exactly 2048 entries, lower-case so that `verifyToken` can match them). Pass the same `encoding` when deriving and verifying:

```typescript
import { deriveToken, getCounter, randomSeed } from 'spoken-token'

// Your own list: exactly 2048 lower-case entries (generated here as a placeholder)
const myWordlist = Array.from({ length: 2048 }, (_, i) => `word${i}`)

const secret = randomSeed()
const counter = getCounter(Date.now() / 1000)

const token = deriveToken(secret, 'my-app:entry', counter, { format: 'words', wordlist: myWordlist })
```

---

## Security model

spoken-token derives and checks tokens. It does not store state, so these
properties are yours to provide:

- **Short tokens are guessable by design.** One word is 11 bits, so one guess
  against one accepted token succeeds with probability 1 in 2048. Tolerance,
  identities and group fallback each multiply the number of accepted tokens; use
  `estimateVerificationRisk` and a longer encoding (more words, or a longer PIN)
  when the guessing probability is too high for your use.
- **No replay protection.** Verification is stateless. A token that verified once
  verifies again for as long as it is inside the accepted window. If a token must
  be single-use, record what you have accepted (context, counter and identity) and
  refuse repeats.
- **No rate limiting.** `verifyToken` does not count failed attempts. Limit
  attempts per caller or session and lock out after repeated failures; without
  that, an attacker can simply keep guessing.
- **Validity window.** A token is accepted for `(2 × tolerance + 1)` rotation
  intervals. With the default 7-day rotation and `tolerance: 1` (the courier
  example) that is about 21 days: from one interval before its own counter step to
  one interval after. With 30-second rotation and `tolerance: 1` it is 90 seconds.
  Tolerance is in counter steps, so the same value means very different
  durations at different rotation intervals. Near counter 0 and the uint32 maximum
  the window is clamped. Counters from `counterFromEventId` never rotate, so those
  tokens stay valid until you change the event ID.
- **The secret is the whole trust anchor.** Anyone holding it can derive every
  token, including identity-bound and directional-pair tokens. Identity binding
  separates labels; it does not authenticate people.
- **Timing safety is best effort.** Comparison is constant-time in intent, but
  JavaScript runtimes cannot guarantee it. Treat it as defence in depth next to
  rate limiting.

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities and what is in scope.

---

## How it works

Each token is `HMAC-SHA256(secret, utf8(context) || counter_be32)`, truncated and mapped onto a wordlist or numeric range. When an `identity` is supplied it is bound into the input with a null-byte separator: `HMAC-SHA256(secret, utf8(context) || 0x00 || utf8(identity) || counter_be32)`. The counter is derived from wall-clock time divided by the rotation interval, giving both parties the same value without coordination. A tolerance window (default: 0) accepts tokens from adjacent counter steps to absorb clock skew. Directional pairs use `context = "pair\0" + namespace + "\0" + role` (with no identity) so each role's token is cryptographically independent, and independent of identity-bound tokens.

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

For AI coding agents, [llms.txt](llms.txt) is a short summary and [llms-full.txt](llms-full.txt) is the full API reference in one file.

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
