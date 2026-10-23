import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { apiEnabled } from '../services/api'
import { SESSION_ACCESS, SESSION_AREA, resolveSessionAccess } from '../features/session/sessionAccess'
import SetupAccessStatus from './SetupAccessStatus'

export default function SessionAccessGate({ area, children, resolver = resolveSessionAccess }) {
  const [attempt, setAttempt] = useState(0)
  const [decision, setDecision] = useState({ status: 'loading', destination: '' })
  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    let current = true
    if (!apiEnabled()) {
      setDecision(area === SESSION_AREA.PLATFORM
        ? { status: SESSION_ACCESS.UNKNOWN, destination: '' }
        : { status: SESSION_ACCESS.ALLOWED, destination: '' })
      return () => { current = false }
    }
    setDecision({ status: 'loading', destination: '' })
    Promise.resolve().then(() => resolver({ area })).then(
      (result) => { if (current) setDecision(result) },
      (error) => { if (current) setDecision({ status: SESSION_ACCESS.ERROR, destination: '', message: error?.message }) },
    )
    return () => { current = false }
  }, [area, attempt, resolver])

  if (decision.status === SESSION_ACCESS.ALLOWED) return children || <Outlet />
  if (decision.status === SESSION_ACCESS.NO_SESSION) return <Navigate to="/" replace />
  if (decision.status === SESSION_ACCESS.REDIRECT) return <Navigate to={decision.destination || '/'} replace />

  const loading = decision.status === 'loading'
  const unknown = decision.status === SESSION_ACCESS.UNKNOWN
  const platformOffline = unknown && area === SESSION_AREA.PLATFORM && !apiEnabled()
  return <SetupAccessStatus
    kind={loading ? 'loading' : decision.status === SESSION_ACCESS.ERROR ? 'error' : 'unknown'}
    title={loading ? 'Verificando sua sessão' : platformOffline ? 'Conexão com a API necessária' : 'Não foi possível confirmar seu acesso'}
    description={loading
      ? 'Aguarde enquanto confirmamos seu perfil e a área permitida para esta conta.'
      : platformOffline
      ? 'A área da plataforma não utiliza dados fictícios e só fica disponível quando o Front-end está conectado ao Backend.'
      : decision.message || 'O servidor não confirmou seu perfil ou o estado da configuração. Nenhuma área protegida foi liberada.'}
    destination="/"
    destinationLabel="Voltar ao login"
    onRetry={!loading && !platformOffline ? retry : undefined}
  />
}
