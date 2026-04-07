# spoken-token Cookbook

Practical patterns for common integration scenarios. All examples assume `npm install spoken-token`.

---

## Contents

1. [Rideshare pickup (basic)](#1-rideshare-pickup-basic)
2. [Rideshare pickup with tolerance and fallback](#2-rideshare-pickup-with-tolerance-and-fallback)
3. [Phone call authentication (directional pair)](#3-phone-call-authentication-directional-pair)
4. [Courier handoff with PIN encoding](#4-courier-handoff-with-pin-encoding)
5. [Group entry with per-member tokens](#5-group-entry-with-per-member-tokens)
6. [Event-scoped single-use token](#6-event-scoped-single-use-token)
7. [Two-word phrase for high-security contexts](#7-two-word-phrase-for-high-security-contexts)
8. [Daily family safety word](#8-daily-family-safety-word)
9. [Custom wordlist (non-English)](#9-custom-wordlist-non-english)
10. [Burn-after-use (replay prevention)](#10-burn-after-use-replay-prevention)
11. [Express.js verification middleware](#11-expressjs-verification-middleware)
12. [Browser-side token display](#12-browser-side-token-display)
13. [Nostr event-scoped token with nsec-tree identity binding](#13-nostr-event-scoped-token-with-nsec-tree-identity-binding)

---

## 1. Rideshare pickup (basic)

Both rider and driver derive the same word independently. No coordination required beyond the shared secret.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

// Generated at booking time and stored server-side, keyed by ride ID.
// Both parties receive it before the pickup.
const sharedSecret = randomSeed(32)
const counter = getCounter(Date.now() / 1000) // rotates every 7 days

// Rider's device shows:
const word = deriveToken(sharedSecret, 'rideshare:pickup', counter)
// → e.g. 'carbon'

// Driver verifies what the rider says:
const result = verifyToken(sharedSecret, 'rideshare:pickup', counter, spokenWord)
if (result.status === 'valid') {
  console.log('Match confirmed — proceed with pickup')
}
```

---

## 2. Rideshare pickup with tolerance and fallback

A counter rotates at a fixed boundary. If a ride straddles a rotation, the driver and rider may be on different counter values. Tolerance of 1 accepts the adjacent window.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed(32)
const counter = getCounter(Date.now() / 1000)

const word = deriveToken(sharedSecret, 'rideshare:pickup', counter)

// tolerance: 1 accepts counter-1, counter, or counter+1
const result = verifyToken(
  sharedSecret, 'rideshare:pickup', counter, spokenWord,
  undefined, { tolerance: 1 },
)

if (result.status === 'valid') {
  console.log('Accepted within tolerance window')
} else {
  console.log('No match — ask rider to check their app')
}
```

---

## 3. Phone call authentication (directional pair)

Two distinct words, one per role. The caller says one word; the agent says a different word. Neither party can parrot the other's token.

```typescript
import { deriveDirectionalPair, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed(32)

// 30-second rotation matches typical phone call duration
const counter = getCounter(Date.now() / 1000, 30)

const pair = deriveDirectionalPair(sharedSecret, 'support-call', ['caller', 'agent'], counter)

// IVR prompt to caller: "Your verification word is: ${pair.caller}"
// Agent's system shows: "Caller word: ${pair.caller} — Your word: ${pair.agent}"

// Agent verifies what caller says:
const agentPair = deriveDirectionalPair(sharedSecret, 'support-call', ['caller', 'agent'], counter)
const callerVerified = agentPair.caller === receivedCallerWord

console.log(`Caller verified: ${callerVerified}`)
console.log(`Words distinct: ${pair.caller !== pair.agent}`) // always true
```

---

## 4. Courier handoff with PIN encoding

Some interfaces accept numbers more naturally than words (IVR touch-tone, display panels). Use PIN encoding for these contexts.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed(32)
const counter = getCounter(Date.now() / 1000, 300) // 5-minute window for handoff

const pin = deriveToken(sharedSecret, 'courier:handoff', counter, { format: 'pin', digits: 6 })
// → e.g. '047821'

// Recipient reads pin aloud: "zero four seven eight two one"
const result = verifyToken(
  sharedSecret, 'courier:handoff', counter, receivedPin,
  undefined, { encoding: { format: 'pin', digits: 6 }, tolerance: 1 },
)

if (result.status === 'valid') {
  console.log('Package released')
}
```

---

## 5. Group entry with per-member tokens

Each member gets a unique word from the same group secret. The verifier identifies who entered, not just whether entry is valid.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const groupSecret = randomSeed(32) // shared with all members out of band
const counter = getCounter(Date.now() / 1000) // 7-day rotation

const members = ['alice@example.com', 'bob@example.com', 'carol@example.com']

// Each member derives their personal token on their own device:
const aliceToken = deriveToken(groupSecret, 'event:access', counter, undefined, 'alice@example.com')

// Door system verifies against all known members:
const result = verifyToken(
  groupSecret, 'event:access', counter,
  spokenWord,
  members,
  { tolerance: 1 },
)

if (result.status === 'valid') {
  console.log(`Entry granted to: ${result.identity}`)
  // → e.g. 'alice@example.com'
}
```

---

## 6. Event-scoped single-use token

For bookings or tasks identified by a unique ID, derive the counter from the event ID rather than time. The token does not rotate — it's stable for the lifetime of that event.

```typescript
import { deriveToken, verifyToken, counterFromEventId, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed(32)
const bookingId = 'order-8f3a21c9' // stable identifier

const counter = counterFromEventId(bookingId)
// Same input always produces the same counter — no clock synchronisation needed

const word = deriveToken(sharedSecret, 'booking:pickup', counter)

// At delivery time:
const result = verifyToken(sharedSecret, 'booking:pickup', counter, spokenWord)
if (result.status === 'valid') {
  console.log('Order confirmed')
}
```

---

## 7. Two-word phrase for high-security contexts

A single word provides 11 bits of entropy (1-in-2048). A two-word phrase raises this to 22 bits. Use two words where a single word feels insufficient.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const sharedSecret = randomSeed(32)
const counter = getCounter(Date.now() / 1000, 3600) // hourly rotation

const phrase = deriveToken(sharedSecret, 'auth:phrase', counter, { format: 'words', count: 2 })
// → e.g. 'carbon timber'

// Verification normalises spacing and case:
const result = verifyToken(
  sharedSecret, 'auth:phrase', counter, userInput,
  undefined, { encoding: { format: 'words', count: 2 } },
)
// 'Carbon Timber', 'carbon  timber', 'CARBON TIMBER' all match
```

---

## 8. Daily family safety word

A word that changes each day. Both parties know the same secret; no app or internet connection needed at verification time.

```typescript
import { deriveToken, verifyToken, getCounter, hexToBytes } from 'spoken-token'

// A 32-byte hex secret agreed in advance and stored securely
const sharedSecret = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001')

// Daily rotation: 86400 seconds
const counter = getCounter(Date.now() / 1000, 86400)

const word = deriveToken(sharedSecret, 'family:safety', counter)
// → the same word on all devices sharing this secret today

// Verification with tolerance: 1 handles midnight boundary transitions
const result = verifyToken(
  sharedSecret, 'family:safety', counter, heardWord,
  undefined, { tolerance: 1 },
)
```

---

## 9. Custom wordlist (non-English)

Supply any 2048-entry wordlist. The derivation algorithm is unchanged; only the output encoding changes.

```typescript
import { deriveToken, getCounter } from 'spoken-token'

// Your wordlist must have exactly 2048 entries
const deWordlist: string[] = [
  'Adler', 'Affe', 'Acker', /* ... 2045 more ... */
]

const counter = getCounter(Date.now() / 1000)
const word = deriveToken(
  sharedSecret, 'anruf:authentifizierung', counter,
  { format: 'words', count: 1, wordlist: deWordlist },
)
// → a German word from your list

// Verification uses the same wordlist:
const result = verifyToken(
  sharedSecret, 'anruf:authentifizierung', counter, spokenWord,
  undefined, { encoding: { format: 'words', count: 1, wordlist: deWordlist } },
)
```

---

## 10. Burn-after-use (replay prevention)

spoken-token does not maintain state. To prevent replay, track consumed counters in your application.

```typescript
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

const usedCounters = new Set<number>()

function verifyOnce(
  secret: Uint8Array,
  context: string,
  spokenWord: string,
  tolerance = 0,
): { status: 'valid' | 'invalid' | 'replayed' } {
  const counter = getCounter(Date.now() / 1000)

  const result = verifyToken(secret, context, counter, spokenWord, undefined, { tolerance })

  if (result.status !== 'valid') return { status: 'invalid' }

  // Determine the exact matching counter within the tolerance window
  for (let offset = -tolerance; offset <= tolerance; offset++) {
    const c = counter + offset
    if (usedCounters.has(c)) return { status: 'replayed' }
  }

  usedCounters.add(counter)
  return { status: 'valid' }
}
```

---

## 11. Express.js verification middleware

Verify a spoken token supplied in a request header.

```typescript
import { verifyToken, getCounter } from 'spoken-token'
import { hexToBytes } from 'spoken-token/crypto'
import type { Request, Response, NextFunction } from 'express'

const SHARED_SECRET = hexToBytes(process.env.SPOKEN_SECRET!)

export function spokenTokenMiddleware(context: string, toleranceSec = 30) {
  return (req: Request, res: Response, next: NextFunction) => {
    const spoken = req.headers['x-spoken-token']
    if (typeof spoken !== 'string') {
      return res.status(401).json({ error: 'Missing X-Spoken-Token header' })
    }

    const counter = getCounter(Date.now() / 1000, toleranceSec)
    const result = verifyToken(SHARED_SECRET, context, counter, spoken, undefined, { tolerance: 1 })

    if (result.status !== 'valid') {
      return res.status(401).json({ error: 'Invalid spoken token' })
    }

    next()
  }
}

// Usage:
// app.post('/call/verify', spokenTokenMiddleware('support-call'), handler)
```

---

## 12. Browser-side token display

Derive and display a word in the browser. Works without any server round-trip after the shared secret is delivered.

```typescript
import { deriveToken, getCounter } from 'spoken-token'

// Secret delivered to the browser once (e.g. via your session endpoint)
// and held only in memory — never written to localStorage.
declare const sharedSecret: Uint8Array

function renderToken(context: string): void {
  const counter = getCounter(Date.now() / 1000)
  const word = deriveToken(sharedSecret, context, counter)

  const el = document.getElementById('token-display')!
  el.textContent = word
  el.setAttribute('aria-label', `Your verification word is: ${word}`)

  // Refresh when the counter rotates (check every second)
  const interval = 604_800 * 1000 // 7 days in ms
  const msUntilRotation = interval - (Date.now() % interval)
  setTimeout(() => renderToken(context), msUntilRotation)
}

renderToken('rideshare:pickup')
```

---

## 13. Nostr event-scoped token with nsec-tree identity binding

Different personas produce different tokens from the same group secret, using [nsec-tree](https://github.com/forgesworn/nsec-tree) for deterministic sub-identity derivation.

```typescript
import { deriveToken, counterFromEventId } from 'spoken-token'
import { fromMnemonic } from 'nsec-tree/mnemonic'
import { derivePersona } from 'nsec-tree/persona'

const root = fromMnemonic(mnemonic)
const persona = derivePersona(root, 'work', 0)

// Event-scoped counter from a Nostr event ID
const nostrEventId = 'abc123def456...' // 64-char hex
const counter = counterFromEventId(nostrEventId)

// persona.identity.npub provides per-user isolation
const token = deriveToken(
  groupSecret,
  'canary:verify',
  counter,
  undefined,
  persona.identity.npub,
)

// Two personas produce different tokens from the same inputs:
const workToken  = deriveToken(groupSecret, 'canary:verify', counter, undefined, derivePersona(root, 'work', 0).identity.npub)
const hobbyToken = deriveToken(groupSecret, 'canary:verify', counter, undefined, derivePersona(root, 'hobby', 0).identity.npub)
// workToken !== hobbyToken
```

---

## Choosing a rotation interval

| Scenario | Interval | Rationale |
|----------|----------|-----------|
| Phone call verification | 30 s | Matches call duration; limits exposure if overheard |
| Courier handoff | 5 min | Time to complete handoff without re-deriving |
| Booking / order pickup | Event ID | No rotation needed — token is delivery-scoped |
| Daily check-in | 24 h | One word per day, memorable |
| Family safety word | 7 days | Low churn, still rotates periodically |
| Group access badge | 7 days (default) | Reasonable for low-risk scenarios |

---

## Choosing an encoding

| Encoding | Entropy | Best for |
|----------|---------|---------|
| 1 word | 11 bits | Casual verification, rideshare, quick calls |
| 2 words | 22 bits | Higher assurance, memorable phrases |
| 3 words | 33 bits | High-security verbal confirmation |
| 6-digit PIN | ~20 bits | Numeric interfaces, IVR, touch-tone |
| 8-char hex | 32 bits | Debug / developer tooling |

---

## Security reminders

- Hold secrets in memory only — never write to `localStorage`, disk, or logs.
- Use `tolerance: 1` cautiously — it doubles the window of valid tokens. Prefer `tolerance: 0` unless clock skew is a known issue.
- Single-word tokens are 1-in-2048 guessable. Rate-limit verification endpoints.
- Constant-time comparison is used internally, but JS runtimes cannot guarantee it under JIT. Add rate limiting for high-assurance environments.
- See [PROTOCOL.md](PROTOCOL.md) and [SECURITY.md](SECURITY.md) for the full security model.
