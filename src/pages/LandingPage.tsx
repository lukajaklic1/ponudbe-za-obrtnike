// The public face of Fenestio: what it is, who it is for, what it does.
// Built mobile first — every section is one column on a phone and widens from sm upwards.
import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowRight, Menu, X, MonitorSmartphone, FileText, Calculator,
  BarChart3, History, Users, Check,
} from 'lucide-react'
import AppLogo from '../components/ui/AppLogo'
import WindowDrawing from '../components/WindowDrawing'
import { useLanguage } from '../hooks/useLanguage'

const BLUE = '#266df0'

export default function LandingPage() {
  const { lang, setLang } = useLanguage()
  const sl = lang === 'sl'
  const [menu, setMenu] = useState(false)

  const nav = [
    { href: '#kaj', label: sl ? 'Kaj dobite' : 'What you get' },
    { href: '#kako', label: sl ? 'Kako deluje' : 'How it works' },
    { href: '#cena', label: sl ? 'Cena' : 'Pricing' },
    { href: '#vprasanja', label: sl ? 'Vprašanja' : 'FAQ' },
  ]

  const features = [
    { icon: MonitorSmartphone, title: sl ? 'Konfigurator na vaši spletni strani' : 'A configurator on your own site',
      text: sl ? 'Stranka sama sestavi okno — material, profil, barvo, steklo, mere, okovje in senčila — ter odda povpraševanje ali takoj prenese ponudbo.' : 'The customer builds the window themselves — material, profile, colour, glass, sizes, hardware and shading — then sends an enquiry or downloads the offer right away.' },
    { icon: FileText, title: sl ? 'Iz povpraševanja v ponudbo' : 'From enquiry to quote',
      text: sl ? 'Povpraševanje pride v aplikacijo kot skonfigurirana okna, ki jih lahko urejate naprej. Ponudbo izdate, ne pretipkavate.' : 'An enquiry arrives as configured windows you can keep editing. You issue the quote instead of retyping it.' },
    { icon: Calculator, title: sl ? 'Cenik, ki računa namesto vas' : 'A price list that does the maths',
      text: sl ? 'Profili po tekočem metru, steklo po m², okovje po krilu, delo in marža. Vi vzdržujete cene, aplikacija računa pozicije.' : 'Profiles per metre, glass per m², hardware per sash, labour and margin. You keep the prices, the app prices the positions.' },
    { icon: BarChart3, title: sl ? 'Poročila, ki povedo kaj narediti' : 'Reports that tell you what to do',
      text: sl ? 'Odprte in dobljene ponudbe, uspešnost po prodajnih kanalih, vrednost po skupinah izdelkov in primerjava s prejšnjim obdobjem.' : 'Open and won quotes, win rate by sales channel, value by product group and a comparison with the period before.' },
    { icon: History, title: sl ? 'Zgodovina vsake ponudbe' : 'A history on every quote',
      text: sl ? 'Kdo je kaj spremenil in kdaj, kdaj je bila ponudba izdana, poslana in zaključena. Zapisa ni mogoče popraviti.' : 'Who changed what and when, when the quote was issued, sent and closed. The record cannot be edited.' },
    { icon: Users, title: sl ? 'Stranke na enem mestu' : 'Customers in one place',
      text: sl ? 'Podjetja in fizične osebe, njihove ponudbe, vrednosti in uspešnost — brez iskanja po e-pošti.' : 'Companies and private customers, their quotes, values and win rate — no digging through e-mail.' },
  ]

  const steps = [
    { n: '1', title: sl ? 'Vnesete svoj cenik' : 'Enter your price list',
      text: sl ? 'Profili, barve, stekla, okovje, senčila in storitve — enkrat, po vaših cenah.' : 'Profiles, colours, glass, hardware, shading and services — once, at your prices.' },
    { n: '2', title: sl ? 'Objavite konfigurator' : 'Publish the configurator',
      text: sl ? 'Povezavo daste na svojo spletno stran. Sami izberete, ali stranka vidi cene in ali dobi ponudbo takoj.' : 'Put the link on your website. You decide whether the customer sees prices and whether they get the offer at once.' },
    { n: '3', title: sl ? 'Obdelate povpraševanja' : 'Work the enquiries',
      text: sl ? 'Povpraševanja pridejo skonfigurirana. Ponudbo uredite, izdate in spremljate do naročila.' : 'Enquiries arrive configured. You adjust the quote, issue it and follow it to the order.' },
  ]

  const faq = [
    { q: sl ? 'Ali moram zamenjati svojo spletno stran?' : 'Do I need to replace my website?',
      a: sl ? 'Ne. Konfigurator je svoja stran na povezavi, ki jo objavite — dodate jo kot gumb ali povezavo na obstoječo stran.' : 'No. The configurator is its own page at a link you publish — you add it as a button or a link on your existing site.' },
    { q: sl ? 'Ali stranka vidi moje cene?' : 'Does the customer see my prices?',
      a: sl ? 'Samo če tako izberete. Na voljo so štiri različice: s cenami ali brez, s povpraševanjem ali s takojšnjo ponudbo v PDF.' : 'Only if you choose so. There are four variants: with or without prices, ending in an enquiry or in an instant PDF offer.' },
    { q: sl ? 'Kaj pa strešna okna in senčila?' : 'What about roof windows and shading?',
      a: sl ? 'Strešna okna so katalog z modeli, merami, obrobami in montažnimi storitvami na kos. Senčila in komarniki so del konfiguracije okna.' : 'Roof windows are a catalogue of models with sizes, flashings and per-piece installation services. Shading and insect screens are part of the window configuration.' },
    { q: sl ? 'Kje so moji podatki?' : 'Where is my data?',
      a: sl ? 'V oblačni bazi v Evropski uniji, ločeno po podjetjih. Podatkov ne uporabljamo za učenje modelov umetne inteligence.' : 'In a cloud database in the European Union, separated per company. We do not use your data to train artificial-intelligence models.' },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0"><AppLogo size="md" showName /></Link>
          <nav className="hidden md:flex items-center gap-7">
            {nav.map(n => <a key={n.href} href={n.href} className="text-sm font-medium text-[#5e5e5e] hover:text-gray-900 transition-colors">{n.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex h-9 items-center px-3.5 rounded-[10px] text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors">{sl ? 'Prijava' : 'Sign in'}</Link>
            <Link to="/register" className="inline-flex h-9 items-center px-4 rounded-[10px] text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: BLUE }}>
              {sl ? 'Preizkusite' : 'Try it'}
            </Link>
            <button type="button" onClick={() => setMenu(m => !m)} aria-label={sl ? 'Meni' : 'Menu'}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-[10px] text-gray-900 hover:bg-gray-100">
              {menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="md:hidden border-t border-gray-100 px-5 py-3 flex flex-col gap-1">
            {nav.map(n => <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="py-2 text-sm font-medium text-gray-900">{n.label}</a>)}
            <Link to="/login" className="py-2 text-sm font-medium text-gray-900">{sl ? 'Prijava' : 'Sign in'}</Link>
          </div>
        )}
      </header>

      {/* ── hero ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 pt-12 pb-14 sm:pt-20 sm:pb-20 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold" style={{ backgroundColor: '#e5eeff', color: '#215bcf' }}>
            {sl ? 'Za ponudnike oken' : 'For window suppliers'}
          </span>
          <h1 className="mt-4 text-[34px] leading-[1.1] sm:text-5xl sm:leading-[1.08] font-bold tracking-[-0.02em]">
            {sl ? 'Spletni konfigurator oken in ponudbe v eni aplikaciji' : 'A window configurator and your quotes in one app'}
          </h1>
          <p className="mt-4 text-base sm:text-lg leading-7 text-[#5e5e5e]">
            {sl
              ? 'Stranka na vaši spletni strani sama sestavi okno in odda povpraševanje. Pri vas se odpre kot skonfigurirana ponudba, ki jo samo pregledate in izdate.'
              : 'On your website the customer builds the window and sends an enquiry. It opens on your side as a configured quote you only review and issue.'}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link to="/register" className="inline-flex h-11 items-center justify-center px-5 rounded-xl text-sm font-semibold text-white gap-2 transition-opacity hover:opacity-90" style={{ backgroundColor: BLUE }}>
              {sl ? 'Začnite brezplačno' : 'Start for free'}<ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#kako" className="inline-flex h-11 items-center justify-center px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 hover:border-gray-400 transition-colors">
              {sl ? 'Poglejte, kako deluje' : 'See how it works'}
            </a>
          </div>
          <p className="mt-3 text-xs text-[#7f7f7f]">{sl ? 'Brez namestitve. Brez kartice.' : 'No installation. No card.'}</p>
        </div>

        {/* what the customer actually sees: the drawing is the one the app draws */}
        <div className="rounded-2xl border border-gray-200 bg-[#fbfbfb] p-5 sm:p-7">
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <div className="flex justify-center"><WindowDrawing template="double_mullion" width={1800} height={1400} size={210} showDims /></div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-[#7f7f7f]">{sl ? 'Profil' : 'Profile'}</dt><dd className="text-right font-medium">PVC 76 mm</dd>
              <dt className="text-[#7f7f7f]">{sl ? 'Barva' : 'Colour'}</dt><dd className="text-right font-medium">{sl ? 'Antracit / bela' : 'Anthracite / white'}</dd>
              <dt className="text-[#7f7f7f]">{sl ? 'Steklo' : 'Glass'}</dt><dd className="text-right font-medium">Ug 0,7</dd>
              <dt className="text-[#7f7f7f]">{sl ? 'Senčila' : 'Shading'}</dt><dd className="text-right font-medium">{sl ? 'Rolete' : 'Roller shutters'}</dd>
            </dl>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-baseline justify-between">
              <span className="text-sm text-[#5e5e5e]">{sl ? 'Skupaj brez DDV' : 'Total excl. VAT'}</span>
              <span className="text-xl font-semibold tabular-nums">1.284 €</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-center text-[#7f7f7f]">{sl ? 'Primer pozicije, kot jo vidita stranka in vi.' : 'A position as the customer and you both see it.'}</p>
        </div>
      </section>

      {/* ── features ────────────────────────────────────── */}
      <section id="kaj" className="border-t border-gray-100 bg-[#fbfbfb]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-[32px] leading-tight font-bold tracking-[-0.02em]">{sl ? 'Kaj dobite' : 'What you get'}</h2>
          <p className="mt-3 text-base text-[#5e5e5e] max-w-2xl">
            {sl ? 'Vse, kar potrebujete od prvega povpraševanja do naročila. Nič, česar ne bi uporabljali.' : 'Everything from the first enquiry to the order. Nothing you would not use.'}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e5eeff' }}>
                  <f.icon className="w-[18px] h-[18px]" style={{ color: '#215bcf' }} />
                </div>
                <h3 className="mt-3.5 text-base font-semibold tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[#5e5e5e]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ────────────────────────────────── */}
      <section id="kako" className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-[32px] leading-tight font-bold tracking-[-0.02em]">{sl ? 'Kako deluje' : 'How it works'}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map(s => (
            <div key={s.n} className="rounded-xl border border-gray-200 p-5">
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}>{s.n}</span>
              <h3 className="mt-3.5 text-base font-semibold tracking-[-0.01em]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[#5e5e5e]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── pricing ─────────────────────────────────────── */}
      <section id="cena" className="border-t border-gray-100 bg-[#fbfbfb]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-[32px] leading-tight font-bold tracking-[-0.02em]">{sl ? 'Cena' : 'Pricing'}</h2>
          <div className="mt-8 max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
            <h3 className="text-lg font-semibold">{sl ? 'Beta obdobje' : 'Beta period'}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5e5e5e]">
              {sl
                ? 'Fenestio je v beta obdobju. Ceno se dogovorimo individualno, glede na velikost ekipe in obseg cenika — račun prejmete mesečno.'
                : 'Fenestio is in beta. We agree the price individually, by the size of your team and your price list — you are invoiced monthly.'}
            </p>
            <ul className="mt-5 space-y-2.5">
              {(sl
                ? ['Neomejeno število ponudb', 'Spletni konfigurator na vaši povezavi', 'Podpora pri vnosu cenika', 'Brez vezave']
                : ['Unlimited quotes', 'A configurator at your own link', 'Help setting up your price list', 'No lock-in']
              ).map(x => (
                <li key={x} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#00a35f' }} />{x}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="inline-flex h-11 items-center justify-center px-5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: BLUE }}>
                {sl ? 'Začnite brezplačno' : 'Start for free'}
              </Link>
              <a href="mailto:info@bimetric.si" className="inline-flex h-11 items-center justify-center px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 hover:border-gray-400 transition-colors">
                {sl ? 'Pišite nam' : 'Talk to us'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── faq ─────────────────────────────────────────── */}
      <section id="vprasanja" className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-[32px] leading-tight font-bold tracking-[-0.02em]">{sl ? 'Pogosta vprašanja' : 'Frequently asked'}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {faq.map(f => (
            <div key={f.q} className="rounded-xl border border-gray-200 p-5">
              <h3 className="text-base font-semibold tracking-[-0.01em]">{f.q}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[#5e5e5e]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── closing call ────────────────────────────────── */}
      <section className="px-5 sm:px-6 pb-14 sm:pb-20">
        <div className="max-w-6xl mx-auto rounded-2xl px-6 py-10 sm:px-10 sm:py-14 text-center" style={{ backgroundColor: '#0f1b33' }}>
          <h2 className="text-2xl sm:text-[32px] leading-tight font-bold tracking-[-0.02em] text-white">
            {sl ? 'Naj stranke konfigurirajo, vi pa izdajate ponudbe' : 'Let customers configure, and you issue quotes'}
          </h2>
          <p className="mt-3 text-base text-white/70 max-w-xl mx-auto">
            {sl ? 'Postavite cenik, objavite konfigurator in prvo ponudbo izdate še danes.' : 'Set up the price list, publish the configurator and issue your first quote today.'}
          </p>
          <Link to="/register" className="mt-7 inline-flex h-11 items-center justify-center px-6 rounded-xl text-sm font-semibold text-gray-900 bg-white hover:opacity-90 transition-opacity">
            {sl ? 'Začnite brezplačno' : 'Start for free'}
          </Link>
        </div>
      </section>

      {/* ── footer ──────────────────────────────────────── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <AppLogo size="sm" showName />
            <p className="mt-2 text-xs text-[#7f7f7f]">{sl ? 'Storitev ponuja Bimetric · info@bimetric.si' : 'A service by Bimetric · info@bimetric.si'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/terms" className="text-[#5e5e5e] hover:text-gray-900">{sl ? 'Pogoji uporabe' : 'Terms'}</Link>
            <Link to="/privacy" className="text-[#5e5e5e] hover:text-gray-900">{sl ? 'Zasebnost' : 'Privacy'}</Link>
            <Link to="/login" className="text-[#5e5e5e] hover:text-gray-900">{sl ? 'Prijava' : 'Sign in'}</Link>
            <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')} className="text-[#5e5e5e] hover:text-gray-900">{sl ? 'English' : 'Slovensko'}</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
