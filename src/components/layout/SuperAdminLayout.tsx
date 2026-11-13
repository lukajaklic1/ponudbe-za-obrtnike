import { useState, useEffect } from 'react'
import { NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import AppLogo from '../ui/AppLogo'

const NAV = [
  { to: '/super-admin', icon: LayoutDashboard, label: 'Nadzorna plošča', end: true },
  { to: '/super-admin/companies', icon: Building2, label: 'Podjetja' },
  { to: '/super-admin/users', icon: Users, label: 'Uporabniki' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (session) {
      supabase.rpc('is_super_admin').then(({ data }) => setIsSuperAdmin(!!data))
    } else {
      setIsSuperAdmin(null)
    }
  }, [session])

  if (loading || (session && isSuperAdmin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-200">
        <div className="px-5 py-5 border-b border-gray-200">
          <AppLogo size="sm" />
          <span className="mt-2 inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            Super Admin
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-[#f6f6f6] hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-200">
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-500 hover:bg-[#f6f6f6] hover:text-gray-900 transition-colors"
          >
            <LogOut size={16} />
            Odjava
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
