import { Building, Building2, CircleCheckBig, CircleX, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import PlatformState from '../../components/PlatformState.jsx'
import StatCard from '../../components/StatCard.jsx'
import { usePlatformData } from '../../context/PlatformDataContext.jsx'
import { platformIndicators } from '../../features/platform/platformData.js'

export default function PlatformDashboardPage() {
  const { condominiums, listStatus, listError, retryList } = usePlatformData()
  if (listStatus === 'loading' || listStatus === 'idle') return <div className="platform-content-page"><PlatformState kind="loading" title="Carregando visão geral" description="Consultando os condomínios cadastrados na plataforma." /></div>
  if (listStatus === 'error') return <div className="platform-content-page"><PlatformState kind="error" title="Não foi possível carregar o Dashboard" description={listError} onRetry={retryList} /></div>

  const indicators = platformIndicators(condominiums)
  return <section className="platform-content-page">
    <div className="platform-page-heading"><div><span>Visão geral</span><h1>Dashboard da plataforma</h1><p>Acompanhe a situação dos condomínios cadastrados no Condo+.</p></div><Link className="desktop-primary" to="/plataforma/condominios"><Building2 size={18} /> Ver condomínios</Link></div>
    <div className="platform-stat-grid">
      <StatCard icon={Building2} label="Total de condomínios" value={indicators.total} detail="cadastros encontrados" tone="violet" />
      <StatCard icon={Building} label="Condomínios ativos" value={indicators.active} detail="com acesso operacional" />
      <StatCard icon={CircleX} label="Condomínios inativos" value={indicators.inactive} detail="com acesso bloqueado" tone="red" />
      <StatCard icon={Clock3} label="Configurações pendentes" value={indicators.pending} detail="aguardando o administrador" tone="pink" />
      <StatCard icon={CircleCheckBig} label="Configurações concluídas" value={indicators.completed} detail="estrutura configurada" />
    </div>
    {!condominiums.length && <PlatformState kind="empty" title="Nenhum condomínio cadastrado" description="Quando houver cadastros, os indicadores serão atualizados automaticamente com os dados da API." />}
  </section>
}
