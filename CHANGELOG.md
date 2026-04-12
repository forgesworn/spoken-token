## [2.0.4](https://github.com/forgesworn/spoken-token/compare/v2.0.3...v2.0.4) (2026-04-12)


### Bug Fixes

* resolve development dependency vulnerabilities ([f98156d](https://github.com/forgesworn/spoken-token/commit/f98156de71dcef8d808d89801357602759610b48))

## [2.0.3](https://github.com/forgesworn/spoken-token/compare/v2.0.2...v2.0.3) (2026-03-20)


### Bug Fixes

* correct copyright to TheCryptoDonkey ([af4fa47](https://github.com/forgesworn/spoken-token/commit/af4fa47c4a95dc8b6672be7c6dcb12ee99ba4a03))

## [2.0.2](https://github.com/TheCryptoDonkey/spoken-token/compare/v2.0.1...v2.0.2) (2026-03-17)


### Bug Fixes

* zero sha256 intermediate buffers (padded, W) after use ([b972391](https://github.com/TheCryptoDonkey/spoken-token/commit/b972391ba2f01026ea91aff426c789d436f83a7a))

## [2.0.1](https://github.com/TheCryptoDonkey/spoken-token/compare/v2.0.0...v2.0.1) (2026-03-17)


### Bug Fixes

* add defensive validation and missing test vectors ([8505de2](https://github.com/TheCryptoDonkey/spoken-token/commit/8505de2644e05b462ae2c0654c00bd177eb405a4))
* harden input validation and correct PROTOCOL.md bias claims ([1bd9a6c](https://github.com/TheCryptoDonkey/spoken-token/commit/1bd9a6c7a748cc2569c418e328fffb4cb853080d))
* remove imprecise bias number from PIN_BYTES comment ([8bebaf7](https://github.com/TheCryptoDonkey/spoken-token/commit/8bebaf71af134be9bb137e537fec0736c188309c))

# [2.0.0](https://github.com/TheCryptoDonkey/spoken-token/compare/v1.0.4...v2.0.0) (2026-03-17)


* feat!: eliminate PIN bias, add directional pair domain separation ([c087bb7](https://github.com/TheCryptoDonkey/spoken-token/commit/c087bb7277921f35ba8be6eadd7b82bf526bb576))


### BREAKING CHANGES

* PIN encoding and directional pair outputs change.

- Replace PIN byte formula with lookup table (PIN_BYTES) that keeps
  max per-value bias below 1% for all digit counts. Previously 7-digit
  PINs had ~40% bias (some values 2x as likely); now all are <1%.
- Add "pair\0" prefix to directional pair HMAC input, cryptographically
  isolating it from identity-bound derivation. Previously
  deriveDirectionalPair(s, "ns", ["role", ...], c) produced the same
  token as deriveTokenBytes(s, "ns", c, "role").
- Reject whitespace-only context strings, namespace, and roles.
- Document identity collision risk in verifyToken JSDoc for low-entropy
  encodings (single word + many identities).

## [1.0.4](https://github.com/TheCryptoDonkey/spoken-token/compare/v1.0.3...v1.0.4) (2026-03-17)


### Bug Fixes

* document PIN encoding bias and clarify crypto guard expression ([734eca4](https://github.com/TheCryptoDonkey/spoken-token/commit/734eca4bbf8986830773647ef270f0b16107c6e1))

## [1.0.3](https://github.com/TheCryptoDonkey/spoken-token/compare/v1.0.2...v1.0.3) (2026-03-17)


### Bug Fixes

* add runtime exhaustive check and input validation gaps ([f507463](https://github.com/TheCryptoDonkey/spoken-token/commit/f507463bc5084d66747585fc2d66cc0fa8ecbcc3))
* add workflow-level read-only permissions default ([8d6c394](https://github.com/TheCryptoDonkey/spoken-token/commit/8d6c39451c243c82248c8c54702d14a142e1db21))

## [1.0.2](https://github.com/TheCryptoDonkey/spoken-token/compare/v1.0.1...v1.0.2) (2026-03-17)


### Bug Fixes

* disable semantic-release issue/PR comments after permission tightening ([ba09920](https://github.com/TheCryptoDonkey/spoken-token/commit/ba09920b3cc8aa3d316e60b0a076865234dd4662))
* harden CI/CD supply chain ([8e559c6](https://github.com/TheCryptoDonkey/spoken-token/commit/8e559c696e17ed839c942801c25b039dcd1f894c))
* harden input validation and crypto hygiene ([3b49ab1](https://github.com/TheCryptoDonkey/spoken-token/commit/3b49ab14fb6abfa93bffbdd4fcabda7a2845a037))

## [1.0.1](https://github.com/TheCryptoDonkey/spoken-token/compare/v1.0.0...v1.0.1) (2026-03-17)


### Bug Fixes

* harden crypto primitives ([a1d8ffa](https://github.com/TheCryptoDonkey/spoken-token/commit/a1d8ffa43b353b446da2da0c59506509f3cdb151))
* improve gitignore coverage and add wordlist integrity test ([2ec9a32](https://github.com/TheCryptoDonkey/spoken-token/commit/2ec9a3262c6e4c9e37789515dffa4c3784d86703))
* validate context and identity for null bytes and empty strings ([50243c9](https://github.com/TheCryptoDonkey/spoken-token/commit/50243c951a0344b36e7012e4b83bb759aef1007e))

# 1.0.0 (2026-03-17)


### Bug Fixes

* add @vitest/coverage-v8 for CI coverage reporting ([3ff9d8b](https://github.com/TheCryptoDonkey/spoken-token/commit/3ff9d8bbfa04175abb4b2a3135eb239c2522cd5f))


### Features

* add crypto primitives (SHA-256, HMAC-SHA256, hex/bytes utils) ([d4ed872](https://github.com/TheCryptoDonkey/spoken-token/commit/d4ed872207cd8954c45e38b3e1e42c89ce614d29))
* add HMAC-SHA256 token derivation and directional pairs ([9d4dccf](https://github.com/TheCryptoDonkey/spoken-token/commit/9d4dccfcd2104555ae2c516f17a527c4ea38a0e5))
* add spoken-clarity en-v1 wordlist (2048 words) ([816aad3](https://github.com/TheCryptoDonkey/spoken-token/commit/816aad3959301dbae93221f3348c6e31f456d8db))
* add time-based and event-ID counter derivation ([2eae56b](https://github.com/TheCryptoDonkey/spoken-token/commit/2eae56b24303c2b3f6b5bffc968d539f75789437))
* add tolerance-window token verification ([edbb9b8](https://github.com/TheCryptoDonkey/spoken-token/commit/edbb9b8c631fd3642157f77ceed404820230d4e7))
* add word/PIN/hex token encoding ([7de0377](https://github.com/TheCryptoDonkey/spoken-token/commit/7de037793ab071018326a90415a248cd3b1af6ec))
* barrel export for spoken-token public API ([d643bc3](https://github.com/TheCryptoDonkey/spoken-token/commit/d643bc31cfa00780655b8cc8a8f4fa32e410c96f))
