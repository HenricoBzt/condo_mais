import { apiEnabled, getToken, tokenClaims } from '../../services/api.js'
import { profilePath } from '../../services/authApi.js'

// Resultado interno esperado de um futuro adaptador de sessão. Estes valores não são
// campos, claims ou respostas de API. O adaptador do backend deverá normalizar o
// contrato definitivo para um destes estados antes de chamar esta camada.
export const SETUP_CONFIRMATION = Object.freeze({
  AUTHORIZED_WITHOUT_CONDOMINIUM: 'AUTHORIZED_WITHOUT_CONDOMINIUM',
  CONDOMINIUM_CONFIGURED: 'CONDOMINIUM_CONFIGURED',
})

export const SETUP_ACCESS = Object.freeze({
  ALLOWED: 'allowed',
  CONFIGURED: 'configured',
  DENIED: 'denied',
  NO_SESSION: 'no-session',
  UNKNOWN: 'unknown',
  ERROR: 'error',
})

const adminProfiles = new Set(['ADMIN', 'ADMINISTRADOR', 'ADMINISTRACAO'])

export function normalizeProfile(profile = '') {
  return String(profile).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
}

export function decideSetupAccess({ token, confirmation } = {}) {
  const claims = tokenClaims(token)
  if (!token || !claims) return { status: SETUP_ACCESS.NO_SESSION, destination: '/' }

  const profile = normalizeProfile(claims.perfil)
  if (!adminProfiles.has(profile)) {
    return { status: SETUP_ACCESS.DENIED, destination: profilePath(profile) || '/' }
  }

  // Uma identificação presente confirma que esta conta já está vinculada. A ausência
  // nunca confirma o oposto: ela exige autorização explícita do futuro contrato.
  if (claims.condominio_id || confirmation === SETUP_CONFIRMATION.CONDOMINIUM_CONFIGURED) {
    return { status: SETUP_ACCESS.CONFIGURED, destination: '/admin' }
  }
  if (confirmation === SETUP_CONFIRMATION.AUTHORIZED_WITHOUT_CONDOMINIUM) {
    return { status: SETUP_ACCESS.ALLOWED, destination: '' }
  }
  return { status: SETUP_ACCESS.UNKNOWN, destination: '' }
}

export async function resolveCurrentSetupAccess({
  token = apiEnabled() ? getToken() : '',
  loadConfirmation,
} = {}) {
  const initial = decideSetupAccess({ token })
  if (initial.status !== SETUP_ACCESS.UNKNOWN || !loadConfirmation) return initial

  try {
    const confirmation = await loadConfirmation()
    return decideSetupAccess({ token, confirmation })
  } catch (error) {
    return {
      status: SETUP_ACCESS.ERROR,
      destination: '',
      message: error?.message || 'Não foi possível verificar a autorização para a configuração inicial.',
    }
  }
}
