import { NavLink } from 'react-router-dom'
import {
  IconCatalog,
  IconClients,
  IconOrders,
  IconReports,
  IconSettings,
} from '../icons'
import { NAV_ITEMS } from './navItems'
import './AppShell.css'

const icons = {
  orders: IconOrders,
  clients: IconClients,
  catalog: IconCatalog,
  reports: IconReports,
  settings: IconSettings,
}

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="lens-logo lens-logo--sm" />
        <h2>Lens Manager</h2>
      </div>
      <ul className="sidebar-menu">
        {NAV_ITEMS.map((item) => {
          const Icon = icons[item.icon]
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                <Icon />
                {item.desktopLabel}
              </NavLink>
            </li>
          )
        })}
      </ul>
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar" aria-hidden>
            LM
          </div>
          <div className="user-info">
            <span className="user-name">Demo user</span>
            <span className="user-role">Local browser data</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = icons[item.icon]
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mobile-nav-link${isActive ? ' active' : ''}`
            }
          >
            <Icon width={20} height={20} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
