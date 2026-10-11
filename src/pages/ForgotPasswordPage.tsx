import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const { t, lang, setLang } = useLanguage()
  const a = t.auth
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex justify-center pt-10">
        <AppLogo size="md" showName={true} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-10">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">{a.resetEmailSent}</h1>
              <p className="text-sm text-gray-400 mb-8">{a.resetEmailSentDesc}</p>
              <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />{a.backToLogin}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">{a.forgotPassword}</h1>
              <p className="text-sm text-gray-400 text-center mb-8">{a.forgotPasswordDesc}</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-label">{a.email}</label>
                  <input type="email" required autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1">
                  {loading ? a.sendingReset : a.sendResetLink}
                </button>
              </form>

              <div className="flex justify-center mt-6">
                <Link to="/login" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />{a.backToLogin}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-center pb-5">
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
  )
}
