Spoken Token Protocol
=====================

Time-rotating human-speakable verification tokens from a shared secret.

`v2.0` `stable`

## Abstract

This document specifies the Spoken Token Protocol — a method for deriving
time-rotating, human-speakable verification tokens from a shared secret. Two
parties who share a secret can independently derive the same word (or phrase, PIN,
or hex code) at the same time, and verify each other by speaking it aloud. The
protocol is transport-agnostic, works offline, and requires no special hardware.

## Motivation

TOTP (RFC 6238) produces 6-digit codes displayed on a screen. This works for
machine-mediated authentication (type the code into a website) but fails for
human-to-human verification (say the code over a phone call, confirm a courier,
verify a rideshare driver). Digits are hard to speak clearly, easy to mishear,
and carry no semantic weight.

Spoken Token replaces digits with words chosen from a curated wordlist designed
for spoken clarity — no homophones, no offensive words, no ambiguity over a noisy
channel. The core derivation is identical to TOTP (HMAC over a counter), but the
encoding is optimised for the human voice rather than a numeric keypad.

Passive approaches to identity verification (voice analysis, facial recognition,
deepfake detection) are losing the arms race against synthetic media. Spoken Token
takes the active approach: prove you know the secret by producing the right word
at the right time. No amount of voice cloning or deepfake technology can produce a
word the attacker doesn't know.

## Specification

### Notation

| Symbol | Meaning |
|--------|---------|
| `HMAC-SHA256(key, data)` | RFC 2104 HMAC with SHA-256 |
| `utf8(s)` | UTF-8 encoding of string `s` |
| `counter_be32` | 4-byte unsigned big-endian integer |
| `\|\|` | Byte concatenation |
| `0x00` | Single null byte |
| `mod` | Modular arithmetic |
| `uint16_be(b, i)` | Unsigned 16-bit big-endian integer at byte offset `i` in `b` |
| `uint32_be(b, i)` | Unsigned 32-bit big-endian integer at byte offset `i` in `b` |

### Secrets

A secret MUST be at least 16 bytes (128 bits). Secrets MAY be provided as raw
bytes or as an even-length hexadecimal string (case-insensitive). Implementations
MUST reject secrets shorter than 16 bytes.

For maximum security, secrets SHOULD be 32 bytes (256 bits) generated from a
cryptographically secure random source.

### SPOKEN-DERIVE: Token Derivation

The core derivation produces a 32-byte HMAC-SHA256 digest from a shared secret,
a context string, a counter, and an optional identity.

#### Without identity (group-wide token)

```
token_bytes = HMAC-SHA256(secret, utf8(context) || counter_be32)
```

All parties with the same secret, context, and counter derive the same token.

#### With identity (per-member token)

```
token_bytes = HMAC-SHA256(secret, utf8(context) || 0x00 || utf8(identity) || counter_be32)
```

The null byte (`0x00`) separates context from identity to prevent concatenation
ambiguity (e.g. context `"a"` + identity `"bc"` vs context `"ab"` + identity `"c"`).

When identity is provided, it MUST be a non-empty UTF-8 string. Different identities
produce different tokens from the same secret and counter.

#### Context strings

Context strings provide domain separation. Different applications MUST use different
context strings to prevent cross-protocol token reuse.

Examples:
- `"rideshare:pickup"` — rideshare verification
- `"phone:auth"` — phone call authentication
- `"courier:handoff"` — delivery verification
- `"canary:group"` — CANARY group verification

Context strings MUST be non-empty UTF-8 strings.

### Counter Schemes

The counter is a 32-bit unsigned integer (`0` to `4,294,967,295`).

#### Time-based counter

```
counter = floor(unix_timestamp_seconds / rotation_interval_seconds)
```

The rotation interval determines how frequently the token changes. Common values:

| Interval | Use case |
|----------|----------|
| 30 seconds | Phone call verification, high-security |
| 5 minutes | Courier handoff |
| 24 hours | Daily team check-in |
| 7 days | Family safety word |

#### Event-based counter

```
counter = uint32_be(SHA-256(utf8(event_id))[0:4])
```

Deterministic counter derived from an event identifier (e.g. a booking ID, task ID,
or order number). Both parties derive the same counter from the same event ID without
coordination.

#### Manual counter

Any agreed-upon integer. Useful for single-use tokens (counter = 0) or
application-managed sequences.

### SPOKEN-ENCODE: Token Encoding

The 32-byte HMAC digest is encoded into a human-readable format.

#### Word encoding

Each word is derived from a consecutive 2-byte slice of the digest:

```
index = uint16_be(token_bytes, i * 2) mod 2048
word  = wordlist[index]
```

For a phrase of `N` words, use byte offsets `0, 2, 4, ..., 2*(N-1)`. The digest
provides enough bytes for up to 16 words (`32 bytes / 2 bytes per word`).

Different 2-byte slices MAY produce the same index; repeated words in a phrase
are a valid output, not an error.

#### PIN encoding

A pre-computed byte count per digit ensures max per-value modular bias stays
below 1%. The required bytes are read as a big-endian unsigned integer, reduced
modulo `10^digits`, and zero-padded to the specified length.

| Digits | Bytes | Max per-value bias |
|--------|-------|--------------------|
| 1 | 2 | < 0.1% |
| 2 | 2 | < 0.2% |
| 3 | 3 | < 0.01% |
| 4 | 3 | < 0.1% |
| 5 | 3 | < 1% |
| 6 | 4 | < 0.1% |
| 7 | 4 | < 0.3% |
| 8 | 5 | < 0.01% |
| 9 | 5 | < 0.1% |
| 10 | 6 | < 0.01% |

The number of digits MUST be an integer in the range 1–10. When the byte count
exceeds 4, implementations MUST use arbitrary-precision arithmetic to avoid
32-bit overflow.

#### Hex encoding

The first `ceil(length / 2)` bytes are encoded as lowercase hexadecimal and
truncated to the specified length.

### Wordlist Requirements

A compliant wordlist MUST contain exactly 2048 entries. Each entry MUST be a
non-empty UTF-8 string. Entries SHOULD be:

- Easily distinguishable when spoken aloud (no homophones)
- Free of offensive or distressing content
- Short (ideally 3–8 characters)
- Common enough to be recognised by non-native speakers

The canonical English wordlist is **en-v1**, distributed with the reference
implementation as a newline-delimited text file (`src/wordlists/en-v1.txt`) and
embedded in the source module. The canonical source is the `spoken-token` npm
package and the GitHub repository at
`https://github.com/TheCryptoDonkey/spoken-token`.

**Integrity check:** The SHA-256 hash of the en-v1 wordlist (words joined by `\n`,
no trailing newline) is:

```
0334930ebdfbc76e81ec914515d7567ca85738a6bf3069249d97df951d44661c
```

Implementations MAY support additional wordlists by accepting a custom wordlist
parameter.

### Directional Pairs

For two-party verification where both sides need to speak a word (preventing the
"echo problem" where the second speaker parrots the first), each role derives a
distinct token using the context `"pair" || 0x00 || namespace || 0x00 || role`:

```
token_A = SPOKEN-DERIVE(secret, "pair\0" + namespace + "\0" + role_A, counter)
token_B = SPOKEN-DERIVE(secret, "pair\0" + namespace + "\0" + role_B, counter)
```

The `"pair\0"` prefix provides cryptographic domain separation from identity-bound
tokens (which use `context || 0x00 || identity`). Without the prefix, a directional
pair for namespace X and role Y would produce the same HMAC input as an
identity-bound token with context X and identity Y. The prefix makes the two
namespaces independent.

Null bytes separate the prefix, namespace, and role to prevent concatenation
ambiguity. Roles MUST be non-empty, distinct, and MUST NOT contain null bytes.
The namespace MUST be non-empty and MUST NOT contain null bytes.

Neither token can be derived from the other without the shared secret.

### Verification

To verify a spoken token:

1. Normalise the input: lowercase, trim leading/trailing whitespace, collapse
   multiple internal spaces to single spaces.
2. Derive the expected token(s) using the same secret, context, and counter.
   Derived tokens are always lowercase with single-space separation — only the
   input requires normalisation.
3. Compare using constant-time string comparison.

#### Tolerance windows

To accommodate clock drift, implementations MAY check tokens across a window of
`±tolerance` counter values. The verification algorithm checks in priority order:

1. **Per-identity tokens at exact counter** — if identities are provided, check
   each identity's token at the exact counter first.
2. **Per-identity tokens across tolerance window** — check each identity at
   non-exact counters within `±tolerance`.
3. **Group-wide token across tolerance window** — check the anonymous (no-identity)
   token across the full window (including the exact counter).
4. **No match** — verification failed.

Exact-counter matches take priority over tolerance-window matches.

The maximum tolerance MUST NOT exceed 10. Implementations MUST reject tolerance
values greater than 10.

When identities are provided, the array MUST NOT exceed 100 entries.
Implementations MUST reject larger arrays to bound computational cost.

#### Verification result

A verification produces one of:
- `valid` — the token matches a derived token (optionally with the matching identity)
- `invalid` — no match found

## Test Vectors

All vectors use the canonical **en-v1** wordlist.

### Inputs

```
SECRET_1 = 0000000000000000000000000000000000000000000000000000000000000001
SECRET_2 = ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
```

### SPOKEN-DERIVE

| # | Function | Secret | Context | Counter | Identity | Encoding | Expected |
|---|----------|--------|---------|---------|----------|----------|----------|
| 1 | deriveTokenBytes | SECRET_1 | `test` | 0 | — | raw hex | `ec02d24ed34bf06b679564bad8a13c599ccb07d25848c7c7cee3d33e028c8bfc` |
| 2 | deriveToken | SECRET_1 | `test` | 0 | — | 1 word | `jazz` |
| 3 | deriveToken | SECRET_1 | `test` | 1 | — | 1 word | `involve` |
| 4 | deriveToken | SECRET_2 | `test` | 0 | — | 1 word | `carpet` |
| 5 | deriveToken | SECRET_1 | `test` | 0 | — | 2 words | `jazz earth` |
| 6 | deriveToken | SECRET_1 | `test` | 0 | — | 3 words | `jazz earth glacier` |
| 7 | deriveToken | SECRET_1 | `test` | 0 | — | 6-digit PIN | `607886` |
| 8 | deriveToken | SECRET_1 | `test` | 0 | — | 8-char hex | `ec02d24e` |

### Identity binding

| # | Secret | Context | Counter | Identity | Expected (1 word) |
|---|--------|---------|---------|----------|--------------------|
| 9 | SECRET_1 | `test` | 0 | `alice` | `vicious` |
| 10 | SECRET_1 | `test` | 0 | `bob` | `ripple` |
| 11 | SECRET_1 | `test` | 0 | — | `jazz` |

Vectors 9–11 demonstrate that per-identity tokens differ from each other and from
the group-wide token.

### Directional pairs

| # | Secret | Namespace | Roles | Counter | Expected |
|---|--------|-----------|-------|---------|----------|
| 12 | SECRET_1 | `rideshare` | `["driver", "rider"]` | 42 | `{"driver": "shed", "rider": "rely"}` |

### Round-trip verification

| # | Input | Secret | Context | Counter | Identities | Tolerance | Expected |
|---|-------|--------|---------|---------|------------|-----------|----------|
| 13 | `jazz` | SECRET_1 | `test` | 0 | — | 0 | `valid` |
| 14 | `involve` | SECRET_1 | `test` | 0 | — | 1 | `valid` (counter 1 within ±1) |
| 15 | `involve` | SECRET_1 | `test` | 0 | — | 0 | `invalid` (counter 1, no tolerance) |
| 16 | `vicious` | SECRET_1 | `test` | 0 | `["alice", "bob"]` | 0 | `valid`, identity: `alice` |
| 17 | `JAZZ` | SECRET_1 | `test` | 0 | — | 0 | `valid` (case-insensitive) |
| 18 | `wrong` | SECRET_1 | `test` | 0 | — | 0 | `invalid` |

## Security Considerations

### Entropy

A single word from a 2048-entry wordlist provides 11 bits of entropy. A 2-word
phrase provides 22 bits, and a 3-word phrase provides 33 bits. For high-security
contexts, use 2+ words or combine with other authentication factors.

A 6-digit PIN provides approximately 20 bits of entropy.

### Timing side-channels

Implementations MUST use constant-time comparison for token verification.
JavaScript runtimes cannot guarantee constant-time execution due to JIT compilation
and speculative execution. This is a defence-in-depth measure — pair with rate
limiting for high-assurance environments.

### Secret management

Secrets MUST be held in volatile memory only. They MUST NOT be written to persistent
storage in plaintext. When a secret is no longer needed, implementations SHOULD
overwrite the memory (best-effort in garbage-collected languages).

### Replay protection

A token verified at counter `N` SHOULD NOT be accepted again at counter `N`.
Implementations MAY track consumed counters or advance the counter after each use
("burn-after-use") to prevent replay.

### Wordlist integrity

Implementations MUST use the exact canonical wordlist without modification. A
different wordlist will produce different tokens, breaking interoperability. The
en-v1 wordlist SHA-256 hash can be used to verify integrity.

### Rotation interval selection

Shorter rotation intervals provide better security (smaller window of vulnerability
if a token is overheard) but worse usability (less time to communicate the word).
30 seconds is appropriate for real-time phone calls; 24 hours is appropriate for
daily check-ins.

## Reference Implementation

The canonical implementation is the `spoken-token` npm package:

```
npm install spoken-token
```

Source: https://github.com/TheCryptoDonkey/spoken-token

## Extensions

The Spoken Token Protocol is designed to be extended. Known extensions include:

- **CANARY Protocol** (`canary-kit`) — adds duress detection, liveness tokens,
  group management, and transport bindings for Nostr and Meshtastic.

Extensions MUST NOT modify the core SPOKEN-DERIVE or SPOKEN-ENCODE algorithms.
They MAY add additional derivation schemes (e.g. duress tokens) using different
context suffixes.

## Versioning

This document is versioned as `v2.0`. The version applies to:
- The SPOKEN-DERIVE algorithm
- The SPOKEN-ENCODE algorithm
- The en-v1 wordlist
- The test vectors

**v2.0 changes from v1.0:**
- PIN encoding uses a per-digit-count byte lookup table (max bias < 1%) instead
  of the `ceil(digits × 0.415)` formula (which had up to 40% bias at 7 digits).
  PIN outputs differ from v1.0 for all digit counts except 5.
- Directional pairs use a `"pair\0"` context prefix for cryptographic isolation
  from identity-bound tokens. Directional pair outputs differ from v1.0.
- Context strings, namespaces, and roles that are whitespace-only are now rejected.

A new wordlist (e.g. `en-v2`, `de-v1`) does not require a protocol version
change — implementations identify wordlists by name, not by protocol version.

When two parties verify each other, they MUST agree on the protocol version and
wordlist out of band (e.g. as part of the shared secret exchange). This specification
does not define a negotiation mechanism.
