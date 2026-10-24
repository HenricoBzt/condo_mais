import { AlertTriangle, Building2, LoaderCircle, RotateCcw } from 'lucide-react'

export default function PlatformState({ kind, title, description, onRetry, actionLabel = 'Tentar novamente' }) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'empty' ? Building2 : AlertTriangle
  return <section className={`platform-state platform-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite" aria-busy={kind === 'loading' || undefined}>
    <Icon size={30} aria-hidden="true" />
    <strong>{title}</strong>
    {description && <p>{description}</p>}
    {onRetry && <button type="button" className="secondary-button" onClick={onRetry}><RotateCcw size={17} /> {actionLabel}</button>}
  </section>
}
