import { describe, it, expect } from 'vitest'
import { verifyToken, MAX_TOLERANCE } from './verify.js'
import { deriveToken } from './token.js'

const SECRET = '0000000000000000000000000000000000000000000000000000000000000001'
const CTX = 'test:verify'
const COUNTER = 1000

// ─── Exact match ────────────────────────────────────────────────────────────
describe('exact match (no tolerance, no identity)', () => {
  it('returns valid when input matches derived token at exact counter', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    expect(verifyToken(SECRET, CTX, COUNTER, token)).toEqual({ status: 'valid' })
  })

  it('returns no identity field on group-wide match', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    const result = verifyToken(SECRET, CTX, COUNTER, token)
    expect(result.identity).toBeUndefined()
  })
})

// ─── No match ───────────────────────────────────────────────────────────────
describe('no match', () => {
  it('returns invalid when input is wrong', () => {
    expect(verifyToken(SECRET, CTX, COUNTER, 'wrongword')).toEqual({ status: 'invalid' })
  })

  it('returns invalid when counter differs and tolerance is 0', () => {
    const token = deriveToken(SECRET, CTX, COUNTER + 1)
    expect(verifyToken(SECRET, CTX, COUNTER, token)).toEqual({ status: 'invalid' })
  })
})

// ─── Tolerance window ────────────────────────────────────────────────────────
describe('tolerance window', () => {
  it('accepts token from counter+1 with tolerance=1', () => {
    const token = deriveToken(SECRET, CTX, COUNTER + 1)
    const result = verifyToken(SECRET, CTX, COUNTER, token, undefined, { tolerance: 1 })
    expect(result).toEqual({ status: 'valid' })
  })

  it('accepts token from counter-1 with tolerance=1', () => {
    const token = deriveToken(SECRET, CTX, COUNTER - 1)
    const result = verifyToken(SECRET, CTX, COUNTER, token, undefined, { tolerance: 1 })
    expect(result).toEqual({ status: 'valid' })
  })

  it('rejects token from counter+2 with tolerance=1', () => {
    const token = deriveToken(SECRET, CTX, COUNTER + 2)
    const result = verifyToken(SECRET, CTX, COUNTER, token, undefined, { tolerance: 1 })
    expect(result).toEqual({ status: 'invalid' })
  })

  it('accepts token at MAX_TOLERANCE distance', () => {
    const token = deriveToken(SECRET, CTX, COUNTER + MAX_TOLERANCE)
    const result = verifyToken(SECRET, CTX, COUNTER, token, undefined, { tolerance: MAX_TOLERANCE })
    expect(result).toEqual({ status: 'valid' })
  })
})

// ─── Per-identity match ──────────────────────────────────────────────────────
describe('per-identity match', () => {
  it('returns valid with correct identity when identity token matches', () => {
    const token = deriveToken(SECRET, CTX, COUNTER, undefined, 'alice')
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob'])
    expect(result).toEqual({ status: 'valid', identity: 'alice' })
  })

  it('identifies the correct member among multiple identities', () => {
    const token = deriveToken(SECRET, CTX, COUNTER, undefined, 'bob')
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob', 'carol'])
    expect(result).toEqual({ status: 'valid', identity: 'bob' })
  })

  it('identity token does not match without identities list (falls through to group-wide)', () => {
    const identityToken = deriveToken(SECRET, CTX, COUNTER, undefined, 'alice')
    // Without identities list, only group-wide token is checked — identity token won't match
    const result = verifyToken(SECRET, CTX, COUNTER, identityToken)
    expect(result).toEqual({ status: 'invalid' })
  })
})

// ─── Group-wide match ────────────────────────────────────────────────────────
describe('group-wide match', () => {
  it('matches group-wide token even when identities list is provided', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob'])
    expect(result).toEqual({ status: 'valid' })
  })

  it('group-wide match has no identity field', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob'])
    expect(result.identity).toBeUndefined()
  })
})

// ─── Case-insensitive matching ───────────────────────────────────────────────
describe('case-insensitive matching', () => {
  it('accepts uppercase input', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    const result = verifyToken(SECRET, CTX, COUNTER, token.toUpperCase())
    expect(result).toEqual({ status: 'valid' })
  })

  it('accepts mixed-case input', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    const mixed = token.charAt(0).toUpperCase() + token.slice(1)
    const result = verifyToken(SECRET, CTX, COUNTER, mixed)
    expect(result).toEqual({ status: 'valid' })
  })
})

// ─── Whitespace normalisation ────────────────────────────────────────────────
describe('whitespace normalisation', () => {
  it('accepts input with leading/trailing spaces', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    const result = verifyToken(SECRET, CTX, COUNTER, `  ${token}  `)
    expect(result).toEqual({ status: 'valid' })
  })

  it('accepts multi-word token with extra internal spaces', () => {
    const encoding = { format: 'words', count: 3 } as const
    const token = deriveToken(SECRET, CTX, COUNTER, encoding)
    // Replace single spaces with double spaces between words
    const padded = token.replace(/ /g, '  ')
    const result = verifyToken(SECRET, CTX, COUNTER, padded, undefined, { encoding })
    expect(result).toEqual({ status: 'valid' })
  })
})

// ─── Tolerance bound validation ──────────────────────────────────────────────
describe('tolerance bound validation', () => {
  it('throws RangeError for negative tolerance', () => {
    expect(() => verifyToken(SECRET, CTX, COUNTER, 'word', undefined, { tolerance: -1 })).toThrow(RangeError)
  })

  it('throws RangeError when tolerance exceeds MAX_TOLERANCE', () => {
    expect(() =>
      verifyToken(SECRET, CTX, COUNTER, 'word', undefined, { tolerance: MAX_TOLERANCE + 1 }),
    ).toThrow(RangeError)
  })

  it('throws RangeError for fractional tolerance', () => {
    expect(() => verifyToken(SECRET, CTX, COUNTER, 'word', undefined, { tolerance: 1.5 })).toThrow(RangeError)
  })

  it('accepts tolerance=0 (default)', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    expect(() => verifyToken(SECRET, CTX, COUNTER, token, undefined, { tolerance: 0 })).not.toThrow()
  })

  it('accepts tolerance=MAX_TOLERANCE', () => {
    const token = deriveToken(SECRET, CTX, COUNTER)
    expect(() =>
      verifyToken(SECRET, CTX, COUNTER, token, undefined, { tolerance: MAX_TOLERANCE }),
    ).not.toThrow()
  })
})

// ─── Identity limit ──────────────────────────────────────────────────────────
describe('identity limit', () => {
  it('throws RangeError when identities array exceeds 100 entries', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `user-${i}`)
    expect(() => verifyToken(SECRET, CTX, COUNTER, 'word', tooMany)).toThrow(RangeError)
  })

  it('accepts exactly 100 identities', () => {
    const exactly100 = Array.from({ length: 100 }, (_, i) => `user-${i}`)
    expect(() => verifyToken(SECRET, CTX, COUNTER, 'word', exactly100)).not.toThrow()
  })

  it('throws on identity containing null bytes', () => {
    expect(() => verifyToken(SECRET, CTX, COUNTER, 'word', ['alice', 'a\0b'])).toThrow('identities must not contain null bytes')
  })
})

// ─── Multiple identities ─────────────────────────────────────────────────────
describe('multiple identities', () => {
  it('identifies carol among alice, bob, carol', () => {
    const token = deriveToken(SECRET, CTX, COUNTER, undefined, 'carol')
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob', 'carol'])
    expect(result).toEqual({ status: 'valid', identity: 'carol' })
  })

  it('returns invalid when no identity token matches', () => {
    const token = deriveToken(SECRET, CTX, COUNTER, undefined, 'dave')
    // dave is not in the list, and the group-wide token won't match either
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob', 'carol'])
    expect(result).toEqual({ status: 'invalid' })
  })

  it('identity match in tolerance window returns correct identity', () => {
    const token = deriveToken(SECRET, CTX, COUNTER + 1, undefined, 'bob')
    const result = verifyToken(SECRET, CTX, COUNTER, token, ['alice', 'bob'], { tolerance: 1 })
    expect(result).toEqual({ status: 'valid', identity: 'bob' })
  })
})

// ─── Encoding option ─────────────────────────────────────────────────────────
describe('encoding option', () => {
  it('verifies PIN tokens', () => {
    const encoding = { format: 'pin', digits: 6 } as const
    const token = deriveToken(SECRET, CTX, COUNTER, encoding)
    const result = verifyToken(SECRET, CTX, COUNTER, token, undefined, { encoding })
    expect(result).toEqual({ status: 'valid' })
  })

  it('verifies hex tokens', () => {
    const encoding = { format: 'hex', length: 8 } as const
    const token = deriveToken(SECRET, CTX, COUNTER, encoding)
    const result = verifyToken(SECRET, CTX, COUNTER, token, undefined, { encoding })
    expect(result).toEqual({ status: 'valid' })
  })
})
