# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x | Yes |

## Reporting a vulnerability

If you discover a security vulnerability in spoken-token, please report it responsibly.

**Email:** security@thecryptodonkey.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 7 days for critical issues.

## Scope

spoken-token is a cryptographic library. The following are in scope:

- Weaknesses in the HMAC-SHA256 derivation or SHA-256 implementation
- Timing side-channels in token verification or comparison
- Input validation bypasses (null bytes, encoding confusion)
- Encoding bias that materially reduces token entropy

The following are **out of scope**:

- Brute-force attacks against the intentionally small token space (e.g. 1-in-2048 for single-word tokens) — this is by design for spoken usability
- JavaScript runtime limitations on constant-time execution (documented in source)
- Attacks requiring access to the shared secret (if you have the secret, you can derive tokens)
