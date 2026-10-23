import { LockKeyhole, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import AuthLayout from '../../layouts/AuthLayout'
import { apiEnabled } from '../../services/api'
import { cpfComplete, formatCpf, primeiroAcesso } from '../../services/authApi'

const content = {
  first: { title: 'Primeiro acesso', text: 'Vamos verificar seu cadastro para ativar sua conta.', fields: ['CPF'], action: 'Continuar', next: '/criar-senha' },
  create: { title: 'Ative sua conta', text: 'Crie sua senha de acesso', fields: ['Nova senha', 'Confirmar senha'], action: 'Ativar conta', next: '/morador' },
  recovery1: { title: 'Recuperar senha', text: 'Informe seu CPF para recuperar o acesso à sua conta.', fields: ['CPF'], action: 'Continuar', next: '/recuperar-senha/verificar' },
  recovery2: { title: 'Verifique sua identidade', text: 'Enviaremos as instruções de recuperação para o e-mail cadastrado.', fields: [], action: 'Enviar instruções', next: '/recuperar-senha/nova-senha' },
  recovery3: { title: 'Crie uma nova senha', text: 'Defina uma nova senha para acessar o Condo+.', fields: ['Nova senha', 'Confirmar senha'], action: 'Alterar senha', next: '/' },
}

export default function AuthFlowPage({ step }) {
  return <AuthFlowStep key={step} step={step} />
}

function AuthFlowStep({ step }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { actions } = useAppData()
  const data = content[step]
  const [values, setValues] = useState({})
  const [invalidField, setInvalidField] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef(null)
  const errorId = useId()
  // Com a API, o CPF informado no primeiro passo segue para a criação de senha (Primeiro acesso)
  const activationCpf = location.state?.cpf || ''
  useEffect(() => { if (error) formRef.current?.querySelector('[aria-invalid="true"]')?.focus() }, [error])

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    if (data.fields.some((field) => !values[field]?.trim())) { setInvalidField(data.fields.find((field) => !values[field]?.trim())); setError('Preencha todos os campos obrigatórios.'); return }
    if (values.CPF && apiEnabled() && !cpfComplete(values.CPF)) { setInvalidField('CPF'); setError('Informe o CPF completo.'); return }
    if (values['Nova senha'] && values['Nova senha'].length < 8) { setInvalidField('Nova senha'); setError('A senha deve ter no mínimo 8 caracteres.'); return }
    if (values['Nova senha'] !== values['Confirmar senha']) { setInvalidField('Confirmar senha'); setError('As senhas devem ser iguais.'); return }
    if (apiEnabled() && step === 'first') { navigate(data.next, { state: { cpf: values.CPF } }); return }
    if (apiEnabled() && step === 'create') {
      setSubmitting(true)
      try {
        const { path } = await primeiroAcesso(activationCpf, values['Nova senha'])
        await actions.reloadSession()
        navigate(path)
      } catch (activationError) {
        setInvalidField('')
        setError(activationError.message)
      } finally {
        setSubmitting(false)
      }
      return
    }
    navigate(data.next)
  }

  // Criação de senha aberta direto, sem passar pelo CPF: com a API não há como saber de quem é a conta
  if (apiEnabled() && step === 'create' && !activationCpf) {
    return (
      <AuthLayout>
        <div className="auth-heading"><h2>{data.title}</h2><p>Informe seu CPF antes de criar a senha.</p></div>
        <button className="primary-button" onClick={() => navigate('/primeiro-acesso', { replace: true })}>Informar CPF</button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="auth-heading"><h2>{data.title}</h2><p>{data.text}</p></div>
      {step === 'recovery2' && <div className="masked-email">m a • • • • • • @ g m a i l . c o m</div>}
      <form ref={formRef} className="login-form" onSubmit={submit}>
        {data.fields.map((field) => <label key={field}>{field}<span className="input-wrap">{field === 'CPF' ? <UserRound size={18} /> : <LockKeyhole size={18} />}<input aria-invalid={Boolean(error && invalidField === field) || undefined} aria-describedby={error && invalidField === field ? errorId : undefined} aria-required="true" value={values[field] || ''} onChange={(event) => { const value = field === 'CPF' ? formatCpf(event.target.value) : event.target.value; setValues((current) => ({ ...current, [field]: value })); setError('') }} type={field === 'CPF' ? 'text' : 'password'} {...(field === 'CPF' ? { inputMode: 'numeric', maxLength: 14 } : {})} placeholder={field === 'CPF' ? '000.000.000-00' : `Digite ${field.toLowerCase()}`} /></span>{field === 'Nova senha' && <small className="field-hint">Mínimo de 8 caracteres.</small>}</label>)}
        {step === 'create' && activationCpf && <p className="field-hint">Ativando o acesso do CPF {activationCpf}.</p>}
        {error && <p id={errorId} className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Ativando...' : data.action}</button>
        <button type="button" className="text-link back-auth" onClick={() => navigate(-1)}>← Voltar</button>
      </form>
      {(step === 'first' || step === 'recovery1') && <><div className="divider"><span>ou</span></div><button className="outline-auth" onClick={() => navigate(step === 'first' ? '/' : '/primeiro-acesso')}>{step === 'first' ? 'Voltar ao login' : 'Ativar minha conta'}</button></>}
    </AuthLayout>
  )
}
