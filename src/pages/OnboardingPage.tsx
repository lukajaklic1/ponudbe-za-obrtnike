import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const o = t.onboarding
  const [step, setStep] = useState<'company' | 'profile'>('company')
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    setError('')
    setLoading(true)
    const { error: rpcErr } = await (supabase as any).rpc('handle_onboarding', {
      p_company_name: companyName,
      p_first_name: firstName,
      p_last_name: lastName,
    })
    if (rpcErr) { setError(rpcErr.message); setLoading(false); return }
    navigate('/dashboard')
  }

  const steps = [
    { key: 'company', label: lang === 'sl' ? 'Podjetje' : 'Company' },
    { key: 'profile', label: o.yourProfile },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex justify-center pt-10">
        <AppLogo size="md" showName={true} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-6">
        <div className="w-full max-w-sm">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => {
              const done = (step === 'profile' && s.key === 'company')
              const active = step === s.key
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors
                      ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-sm font-medium ${active ? 'text-gray-900' : done ? 'text-gray-500' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
                </div>
              )
            })}
          </div>

          <form onSubmit={handleFinish}>
            {step === 'company' && (
              <>
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">{o.setupCompany}</h1>
                <p className="text-sm text-gray-500 mb-8">{o.setupSubtitle}</p>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-label">{lang === 'sl' ? 'Ime podjetja' : 'Company name'}</label>
                    <input type="text" required
                      value={companyName} onChange={e => setCompanyName(e.target.value)}
                      placeholder="Acme d.o.o."
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
                    />
                  </div>
                  <button type="button" disabled={!companyName.trim()}
                    onClick={() => setStep('profile')}
                    className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {o.continue}
                  </button>
                </div>
              </>
            )}

            {step === 'profile' && (
              <>
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">{o.yourProfile}</h1>
                <p className="text-sm text-gray-500 mb-8">{o.profileSubtitle}</p>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-label">{o.firstName}</label>
                    <input type="text" required
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder={lang === 'sl' ? 'Janez' : 'John'}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-label">{o.lastName}</label>
                    <input type="text" required
                      value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder={lang === 'sl' ? 'Novak' : 'Smith'}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
                    />
                  </div>

                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setStep('company')}
                      className="flex-1 bg-white text-gray-700 border border-gray-200 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                      {o.back}
                    </button>
                    <button type="submit" disabled={loading || !firstName.trim() || !lastName.trim()}
                      className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                      {loading ? o.saving : o.finishSetup}
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>
      </div>

      <div className="flex justify-center pb-5">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Obrtdesk</p>
      </div>
    </div>
  )
}
