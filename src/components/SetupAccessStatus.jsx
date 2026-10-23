import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function SetupAccessStatus({ kind, message, title: customTitle, description: customDescription, destination = '/', destinationLabel, onRetry }) {
  const navigate = useNavigate()
  const loading = kind === 'loading'
  const denied = kind === 'denied'
  const title = customTitle || (loading ? 'Verificando autorização' : denied ? 'Acesso restrito' : 'Não foi possível confirmar o acesso')
  const description = customDescription || message || (loading
    ? 'Aguarde enquanto verificamos se esta conta pode realizar a configuração inicial.'
    : denied
      ? 'O Setup Wizard está disponível somente para administradores autorizados sem condomínio configurado.'
      : 'O servidor ainda não confirmou que esta conta pode configurar um novo condomínio. Nenhuma configuração foi liberada.')

  return <main className="setup-access-page">
    <section className="setup-access-card" aria-live="polite" aria-busy={loading || undefined}>
      <span className={`setup-access-icon setup-access-icon--${kind}`} aria-hidden="true">{loading ? <LoaderCircle size={27} /> : <AlertTriangle size={27} />}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {!loading && <div className="setup-access-actions">{onRetry && <button type="button" className="desktop-primary" onClick={onRetry}><RotateCcw size={17} /> Tentar novamente</button>}<button type="button" className="secondary-button" onClick={() => navigate(destination, { replace: true })}>{destinationLabel || (destination === '/admin' ? 'Ir para o Dashboard' : 'Voltar para minha área')}</button></div>}
    </section>
  </main>
}
