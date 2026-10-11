import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useLanguage()
  const a = t.auth
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(lang === 'sl' ? 'Gesli se ne ujemata' : 'Passwords do not match'); return }
    if (password.length < 8) { setError(lang === 'sl' ? 'Geslo mora imeti vsaj 8 znakov' : 'Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    navigate('/onboarding')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Logo top center */}
      <div className="flex justify-center pt-10">
        <AppLogo size="md" showName={true} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">{a.createAccount}</h1>
          <p className="text-sm text-gray-400 text-center mb-8">{a.getStarted}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-label">{a.email}</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-label">{a.password}</label>
              <input
                type="password" required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={lang === 'sl' ? 'Vsaj 8 znakov' : 'Min. 8 characters'}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-label">{a.confirmPassword}</label>
              <input
                type="password" required autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1">
              {loading ? a.creatingAccount : a.createAccount}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {a.alreadyHaveAccount}{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">{a.signIn}</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-3 px-8 py-5">
        <p className="text-xs text-gray-400 text-center max-w-sm">
          {lang === 'sl'
            ? <>Z ustvarjanjem računa se strinjate z našimi <Link to="/terms" className="underline hover:text-gray-600">pogoji uporabe</Link> in <Link to="/privacy" className="underline hover:text-gray-600">politiko zasebnosti</Link>.</>
            : <>By creating an account you agree to our <Link to="/terms" className="underline hover:text-gray-600">Terms of Service</Link> and <Link to="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.</>}
        </p>
        <div className="flex items-center gap-4">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Obrtdesk</p>
          <div className="flex gap-1">
            {(['en', 'sl'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${lang === l ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
