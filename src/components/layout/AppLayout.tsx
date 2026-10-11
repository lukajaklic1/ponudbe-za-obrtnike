import { useState, useEffect, createContext, useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import Sidebar from './Sidebar'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}
const SidebarContext = createContext<SidebarContextValue>({ collapsed: false, toggle: () => {} })
export const useSidebarCollapse = () => useContext(SidebarContext)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, isPasswordRecovery } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

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

  if (!session || isPasswordRecovery) return <Navigate to={isPasswordRecovery ? '/reset-password' : '/'} replace />

  if (isSuperAdmin) return <Navigate to="/super-admin" replace />

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed(c => !c) }}>
      <div className="flex h-screen bg-white overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`
          fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'lg:hidden' : ''}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-500 hover:bg-[#f6f6f6] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-gray-900">Obrtdesk</span>
          </header>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
