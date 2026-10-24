import { ArrowLeft, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PlatformState from '../../components/PlatformState.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { usePlatformData } from '../../context/PlatformDataContext.jsx'
import { platformDateLabel, platformModelLabel } from '../../features/platform/platformData.js'
import { statusLabel } from '../../services/serviceUtils.js'

export default function PlatformCondominiumDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const successRef = useRef(null)
  const { detailState, loadDetail } = usePlatformData()
  const detail = detailState(id)
  useEffect(() => { loadDetail(id) }, [id, loadDetail])
  useEffect(() => {
    if (location.state?.condominiumCreated) successRef.current?.focus()
  }, [location.state])

  return <section className="platform-content-page">
    <Link className="platform-back-link" to="/plataforma/condominios"><ArrowLeft size={17} /> Voltar para condomínios</Link>
    {location.state?.condominiumCreated && <div ref={successRef} className="platform-success-banner" role="status" tabIndex={-1}><ShieldCheck size={20} /><div><strong>Condomínio cadastrado com sucesso.</strong><span>O primeiro administrador deverá definir a própria senha pelo fluxo de primeiro acesso.</span></div></div>}
    {detail.status === 'loading' || detail.status === 'idle' ? <PlatformState kind="loading" title="Carregando detalhes" />
      : detail.status === 'error' ? <PlatformState kind="error" title="Não foi possível carregar o condomínio" description={detail.error} onRetry={() => loadDetail(id, { force: true })} />
      : <CondominiumDetails condominium={detail.item} />}
  </section>
}

function CondominiumDetails({ condominium }) {
  const administrators = condominium.administradores || []
  return <>
    <div className="platform-page-heading"><div><span>Detalhes do condomínio</span><h1>{condominium.nome || 'Condomínio sem nome'}</h1><p>Informações cadastrais e administrativas retornadas pela plataforma.</p></div></div>
    <section className="platform-detail-card"><header><div><h2>Identificação</h2><p>Dados definidos pela administração da plataforma.</p></div><div className="platform-status-pair"><StatusBadge status={condominium.status}>{statusLabel(condominium.status)}</StatusBadge><StatusBadge status={condominium.configuracaoInicial}>{statusLabel(condominium.configuracaoInicial)}</StatusBadge></div></header><dl className="platform-detail-grid"><div><dt>CNPJ</dt><dd>{condominium.cnpj || 'Não informado'}</dd></div><div><dt>Modelo residencial</dt><dd>{condominium.configuracaoInicial === 'PENDENTE' ? 'Definido durante a configuração inicial' : platformModelLabel(condominium.modelo)}</dd></div><div><dt>Status operacional</dt><dd>{statusLabel(condominium.status)}</dd></div><div><dt>Configuração inicial</dt><dd>{statusLabel(condominium.configuracaoInicial)}</dd></div><div><dt>Data de criação</dt><dd>{platformDateLabel(condominium.criadoEm)}</dd></div><div><dt>Identificador</dt><dd>{condominium.id}</dd></div></dl></section>
    <section className="platform-detail-card"><header><div><h2>Administradores associados</h2><p>O administrador ativo e os anteriores mantidos no histórico.</p></div><strong>{administrators.length}</strong></header>{administrators.length ? <div className="platform-admin-list">{administrators.map((admin) => <article key={admin.id}><span className="platform-admin-avatar"><UserRound size={21} /></span><div className="platform-admin-copy"><div><h3>{admin.nome || 'Administrador sem nome'}</h3><StatusBadge status={admin.status}>{statusLabel(admin.status)}</StatusBadge></div><p>{admin.cpf || 'CPF não informado'}</p>{admin.email && <span><Mail size={15} /> {admin.email}</span>}</div>{admin.primeiroAcessoPendente && <span className="platform-first-access"><ShieldCheck size={15} /> Primeiro acesso pendente</span>}</article>)}</div> : <PlatformState kind="empty" title="Nenhum administrador associado" description="A API não retornou administradores para este condomínio." />}</section>
  </>
}
