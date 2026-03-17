import { describe, it, expect } from 'vitest'
import { deriveTokenBytes, deriveToken, deriveDirectionalPair } from './token.js'
import { hexToBytes, bytesToHex } from './crypto.js'

const SECRET_1 = '0000000000000000000000000000000000000000000000000000000000000001'
const SECRET_2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

// ─── Protocol compatibility vectors ────────────────────────────────────────
// From conformance/vectors.json in canary-kit (authoritative source).
// Outputs MUST be byte-identical to canary-kit.
describe('protocol compatibility vectors', () => {
  // U-01: deriveTokenBytes
  it('U-01: deriveTokenBytes(SECRET_1, canary:verify, 0) raw bytes', () => {
    const bytes = deriveTokenBytes(SECRET_1, 'canary:verify', 0)
    expect(bytesToHex(bytes)).toBe('c51524053f1f27a4c871c63069f285ce5ac5b69a40d6caa5af9b6945dd9556d1')
  })

  // U-02: deriveToken single word
  it('U-02: deriveToken(SECRET_1, canary:verify, 0) → "net"', () => {
    expect(deriveToken(SECRET_1, 'canary:verify', 0)).toBe('net')
  })

  // U-03: deriveToken at counter=1
  it('U-03: deriveToken(SECRET_1, canary:verify, 1) → "famous"', () => {
    expect(deriveToken(SECRET_1, 'canary:verify', 1)).toBe('famous')
  })

  // U-04: PIN encoding
  it('U-04: deriveToken(SECRET_1, dispatch:handoff, 0, pin 4-digit) → "1429"', () => {
    expect(deriveToken(SECRET_1, 'dispatch:handoff', 0, { format: 'pin', digits: 4 })).toBe('1429')
  })

  // U-05: 3-word phrase
  it('U-05: deriveToken(SECRET_1, id:verify, 0, 3 words) → "decrease mistake require"', () => {
    expect(deriveToken(SECRET_1, 'id:verify', 0, { format: 'words', count: 3 })).toBe('decrease mistake require')
  })

  // U-11/U-12: directional context tokens (namespace\0role pattern)
  it('U-11: deriveToken(SECRET_1, aviva:caller, 0) → "bid"', () => {
    expect(deriveToken(SECRET_1, 'aviva:caller', 0)).toBe('bid')
  })

  it('U-12: deriveToken(SECRET_1, aviva:agent, 0) → "choose"', () => {
    expect(deriveToken(SECRET_1, 'aviva:agent', 0)).toBe('choose')
  })
})

// ─── deriveTokenBytes ───────────────────────────────────────────────────────
describe('deriveTokenBytes', () => {
  it('returns 32 bytes', () => {
    const bytes = deriveTokenBytes(SECRET_1, 'test', 0)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(32)
  })

  it('is deterministic', () => {
    const a = deriveTokenBytes(SECRET_1, 'test', 0)
    const b = deriveTokenBytes(SECRET_1, 'test', 0)
    expect(bytesToHex(a)).toBe(bytesToHex(b))
  })

  it('different context produces different output', () => {
    const a = deriveTokenBytes(SECRET_1, 'context-a', 0)
    const b = deriveTokenBytes(SECRET_1, 'context-b', 0)
    expect(bytesToHex(a)).not.toBe(bytesToHex(b))
  })

  it('different counter produces different output', () => {
    const a = deriveTokenBytes(SECRET_1, 'test', 0)
    const b = deriveTokenBytes(SECRET_1, 'test', 1)
    expect(bytesToHex(a)).not.toBe(bytesToHex(b))
  })

  it('different secret produces different output', () => {
    const a = deriveTokenBytes(SECRET_1, 'test', 0)
    const b = deriveTokenBytes(SECRET_2, 'test', 0)
    expect(bytesToHex(a)).not.toBe(bytesToHex(b))
  })

  it('accepts Uint8Array secret', () => {
    const secretBytes = hexToBytes(SECRET_1)
    const a = deriveTokenBytes(SECRET_1, 'test', 0)
    const b = deriveTokenBytes(secretBytes, 'test', 0)
    expect(bytesToHex(a)).toBe(bytesToHex(b))
  })

  it('identity parameter produces different output from group-wide token', () => {
    const group = deriveTokenBytes(SECRET_1, 'test', 0)
    const member = deriveTokenBytes(SECRET_1, 'test', 0, 'alice')
    expect(bytesToHex(group)).not.toBe(bytesToHex(member))
  })

  it('different identities produce different output', () => {
    const a = deriveTokenBytes(SECRET_1, 'test', 0, 'alice')
    const b = deriveTokenBytes(SECRET_1, 'test', 0, 'bob')
    expect(bytesToHex(a)).not.toBe(bytesToHex(b))
  })

  it('empty identity throws', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', 0, '')).toThrow('identity must be a non-empty string when provided')
  })

  it('whitespace-only identity throws', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', 0, '   ')).toThrow('identity must be a non-empty string when provided')
    expect(() => deriveTokenBytes(SECRET_1, 'test', 0, '\t')).toThrow('identity must be a non-empty string when provided')
  })

  it('throws on NaN counter', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', NaN)).toThrow(RangeError)
  })

  it('throws on Infinity counter', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', Infinity)).toThrow(RangeError)
  })

  it('throws on empty context string', () => {
    expect(() => deriveTokenBytes(SECRET_1, '', 0)).toThrow('context must be a non-empty string')
  })

  it('throws on whitespace-only context string', () => {
    expect(() => deriveTokenBytes(SECRET_1, '   ', 0)).toThrow('context must be a non-empty string')
    expect(() => deriveTokenBytes(SECRET_1, '\t', 0)).toThrow('context must be a non-empty string')
  })

  it('throws on identity containing null bytes', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', 0, 'a\0b')).toThrow('identity must not contain null bytes')
  })

  it('throws on secret shorter than 16 bytes', () => {
    const shortSecret = hexToBytes('00112233445566778899aabbccddeeff').slice(0, 15)
    expect(() => deriveTokenBytes(shortSecret, 'test', 0)).toThrow(RangeError)
  })

  it('throws on counter overflow (> 0xFFFFFFFF)', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', 0x100000000)).toThrow(RangeError)
  })

  it('throws on negative counter', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', -1)).toThrow(RangeError)
  })

  it('throws on fractional counter', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'test', 1.5)).toThrow(RangeError)
  })

  it('accepts counter at max uint32 boundary', () => {
    const bytes = deriveTokenBytes(SECRET_1, 'test', 0xFFFFFFFF)
    expect(bytes).toHaveLength(32)
  })

  it('accepts counter 0', () => {
    const bytes = deriveTokenBytes(SECRET_1, 'test', 0)
    expect(bytes).toHaveLength(32)
  })
})

// ─── deriveToken ────────────────────────────────────────────────────────────
describe('deriveToken', () => {
  it('defaults to single word', () => {
    const token = deriveToken(SECRET_1, 'test', 0)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    expect(token.split(' ')).toHaveLength(1)
  })

  it('encodes as PIN', () => {
    const token = deriveToken(SECRET_1, 'test', 0, { format: 'pin', digits: 4 })
    expect(token).toHaveLength(4)
    expect(token).toMatch(/^\d{4}$/)
  })

  it('encodes as hex', () => {
    const token = deriveToken(SECRET_1, 'test', 0, { format: 'hex', length: 8 })
    expect(token).toHaveLength(8)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('encodes as multi-word phrase', () => {
    const token = deriveToken(SECRET_1, 'test', 0, { format: 'words', count: 3 })
    expect(token.split(' ')).toHaveLength(3)
  })

  it('is deterministic', () => {
    const a = deriveToken(SECRET_1, 'test', 0)
    const b = deriveToken(SECRET_1, 'test', 0)
    expect(a).toBe(b)
  })

  it('identity produces distinct token from group-wide', () => {
    const group = deriveToken(SECRET_1, 'test', 0)
    const member = deriveToken(SECRET_1, 'test', 0, undefined, 'alice')
    expect(group).not.toBe(member)
  })

  it('different identities produce different tokens', () => {
    const a = deriveToken(SECRET_1, 'test', 0, undefined, 'alice')
    const b = deriveToken(SECRET_1, 'test', 0, undefined, 'bob')
    expect(a).not.toBe(b)
  })

  it('throws on context containing null bytes', () => {
    expect(() => deriveToken(SECRET_1, 'a\0b', 0)).toThrow('context must not contain null bytes')
  })

  it('throws on identity containing null bytes', () => {
    expect(() => deriveToken(SECRET_1, 'test', 0, undefined, 'a\0b')).toThrow('identity must not contain null bytes')
  })
})

// ─── deriveTokenBytes null-byte context validation ──────────────────────────
describe('deriveTokenBytes context null-byte validation', () => {
  it('throws on context containing null bytes (public API)', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'a\0b', 0)).toThrow('context must not contain null bytes')
  })

  it('throws on context mimicking directional pair format', () => {
    expect(() => deriveTokenBytes(SECRET_1, 'dispatch\0caller', 0)).toThrow('context must not contain null bytes')
  })
})

// ─── deriveDirectionalPair matches expected derivation ──────────────────────
describe('deriveDirectionalPair equivalence', () => {
  it('directional pair still works after internal refactor', () => {
    const pair = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 0)
    expect(typeof pair.caller).toBe('string')
    expect(typeof pair.agent).toBe('string')
    expect(pair.caller).not.toBe(pair.agent)
  })

  it('U-13: deriveDirectionalPair(SECRET_1, aviva, [caller, agent], 0) pinned values', () => {
    const pair = deriveDirectionalPair(SECRET_1, 'aviva', ['caller', 'agent'], 0)
    expect(pair.caller).toBe('inject')
    expect(pair.agent).toBe('steak')
  })

  // Verify that directional pair tokens are cryptographically isolated from
  // identity-bound tokens — the "pair\0" prefix ensures different HMAC inputs.
  it('directional pair token differs from identity-bound token (domain separation)', () => {
    const pair = deriveDirectionalPair(SECRET_1, 'ns', ['roleA', 'roleB'], 0)
    const identityToken = deriveToken(SECRET_1, 'ns', 0, undefined, 'roleA')
    expect(pair.roleA).not.toBe(identityToken)
  })
})

// ─── deriveDirectionalPair ───────────────────────────────────────────────────
describe('deriveDirectionalPair', () => {
  it('returns an object keyed by role names', () => {
    const pair = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 0)
    expect(typeof pair.caller).toBe('string')
    expect(typeof pair.agent).toBe('string')
  })

  it('two roles get different tokens', () => {
    const pair = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 0)
    expect(pair.caller).not.toBe(pair.agent)
  })

  it('is deterministic', () => {
    const a = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 0)
    const b = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 0)
    expect(a.caller).toBe(b.caller)
    expect(a.agent).toBe(b.agent)
  })

  it('different counter produces different tokens', () => {
    const a = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 0)
    const b = deriveDirectionalPair(SECRET_1, 'dispatch', ['caller', 'agent'], 1)
    expect(a.caller).not.toBe(b.caller)
    expect(a.agent).not.toBe(b.agent)
  })

  it('different namespace produces different tokens', () => {
    const a = deriveDirectionalPair(SECRET_1, 'ns-a', ['caller', 'agent'], 0)
    const b = deriveDirectionalPair(SECRET_1, 'ns-b', ['caller', 'agent'], 0)
    expect(a.caller).not.toBe(b.caller)
  })

  it('directional: caller token != agent token across namespaces', () => {
    // Ensures null-byte separator prevents "a\0b" from conflating with "a" + role "b"
    const pair = deriveDirectionalPair(SECRET_1, 'a', ['b:c', 'b'], 0)
    expect(pair['b:c']).not.toBe(pair['b'])
  })

  it('encodes with specified format', () => {
    const pair = deriveDirectionalPair(SECRET_1, 'ns', ['a', 'b'], 0, { format: 'hex', length: 8 })
    expect(pair.a).toMatch(/^[0-9a-f]{8}$/)
    expect(pair.b).toMatch(/^[0-9a-f]{8}$/)
  })

  it('throws on empty namespace', () => {
    expect(() => deriveDirectionalPair(SECRET_1, '', ['caller', 'agent'], 0)).toThrow('namespace must be a non-empty string')
  })

  it('throws on namespace containing null byte', () => {
    expect(() => deriveDirectionalPair(SECRET_1, 'bad\0ns', ['caller', 'agent'], 0)).toThrow('namespace must not contain null bytes')
  })

  it('throws on identical roles', () => {
    expect(() => deriveDirectionalPair(SECRET_1, 'ns', ['caller', 'caller'], 0)).toThrow('Roles must be distinct')
  })

  it('throws on empty first role', () => {
    expect(() => deriveDirectionalPair(SECRET_1, 'ns', ['', 'agent'], 0)).toThrow('Both roles must be non-empty strings')
  })

  it('throws on empty second role', () => {
    expect(() => deriveDirectionalPair(SECRET_1, 'ns', ['caller', ''], 0)).toThrow('Both roles must be non-empty strings')
  })

  it('throws on whitespace-only namespace', () => {
    expect(() => deriveDirectionalPair(SECRET_1, '  ', ['caller', 'agent'], 0)).toThrow('namespace must be a non-empty string')
  })

  it('throws on whitespace-only role', () => {
    expect(() => deriveDirectionalPair(SECRET_1, 'ns', ['  ', 'agent'], 0)).toThrow('Both roles must be non-empty strings')
  })

  it('throws on role containing null byte', () => {
    expect(() => deriveDirectionalPair(SECRET_1, 'ns', ['caller\0x', 'agent'], 0)).toThrow('Roles must not contain null bytes')
  })
})
