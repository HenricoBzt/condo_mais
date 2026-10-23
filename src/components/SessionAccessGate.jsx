import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { apiEnabled } from '../services/api'
import { SESSION_ACCESS, SESSION_AREA, resolveSessionAccess } from '../features/session/sessionAccess'
import SetupAccessStatus from './SetupAccessStatus'
import { subscribeToSessionChanges } from '../services/sessionEvents'

export default function SessionAccessGate({ area, children, resolver = resolveSessionAccess, apiActive = apiEnabled() }) {
  const [revision, setRevision] = useState(0)
  const [decision, setDecision] = useState({ status: 'loading', destination: '' })
  const requestVersion = useRef(0)
  const invalidate = useCallback(() => {
    requestVersion.current += 1
    setDecision({ status: 'loading', destination: '' })
    setRevision((current) => current + 1)
  }, [])
  const retry = invalidate

  useEffect(() => subscribeToSessionChanges(invalidate), [invalidate])

  useEffect(() => {
    let current = true
    const version = requestVersion.current
    if (!apiActive) {
      setDecision(area === SESSION_AREA.PLATFORM
        ? { status: SESSION_ACCESS.UNKNOWN, destination: '' }
        : { status: SESSION_ACCESS.ALLOWED, destination: '' })
      return () => { current = false }
    }
    setDecision({ status: 'loading', destination: '' })
    Promise.resolve().then(() => resolver({ area })).then(
      (result) => { if (current && version === requestVersion.current) setDecision(result) },
      (error) => { if (current && version === requestVersion.current) setDecision({ status: SESSION_ACCESS.ERROR, destination: '', message: error?.message }) },
    )
    return () => { current = false }
  }, [apiActive, area, revision, resolver])

  if (decision.status === SESSION_ACCESS.ALLOWED) return children || <Outlet />
  if (decision.status === SESSION_ACCESS.NO_SESSION) return <Navigate to="/" replace />
  if (decision.status === SESSION_ACCESS.REDIRECT) return <Navigate to={decision.destination || '/'} replace />

  const loading = decision.status === 'loading'
  const unknown = decision.status === SESSION_ACCESS.UNKNOWN
  const platformOffline = unknown && area === SESSION_AREA.PLATFORM && !apiActive
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
