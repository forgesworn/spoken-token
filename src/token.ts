import { hmacSha256, hexToBytes, concatBytes } from './crypto.js'
import { encodeToken, type TokenEncoding, DEFAULT_ENCODING } from './encoding.js'

const encoder = new TextEncoder()
function utf8(str: string): Uint8Array { return encoder.encode(str) }

function counterBe32(counter: number): Uint8Array {
  if (!Number.isInteger(counter) || counter < 0 || counter > 0xFFFFFFFF) {
    throw new RangeError(`Counter must be an integer 0–${0xFFFFFFFF}, got ${counter}`)
  }
  const buf = new Uint8Array(4)
  new DataView(buf.buffer).setUint32(0, counter, false)
  return buf
}

const MIN_SECRET_BYTES = 16

function normaliseSecret(secret: Uint8Array | string): Uint8Array {
  const key = typeof secret === 'string' ? hexToBytes(secret) : secret
  if (key.length < MIN_SECRET_BYTES) {
    throw new RangeError(`Secret must be at least ${MIN_SECRET_BYTES} bytes, got ${key.length}`)
  }
  return key
}

/**
 * Derive raw token bytes from a shared secret, context, and counter.
 *
 * Without identity: `HMAC-SHA256(secret, utf8(context) || counter_be32)`
 * With identity:    `HMAC-SHA256(secret, utf8(context) || 0x00 || utf8(identity) || counter_be32)`
 *
 * The null-byte separator prevents concatenation ambiguity between context and identity.
 *
 * @param secret - Shared secret (hex string or Uint8Array, minimum 16 bytes).
 * @param context - Context string for domain separation.
 * @param counter - Time-based or usage counter (uint32).
 * @param identity - Optional member identifier for per-member tokens.
 * @returns Raw 32-byte HMAC-SHA256 digest.
 * @throws {RangeError} If secret is too short or counter is out of range.
 * @throws {Error} If identity is provided but empty.
 */
export function deriveTokenBytes(
  secret: Uint8Array | string,
  context: string,
  counter: number,
  identity?: string,
): Uint8Array {
  if (!context) {
    throw new Error('context must be a non-empty string')
  }
  if (identity !== undefined && identity === '') {
    throw new Error('identity must be non-empty when provided')
  }
  if (identity !== undefined && identity.includes('\0')) {
    throw new Error('identity must not contain null bytes')
  }
  const key = normaliseSecret(secret)
  const data = identity
    ? concatBytes(utf8(context), new Uint8Array([0x00]), utf8(identity), counterBe32(counter))
    : concatBytes(utf8(context), counterBe32(counter))
  return hmacSha256(key, data)
}

/**
 * Derive an encoded token string.
 *
 * @param secret - Shared secret (hex string or Uint8Array, minimum 16 bytes).
 * @param context - Context string for domain separation.
 * @param counter - Time-based or usage counter (uint32).
 * @param encoding - Output encoding format (default: single word from en-v1 wordlist).
 * @param identity - Optional member identifier for per-member tokens.
 * @returns Encoded token string (word, PIN, or hex depending on encoding).
 * @throws {RangeError} If secret is too short or counter is out of range.
 */
export function deriveToken(
  secret: Uint8Array | string,
  context: string,
  counter: number,
  encoding: TokenEncoding = DEFAULT_ENCODING,
  identity?: string,
): string {
  if (context.includes('\0')) {
    throw new Error('context must not contain null bytes')
  }
  if (identity !== undefined && identity.includes('\0')) {
    throw new Error('identity must not contain null bytes')
  }
  const bytes = deriveTokenBytes(secret, context, counter, identity)
  return encodeToken(bytes, encoding)
}

/** A pair of directional tokens keyed by role name. */
export interface DirectionalPair { [role: string]: string }

/**
 * Derive a directional pair: two distinct tokens from the same secret, one per role.
 * Each token uses context `${namespace}\0${role}`.
 *
 * Neither token can be derived from the other without the shared secret.
 * This prevents the "echo problem" where the second speaker could parrot the first.
 *
 * @param secret - Shared secret (hex string or Uint8Array).
 * @param namespace - Namespace prefix (e.g. `'dispatch'`).
 * @param roles - Exactly two distinct, non-empty role names (e.g. `['caller', 'agent']`).
 * @param counter - Current counter value.
 * @param encoding - Output encoding format (default: single word).
 * @returns Object keyed by role name, each value is the role's token string.
 * @throws {Error} If namespace is empty, contains null bytes, roles are identical, or either role is empty/contains null bytes.
 */
export function deriveDirectionalPair(
  secret: Uint8Array | string,
  namespace: string,
  roles: [string, string],
  counter: number,
  encoding: TokenEncoding = DEFAULT_ENCODING,
): DirectionalPair {
  if (!namespace) {
    throw new Error('namespace must be a non-empty string')
  }
  if (namespace.includes('\0')) {
    throw new Error('namespace must not contain null bytes')
  }
  if (!roles[0] || !roles[1]) {
    throw new Error('Both roles must be non-empty strings')
  }
  if (roles[0].includes('\0') || roles[1].includes('\0')) {
    throw new Error('Roles must not contain null bytes')
  }
  if (roles[0] === roles[1]) {
    throw new Error(`Roles must be distinct, got ["${roles[0]}", "${roles[1]}"]`)
  }
  // Null-byte separator prevents concatenation ambiguity
  // (e.g. namespace "a:b" + role "c" vs namespace "a" + role "b:c")
  // Calls deriveTokenBytes directly — the constructed context intentionally
  // contains a null byte as the protocol-defined separator.
  return {
    [roles[0]]: encodeToken(deriveTokenBytes(secret, `${namespace}\0${roles[0]}`, counter), encoding),
    [roles[1]]: encodeToken(deriveTokenBytes(secret, `${namespace}\0${roles[1]}`, counter), encoding),
  }
}
