import { deriveToken } from './token.js'
import { timingSafeStringEqual } from './crypto.js'
import { type TokenEncoding, DEFAULT_ENCODING } from './encoding.js'

/** Maximum allowed tolerance value. */
export const MAX_TOLERANCE = 10

/** Maximum identities to bound computational cost. */
const MAX_IDENTITIES = 100

/** Default maximum raw input length accepted by verifyToken. */
export const MAX_INPUT_CHARS = 512

/** Identity verification behaviour when identities are supplied. */
export type VerifyIdentityMode = 'with-group-fallback' | 'identity-only'

const DEFAULT_IDENTITY_MODE: VerifyIdentityMode = 'with-group-fallback'

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
  /**
   * Identity handling mode (default: 'with-group-fallback').
   *
   * 'with-group-fallback' preserves historical behaviour: identity-bound tokens
   * are checked first, then anonymous group-wide tokens are also accepted.
   * 'identity-only' disables anonymous group-wide fallback and only accepts
   * tokens bound to one of the provided identities.
   */
  identityMode?: VerifyIdentityMode
}

/** Options for estimating the online guessing surface of a verification call. */
export interface VerificationRiskOptions {
  /** Output encoding to model (default: single word). */
  encoding?: TokenEncoding
  /** Counter tolerance window to model (default: 0). */
  tolerance?: number
  /** Identity count or identities array to model (default: 0). */
  identities?: number | readonly string[]
  /** Identity handling mode to model (default: 'with-group-fallback'). */
  identityMode?: VerifyIdentityMode
}

/** Estimated online guessing surface for one verification attempt. */
export interface VerificationRisk {
  /** Number of derived tokens accepted by the verification parameters. */
  candidates: number
  /** Number of possible values in the selected encoding. */
  tokenSpace: number
  /** Probability that one random input lands on any accepted candidate. */
  singleAttemptSuccessProbability: number
  /** Effective bits against one random online guess. */
  effectiveBits: number
}

function normaliseIdentityMode(mode: VerifyIdentityMode | undefined): VerifyIdentityMode {
  const identityMode = mode ?? DEFAULT_IDENTITY_MODE
  if (identityMode !== 'with-group-fallback' && identityMode !== 'identity-only') {
    throw new Error(`Unsupported identity mode: ${String(identityMode)}`)
  }
  return identityMode
}

function validateTolerance(tolerance: number): void {
  if (!Number.isInteger(tolerance) || tolerance < 0) {
    throw new RangeError('Tolerance must be a non-negative integer')
  }
  if (tolerance > MAX_TOLERANCE) {
    throw new RangeError(`Tolerance must be <= ${MAX_TOLERANCE}, got ${tolerance}`)
  }
}

function validateIdentityCount(identityCount: number): void {
  if (!Number.isInteger(identityCount) || identityCount < 0) {
    throw new RangeError('identities count must be a non-negative integer')
  }
  if (identityCount > MAX_IDENTITIES) {
    throw new RangeError(`identities array must not exceed ${MAX_IDENTITIES} entries`)
  }
}

function tokenSpaceForEncoding(encoding: TokenEncoding): number {
  switch (encoding.format) {
    case 'words': {
      const count = encoding.count ?? 1
      const wordlistSize = encoding.wordlist?.length ?? 2048
      if (!Number.isInteger(count) || count < 1 || count > 16) {
        throw new RangeError('Word count must be an integer 1–16')
      }
      if (wordlistSize !== 2048) throw new RangeError('Wordlist must contain exactly 2048 entries')
      return wordlistSize ** count
    }
    case 'pin': {
      const digits = encoding.digits ?? 4
      if (!Number.isInteger(digits) || digits < 1 || digits > 10) {
        throw new RangeError('PIN digits must be an integer 1–10')
      }
      return 10 ** digits
    }
    case 'hex': {
      const length = encoding.length ?? 8
      if (!Number.isInteger(length) || length < 1 || length > 64) {
        throw new RangeError('Hex length must be an integer 1–64')
      }
      return 16 ** length
    }
    default:
      throw new Error(`Unsupported encoding format: ${(encoding as { format: string }).format}`)
  }
}

function maxInputCharsForEncoding(encoding: TokenEncoding): number {
  if (encoding.format !== 'words') return MAX_INPUT_CHARS

  const count = encoding.count ?? 1
  if (!Number.isInteger(count) || count < 1 || count > 16) {
    throw new RangeError('Word count must be an integer 1–16')
  }
  if (encoding.wordlist !== undefined && encoding.wordlist.length !== 2048) {
    throw new RangeError('Wordlist must contain exactly 2048 entries')
  }

  const maxWordLength = encoding.wordlist === undefined
    ? 8
    : encoding.wordlist.reduce((max, word) => Math.max(max, word.length), 0)
  const maxNormalisedLength = count * maxWordLength + Math.max(0, count - 1)
  return Math.max(MAX_INPUT_CHARS, maxNormalisedLength + 64)
}

/**
 * Estimate how many token values a verification call accepts and the resulting
 * probability that a single random online guess succeeds.
 *
 * This helper models the nominal full tolerance window. Verification near
 * counter 0 or uint32 max may have a smaller effective window due to clamping.
 */
export function estimateVerificationRisk(options: VerificationRiskOptions = {}): VerificationRisk {
  const encoding = options.encoding ?? DEFAULT_ENCODING
  const tolerance = options.tolerance ?? 0
  const identityMode = normaliseIdentityMode(options.identityMode)
  validateTolerance(tolerance)

  const identityCount = typeof options.identities === 'number'
    ? options.identities
    : options.identities?.length ?? 0
  validateIdentityCount(identityCount)

  const windowSize = tolerance * 2 + 1
  const identityCandidates = identityCount * windowSize
  const groupCandidates = identityMode === 'with-group-fallback' ? windowSize : 0
  const candidates = identityCandidates + groupCandidates
  const tokenSpace = tokenSpaceForEncoding(encoding)
  const singleAttemptSuccessProbability = candidates === 0
    ? 0
    : 1 - (1 - 1 / tokenSpace) ** candidates
  const effectiveBits = singleAttemptSuccessProbability === 0
    ? Infinity
    : -Math.log2(singleAttemptSuccessProbability)

  return {
    candidates,
    tokenSpace,
    singleAttemptSuccessProbability,
    effectiveBits,
  }
}

/**
 * Verify a spoken/entered token against a shared secret.
 *
 * Checks in order:
 * 1. Per-identity tokens at exact counter
 * 2. Per-identity tokens across tolerance window
 * 3. Group-wide token (no identity) across tolerance window, unless identityMode='identity-only'
 * 4. No match → invalid
 *
 * **Identity collision note:** With low-entropy encodings (single word = 2048
 * values), different identities may produce the same token at the same counter.
 * For 100 identities, collision probability is ~2.4% per counter. When a
 * collision occurs, the first matching identity in the array wins. Use
 * multi-word or PIN encoding for reliable identity attribution with large groups.
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
  const identityMode = normaliseIdentityMode(options?.identityMode)
  if (!context || !context.trim()) {
    throw new Error('context must be a non-empty string')
  }
  if (context.includes('\0')) {
    throw new Error('context must not contain null bytes')
  }
  if (!Number.isInteger(counter) || counter < 0 || counter > 0xFFFFFFFF) {
    throw new RangeError(`Counter must be an integer 0–${0xFFFFFFFF}, got ${counter}`)
  }
  validateTolerance(tolerance)
  if (identities && identities.length > MAX_IDENTITIES) {
    throw new RangeError(`identities array must not exceed ${MAX_IDENTITIES} entries`)
  }
  if (identities) {
    for (const id of identities) {
      if (!id || !id.trim()) throw new Error('identities must be non-empty strings')
      if (id.includes('\0')) throw new Error('identities must not contain null bytes')
    }
  }
  if (input.length > maxInputCharsForEncoding(encoding)) {
    return { status: 'invalid' }
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

  // 3. Check group-wide token (no identity), unless explicitly disabled
  if (identityMode === 'with-group-fallback') {
    for (let c = lo; c <= hi; c++) {
      if (timingSafeStringEqual(normalised, deriveToken(secret, context, c, encoding))) {
        if (1 > bestPriority) {
          bestPriority = 1
          matchedIdentity = undefined
        }
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
