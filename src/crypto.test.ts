import { describe, it, expect } from 'vitest'
import { timingSafeEqual, timingSafeStringEqual, hexToBytes, bytesToHex, readUint16BE, sha256, hmacSha256, randomSeed, concatBytes, bytesToBase64, base64ToBytes } from './crypto.js'

describe('timingSafeEqual', () => {
  it('returns true for equal arrays', () => {
    const a = new Uint8Array([1, 2, 3])
    expect(timingSafeEqual(a, new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('returns false for different arrays', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })

  it('returns true for empty arrays', () => {
    expect(timingSafeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true)
  })

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqual(new Uint8Array([]), new Uint8Array([1, 2, 3]))).toBe(false)
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([]))).toBe(false)
  })
})

describe('timingSafeStringEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeStringEqual('falcon', 'falcon')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(timingSafeStringEqual('falcon', 'eagle')).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(timingSafeStringEqual('falcon', 'falcons')).toBe(false)
  })

  it('returns true for empty strings', () => {
    expect(timingSafeStringEqual('', '')).toBe(true)
  })

  it('handles unicode correctly', () => {
    expect(timingSafeStringEqual('café', 'café')).toBe(true)
    expect(timingSafeStringEqual('café', 'cafe')).toBe(false)
  })
})

describe('hexToBytes', () => {
  it('converts valid hex', () => {
    expect(hexToBytes('0102ff')).toEqual(new Uint8Array([1, 2, 255]))
  })

  it('returns empty Uint8Array for empty string', () => {
    expect(hexToBytes('')).toEqual(new Uint8Array([]))
  })

  it('throws on odd-length hex', () => {
    expect(() => hexToBytes('abc')).toThrow()
  })

  it('throws on invalid hex characters', () => {
    expect(() => hexToBytes('zz')).toThrow(TypeError)
    expect(() => hexToBytes('0g')).toThrow(TypeError)
    expect(() => hexToBytes('xx')).toThrow(TypeError)
  })
})

describe('readUint16BE', () => {
  it('reads correctly', () => {
    expect(readUint16BE(new Uint8Array([0x01, 0x00]), 0)).toBe(256)
  })

  it('throws on out-of-bounds offset', () => {
    expect(() => readUint16BE(new Uint8Array([0x01]), 0)).toThrow(RangeError)
    expect(() => readUint16BE(new Uint8Array([0x01, 0x02]), 1)).toThrow(RangeError)
  })

  it('throws on negative offset (security audit)', () => {
    expect(() => readUint16BE(new Uint8Array([0x01, 0x02]), -1)).toThrow(RangeError)
  })

  it('throws on NaN offset', () => {
    expect(() => readUint16BE(new Uint8Array([0x01, 0x02, 0x03]), NaN)).toThrow(RangeError)
  })

  it('throws on fractional offset', () => {
    expect(() => readUint16BE(new Uint8Array([0x01, 0x02, 0x03]), 0.5)).toThrow(RangeError)
  })
})

describe('sha256', () => {
  it('hashes empty input correctly', () => {
    const hash = bytesToHex(sha256(new Uint8Array([])))
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('hashes "abc" correctly', () => {
    const input = new TextEncoder().encode('abc')
    const hash = bytesToHex(sha256(input))
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('handles 55-byte input (one-block padding boundary)', () => {
    const input = new Uint8Array(55).fill(0x61) // 55 × 'a'
    const hash = bytesToHex(sha256(input))
    expect(hash).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318')
  })

  it('handles 56-byte input (two-block padding boundary)', () => {
    const input = new Uint8Array(56).fill(0x61) // 56 × 'a'
    const hash = bytesToHex(sha256(input))
    expect(hash).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a')
  })

  it('handles 64-byte input (exact block boundary)', () => {
    const input = new Uint8Array(64).fill(0x61) // 64 × 'a'
    const hash = bytesToHex(sha256(input))
    expect(hash).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb')
  })

  it('handles 128-byte input (multi-block)', () => {
    const input = new Uint8Array(128).fill(0x61) // 128 × 'a'
    const hash = bytesToHex(sha256(input))
    expect(hash).toBe('6836cf13bac400e9105071cd6af47084dfacad4e5e302c94bfed24e013afb73e')
  })

  it('NIST two-block test vector (FIPS 180-4)', () => {
    const input = new TextEncoder().encode(
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    )
    const hash = bytesToHex(sha256(input))
    expect(hash).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })
})

describe('randomSeed', () => {
  it('returns a 64-char hex string', () => {
    const seed = randomSeed()
    expect(seed).toHaveLength(64)
    expect(seed).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces unique values', () => {
    const seeds = new Set(Array.from({ length: 10 }, () => randomSeed()))
    expect(seeds.size).toBe(10)
  })
})

describe('hmacSha256', () => {
  // RFC 4231 Test Case 1 — short key
  it('TC1: produces correct HMAC for known input', () => {
    const key = new Uint8Array(20).fill(0x0b)
    const data = new TextEncoder().encode('Hi There')
    const mac = bytesToHex(hmacSha256(key, data))
    expect(mac).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  })

  // RFC 4231 Test Case 2 — short key "Jefe"
  it('TC2: key="Jefe", data="what do ya want for nothing?"', () => {
    const key = new TextEncoder().encode('Jefe')
    const data = new TextEncoder().encode('what do ya want for nothing?')
    const mac = bytesToHex(hmacSha256(key, data))
    expect(mac).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })

  // RFC 4231 Test Case 3 — 20-byte key, 50-byte data
  it('TC3: key=20×0xaa, data=50×0xdd', () => {
    const key = new Uint8Array(20).fill(0xaa)
    const data = new Uint8Array(50).fill(0xdd)
    const mac = bytesToHex(hmacSha256(key, data))
    expect(mac).toBe('773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe')
  })

  // RFC 4231 Test Case 4 — non-uniform key 0x01..0x19, 50 × 0xcd
  it('TC4: key=0x01..0x19, data=50×0xcd', () => {
    const key = new Uint8Array(25)
    for (let i = 0; i < 25; i++) key[i] = i + 1
    const data = new Uint8Array(50).fill(0xcd)
    const mac = bytesToHex(hmacSha256(key, data))
    expect(mac).toBe('82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b')
  })

  // Key boundary: exactly 64 bytes (block size) — should NOT be hashed
  it('key exactly 64 bytes (block size boundary, not hashed)', () => {
    const key = new Uint8Array(64).fill(0x42)
    const data = new TextEncoder().encode('test')
    const mac = hmacSha256(key, data)
    expect(mac).toBeInstanceOf(Uint8Array)
    expect(mac).toHaveLength(32)
  })

  // Key boundary: 65 bytes (one over block size) — should be hashed
  it('key 65 bytes (one over block size, exercises key hashing branch)', () => {
    const key = new Uint8Array(65).fill(0x42)
    const data = new TextEncoder().encode('test')
    const mac65 = bytesToHex(hmacSha256(key, data))
    // Must differ from 64-byte key (different code path)
    const key64 = new Uint8Array(64).fill(0x42)
    const mac64 = bytesToHex(hmacSha256(key64, data))
    expect(mac65).not.toBe(mac64)
  })

  // RFC 4231 Test Case 6 — key longer than block size (131 bytes)
  it('TC6: key=131×0xaa (longer than block size), exercises key hashing branch', () => {
    const key = new Uint8Array(131).fill(0xaa)
    const data = new TextEncoder().encode('Test Using Larger Than Block-Size Key - Hash Key First')
    const mac = bytesToHex(hmacSha256(key, data))
    expect(mac).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54')
  })

  // HMAC with empty data — exercises ipad-only inner hash
  it('produces correct HMAC with empty data', () => {
    const key = new Uint8Array(20).fill(0x0b)
    const mac = bytesToHex(hmacSha256(key, new Uint8Array(0)))
    // Cross-validated: matches Node.js crypto.createHmac('sha256', Buffer.alloc(20, 0x0b)).update('').digest('hex')
    expect(mac).toBe('999a901219f032cd497cadb5e6051e97b6a29ab297bd6ae722bd6062a2f59542')
  })

  // RFC 4231 Test Case 7 — key longer than block size, longer data
  it('TC7: key=131×0xaa, longer data string', () => {
    const key = new Uint8Array(131).fill(0xaa)
    const data = new TextEncoder().encode(
      'This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.',
    )
    const mac = bytesToHex(hmacSha256(key, data))
    expect(mac).toBe('9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2')
  })
})

describe('concatBytes', () => {
  it('concatenates multiple arrays', () => {
    const result = concatBytes(new Uint8Array([1, 2]), new Uint8Array([3, 4]))
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  it('handles empty arrays', () => {
    const result = concatBytes(new Uint8Array([]), new Uint8Array([1]))
    expect(result).toEqual(new Uint8Array([1]))
  })

  it('handles single array', () => {
    const result = concatBytes(new Uint8Array([1, 2, 3]))
    expect(result).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('handles all empty arrays', () => {
    const result = concatBytes(new Uint8Array([]), new Uint8Array([]))
    expect(result).toEqual(new Uint8Array([]))
  })
})

describe('bytesToBase64 / base64ToBytes', () => {
  it('round-trips known value', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const b64 = bytesToBase64(input)
    expect(b64).toBe('SGVsbG8=')
    expect(base64ToBytes(b64)).toEqual(input)
  })

  it('round-trips empty input', () => {
    const input = new Uint8Array([])
    const b64 = bytesToBase64(input)
    expect(b64).toBe('')
    expect(base64ToBytes(b64)).toEqual(input)
  })

  it('round-trips single byte', () => {
    const input = new Uint8Array([0xff])
    expect(base64ToBytes(bytesToBase64(input))).toEqual(input)
  })

  it('round-trips 32 random-like bytes', () => {
    const input = new Uint8Array(32)
    for (let i = 0; i < 32; i++) input[i] = (i * 37 + 13) % 256
    expect(base64ToBytes(bytesToBase64(input))).toEqual(input)
  })

  it('round-trips bytes containing null', () => {
    const input = new Uint8Array([0x00, 0x01, 0x00])
    expect(base64ToBytes(bytesToBase64(input))).toEqual(input)
  })

  it('throws on invalid base64', () => {
    expect(() => base64ToBytes('not!valid!base64!')).toThrow()
  })
})
