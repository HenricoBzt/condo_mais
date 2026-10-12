import { Check, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'
import { logout } from '../services/authApi'

export default function SetupLayout({ steps, currentStep, maxVisited, onStepChange, children }) {
  return <div className="setup-shell">
    <header className="setup-header">
      <Brand inverse />
      <div className="setup-header__context"><strong>Configuração inicial</strong><span>Ambiente seguro de preparação</span></div>
      <Link to="/" onClick={logout}><LogOut size={18} /> Sair</Link>
    </header>
    <main className="setup-shell__main">
      <div className="setup-welcome"><p>Primeiros passos</p><h1>Vamos configurar seu condomínio</h1><span>Informe a estrutura do residencial e revise tudo antes da futura integração.</span></div>
      <p className="setup-current-step" aria-live="polite">Etapa {currentStep + 1} de {steps.length} — <strong>{steps[currentStep]}</strong></p>
      <ol className="setup-stepper" aria-label="Etapas da configuração">{steps.map((label, index) => <li className={index === currentStep ? 'active' : index < currentStep || index <= maxVisited ? 'complete' : ''} key={label}><button type="button" onClick={() => index <= maxVisited && onStepChange(index)} disabled={index > maxVisited} aria-current={index === currentStep ? 'step' : undefined}><span>{index < currentStep || (index !== currentStep && index <= maxVisited) ? <Check size={16} /> : index + 1}</span><small>{label}</small></button></li>)}</ol>
      {children}
    </main>
  </div>
}
