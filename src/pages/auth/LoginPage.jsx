import { Eye, LockKeyhole, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import AuthLayout from '../../layouts/AuthLayout'
import { validateMockLogin } from '../../mocks/mockUsers'
import { apiEnabled } from '../../services/api'
import { cpfComplete, formatCpf, login } from '../../services/authApi'

export default function LoginPage() {
  const navigate = useNavigate()
  const { actions } = useAppData()
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [invalidFields, setInvalidFields] = useState([])
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef(null)
  const errorId = useId()
  useEffect(() => { if (error) formRef.current?.querySelector('[aria-invalid="true"]')?.focus() }, [error])

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    if (!apiEnabled()) {
      const result = validateMockLogin(cpf, password)
      if (result.error) { setInvalidFields(result.invalidFields); setError(result.error); return }
      setError('')
      navigate(result.path)
      return
    }
    const missing = [...(cpfComplete(cpf) ? [] : ['cpf']), ...(password.trim() ? [] : ['password'])]
    if (missing.length) { setInvalidFields(missing); setError(missing.includes('cpf') && cpf.trim() ? 'Informe o CPF completo.' : 'Preencha o CPF e a senha.'); return }
    setSubmitting(true)
    try {
      const { path } = await login(cpf, password)
      setError('')
      await actions.reloadSession()
      navigate(path)
    } catch (loginError) {
      setInvalidFields(loginError.status === 401 ? ['cpf', 'password'] : [])
      setError(loginError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout variant="login">
      <div className="auth-heading">
        <h2>Acesse sua conta</h2>
        <p>Entre com seu CPF e senha para acessar o Condo+.</p>
      </div>
      <form ref={formRef} className="login-form" onSubmit={submit} noValidate>
        <label>CPF
          <span className="input-wrap"><UserRound size={18} /><input type="text" inputMode="numeric" autoComplete="username" maxLength={14} aria-required="true" aria-invalid={Boolean(error && invalidFields.includes('cpf')) || undefined} aria-describedby={error && invalidFields.includes('cpf') ? errorId : undefined} value={cpf} onChange={(e) => { setCpf(formatCpf(e.target.value)); setError('') }} placeholder="000.000.000-00" /></span>
        </label>
        <label>Senha
          <span className="input-wrap"><LockKeyhole size={18} /><input autoComplete="current-password" aria-required="true" aria-invalid={Boolean(error && invalidFields.includes('password')) || undefined} aria-describedby={error && invalidFields.includes('password') ? errorId : undefined} value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" /><button className="password-toggle" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><Eye size={18} /></button></span>
        </label>
        <div className="form-row"><label className="check"><input type="checkbox" /> Lembrar de mim</label><button type="button" className="text-link" onClick={() => navigate('/recuperar-senha')}>Esqueci minha senha</button></div>
        {error && <p id={errorId} className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Entrando...' : 'Entrar'}</button>
      </form>
      <div className="divider"><span>ou</span></div>
      <button className="first-access-link" onClick={() => navigate('/primeiro-acesso')}>É seu primeiro acesso? <strong>Ativar minha conta</strong></button>
    </AuthLayout>
  )
}
