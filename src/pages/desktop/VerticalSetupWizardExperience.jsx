import { cloneElement, useEffect, useReducer, useRef, useState } from 'react'
import { Building2, Check, ChevronLeft, ChevronRight, CircleAlert, Plus, Trash2 } from 'lucide-react'
import SetupLayout from '../../layouts/SetupLayout'
import {
  PREDEFINED_COMMON_AREAS,
  SETUP_STEPS,
  createInitialWizardState,
  getTowerUnitCount,
  getTowerUnitPreview,
  getTotalUnitCount,
  summarizeTowerUnits,
  validateStepDetails,
  wizardReducer,
} from '../../features/setupWizard/verticalSetup'

const stateOptions = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

function findError(errors, field) {
  return errors.find((error) => error.field === field)?.message
}

function Field({ label, id, fieldKey, error, children, hint }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  const control = cloneElement(children, {
    id,
    'data-field-key': fieldKey,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy || undefined,
  })
  return <div className={`setup-field${error ? ' setup-field--invalid' : ''}`}>
    <label htmlFor={id}>{label}</label>{control}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
  </div>
}

function CondominiumStep({ condominium, dispatch, errors }) {
  const update = (field) => (event) => dispatch({ type: 'UPDATE_CONDOMINIUM', field, value: event.target.value })
  return <div className="setup-form-grid">
    <Field label="Nome do condomínio" id="setup-condominium-name" fieldKey="condominium.name" error={findError(errors, 'condominium.name')}><input value={condominium.name} onChange={update('name')} placeholder="Ex.: Condomínio Parque das Flores" /></Field>
    <Field label="Endereço" id="setup-condominium-address" fieldKey="condominium.address" error={findError(errors, 'condominium.address')}><input value={condominium.address} onChange={update('address')} placeholder="Rua, número e complemento" /></Field>
    <Field label="Cidade" id="setup-condominium-city" fieldKey="condominium.city" error={findError(errors, 'condominium.city')}><input value={condominium.city} onChange={update('city')} /></Field>
    <Field label="Estado" id="setup-condominium-state" fieldKey="condominium.state" error={findError(errors, 'condominium.state')}><select value={condominium.state} onChange={update('state')}><option value="">Selecione</option>{stateOptions.map((state) => <option value={state} key={state}>{state}</option>)}</select></Field>
  </div>
}

function ModelStep() {
  return <div className="setup-models">
    <article className="setup-model setup-model--selected"><span className="setup-model__check"><Check size={17} /></span><Building2 size={30} /><h3>Condomínio Vertical</h3><p>Organização por torres, andares e apartamentos.</p><strong>Selecionado</strong></article>
    <article className="setup-model setup-model--disabled" aria-disabled="true"><h3>Condomínio Horizontal</h3><p>Ruas e casas serão disponibilizadas em uma evolução futura.</p><strong>Em breve</strong></article>
    <article className="setup-model setup-model--disabled" aria-disabled="true"><h3>Edifício Pequeno</h3><p>Configuração simplificada será disponibilizada futuramente.</p><strong>Em breve</strong></article>
  </div>
}

function TowerCard({ tower, index, canRemove, dispatch, errors }) {
  const update = (field) => (event) => dispatch({ type: 'UPDATE_TOWER', id: tower.id, field, value: event.target.value })
  const key = (field) => `tower.${tower.id}.${field}`
  const id = (field) => `setup-${tower.id}-${field}`
  const preview = getTowerUnitPreview(tower)
  return <article className="setup-tower-card">
    <header><div><span>Torre {index + 1}</span><h3>{tower.name.trim() || 'Nova torre'}</h3></div>{canRemove && <button className="setup-icon-button" type="button" aria-label={`Remover ${tower.name || `Torre ${index + 1}`}`} onClick={() => dispatch({ type: 'REMOVE_TOWER', id: tower.id })}><Trash2 size={18} /></button>}</header>
    <div className="setup-form-grid setup-form-grid--tower">
      <Field label="Nome da torre" id={id('name')} fieldKey={key('name')} error={findError(errors, key('name'))}><input value={tower.name} onChange={update('name')} placeholder="Ex.: Torre A" /></Field>
      <Field label="Quantidade de andares" id={id('floorCount')} fieldKey={key('floorCount')} error={findError(errors, key('floorCount'))}><input type="number" min="1" max="100" value={tower.floorCount} onChange={update('floorCount')} /></Field>
      <Field label="Apartamentos por andar" id={id('unitsPerFloor')} fieldKey={key('unitsPerFloor')} error={findError(errors, key('unitsPerFloor'))}><input type="number" min="1" max="100" value={tower.unitsPerFloor} onChange={update('unitsPerFloor')} /></Field>
      <Field label="Primeiro andar" id={id('firstFloor')} fieldKey={key('firstFloor')} error={findError(errors, key('firstFloor'))}><input type="number" min="1" max="999" value={tower.firstFloor} onChange={update('firstFloor')} /></Field>
      <Field label="Primeiro apartamento do andar" id={id('firstUnit')} fieldKey={key('firstUnit')} error={findError(errors, key('firstUnit'))} hint="Use 1 para iniciar em 01, 02, 03…"><input type="number" min="1" max="999" value={tower.firstUnit} onChange={update('firstUnit')} /></Field>
      <Field label="Quantidade de dígitos do apartamento" id={id('unitDigits')} fieldKey={key('unitDigits')} error={findError(errors, key('unitDigits'))} hint="2 dígitos geram 01; 3 dígitos geram 001."><select value={tower.unitDigits} onChange={update('unitDigits')}><option value="1">1 dígito</option><option value="2">2 dígitos</option><option value="3">3 dígitos</option><option value="4">4 dígitos</option></select></Field>
      <Field label="Separador entre andar e apartamento" id={id('separator')} fieldKey={key('separator')} hint="Opcional. Com hífen, por exemplo, o resultado será 1-01."><input value={tower.separator} maxLength="3" onChange={update('separator')} placeholder="Sem separador" /></Field>
    </div>
    <p className="setup-pattern">Exemplo da numeração: <strong>{preview.first || '—'}</strong> até <strong>{preview.last || '—'}</strong> · {preview.total} unidades</p>
  </article>
}

function TowersStep({ towers, dispatch, errors }) {
  return <div className="setup-stack">{towers.map((tower, index) => <TowerCard key={tower.id} tower={tower} index={index} canRemove={towers.length > 1} dispatch={dispatch} errors={errors} />)}<button type="button" className="setup-add-button" onClick={() => dispatch({ type: 'ADD_TOWER' })}><Plus size={18} /> Adicionar outra torre</button></div>
}

function UnitsStep({ towers }) {
  const total = getTotalUnitCount(towers)
  return <div className="setup-stack"><div className="setup-total"><span>Total previsto</span><strong>{total}</strong><small>unidades em {towers.length} {towers.length === 1 ? 'torre' : 'torres'}</small></div>
    <p className="setup-preview-guidance">Confira exemplos reais da numeração. Em configurações grandes, mostramos uma amostra sem alterar o total gerado.</p>
    {towers.map((tower) => {
      const summary = summarizeTowerUnits(tower)
      return <article className="setup-preview-card" key={tower.id}><header><div><h3>{tower.name}</h3><p>{tower.floorCount} andares · {tower.unitsPerFloor} apartamentos por andar</p></div><strong>{summary.total} unidades</strong></header>
        <div className="setup-floor-list">{summary.floors.map((floor) => <div className="setup-floor-row" key={floor.floor}><strong>Andar {floor.floor}</strong><div>{floor.numbers.map((number) => <span key={number}>{number}</span>)}{floor.omittedUnits > 0 && <em>+{floor.omittedUnits} unidades</em>}</div></div>)}</div>
        {summary.omittedFloors > 0 && <p className="setup-preview-note">{summary.omittedFloors} {summary.omittedFloors === 1 ? 'andar intermediário foi omitido' : 'andares intermediários foram omitidos'} desta prévia.</p>}
        <p className="setup-preview-range">Primeira unidade: <strong>{summary.first || '—'}</strong> · Última unidade: <strong>{summary.last || '—'}</strong></p>
      </article>
    })}
  </div>
}

function AreasStep({ draft, dispatch }) {
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')
  const inputRef = useRef(null)
  function addCustom() {
    const trimmed = name.trim()
    if (!trimmed) { setLocalError('Informe o nome da área personalizada.'); inputRef.current?.focus(); return }
    const used = [...draft.commonAreas, ...draft.customAreas.map((area) => area.name)].some((item) => item.localeCompare(trimmed, 'pt-BR', { sensitivity: 'base' }) === 0)
    if (used) { setLocalError('Já existe uma área comum com esse nome.'); inputRef.current?.focus(); return }
    dispatch({ type: 'ADD_CUSTOM_AREA', area: { id: `custom-${Date.now()}`, name: trimmed, reservable: true } })
    setName(''); setLocalError('')
  }
  return <div className="setup-stack"><div className="setup-area-grid">{PREDEFINED_COMMON_AREAS.map((area) => { const checked = draft.commonAreas.includes(area); return <label className={`setup-area-option${checked ? ' setup-area-option--selected' : ''}`} key={area}><input type="checkbox" checked={checked} onChange={() => dispatch({ type: 'TOGGLE_AREA', name: area })} /><span>{area}</span>{checked && <Check size={18} />}</label> })}</div>
    <section className="setup-custom-area"><h3>Área personalizada</h3><p>Adicione uma área que não aparece nas opções acima.</p><label htmlFor="setup-custom-area-name">Nome da área</label><div><input ref={inputRef} id="setup-custom-area-name" value={name} aria-invalid={localError ? 'true' : undefined} aria-describedby={localError ? 'setup-custom-area-error' : undefined} onChange={(event) => { setName(event.target.value); setLocalError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom() } }} placeholder="Ex.: Espaço coworking" /><button type="button" className="secondary-button" onClick={addCustom}><Plus size={17} /> Adicionar</button></div>{localError && <p className="field-error" id="setup-custom-area-error" role="alert">{localError}</p>}
      {draft.customAreas.length > 0 && <ul>{draft.customAreas.map((area) => <li key={area.id}><span>{area.name}</span><button type="button" aria-label={`Remover ${area.name}`} onClick={() => dispatch({ type: 'REMOVE_CUSTOM_AREA', id: area.id })}><Trash2 size={16} /></button></li>)}</ul>}
    </section></div>
}

function SectionHeading({ children, onEdit, label }) {
  return <div className="setup-summary-heading"><h3>{children}</h3><button type="button" className="setup-edit-button" onClick={onEdit} aria-label={`Editar ${label}`}>Editar</button></div>
}

function SummaryStep({ draft, totalUnits, reviewed, dispatch, onEdit }) {
  const areas = [...draft.commonAreas, ...draft.customAreas.map((area) => area.name)]
  return <div className="setup-summary"><div className="setup-review-notice"><CircleAlert size={20} /><p><strong>Esta é apenas uma revisão local.</strong> Nenhum dado será enviado ou salvo no banco enquanto a integração com o backend não estiver disponível.</p></div>
    <section><SectionHeading onEdit={() => onEdit(0)} label="dados do condomínio">Condomínio</SectionHeading><dl><div><dt>Nome</dt><dd>{draft.condominium.name}</dd></div><div><dt>Endereço</dt><dd>{draft.condominium.address}</dd></div><div><dt>Cidade/UF</dt><dd>{draft.condominium.city} — {draft.condominium.state}</dd></div><div><dt>Modelo</dt><dd>Condomínio Vertical</dd></div></dl></section>
    <section><SectionHeading onEdit={() => onEdit(2)} label="torres e unidades">Estrutura residencial</SectionHeading><div className="setup-summary-towers">{draft.towers.map((tower) => <div key={tower.id}><strong>{tower.name}</strong><span>{tower.floorCount} andares</span><span>{tower.unitsPerFloor} unidades por andar</span><span>{getTowerUnitCount(tower)} unidades geradas</span></div>)}</div><p className="setup-summary-total"><strong>{totalUnits}</strong> unidades no total</p></section>
    <section><SectionHeading onEdit={() => onEdit(4)} label="áreas comuns">Áreas comuns</SectionHeading>{areas.length ? <div className="setup-summary-tags">{areas.map((area) => <span key={area}>{area}</span>)}</div> : <p className="muted">Nenhuma área comum selecionada.</p>}</section>
    <button type="button" className="desktop-primary setup-review-button" onClick={() => dispatch({ type: 'SET_REVIEWED' })}>{reviewed ? <><Check size={18} /> Revisão concluída</> : 'Concluir revisão local'}</button>
    {reviewed && <p className="setup-success" role="status"><Check size={19} /> Configuração revisada. Os dados permanecem somente nesta tela e ainda não foram persistidos.</p>}
  </div>
}

export default function VerticalSetupWizardExperience() {
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialWizardState)
  const [errors, setErrors] = useState([])
  const formRef = useRef(null)
  const totalUnits = getTotalUnitCount(state.draft.towers)

  useEffect(() => {
    if (!errors.length) return
    const firstField = errors.find((error) => error.field)?.field
    const target = firstField ? formRef.current?.querySelector(`[data-field-key="${firstField}"]`) : formRef.current?.querySelector('.setup-errors')
    target?.focus()
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [errors])

  function goTo(step) {
    if (step > state.step) {
      const stepErrors = validateStepDetails(state.step, state.draft)
      if (stepErrors.length) { setErrors(stepErrors); return }
    }
    setErrors([])
    dispatch({ type: 'GO_TO_STEP', step })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const content = [
    <CondominiumStep condominium={state.draft.condominium} dispatch={dispatch} errors={errors} />,
    <ModelStep />,
    <TowersStep towers={state.draft.towers} dispatch={dispatch} errors={errors} />,
    <UnitsStep towers={state.draft.towers} />,
    <AreasStep draft={state.draft} dispatch={dispatch} />,
    <SummaryStep draft={state.draft} totalUnits={totalUnits} reviewed={state.reviewed} dispatch={dispatch} onEdit={goTo} />,
  ][state.step]

  return <SetupLayout steps={SETUP_STEPS} currentStep={state.step} maxVisited={state.maxVisited} onStepChange={goTo}><section className="setup-page">
    <div className="setup-page-meta"><span className="setup-draft-badge">Rascunho local</span><p>Suas informações permanecem nesta tela e ainda não serão salvas no banco.</p></div>
    <form ref={formRef} className="setup-card" onSubmit={(event) => { event.preventDefault(); if (state.step < SETUP_STEPS.length - 1) goTo(state.step + 1) }} noValidate><header><span>Etapa {state.step + 1} de {SETUP_STEPS.length}</span><h2>{SETUP_STEPS[state.step]}</h2></header>
      {errors.length > 0 && <div className="setup-errors" role="alert" tabIndex="-1"><CircleAlert size={20} /><div><strong>Revise os campos desta etapa:</strong><ul>{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul></div></div>}
      <div className="setup-card__body">{content}</div><footer>{state.step > 0 ? <button className="secondary-button" type="button" onClick={() => goTo(state.step - 1)}><ChevronLeft size={18} /> Voltar</button> : <span />}<div className="setup-card-footer-actions">{state.maxVisited === SETUP_STEPS.length - 1 && state.step < SETUP_STEPS.length - 1 && <button className="secondary-button" type="button" onClick={() => goTo(SETUP_STEPS.length - 1)}>Voltar ao resumo</button>}{state.step < SETUP_STEPS.length - 1 && <button className="desktop-primary" type="submit">Continuar <ChevronRight size={18} /></button>}</div></footer></form>
  </section></SetupLayout>
}
