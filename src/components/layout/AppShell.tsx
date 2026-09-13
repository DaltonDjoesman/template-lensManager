import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MobileNav, Sidebar } from './Navigation'
import { useFadeMotion } from '../../lib/motionPresets'
import './AppShell.css'

export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()
  const fade = useFadeMotion()

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
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            className="main-pane"
            initial={fade.initial}
            animate={fade.animate}
            exit={fade.exit}
            transition={fade.transition}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
