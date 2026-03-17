import { describe, it, expect } from 'vitest'
import { WORDLIST, WORDLIST_SIZE, getWord, indexOf } from './wordlist.js'
import { sha256, bytesToHex } from './crypto.js'

describe('wordlist', () => {
  it('has exactly 2048 entries', () => {
    expect(WORDLIST).toHaveLength(2048)
    expect(WORDLIST_SIZE).toBe(2048)
  })

  it('contains only lowercase alphabetic words', () => {
    for (const word of WORDLIST) {
      expect(word).toMatch(/^[a-z]+$/)
    }
  })

  it('contains no duplicates', () => {
    const unique = new Set(WORDLIST)
    expect(unique.size).toBe(WORDLIST.length)
  })

  it('all words are 3-8 characters', () => {
    for (const word of WORDLIST) {
      expect(word.length).toBeGreaterThanOrEqual(3)
      expect(word.length).toBeLessThanOrEqual(8)
    }
  })

  it('getWord returns correct word by index', () => {
    expect(getWord(0)).toBe(WORDLIST[0])
    expect(getWord(2047)).toBe(WORDLIST[2047])
  })

  it('getWord throws for out-of-range index', () => {
    expect(() => getWord(-1)).toThrow()
    expect(() => getWord(2048)).toThrow()
  })

  it('getWord throws for NaN index', () => {
    expect(() => getWord(NaN)).toThrow(RangeError)
  })

  it('getWord throws for fractional index', () => {
    expect(() => getWord(0.5)).toThrow(RangeError)
  })

  it('indexOf returns correct index', () => {
    expect(indexOf(WORDLIST[0])).toBe(0)
    expect(indexOf(WORDLIST[100])).toBe(100)
  })

  it('indexOf returns -1 for unknown word', () => {
    expect(indexOf('xyznotaword')).toBe(-1)
  })

  it('en-v1 SHA-256 integrity hash matches protocol spec', () => {
    const hash = bytesToHex(sha256(new TextEncoder().encode(WORDLIST.join('\n'))))
    expect(hash).toBe('0334930ebdfbc76e81ec914515d7567ca85738a6bf3069249d97df951d44661c')
  })
})
