import { Outlet } from 'react-router-dom'
import { MobileNav, Sidebar } from './Navigation'
import './AppShell.css'

export function AppShell() {
  return (
    <div className="app-wrapper">
      <Sidebar />
      <MobileNav />
      <main className="main-content">
        <div className="mobile-topbar">
          <div className="mobile-topbar-brand">
            <div className="lens-logo lens-logo--sm" />
            <span>Lens Manager</span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
