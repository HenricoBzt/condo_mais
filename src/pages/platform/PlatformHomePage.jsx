import { Building2, LogOut, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../../components/Brand'
import { logout } from '../../services/authApi'

export default function PlatformHomePage() {
  return <div className="platform-shell">
    <header className="platform-header"><Brand inverse /><Link to="/" onClick={logout}><LogOut size={18} /> Sair</Link></header>
    <main className="platform-page">
      <section className="platform-intro"><span><ShieldCheck size={22} /> Acesso MASTER verificado</span><h1>Administração da plataforma</h1><p>Este ambiente será usado para gerenciar os condomínios e seus administradores.</p></section>
      <section className="platform-placeholder"><Building2 size={34} /><div><h2>Área preparada</h2><p>O cadastro e a gestão de condomínios serão implementados na próxima etapa. Nenhum dado fictício está sendo exibido.</p></div></section>
    </main>
  </div>
}
