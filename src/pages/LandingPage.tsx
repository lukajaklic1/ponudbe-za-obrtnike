// The public one-pager for Fenestio.
//
// The look follows the Payhawk pattern the user asked for: a light hero on a soft gradient with a
// pill badge and a big, lightly-weighted display headline; a deep green band with cards on it;
// light blue feature cards; an eyebrow over every section; 8px buttons with an arrow; 24px cards.
// Type is Inter Tight (the app itself keeps Inter), 68/48/24/20 with line heights of 1.1 / 1.2 / 1.4.
import '@fontsource-variable/inter-tight'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowUpRight, Menu, X, Check, Globe } from 'lucide-react'
import AppLogo from '../components/ui/AppLogo'
import WindowDrawing from '../components/WindowDrawing'
import { useLanguage } from '../hooks/useLanguage'

// ── tokens ──────────────────────────────────────────────────
const INK = '#041818'          // every piece of text on light
const MUTED = 'rgba(4,24,24,0.66)'
const DARK = '#072928'         // the deep green band
const DARK_CARD = '#124846'    // a card standing on that band
const ON_DARK = '#dff9f9'
const LIME = '#a1ed86'         // the eyebrow on dark
const GREEN = '#81de60'        // the call to action
const SKY = '#eaf6fd'          // the glow behind the hero
const CARD = '#eef4fd'         // a light feature card
const FONT = "'Inter Tight Variable', Inter, ui-sans-serif, system-ui, sans-serif"

function Eyebrow({ children, on = 'light' }: { children: React.ReactNode; on?: 'light' | 'dark' }) {
  return (
    <p className="text-[13px] sm:text-[15px] font-medium uppercase" style={{ letterSpacing: '1.5px', color: on === 'dark' ? LIME : MUTED }}>
      {children}
    </p>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center h-9 px-4 rounded-full border text-sm" style={{ borderColor: 'rgba(4,24,24,0.18)', color: INK }}>
      {children}
    </span>
  )
}

function Cta({ to, children, tone = 'green', className = '' }: { to: string; children: React.ReactNode; tone?: 'green' | 'ink' | 'white'; className?: string }) {
  const style = tone === 'green' ? { backgroundColor: GREEN, color: INK }
    : tone === 'white' ? { backgroundColor: '#ffffff', color: INK }
    : { backgroundColor: INK, color: '#ffffff' }
  return (
    <Link to={to} style={style}
      className={`inline-flex h-11 items-center gap-2 rounded-lg pl-5 pr-4 text-[15px] font-medium transition-opacity hover:opacity-90 ${className}`}>
      {children}<ArrowUpRight className="w-4 h-4" />
    </Link>
  )
}

/** a little piece of the real interface, drawn in markup */
function Chip({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'green' }) {
  return (
    <span className="inline-flex items-center gap-2 h-8 px-3 rounded-full text-[13px] font-medium shadow-[0_2px_8px_rgba(4,24,24,0.08)]"
      style={{ backgroundColor: '#ffffff', color: INK }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tone === 'green' ? '#00a35f' : '#266df0' }} />
      {children}
    </span>
  )
}

export default function LandingPage() {
  const { lang, setLang } = useLanguage()
  const sl = lang === 'sl'
  const [menu, setMenu] = useState(false)

  const nav = [
    { href: '#kaj', label: sl ? 'Kaj dela' : 'What it does' },
    { href: '#kako', label: sl ? 'Kako deluje' : 'How it works' },
    { href: '#cena', label: sl ? 'Cena' : 'Pricing' },
    { href: '#vprasanja', label: sl ? 'Vprašanja' : 'FAQ' },
  ]

  const pillars = [
    { title: sl ? 'Konfigurator' : 'Configurator',
      text: sl ? 'Stranka na vaši strani sestavi okno: profil, barva, steklo, mere, odpiranje, okovje in senčila.' : 'On your site the customer builds the window: profile, colour, glass, sizes, opening, hardware and shading.',
      chips: [sl ? 'PVC 82 mm' : 'PVC 82 mm', sl ? 'Troslojno steklo' : 'Triple glazing', sl ? 'Antracit' : 'Anthracite'] },
    { title: sl ? 'Povpraševanja' : 'Enquiries',
      text: sl ? 'Povpraševanje pride kot skonfigurirana okna, ne kot e-pošta z opisom. Odprete in uredite.' : 'An enquiry arrives as configured windows, not an e-mail with a description. You open it and adjust.',
      chips: [sl ? 'Novo povpraševanje' : 'New enquiry', sl ? '3 pozicije' : '3 positions'] },
    { title: sl ? 'Ponudbe' : 'Quotes',
      text: sl ? 'Cena se računa iz vašega cenika — profili po metru, steklo po m², okovje po krilu, delo in marža.' : 'The price comes from your own list — profiles per metre, glass per m², hardware per sash, labour and margin.',
      chips: [sl ? 'Izdano' : 'Issued', '1.284 €'] },
    { title: sl ? 'Pregled' : 'Overview',
      text: sl ? 'Kaj je odprto, kaj dobljeno, kateri kanal prinese posle in kaj se je s posamezno ponudbo dogajalo.' : 'What is open, what is won, which channel brings the jobs and what happened to each quote.',
      chips: [sl ? 'Uspešnost 59 %' : 'Win rate 59 %', sl ? 'Dobljeno' : 'Won'] },
  ]

  const steps = [
    { n: '01', title: sl ? 'Vnesete cenik' : 'Enter your price list',
      text: sl ? 'Profile po tekočem metru, stekla, okovje, senčila, storitve in marže. Enkrat, po vaših številkah.' : 'Profiles per metre, glass, hardware, shading, services and margins. Once, with your own numbers.' },
    { n: '02', title: sl ? 'Objavite konfigurator' : 'Publish the configurator',
      text: sl ? 'Povezavo dodate na svojo spletno stran. Izberete, ali stranka vidi cene in ali dobi ponudbo takoj.' : 'Add the link to your website. You choose whether the customer sees prices and gets the offer at once.' },
    { n: '03', title: sl ? 'Izdajate ponudbe' : 'Issue the quotes',
      text: sl ? 'Povpraševanje pregledate, ponudbo izdate in jo spremljate do naročila — z zgodovino vsake spremembe.' : 'Review the enquiry, issue the quote and follow it to the order — with a history of every change.' },
  ]

  const features = [
    { title: sl ? 'Kalkulacija, ki jo lahko preverite' : 'A calculation you can check',
      text: sl ? 'Vsaka vrstica pove, od kod količina: 2×(1800+1400) = 6,4 m + 6 % odpadka. Nič skritega.' : 'Every line says where its quantity came from: 2×(1800+1400) = 6.4 m + 6 % waste. Nothing hidden.',
      visual: 'calc' as const },
    { title: sl ? 'Ponudba, ki jo stranka razume' : 'A quote the customer understands',
      text: sl ? 'PDF z risbo vsake pozicije, merami, izbirami in ceno — brez razlaganja po telefonu.' : 'A PDF with a drawing of each position, its sizes, choices and price — no explaining on the phone.',
      visual: 'pdf' as const },
    { title: sl ? 'Zgodovina vsake ponudbe' : 'A history on every quote',
      text: sl ? 'Kdo je kaj spremenil in kdaj, kdaj je bila izdana in kdaj zaključena. Zapisa ni mogoče popraviti.' : 'Who changed what and when, when it was issued and closed. The record cannot be edited.',
      visual: 'history' as const },
    { title: sl ? 'Poročila, ki povedo, kaj narediti' : 'Reports that tell you what to do',
      text: sl ? 'Uspešnost po prodajnih kanalih, vrednost po skupinah izdelkov, primerjava s prejšnjim obdobjem.' : 'Win rate by sales channel, value by product group, a comparison with the period before.',
      visual: 'report' as const },
  ]

  const faq = [
    { q: sl ? 'Ali moram zamenjati spletno stran?' : 'Do I need to replace my website?',
      a: sl ? 'Ne. Konfigurator je svoja stran na povezavi, ki jo objavite — dodate jo kot gumb na obstoječo stran.' : 'No. The configurator is its own page at a link you publish — you add it as a button on your existing site.' },
    { q: sl ? 'Ali stranka vidi moje cene?' : 'Does the customer see my prices?',
      a: sl ? 'Samo če tako izberete. Štiri različice: s cenami ali brez, s povpraševanjem ali s takojšnjo ponudbo v PDF.' : 'Only if you choose so. Four variants: with or without prices, ending in an enquiry or an instant PDF.' },
    { q: sl ? 'Kaj pa strešna okna in senčila?' : 'What about roof windows and shading?',
      a: sl ? 'Strešna okna so katalog z merami, obrobami in montažo na kos. Senčila in komarniki so del konfiguracije okna.' : 'Roof windows are a catalogue with sizes, flashings and per-piece installation. Shading and screens are part of the window.' },
    { q: sl ? 'Kje so moji podatki?' : 'Where is my data?',
      a: sl ? 'V oblačni bazi v Evropski uniji, ločeno po podjetjih, z nočno varnostno kopijo. Za učenje modelov umetne inteligence jih ne uporabljamo.' : 'In a cloud database in the European Union, separated per company, with a nightly backup. We do not use it to train AI models.' },
  ]

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT, color: INK }}>
      {/* ── announcement ─────────────────────────────── */}
      <div className="w-full px-5 py-2.5 text-center text-[13px] sm:text-sm" style={{ backgroundColor: LIME, color: INK }}>
        {sl ? 'Fenestio je v beta obdobju — cena po dogovoru, brez vezave.' : 'Fenestio is in beta — the price is agreed individually, with no lock-in.'}
      </div>

      {/* ── nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b" style={{ borderColor: 'rgba(4,24,24,0.08)' }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="shrink-0"><AppLogo size="md" showName /></Link>
          <nav className="hidden md:flex items-center gap-7">
            {nav.map(n => <a key={n.href} href={n.href} className="text-[15px] transition-opacity hover:opacity-60" style={{ color: INK }}>{n.label}</a>)}
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')} title={sl ? 'English' : 'Slovensko'}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-2 text-[15px] transition-opacity hover:opacity-60" style={{ color: INK }}>
              <Globe className="w-4 h-4" />{sl ? 'SL' : 'EN'}
            </button>
            <Link to="/login" className="hidden sm:inline-flex h-9 items-center px-2 text-[15px] transition-opacity hover:opacity-60" style={{ color: INK }}>
              {sl ? 'Prijava' : 'Log in'}
            </Link>
            <Cta to="/register" tone="ink" className="!h-9 !text-sm">{sl ? 'Preizkusite' : 'Try it'}</Cta>
            <button type="button" onClick={() => setMenu(m => !m)} aria-label={sl ? 'Meni' : 'Menu'}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg" style={{ color: INK }}>
              {menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-1 bg-white">
            {nav.map(n => <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="py-2.5 text-[15px]">{n.label}</a>)}
            <Link to="/login" className="py-2.5 text-[15px]">{sl ? 'Prijava' : 'Log in'}</Link>
            <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')} className="py-2.5 text-left text-[15px]">{sl ? 'English' : 'Slovensko'}</button>
          </div>
        )}
      </header>

      {/* ── hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(115deg, #ffffff 8%, ${SKY} 52%, #e6f5ef 78%, #ffffff 100%)` }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 pt-14 pb-16 sm:pt-24 sm:pb-24 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center">
          <div>
            <Pill>{sl ? 'Za ponudnike oken' : 'For window suppliers'}</Pill>
            <h1 className="mt-6 text-[40px] leading-[1.06] sm:text-[56px] lg:text-[68px] lg:leading-[1.08] font-medium tracking-[-0.02em]">
              {sl ? <>Konfigurator oken,<br />ki piše ponudbe</> : <>A window configurator<br />that writes the quotes</>}
            </h1>
            <p className="mt-6 text-[18px] leading-7 sm:text-[20px] sm:leading-8 max-w-xl" style={{ color: MUTED }}>
              {sl
                ? 'Stranka na vaši spletni strani sama sestavi okno in odda povpraševanje. Pri vas se odpre kot skonfigurirana ponudba — pregledate, popravite, izdate.'
                : 'On your website the customer builds the window and sends an enquiry. It opens on your side as a configured quote — you review it, adjust it, issue it.'}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
              <a href="#kako" className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[15px] font-medium border transition-colors hover:bg-white"
                style={{ borderColor: 'rgba(4,24,24,0.18)', color: INK }}>
                {sl ? 'Kako deluje' : 'How it works'}<ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
            <p className="mt-4 text-sm" style={{ color: MUTED }}>{sl ? 'Brez namestitve. Brez kartice.' : 'No installation. No card.'}</p>
          </div>

          {/* the product, drawn with the app's own window drawing */}
          <div className="relative">
            <div className="rounded-[24px] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(4,24,24,0.18)]">
              <div className="flex items-center justify-between text-[13px]" style={{ color: MUTED }}>
                <span>{sl ? 'Pozicija 1' : 'Position 1'}</span><span>1800 × 1400 mm</span>
              </div>
              <div className="my-4 flex justify-center"><WindowDrawing template="double_mullion" width={1800} height={1400} size={200} /></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[[sl ? 'Profil' : 'Profile', 'PVC 82 mm'], [sl ? 'Barva' : 'Colour', sl ? 'Antracit / bela' : 'Anthracite / white'],
                  [sl ? 'Steklo' : 'Glass', 'Ug 0,7'], [sl ? 'Senčila' : 'Shading', sl ? 'Rolete' : 'Roller shutters']].map(([k, v]) => (
                  <div key={k} className="contents"><dt style={{ color: MUTED }}>{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-4 pt-4 flex items-baseline justify-between border-t" style={{ borderColor: 'rgba(4,24,24,0.08)' }}>
                <span className="text-sm" style={{ color: MUTED }}>{sl ? 'Skupaj brez DDV' : 'Total excl. VAT'}</span>
                <span className="text-xl font-medium tabular-nums">1.284 €</span>
              </div>
            </div>
            <div className="absolute -top-3 -left-3 hidden sm:block"><Chip>{sl ? 'Povpraševanje oddano' : 'Enquiry sent'}</Chip></div>
            <div className="absolute -bottom-4 -right-2 hidden sm:block"><Chip tone="green">{sl ? 'Ponudba izdana' : 'Quote issued'}</Chip></div>
          </div>
        </div>
      </section>

      {/* ── what it does, on the dark band ───────────── */}
      <section id="kaj" style={{ backgroundColor: DARK, color: ON_DARK }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <div className="text-center">
            <Eyebrow on="dark">{sl ? 'Kaj dela Fenestio' : 'What Fenestio does'}</Eyebrow>
            <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[48px] sm:leading-[1.2] font-medium tracking-[-0.02em] max-w-3xl mx-auto">
              {sl ? 'Ena aplikacija od povpraševanja do naročila' : 'One app from the enquiry to the order'}
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(p => (
              <div key={p.title} className="rounded-[24px] p-6 flex flex-col" style={{ backgroundColor: DARK_CARD }}>
                <h3 className="text-[22px] leading-7 font-medium tracking-[-0.01em]">{p.title}</h3>
                <p className="mt-2.5 text-[15px] leading-6" style={{ color: 'rgba(223,249,249,0.72)' }}>{p.text}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {p.chips.map(c => (
                    <span key={c} className="inline-flex items-center h-7 px-3 rounded-full text-[12px] font-medium"
                      style={{ backgroundColor: 'rgba(223,249,249,0.10)', color: ON_DARK }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────── */}
      <section id="kako" className="max-w-[1180px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="text-center">
          <Eyebrow>{sl ? 'Kako deluje' : 'How it works'}</Eyebrow>
          <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[48px] sm:leading-[1.2] font-medium tracking-[-0.02em] max-w-3xl mx-auto">
            {sl ? 'Trije koraki do prve ponudbe' : 'Three steps to your first quote'}
          </h2>
        </div>
        <div className="mt-12 grid gap-10 sm:gap-8 sm:grid-cols-3">
          {steps.map(s => (
            <div key={s.n}>
              <span className="text-sm font-medium tabular-nums" style={{ color: MUTED }}>{s.n}</span>
              <h3 className="mt-3 text-[22px] leading-7 font-medium tracking-[-0.01em]">{s.title}</h3>
              <p className="mt-2.5 text-[16px] leading-7" style={{ color: MUTED }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── feature cards ────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(f => (
            <div key={f.title} className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: CARD }}>
              <div className="rounded-2xl bg-white p-4 sm:p-5 min-h-[132px] flex flex-col justify-center shadow-[0_8px_24px_-12px_rgba(4,24,24,0.18)]">
                {f.visual === 'calc' && (
                  <div className="text-[12px] leading-5 tabular-nums">
                    {[[sl ? 'Okvir' : 'Frame', '2×(1800+1400) = 6,4 m + 6 %', '6,784 m'],
                      [sl ? 'Krila' : 'Sashes', '2×(805+1276)', '4,412 m'],
                      [sl ? 'Steklo' : 'Glass', '675×1146 + 815×1286 mm', '1,822 m²']].map(([a, b, c]) => (
                      <div key={a} className="flex items-baseline justify-between gap-3 py-0.5">
                        <span className="font-medium">{a}</span>
                        <span className="flex-1 truncate" style={{ color: MUTED }}>{b}</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                {f.visual === 'pdf' && (
                  <div className="flex items-center gap-4">
                    <WindowDrawing template="tilt_turn" width={900} height={1400} size={64} />
                    <div className="text-[12px] leading-5 flex-1">
                      <div className="font-medium">{sl ? 'Enokrilno okno 900 × 1400' : 'Single sash 900 × 1400'}</div>
                      <div style={{ color: MUTED }}>{sl ? 'PVC 82 mm · Ug 0,7 · kip in odpiranje' : 'PVC 82 mm · Ug 0.7 · tilt and turn'}</div>
                      <div className="mt-1.5 font-medium">612,40 €</div>
                    </div>
                  </div>
                )}
                {f.visual === 'history' && (
                  <ol className="text-[12px] leading-5">
                    {[[sl ? 'Status: Poslano → Pridobljeno' : 'Status: Sent → Won', 'Janez · 18:52'],
                      [sl ? 'Ponudba spremenjena in shranjena' : 'Quote edited and saved', 'Ana · 17:04'],
                      [sl ? 'Povpraševanje prek konfiguratorja' : 'Enquiry via the configurator', '24. 11.']].map(([a, b], i) => (
                      <li key={a} className="flex items-baseline gap-2.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: i === 0 ? '#00a35f' : 'rgba(4,24,24,0.25)' }} />
                        <span className="flex-1 truncate font-medium">{a}</span>
                        <span style={{ color: MUTED }}>{b}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {f.visual === 'report' && (
                  <div className="text-[12px] leading-5">
                    {[[sl ? 'Priporočilo' : 'Referral', 100], ['Google', 67], ['Facebook', 25]].map(([a, v]) => (
                      <div key={a as string} className="flex items-center gap-3 py-1">
                        <span className="w-20 shrink-0 truncate font-medium">{a}</span>
                        <span className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'rgba(4,24,24,0.08)' }}>
                          <span className="block h-2 rounded-full" style={{ width: `${v}%`, backgroundColor: '#266df0' }} />
                        </span>
                        <span className="tabular-nums">{v} %</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <h3 className="mt-6 text-[22px] leading-7 font-medium tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-2.5 text-[16px] leading-7" style={{ color: MUTED }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── pricing ──────────────────────────────────── */}
      <section id="cena" className="max-w-[1180px] mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
        <div className="text-center">
          <Eyebrow>{sl ? 'Cena' : 'Pricing'}</Eyebrow>
          <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[48px] sm:leading-[1.2] font-medium tracking-[-0.02em]">
            {sl ? 'Dogovorimo se za vaše podjetje' : 'Agreed for your company'}
          </h2>
          <p className="mt-4 text-[18px] leading-7 max-w-xl mx-auto" style={{ color: MUTED }}>
            {sl ? 'Fenestio je v beta obdobju. Ceno postavimo glede na velikost ekipe in obseg cenika, račun prejmete mesečno.'
                : 'Fenestio is in beta. The price follows the size of your team and your price list, and you are invoiced monthly.'}
          </p>
        </div>
        <div className="mt-10 mx-auto max-w-2xl rounded-[24px] border p-6 sm:p-8" style={{ borderColor: 'rgba(4,24,24,0.12)' }}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(sl ? ['Neomejeno število ponudb', 'Konfigurator na vaši povezavi', 'Pomoč pri vnosu cenika', 'Brez vezave', 'Podatki v EU', 'Nočna varnostna kopija']
                 : ['Unlimited quotes', 'A configurator at your own link', 'Help setting up the price list', 'No lock-in', 'Data in the EU', 'Nightly backup']
            ).map(x => (
              <li key={x} className="flex items-start gap-2.5 text-[16px]">
                <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
            <a href="mailto:info@bimetric.si" className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[15px] font-medium border transition-colors hover:bg-[#fafafa]"
              style={{ borderColor: 'rgba(4,24,24,0.18)', color: INK }}>{sl ? 'Pišite nam' : 'Talk to us'}</a>
          </div>
        </div>
      </section>

      {/* ── faq ──────────────────────────────────────── */}
      <section id="vprasanja" className="max-w-[1180px] mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
        <Eyebrow>{sl ? 'Pogosta vprašanja' : 'Frequently asked'}</Eyebrow>
        <div className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {faq.map(f => (
            <div key={f.q} className="pt-6 border-t" style={{ borderColor: 'rgba(4,24,24,0.12)' }}>
              <h3 className="text-[18px] leading-7 font-medium">{f.q}</h3>
              <p className="mt-2 text-[16px] leading-7" style={{ color: MUTED }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── closing call ─────────────────────────────── */}
      <section className="px-5 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-[1180px] mx-auto rounded-[24px] px-6 py-14 sm:px-12 sm:py-20 text-center" style={{ backgroundColor: DARK, color: ON_DARK }}>
          <h2 className="text-[30px] leading-[1.15] sm:text-[48px] sm:leading-[1.2] font-medium tracking-[-0.02em] max-w-2xl mx-auto">
            {sl ? 'Naj stranke konfigurirajo, vi pa izdajate' : 'Let customers configure, and you issue'}
          </h2>
          <p className="mt-4 text-[18px] leading-7 max-w-xl mx-auto" style={{ color: 'rgba(223,249,249,0.72)' }}>
            {sl ? 'Postavite cenik, objavite konfigurator in prvo ponudbo izdate še danes.' : 'Set up the price list, publish the configurator and issue your first quote today.'}
          </p>
          <div className="mt-8 flex justify-center"><Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta></div>
        </div>
      </section>

      {/* ── footer ───────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: 'rgba(4,24,24,0.10)' }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <AppLogo size="sm" showName />
            <p className="mt-2.5 text-sm" style={{ color: MUTED }}>{sl ? 'Storitev ponuja Bimetric · info@bimetric.si' : 'A service by Bimetric · info@bimetric.si'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
            <Link to="/terms" className="transition-opacity hover:opacity-60">{sl ? 'Pogoji uporabe' : 'Terms'}</Link>
            <Link to="/privacy" className="transition-opacity hover:opacity-60">{sl ? 'Zasebnost' : 'Privacy'}</Link>
            <Link to="/login" className="transition-opacity hover:opacity-60">{sl ? 'Prijava' : 'Log in'}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
