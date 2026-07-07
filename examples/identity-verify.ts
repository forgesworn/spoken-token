/**
 * Per-member identity verification
 *
 * Each member of a group derives a unique token from the same shared secret.
 * The verifier checks the spoken token against all known identities to
 * determine both validity and who spoke.
 *
 * Run: npx tsx examples/identity-verify.ts
 */
import {
  deriveToken,
  verifyToken,
  getCounter,
  randomSeed,
} from 'spoken-token'

// Shared secret established during group setup
const secret = randomSeed()
console.log('Shared secret generated for demo')

const counter = getCounter(Date.now() / 1000) // rotates every 7 days
console.log(`Counter: ${counter}`)

// --- Each member derives their own token ---
const members = ['alice', 'bob', 'charlie']

for (const member of members) {
  const word = deriveToken(secret, 'team:checkin', counter, undefined, member)
  console.log(`${member}'s word: "${word}"`)
}

// --- Verifier checks a spoken word ---
// Alice says her word; the verifier identifies her
const aliceWord = deriveToken(secret, 'team:checkin', counter, undefined, 'alice')

const result = verifyToken(
  secret, 'team:checkin', counter, aliceWord,
  members, // all known identities
)

console.log(`\nVerification: ${result.status}`)
if (result.identity) {
  console.log(`Speaker identified as: ${result.identity}`)
}

// --- Wrong word is rejected ---
const badResult = verifyToken(secret, 'team:checkin', counter, 'wrongword', members)
console.log(`\nWrong word: ${badResult.status}`)

// --- Tolerance handles clock skew ---
const tolerantResult = verifyToken(
  secret, 'team:checkin', counter, aliceWord,
  members,
  { tolerance: 1 },
)
console.log(`With tolerance: ${tolerantResult.status}, identity: ${tolerantResult.identity}`)
