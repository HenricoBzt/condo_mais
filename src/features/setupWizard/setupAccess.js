import { getToken } from '../../services/api.js'
import { SESSION_ACCESS, SESSION_AREA, decideSessionAccess, normalizeProfile, resolveSessionAccess } from '../session/sessionAccess.js'

export const SETUP_ACCESS = Object.freeze({
  ALLOWED: 'allowed',
  CONFIGURED: 'configured',
  DENIED: 'denied',
  NO_SESSION: 'no-session',
  UNKNOWN: 'unknown',
  ERROR: 'error',
})

export { normalizeProfile }

function toSetupDecision(decision) {
  if (decision.status === SESSION_ACCESS.ALLOWED) return { status: SETUP_ACCESS.ALLOWED, destination: '' }
  if (decision.status === SESSION_ACCESS.NO_SESSION) return { status: SETUP_ACCESS.NO_SESSION, destination: '/' }
  if (decision.status === SESSION_ACCESS.UNKNOWN) return { status: SETUP_ACCESS.UNKNOWN, destination: '' }
  if (decision.status === SESSION_ACCESS.ERROR) return { status: SETUP_ACCESS.ERROR, destination: '', message: decision.message }
  if (decision.status === SESSION_ACCESS.REDIRECT && decision.destination === '/admin') return { status: SETUP_ACCESS.CONFIGURED, destination: '/admin' }
  return { status: SETUP_ACCESS.DENIED, destination: decision.destination || '/' }
}

export function decideSetupAccess({ token, user } = {}) {
  return toSetupDecision(decideSessionAccess({ token, user, area: SESSION_AREA.ADMIN_SETUP }))
}

export async function resolveCurrentSetupAccess({
  token = getToken(),
  loadCurrentUser,
} = {}) {
  return toSetupDecision(await resolveSessionAccess({ area: SESSION_AREA.ADMIN_SETUP, token, loadCurrentUser }))
}
