/**
 * Rideshare pickup verification
 *
 * Both rider and driver derive the same word from a shared secret.
 * The rider reads it aloud; the driver confirms the match.
 *
 * Run: npx tsx examples/rideshare.ts
 */
import { deriveToken, verifyToken, getCounter, randomSeed } from 'spoken-token'

// In production, both parties receive this secret during booking
const secret = randomSeed()
console.log(`Shared secret: ${secret}`)

// Both sides compute the same counter from wall-clock time
const counter = getCounter(Date.now() / 1000) // rotates every 7 days by default
console.log(`Counter: ${counter}`)

// --- Rider's device ---
const riderWord = deriveToken(secret, 'rideshare:pickup', counter)
console.log(`\nRider's word: "${riderWord}"`)

// --- Driver's device ---
// Driver hears the rider say a word and verifies it
const result = verifyToken(secret, 'rideshare:pickup', counter, riderWord)
console.log(`Driver verification: ${result.status}`) // → valid

// Tolerance handles clock skew — accept words from adjacent time windows
const tolerantResult = verifyToken(
  secret, 'rideshare:pickup', counter, riderWord,
  undefined, { tolerance: 1 },
)
console.log(`With tolerance: ${tolerantResult.status}`)

// Different encoding formats
const pin = deriveToken(secret, 'rideshare:pickup', counter, { format: 'pin', digits: 4 })
const phrase = deriveToken(secret, 'rideshare:pickup', counter, { format: 'words', count: 2 })
console.log(`\nAs PIN: ${pin}`)
console.log(`As phrase: "${phrase}"`)
