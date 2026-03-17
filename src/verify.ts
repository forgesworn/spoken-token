import { deriveToken } from './token.js'
import { timingSafeStringEqual } from './crypto.js'
import { type TokenEncoding, DEFAULT_ENCODING } from './encoding.js'

/** Maximum allowed tolerance value. */
export const MAX_TOLERANCE = 10

/** Maximum identities to bound computational cost. */
const MAX_IDENTITIES = 100

/** Result of verifying a token. */
export interface VerifyResult {
  /** 'valid' = matches a derived token, 'invalid' = no match. */
  status: 'valid' | 'invalid'
  /** The identity whose token matched (when identities are provided). */
  identity?: string
}

/** Options for token verification. */
export interface VerifyOptions {
  /** Output encoding to use for comparison (default: single word). */
  encoding?: TokenEncoding
  /** Counter tolerance window: accept tokens within ±tolerance (default: 0). */
  tolerance?: number
}

/**
 * Verify a spoken/entered token against a shared secret.
 *
 * Checks in order:
 * 1. Per-identity tokens at exact counter
 * 2. Per-identity tokens across tolerance window
 * 3. Group-wide token (no identity) across tolerance window
 * 4. No match → invalid
 *
 * @param secret - Shared secret (hex string or Uint8Array).
 * @param context - Context string for domain separation.
 * @param counter - Current time-based counter.
 * @param input - The spoken/entered token to verify.
 * @param identities - Optional array of member identities (max 100).
 * @param options - Optional encoding and tolerance settings.
 */
export function verifyToken(
  secret: Uint8Array | string,
  context: string,
  counter: number,
  input: string,
  identities?: string[],
  options?: VerifyOptions,
): VerifyResult {
  const encoding = options?.encoding ?? DEFAULT_ENCODING
  const tolerance = options?.tolerance ?? 0
  if (!Number.isInteger(tolerance) || tolerance < 0) {
    throw new RangeError('Tolerance must be a non-negative integer')
  }
  if (tolerance > MAX_TOLERANCE) {
    throw new RangeError(`Tolerance must be <= ${MAX_TOLERANCE}, got ${tolerance}`)
  }
  if (identities && identities.length > MAX_IDENTITIES) {
    throw new RangeError(`identities array must not exceed ${MAX_IDENTITIES} entries`)
  }
  if (identities) {
    for (const id of identities) {
      if (id.includes('\0')) throw new Error('identities must not contain null bytes')
    }
  }
  const normalised = input.toLowerCase().trim().replace(/\s+/g, ' ')
  const lo = Math.max(0, counter - tolerance)
  const hi = Math.min(0xFFFFFFFF, counter + tolerance)

  // Constant-time verification: always evaluate ALL candidates to prevent
  // timing side-channels that leak whether/where a match occurred.
  // Priority: identity-exact (3) > identity-tolerance (2) > group-wide (1).
  let bestPriority = 0
  let matchedIdentity: string | undefined

  // 1–2. Check per-identity tokens across full window
  if (identities && identities.length > 0) {
    for (const identity of identities) {
      for (let c = lo; c <= hi; c++) {
        if (timingSafeStringEqual(normalised, deriveToken(secret, context, c, encoding, identity))) {
          const p = c === counter ? 3 : 2
          if (p > bestPriority) {
            bestPriority = p
            matchedIdentity = identity
          }
        }
      }
    }
  }

  // 3. Check group-wide token (no identity)
  for (let c = lo; c <= hi; c++) {
    if (timingSafeStringEqual(normalised, deriveToken(secret, context, c, encoding))) {
      if (1 > bestPriority) {
        bestPriority = 1
        matchedIdentity = undefined
      }
    }
  }

  if (bestPriority > 0) {
    return matchedIdentity !== undefined
      ? { status: 'valid', identity: matchedIdentity }
      : { status: 'valid' }
  }
  return { status: 'invalid' }
}
