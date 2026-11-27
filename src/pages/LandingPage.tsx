// The public one-pager for Fenestio.
//
// The rule the first attempts broke: never shrink a whole screen of the app into a picture — at that
// size nothing can be read and it looks like a grey rectangle. Every visual here is a PIECE of the
// interface, drawn in markup at a size you can actually read: a position card, a quote row, the
// calculation, a win-rate bar. Sharp at any resolution, and it cannot go stale.
//
// Tokens measured off the reference: ink #041818, band #072928, lime #a1ed86, action #81de60,
// light panel #eef4fd, 8px buttons, 24px cards, Inter Tight at 400–500 with tight tracking.
import '@fontsource-variable/inter-tight'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight, Check, X, MonitorSmartphone, FileText, Calculator,
  BarChart3, History, Users, Ruler, Layers, Globe,
} from 'lucide-react'
import AppLogo from '../components/ui/AppLogo'
import WindowDrawing from '../components/WindowDrawing'
import { useLanguage } from '../hooks/useLanguage'

const INK = '#041818'
const MUTED = 'rgba(4,24,24,0.66)'
const FAINT = 'rgba(4,24,24,0.10)'
const DARK = '#072928'
const ON_DARK = '#dff9f9'
const ON_DARK_MUTED = 'rgba(223,249,249,0.70)'
const LIME = '#a1ed86'
const GREEN = '#81de60'
const PANEL = '#eef4fd'
const BLUE = '#266df0'
const FONT = "'Inter Tight Variable', Inter, ui-sans-serif, system-ui, sans-serif"

function Eyebrow({ children, on = 'light' }: { children: React.ReactNode; on?: 'light' | 'dark' }) {
  return <p className="text-[13px] font-medium uppercase" style={{ letterSpacing: '1.5px', color: on === 'dark' ? LIME : MUTED }}>{children}</p>
}

/** small rounded label, the way the reference tags a block */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center h-7 px-3 rounded-full text-[12px] font-medium border" style={{ borderColor: FAINT, color: INK, backgroundColor: '#ffffff' }}>
      {children}
    </span>
  )
}

function Cta({ to, children, tone = 'green', small = false }: { to: string; children: React.ReactNode; tone?: 'green' | 'ink'; small?: boolean }) {
  const style = tone === 'green' ? { backgroundColor: GREEN, color: INK } : { backgroundColor: INK, color: '#ffffff' }
  return (
    <Link to={to} style={style}
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-opacity hover:opacity-90 ${small ? 'h-9 pl-4 pr-3 text-sm' : 'h-12 pl-6 pr-5 text-[16px]'}`}>
      {children}<ArrowUpRight className={small ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
    </Link>
  )
}

export default function LandingPage() {
  const { lang, setLang } = useLanguage()
  const sl = lang === 'sl'

  // ── the pieces of interface used as the artwork ───────────────────────
  const PositionCard = () => (
    <div className="rounded-[20px] bg-white p-5 sm:p-6 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.65)]" style={{ border: `1px solid ${FAINT}` }}>
      <div className="flex items-center justify-between text-[13px]" style={{ color: MUTED }}>
        <span className="font-medium" style={{ color: INK }}>{sl ? 'Pozicija 1' : 'Position 1'}</span>
        <span>1800 × 1400 mm</span>
      </div>
      <div className="my-5 flex justify-center"><WindowDrawing template="double_mullion" width={1800} height={1400} size={210} showDims /></div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 text-[14px]">
        {[[sl ? 'Profil' : 'Profile', 'PVC 82 mm'], [sl ? 'Barva' : 'Colour', sl ? 'Antracit / bela' : 'Anthracite / white'],
          [sl ? 'Steklo' : 'Glass', 'Ug 0,7'], [sl ? 'Odpiranje' : 'Opening', sl ? 'Kip in odpiranje' : 'Tilt and turn']].map(([k, v]) => (
          <div key={k} className="contents"><dt style={{ color: MUTED }}>{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-5 pt-4 flex items-baseline justify-between border-t" style={{ borderColor: FAINT }}>
        <span className="text-[14px]" style={{ color: MUTED }}>{sl ? 'Cena pozicije' : 'Position price'}</span>
        <span className="text-[22px] font-medium tabular-nums">1.284 €</span>
      </div>
    </div>
  )

  const CalcCard = () => (
    <div className="rounded-[20px] bg-white p-5 sm:p-7 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.5)]" style={{ border: `1px solid ${FAINT}` }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-medium">{sl ? 'Kalkulacija pozicije' : 'Position calculation'}</span>
        <Tag>{sl ? 'Nabavne cene' : 'Purchase prices'}</Tag>
      </div>
      <div className="text-[14px] leading-6 tabular-nums">
        {[
          [sl ? 'Okvir' : 'Frame', '2×(1800+1400) = 6,4 m + 6 %', '6,784 m', '105,15 €'],
          [sl ? 'Krila' : 'Sashes', '2×(805+1276)', '4,412 m', '78,31 €'],
          [sl ? 'Letvice' : 'Beads', '2×(649+1120) + 2×(789+1260)', '8,094 m', '31,36 €'],
          [sl ? 'Steklo' : 'Glass', '675×1146 + 815×1286 mm', '1,822 m²', '58,29 €'],
          [sl ? 'Okovje' : 'Hardware', '20,00 € + 1,00 €/m × 4,162 m', '1 ' + (sl ? 'kos' : 'pc'), '24,16 €'],
          [sl ? 'Delo' : 'Labour', '30 € + 22 € + 12 € + 8 €', '1 ' + (sl ? 'kos' : 'pc'), '72,00 €'],
        ].map(([a, b, c, d]) => (
          <div key={a} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[104px_minmax(0,1fr)_84px_86px] gap-x-4 py-2 border-b last:border-0" style={{ borderColor: 'rgba(4,24,24,0.07)' }}>
            <span className="font-medium">{a}</span>
            <span className="hidden sm:block truncate" style={{ color: MUTED }}>{b}</span>
            <span className="hidden sm:block text-right" style={{ color: MUTED }}>{c}</span>
            <span className="text-right font-medium">{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 space-y-1.5 border-t text-[14px]" style={{ borderColor: FAINT }}>
        <div className="flex items-baseline justify-between"><span style={{ color: MUTED }}>{sl ? 'Nabavna vrednost' : 'Purchase value'}</span><span className="font-medium tabular-nums">397,33 €</span></div>
        <div className="flex items-baseline justify-between"><span style={{ color: MUTED }}>{sl ? 'Marža 45 %' : 'Margin 45 %'}</span><span className="font-medium tabular-nums">+ 178,79 €</span></div>
        <div className="flex items-baseline justify-between pt-1.5 border-t" style={{ borderColor: FAINT }}>
          <span className="font-medium">{sl ? 'Prodajna cena' : 'Sale price'}</span><span className="text-[19px] font-medium tabular-nums">576,12 €</span>
        </div>
      </div>
    </div>
  )

  const BoardCard = () => (
    <div className="rounded-[20px] bg-white p-5 sm:p-6 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.5)]" style={{ border: `1px solid ${FAINT}` }}>
      <div className="grid grid-cols-3 gap-3">
        {[
          { n: sl ? 'Povpraševanje' : 'Enquiry', c: '#8a6100', bg: '#fef3cd', items: [['P-2026-0031', '2.405 €']] },
          { n: sl ? 'Poslano' : 'Sent', c: '#215bcf', bg: '#e5eeff', items: [['P-2026-0028', '1.504 €'], ['P-2026-0026', '460 €']] },
          { n: sl ? 'Pridobljeno' : 'Won', c: '#267a47', bg: '#dbfce7', items: [['P-2026-0019', '6.654 €']] },
        ].map(col => (
          <div key={col.n} className="rounded-xl p-2.5" style={{ backgroundColor: '#f7f7f7' }}>
            <span className="inline-flex items-center h-6 px-2 rounded-md text-[11px] font-medium" style={{ color: col.c, backgroundColor: col.bg }}>{col.n}</span>
            <div className="mt-2.5 space-y-2">
              {col.items.map(([no, val]) => (
                <div key={no} className="rounded-lg bg-white p-2.5" style={{ border: `1px solid ${FAINT}` }}>
                  <div className="text-[11px]" style={{ color: MUTED }}>{no}</div>
                  <div className="text-[13px] font-medium mt-0.5 truncate">EuroMotion d.o.o.</div>
                  <div className="text-[13px] font-medium mt-1.5 tabular-nums">{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t" style={{ borderColor: FAINT }}>
        <div className="text-[13px] font-medium mb-2.5">{sl ? 'Zgodovina ponudbe' : 'Quote history'}</div>
        {[[sl ? 'Status: Poslano → Pridobljeno' : 'Status: Sent → Won', 'Janez · 18:52', true],
          [sl ? 'Ponudba spremenjena in shranjena' : 'Quote edited and saved', 'Ana · 17:04', false],
          [sl ? 'Povpraševanje prek konfiguratorja' : 'Enquiry via the configurator', '24. 11.', false]].map(([a, b, on]) => (
          <div key={a as string} className="flex items-baseline gap-3 py-1 text-[13px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: on ? '#00a35f' : 'rgba(4,24,24,0.25)' }} />
            <span className="flex-1 truncate">{a}</span><span style={{ color: MUTED }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const ReportCard = () => (
    <div className="rounded-[20px] bg-white p-5 sm:p-7 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.5)]" style={{ border: `1px solid ${FAINT}` }}>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[[sl ? 'Odprte ponudbe' : 'Open quotes', '9.405 €', sl ? '4 ponudbe' : '4 quotes'],
          [sl ? 'Uspešnost ponudb' : 'Win rate', '59 %', sl ? '50 % po številu' : '50 % by count']].map(([a, b, c]) => (
          <div key={a} className="rounded-xl p-4" style={{ backgroundColor: '#fbfbfb', border: `1px solid ${FAINT}` }}>
            <div className="text-[13px]" style={{ color: MUTED }}>{a}</div>
            <div className="text-[24px] font-medium mt-1 tabular-nums">{b}</div>
            <div className="text-[12px] mt-0.5" style={{ color: MUTED }}>{c}</div>
          </div>
        ))}
      </div>
      <div className="text-[13px] font-medium mb-3">{sl ? 'Uspešnost po prodajnih kanalih' : 'Win rate by sales channel'}</div>
      {[[sl ? 'Priporočilo' : 'Referral', 100, '2.154 €'], ['Google', 50, '1.213 €'], ['Instagram', 33, '3.288 €'], ['Facebook', 0, '—']].map(([n, v, m]) => (
        <div key={n as string} className="flex items-center gap-3 py-1.5 text-[13px]">
          <span className="w-24 shrink-0 truncate font-medium">{n}</span>
          <span className="flex-1 h-2.5 rounded-full" style={{ backgroundColor: '#f4f4f5' }}>
            <span className="block h-2.5 rounded-full" style={{ width: `${Math.max(Number(v), 2)}%`, backgroundColor: Number(v) === 100 ? BLUE : '#93c5fd' }} />
          </span>
          <span className="w-12 text-right tabular-nums font-medium">{v} %</span>
          <span className="w-16 text-right tabular-nums" style={{ color: MUTED }}>{m}</span>
        </div>
      ))}
    </div>
  )

  const stats = [
    { n: '15', l: sl ? 'korakov konfiguratorja, od izdelka do senčil' : 'configurator steps, from product to shading' },
    { n: '4', l: sl ? 'načini objave: s cenami ali brez, povpraševanje ali PDF' : 'ways to publish: with or without prices, enquiry or PDF' },
    { n: '1', l: sl ? 'cenik za konfigurator in za ponudbe' : 'price list for the configurator and the quotes' },
  ]

  const before = sl
    ? ['Povpraševanje pride kot e-pošta z opisom', 'Ponudbo tipkate v Word ali Excel', 'Cene po občutku in iz starih ponudb', 'Kje je katera ponudba, veste le vi']
    : ['The enquiry arrives as an e-mail with a description', 'You type the quote into Word or Excel', 'Prices from memory and from old quotes', 'Only you know where each quote stands']
  const after = sl
    ? ['Povpraševanje pride kot skonfigurirana okna', 'Ponudba nastane iz povpraševanja', 'Cene iz vašega cenika, z vašo maržo', 'Tabla po statusih in zgodovina vsake spremembe']
    : ['The enquiry arrives as configured windows', 'The quote is built from the enquiry', 'Prices from your list, with your margin', 'A board by status and a history of every change']

  const grid = [
    { icon: MonitorSmartphone, t: sl ? 'Konfigurator na vaši povezavi' : 'A configurator at your link', d: sl ? 'Svoja stran z vašim logotipom in barvo, ki jo dodate na obstoječo spletno stran.' : 'Its own page with your logo and colour, added to your existing site.' },
    { icon: Ruler, t: sl ? 'Mere in odpiranje po krilih' : 'Sizes and opening per sash', d: sl ? 'Širine kril, nadsvetloba, fiksna polja, kip, odpiranje, drsna okna in strešna okna.' : 'Sash widths, top lights, fixed fields, tilt, turn, sliding and roof windows.' },
    { icon: Calculator, t: sl ? 'Kalkulacija iz osnovnih podatkov' : 'A calculation from the base data', d: sl ? 'Profili po metru, steklo po m², okovje po krilu, delo in marža — vsaka vrstica razložena.' : 'Profiles per metre, glass per m², hardware per sash, labour and margin — every line explained.' },
    { icon: FileText, t: sl ? 'PDF ponudba z risbami' : 'A PDF quote with drawings', d: sl ? 'Vsaka pozicija z risbo, merami, izbirami in ceno, v vaši glavi dokumenta.' : 'Every position with a drawing, sizes, choices and price, under your letterhead.' },
    { icon: History, t: sl ? 'Zgodovina vsake ponudbe' : 'A history on every quote', d: sl ? 'Kdo je kaj spremenil in kdaj. Zapisa ni mogoče urediti ali izbrisati.' : 'Who changed what and when. The record cannot be edited or deleted.' },
    { icon: BarChart3, t: sl ? 'Poročila po kanalih' : 'Reports by channel', d: sl ? 'Uspešnost zaključenih ponudb po kanalu, vrednost po skupinah izdelkov, primerjava obdobij.' : 'Win rate per channel, value by product group, a comparison of periods.' },
    { icon: Users, t: sl ? 'Stranke in uporabniki' : 'Customers and users', d: sl ? 'Podjetja in fizične osebe, odgovorne osebe, pravice po modulih.' : 'Companies and private customers, assignees, permissions per module.' },
    { icon: Layers, t: sl ? 'Strešna okna kot katalog' : 'Roof windows as a catalogue', d: sl ? 'Modeli, mere, obrobe in montažne storitve na kos, s prodajnimi cenami.' : 'Models, sizes, flashings and per-piece installation, at sale prices.' },
    { icon: Globe, t: sl ? 'Slovensko in angleško' : 'Slovenian and English', d: sl ? 'Aplikacija, konfigurator in ponudbe v obeh jezikih.' : 'The app, the configurator and the quotes in both languages.' },
  ]

  const faq = [
    { q: sl ? 'Ali moram zamenjati spletno stran?' : 'Do I need to replace my website?',
      a: sl ? 'Ne. Konfigurator je svoja stran na povezavi, ki jo objavite — dodate jo kot gumb na obstoječo stran.' : 'No. The configurator is its own page at a link you publish — you add it as a button on your existing site.' },
    { q: sl ? 'Ali stranka vidi moje cene?' : 'Does the customer see my prices?',
      a: sl ? 'Samo če tako izberete. Štiri različice: s cenami ali brez, s povpraševanjem ali s takojšnjo ponudbo v PDF.' : 'Only if you choose so. Four variants: with or without prices, ending in an enquiry or an instant PDF.' },
    { q: sl ? 'Kako vem, da je cena pravilna?' : 'How do I know the price is right?',
      a: sl ? 'Pri vsaki postavki piše, iz katerih dolžin, površin in cen je sestavljena, zato jo lahko preverite na papirju.' : 'Every line shows the lengths, areas and prices behind it, so you can check it on paper.' },
    { q: sl ? 'Kje so moji podatki?' : 'Where is my data?',
      a: sl ? 'V oblačni bazi v Evropski uniji, ločeno po podjetjih, z nočno varnostno kopijo.' : 'In a cloud database in the European Union, separated per company, with a nightly backup.' },
  ]

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT, color: INK }}>
      {/* ── green top: navbar, hero, numbers ───────────────────────────── */}
      <div className="relative overflow-hidden" style={{ backgroundColor: DARK }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(1000px 500px at 78% 10%, rgba(161,237,134,0.16), rgba(7,41,40,0) 72%)' }} />

        <div className="sticky top-0 z-40 px-4 sm:px-6 pt-4">
          <div className="max-w-[1320px] mx-auto rounded-2xl bg-white/95 backdrop-blur shadow-[0_10px_30px_-12px_rgba(4,24,24,0.35)]">
            <div className="h-14 sm:h-16 pl-4 pr-3 sm:pl-6 sm:pr-4 flex items-center justify-between gap-3">
              <Link to="/" className="shrink-0"><AppLogo size="md" showName /></Link>
              <div className="flex items-center gap-1 sm:gap-2">
                <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')} className="h-9 px-3 rounded-lg text-sm font-medium transition-colors hover:bg-black/5">{sl ? 'EN' : 'SL'}</button>
                <Link to="/login" className="h-9 px-3 inline-flex items-center rounded-lg text-sm font-medium transition-colors hover:bg-black/5">{sl ? 'Prijava' : 'Log in'}</Link>
                <Cta to="/register" tone="ink" small>{sl ? 'Preizkusite' : 'Try it'}</Cta>
              </div>
            </div>
          </div>
        </div>

        <section className="relative max-w-[1320px] mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-14 sm:pb-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16 lg:items-center">
            <div>
              <Eyebrow on="dark">{sl ? 'Za ponudnike oken' : 'For window suppliers'}</Eyebrow>
              <h1 className="mt-5 text-[40px] leading-[1.05] sm:text-[52px] lg:text-[60px] lg:leading-[1.05] font-medium tracking-[-0.025em]" style={{ color: ON_DARK }}>
                {sl ? <>Konfigurator oken,<br />ki piše ponudbe</> : <>A window configurator<br />that writes the quotes</>}
              </h1>
              <p className="mt-6 text-[18px] leading-7 sm:text-[20px] sm:leading-8" style={{ color: ON_DARK_MUTED }}>
                {sl ? 'Stranka na vaši spletni strani sama sestavi okno in odda povpraševanje. Pri vas se odpre kot skonfigurirana ponudba — pregledate, popravite, izdate.'
                    : 'On your website the customer builds the window and sends an enquiry. It opens on your side as a configured quote — you review it, adjust it, issue it.'}
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
                <a href="#kalkulacija" className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium border transition-colors hover:bg-white/5"
                  style={{ borderColor: 'rgba(223,249,249,0.28)', color: ON_DARK }}>
                  {sl ? 'Poglejte kalkulacijo' : 'See the calculation'}<ArrowUpRight className="w-[18px] h-[18px]" />
                </a>
              </div>
              {/* the small strip of facts, the way the reference puts its ratings under the button */}
              <div className="mt-8 inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-4 py-2.5" style={{ backgroundColor: 'rgba(223,249,249,0.07)' }}>
                {(sl ? ['Brez namestitve', 'Brez kartice', 'Podatki v EU'] : ['No installation', 'No card', 'Data in the EU']).map((x, i) => (
                  <span key={x} className="flex items-center gap-2 text-[13px]" style={{ color: ON_DARK }}>
                    {i > 0 && <span className="w-px h-4 -ml-3 mr-1" style={{ backgroundColor: 'rgba(223,249,249,0.18)' }} />}
                    <Check className="w-3.5 h-3.5" style={{ color: LIME }} />{x}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <PositionCard />
              <div className="hidden sm:flex absolute -top-4 -left-6 items-center gap-2 h-9 px-3.5 rounded-full bg-white text-[13px] font-medium shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BLUE }} />{sl ? 'Povpraševanje oddano' : 'Enquiry sent'}
              </div>
              <div className="hidden sm:flex absolute -bottom-5 -right-4 items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: LIME, color: INK }}>
                <Check className="w-3.5 h-3.5" />{sl ? 'Ponudba izdana' : 'Quote issued'}
              </div>
            </div>
          </div>

          {/* numbers */}
          <div className="mt-16 sm:mt-24 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {stats.map((s, i) => (
              <div key={s.n} className={i > 0 ? 'sm:pl-10 sm:border-l' : ''} style={i > 0 ? { borderColor: 'rgba(223,249,249,0.16)' } : undefined}>
                <div className="flex items-baseline gap-3">
                  <span className="text-[56px] leading-none font-medium tracking-[-0.03em]" style={{ color: LIME }}>{s.n}</span>
                  <span className="text-[15px] leading-6 max-w-[220px]" style={{ color: ON_DARK_MUTED }}>{s.l}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── before / with ──────────────────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>{sl ? 'Zakaj Fenestio' : 'Why Fenestio'}</Eyebrow>
          <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[44px] sm:leading-[1.15] font-medium tracking-[-0.02em]">
            {sl ? 'Ista ponudba, dve poti' : 'The same quote, two ways'}
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] p-7 sm:p-8" style={{ backgroundColor: '#f4f4f5', borderTop: '3px solid rgba(4,24,24,0.2)' }}>
            <h3 className="text-[24px] font-medium tracking-[-0.01em]">{sl ? 'Brez' : 'Before'}</h3>
            <ul className="mt-5 space-y-3">
              {before.map(x => (
                <li key={x} className="flex items-start gap-3 text-[16px] leading-7" style={{ color: MUTED }}>
                  <X className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: 'rgba(4,24,24,0.35)' }} />{x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[24px] p-7 sm:p-8" style={{ backgroundColor: PANEL, borderTop: `3px solid ${GREEN}` }}>
            <h3 className="text-[24px] font-medium tracking-[-0.01em]">{sl ? 'S Fenestiom' : 'With Fenestio'}</h3>
            <ul className="mt-5 space-y-3">
              {after.map(x => (
                <li key={x} className="flex items-start gap-3 text-[16px] leading-7">
                  <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── the calculation ────────────────────────────────────────────── */}
      <section id="kalkulacija" style={{ backgroundColor: PANEL }}>
        <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24 grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-center">
          <div>
            <Tag>{sl ? 'Kalkulacija' : 'The calculation'}</Tag>
            <h2 className="mt-5 text-[30px] leading-[1.15] sm:text-[40px] sm:leading-[1.15] font-medium tracking-[-0.02em]">
              {sl ? 'Vsaka številka pove, od kod je' : 'Every number says where it came from'}
            </h2>
            <p className="mt-5 text-[17px] leading-7 sm:text-[18px] sm:leading-8" style={{ color: MUTED }}>
              {sl ? 'Cena okna ni črna skrinjica. Pri vsaki postavki vidite dolžino, površino in ceno, iz katerih je sestavljena — profile po metru, steklo po m², okovje po krilu in delo.'
                  : 'The price of a window is not a black box. Every line shows the length, the area and the price behind it — profiles per metre, glass per m², hardware per sash and labour.'}
            </p>
          </div>
          <CalcCard />
        </div>
      </section>

      {/* ── the board and the history ──────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24 grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center">
        <BoardCard />
        <div>
          <Tag>{sl ? 'Ponudbe' : 'Quotes'}</Tag>
          <h2 className="mt-5 text-[30px] leading-[1.15] sm:text-[40px] sm:leading-[1.15] font-medium tracking-[-0.02em]">
            {sl ? 'Vidite, kje stoji vsaka ponudba' : 'See where every quote stands'}
          </h2>
          <p className="mt-5 text-[17px] leading-7 sm:text-[18px] sm:leading-8" style={{ color: MUTED }}>
            {sl ? 'Povpraševanje, osnutek, izdano, poslano, preneseno, izmera, pridobljeno, izgubljeno. Ponudbo premaknete z vlečenjem, vsaka sprememba pa se zapiše v zgodovino, ki je ni mogoče urediti.'
                : 'Enquiry, draft, issued, sent, downloaded, measurement, won, lost. You drag a quote to the next status, and every change is written into a history that cannot be edited.'}
          </p>
        </div>
      </section>

      {/* ── reports ────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: PANEL }}>
        <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24 grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-center">
          <div>
            <Tag>{sl ? 'Poročila' : 'Reports'}</Tag>
            <h2 className="mt-5 text-[30px] leading-[1.15] sm:text-[40px] sm:leading-[1.15] font-medium tracking-[-0.02em]">
              {sl ? 'Kateri kanal vam prinese posle' : 'Which channel brings the jobs'}
            </h2>
            <p className="mt-5 text-[17px] leading-7 sm:text-[18px] sm:leading-8" style={{ color: MUTED }}>
              {sl ? 'Koliko ponudb prinese posamezen prodajni kanal in kolikšen delež zaključenih ste po njem dobili. Zraven vrednost po skupinah izdelkov in primerjava s prejšnjim obdobjem.'
                  : 'How many quotes each sales channel brings and the share of its decided quotes you won. Alongside it, value by product group and a comparison with the period before.'}
            </p>
          </div>
          <ReportCard />
        </div>
      </section>

      {/* ── everything inside ──────────────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>{sl ? 'Kaj je notri' : 'What is inside'}</Eyebrow>
          <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[44px] sm:leading-[1.15] font-medium tracking-[-0.02em]">
            {sl ? 'Vse od povpraševanja do naročila' : 'Everything from the enquiry to the order'}
          </h2>
        </div>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map(g => (
            <div key={g.t} className="pl-5 border-l" style={{ borderColor: FAINT }}>
              <g.icon className="w-5 h-5" style={{ color: INK }} strokeWidth={1.6} />
              <h3 className="mt-3.5 text-[17px] leading-6 font-medium tracking-[-0.01em]">{g.t}</h3>
              <p className="mt-1.5 text-[15px] leading-6" style={{ color: MUTED }}>{g.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── pricing ────────────────────────────────────────────────────── */}
      <section id="cena" style={{ backgroundColor: PANEL }}>
        <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <Eyebrow>{sl ? 'Cena' : 'Pricing'}</Eyebrow>
            <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[44px] sm:leading-[1.15] font-medium tracking-[-0.02em]">
              {sl ? 'Dogovorimo se za vaše podjetje' : 'Agreed for your company'}
            </h2>
            <p className="mt-5 text-[17px] leading-7 sm:text-[18px]" style={{ color: MUTED }}>
              {sl ? 'Fenestio je v beta obdobju. Ceno postavimo glede na velikost ekipe in obseg cenika, račun prejmete mesečno.'
                  : 'Fenestio is in beta. The price follows the size of your team and your price list, and you are invoiced monthly.'}
            </p>
          </div>
          <div className="mt-10 mx-auto max-w-2xl rounded-[24px] bg-white p-7 sm:p-8" style={{ border: `1px solid ${FAINT}` }}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(sl ? ['Neomejeno število ponudb', 'Konfigurator na vaši povezavi', 'Pomoč pri vnosu cenika', 'Brez vezave', 'Podatki v EU', 'Nočna varnostna kopija']
                   : ['Unlimited quotes', 'A configurator at your own link', 'Help setting up the price list', 'No lock-in', 'Data in the EU', 'Nightly backup']
              ).map(x => (
                <li key={x} className="flex items-start gap-2.5 text-[16px] leading-7">
                  <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
              <a href="mailto:info@bimetric.si" className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium border transition-colors hover:bg-[#fafafa]"
                style={{ borderColor: 'rgba(4,24,24,0.18)', color: INK }}>{sl ? 'Pišite nam' : 'Talk to us'}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── faq ────────────────────────────────────────────────────────── */}
      <section className="max-w-[1320px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <Eyebrow>{sl ? 'Pogosta vprašanja' : 'Frequently asked'}</Eyebrow>
        <div className="mt-8 grid gap-x-14 gap-y-8 sm:grid-cols-2">
          {faq.map(f => (
            <div key={f.q} className="pt-6 border-t" style={{ borderColor: FAINT }}>
              <h3 className="text-[19px] leading-7 font-medium tracking-[-0.01em]">{f.q}</h3>
              <p className="mt-2 text-[16px] leading-7" style={{ color: MUTED }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── closing call ───────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-[1320px] mx-auto rounded-[24px] px-6 py-14 sm:px-12 sm:py-20 text-center relative overflow-hidden" style={{ backgroundColor: DARK, color: ON_DARK }}>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(700px 320px at 50% 0%, rgba(161,237,134,0.18), rgba(7,41,40,0) 70%)' }} />
          <div className="relative">
            <h2 className="text-[30px] leading-[1.15] sm:text-[44px] sm:leading-[1.16] font-medium tracking-[-0.02em] max-w-2xl mx-auto">
              {sl ? 'Naj stranke konfigurirajo, vi pa izdajate' : 'Let customers configure, and you issue'}
            </h2>
            <p className="mt-4 text-[17px] leading-7 sm:text-[18px] max-w-xl mx-auto" style={{ color: ON_DARK_MUTED }}>
              {sl ? 'Postavite cenik, objavite konfigurator in prvo ponudbo izdate še danes.' : 'Set up the price list, publish the configurator and issue your first quote today.'}
            </p>
            <div className="mt-8 flex justify-center"><Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta></div>
          </div>
        </div>
      </section>

      {/* ── footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: FAINT }}>
        <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
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
