import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, loading } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const a = t.acceptInvite
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError(lang === 'sl' ? 'Geslo mora imeti vsaj 8 znakov' : 'Password must be at least 8 characters'); return }
    if (password !== confirm) { setError(a.passwordMismatch); return }
    setError(''); setSubmitting(true)

    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setError(pwErr.message); setSubmitting(false); return }

    const token = searchParams.get('token')
    if (!token) { setError(lang === 'sl' ? 'Manjka žeton za povabilo — prosimo odprite originalno e-poštno povabilo' : 'Missing invitation token — please open the original invite email'); setSubmitting(false); return }

    const { error: rpcErr } = await supabase.rpc('accept_invitation', { p_token: token })
    if (rpcErr) { setError(rpcErr.message); setSubmitting(false); return }

    navigate('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex justify-center pt-10">
        <AppLogo size="md" showName={true} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-10">
        <div className="w-full max-w-sm">
          {!session ? (
            <div className="text-center">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-3 mb-4">{a.invalidLink}</p>
              <button onClick={() => navigate('/login')} className="text-sm text-blue-600 hover:underline font-medium">
                {t.auth.signIn}
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">{a.title}</h1>
              <p className="text-sm text-gray-400 text-center mb-8">
                {lang === 'sl' ? 'Povabljeni ste bili v Obrtdesk. Nastavite geslo za vaš račun.' : "You've been invited to Obrtdesk. Set a password for your account."}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-label">{lang === 'sl' ? 'Geslo' : 'Password'}</label>
                  <input type="password" required autoComplete="new-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={lang === 'sl' ? 'Vsaj 8 znakov' : 'Min. 8 characters'}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-label">{a.confirmPassword}</label>
                  <input type="password" required autoComplete="new-password"
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

                <button type="submit" disabled={submitting}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1">
                  {submitting ? a.joining : a.join}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 px-8 py-5">
        <p className="text-xs text-gray-400 text-center max-w-sm">
          {lang === 'sl'
            ? 'Z nadaljevanjem se strinjate z našimi pogoji uporabe in politiko zasebnosti.'
            : 'By continuing you agree to our Terms of Service and Privacy Policy.'}
        </p>
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
