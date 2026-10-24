import { ArrowLeft, Building2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PlatformState from '../../components/PlatformState.jsx'
import { usePlatformData } from '../../context/PlatformDataContext.jsx'
import {
  buildCondominiumEditPayload,
  condominiumEditValues,
  condominiumEditWarnings,
  validateCondominiumEdit,
} from '../../features/platform/platformCondominiumManagement.js'
import { formatCnpj } from '../../features/platform/platformRegistration.js'

const initialValues = { condominiumName: '', cnpj: '' }

function EditField({ id, label, value, error, warning, onChange, ...inputProps }) {
  const errorId = `${id}-error`
  const warningId = `${id}-warning`
  const describedBy = error ? errorId : warning ? warningId : undefined
  return <div className="platform-form-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} value={value} onChange={onChange} aria-required="true" aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy} {...inputProps} />
    {error && <small className="field-error" id={errorId}>{error}</small>}
    {!error && warning && <small className="field-warning" id={warningId}>{warning}</small>}
  </div>
}

export default function PlatformCondominiumEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { condominiums, detailState, loadDetail, sessionRevision, updateCondominium } = usePlatformData()
  const detail = detailState(id)
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef(null)
  const initializedId = useRef('')
  const submitLock = useRef(false)
  const mounted = useRef(true)
  const warnings = useMemo(() => condominiumEditWarnings(values, condominiums, id), [condominiums, id, values])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => { loadDetail(id) }, [id, loadDetail, sessionRevision])
  useEffect(() => {
    initializedId.current = ''
    setValues(initialValues)
    setErrors({})
    setGeneralError('')
  }, [sessionRevision])
  useEffect(() => {
    if (detail.status !== 'success' || initializedId.current === id) return
    setValues(condominiumEditValues(detail.item))
    initializedId.current = id
  }, [detail.item, detail.status, id])
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
    const validation = validateCondominiumEdit(values)
    if (Object.keys(validation).length) {
      setErrors(validation)
      setGeneralError('Revise os campos destacados antes de salvar.')
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setErrors({})
    setGeneralError('')
    try {
      const updated = await updateCondominium(id, buildCondominiumEditPayload(values))
      if (!mounted.current) return
      navigate(`/plataforma/condominios/${updated.id}`, { replace: true, state: { condominiumUpdated: true } })
    } catch (error) {
      if (!mounted.current) return
      const message = error?.message || 'Não foi possível atualizar o condomínio.'
      const cnpjConflict = error?.status === 409 && /cnpj/i.test(message)
      if (cnpjConflict) setErrors({ cnpj: message })
      setGeneralError(error?.status === 0
        ? 'Não foi possível confirmar se a alteração foi concluída. Consulte novamente os detalhes antes de tentar outra vez.'
        : cnpjConflict
        ? 'O servidor confirmou um conflito de CNPJ. Revise o campo destacado.'
        : message)
    } finally {
      submitLock.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  if (detail.status === 'loading' || detail.status === 'idle' || (detail.status === 'success' && initializedId.current !== id)) {
    return <section className="platform-content-page"><PlatformState kind="loading" title="Carregando dados do condomínio" /></section>
  }
  if (detail.status === 'error') {
    return <section className="platform-content-page"><PlatformState kind="error" title="Não foi possível carregar o condomínio" description={detail.error} onRetry={() => loadDetail(id, { force: true })} /></section>
  }

  return <section className="platform-content-page">
    <Link className="platform-back-link" to={`/plataforma/condominios/${id}`} aria-disabled={submitting || undefined} tabIndex={submitting ? -1 : undefined} onClick={(event) => { if (submitting) event.preventDefault() }}><ArrowLeft size={17} /> Voltar para detalhes</Link>
    <div className="platform-page-heading"><div><span>Gestão da plataforma</span><h1>Editar condomínio</h1><p>Altere somente a identificação cadastral definida pelo Administrador Master.</p></div></div>
    <form ref={formRef} className="platform-registration-form" onSubmit={submit} noValidate>
      {generalError && <div className="platform-form-alert" role="alert">{generalError}</div>}
      <fieldset>
        <legend><Building2 size={20} /><span>Dados do condomínio<small>Modelo, configuração, status e administradores não serão alterados.</small></span></legend>
        <div className="platform-form-grid">
          <EditField id="platform-edit-condominium-name" label="Nome do condomínio" value={values.condominiumName} error={errors.condominiumName} warning={warnings.condominiumName} onChange={change('condominiumName')} maxLength={255} autoComplete="organization" />
          <EditField id="platform-edit-condominium-cnpj" label="CNPJ" value={values.cnpj} error={errors.cnpj} warning={warnings.cnpj} onChange={change('cnpj', formatCnpj)} inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" />
        </div>
      </fieldset>
      <div className="platform-form-actions">
        <button className="secondary-button" type="button" disabled={submitting} onClick={() => navigate(`/plataforma/condominios/${id}`)}>Cancelar</button>
        <button className="desktop-primary" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar alterações'}</button>
      </div>
    </form>
  </section>
}
