import { describe, it, expect } from 'vitest'
import { encodeAsWords, encodeAsPin, encodeAsHex, encodeToken } from './encoding.js'
import { WORDLIST } from './wordlist.js'

describe('encodeAsWords', () => {
  it('encodes 1 word from first 2 bytes', () => {
    const bytes = new Uint8Array(32)
    const words = encodeAsWords(bytes, 1)
    expect(words).toHaveLength(1)
    expect(words[0]).toBe(WORDLIST[0])
  })

  it('encodes multiple words from consecutive 2-byte slices', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0x00; bytes[1] = 0x01
    bytes[2] = 0x00; bytes[3] = 0x02
    bytes[4] = 0x00; bytes[5] = 0x03
    const words = encodeAsWords(bytes, 3)
    expect(words).toHaveLength(3)
    expect(words[0]).toBe(WORDLIST[1])
    expect(words[1]).toBe(WORDLIST[2])
    expect(words[2]).toBe(WORDLIST[3])
  })

  it('wraps index modulo wordlist size', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0xFF; bytes[1] = 0xFF
    const words = encodeAsWords(bytes, 1)
    expect(words[0]).toBe(WORDLIST[65535 % 2048])
  })

  it('throws on count < 1', () => {
    expect(() => encodeAsWords(new Uint8Array(32), 0)).toThrow()
  })

  it('throws on insufficient bytes', () => {
    expect(() => encodeAsWords(new Uint8Array(2), 2)).toThrow()
  })

  it('rejects non-2048 wordlist', () => {
    const shortList = Array.from({ length: 100 }, (_, i) => `word${i}`)
    expect(() => encodeAsWords(new Uint8Array(32), 1, shortList)).toThrow(RangeError)
  })
})

describe('encodeAsPin bias', () => {
  // PIN_BYTES lookup table: [0, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6]
  // All digit counts have max per-value bias (ceil/floor ratio - 1) < 1%.
  it('all digit counts have per-value bias below 1%', () => {
    const pinBytes = [0, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6]
    for (let d = 1; d <= 10; d++) {
      const maxVal = 2 ** (pinBytes[d] * 8)
      const mod = 10 ** d
      const floor = Math.floor(maxVal / mod)
      const ratio = (floor + 1) / floor
      expect(ratio - 1).toBeLessThan(0.01)
    }
  })

  it('10-digit PIN works with 6 bytes', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0x00
    const minPin = encodeAsPin(bytes, 10)
    expect(minPin).toHaveLength(10)

    bytes.fill(0xff)
    const maxPin = encodeAsPin(bytes, 10)
    expect(Number(maxPin)).toBeLessThan(10_000_000_000)
  })
})

describe('encodeAsPin', () => {
  it('encodes 4-digit PIN with leading zeros', () => {
    const bytes = new Uint8Array(32)
    const pin = encodeAsPin(bytes, 4)
    expect(pin).toBe('0000')
    expect(pin).toHaveLength(4)
  })

  it('encodes a non-zero PIN', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0x12; bytes[1] = 0x34
    const pin = encodeAsPin(bytes, 4)
    expect(pin).toHaveLength(4)
    expect(Number(pin)).toBeLessThan(10000)
  })

  it('encodes 6-digit PIN', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0xAB; bytes[1] = 0xCD; bytes[2] = 0xEF
    const pin = encodeAsPin(bytes, 6)
    expect(pin).toHaveLength(6)
    expect(Number(pin)).toBeLessThan(1000000)
  })

  it('encodes 9-digit PIN correctly', () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff])
    const pin = encodeAsPin(bytes, 9)
    expect(pin).toHaveLength(9)
    expect(pin).toMatch(/^\d{9}$/)
  })

  it('encodes 10-digit PIN with values above 2^32', () => {
    // 6 bytes all 0xff = 281,474,976,710,655 — mod 10^10 = 4,976,710,655
    const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
    const pin = encodeAsPin(bytes, 10)
    expect(pin).toHaveLength(10)
    expect(pin).toBe('4976710655')
  })

  it('throws on digits > 10', () => {
    expect(() => encodeAsPin(new Uint8Array(32), 11)).toThrow()
  })
})

describe('encodeAsHex', () => {
  it('encodes first N hex chars', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0xAB; bytes[1] = 0xCD; bytes[2] = 0xEF; bytes[3] = 0x01
    expect(encodeAsHex(bytes, 8)).toBe('abcdef01')
  })

  it('truncates to requested length', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0xAB; bytes[1] = 0xCD
    expect(encodeAsHex(bytes, 3)).toBe('abc')
  })

  it('throws on length > 64', () => {
    expect(() => encodeAsHex(new Uint8Array(32), 65)).toThrow()
  })

  it('encodes length = 1 (odd length — single hex nibble)', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 0xAB
    const result = encodeAsHex(bytes, 1)
    expect(result).toHaveLength(1)
    expect(result).toBe('a')
  })
})

describe('encodeAsWords with maximum count', () => {
  it('encodes 16 words from 32 bytes (maximum allowed)', () => {
    const bytes = new Uint8Array(32)
    const words = encodeAsWords(bytes, 16)
    expect(words).toHaveLength(16)
    expect(words.every(w => typeof w === 'string' && w.length > 0)).toBe(true)
  })
})

describe('encoding input validation', () => {
  it('encodeAsWords rejects fractional count', () => {
    expect(() => encodeAsWords(new Uint8Array(32), 1.5)).toThrow('Word count must be an integer 1–16')
  })

  it('encodeAsPin rejects empty byte array', () => {
    expect(() => encodeAsPin(new Uint8Array(0), 4)).toThrow('Cannot encode empty byte array as PIN')
  })

  it('encodeAsPin rejects fractional digits', () => {
    expect(() => encodeAsPin(new Uint8Array(32), 3.5)).toThrow('PIN digits must be an integer 1–10')
  })

  it('encodeAsHex rejects insufficient bytes', () => {
    expect(() => encodeAsHex(new Uint8Array(1), 8)).toThrow('Not enough bytes')
  })

  it('encodeAsHex rejects fractional length', () => {
    expect(() => encodeAsHex(new Uint8Array(32), 7.5)).toThrow('Hex length must be an integer 1–64')
  })

  it('encodeAsPin rejects insufficient bytes', () => {
    expect(() => encodeAsPin(new Uint8Array(1), 8)).toThrow('Not enough bytes')
  })
})

describe('encodeToken', () => {
  it('defaults to single word', () => {
    const bytes = new Uint8Array(32)
    const token = encodeToken(bytes)
    expect(token).toBe(WORDLIST[0])
  })

  it('space-joins multiple words', () => {
    const bytes = new Uint8Array(32)
    const token = encodeToken(bytes, { format: 'words', count: 2 })
    expect(token.split(' ')).toHaveLength(2)
  })

  it('dispatches to pin encoding', () => {
    const bytes = new Uint8Array(32)
    const token = encodeToken(bytes, { format: 'pin', digits: 4 })
    expect(token).toHaveLength(4)
  })

  it('dispatches to hex encoding', () => {
    const bytes = new Uint8Array(32)
    const token = encodeToken(bytes, { format: 'hex', length: 8 })
    expect(token).toHaveLength(8)
  })

  it('throws on unsupported encoding format', () => {
    const bytes = new Uint8Array(32)
    expect(() => encodeToken(bytes, { format: 'base64' } as never)).toThrow('Unsupported encoding format: base64')
  })
})
