/**
 * Phone call authentication with directional pairs
 *
 * Two roles, two different words — neither party can parrot the other.
 * The caller says one word; the agent says a different word. Both verify
 * the other's word independently.
 *
 * Run: npx tsx examples/phone-auth.ts
 */
import {
  deriveDirectionalPair,
  getCounter,
  randomSeed,
} from 'spoken-token'

// Shared secret established during account setup
const secret = randomSeed()
console.log(`Shared secret: ${secret}`)

// 30-second rotation for real-time phone calls
const counter = getCounter(Date.now() / 1000, 30)
console.log(`Counter (30s rotation): ${counter}`)

// Derive a pair — each role gets a distinct word
const pair = deriveDirectionalPair(secret, 'support-call', ['caller', 'agent'], counter)
console.log(`\nCaller says: "${pair.caller}"`)
console.log(`Agent says:  "${pair.agent}"`)

// --- Verification ---
// Both sides derive the same pair from the shared secret.
// The agent derives the pair and checks if the caller's spoken word matches.
const agentSidePair = deriveDirectionalPair(secret, 'support-call', ['caller', 'agent'], counter)

const callerWordMatches = agentSidePair.caller === pair.caller
console.log(`\nAgent verifies caller's word: ${callerWordMatches ? 'valid' : 'invalid'}`)

const agentWordMatches = agentSidePair.agent === pair.agent
console.log(`Caller verifies agent's word: ${agentWordMatches ? 'valid' : 'invalid'}`)

// Words are distinct — caller can't parrot the agent's word
console.log(`\nWords are different: ${pair.caller !== pair.agent}`)
