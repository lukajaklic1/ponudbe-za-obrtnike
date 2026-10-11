import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { LanguageProvider } from './hooks/useLanguage'
import { Toaster } from './components/ui/Toast'
import AppLayout from './components/layout/AppLayout'
import SuperAdminLayout from './components/layout/SuperAdminLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import PriceListPage from './pages/PriceListPage'
import QuotesPage from './pages/QuotesPage'
import QuoteFormPage from './pages/QuoteFormPage'
import JobsPage from './pages/JobsPage'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage'
import SuperAdminCompaniesPage from './pages/SuperAdminCompaniesPage'
import SuperAdminUsersPage from './pages/SuperAdminUsersPage'

const queryClient = new QueryClient()

function App({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}

function SA({ children }: { children: React.ReactNode }) {
  return <SuperAdminLayout>{children}</SuperAdminLayout>
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
          <Toaster />
          <Routes>
            {/* Public */}
            <Route path="/"                 element={<Navigate to="/login" replace />} />
            <Route path="/login"            element={<LoginPage />} />
            <Route path="/register"         element={<RegisterPage />} />
            <Route path="/onboarding"       element={<OnboardingPage />} />
            <Route path="/privacy"          element={<PrivacyPage />} />
            <Route path="/terms"            element={<TermsPage />} />
            <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
            <Route path="/reset-password"   element={<ResetPasswordPage />} />
            <Route path="/accept-invite"    element={<AcceptInvitePage />} />

            {/* Super admin — own layout, no company sidebar */}
            <Route path="/super-admin"           element={<SA><SuperAdminDashboardPage /></SA>} />
            <Route path="/super-admin/companies" element={<SA><SuperAdminCompaniesPage /></SA>} />
            <Route path="/super-admin/users"     element={<SA><SuperAdminUsersPage /></SA>} />

            {/* Protected company app */}
            <Route path="/dashboard"             element={<App><DashboardPage /></App>} />
            <Route path="/quotes"                element={<App><QuotesPage /></App>} />
            <Route path="/quotes/new"            element={<App><QuoteFormPage /></App>} />
            <Route path="/quotes/:id/edit"       element={<App><QuoteFormPage /></App>} />
            <Route path="/quotes/:id"            element={<App><QuoteFormPage readOnly /></App>} />
            <Route path="/customers"             element={<App><CustomersPage /></App>} />
            <Route path="/price-list"            element={<App><PriceListPage /></App>} />
            <Route path="/jobs"                  element={<App><JobsPage /></App>} />
            <Route path="/calendar"              element={<App><CalendarPage /></App>} />
            <Route path="/users"                 element={<App><UsersPage /></App>} />
            <Route path="/settings"             element={<App><SettingsPage /></App>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
