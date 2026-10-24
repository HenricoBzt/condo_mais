import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PlatformState from '../../components/PlatformState.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { usePlatformData } from '../../context/PlatformDataContext.jsx'
import { filterPlatformCondominiums } from '../../features/platform/platformData.js'
import { statusLabel } from '../../services/serviceUtils.js'

export default function PlatformCondominiumsPage() {
  const { condominiums, listStatus, listError, retryList } = usePlatformData()
  const [filters, setFilters] = useState({ query: '', operationalStatus: '', setupStatus: '' })
  const rows = useMemo(() => filterPlatformCondominiums(condominiums, filters), [condominiums, filters])
  const hasFilters = Object.values(filters).some(Boolean)
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const clear = () => setFilters({ query: '', operationalStatus: '', setupStatus: '' })

  return <section className="platform-content-page">
    <div className="platform-page-heading"><div><span>Gestão da plataforma</span><h1>Condomínios</h1><p>Consulte os cadastros e acompanhe seus dois estados independentes.</p></div></div>
    {listStatus === 'loading' || listStatus === 'idle' ? <PlatformState kind="loading" title="Carregando condomínios" />
      : listStatus === 'error' ? <PlatformState kind="error" title="Não foi possível carregar os condomínios" description={listError} onRetry={retryList} />
      : !condominiums.length ? <PlatformState kind="empty" title="Nenhum condomínio cadastrado" description="A API não retornou condomínios para esta plataforma." />
      : <>
        <div className="platform-filters">
          <label className="search-box"><Search size={18} /><span className="sr-only">Buscar condomínio</span><input value={filters.query} onChange={update('query')} placeholder="Buscar por nome ou CNPJ" /></label>
          <label>Status operacional<select value={filters.operationalStatus} onChange={update('operationalStatus')}><option value="">Todos</option><option value="ATIVO">Ativos</option><option value="INATIVO">Inativos</option></select></label>
          <label>Configuração inicial<select value={filters.setupStatus} onChange={update('setupStatus')}><option value="">Todas</option><option value="PENDENTE">Pendentes</option><option value="CONCLUIDA">Concluídas</option></select></label>
          {hasFilters && <button type="button" className="clear-filters" onClick={clear}>Limpar filtros</button>}
        </div>
        {rows.length ? <div className="table-wrap platform-table"><table><caption className="sr-only">Condomínios cadastrados na plataforma</caption><thead><tr><th>Condomínio</th><th>CNPJ</th><th>Status operacional</th><th>Configuração inicial</th><th className="action-column">Ações</th></tr></thead><tbody>{rows.map((condominium) => <tr key={condominium.id}><td className="identity-column"><strong>{condominium.nome}</strong></td><td>{condominium.cnpj}</td><td><StatusBadge status={condominium.status}>{statusLabel(condominium.status)}</StatusBadge></td><td><StatusBadge status={condominium.configuracaoInicial}>{statusLabel(condominium.configuracaoInicial)}</StatusBadge></td><td className="action-column"><Link className="row-action" to={`/plataforma/condominios/${condominium.id}`}>Ver detalhes</Link></td></tr>)}</tbody></table></div>
          : <PlatformState kind="empty" title="Nenhum condomínio corresponde aos filtros" description="Ajuste ou limpe os filtros para consultar os demais cadastros." />}
        <p className="platform-list-count">Mostrando {rows.length} de {condominiums.length} condomínios</p>
      </>}
  </section>
}
