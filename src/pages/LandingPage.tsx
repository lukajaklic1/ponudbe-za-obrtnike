// The public one-pager for Fenestio.
//
// Green at the top: the hero stands on the deep green band, with a floating white navbar over it
// that carries only the logo and the actions — no menu in the middle. Everything below alternates
// between white and the light blue card colour, and every claim is shown with a real screen of the
// app rather than described. Tokens are the ones measured off the reference: ink #041818,
// band #072928, lime #a1ed86, call to action #81de60, 8px buttons, 24px cards, Inter Tight.
import '@fontsource-variable/inter-tight'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check } from 'lucide-react'
import AppLogo from '../components/ui/AppLogo'
import { useLanguage } from '../hooks/useLanguage'

const INK = '#041818'
const MUTED = 'rgba(4,24,24,0.66)'
const DARK = '#072928'
const ON_DARK = '#dff9f9'
const ON_DARK_MUTED = 'rgba(223,249,249,0.70)'
const LIME = '#a1ed86'
const GREEN = '#81de60'
const CARD = '#eef4fd'
const FONT = "'Inter Tight Variable', Inter, ui-sans-serif, system-ui, sans-serif"

function Eyebrow({ children, on = 'light' }: { children: React.ReactNode; on?: 'light' | 'dark' }) {
  return <p className="text-[13px] font-medium uppercase" style={{ letterSpacing: '1.5px', color: on === 'dark' ? LIME : MUTED }}>{children}</p>
}

function Cta({ to, children, tone = 'green', small = false }: { to: string; children: React.ReactNode; tone?: 'green' | 'ink' | 'white'; small?: boolean }) {
  const style = tone === 'green' ? { backgroundColor: GREEN, color: INK }
    : tone === 'white' ? { backgroundColor: '#ffffff', color: INK }
    : { backgroundColor: INK, color: '#ffffff' }
  return (
    <Link to={to} style={style}
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-opacity hover:opacity-90 ${small ? 'h-9 pl-4 pr-3 text-sm' : 'h-12 pl-6 pr-5 text-[16px]'}`}>
      {children}<ArrowUpRight className={small ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
    </Link>
  )
}

/** a screen of the app, framed the way a product shot should be */
function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-[20px] overflow-hidden bg-white shadow-[0_30px_70px_-30px_rgba(4,24,24,0.45)] ${className}`}
      style={{ border: '1px solid rgba(4,24,24,0.08)' }}>
      <div className="h-8 flex items-center gap-1.5 px-4 border-b" style={{ borderColor: 'rgba(4,24,24,0.06)', backgroundColor: '#fbfbfb' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />)}
      </div>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </div>
  )
}

export default function LandingPage() {
  const { lang, setLang } = useLanguage()
  const sl = lang === 'sl'

  const facts = [
    { k: sl ? '15 korakov' : '15 steps', v: sl ? 'konfiguracije okna, od profila do senčil' : 'of window configuration, from profile to shading' },
    { k: sl ? 'Vaš cenik' : 'Your price list', v: sl ? 'profili po metru, steklo po m², okovje po krilu' : 'profiles per metre, glass per m², hardware per sash' },
    { k: sl ? 'Podatki v EU' : 'Data in the EU', v: sl ? 'ločeno po podjetjih, z nočno varnostno kopijo' : 'separated per company, with a nightly backup' },
  ]

  const blocks = [
    {
      eyebrow: sl ? 'Spletni konfigurator' : 'Online configurator',
      title: sl ? 'Stranka sestavi okno, vi dobite povpraševanje' : 'The customer builds the window, you get the enquiry',
      text: sl ? 'Konfigurator je svoja stran na povezavi, ki jo objavite. Stranka izbere izdelek, profil, barvo, steklo, mere, odpiranje, okovje in senčila — vse po vašem ceniku in z vašim logotipom.'
               : 'The configurator is its own page at a link you publish. The customer picks the product, profile, colour, glass, sizes, opening, hardware and shading — all from your price list, under your logo.',
      bullets: sl ? ['S cenami ali brez — izberete sami', 'Povpraševanje ali takojšnja ponudba v PDF', 'Deluje na telefonu'] : ['With or without prices — your choice', 'An enquiry or an instant PDF offer', 'Works on a phone'],
      shot: '/marketing/konfigurator.jpg', alt: sl ? 'Spletni konfigurator oken' : 'The online window configurator',
    },
    {
      eyebrow: sl ? 'Ponudbe' : 'Quotes',
      title: sl ? 'Povpraševanje se odpre kot ponudba, ne kot e-pošta' : 'An enquiry opens as a quote, not as an e-mail',
      text: sl ? 'Okna pridejo skonfigurirana — z risbo, merami in izbirami, ki jih lahko popravite. Ponudbo izdate, pošljete in jo spremljate po statusih do naročila.'
               : 'The windows arrive configured — with a drawing, sizes and choices you can still change. You issue the quote, send it and follow it through the statuses to the order.',
      bullets: sl ? ['Tabla po statusih ali seznam', 'Zgodovina vsake spremembe', 'PDF z risbo vsake pozicije'] : ['A board by status, or a list', 'A history of every change', 'A PDF with a drawing of each position'],
      shot: '/marketing/ponudbe.jpg', alt: sl ? 'Ponudbe po statusih' : 'Quotes by status',
    },
    {
      eyebrow: sl ? 'Poročila' : 'Reports',
      title: sl ? 'Vidite, kaj je odprto in kateri kanal prinese posle' : 'See what is open and which channel brings the jobs',
      text: sl ? 'Odprte, dobljene in izgubljene ponudbe, uspešnost zaključenih po prodajnih kanalih, vrednost po skupinah izdelkov in primerjava s prejšnjim obdobjem.'
               : 'Open, won and lost quotes, the win rate of decided quotes per sales channel, value by product group and a comparison with the period before.',
      bullets: sl ? ['Po dnevih, tednih ali mesecih', 'Filtri za celo stran', 'Tabela strank z uspešnostjo'] : ['By day, week or month', 'Filters for the whole page', 'A customer table with win rates'],
      shot: '/marketing/porocila.jpg', alt: sl ? 'Poročila' : 'Reports',
    },
  ]

  const faq = [
    { q: sl ? 'Ali moram zamenjati spletno stran?' : 'Do I need to replace my website?',
      a: sl ? 'Ne. Konfigurator je svoja stran na povezavi, ki jo objavite — dodate jo kot gumb na obstoječo stran.' : 'No. The configurator is its own page at a link you publish — you add it as a button on your existing site.' },
    { q: sl ? 'Ali stranka vidi moje cene?' : 'Does the customer see my prices?',
      a: sl ? 'Samo če tako izberete. Štiri različice: s cenami ali brez, s povpraševanjem ali s takojšnjo ponudbo v PDF.' : 'Only if you choose so. Four variants: with or without prices, ending in an enquiry or an instant PDF.' },
    { q: sl ? 'Kaj pa strešna okna in senčila?' : 'What about roof windows and shading?',
      a: sl ? 'Strešna okna so katalog z merami, obrobami in montažo na kos. Senčila in komarniki so del konfiguracije okna.' : 'Roof windows are a catalogue with sizes, flashings and per-piece installation. Shading and screens are part of the window.' },
    { q: sl ? 'Koliko stane?' : 'What does it cost?',
      a: sl ? 'Fenestio je v beta obdobju — ceno postavimo glede na velikost ekipe in obseg cenika, račun prejmete mesečno, brez vezave.' : 'Fenestio is in beta — the price follows the size of your team and your price list, invoiced monthly, with no lock-in.' },
  ]

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT, color: INK }}>
      {/* ── the green top: navbar and hero stand on the band ───────────── */}
      <div className="relative" style={{ backgroundColor: DARK }}>
        {/* a soft light sitting behind the product shot */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(900px 420px at 72% 18%, rgba(161,237,134,0.18), rgba(7,41,40,0) 70%)' }} />

        {/* floating navbar: the logo and the actions, nothing in between */}
        <div className="sticky top-0 z-40 px-4 sm:px-6 pt-4">
          <div className="max-w-[1180px] mx-auto rounded-2xl bg-white/95 backdrop-blur shadow-[0_10px_30px_-12px_rgba(4,24,24,0.35)]">
            <div className="h-14 sm:h-16 pl-4 pr-3 sm:pl-6 sm:pr-4 flex items-center justify-between gap-3">
              <Link to="/" className="shrink-0"><AppLogo size="md" showName /></Link>
              <div className="flex items-center gap-1 sm:gap-2">
                <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')}
                  className="h-9 px-3 rounded-lg text-sm font-medium transition-colors hover:bg-black/5" style={{ color: INK }}>
                  {sl ? 'EN' : 'SL'}
                </button>
                <Link to="/login" className="h-9 px-3 inline-flex items-center rounded-lg text-sm font-medium transition-colors hover:bg-black/5" style={{ color: INK }}>
                  {sl ? 'Prijava' : 'Log in'}
                </Link>
                <Cta to="/register" tone="ink" small>{sl ? 'Preizkusite' : 'Try it'}</Cta>
              </div>
            </div>
          </div>
        </div>

        {/* hero */}
        <section className="relative max-w-[1180px] mx-auto px-5 sm:px-6 pt-14 pb-0 sm:pt-20">
          <div className="max-w-3xl">
            <Eyebrow on="dark">{sl ? 'Za ponudnike oken' : 'For window suppliers'}</Eyebrow>
            <h1 className="mt-5 text-[40px] leading-[1.05] sm:text-[60px] lg:text-[72px] lg:leading-[1.04] font-medium tracking-[-0.025em]" style={{ color: ON_DARK }}>
              {sl ? <>Konfigurator oken,<br />ki piše ponudbe</> : <>A window configurator<br />that writes the quotes</>}
            </h1>
            <p className="mt-6 text-[18px] leading-7 sm:text-[21px] sm:leading-8 max-w-2xl" style={{ color: ON_DARK_MUTED }}>
              {sl
                ? 'Stranka na vaši spletni strani sama sestavi okno in odda povpraševanje. Pri vas se odpre kot skonfigurirana ponudba — pregledate, popravite, izdate.'
                : 'On your website the customer builds the window and sends an enquiry. It opens on your side as a configured quote — you review it, adjust it, issue it.'}
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
              <a href="#konfigurator" className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium border transition-colors hover:bg-white/5"
                style={{ borderColor: 'rgba(223,249,249,0.28)', color: ON_DARK }}>
                {sl ? 'Poglejte aplikacijo' : 'See the app'}<ArrowUpRight className="w-[18px] h-[18px]" />
              </a>
            </div>
            <p className="mt-4 text-sm" style={{ color: ON_DARK_MUTED }}>{sl ? 'Brez namestitve. Brez kartice.' : 'No installation. No card.'}</p>
          </div>

          <div className="relative z-10 mt-14 sm:mt-16 translate-y-[56px] sm:translate-y-[96px]">
            <Shot src="/marketing/porocila.jpg" alt={sl ? 'Poročila v aplikaciji' : 'Reports in the app'} />
          </div>
        </section>
      </div>

      {/* ── three facts, right under the band ──────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3 pt-[88px] pb-10 sm:pt-[136px] sm:pb-14">
          {facts.map(f => (
            <div key={f.k}>
              <p className="text-[22px] leading-7 font-medium tracking-[-0.01em]">{f.k}</p>
              <p className="mt-1.5 text-[15px] leading-6" style={{ color: MUTED }}>{f.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── what it does: a block per screen, alternating sides ─────────── */}
      {blocks.map((b, i) => (
        <section key={b.eyebrow} id={i === 0 ? 'konfigurator' : undefined} style={{ backgroundColor: i % 2 === 1 ? CARD : '#ffffff' }}>
          <div className="max-w-[1180px] mx-auto px-5 sm:px-6 py-16 sm:py-24 grid gap-10 lg:gap-16 lg:grid-cols-2 lg:items-center">
            <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
              <Eyebrow>{b.eyebrow}</Eyebrow>
              <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.14] font-medium tracking-[-0.02em]">{b.title}</h2>
              <p className="mt-5 text-[17px] leading-7 sm:text-[18px] sm:leading-8" style={{ color: MUTED }}>{b.text}</p>
              <ul className="mt-6 space-y-2.5">
                {b.bullets.map(x => (
                  <li key={x} className="flex items-start gap-3 text-[16px] leading-7">
                    <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                  </li>
                ))}
              </ul>
            </div>
            <div className={i % 2 === 1 ? 'lg:order-1' : ''}><Shot src={b.shot} alt={b.alt} /></div>
          </div>
        </section>
      ))}

      {/* ── the calculation, written out ───────────────────────────────── */}
      <section style={{ backgroundColor: DARK, color: ON_DARK }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 py-16 sm:py-24 grid gap-10 lg:gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow on="dark">{sl ? 'Kalkulacija' : 'The calculation'}</Eyebrow>
            <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.14] font-medium tracking-[-0.02em]">
              {sl ? 'Vsaka številka pove, od kod je' : 'Every number says where it came from'}
            </h2>
            <p className="mt-5 text-[17px] leading-7 sm:text-[18px] sm:leading-8" style={{ color: ON_DARK_MUTED }}>
              {sl ? 'Cena okna ni črna skrinjica. Pri vsaki postavki vidite dolžino, površino in ceno, iz katerih je sestavljena — in jo lahko preverite na papirju.'
                  : 'The price of a window is not a black box. Every line shows the length, the area and the price behind it — so you can check it on paper.'}
            </p>
          </div>
          <div className="rounded-[20px] bg-white p-5 sm:p-6 text-[13px] leading-6 tabular-nums shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]" style={{ color: INK }}>
            {[
              [sl ? 'Okvir' : 'Frame', '2×(1800+1400) = 6,4 m + 6 % ' + (sl ? 'odpadka' : 'waste'), '6,784 m', '105,15 €'],
              [sl ? 'Krila' : 'Sashes', '2×(805+1276)', '4,412 m', '78,31 €'],
              [sl ? 'Letvice' : 'Beads', '2×(649+1120) + 2×(789+1260)', '8,094 m', '31,36 €'],
              [sl ? 'Steklo' : 'Glass', '675×1146 + 815×1286 mm', '1,822 m²', '58,29 €'],
              [sl ? 'Okovje' : 'Hardware', '20,00 € + 1,00 €/m × 4,162 m', '1 ' + (sl ? 'kos' : 'pc'), '24,16 €'],
              [sl ? 'Delo' : 'Labour', '30 € + 22 € + 12 € + 8 €', '1 ' + (sl ? 'kos' : 'pc'), '72,00 €'],
            ].map(([a, b, c, d]) => (
              <div key={a} className="grid grid-cols-[84px_minmax(0,1fr)_auto] sm:grid-cols-[96px_minmax(0,1fr)_72px_72px] gap-x-3 py-1.5 border-b last:border-0" style={{ borderColor: 'rgba(4,24,24,0.07)' }}>
                <span className="font-medium">{a}</span>
                <span className="truncate" style={{ color: MUTED }}>{b}</span>
                <span className="hidden sm:block text-right" style={{ color: MUTED }}>{c}</span>
                <span className="text-right font-medium">{d}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 flex items-baseline justify-between border-t" style={{ borderColor: 'rgba(4,24,24,0.12)' }}>
              <span style={{ color: MUTED }}>{sl ? 'Nabavna vrednost' : 'Purchase value'}</span>
              <span className="text-[17px] font-medium">397,33 €</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span style={{ color: MUTED }}>{sl ? 'Prodajna cena z maržo' : 'Sale price with margin'}</span>
              <span className="text-[17px] font-medium">576,12 €</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── price list ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: CARD }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 py-16 sm:py-24 grid gap-10 lg:gap-16 lg:grid-cols-2 lg:items-center">
          <div className="lg:order-2">
            <Eyebrow>{sl ? 'Vaš cenik' : 'Your price list'}</Eyebrow>
            <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.14] font-medium tracking-[-0.02em]">
              {sl ? 'Nastavite ga enkrat, računa pa vsak dan' : 'Set it once, it prices every day'}
            </h2>
            <p className="mt-5 text-[17px] leading-7 sm:text-[18px] sm:leading-8" style={{ color: MUTED }}>
              {sl ? 'Skupine izdelkov, profili, barve, stekla, okovje, kljuke, police, senčila, strešna okna in storitve — z vašimi nabavnimi cenami in maržo. Konfigurator in ponudbe računajo iz istega cenika.'
                  : 'Product groups, profiles, colours, glass, hardware, handles, sills, shading, roof windows and services — with your purchase prices and margin. The configurator and the quotes price from the same list.'}
            </p>
          </div>
          <div className="lg:order-1"><Shot src="/marketing/cenik.jpg" alt={sl ? 'Cenik v aplikaciji' : 'The price list in the app'} /></div>
        </div>
      </section>

      {/* ── pricing ────────────────────────────────────────────────────── */}
      <section id="cena" className="max-w-[1180px] mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="text-center">
          <Eyebrow>{sl ? 'Cena' : 'Pricing'}</Eyebrow>
          <h2 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.14] font-medium tracking-[-0.02em]">
            {sl ? 'Dogovorimo se za vaše podjetje' : 'Agreed for your company'}
          </h2>
          <p className="mt-5 text-[17px] leading-7 sm:text-[18px] max-w-xl mx-auto" style={{ color: MUTED }}>
            {sl ? 'Fenestio je v beta obdobju. Ceno postavimo glede na velikost ekipe in obseg cenika, račun prejmete mesečno.'
                : 'Fenestio is in beta. The price follows the size of your team and your price list, and you are invoiced monthly.'}
          </p>
        </div>
        <div className="mt-10 mx-auto max-w-2xl rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: CARD }}>
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
            <a href="mailto:info@bimetric.si" className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium border transition-colors hover:bg-white"
              style={{ borderColor: 'rgba(4,24,24,0.18)', color: INK }}>{sl ? 'Pišite nam' : 'Talk to us'}</a>
          </div>
        </div>
      </section>

      {/* ── faq ────────────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
        <Eyebrow>{sl ? 'Pogosta vprašanja' : 'Frequently asked'}</Eyebrow>
        <div className="mt-8 grid gap-x-14 gap-y-8 sm:grid-cols-2">
          {faq.map(f => (
            <div key={f.q} className="pt-6 border-t" style={{ borderColor: 'rgba(4,24,24,0.12)' }}>
              <h3 className="text-[19px] leading-7 font-medium tracking-[-0.01em]">{f.q}</h3>
              <p className="mt-2 text-[16px] leading-7" style={{ color: MUTED }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── closing call ───────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-[1180px] mx-auto rounded-[24px] px-6 py-14 sm:px-12 sm:py-20 text-center relative overflow-hidden" style={{ backgroundColor: DARK, color: ON_DARK }}>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(600px 300px at 50% 0%, rgba(161,237,134,0.18), rgba(7,41,40,0) 70%)' }} />
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
