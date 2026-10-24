import { ArrowLeft, Mail, Pencil, Power, PowerOff, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import PlatformState from '../../components/PlatformState.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { usePlatformData } from '../../context/PlatformDataContext.jsx'
import { platformDateLabel, platformModelLabel } from '../../features/platform/platformData.js'
import { statusLabel } from '../../services/serviceUtils.js'

export default function PlatformCondominiumDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const successRef = useRef(null)
  const actionLock = useRef(false)
  const mounted = useRef(true)
  const initialSessionRevision = useRef(null)
  const { activateCondominium, deactivateCondominium, detailState, loadDetail, sessionRevision } = usePlatformData()
  const detail = detailState(id)
  const [pendingAction, setPendingAction] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState(() => {
    if (location.state?.condominiumCreated) return 'Condomínio cadastrado com sucesso.'
    if (location.state?.condominiumUpdated) return 'Dados do condomínio atualizados com sucesso.'
    return ''
  })
  useEffect(() => { loadDetail(id) }, [id, loadDetail, sessionRevision])
  useEffect(() => () => { mounted.current = false }, [])
  useEffect(() => {
    if (initialSessionRevision.current === null) {
      initialSessionRevision.current = sessionRevision
      return
    }
    setPendingAction('')
    setActionError('')
    setSuccessMessage('')
  }, [sessionRevision])
  useEffect(() => {
    if (successMessage) successRef.current?.focus()
  }, [successMessage])

  const closeConfirmation = () => {
    if (actionBusy) return
    setPendingAction('')
    setActionError('')
  }

  async function confirmStatusChange() {
    if (!pendingAction || actionLock.current) return
    actionLock.current = true
    setActionBusy(true)
    setActionError('')
    try {
      const updated = pendingAction === 'deactivate'
        ? await deactivateCondominium(id)
        : await activateCondominium(id)
      if (!mounted.current) return
      setPendingAction('')
      setSuccessMessage(updated.status === 'INATIVO'
        ? 'Condomínio desativado. O acesso autenticado está bloqueado.'
        : 'Condomínio reativado. Usuários individualmente ativos podem voltar a acessar o sistema.')
    } catch (error) {
      if (!mounted.current) return
      setActionError(error?.status === 0
        ? 'Não foi possível confirmar se a operação foi concluída. Consulte novamente os detalhes antes de tentar outra vez.'
        : error?.message || 'Não foi possível alterar o status do condomínio.')
    } finally {
      actionLock.current = false
      if (mounted.current) setActionBusy(false)
    }
  }

  const condominium = detail.item
  const deactivating = pendingAction === 'deactivate'
  const confirmationMessage = deactivating
    ? 'O acesso autenticado dos usuários será bloqueado nas próximas requisições ao Backend, sem encerrar visualmente páginas que já estejam abertas. Os dados e usuários serão preservados. O primeiro acesso ainda permite definir senha, mesmo com o condomínio inativo.'
    : 'O acesso voltará a ser permitido para os usuários que também estejam individualmente ativos.'

  return <section className="platform-content-page">
    <Link className="platform-back-link" to="/plataforma/condominios"><ArrowLeft size={17} /> Voltar para condomínios</Link>
    {successMessage && <div ref={successRef} className="platform-success-banner" role="status" tabIndex={-1}><ShieldCheck size={20} /><div><strong>{successMessage}</strong>{location.state?.condominiumCreated && <span>O primeiro administrador deverá definir a própria senha pelo fluxo de primeiro acesso.</span>}</div></div>}
    {detail.status === 'loading' || detail.status === 'idle' ? <PlatformState kind="loading" title="Carregando detalhes" />
      : detail.status === 'error' ? <PlatformState kind="error" title="Não foi possível carregar o condomínio" description={detail.error} onRetry={() => loadDetail(id, { force: true })} />
      : <CondominiumDetails condominium={condominium} onStatusChange={(action) => { setActionError(''); setPendingAction(action) }} />}
    <ConfirmDialog
      open={Boolean(pendingAction)}
      title={deactivating ? 'Desativar condomínio' : 'Reativar condomínio'}
      message={confirmationMessage}
      confirmLabel={actionBusy ? 'Aguarde...' : deactivating ? 'Desativar condomínio' : 'Reativar condomínio'}
      destructive={deactivating}
      busy={actionBusy}
      error={actionError}
      onCancel={closeConfirmation}
      onConfirm={confirmStatusChange}
    />
  </section>
}

function CondominiumDetails({ condominium, onStatusChange }) {
  const administrators = condominium.administradores || []
  return <>
    <div className="platform-page-heading"><div><span>Detalhes do condomínio</span><h1>{condominium.nome || 'Condomínio sem nome'}</h1><p>Informações cadastrais e administrativas retornadas pela plataforma.</p></div><div className="platform-heading-actions"><Link className="secondary-button" to={`/plataforma/condominios/${condominium.id}/editar`}><Pencil size={17} /> Editar dados</Link>{condominium.status === 'ATIVO' ? <button type="button" className="danger-button" onClick={() => onStatusChange('deactivate')}><PowerOff size={17} /> Desativar condomínio</button> : <button type="button" className="desktop-primary" onClick={() => onStatusChange('activate')}><Power size={17} /> Reativar condomínio</button>}</div></div>
    <section className="platform-detail-card"><header><div><h2>Identificação</h2><p>Dados definidos pela administração da plataforma.</p></div><div className="platform-status-pair"><StatusBadge status={condominium.status}>{statusLabel(condominium.status)}</StatusBadge><StatusBadge status={condominium.configuracaoInicial}>{statusLabel(condominium.configuracaoInicial)}</StatusBadge></div></header><dl className="platform-detail-grid"><div><dt>CNPJ</dt><dd>{condominium.cnpj || 'Não informado'}</dd></div><div><dt>Modelo residencial</dt><dd>{condominium.configuracaoInicial === 'PENDENTE' ? 'Definido durante a configuração inicial' : platformModelLabel(condominium.modelo)}</dd></div><div><dt>Status operacional</dt><dd>{statusLabel(condominium.status)}</dd></div><div><dt>Configuração inicial</dt><dd>{statusLabel(condominium.configuracaoInicial)}</dd></div><div><dt>Data de criação</dt><dd>{platformDateLabel(condominium.criadoEm)}</dd></div><div><dt>Identificador</dt><dd>{condominium.id}</dd></div></dl></section>
    <section className="platform-detail-card"><header><div><h2>Administradores associados</h2><p>O administrador ativo e os anteriores mantidos no histórico.</p></div><strong>{administrators.length}</strong></header>{administrators.length ? <div className="platform-admin-list">{administrators.map((admin) => <article key={admin.id}><span className="platform-admin-avatar"><UserRound size={21} /></span><div className="platform-admin-copy"><div><h3>{admin.nome || 'Administrador sem nome'}</h3><StatusBadge status={admin.status}>{statusLabel(admin.status)}</StatusBadge></div><p>{admin.cpf || 'CPF não informado'}</p>{admin.email && <span><Mail size={15} /> {admin.email}</span>}</div>{admin.primeiroAcessoPendente && <span className="platform-first-access"><ShieldCheck size={15} /> Primeiro acesso pendente</span>}</article>)}</div> : <PlatformState kind="empty" title="Nenhum administrador associado" description="A API não retornou administradores para este condomínio." />}</section>
  </>
}
