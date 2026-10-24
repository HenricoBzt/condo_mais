import { Building2, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { logout } from '../services/authApi.js'

const links = [
  ['Dashboard', '/plataforma', LayoutDashboard, true],
  ['Condomínios', '/plataforma/condominios', Building2, false],
]

export default function PlatformLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const menuWasOpen = useRef(false)
  const location = useLocation()
  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    if (menuOpen) {
      menuWasOpen.current = true
      closeButtonRef.current?.focus()
      const closeOnEscape = (event) => {
        if (event.key === 'Escape') setMenuOpen(false)
      }
      document.addEventListener('keydown', closeOnEscape)
      return () => document.removeEventListener('keydown', closeOnEscape)
    }
    if (menuWasOpen.current) {
      menuWasOpen.current = false
      menuButtonRef.current?.focus()
    }
  }, [menuOpen])
  const pageName = location.pathname.includes('/condominios') ? 'Condomínios' : 'Dashboard'

  return <div className="platform-app-shell">
    <aside className={`platform-sidebar${menuOpen ? ' platform-sidebar--open' : ''}`} aria-label="Navegação da plataforma">
      <div className="platform-sidebar__brand"><Brand inverse /><button ref={closeButtonRef} type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X size={22} /></button></div>
      <div className="platform-sidebar__identity"><ShieldCheck size={19} /><div><strong>Condo+ Plataforma</strong><span>Administrador Master</span></div></div>
      <nav>{links.map(([label, to, Icon, end]) => <NavLink key={to} to={to} end={end}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
      <NavLink className="platform-sidebar__logout" to="/" onClick={logout}><LogOut size={20} /> Sair</NavLink>
    </aside>
    {menuOpen && <button type="button" className="platform-sidebar-backdrop" aria-label="Fechar menu lateral" onClick={() => setMenuOpen(false)} />}
    <section className="platform-workspace">
      <header className="platform-topbar"><button ref={menuButtonRef} type="button" className="platform-menu-button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div><span>Administração da plataforma</span><strong>{pageName}</strong></div><span className="platform-role-badge"><ShieldCheck size={16} /> MASTER</span></header>
      <main><Outlet /></main>
    </section>
  </div>
}
