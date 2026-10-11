import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Users, UserCog, Settings, LogOut, X, Tags, Building2, PanelLeft, ChevronDown, ClipboardCheck, CalendarDays,
} from 'lucide-react'
import { useSidebarCollapse } from './AppLayout'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { useLanguage } from '../../hooks/useLanguage'
import { cn } from '../../lib/cn'
import AppLogo from '../ui/AppLogo'

type NavKey = 'dashboard' | 'quotes' | 'customers' | 'priceList' | 'jobs' | 'calendar'
type PermModule = 'quotes' | 'customers' | 'price_list'
interface NavItem { to: string; icon: typeof LayoutDashboard; key: NavKey; mod?: PermModule }

// Top-level items, then named sections (Attio-style small labels, collapsible)
const TOP: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
]
const SECTIONS: { id: 'sales' | 'work'; items: NavItem[] }[] = [
  { id: 'sales', items: [
    { to: '/quotes',     icon: FileText, key: 'quotes',    mod: 'quotes' },
    { to: '/customers',  icon: Users,    key: 'customers', mod: 'customers' },
    { to: '/price-list', icon: Tags,     key: 'priceList', mod: 'price_list' },
  ] },
  { id: 'work', items: [
    { to: '/jobs',       icon: ClipboardCheck, key: 'jobs',   mod: 'quotes' },
    { to: '/calendar',   icon: CalendarDays, key: 'calendar', mod: 'quotes' },
  ] },
]

const COLLAPSED_KEY = 'obrtdesk-sidebar-collapsed'
function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]') } catch { return [] }
}

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { toggle } = useSidebarCollapse()
  const { signOut } = useAuth()
  const { company, profile, hasPerm } = useCompany()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed)

  function toggleSection(id: string) {
    setCollapsed(c => {
      const next = c.includes(id) ? c.filter(x => x !== id) : [...c, id]
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const visible = (item: NavItem) => !item.mod || hasPerm(item.mod, 'view')
  const navLink = ({ to, icon: Icon, key }: NavItem) => (
    <NavLink
      key={to}
      to={to}
      onClick={handleNavClick}
      className={({ isActive }) => cn(
        'flex items-center gap-2.5 px-3 py-1.5 rounded-lg mb-0.5 text-sm font-medium transition-colors',
        isActive ? 'bg-[#f1f1f1] text-gray-900' : 'text-gray-900 hover:bg-[#f6f6f6]',
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-gray-500" />
      {t.nav[key]}
    </NavLink>
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function handleNavClick() {
    onClose?.()
  }

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-screen shrink-0">
      {/* App logo — same height as PageHeader (h-[57px]) */}
      <div className="h-[57px] px-4 border-b border-gray-200 flex items-center justify-between shrink-0">
        <AppLogo size="sm" />
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-[#f6f6f6] rounded-md transition-colors" title="Hide sidebar">
            <PanelLeft className="w-[18px] h-[18px]" />
          </button>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1.5 text-gray-500 hover:text-gray-900 hover:bg-[#f6f6f6] rounded-lg transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Company pill */}
      {company && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-white rounded-md border border-gray-200">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-sm font-medium text-gray-900 truncate">{company.name}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {TOP.filter(visible).map(navLink)}

        {SECTIONS.map(sec => {
          const items = sec.items.filter(visible)
          if (!items.length) return null
          const open = !collapsed.includes(sec.id)
          return (
            <div key={sec.id} className="mt-4">
              <button type="button" onClick={() => toggleSection(sec.id)}
                className="flex items-center gap-1 w-full px-2 py-1 mb-0.5 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-md">
                <ChevronDown className={cn('w-3 h-3 transition-transform', !open && '-rotate-90')} />
                {t.nav.sections[sec.id]}
              </button>
              {open && items.map(navLink)}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-200 p-2">
        {profile?.is_admin && <NavLink
          to="/users"
          onClick={handleNavClick}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
            isActive ? 'bg-[#f1f1f1] text-gray-900' : 'text-gray-900 hover:bg-[#f6f6f6]',
          )}
        >
          <UserCog className="w-4 h-4 shrink-0 text-gray-500" />
          {t.nav.users}
        </NavLink>}
        {profile?.is_admin && <NavLink
          to="/settings"
          onClick={handleNavClick}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
            isActive ? 'bg-[#f1f1f1] text-gray-900' : 'text-gray-900 hover:bg-[#f6f6f6]',
          )}
        >
          <Settings className="w-4 h-4 shrink-0 text-gray-500" />
          {t.nav.settings}
        </NavLink>}

        {/* Language switcher */}
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <span className="text-xs text-gray-500 shrink-0">{t.language.label}:</span>
          <div className="flex gap-1">
            {(['en', 'sl'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                  lang === l ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-[#f6f6f6]',
                )}
              >
                {l === 'en' ? 'EN' : 'SL'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {profile ? `${profile.first_name[0]}${profile.last_name[0]}` : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {profile ? `${profile.first_name} ${profile.last_name}` : '—'}
            </p>
          </div>
          <button onClick={handleSignOut} className="text-gray-500 hover:text-gray-900 transition-colors" title={t.nav.signOut}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
