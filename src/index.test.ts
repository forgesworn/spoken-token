import { describe, it, expect } from 'vitest'
import {
  estimateVerificationRisk,
  verifyToken,
  MAX_INPUT_CHARS,
} from './index.js'

describe('public barrel exports', () => {
  it('exports verifier hardening APIs from the package entrypoint', () => {
    expect(typeof verifyToken).toBe('function')
    expect(typeof estimateVerificationRisk).toBe('function')
    expect(MAX_INPUT_CHARS).toBe(512)
    expect(estimateVerificationRisk({ identities: 2, tolerance: 1 }).candidates).toBe(9)
  })
})
