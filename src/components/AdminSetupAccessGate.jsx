import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { SETUP_ACCESS, resolveCurrentSetupAccess } from '../features/setupWizard/setupAccess'
import SetupAccessStatus from './SetupAccessStatus'

export default function AdminSetupAccessGate({ children, resolver = resolveCurrentSetupAccess }) {
  const [attempt, setAttempt] = useState(0)
  const [decision, setDecision] = useState({ status: 'loading', destination: '' })
  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    let current = true
    setDecision({ status: 'loading', destination: '' })
    Promise.resolve().then(() => resolver()).then(
      (result) => { if (current) setDecision(result) },
      (error) => { if (current) setDecision({ status: SETUP_ACCESS.ERROR, destination: '', message: error?.message }) },
    )
    return () => { current = false }
  }, [attempt, resolver])

  if (decision.status === 'loading') return <SetupAccessStatus kind="loading" />
  if (decision.status === SETUP_ACCESS.NO_SESSION) return <Navigate to="/" replace />
  if (decision.status === SETUP_ACCESS.CONFIGURED) return <Navigate to="/admin" replace />
  if (decision.status === SETUP_ACCESS.DENIED) return <SetupAccessStatus kind="denied" destination={decision.destination} />
  if (decision.status === SETUP_ACCESS.UNKNOWN) return <SetupAccessStatus kind="unknown" destination="/admin" onRetry={retry} />
  if (decision.status === SETUP_ACCESS.ERROR) return <SetupAccessStatus kind="error" message={decision.message} destination="/admin" onRetry={retry} />
  if (decision.status === SETUP_ACCESS.ALLOWED) return children
  return <SetupAccessStatus kind="error" destination="/admin" onRetry={retry} />
}
