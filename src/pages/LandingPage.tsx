// The public page for Fenestio.
//
// Measured off the reference rather than guessed: sections breathe at 80–112px, the dominant radius
// is 24 (buttons 8, inner panels 16), shadows are blue-grey and soft — rgba(60,79,109,…), never
// black — the type ramp runs 64 / 40 / 24 / 20 / 17 / 15 at weight 500 for headings and 400 for
// text, and eyebrows are uppercase tracked 0.12em. Geist carries the public pages; the app keeps Inter.
//
// The navbar sits straight on the green with no box around it, and turns into a light bar once the
// page is scrolled past the hero. Pictures are real screens of Fenestio, captured one to one so they
// stay sharp; anything that would be unreadable at that size is drawn in markup instead.
import '@fontsource-variable/geist'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ArrowUpRight, Check, X, MonitorSmartphone, FileText, Calculator, BarChart3, History, Users,
  Ruler, Layers, Globe, ShieldCheck, Database, Lock, Pencil, Send, Trophy, Inbox, Download,
} from 'lucide-react'
import AppLogo from '../components/ui/AppLogo'
import WindowDrawing from '../components/WindowDrawing'
import { useLanguage } from '../hooks/useLanguage'

/* ── tokens ─────────────────────────────────────────────────────────── */
const INK = '#041818'
const MUTED = 'rgba(4,24,24,0.66)'
const HAIR = 'rgba(4,24,24,0.10)'
const DARK = '#072928'
const DARKER = '#041a1a'
const ON_DARK = '#dff9f9'
const ON_DARK_MUTED = 'rgba(223,249,249,0.70)'
const ON_DARK_HAIR = 'rgba(223,249,249,0.16)'
const LIME = '#a1ed86'
const GREEN = '#81de60'
const PANEL = '#eef4fd'
const SOFT = '#f4f3f0'        // warm neutral; the cold grey made the page feel sterile
const CARD = 'rounded-[20px] bg-white p-6 sm:p-7 transition-transform duration-200 hover:-translate-y-0.5'
const BLUE = '#266df0'
const SHADOW = '0 12px 40px rgba(60,79,109,0.10), 0 2px 8px rgba(60,79,109,0.05)'
const SHADOW_LIFT = '0 40px 90px rgba(0,0,0,0.45)'
const FONT = "'Geist Variable', Inter, ui-sans-serif, system-ui, sans-serif"

const WRAP = 'max-w-[1800px] mx-auto px-6 sm:px-10 lg:px-16'
const SECTION = 'py-20 sm:py-28'
const H2 = 'text-[30px] leading-[1.14] sm:text-[40px] sm:leading-[1.12] font-medium tracking-[-0.025em]'
const H3 = 'text-[20px] leading-7 sm:text-[24px] sm:leading-8 font-medium tracking-[-0.015em]'
const LEAD = 'text-[18px] leading-[1.6] sm:text-[20px] sm:leading-[1.55]'
const BODY = 'text-[16px] leading-[1.65] sm:text-[17px]'

function Eyebrow({ children, on = 'light' }: { children: React.ReactNode; on?: 'light' | 'dark' }) {
  return <p className="text-[13px] font-medium uppercase" style={{ letterSpacing: '0.12em', color: on === 'dark' ? LIME : MUTED }}>{children}</p>
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center h-7 px-3 rounded-full text-[12px] font-medium border bg-white" style={{ borderColor: HAIR, color: INK }}>{children}</span>
}

function Cta({ to, children, tone = 'green', small = false }: { to: string; children: React.ReactNode; tone?: 'green' | 'ink'; small?: boolean }) {
  const style = tone === 'green' ? { backgroundColor: GREEN, color: INK } : { backgroundColor: INK, color: '#ffffff' }
  return (
    <Link to={to} style={style}
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-[opacity,transform] hover:opacity-90 active:scale-[0.99] ${small ? 'h-9 pl-4 pr-3 text-sm' : 'h-12 pl-6 pr-5 text-[16px]'}`}>
      {children}<ArrowUpRight className={small ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
    </Link>
  )
}

function Ghost({ href, children, on = 'light' }: { href: string; children: React.ReactNode; on?: 'light' | 'dark' }) {
  return (
    <a href={href} className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium border transition-colors"
      style={on === 'dark' ? { borderColor: 'rgba(223,249,249,0.28)', color: ON_DARK } : { borderColor: 'rgba(4,24,24,0.18)', color: INK }}>
      {children}<ArrowUpRight className="w-[18px] h-[18px]" />
    </a>
  )
}

/** a real screen of the app: one hairline, one soft shadow, nothing else */
function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <figure className={`rounded-[24px] overflow-hidden bg-white ${className}`} style={{ border: `1px solid ${HAIR}`, boxShadow: SHADOW }}>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </figure>
  )
}

export default function LandingPage() {
  const { lang, setLang } = useLanguage()
  const sl = lang === 'sl'
  // the bar rides on the green while the hero is on screen, then turns light
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 120)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  /* ── drawn pieces of the interface ──────────────────────────────── */
  const PositionCard = () => (
    <div className="rounded-[24px] bg-white p-6 sm:p-7" style={{ border: `1px solid ${HAIR}`, boxShadow: SHADOW_LIFT }}>
      <div className="flex items-center justify-between text-[13px]" style={{ color: MUTED }}>
        <span className="font-medium" style={{ color: INK }}>{sl ? 'Pozicija 1' : 'Position 1'}</span>
        <span>1800 × 1400 mm</span>
      </div>
      <div className="my-6 flex justify-center"><WindowDrawing template="double_mullion" width={1800} height={1400} size={220} showDims /></div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[14px]">
        {[[sl ? 'Profil' : 'Profile', 'PVC 82 mm'], [sl ? 'Barva' : 'Colour', sl ? 'Antracit / bela' : 'Anthracite / white'],
          [sl ? 'Steklo' : 'Glass', 'Ug 0,7'], [sl ? 'Odpiranje' : 'Opening', sl ? 'Kip in odpiranje' : 'Tilt and turn']].map(([k, v]) => (
          <div key={k} className="contents"><dt style={{ color: MUTED }}>{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-6 pt-5 flex items-baseline justify-between border-t" style={{ borderColor: HAIR }}>
        <span className="text-[14px]" style={{ color: MUTED }}>{sl ? 'Cena pozicije' : 'Position price'}</span>
        <span className="text-[24px] font-medium tabular-nums tracking-[-0.02em]">1.284 €</span>
      </div>
    </div>
  )

  const CalcCard = ({ lifted = false }: { lifted?: boolean }) => (
    <div className="rounded-[24px] bg-white p-6 sm:p-8" style={{ border: `1px solid ${HAIR}`, boxShadow: lifted ? SHADOW_LIFT : SHADOW, color: INK }}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[15px] font-medium">{sl ? 'Kalkulacija pozicije' : 'Position calculation'}</span>
        <Tag>{sl ? 'Nabavne cene' : 'Purchase prices'}</Tag>
      </div>
      <div className="text-[14px] leading-6 tabular-nums">
        {[
          [sl ? 'Okvir' : 'Frame', '2×(1800+1400) = 6,4 m + 6 %', '6,784 m', '105,15 €'],
          [sl ? 'Steber' : 'Mullion', '1×1260', '1,336 m', '28,05 €'],
          [sl ? 'Krila' : 'Sashes', '2×(805+1276)', '4,412 m', '78,31 €'],
          [sl ? 'Letvice' : 'Beads', '2×(649+1120) + 2×(789+1260)', '8,094 m', '31,36 €'],
          [sl ? 'Steklo' : 'Glass', '675×1146 + 815×1286 mm', '1,822 m²', '58,29 €'],
          [sl ? 'Okovje' : 'Hardware', '20,00 € + 1,00 €/m × 4,162 m', '1 ' + (sl ? 'kos' : 'pc'), '24,16 €'],
          [sl ? 'Delo' : 'Labour', '30 € + 22 € + 12 € + 8 €', '1 ' + (sl ? 'kos' : 'pc'), '72,00 €'],
        ].map(([a, b, c, d]) => (
          <div key={a} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[100px_minmax(0,1fr)_82px_84px] gap-x-4 py-2 border-b last:border-0" style={{ borderColor: 'rgba(4,24,24,0.07)' }}>
            <span className="font-medium">{a}</span>
            <span className="hidden sm:block truncate" style={{ color: MUTED }}>{b}</span>
            <span className="hidden sm:block text-right" style={{ color: MUTED }}>{c}</span>
            <span className="text-right font-medium">{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-5 space-y-2 border-t text-[14px]" style={{ borderColor: HAIR }}>
        <div className="flex items-baseline justify-between"><span style={{ color: MUTED }}>{sl ? 'Nabavna vrednost' : 'Purchase value'}</span><span className="font-medium tabular-nums">397,33 €</span></div>
        <div className="flex items-baseline justify-between"><span style={{ color: MUTED }}>{sl ? 'Marža 45 %' : 'Margin 45 %'}</span><span className="font-medium tabular-nums">+ 178,79 €</span></div>
        <div className="flex items-baseline justify-between pt-2 border-t" style={{ borderColor: HAIR }}>
          <span className="font-medium">{sl ? 'Prodajna cena' : 'Sale price'}</span><span className="text-[20px] font-medium tabular-nums tracking-[-0.02em]">576,12 €</span>
        </div>
      </div>
    </div>
  )

  const HistoryCard = () => (
    <div className="rounded-[24px] bg-white p-6 sm:p-7" style={{ border: `1px solid ${HAIR}`, boxShadow: SHADOW }}>
      <div className="text-[15px] font-medium mb-4">{sl ? 'Zgodovina ponudbe' : 'Quote history'}</div>
      {[
        { i: Trophy, t: sl ? 'Status: Poslano → Pridobljeno' : 'Status: Sent → Won', s: '8.028 €', w: 'Janez Novak · 27. 11. ob 18:52', on: true },
        { i: Send, t: sl ? 'Status: Izdano → Poslano' : 'Status: Issued → Sent', s: '', w: 'Janez Novak · 26. 11. ob 09:14', on: false },
        { i: Pencil, t: sl ? 'Ponudba spremenjena in shranjena' : 'Quote edited and saved', s: '7.480 € → 8.028 €', w: 'Ana Zupan · 25. 11. ob 17:04', on: false },
        { i: Inbox, t: sl ? 'Povpraševanje prek konfiguratorja' : 'Enquiry via the configurator', s: '', w: sl ? 'Stranka · 24. 11. ob 22:08' : 'The customer · 24 Nov, 22:08', on: false },
      ].map(e => (
        <div key={e.t} className="flex gap-3.5 py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(4,24,24,0.07)' }}>
          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: e.on ? '#dbfce7' : SOFT }}>
            <e.i className="w-4 h-4" style={{ color: e.on ? '#267a47' : MUTED }} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">{e.t}{e.s && <span className="font-normal" style={{ color: MUTED }}> · {e.s}</span>}</p>
            <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>{e.w}</p>
          </div>
        </div>
      ))}
    </div>
  )

  const RateCard = () => (
    <div className="rounded-[24px] bg-white p-6 sm:p-8" style={{ border: `1px solid ${HAIR}`, boxShadow: SHADOW }}>
      <div className="text-[15px] font-medium">{sl ? 'Uspešnost zaključenih ponudb po kanalih' : 'Win rate of decided quotes by channel'}</div>
      <p className="text-[13px] mt-1 mb-5" style={{ color: MUTED }}>
        {sl ? 'Kanal, ki prinese veliko povpraševanj, ni nujno tisti, ki prinese posle.' : 'The channel that brings the most enquiries is not always the one that brings the jobs.'}
      </p>
      {[[sl ? 'Priporočilo' : 'Referral', 100, '3 ' + (sl ? 'od' : 'of') + ' 3', '12.154 €'],
        ['Google', 50, '2 ' + (sl ? 'od' : 'of') + ' 4', '6.213 €'],
        ['Instagram', 33, '1 ' + (sl ? 'od' : 'of') + ' 3', '3.288 €'],
        ['Facebook', 0, '0 ' + (sl ? 'od' : 'of') + ' 2', '—']].map(([n, v, c, m]) => (
        <div key={n as string} className="py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(4,24,24,0.07)' }}>
          <div className="flex items-baseline justify-between text-[14px]">
            <span className="font-medium">{n}</span><span className="tabular-nums font-medium">{v} %</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full" style={{ backgroundColor: '#f4f4f5' }}>
            <span className="block h-2.5 rounded-full" style={{ width: `${Math.max(Number(v), 2)}%`, backgroundColor: Number(v) === 100 ? BLUE : '#93c5fd' }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between text-[12px]" style={{ color: MUTED }}>
            <span>{c} {sl ? 'zaključenih' : 'decided'}</span><span className="tabular-nums">{m}</span>
          </div>
        </div>
      ))}
    </div>
  )

  /** the quote as the customer receives it */
  const PdfCard = () => (
    <div className="rounded-[24px] bg-white p-7 sm:p-9" style={{ border: `1px solid ${HAIR}`, boxShadow: SHADOW }}>
      <div className="flex items-start justify-between gap-6 pb-5 border-b" style={{ borderColor: HAIR }}>
        <div>
          <p className="text-[17px] font-medium">Okna Novak d.o.o.</p>
          <p className="text-[12px] mt-1" style={{ color: MUTED }}>Celovška cesta 120, 1000 Ljubljana · SI12345678</p>
        </div>
        <div className="text-right">
          <p className="text-[12px]" style={{ color: MUTED }}>{sl ? 'Ponudba' : 'Quote'}</p>
          <p className="text-[17px] font-medium tabular-nums">P-2026-0031</p>
        </div>
      </div>
      <div className="py-5 flex gap-5 border-b" style={{ borderColor: HAIR }}>
        <WindowDrawing template="double_mullion" width={1800} height={1400} size={96} />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-medium text-[14px]">{sl ? '1 · Dvokrilno okno s stebričkom' : '1 · Двое Double sash with mullion'}</p>
          <p className="mt-1" style={{ color: MUTED }}>1800 × 1400 mm · PVC 82 mm · {sl ? 'Antracit / bela' : 'Anthracite / white'} · Ug 0,7</p>
          <p className="mt-0.5" style={{ color: MUTED }}>{sl ? 'Kip in odpiranje levo, fiksno desno · roleta' : 'Tilt and turn left, fixed right · roller shutter'}</p>
        </div>
        <div className="text-right text-[14px] font-medium tabular-nums">1.284,00 €</div>
      </div>
      <div className="py-5 flex gap-5 border-b" style={{ borderColor: HAIR }}>
        <WindowDrawing template="tilt_turn" width={900} height={1400} size={96} />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-medium text-[14px]">{sl ? '2 · Enokrilno okno' : '2 · Single sash'}</p>
          <p className="mt-1" style={{ color: MUTED }}>900 × 1400 mm · PVC 82 mm · {sl ? 'Bela' : 'White'} · Ug 0,7</p>
          <p className="mt-0.5" style={{ color: MUTED }}>{sl ? 'Kip in odpiranje desno · notranja polica' : 'Tilt and turn right · inside sill'}</p>
        </div>
        <div className="text-right text-[14px] font-medium tabular-nums">612,40 €</div>
      </div>
      <dl className="mt-5 ml-auto max-w-[280px] text-[13px] tabular-nums space-y-1.5">
        <div className="flex justify-between"><dt style={{ color: MUTED }}>{sl ? 'Skupaj postavke' : 'Items'}</dt><dd>1.896,40 €</dd></div>
        <div className="flex justify-between"><dt style={{ color: MUTED }}>{sl ? 'Popust 5 %' : 'Discount 5 %'}</dt><dd>− 94,82 €</dd></div>
        <div className="flex justify-between"><dt style={{ color: MUTED }}>{sl ? 'DDV 22 %' : 'VAT 22 %'}</dt><dd>396,35 €</dd></div>
        <div className="flex justify-between pt-2 border-t text-[16px] font-medium" style={{ borderColor: HAIR }}>
          <dt>{sl ? 'Za plačilo' : 'Total'}</dt><dd>2.197,93 €</dd>
        </div>
      </dl>
    </div>
  )

  /* ── content ────────────────────────────────────────────────────── */
  const stats = [
    { n: '15', l: sl ? 'korakov konfiguratorja, od izdelka do senčil' : 'configurator steps, from product to shading' },
    { n: '4', l: sl ? 'načini objave: s cenami ali brez, povpraševanje ali PDF' : 'ways to publish: with or without prices, enquiry or PDF' },
    { n: '1', l: sl ? 'cenik za konfigurator in za ponudbe' : 'price list for the configurator and the quotes' },
  ]

  const audience = [
    { icon: Calculator, t: sl ? 'Proizvajalci oken' : 'Window makers', d: sl ? 'Profili po tekočem metru, okovje po krilu, delo in marža — kalkulacija kot v proizvodnji.' : 'Profiles per metre, hardware per sash, labour and margin — a calculation like the workshop does it.' },
    { icon: Ruler, t: sl ? 'Monterji in trgovci' : 'Fitters and dealers', d: sl ? 'Cenik dobavitelja z vašo maržo, montaža, odvoz in police kot storitve na ponudbi.' : 'Your supplier list with your margin, installation, disposal and sills as services on the quote.' },
    { icon: Users, t: sl ? 'Ekipe z več prodajalci' : 'Teams with several sellers', d: sl ? 'Vsaka ponudba ima odgovorno osebo, zgodovino sprememb in status, ki ga vidijo vsi.' : 'Every quote has an assignee, a history of changes and a status everyone can see.' },
  ]

  const statuses = [
    { i: Inbox, t: sl ? 'Povpraševanje' : 'Enquiry' }, { i: Pencil, t: sl ? 'Osnutek' : 'Draft' },
    { i: FileText, t: sl ? 'Izdano' : 'Issued' }, { i: Send, t: sl ? 'Poslano' : 'Sent' },
    { i: Download, t: sl ? 'Preneseno' : 'Downloaded' }, { i: Ruler, t: sl ? 'Izmera' : 'Measurement' },
    { i: Trophy, t: sl ? 'Pridobljeno' : 'Won' }, { i: X, t: sl ? 'Izgubljeno' : 'Lost' },
  ]

  const before = sl
    ? ['Povpraševanje pride kot e-pošta z opisom', 'Ponudbo tipkate v Word ali Excel', 'Cene po občutku in iz starih ponudb', 'Kje je katera ponudba, veste le vi', 'Spremembo cenika popravljate v vsaki datoteki posebej']
    : ['The enquiry arrives as an e-mail with a description', 'You type the quote into Word or Excel', 'Prices from memory and from old quotes', 'Only you know where each quote stands', 'A price change means editing every file']
  const after = sl
    ? ['Povpraševanje pride kot skonfigurirana okna', 'Ponudba nastane iz povpraševanja', 'Cene iz vašega cenika, z vašo maržo', 'Tabla po statusih in zgodovina vsake spremembe', 'Cenik popravite enkrat, velja povsod']
    : ['The enquiry arrives as configured windows', 'The quote is built from the enquiry', 'Prices from your list, with your margin', 'A board by status and a history of every change', 'Change the price list once, it applies everywhere']

  const steps = [
    { n: '01', t: sl ? 'Vnesete svoj cenik' : 'Enter your price list', d: sl ? 'Skupine izdelkov, profili, barve, stekla, okovje, kljuke, police, senčila in storitve — z nabavnimi cenami in maržo. Pri vnosu vam pomagamo.' : 'Product groups, profiles, colours, glass, hardware, handles, sills, shading and services — with purchase prices and margin. We help you enter it.' },
    { n: '02', t: sl ? 'Objavite konfigurator' : 'Publish the configurator', d: sl ? 'Povezavo dodate na svojo spletno stran. Izberete, ali stranka vidi cene in ali dobi ponudbo takoj ali odda povpraševanje.' : 'Add the link to your website. You choose whether the customer sees prices and whether they get the offer at once or send an enquiry.' },
    { n: '03', t: sl ? 'Izdajate ponudbe' : 'Issue the quotes', d: sl ? 'Povpraševanje pregledate, popravite pozicije, ponudbo izdate in jo spremljate po statusih do naročila.' : 'Review the enquiry, adjust the positions, issue the quote and follow it through the statuses to the order.' },
  ]

  const grid = [
    { icon: MonitorSmartphone, t: sl ? 'Konfigurator na vaši povezavi' : 'A configurator at your link', d: sl ? 'Svoja stran z vašim logotipom, barvo in kontakti, ki jo dodate na obstoječo spletno stran.' : 'Its own page with your logo, colour and contacts, added to your existing site.' },
    { icon: Ruler, t: sl ? 'Mere in odpiranje po krilih' : 'Sizes and opening per sash', d: sl ? 'Širine kril, nadsvetloba, spodnji del, fiksna polja, kip, odpiranje, drsna in strešna okna.' : 'Sash widths, top lights, bottom panels, fixed fields, tilt, turn, sliding and roof windows.' },
    { icon: Calculator, t: sl ? 'Kalkulacija iz osnovnih podatkov' : 'A calculation from the base data', d: sl ? 'Profili po metru, steklo po m², okovje po krilu, delo in marža — vsaka vrstica razložena.' : 'Profiles per metre, glass per m², hardware per sash, labour and margin — every line explained.' },
    { icon: FileText, t: sl ? 'PDF ponudba z risbami' : 'A PDF quote with drawings', d: sl ? 'Vsaka pozicija z risbo, merami, izbirami in ceno, v glavi vašega dokumenta.' : 'Every position with a drawing, sizes, choices and price, under your letterhead.' },
    { icon: History, t: sl ? 'Zgodovina vsake ponudbe' : 'A history on every quote', d: sl ? 'Kdo je kaj spremenil in kdaj. Zapisa ni mogoče urediti ali izbrisati.' : 'Who changed what and when. The record cannot be edited or deleted.' },
    { icon: BarChart3, t: sl ? 'Poročila po kanalih' : 'Reports by channel', d: sl ? 'Uspešnost zaključenih ponudb, vrednost po skupinah izdelkov, primerjava s prejšnjim obdobjem.' : 'Win rate of decided quotes, value by product group, a comparison with the period before.' },
    { icon: Users, t: sl ? 'Stranke in uporabniki' : 'Customers and users', d: sl ? 'Podjetja in fizične osebe, odgovorne osebe, pravice po modulih, vabila po e-pošti.' : 'Companies and private customers, assignees, permissions per module, e-mail invitations.' },
    { icon: Layers, t: sl ? 'Strešna okna kot katalog' : 'Roof windows as a catalogue', d: sl ? 'Modeli, mere, obrobe in montažne storitve na kos, s prodajnimi cenami brez marže.' : 'Models, sizes, flashings and per-piece installation, at sale prices without margin.' },
    { icon: Globe, t: sl ? 'Slovensko in angleško' : 'Slovenian and English', d: sl ? 'Aplikacija, konfigurator in ponudbe v obeh jezikih, z enim klikom.' : 'The app, the configurator and the quotes in both languages, one click apart.' },
  ]

  const security = [
    { icon: Database, t: sl ? 'Podatki v Evropski uniji' : 'Data in the European Union', d: sl ? 'Oblačna baza v EU, ločena po podjetjih — nihče ne vidi tujih ponudb ali cenikov.' : 'A cloud database in the EU, separated per company — nobody sees another company’s quotes or prices.' },
    { icon: ShieldCheck, t: sl ? 'Nočna varnostna kopija' : 'A nightly backup', d: sl ? 'Vsako noč se naredi kopija baze in se hrani zunaj nje, da podatki preživijo tudi napako.' : 'Every night a copy of the database is made and kept outside it, so the data survives a mistake too.' },
    { icon: Lock, t: sl ? 'Cene ostanejo pri vas' : 'Your prices stay yours', d: sl ? 'Konfigurator pošlje v brskalnik samo prodajne cene. Nabavne cene in marže ne zapustijo aplikacije.' : 'The configurator sends only sale prices to the browser. Purchase prices and margins never leave the app.' },
  ]

  const faq = [
    { q: sl ? 'Ali moram zamenjati spletno stran?' : 'Do I need to replace my website?',
      a: sl ? 'Ne. Konfigurator je svoja stran na povezavi, ki jo objavite — dodate jo kot gumb ali povezavo na obstoječo stran.' : 'No. The configurator is its own page at a link you publish — you add it as a button or a link on your existing site.' },
    { q: sl ? 'Ali stranka vidi moje cene?' : 'Does the customer see my prices?',
      a: sl ? 'Samo če tako izberete. Na voljo so štiri različice: s cenami ali brez, s povpraševanjem ali s takojšnjo ponudbo v PDF.' : 'Only if you choose so. Four variants: with or without prices, ending in an enquiry or an instant PDF offer.' },
    { q: sl ? 'Kako vem, da je cena pravilna?' : 'How do I know the price is right?',
      a: sl ? 'Pri vsaki postavki piše, iz katerih dolžin, površin in cen je sestavljena, zato jo lahko preverite na papirju.' : 'Every line shows the lengths, areas and prices behind it, so you can check it on paper.' },
    { q: sl ? 'Kaj pa strešna okna, senčila in police?' : 'What about roof windows, shading and sills?',
      a: sl ? 'Strešna okna so katalog z merami, obrobami in montažo na kos. Senčila, komarniki in police so del konfiguracije okna.' : 'Roof windows are a catalogue with sizes, flashings and per-piece installation. Shading, screens and sills are part of the window.' },
    { q: sl ? 'Koliko ljudi lahko dela v aplikaciji?' : 'How many people can work in it?',
      a: sl ? 'Kolikor jih potrebujete. Vsak ima svoj račun in pravice po modulih, vsaka ponudba pa odgovorno osebo.' : 'As many as you need. Everyone has their own account and permissions per module, and every quote has an assignee.' },
    { q: sl ? 'Kako začnem?' : 'How do I start?',
      a: sl ? 'Odprete račun, vnesete cenik in objavite konfigurator. Pri vnosu cenika vam pomagamo, da so prve ponudbe takoj prave.' : 'Open an account, enter your price list and publish the configurator. We help with the price list so the first quotes are right away correct.' },
  ]

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT, color: INK }}>
      {/* ══ navbar: on the green, then light ══════════════════════════ */}
      <header className="sticky top-0 z-40 transition-colors duration-300"
        style={scrolled
          ? { backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${HAIR}` }
          : { backgroundColor: 'transparent', borderBottom: '1px solid transparent' }}>
        <div className={`${WRAP} h-16 sm:h-20 flex items-center justify-between gap-4`}>
          <Link to="/" className="shrink-0"><AppLogo size="md" showName dark={!scrolled} /></Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')}
              className="h-10 px-3 rounded-lg text-[15px] font-medium transition-colors"
              style={{ color: scrolled ? INK : ON_DARK }}>{sl ? 'EN' : 'SL'}</button>
            <Link to="/login" className="h-10 px-3 inline-flex items-center rounded-lg text-[15px] font-medium transition-colors"
              style={{ color: scrolled ? INK : ON_DARK }}>{sl ? 'Prijava' : 'Log in'}</Link>
            <Cta to="/register" tone={scrolled ? 'ink' : 'green'} small>{sl ? 'Preizkusite' : 'Try it'}</Cta>
          </div>
        </div>
      </header>

      {/* ══ hero on the green ═════════════════════════════════════════ */}
      <div className="relative overflow-hidden -mt-16 sm:-mt-20 pt-16 sm:pt-20" style={{ backgroundColor: DARK }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(1200px 560px at 76% 6%, rgba(161,237,134,0.16), rgba(7,41,40,0) 72%)' }} />
        <section className={`relative ${WRAP} pt-16 sm:pt-20 pb-20 sm:pb-24`}>
          <div className="grid gap-14 lg:grid-cols-[minmax(0,660px)_minmax(0,1fr)] lg:gap-20 lg:items-center">
            <div>
              <Eyebrow on="dark">{sl ? 'Za ponudnike oken' : 'For window suppliers'}</Eyebrow>
              <h1 className="mt-6 text-[42px] leading-[1.04] sm:text-[58px] lg:text-[68px] lg:leading-[1.02] font-medium tracking-[-0.03em]" style={{ color: ON_DARK }}>
                {sl ? <>Konfigurator oken,<br />ki piše ponudbe</> : <>A window configurator<br />that writes the quotes</>}
              </h1>
              <p className={`mt-7 ${LEAD} max-w-[46ch]`} style={{ color: ON_DARK_MUTED }}>
                {sl ? 'Stranka na vaši spletni strani sama sestavi okno in odda povpraševanje. Pri vas se odpre kot skonfigurirana ponudba — pregledate, popravite, izdate.'
                    : 'On your website the customer builds the window and sends an enquiry. It opens on your side as a configured quote — you review it, adjust it, issue it.'}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
                <Ghost href="#konfigurator" on="dark">{sl ? 'Poglejte aplikacijo' : 'See the app'}</Ghost>
              </div>
              <div className="mt-9 inline-flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(223,249,249,0.07)' }}>
                {(sl ? ['Brez namestitve', 'Brez kartice', 'Podatki v EU'] : ['No installation', 'No card', 'Data in the EU']).map(x => (
                  <span key={x} className="flex items-center gap-2 text-[13px]" style={{ color: ON_DARK }}>
                    <Check className="w-3.5 h-3.5" style={{ color: LIME }} />{x}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative w-full max-w-[560px] lg:ml-auto">
              <PositionCard />
              <div className="hidden sm:flex absolute -top-5 -left-7 items-center gap-2 h-10 px-4 rounded-full bg-white text-[13px] font-medium" style={{ boxShadow: SHADOW_LIFT }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BLUE }} />{sl ? 'Povpraševanje oddano' : 'Enquiry sent'}
              </div>
              <div className="hidden sm:flex absolute -bottom-6 -right-5 items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium" style={{ backgroundColor: LIME, color: INK, boxShadow: SHADOW_LIFT }}>
                <Check className="w-3.5 h-3.5" />{sl ? 'Ponudba izdana · 1.284 €' : 'Quote issued · 1.284 €'}
              </div>
            </div>
          </div>

          <div className="mt-20 sm:mt-28 grid gap-10 sm:grid-cols-3 sm:gap-12">
            {stats.map((s, i) => (
              <div key={s.n} className={i > 0 ? 'sm:pl-12 sm:border-l' : ''} style={i > 0 ? { borderColor: ON_DARK_HAIR } : undefined}>
                <div className="flex items-baseline gap-4">
                  <span className="text-[60px] leading-none font-medium tracking-[-0.04em]" style={{ color: LIME }}>{s.n}</span>
                  <span className="text-[15px] leading-6 max-w-[24ch]" style={{ color: ON_DARK_MUTED }}>{s.l}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ══ four parts, as cards on the band ══════════════════════════ */}
      <section style={{ backgroundColor: DARK, color: ON_DARK }}>
        <div className={`${WRAP} pb-20 sm:pb-28`}>
          <div className="max-w-[46ch]">
            <Eyebrow on="dark">{sl ? 'Kaj dela Fenestio' : 'What Fenestio does'}</Eyebrow>
            <h2 className={`mt-5 ${H2}`}>{sl ? 'Štirje deli, en sam cenik' : 'Four parts, one price list'}</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: sl ? 'Konfigurator' : 'Configurator', d: sl ? 'Stranka sestavi okno na vaši strani, korak za korakom.' : 'The customer builds the window on your site, step by step.', k: 'win' },
              { t: sl ? 'Povpraševanja' : 'Enquiries', d: sl ? 'Pridejo kot skonfigurirana okna, ne kot opis v e-pošti.' : 'They arrive as configured windows, not as an e-mail.', k: 'chip' },
              { t: sl ? 'Ponudbe' : 'Quotes', d: sl ? 'Izdate, pošljete in spremljate po statusih do naročila.' : 'Issue, send and follow them through to the order.', k: 'status' },
              { t: sl ? 'Poročila' : 'Reports', d: sl ? 'Kaj je odprto, kaj dobljeno in kateri kanal prinese posle.' : 'What is open, what is won, which channel brings the jobs.', k: 'bars' },
            ].map(c => (
              <div key={c.t} className="rounded-[20px] p-6 flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: 'rgba(223,249,249,0.06)', border: `1px solid ${ON_DARK_HAIR}` }}>
                <div className="h-[72px] flex items-center">
                  {c.k === 'win' && <div className="flex items-end gap-2">
                    <WindowDrawing template="tilt_turn" width={900} height={1400} size={40} />
                    <WindowDrawing template="double_mullion" width={1800} height={1400} size={52} />
                    <WindowDrawing template="fixed" width={700} height={900} size={34} />
                  </div>}
                  {c.k === 'chip' && <div className="flex flex-wrap gap-2">
                    {[sl ? 'Novo povpraševanje' : 'New enquiry', sl ? '3 pozicije' : '3 positions', '2.405 €'].map(x => (
                      <span key={x} className="inline-flex items-center h-7 px-3 rounded-full text-[12px] font-medium" style={{ backgroundColor: 'rgba(223,249,249,0.10)' }}>{x}</span>
                    ))}
                  </div>}
                  {c.k === 'status' && <div className="w-full space-y-1.5">
                    {[[sl ? 'Poslano' : 'Sent', 70], [sl ? 'Izmera' : 'Measurement', 45], [sl ? 'Pridobljeno' : 'Won', 100]].map(([n, v]) => (
                      <div key={n as string} className="flex items-center gap-2.5 text-[12px]">
                        <span className="w-20 shrink-0 truncate" style={{ color: ON_DARK_MUTED }}>{n}</span>
                        <span className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(223,249,249,0.12)' }}>
                          <span className="block h-1.5 rounded-full" style={{ width: `${v}%`, backgroundColor: Number(v) === 100 ? LIME : 'rgba(223,249,249,0.45)' }} />
                        </span>
                      </div>
                    ))}
                  </div>}
                  {c.k === 'bars' && <div className="flex items-end gap-2 h-[56px]">
                    {[28, 44, 20, 56, 36, 48].map((h, i) => (
                      <span key={i} className="w-4 rounded-t-[3px]" style={{ height: h, backgroundColor: i === 3 ? LIME : 'rgba(223,249,249,0.22)' }} />
                    ))}
                  </div>}
                </div>
                <h3 className="mt-6 text-[18px] leading-6 font-medium tracking-[-0.01em]">{c.t}</h3>
                <p className="mt-2 text-[15px] leading-[1.6]" style={{ color: ON_DARK_MUTED }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ who it is for ═════════════════════════════════════════════ */}
      <section className={`${WRAP} ${SECTION}`}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20">
          <div>
            <Eyebrow>{sl ? 'Za koga je' : 'Who it is for'}</Eyebrow>
            <h2 className={`mt-5 ${H2}`}>{sl ? 'Za vse, ki prodajajo okna' : 'For everyone who sells windows'}</h2>
          </div>
          <div className="grid gap-x-14 gap-y-10 sm:grid-cols-3">
            {audience.map(a => (
              <div key={a.t} className="pl-6 border-l" style={{ borderColor: HAIR }}>
                <a.icon className="w-5 h-5" style={{ color: INK }} strokeWidth={1.5} />
                <h3 className="mt-4 text-[17px] leading-6 font-medium tracking-[-0.01em]">{a.t}</h3>
                <p className="mt-2 text-[15px] leading-[1.6]" style={{ color: MUTED }}>{a.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ before / with ═════════════════════════════════════════════ */}
      <section style={{ backgroundColor: SOFT }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="max-w-[46ch]">
            <Eyebrow>{sl ? 'Zakaj Fenestio' : 'Why Fenestio'}</Eyebrow>
            <h2 className={`mt-5 ${H2}`}>{sl ? 'Ista ponudba, dve poti' : 'The same quote, two ways'}</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-[24px] bg-white p-8 sm:p-10" style={{ borderTop: '3px solid rgba(4,24,24,0.2)', boxShadow: SHADOW }}>
              <h3 className={H3}>{sl ? 'Brez' : 'Before'}</h3>
              <ul className="mt-6 space-y-3.5">
                {before.map(x => (
                  <li key={x} className={`flex items-start gap-3 ${BODY}`} style={{ color: MUTED }}>
                    <X className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: 'rgba(4,24,24,0.35)' }} />{x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] p-8 sm:p-10" style={{ backgroundColor: PANEL, borderTop: `3px solid ${GREEN}` }}>
              <h3 className={H3}>{sl ? 'S Fenestiom' : 'With Fenestio'}</h3>
              <ul className="mt-6 space-y-3.5">
                {after.map(x => (
                  <li key={x} className={`flex items-start gap-3 ${BODY}`}>
                    <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══ configurator ══════════════════════════════════════════════ */}
      <section id="konfigurator" className={`${WRAP} ${SECTION}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
          <div className="max-w-[52ch]">
            <Tag>{sl ? 'Spletni konfigurator' : 'Online configurator'}</Tag>
            <h2 className={`mt-6 ${H2}`}>{sl ? 'Stranka sestavi okno, vi dobite povpraševanje' : 'The customer builds the window, you get the enquiry'}</h2>
            <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
              {sl ? 'Konfigurator je svoja stran na povezavi, ki jo objavite. Stranka izbere izdelek, število kril, profil, barvo, steklo, mere, odpiranje, okovje in senčila — vse po vašem ceniku in z vašim logotipom.'
                  : 'The configurator is its own page at a link you publish. The customer picks the product, the number of sashes, profile, colour, glass, sizes, opening, hardware and shading — all from your price list, under your logo.'}
            </p>
            <ul className="mt-7 space-y-3">
              {(sl ? ['Korak za korakom, brez obrazcev', 'S cenami ali brez — izberete sami', 'Povpraševanje ali takojšnja ponudba v PDF', 'Deluje na telefonu']
                   : ['Step by step, no forms', 'With or without prices — your choice', 'An enquiry or an instant PDF offer', 'Works on a phone']).map(x => (
                <li key={x} className={`flex items-start gap-3 ${BODY}`}>
                  <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                </li>
              ))}
            </ul>
          </div>
          <Shot src="/slike/konfigurator-izbira.jpg" alt={sl ? 'Izbira izdelka v konfiguratorju' : 'Choosing the product in the configurator'} />
        </div>

        <div className="mt-20 sm:mt-28 grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
          <Shot className="lg:order-2" src="/slike/konfigurator-mere.jpg" alt={sl ? 'Mere in število kril' : 'Sizes and number of sashes'} />
          <div className="max-w-[52ch] lg:order-1">
            <Tag>{sl ? 'Mere in cena v živo' : 'Sizes and a live price'}</Tag>
            <h2 className={`mt-6 ${H2}`}>{sl ? 'Cena se spreminja, ko stranka izbira' : 'The price moves as the customer chooses'}</h2>
            <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
              {sl ? 'Mere so omejene na to, kar znate izdelati, vsaka izbira pa takoj premakne ceno — iz vašega cenika, z vašo maržo. Stranka vidi, koliko stane, še preden odda povpraševanje.'
                  : 'The sizes are limited to what you can make, and every choice moves the price at once — from your list, with your margin. The customer sees the cost before sending the enquiry.'}
            </p>
          </div>
        </div>
      </section>

      {/* ══ statuses ══════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: DARK, color: ON_DARK }}>
        <div className={`${WRAP} py-16 sm:py-20`}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-[40ch]">
              <Eyebrow on="dark">{sl ? 'Pot ponudbe' : 'The path of a quote'}</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>{sl ? 'Osem statusov, nobenega ugibanja' : 'Eight statuses, no guessing'}</h2>
            </div>
            <p className="text-[15px] leading-6 max-w-[42ch]" style={{ color: ON_DARK_MUTED }}>
              {sl ? 'Vsak status ima svojo barvo in svoje dejanje. Vrednost in število se seštevata nad stolpcem, prehodi pa se zapišejo v zgodovino.'
                  : 'Every status has its own colour and its own action. Value and count add up above the column, and the moves are written into the history.'}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {statuses.map(s => (
              <div key={s.t} className="rounded-2xl px-4 py-5 text-center" style={{ backgroundColor: 'rgba(223,249,249,0.06)', border: `1px solid ${ON_DARK_HAIR}` }}>
                <s.i className="w-5 h-5 mx-auto" style={{ color: LIME }} strokeWidth={1.6} />
                <p className="mt-3 text-[14px] font-medium">{s.t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ four panels, the reference pattern: the work at the top, the words below ══ */}
      <section className={`${WRAP} ${SECTION}`}>
        <div className="max-w-[48ch]">
          <Eyebrow>{sl ? 'Delo, ki ga prevzame' : 'The work it takes over'}</Eyebrow>
          <h2 className={`mt-5 ${H2}`}>{sl ? 'Štiri stvari, ki jih danes delate ročno' : 'Four things you still do by hand'}</h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* 1 — the calculation */}
          <div className="rounded-[24px] p-7 sm:p-9" style={{ backgroundColor: PANEL }}>
            <div className="rounded-[16px] bg-white p-5 text-[13px] leading-6 tabular-nums" style={{ boxShadow: SHADOW }}>
              {[[sl ? 'Okvir' : 'Frame', '2×(1800+1400) + 6 %', '6,784 m', '105,15 €'],
                [sl ? 'Krila' : 'Sashes', '2×(805+1276)', '4,412 m', '78,31 €'],
                [sl ? 'Steklo' : 'Glass', '675×1146 + 815×1286', '1,822 m²', '58,29 €']].map(([a, b, c, d]) => (
                <div key={a} className="grid grid-cols-[72px_minmax(0,1fr)_64px_64px] gap-x-3 py-1">
                  <span className="font-medium">{a}</span><span className="truncate" style={{ color: MUTED }}>{b}</span>
                  <span className="text-right" style={{ color: MUTED }}>{c}</span><span className="text-right font-medium">{d}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 flex justify-between border-t" style={{ borderColor: HAIR }}>
                <span style={{ color: MUTED }}>{sl ? 'Prodajna cena' : 'Sale price'}</span><span className="font-medium">576,12 €</span>
              </div>
            </div>
            <h3 className={`mt-8 ${H3}`}>{sl ? 'Računanje cene vsakega okna' : 'Pricing every window by hand'}</h3>
            <p className={`mt-3 ${BODY}`} style={{ color: MUTED }}>
              {sl ? 'Dolžine profilov, površina stekla, okovje po krilu in delo — izračunano iz vašega cenika, z vsako vrstico razloženo.'
                  : 'Profile lengths, glass area, hardware per sash and labour — worked out from your price list, with every line explained.'}
            </p>
          </div>

          {/* 2 — the enquiry */}
          <div className="rounded-[24px] p-7 sm:p-9" style={{ backgroundColor: PANEL }}>
            <div className="rounded-[16px] bg-white p-5 flex items-center gap-5" style={{ boxShadow: SHADOW }}>
              <WindowDrawing template="double_mullion" width={1800} height={1400} size={92} />
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-[14px]">{sl ? 'Dvokrilno okno s stebričkom' : 'Double sash with mullion'}</p>
                <p className="mt-1" style={{ color: MUTED }}>1800 × 1400 mm · PVC 82 mm · Ug 0,7</p>
                <p className="mt-1" style={{ color: MUTED }}>{sl ? 'Kip in odpiranje levo · roleta' : 'Tilt and turn left · roller shutter'}</p>
                <p className="mt-2 font-medium text-[15px]">1.284,00 €</p>
              </div>
            </div>
            <h3 className={`mt-8 ${H3}`}>{sl ? 'Prepisovanje povpraševanj' : 'Retyping the enquiry'}</h3>
            <p className={`mt-3 ${BODY}`} style={{ color: MUTED }}>
              {sl ? 'Povpraševanje pride kot pozicija z risbo, merami in izbirami — odprete jo in uredite, ne tipkate na novo.'
                  : 'The enquiry arrives as a position with a drawing, sizes and choices — you open and adjust it instead of typing it again.'}
            </p>
          </div>

          {/* 3 — where the quote stands */}
          <div className="rounded-[24px] p-7 sm:p-9" style={{ backgroundColor: PANEL }}>
            <div className="rounded-[16px] bg-white p-5" style={{ boxShadow: SHADOW }}>
              <div className="grid grid-cols-3 gap-3">
                {[{ n: sl ? 'Poslano' : 'Sent', c: '#215bcf', bg: '#e5eeff', v: '14.457 €', q: '7' },
                  { n: sl ? 'Izmera' : 'Measurement', c: '#8a6100', bg: '#fef3cd', v: '2.478 €', q: '3' },
                  { n: sl ? 'Pridobljeno' : 'Won', c: '#267a47', bg: '#dbfce7', v: '6.654 €', q: '3' }].map(col => (
                  <div key={col.n} className="rounded-xl p-3" style={{ backgroundColor: '#f7f7f7' }}>
                    <span className="inline-flex items-center h-6 px-2 rounded-md text-[11px] font-medium" style={{ color: col.c, backgroundColor: col.bg }}>{col.n}</span>
                    <p className="mt-2.5 text-[15px] font-medium tabular-nums">{col.v}</p>
                    <p className="text-[12px]" style={{ color: MUTED }}>{col.q} {sl ? 'ponudb' : 'quotes'}</p>
                  </div>
                ))}
              </div>
            </div>
            <h3 className={`mt-8 ${H3}`}>{sl ? 'Iskanje, kje je katera ponudba' : 'Hunting for where a quote stands'}</h3>
            <p className={`mt-3 ${BODY}`} style={{ color: MUTED }}>
              {sl ? 'Vsaka ponudba ima status, vrednost in odgovorno osebo. Vsota po stolpcu pove, koliko je v igri.'
                  : 'Every quote has a status, a value and an assignee, and the sum above each column says how much is in play.'}
            </p>
          </div>

          {/* 4 — where the work comes from */}
          <div className="rounded-[24px] p-7 sm:p-9" style={{ backgroundColor: PANEL }}>
            <div className="rounded-[16px] bg-white p-5" style={{ boxShadow: SHADOW }}>
              {[[sl ? 'Priporočilo' : 'Referral', 100], ['Google', 50], ['Instagram', 33], ['Facebook', 0]].map(([n, v]) => (
                <div key={n as string} className="flex items-center gap-3 py-1.5 text-[13px]">
                  <span className="w-20 shrink-0 truncate font-medium">{n}</span>
                  <span className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#f4f4f5' }}>
                    <span className="block h-2 rounded-full" style={{ width: `${Math.max(Number(v), 2)}%`, backgroundColor: Number(v) === 100 ? BLUE : '#93c5fd' }} />
                  </span>
                  <span className="w-10 text-right tabular-nums">{v} %</span>
                </div>
              ))}
            </div>
            <h3 className={`mt-8 ${H3}`}>{sl ? 'Ugibanje, kateri oglas se izplača' : 'Guessing which advert pays off'}</h3>
            <p className={`mt-3 ${BODY}`} style={{ color: MUTED }}>
              {sl ? 'Vsako povpraševanje nosi svoj kanal, poročilo pa pokaže, kolikšen delež zaključenih ponudb po njem dobite.'
                  : 'Every enquiry carries its channel, and the report shows the share of its decided quotes you actually win.'}
            </p>
          </div>
        </div>
      </section>

      {/* ══ quotes ════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: PANEL }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
            <div className="max-w-[52ch]">
              <Tag>{sl ? 'Ponudbe' : 'Quotes'}</Tag>
              <h2 className={`mt-6 ${H2}`}>{sl ? 'Vidite, kje stoji vsaka ponudba' : 'See where every quote stands'}</h2>
              <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
                {sl ? 'Ponudbo premaknete z vlečenjem iz stolpca v stolpec, vrednost in število pa se seštevata nad vsakim stolpcem. Enako lahko delate v seznamu, če vam je bližje.'
                    : 'Drag a quote from column to column; the value and the count add up above each one. The same work can be done in a list, if that suits you better.'}
              </p>
            </div>
            <Shot src="/slike/ponudbe-tabla.jpg" alt={sl ? 'Tabla ponudb po statusih' : 'The board of quotes by status'} />
          </div>

          <div className="mt-20 sm:mt-28 grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
            <HistoryCard />
            <div className="max-w-[52ch]">
              <Tag>{sl ? 'Zgodovina' : 'History'}</Tag>
              <h2 className={`mt-6 ${H2}`}>{sl ? 'Kdo je kaj spremenil in kdaj' : 'Who changed what, and when'}</h2>
              <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
                {sl ? 'Vsaka ponudba ima svojo časovnico: nastanek, shranjene spremembe z vrednostjo prej in potem, prehode med statusi, priloge in zamenjavo odgovorne osebe. Zapisa ni mogoče urediti ali izbrisati — tudi vam ne.'
                    : 'Every quote keeps its own timeline: when it was made, saved edits with the value before and after, the moves between statuses, attachments and a change of assignee. The record cannot be edited or deleted — not even by you.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ calculation ═══════════════════════════════════════════════ */}
      <section id="kalkulacija" style={{ backgroundColor: DARKER, color: ON_DARK }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-20 lg:items-center">
            <div>
              <Eyebrow on="dark">{sl ? 'Kalkulacija' : 'The calculation'}</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>{sl ? 'Vsaka številka pove, od kod je' : 'Every number says where it came from'}</h2>
              <p className={`mt-6 ${LEAD} max-w-[46ch]`} style={{ color: ON_DARK_MUTED }}>
                {sl ? 'Cena okna ni črna skrinjica. Pri vsaki postavki vidite dolžino, površino in ceno, iz katerih je sestavljena: obseg okvirja z odpadkom, obseg kril, letvice, šipe z vstopom v utor, okovje po krilu in delo.'
                    : 'The price of a window is not a black box. Every line shows the length, the area and the price behind it: the frame perimeter with waste, the sash perimeters, the beads, the panes with the rebate, hardware per sash and labour.'}
              </p>
              <ul className="mt-8 space-y-3">
                {(sl ? ['Marža posebej za material in posebej za delo', 'Najnižja cena profila, kadar velja', 'Doplačilo za barvo v ceni profila']
                     : ['Margin split between material and labour', 'The profile’s lowest price, where it applies', 'The colour surcharge inside the profile price']).map(x => (
                  <li key={x} className={`flex items-start gap-3 ${BODY}`} style={{ color: ON_DARK }}>
                    <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: LIME }} />{x}
                  </li>
                ))}
              </ul>
            </div>
            <CalcCard lifted />
          </div>
        </div>
      </section>

      {/* ══ the pdf quote ═════════════════════════════════════════════ */}
      <section className={`${WRAP} ${SECTION}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
          <PdfCard />
          <div className="max-w-[52ch]">
            <Tag>{sl ? 'Dokument' : 'The document'}</Tag>
            <h2 className={`mt-6 ${H2}`}>{sl ? 'Ponudba, ki jo stranka razume' : 'A quote the customer understands'}</h2>
            <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
              {sl ? 'Vsaka pozicija ima risbo, mere in izbire, zraven pa ceno. Spodaj popust, DDV in znesek za plačilo, zgoraj pa vaši podatki in številka ponudbe.'
                  : 'Every position carries a drawing, its sizes and choices, with the price beside it. The discount, VAT and the amount due sit at the bottom, your details and the quote number at the top.'}
            </p>
            <ul className="mt-7 space-y-3">
              {(sl ? ['Vaša glava dokumenta in podatki podjetja', 'Plačilni pogoji, rok izvedbe in veljavnost', 'Cena z avansom in brez njega', 'Prenos v PDF z enim klikom']
                   : ['Your letterhead and company details', 'Payment terms, lead time and validity', 'The price with and without an advance', 'Download as PDF in one click']).map(x => (
                <li key={x} className={`flex items-start gap-3 ${BODY}`}>
                  <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══ reports ═══════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: SOFT }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
            <div className="max-w-[52ch]">
              <Tag>{sl ? 'Poročila' : 'Reports'}</Tag>
              <h2 className={`mt-6 ${H2}`}>{sl ? 'Kateri kanal vam prinese posle' : 'Which channel brings the jobs'}</h2>
              <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
                {sl ? 'Odprte, dobljene in izgubljene ponudbe s primerjavo s prejšnjim obdobjem, cel lijak po statusih, vrednost po skupinah izdelkov in uspešnost po prodajnih kanalih.'
                    : 'Open, won and lost quotes compared with the period before, the whole funnel by status, value by product group and the win rate per sales channel.'}
              </p>
            </div>
            <Shot src="/slike/porocila-kartice.jpg" alt={sl ? 'Poročila' : 'Reports'} />
          </div>
          <div className="mt-20 sm:mt-28 grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
            <RateCard />
            <div className="max-w-[52ch]">
              <Tag>{sl ? 'Prodajni kanali' : 'Sales channels'}</Tag>
              <h2 className={`mt-6 ${H2}`}>{sl ? 'Koliko prinese in koliko od tega dobite' : 'How much it brings, and how much you win'}</h2>
              <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
                {sl ? 'Vsako povpraševanje nosi kanal, od koder je prišlo. V poročilu vidite, koliko ponudb prinese posamezen kanal in kolikšen delež zaključenih ste po njem dobili — in kam se torej splača vlagati.'
                    : 'Every enquiry carries the channel it came from. The report shows how many quotes each channel brings and the share of its decided quotes you won — so you know where to spend.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ price list ════════════════════════════════════════════════ */}
      <section className={`${WRAP} ${SECTION}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
          <Shot className="lg:order-2" src="/slike/cenik.jpg" alt={sl ? 'Cenik v aplikaciji' : 'The price list in the app'} />
          <div className="max-w-[52ch] lg:order-1">
            <Tag>{sl ? 'Vaš cenik' : 'Your price list'}</Tag>
            <h2 className={`mt-6 ${H2}`}>{sl ? 'Nastavite ga enkrat, računa pa vsak dan' : 'Set it once, it prices every day'}</h2>
            <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
              {sl ? 'Skupine izdelkov, profilni sistemi po tekočem metru, barve z doplačilom, paketi stekel, okovje po načinu odpiranja, kljuke, police, senčila, komarniki, strešna okna in storitve.'
                  : 'Product groups, profile systems per metre, colours with a surcharge, glass packages, hardware per opening type, handles, sills, shading, screens, roof windows and services.'}
            </p>
            <p className={`mt-4 ${LEAD}`} style={{ color: MUTED }}>
              {sl ? 'Konfigurator in ponudbe računajo iz istega cenika — spremenite ga enkrat in velja povsod.'
                  : 'The configurator and the quotes price from the same list — change it once and it applies everywhere.'}
            </p>
          </div>
        </div>
      </section>

      {/* ══ how it works ══════════════════════════════════════════════ */}
      <section style={{ backgroundColor: PANEL }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="max-w-[46ch]">
            <Eyebrow>{sl ? 'Kako deluje' : 'How it works'}</Eyebrow>
            <h2 className={`mt-5 ${H2}`}>{sl ? 'Trije koraki do prve ponudbe' : 'Three steps to your first quote'}</h2>
          </div>
          <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-12">
            {steps.map(s => (
              <div key={s.n} className="pt-6 border-t" style={{ borderColor: 'rgba(4,24,24,0.14)' }}>
                <span className="text-[13px] font-medium tabular-nums" style={{ color: MUTED }}>{s.n}</span>
                <h3 className={`mt-3 ${H3}`}>{s.t}</h3>
                <p className={`mt-3 ${BODY}`} style={{ color: MUTED }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ everything inside ═════════════════════════════════════════ */}
      <section className={`${WRAP} ${SECTION}`}>
        <div className="max-w-[46ch]">
          <Eyebrow>{sl ? 'Kaj je notri' : 'What is inside'}</Eyebrow>
          <h2 className={`mt-5 ${H2}`}>{sl ? 'Vse od povpraševanja do naročila' : 'Everything from the enquiry to the order'}</h2>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map(g => (
            <div key={g.t} className={CARD} style={{ border: `1px solid ${HAIR}`, boxShadow: SHADOW }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: PANEL }}>
                <g.icon className="w-[18px] h-[18px]" style={{ color: BLUE }} strokeWidth={1.7} />
              </span>
              <h3 className="mt-4 text-[17px] leading-6 font-medium tracking-[-0.01em]">{g.t}</h3>
              <p className="mt-2 text-[15px] leading-[1.6]" style={{ color: MUTED }}>{g.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ data ══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: SOFT }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20">
            <div>
              <Eyebrow>{sl ? 'Podatki' : 'Data'}</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>{sl ? 'Vaši ceniki ostanejo vaši' : 'Your price list stays yours'}</h2>
            </div>
            <div className="grid gap-10 sm:grid-cols-3">
              {security.map(s => (
                <div key={s.t}>
                  <s.icon className="w-5 h-5" style={{ color: INK }} strokeWidth={1.6} />
                  <h3 className="mt-4 text-[17px] leading-6 font-medium tracking-[-0.01em]">{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6]" style={{ color: MUTED }}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ pricing ═══════════════════════════════════════════════════ */}
      <section id="cena" className={`${WRAP} ${SECTION}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 lg:items-center">
          <div className="max-w-[46ch]">
            <Eyebrow>{sl ? 'Cena' : 'Pricing'}</Eyebrow>
            <h2 className={`mt-5 ${H2}`}>{sl ? 'Dogovorimo se za vaše podjetje' : 'Agreed for your company'}</h2>
            <p className={`mt-6 ${LEAD}`} style={{ color: MUTED }}>
              {sl ? 'Ceno postavimo glede na velikost ekipe in obseg cenika, račun prejmete mesečno. Pri vnosu cenika vam pomagamo, da so prve ponudbe takoj prave.'
                  : 'The price follows the size of your team and your price list, and you are invoiced monthly. We help you set the list up so the first quotes are right away correct.'}
            </p>
          </div>
          <div className="rounded-[24px] bg-white p-8 sm:p-10" style={{ boxShadow: SHADOW, border: `1px solid ${HAIR}` }}>
            <ul className="grid gap-3.5 sm:grid-cols-2">
              {(sl ? ['Neomejeno število ponudb', 'Konfigurator na vaši povezavi', 'Neomejeno uporabnikov', 'Pomoč pri vnosu cenika', 'Podatki v EU', 'Nočna varnostna kopija', 'Slovensko in angleško', 'Brez vezave']
                   : ['Unlimited quotes', 'A configurator at your own link', 'Unlimited users', 'Help setting up the price list', 'Data in the EU', 'Nightly backup', 'Slovenian and English', 'No lock-in']
              ).map(x => (
                <li key={x} className="flex items-start gap-2.5 text-[16px] leading-7">
                  <Check className="w-[18px] h-[18px] mt-1 shrink-0" style={{ color: '#00a35f' }} />{x}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
              <a href="mailto:info@bimetric.si" className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[16px] font-medium border transition-colors hover:bg-[#fafafa]"
                style={{ borderColor: 'rgba(4,24,24,0.18)', color: INK }}>{sl ? 'Pišite nam' : 'Talk to us'}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ══ faq ═══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: PANEL }}>
        <div className={`${WRAP} ${SECTION}`}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20">
            <div>
              <Eyebrow>{sl ? 'Vprašanja' : 'Questions'}</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>{sl ? 'Kar ljudje najprej vprašajo' : 'What people ask first'}</h2>
            </div>
            <div className="grid gap-x-14 gap-y-9 sm:grid-cols-2">
              {faq.map(f => (
                <div key={f.q} className="pt-6 border-t" style={{ borderColor: 'rgba(4,24,24,0.14)' }}>
                  <h3 className="text-[18px] leading-7 font-medium tracking-[-0.01em]">{f.q}</h3>
                  <p className={`mt-2.5 ${BODY}`} style={{ color: MUTED }}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ closing call ══════════════════════════════════════════════ */}
      <section style={{ backgroundColor: DARK, color: ON_DARK }} className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(900px 400px at 50% 0%, rgba(161,237,134,0.18), rgba(7,41,40,0) 70%)' }} />
        <div className={`relative ${WRAP} py-20 sm:py-28 text-center`}>
          <h2 className="text-[32px] leading-[1.12] sm:text-[48px] sm:leading-[1.1] font-medium tracking-[-0.03em] max-w-[22ch] mx-auto">
            {sl ? 'Naj stranke konfigurirajo, vi pa izdajate' : 'Let customers configure, and you issue'}
          </h2>
          <p className={`mt-6 ${LEAD} max-w-[46ch] mx-auto`} style={{ color: ON_DARK_MUTED }}>
            {sl ? 'Postavite cenik, objavite konfigurator in prvo ponudbo izdate še danes.' : 'Set up the price list, publish the configurator and issue your first quote today.'}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Cta to="/register">{sl ? 'Začnite brezplačno' : 'Start for free'}</Cta>
            <Ghost href="mailto:info@bimetric.si" on="dark">{sl ? 'Pišite nam' : 'Talk to us'}</Ghost>
          </div>
        </div>
      </section>

      {/* ══ footer ════════════════════════════════════════════════════ */}
      <footer style={{ backgroundColor: DARKER, color: ON_DARK }}>
        <div className={`${WRAP} py-16`}>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <AppLogo size="sm" showName dark />
              <p className="mt-3 text-[15px] leading-6 max-w-[28ch]" style={{ color: ON_DARK_MUTED }}>
                {sl ? 'Spletni konfigurator oken in ponudbe za ponudnike oken.' : 'An online window configurator and quotes for window suppliers.'}
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase" style={{ letterSpacing: '0.12em', color: LIME }}>{sl ? 'Izdelek' : 'Product'}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-[15px]">
                <a href="#konfigurator" className="transition-opacity hover:opacity-70">{sl ? 'Konfigurator' : 'Configurator'}</a>
                <a href="#kalkulacija" className="transition-opacity hover:opacity-70">{sl ? 'Kalkulacija' : 'Calculation'}</a>
                <a href="#cena" className="transition-opacity hover:opacity-70">{sl ? 'Cena' : 'Pricing'}</a>
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase" style={{ letterSpacing: '0.12em', color: LIME }}>{sl ? 'Pravno' : 'Legal'}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-[15px]">
                <Link to="/terms" className="transition-opacity hover:opacity-70">{sl ? 'Pogoji uporabe' : 'Terms of service'}</Link>
                <Link to="/privacy" className="transition-opacity hover:opacity-70">{sl ? 'Zasebnost' : 'Privacy'}</Link>
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase" style={{ letterSpacing: '0.12em', color: LIME }}>{sl ? 'Stik' : 'Contact'}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-[15px]">
                <a href="mailto:info@bimetric.si" className="transition-opacity hover:opacity-70">info@bimetric.si</a>
                <Link to="/login" className="transition-opacity hover:opacity-70">{sl ? 'Prijava' : 'Log in'}</Link>
                <button type="button" onClick={() => setLang(sl ? 'en' : 'sl')} className="text-left transition-opacity hover:opacity-70">{sl ? 'English' : 'Slovensko'}</button>
              </div>
            </div>
          </div>
          <div className="mt-14 pt-6 border-t text-[13px]" style={{ borderColor: ON_DARK_HAIR, color: ON_DARK_MUTED }}>
            {sl ? 'Storitev ponuja Bimetric · © ' : 'A service by Bimetric · © '}{new Date().getFullYear()} Fenestio
          </div>
        </div>
      </footer>
    </div>
  )
}
