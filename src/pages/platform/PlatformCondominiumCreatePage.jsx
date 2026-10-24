import { ArrowLeft, Building2, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlatformData } from '../../context/PlatformDataContext.jsx'
import { buildPlatformRegistrationPayload, formatCnpj, initialPlatformRegistration, platformRegistrationWarnings, validatePlatformRegistration } from '../../features/platform/platformRegistration.js'
import { formatCpf } from '../../services/authApi.js'

const fields = {
  condominiumName: { id: 'platform-condominium-name', label: 'Nome do condomínio' },
  cnpj: { id: 'platform-condominium-cnpj', label: 'CNPJ' },
  administratorName: { id: 'platform-admin-name', label: 'Nome completo' },
  cpf: { id: 'platform-admin-cpf', label: 'CPF' },
  email: { id: 'platform-admin-email', label: 'E-mail', optional: true },
  phone: { id: 'platform-admin-phone', label: 'Telefone', optional: true },
}

function RegistrationField({ name, value, error, warning, onChange, ...inputProps }) {
  const field = fields[name]
  const errorId = `${field.id}-error`
  const warningId = `${field.id}-warning`
  const descriptionId = error ? errorId : warning ? warningId : undefined
  return <div className="platform-form-field">
    <label htmlFor={field.id}>{field.label}{field.optional && <small>Opcional</small>}</label>
    <input
      id={field.id}
      name={name}
      value={value}
      onChange={onChange}
      aria-required={!field.optional || undefined}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={descriptionId}
      {...inputProps}
    />
    {error && <small className="field-error" id={errorId}>{error}</small>}
    {!error && warning && <small className="field-warning" id={warningId}>{warning}</small>}
  </div>
}

export default function PlatformCondominiumCreatePage() {
  const navigate = useNavigate()
  const { condominiums, createCondominium } = usePlatformData()
  const [values, setValues] = useState(initialPlatformRegistration)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef(null)
  const submitLock = useRef(false)
  const mounted = useRef(true)
  const warnings = useMemo(() => platformRegistrationWarnings(values, condominiums), [condominiums, values])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (Object.keys(errors).length) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [errors])

  const change = (name, transform = (value) => value) => (event) => {
    const value = transform(event.target.value)
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
    setGeneralError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (submitLock.current) return
    const validation = validatePlatformRegistration(values, condominiums)
    if (Object.keys(validation).length) {
      setErrors(validation)
      setGeneralError('Revise os campos destacados antes de cadastrar.')
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setErrors({})
    setGeneralError('')
    try {
      const created = await createCondominium(buildPlatformRegistrationPayload(values))
      if (!mounted.current) return
      navigate(`/plataforma/condominios/${created.id}`, {
        replace: true,
        state: { condominiumCreated: true },
      })
    } catch (error) {
      if (!mounted.current) return
      const message = error?.message || 'Não foi possível cadastrar o condomínio.'
      const cnpjConflict = error?.status === 409 && /cnpj/i.test(message)
      const cpfConflict = error?.status === 409 && /cpf/i.test(message)
      if (cnpjConflict) setErrors({ cnpj: message })
      else if (cpfConflict) setErrors({ cpf: message })
      setGeneralError(error?.status === 0
        ? 'Não foi possível confirmar se o cadastro foi concluído. Consulte a listagem antes de tentar novamente.'
        : cnpjConflict || cpfConflict
        ? 'O servidor encontrou um conflito. Revise o campo destacado.'
        : message)
    } finally {
      submitLock.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  return <section className="platform-content-page">
    <Link className="platform-back-link" to="/plataforma/condominios" aria-disabled={submitting || undefined} tabIndex={submitting ? -1 : undefined} onClick={(event) => { if (submitting) event.preventDefault() }}><ArrowLeft size={17} /> Voltar para condomínios</Link>
    <div className="platform-page-heading"><div><span>Gestão da plataforma</span><h1>Cadastrar condomínio</h1><p>Crie o condomínio e a conta do primeiro administrador em uma única operação.</p></div></div>
    <form ref={formRef} className="platform-registration-form" onSubmit={submit} noValidate>
      {generalError && <div className="platform-form-alert" role="alert">{generalError}</div>}
      <fieldset>
        <legend><Building2 size={20} /><span>Dados do condomínio<small>Identificação definida pelo Administrador Master.</small></span></legend>
        <div className="platform-form-grid">
          <RegistrationField name="condominiumName" value={values.condominiumName} error={errors.condominiumName} warning={warnings.condominiumName} onChange={change('condominiumName')} maxLength={255} autoComplete="organization" />
          <RegistrationField name="cnpj" value={values.cnpj} error={errors.cnpj} warning={warnings.cnpj} onChange={change('cnpj', formatCnpj)} inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" />
        </div>
      </fieldset>
      <fieldset>
        <legend><UserRound size={20} /><span>Primeiro administrador<small>Responsável pela configuração inicial do condomínio.</small></span></legend>
        <div className="platform-form-grid">
          <RegistrationField name="administratorName" value={values.administratorName} error={errors.administratorName} warning={warnings.administratorName} onChange={change('administratorName')} maxLength={255} autoComplete="name" />
          <RegistrationField name="cpf" value={values.cpf} error={errors.cpf} warning={warnings.cpf} onChange={change('cpf', formatCpf)} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" autoComplete="username" />
          <RegistrationField name="email" value={values.email} error={errors.email} warning={warnings.email} onChange={change('email')} type="email" maxLength={255} autoComplete="email" />
          <RegistrationField name="phone" value={values.phone} error={errors.phone} warning={warnings.phone} onChange={change('phone')} type="tel" maxLength={20} autoComplete="tel" />
        </div>
        <div className="platform-first-access-note"><ShieldCheck size={20} /><p><strong>Nenhuma senha será criada aqui.</strong> O administrador deverá usar “Primeiro acesso” para definir a própria senha e depois concluir a configuração do condomínio.</p></div>
      </fieldset>
      <div className="platform-form-actions">
        <button className="secondary-button" type="button" disabled={submitting} onClick={() => navigate('/plataforma/condominios')}>Cancelar</button>
        <button className="desktop-primary" type="submit" disabled={submitting}>{submitting ? 'Cadastrando...' : 'Cadastrar condomínio'}</button>
      </div>
    </form>
  </section>
}
