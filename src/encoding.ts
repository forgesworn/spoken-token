import { readUint16BE } from './crypto.js'
import { WORDLIST } from './wordlist.js'

/** Encoding options for token output. */
export type TokenEncoding =
  | { format: 'words'; count?: number; wordlist?: readonly string[] }
  | { format: 'pin'; digits?: number }
  | { format: 'hex'; length?: number }

/** Default encoding: single word from en-v1 wordlist. */
export const DEFAULT_ENCODING: TokenEncoding = { format: 'words', count: 1 }

/**
 * Encode raw bytes as words using 11-bit indices into a wordlist.
 * Each word uses a consecutive 2-byte slice: readUint16BE(bytes, i*2) % wordlistSize.
 *
 * @param bytes - Raw bytes to encode (must have at least `count * 2` bytes).
 * @param count - Number of words to produce (integer 1–16, default: 1).
 * @param wordlist - Custom wordlist (must be exactly 2048 entries, default: en-v1).
 * @returns Array of lowercase word strings.
 * @throws {RangeError} If count is not an integer 1–16, wordlist is wrong size, or insufficient bytes.
 */
export function encodeAsWords(
  bytes: Uint8Array,
  count: number = 1,
  wordlist: readonly string[] = WORDLIST,
): string[] {
  if (wordlist.length !== 2048) throw new RangeError('Wordlist must contain exactly 2048 entries')
  if (!Number.isInteger(count) || count < 1 || count > 16) throw new RangeError('Word count must be an integer 1–16')
  if (bytes.length < count * 2) throw new RangeError('Not enough bytes for requested word count')
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    const index = readUint16BE(bytes, i * 2) % wordlist.length
    words.push(wordlist[index])
  }
  return words
}

/**
 * Minimum bytes per digit count to keep max per-value bias below 1%.
 * Each entry is the smallest b where `floor(2^(b×8) / 10^digits) >= 100`,
 * except d=10 which uses b=6 (not b=5) for a tighter 0.004% bias.
 * Index 0 is unused; indices 1–10 correspond to digit counts 1–10.
 */
const PIN_BYTES: readonly number[] = [0, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6]

/**
 * Encode raw bytes as a numeric PIN with leading zeros.
 * Uses a pre-computed byte count per digit to keep modular bias below 1%,
 * interpreted as a big-endian integer, reduced modulo 10^digits.
 *
 * @param bytes - Raw bytes to encode (must be non-empty).
 * @param digits - Number of PIN digits to produce (integer 1-10, default: 4).
 * @returns Zero-padded numeric string of the specified length.
 * @throws {RangeError} If digits is not an integer 1-10 or bytes is empty.
 */
export function encodeAsPin(bytes: Uint8Array, digits: number = 4): string {
  if (!Number.isInteger(digits) || digits < 1 || digits > 10) throw new RangeError('PIN digits must be an integer 1–10')
  if (bytes.length === 0) throw new RangeError('Cannot encode empty byte array as PIN')
  const needed = PIN_BYTES[digits]
  if (bytes.length < needed) throw new RangeError(`Not enough bytes for ${digits}-digit PIN: need ${needed}, got ${bytes.length}`)
  const mod = Math.pow(10, digits)

  // Use BigInt accumulation when byte count exceeds 4 to avoid 32-bit overflow in >>> 0
  if (needed > 4) {
    let bigVal = 0n
    for (let i = 0; i < needed; i++) bigVal = bigVal * 256n + BigInt(bytes[i])
    return (Number(bigVal % BigInt(mod))).toString().padStart(digits, '0')
  }

  let value = 0
  for (let i = 0; i < needed; i++) {
    value = (value * 256 + bytes[i]) >>> 0
  }
  return (value % mod).toString().padStart(digits, '0')
}

/**
 * Encode raw bytes as a lowercase hex string.
 *
 * @param bytes - Raw bytes to encode.
 * @param length - Number of hex characters to produce (integer 1-64, default: 8).
 * @returns Lowercase hex string of the specified length.
 * @throws {RangeError} If length is not an integer 1-64 or insufficient bytes are provided.
 */
export function encodeAsHex(bytes: Uint8Array, length: number = 8): string {
  if (!Number.isInteger(length) || length < 1 || length > 64) throw new RangeError('Hex length must be an integer 1–64')
  const needed = Math.ceil(length / 2)
  if (bytes.length < needed) throw new RangeError(`Not enough bytes: need ${needed}, got ${bytes.length}`)
  let hex = ''
  for (let i = 0; i < needed && i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex.slice(0, length)
}

/**
 * Encode raw bytes using the specified encoding format.
 * Returns a single string (words are space-joined).
 *
 * @param bytes - Raw bytes to encode.
 * @param encoding - Encoding format: words, pin, or hex (default: single word).
 * @returns Encoded token string (space-joined words, zero-padded PIN, or hex).
 * @throws {RangeError} If encoding parameters are out of range or bytes are insufficient.
 */
export function encodeToken(bytes: Uint8Array, encoding: TokenEncoding = DEFAULT_ENCODING): string {
  switch (encoding.format) {
    case 'words':
      return encodeAsWords(bytes, encoding.count ?? 1, encoding.wordlist).join(' ')
    case 'pin':
      return encodeAsPin(bytes, encoding.digits ?? 4)
    case 'hex':
      return encodeAsHex(bytes, encoding.length ?? 8)
    default:
      throw new Error(`Unsupported encoding format: ${(encoding as { format: string }).format}`)
  }
}
