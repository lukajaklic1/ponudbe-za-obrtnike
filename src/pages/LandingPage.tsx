import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useRef } from 'react'
import type { RefObject } from 'react'
import { ArrowRight, Check, ChevronDown, Zap, Calculator, TrendingUp, FileText, BarChart2, Settings, Box, Star, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'

function useInView(ref: RefObject<Element | null>, threshold = 0.1) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el); return () => obs.disconnect()
  }, [])
  return inView
}

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <div ref={ref}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ── Dashboard → Quotes → Customers cycling mockup ── */
type MockView = 'dashboard' | 'quotes' | 'customers'

function SideNavItem({ label, icon, active }: { label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg mb-0.5 text-[11px] font-medium ${active ? 'bg-[#f1f1f1] text-gray-900' : 'text-gray-900'}`}>
      <span className="shrink-0 text-gray-500 flex items-center">{icon}</span>
      {label}
    </div>
  )
}

function HeroMockup({ isSl, views = ['dashboard', 'quotes', 'customers'] }: { isSl: boolean; views?: MockView[] }) {
  const sl = isSl
  const [view, setView] = useState<MockView>(views[0])
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let idx = 0
    const timer = setInterval(() => {
      setFading(true)
      setTimeout(() => { idx = (idx + 1) % views.length; setView(views[idx]); setFading(false) }, 320)
    }, 4800)
    return () => clearInterval(timer)
  }, [])

  // Icon SVG helpers (scaled to 12×12, matching actual Lucide icons used in sidebar)
  const ico = {
    dashboard: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    quotes:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    customers: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    materials: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    machines:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    labor:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/></svg>,
    overheads: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    users:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    settings:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    building:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>,
    panelleft: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>,
    logout:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    search:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    chevdown:  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>,
    calendar:  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    sortarrow: <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>,
    trending:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    check2:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#007d53" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    filetext:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
    trophy:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#007d53" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  }

  // KPI cards: exact match to DashboardPage.tsx
  const kpis = [
    { label: sl ? 'Vrednost poslanih' : 'Sent value',     value: '40.068 €', bg: '#eff6ff', icon: ico.trending },
    { label: sl ? 'Vrednost dobljenih' : 'Won value',     value: '32.545 €', bg: '#e0fced', icon: ico.check2 },
    { label: sl ? 'Poslane ponudbe' : 'Sent quotes',      value: '8',         bg: '#eff6ff', icon: ico.filetext },
    { label: sl ? 'Dobljene ponudbe' : 'Won quotes',      value: '4',         bg: '#e0fced', icon: ico.trophy },
  ]

  // Customer table rows — 7 rows matching actual app, sorted by sent_value desc
  const custRows = sl
    ? [
        { name: 'EuroMotion Systems d.o.o.', sv: '23.360 €', wv: '22.561 €', s: 3, w: 2, wr: '66,7 %' },
        { name: 'Metalin d.o.o.',            sv: '9.463 €',  wv: '9.463 €',  s: 1, w: 1, wr: '100,0 %' },
        { name: 'Alpin Automation d.o.o.',   sv: '6.082 €',  wv: '0 €',      s: 1, w: 0, wr: '0,0 %' },
        { name: 'ProMeh d.o.o.',             sv: '561 €',    wv: '0 €',      s: 1, w: 0, wr: '0,0 %' },
        { name: 'NordSteel Engineering d.o.o.', sv: '522 €', wv: '522 €',    s: 1, w: 1, wr: '100,0 %' },
        { name: 'InoTech Solutions d.o.o.',  sv: '80 €',     wv: '0 €',      s: 1, w: 0, wr: '0,0 %' },
        { name: 'Adria Precision d.o.o.',    sv: '0 €',      wv: '0 €',      s: 0, w: 0, wr: '0,0 %' },
      ]
    : [
        { name: 'EuroMotion Systems d.o.o.', sv: '23,360 €', wv: '22,561 €', s: 3, w: 2, wr: '66.7 %' },
        { name: 'Metalin d.o.o.',            sv: '9,463 €',  wv: '9,463 €',  s: 1, w: 1, wr: '100.0 %' },
        { name: 'Alpin Automation d.o.o.',   sv: '6,082 €',  wv: '0 €',      s: 1, w: 0, wr: '0.0 %' },
        { name: 'ProMeh d.o.o.',             sv: '561 €',    wv: '0 €',      s: 1, w: 0, wr: '0.0 %' },
        { name: 'NordSteel Engineering d.o.o.', sv: '522 €', wv: '522 €',    s: 1, w: 1, wr: '100.0 %' },
        { name: 'InoTech Solutions d.o.o.',  sv: '80 €',     wv: '0 €',      s: 1, w: 0, wr: '0.0 %' },
        { name: 'Adria Precision d.o.o.',    sv: '0 €',      wv: '0 €',      s: 0, w: 0, wr: '0.0 %' },
      ]

  // Chart: 3 periods. H=70 is the chart pixel height (matches BarChart component).
  // Scale bars so max value fills H=70.
  const valChart = {
    title: sl ? 'Vrednost ponudb' : 'Quote value',
    periods: [
      { label: '06/26', s: 32, w: 19 },
      { label: '07/26', s: 46, w: 44 },
      { label: '08/26', s: 0,  w: 0  },
    ],
    yLabels: ['60k €', '45k €', '30k €', '15k €', '0 €'],
    sentC: '#bfdbfe', wonC: '#3b82f6',
    sentLabel: sl ? 'Poslano' : 'Sent', wonLabel: sl ? 'Dobljeno' : 'Won',
  }
  const cntChart = {
    title: sl ? 'Število ponudb' : 'Quote count',
    periods: [
      { label: '06/26', s: 42, w: 20 },
      { label: '07/26', s: 58, w: 32 },
      { label: '08/26', s: 0,  w: 0  },
    ],
    yLabels: ['8', '6', '4', '2', '0'],
    sentC: '#bbf7d0', wonC: '#00d17e',
    sentLabel: sl ? 'Poslane' : 'Sent', wonLabel: sl ? 'Dobljene' : 'Won',
  }

  function BarChart({ chart }: { chart: typeof valChart }) {
    // Fixed layout: chart area y=6..76 (H=70), baseline y=76, labels below, legend below that
    const H = 70, BL = 76
    const nLines = chart.yLabels.length
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-3 pt-3 pb-2">
        {/* title left-aligned */}
        <h2 className="text-[9px] font-medium text-gray-700 mb-1">{chart.title}</h2>
        <svg width="100%" viewBox="0 0 290 108" style={{ overflow: 'visible' }}>
          {/* Horizontal grid lines + Y labels */}
          {chart.yLabels.map((label, i) => {
            const y = 6 + (H * i / (nLines - 1))
            return (
              <g key={i}>
                <line x1="32" y1={y} x2="282" y2={y} stroke="#f3f4f6" strokeDasharray={i < nLines-1 ? '3 3' : '0'} strokeWidth="1"/>
                <text x="28" y={y + 3} textAnchor="end" fontSize="5.5" fill="#d1d5db">{label}</text>
              </g>
            )
          })}
          {/* Solid baseline */}
          <line x1="32" y1={BL} x2="282" y2={BL} stroke="#e5e7eb" strokeWidth="0.8"/>
          {/* Bars — 3 periods evenly spaced */}
          {chart.periods.map((p, pi) => {
            const cx = 32 + (250 * (pi + 0.5) / 3)
            const bw = 14, gap = 3
            return (
              <g key={pi}>
                {p.s > 0 && <rect x={cx - bw - gap/2} y={BL - p.s} width={bw} height={p.s} fill={chart.sentC} rx="2"/>}
                {p.w > 0 && <rect x={cx + gap/2} y={BL - p.w} width={bw} height={p.w} fill={chart.wonC} rx="2"/>}
                <text x={cx} y={BL + 9} textAnchor="middle" fontSize="5.5" fill="#9ca3af">{p.label}</text>
              </g>
            )
          })}
          {/* Legend — small, centered */}
          <rect x="85" y="96" width="6" height="4" fill={chart.sentC} rx="1"/>
          <text x="93" y="100" fontSize="5.5" fill="#6b7280">{chart.sentLabel}</text>
          <rect x="125" y="96" width="6" height="4" fill={chart.wonC} rx="1"/>
          <text x="133" y="100" fontSize="5.5" fill="#6b7280">{chart.wonLabel}</text>
        </svg>
      </div>
    )
  }

  // ── Quotes rows (contact has name + email, assignee has name) ──
  const quoteRows = sl ? [
    { num:'Q20260010', cust:'InoTech Solutions d.o.o.',    contact:'Andrej Zupan', email:'andrej.zupan@inotech.si',          status:'Poslana',    sc:'#215bcf', sbg:'#e5eeff', sbd:'#d6e5ff', val:'80,10 €',     date:'10. 7. 2026', aC:'#059669', aI:'M',  aName:'Marko Novak',  pieces:1 },
    { num:'Q20260009', cust:'EuroMotion Systems d.o.o.',   contact:'Matej Žagar',  email:'matej.zagar@euromotion.si',        status:'Dobljena',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'12.231,60 €', date:'7. 7. 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:1 },
    { num:'Q20260007', cust:'EuroMotion Systems d.o.o.',   contact:'Matej Žagar',  email:'matej.zagar@euromotion.si',        status:'Izgubljena', sc:'#9e3f00', sbg:'#feeee1', sbd:'#fee0c8', val:'799,84 €',    date:'5. 7. 2026',  aC:'#059669', aI:'M',  aName:'Marko Novak',  pieces:1 },
    { num:'Q20260006', cust:'ProMeh d.o.o.',               contact:'Tina Novak',   email:'tina.novak@promeh.si',             status:'Izgubljena', sc:'#9e3f00', sbg:'#feeee1', sbd:'#fee0c8', val:'560,77 €',    date:'5. 7. 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:1 },
    { num:'Q20260004', cust:'NordSteel Engineering d.o.o.',contact:'Maja Horvat',  email:'maja.horvat@nordsteel.si',         status:'Dobljena',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'521,80 €',    date:'5. 7. 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:8 },
    { num:'Q20260003', cust:'Alpin Automation d.o.o.',     contact:'Nina Kranjc',  email:'nina.kranjc@alpinautomation.si',   status:'Izgubljena', sc:'#9e3f00', sbg:'#feeee1', sbd:'#fee0c8', val:'6.082,27 €',  date:'5. 7. 2026',  aC:'#059669', aI:'M',  aName:'Marko Novak',  pieces:1 },
    { num:'Q20260002', cust:'EuroMotion Systems d.o.o.',   contact:'Matej Žagar',  email:'matej.zagar@euromotion.si',        status:'Dobljena',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'10.328,97 €', date:'5. 7. 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:2 },
    { num:'Q20260001', cust:'Metalin d.o.o.',              contact:'Marko Kovač',  email:'marko.kovac@metalin.si',           status:'Dobljena',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'9.462,50 €',  date:'4. 7. 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:1 },
  ] : [
    { num:'Q20260010', cust:'InoTech Solutions d.o.o.',    contact:'Andrej Zupan', email:'andrej.zupan@inotech.si',          status:'Sent',  sc:'#215bcf', sbg:'#e5eeff', sbd:'#d6e5ff', val:'80.10 €',     date:'10 Jul 2026', aC:'#059669', aI:'M',  aName:'Marko Novak',  pieces:1 },
    { num:'Q20260009', cust:'EuroMotion Systems d.o.o.',   contact:'Matej Žagar',  email:'matej.zagar@euromotion.si',        status:'Won',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'12,231.60 €', date:'7 Jul 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:1 },
    { num:'Q20260007', cust:'EuroMotion Systems d.o.o.',   contact:'Matej Žagar',  email:'matej.zagar@euromotion.si',        status:'Lost',  sc:'#9e3f00', sbg:'#feeee1', sbd:'#fee0c8', val:'799.84 €',    date:'5 Jul 2026',  aC:'#059669', aI:'M',  aName:'Marko Novak',  pieces:1 },
    { num:'Q20260006', cust:'ProMeh d.o.o.',               contact:'Tina Novak',   email:'tina.novak@promeh.si',             status:'Lost',  sc:'#9e3f00', sbg:'#feeee1', sbd:'#fee0c8', val:'560.77 €',    date:'5 Jul 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:1 },
    { num:'Q20260004', cust:'NordSteel Engineering d.o.o.',contact:'Maja Horvat',  email:'maja.horvat@nordsteel.si',         status:'Won',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'521.80 €',    date:'5 Jul 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:8 },
    { num:'Q20260003', cust:'Alpin Automation d.o.o.',     contact:'Nina Kranjc',  email:'nina.kranjc@alpinautomation.si',   status:'Lost',  sc:'#9e3f00', sbg:'#feeee1', sbd:'#fee0c8', val:'6,082.27 €',  date:'5 Jul 2026',  aC:'#059669', aI:'M',  aName:'Marko Novak',  pieces:1 },
    { num:'Q20260002', cust:'EuroMotion Systems d.o.o.',   contact:'Matej Žagar',  email:'matej.zagar@euromotion.si',        status:'Won',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'10,328.97 €', date:'5 Jul 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:2 },
    { num:'Q20260001', cust:'Metalin d.o.o.',              contact:'Marko Kovač',  email:'marko.kovac@metalin.si',           status:'Won',   sc:'#098259', sbg:'#e0fced', sbd:'#d4f8e6', val:'9,462.50 €',  date:'4 Jul 2026',  aC:'#2563eb', aI:'M',  aName:'Miha Sajovic', pieces:1 },
  ]

  // ── Customers rows — 10 rows, matching actual app ──
  const custTableRows = [
    { name:'Adria Precision d.o.o.',    vat:'SI38294157', contact:'Luka Bizjak',   cC:'#16a34a', email:'luka.bizjak@adriaprecision.si',    phone:'+386 2 450 88 30', terms:sl?'30 dni':'30 days', quotes:0, updated:'4. 7. 2026' },
    { name:'Alpin Automation d.o.o.',   vat:'SI63719482', contact:'Nina Kranjc',   cC:'#7c3aed', email:'nina.kranjc@alpinautomation.si',   phone:'+386 4 517 81 90', terms:sl?'45 dni':'45 days', quotes:1, updated:'4. 7. 2026' },
    { name:'EuroMotion Systems d.o.o.', vat:'SI27196548', contact:'Matej Žagar',   cC:'#2563eb', email:'matej.zagar@euromotion.si',        phone:'+386 5 330 71 20', terms:sl?'30 dni':'30 days', quotes:3, updated:'18. 7. 2026' },
    { name:'InoTech Solutions d.o.o.',  vat:'SI42871365', contact:'Andrej Zupan',  cC:'#059669', email:'andrej.zupan@inotech.si',          phone:'+386 1 620 45 10', terms:sl?'30 dni':'30 days', quotes:1, updated:'4. 7. 2026' },
    { name:'Metalin d.o.o.',            vat:'SI84561237', contact:'Marko Kovač',   cC:'#d97706', email:'marko.kovac@metalin.si',           phone:'+386 3 555 24 80', terms:sl?'30 dni':'30 days', quotes:1, updated:'4. 7. 2026' },
    { name:'NordSteel Engineering d.o.o.', vat:'SI75198426', contact:'Maja Horvat', cC:'#2563eb', email:'maja.horvat@nordsteel.si',        phone:'+386 7 392 11 60', terms:sl?'60 dni':'60 days', quotes:1, updated:'4. 7. 2026' },
    { name:'PrimeMotion d.o.o.',        vat:'SI19472658', contact:'Blaž Vidmar',   cC:'#059669', email:'blaz.vidmar@primemotion.si',       phone:'+386 3 899 34 10', terms:sl?'30 dni':'30 days', quotes:0, updated:'4. 7. 2026' },
    { name:'Proinox Engineering d.o.o.',vat:'SI72846135', contact:'Sara Potočnik', cC:'#059669', email:'sara.potocnik@proinox.si',         phone:'+386 2 748 26 50', terms:sl?'30 dni':'30 days', quotes:0, updated:'4. 7. 2026' },
    { name:'ProMeh d.o.o.',             vat:'SI96352741', contact:'Tina Novak',    cC:'#059669', email:'tina.novak@promeh.si',             phone:'+386 4 511 67 20', terms:sl?'45 dni':'45 days', quotes:1, updated:'4. 7. 2026' },
    { name:'TechMec d.o.o.',            vat:'SI51684273', contact:'Gregor Mlakar', cC:'#059669', email:'gregor.mlakar@techmec.si',         phone:'+386 1 548 22 10', terms:sl?'30 dni':'30 days', quotes:0, updated:'4. 7. 2026' },
  ]

  // ── Helpers ──
  function Chip({ label, val, icon }: { label: string; val?: string; icon?: React.ReactNode }) {
    return (
      <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-white">
        {icon}{icon && ' '}
        <span className="text-[10px] text-gray-500">{label}</span>
        {val && <span className="text-[10px] text-gray-700 font-medium">{val}</span>}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    )
  }

  function Avatar({ initials, color, size=20 }: { initials: string; color: string; size?: number }) {
    return (
      <div style={{ width:size, height:size, borderRadius:'50%', backgroundColor:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize: size*0.38, fontWeight:700, flexShrink:0 }}>
        {initials}
      </div>
    )
  }

  function ContactCell({ name, color }: { name: string; color: string }) {
    const initials = name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
    return (
      <div className="flex items-center gap-1.5">
        <Avatar initials={initials} color={color} size={18}/>
        <span className="text-[10px] text-gray-700 truncate">{name}</span>
      </div>
    )
  }

  function PieceThumbs({ n }: { n: number }) {
    const clrs = ['#e0e7ff','#dcfce7','#fef3c7']
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({length:Math.min(n,3)}).map((_,i)=>(
          <div key={i} style={{width:24,height:24,borderRadius:5,backgroundColor:clrs[i],border:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
        ))}
        {n>3 && <span className="text-[9px] text-gray-400 ml-0.5">+{n-3}</span>}
      </div>
    )
  }

  const sortIco = <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
  const moreIco = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
  const searchIco = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  const plusIco = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>

  // Nav icons
  const navIco = {
    dashboard: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    quotes:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    customers: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    materials: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    machines:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>,
    labor:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/></svg>,
    overheads: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    users:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    settings:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  }

  const urls: Record<MockView,string> = { dashboard:'obrtdesk.com/dashboard', quotes:'obrtdesk.com/quotes', customers:'obrtdesk.com/customers' }

  const thCls = "px-3 py-2 text-[9px] font-medium text-gray-500 text-left whitespace-nowrap"

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-[0_24px_80px_rgba(0,0,0,.10)]">
      {/* Browser chrome */}
      <div className="bg-[#f6f6f6] border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"/>
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"/>
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"/>
        </div>
        <div className="flex-1 mx-2 bg-white rounded-md h-5 flex items-center px-3 border border-gray-200/60">
          <span className="text-[10px] text-gray-400 transition-all duration-500">{urls[view]}</span>
        </div>
      </div>

      {/* App shell — sidebar + main */}
      <div className="bg-white flex" style={{ height: 620 }}>

        {/* ── Sidebar (exact replica, scaled ~0.69×) ── */}
        <aside className="w-[172px] bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 h-full">

          {/* Logo row — h-[57px] → h-9 */}
          <div className="h-9 px-3 border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 40 40" fill="none">
                <polyline points="26,6 10,20 26,34" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="33,6 17,20 33,34" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.28"/>
              </svg>
              <span className="text-[12px] font-semibold text-gray-900">Obrtdesk</span>
            </div>
            <span className="text-gray-400">{ico.panelleft}</span>
          </div>

          {/* Company pill */}
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-gray-200">
              <span className="text-gray-400">{ico.building}</span>
              <span className="text-[10px] font-medium text-gray-900 truncate">TCE d.o.o.</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
            <SideNavItem active={view==='dashboard'} label={sl ? 'Poročila' : 'Reports'}         icon={navIco.dashboard} />
            <SideNavItem active={view==='quotes'}    label={sl ? 'Ponudbe' : 'Quotes'}            icon={navIco.quotes} />
            <SideNavItem active={view==='customers'} label={sl ? 'Stranke' : 'Customers'}         icon={navIco.customers} />
            <SideNavItem label={sl ? 'Materiali' : 'Materials'}       icon={navIco.materials} />
            <SideNavItem label={sl ? 'Stroji' : 'Machines'}           icon={navIco.machines} />
            <SideNavItem label={sl ? 'Operaterji' : 'Operators'}      icon={navIco.labor} />
            <SideNavItem label={sl ? 'Stroški režije' : 'Overhead costs'} icon={navIco.overheads} />
            <SideNavItem label={sl ? 'Uporabniki' : 'Users'}          icon={navIco.users} />
          </nav>

          {/* Bottom */}
          <div className="border-t border-gray-200 px-1.5 pt-1">
            <SideNavItem label={sl ? 'Nastavitve' : 'Settings'} icon={navIco.settings} />
            {/* Language switcher */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5">
              <span className="text-[9px] text-gray-500">{sl ? 'Jezik' : 'Language'}:</span>
              <div className="flex gap-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${sl ? 'text-gray-500' : 'bg-blue-600 text-white'}`}>EN</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${sl ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>SL</span>
              </div>
            </div>
            {/* User row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-[22px] h-[22px] rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-semibold shrink-0">MS</div>
              <span className="text-[10px] font-medium text-gray-900 flex-1 truncate">Miha Sajovic</span>
              <span className="text-gray-400">{ico.logout}</span>
            </div>
          </div>
        </aside>

        {/* ── Main content — switches per view ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">

          {/* ── DASHBOARD VIEW ── */}
          {view === 'dashboard' && (
            <div className="flex flex-col h-full" style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
              {/* PageHeader */}
              <div className="h-9 flex items-center justify-between px-3 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-1.5">
                  {navIco.dashboard}
                  <span className="text-[11px] font-medium text-gray-900">{sl ? 'Poročila' : 'Reports'}</span>
                </div>
              </div>
              {/* Subtitle + filter bar */}
              <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-900">{sl ? 'Analitika' : 'Analytics'}</span>
                  <span className="text-[9px] text-gray-400">{sl ? 'Pregled in analiza vaših ponudb' : 'Overview and analysis of your quotes'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Chip label={sl ? '3 mesece' : '3 months'} icon={<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}/>
                  <Chip label={sl ? 'Odg. oseba' : 'Assignee'} val={sl ? 'Vsi' : 'All'}/>
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                    {searchIco}
                    <span className="text-[9px] text-gray-400">{sl ? 'Stranka: Vse' : 'Customer: All'}</span>
                  </div>
                </div>
              </div>
              {/* Content */}
              <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
                {/* KPI cards */}
                <div className="grid grid-cols-4 gap-2">
                  {kpis.map(k => (
                    <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col items-start">
                      <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center mb-2.5" style={{ backgroundColor: k.bg }}>{k.icon}</div>
                      <p className="text-[9px] font-medium text-[#7f7f7f] leading-tight text-left">{k.label}</p>
                      <p className="text-[14px] font-semibold text-gray-900 mt-0.5 tracking-tight text-left">{k.value}</p>
                    </div>
                  ))}
                </div>
                {/* Charts */}
                <div className="grid grid-cols-2 gap-2">
                  <BarChart chart={valChart}/>
                  <BarChart chart={cntChart}/>
                </div>
                {/* Customer table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200">
                    <h2 className="text-[10px] font-medium text-gray-900">{sl ? 'Pregled po strankah' : 'Customer overview'}</h2>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {(sl ? ['Stranka','Poslana vrednost','Dobljena vrednost','Poslane','Dobljene','Uspešnost']
                              : ['Customer','Sent value','Won value','Sent','Won','Win rate']).map((h,i)=>(
                          <th key={h} className={`px-3 py-1.5 text-[9px] font-medium text-gray-500 ${i===0?'text-left':i<=2?'text-right':i<=4?'text-center':'text-right'}`}>
                            <span className="inline-flex items-center gap-0.5">{h}{sortIco}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {custRows.map(c=>(
                        <tr key={c.name} className="hover:bg-[#fbfbfb]">
                          <td className="px-3 py-1.5 text-[10px] font-medium text-gray-900 text-left">{c.name}</td>
                          <td className="px-3 py-1.5 text-right text-[10px] text-gray-600">{c.sv}</td>
                          <td className="px-3 py-1.5 text-right text-[10px] text-gray-600">{c.wv}</td>
                          <td className="px-3 py-1.5 text-center text-[10px] text-gray-600">{c.s}</td>
                          <td className="px-3 py-1.5 text-center text-[10px] text-gray-600">{c.w}</td>
                          <td className="px-3 py-1.5 text-right text-[10px] text-gray-600">{c.wr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── QUOTES VIEW ── */}
          {view === 'quotes' && (
            <div className="flex flex-col h-full" style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
              {/* PageHeader */}
              <div className="h-9 flex items-center justify-between px-3 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-1.5">
                  {navIco.quotes}
                  <span className="text-[11px] font-medium text-gray-900">{sl ? 'Ponudbe' : 'Quotes'}</span>
                  <span className="text-[9px] font-medium text-gray-600 px-1.5 py-0.5 rounded bg-gray-100">8</span>
                </div>
                <button className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-2 py-1 text-[9px] font-medium">
                  {plusIco}{sl ? 'Nova ponudba' : 'New quote'}
                </button>
              </div>
              {/* Filter bar — Search | Customer | Status: All | Assignee: All */}
              <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-white" style={{minWidth:100}}>
                  {searchIco}
                  <span className="text-[9px] text-gray-400">{sl ? 'Iskanje' : 'Search'}</span>
                </div>
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-white" style={{minWidth:90}}>
                  {searchIco}
                  <span className="text-[9px] text-gray-400">{sl ? 'Stranka' : 'Customer'}</span>
                </div>
                <Chip label={sl ? 'Status:' : 'Status:'} val={sl ? 'Vsi' : 'All'}/>
                <Chip label={sl ? 'Odg. oseba:' : 'Assignee:'} val={sl ? 'Vsi' : 'All'}/>
              </div>
              {/* Table */}
              <div className="overflow-y-auto flex-1">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className={thCls}><span className="inline-flex items-center gap-0.5">{sl?'Številka':'Number'}{sortIco}</span></th>
                      <th className={thCls}><span className="inline-flex items-center gap-0.5">{sl?'Stranka':'Customer'}{sortIco}</span></th>
                      <th className={thCls}>{sl?'Kontaktna oseba':'Contact person'}</th>
                      <th className={thCls}>{sl?'Kosi':'Pieces'}</th>
                      <th className={thCls}><span className="inline-flex items-center gap-0.5">{sl?'Status':'Status'}{sortIco}</span></th>
                      <th className={`${thCls} text-right`}><span className="inline-flex items-center gap-0.5">{sl?'Vrednost ponudbe':'Quote value'}{sortIco}</span></th>
                      <th className={`${thCls} text-right`}><span className="inline-flex items-center gap-0.5">{sl?'Ustvarjena':'Created'}{sortIco}</span></th>
                      <th className={thCls}>{sl?'Odg. oseba':'Assignee'}</th>
                      <th className={thCls}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {quoteRows.map(q=>(
                      <tr key={q.num} className="hover:bg-[#fbfbfb]">
                        {/* doc icon + quote number */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div style={{width:18,height:18,borderRadius:4,backgroundColor:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                            </div>
                            <span className="text-[9px] font-mono text-blue-600 whitespace-nowrap">{q.num}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-left text-[10px] text-gray-800 max-w-[100px] truncate">{q.cust}</td>
                        {/* contact: circle left, name+email flush left next to it */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Avatar initials={q.aI} color={q.aC} size={20}/>
                            <div>
                              <p className="text-[10px] text-gray-800 whitespace-nowrap leading-tight text-left">{q.contact}</p>
                              <p className="text-[9px] text-gray-400 whitespace-nowrap leading-tight text-left">{q.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><PieceThumbs n={q.pieces}/></td>
                        <td className="px-3 py-2">
                          <span style={{ backgroundColor:q.sbg, border:`1px solid ${q.sbd}`, color:q.sc, borderRadius:6, fontSize:9, fontWeight:600, padding:'2px 7px', whiteSpace:'nowrap' }}>{q.status}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-[10px] font-medium text-gray-900 whitespace-nowrap">{q.val}</td>
                        <td className="px-3 py-2 text-right text-[9px] text-gray-400 whitespace-nowrap">{q.date}</td>
                        {/* assignee: avatar + name + chevron */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Avatar initials={q.aI} color={q.aC} size={18}/>
                            <span className="text-[9px] text-gray-700 whitespace-nowrap">{q.aName}</span>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </td>
                        <td className="px-3 py-2">{moreIco}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CUSTOMERS VIEW ── */}
          {view === 'customers' && (
            <div className="flex flex-col h-full" style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
              {/* PageHeader */}
              <div className="h-9 flex items-center justify-between px-3 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-1.5">
                  {navIco.customers}
                  <span className="text-[11px] font-medium text-gray-900">{sl ? 'Stranke' : 'Customers'}</span>
                  <span className="text-[9px] font-medium text-gray-600 px-1.5 py-0.5 rounded bg-gray-100">10</span>
                </div>
                <button className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-2 py-1 text-[9px] font-medium">
                  {plusIco}{sl ? 'Nova stranka' : 'New customer'}
                </button>
              </div>
              {/* Filter bar — just Search + Status: All */}
              <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-white flex-1 max-w-[200px]">
                  {searchIco}
                  <span className="text-[9px] text-gray-400">{sl ? 'Iskanje' : 'Search'}</span>
                </div>
                <Chip label={sl ? 'Status:' : 'Status:'} val={sl ? 'Vsi' : 'All'}/>
              </div>
              {/* Table */}
              <div className="overflow-y-auto flex-1">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className={thCls}><span className="inline-flex items-center gap-0.5">{sl?'Ime podjetja':'Company name'}{sortIco}</span></th>
                      <th className={thCls}>{sl?'Kontakt':'Contact'}</th>
                      <th className={thCls}>Email</th>
                      <th className={thCls}>{sl?'Telefon':'Phone'}</th>
                      <th className={thCls}>{sl?'Plačilni pogoji':'Payment terms'}</th>
                      <th className={`${thCls} text-center`}><span className="inline-flex items-center gap-0.5">{sl?'Ponudbe':'Quotes'}{sortIco}</span></th>
                      <th className={`${thCls} text-center`}><span className="inline-flex items-center gap-0.5">{sl?'Status':'Status'}{sortIco}</span></th>
                      <th className={thCls}>{sl?'Posodobljeno':'Updated'}</th>
                      <th className={thCls}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {custTableRows.map(c=>(
                      <tr key={c.name} className="hover:bg-[#fbfbfb]">
                        {/* company: building icon + name bold + VAT inline */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div style={{width:18,height:18,borderRadius:4,backgroundColor:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
                            </div>
                            <span className="text-[10px] font-semibold text-gray-900 whitespace-nowrap">{c.name}</span>
                            <span className="text-[9px] text-gray-400 whitespace-nowrap">{c.vat}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><ContactCell name={c.contact} color={c.cC}/></td>
                        <td className="px-3 py-2 text-[9px] text-gray-600 truncate max-w-[130px]">{c.email}</td>
                        <td className="px-3 py-2 text-[9px] text-gray-600 whitespace-nowrap">{c.phone}</td>
                        <td className="px-3 py-2 text-[9px] text-gray-600 whitespace-nowrap">{c.terms}</td>
                        <td className="px-3 py-2 text-center text-[10px] text-gray-700">{c.quotes}</td>
                        <td className="px-3 py-2 text-center">
                          <span style={{ backgroundColor:'#e0fced', border:'1px solid #d4f8e6', color:'#098259', borderRadius:6, fontSize:9, fontWeight:600, padding:'2px 7px' }}>{sl?'Aktivna':'Active'}</span>
                        </td>
                        {/* Updated: calendar icon + date */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span className="text-[9px] text-gray-400 whitespace-nowrap">{c.updated}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{moreIco}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

type RatesStep = 'machines' | 'machine_detail' | 'variable' | 'operators'

function RatesMockup({ isSl }: { isSl: boolean }) {
  const [step, setStep] = useState<RatesStep>('machines')
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const steps: RatesStep[] = ['machines', 'machine_detail', 'variable', 'operators']
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setStep(s => { const i = steps.indexOf(s); return steps[(i + 1) % steps.length] })
        setFading(false)
      }, 300)
    }, 3800)
    return () => clearInterval(id)
  }, [])

  const sl = isSl
  const stepLabels: Record<RatesStep, string> = {
    machines:      sl ? '1 · Stroji'        : '1 · Machines',
    machine_detail:sl ? '2 · Fiksni stroški': '2 · Fixed costs',
    variable:      sl ? '3 · Variabilni'    : '3 · Variable costs',
    operators:     sl ? '4 · Operaterji'    : '4 · Operators',
  }

  const machines = [
    { name: '3-osni CNC obdelovalni center', model: 'Haas VF-2',             cat: 'CNC milling',    rate: '17,19 €/h' },
    { name: '5-osni CNC obdelovalni center', model: 'DMG MORI DMU 65',       cat: 'CNC milling',    rate: '48,46 €/h' },
    { name: 'CNC stružnica',                 model: 'Doosan Puma 2600SY',    cat: 'CNC turning',    rate: '35,90 €/h' },
    { name: 'Ploskovni brusilni stroj',      model: 'Okamoto PSG-63DX',      cat: 'Grinding',       rate: '10,71 €/h' },
    { name: 'Potopna erozija',               model: 'Sodick AG60L',          cat: 'EDM (erosion)',   rate: '21,17 €/h' },
    { name: 'Žična erozija',                 model: 'Sodick AQ327L',         cat: 'EDM (erosion)',   rate: '22,41 €/h' },
  ]

  const operators = [
    { name: 'CAM programer',                      annual: '56.000 €', rate: '41,83 €/h' },
    { name: 'Kontrolor kakovosti',                annual: '42.000 €', rate: '31,37 €/h' },
    { name: 'Operater 3-osnega CNC centra',       annual: '38.000 €', rate: '28,38 €/h' },
    { name: 'Operater 5-osnega CNC centra',       annual: '45.000 €', rate: '33,61 €/h' },
    { name: 'Operater CNC stružnice',             annual: '40.000 €', rate: '29,88 €/h' },
    { name: 'Tehnolog',                           annual: '58.000 €', rate: '43,32 €/h' },
  ]

  const machineActive = step === 'machines' || step === 'machine_detail' || step === 'variable'
  const operatorActive = step === 'operators'

  const rNavIco = {
    dashboard: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    quotes:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    customers: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    materials: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    machines:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>,
    labor:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/></svg>,
    overheads: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    users:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
    settings:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    panelleft: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>,
    building:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>,
    logout:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  }

  function RNavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
    return (
      <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg mb-0.5 text-[11px] font-medium ${active ? 'bg-[#f1f1f1] text-gray-900' : 'text-gray-900'}`}>
        <span className="shrink-0 text-gray-500 flex items-center">{icon}</span>
        {label}
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-[0_24px_80px_rgba(0,0,0,.10)]">
      {/* Browser chrome */}
      <div className="bg-[#f6f6f6] border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"/><div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"/><div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"/>
        </div>
        <div className="flex-1 mx-2 bg-white rounded-md h-5 flex items-center px-3 border border-gray-200/60">
          <span className="text-[10px] text-gray-400">obrtdesk.com/{step === 'operators' ? 'operators' : 'machines'}</span>
        </div>
      </div>

      {/* App shell */}
      <div className="bg-white flex" style={{ height: 460 }}>

        {/* ── Sidebar — same structure as all other mockups ── */}
        <aside className="w-[172px] bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 h-full">
          <div className="h-9 px-3 border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 40 40" fill="none">
                <polyline points="26,6 10,20 26,34" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="33,6 17,20 33,34" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.28"/>
              </svg>
              <span className="text-[12px] font-semibold text-gray-900">Obrtdesk</span>
            </div>
            <span className="text-gray-400">{rNavIco.panelleft}</span>
          </div>
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-gray-200">
              <span className="text-gray-400">{rNavIco.building}</span>
              <span className="text-[10px] font-medium text-gray-900 truncate">TCE d.o.o.</span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
            <RNavItem icon={rNavIco.dashboard} label={sl ? 'Poročila' : 'Reports'} />
            <RNavItem icon={rNavIco.quotes}    label={sl ? 'Ponudbe' : 'Quotes'} />
            <RNavItem icon={rNavIco.customers} label={sl ? 'Stranke' : 'Customers'} />
            <RNavItem icon={rNavIco.materials} label={sl ? 'Materiali' : 'Materials'} />
            <RNavItem icon={rNavIco.machines}  label={sl ? 'Stroji' : 'Machines'} active={machineActive} />
            <RNavItem icon={rNavIco.labor}     label={sl ? 'Operaterji' : 'Operators'} active={operatorActive} />
            <RNavItem icon={rNavIco.overheads} label={sl ? 'Stroški režije' : 'Overhead costs'} />
            <RNavItem icon={rNavIco.users}     label={sl ? 'Uporabniki' : 'Users'} />
          </nav>
          <div className="border-t border-gray-200 px-1.5 pt-1">
            <RNavItem icon={rNavIco.settings} label={sl ? 'Nastavitve' : 'Settings'} />
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-[22px] h-[22px] rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-semibold shrink-0">MS</div>
              <span className="text-[10px] font-medium text-gray-900 flex-1 truncate">Miha Sajovic</span>
              <span className="text-gray-400">{rNavIco.logout}</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Page header */}
          <div className="h-9 border-b border-gray-200 bg-white px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 flex items-center">{step === 'operators' ? rNavIco.labor : rNavIco.machines}</span>
              <span className="text-[12px] font-semibold text-gray-900">
                {step === 'operators' ? (sl ? 'Operaterji' : 'Operators') : step === 'machines' ? (sl ? 'Stroji' : 'Machines') : '3-osni CNC obdelovalni center'}
              </span>
              {step === 'machines' && <span className="text-[9px] font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 ml-1">6</span>}
              {step === 'operators' && <span className="text-[9px] font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 ml-1">13</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(['machines','machine_detail','variable','operators'] as RatesStep[]).map(s => (
                  <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step === s ? 'w-6 bg-gray-900' : 'w-1.5 bg-gray-200'}`}/>
                ))}
              </div>
              <div className="text-[9px] text-gray-500 border border-gray-200 bg-gray-50 rounded-md px-1.5 py-0.5">{stepLabels[step]}</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden transition-all duration-300"
            style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(5px)' : 'translateY(0)' }}>

            {/* MACHINES LIST */}
            {step === 'machines' && (
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                  <div className="border border-gray-200 rounded-md px-2 py-1 flex items-center gap-1.5 flex-1 max-w-[140px]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span className="text-[9px] text-gray-400">Machine name / Model</span>
                  </div>
                </div>
                <div className="grid text-[9px] font-medium text-gray-400 px-4 py-1.5 border-b border-gray-100" style={{gridTemplateColumns:'1fr 90px 90px 70px 60px'}}>
                  <span>Machine name</span><span>Model</span><span>Category</span><span>Hourly rate</span><span>Status</span>
                </div>
                <div className="overflow-hidden flex-1">
                  {machines.map((m, i) => (
                    <div key={i} className="grid items-center px-4 py-2 border-b border-gray-50 hover:bg-gray-50 text-[9.5px]" style={{gridTemplateColumns:'1fr 90px 90px 70px 60px'}}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-blue-50 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="w-2.5 h-2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </div>
                        <span className="text-gray-800 font-medium truncate">{m.name}</span>
                      </div>
                      <span className="text-gray-500 truncate">{m.model}</span>
                      <span className="text-gray-500">{m.cat}</span>
                      <span className="text-gray-800 font-medium">{m.rate}</span>
                      <span className="text-[8.5px] font-medium text-green-700 bg-green-50 rounded-full px-1.5 py-0.5 w-fit">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MACHINE DETAIL — Fixed costs */}
            {step === 'machine_detail' && (
              <div className="px-4 py-3 flex flex-col gap-2.5 overflow-hidden h-full">
                <p className="text-[9.5px] text-gray-400">← {sl ? 'Stroji' : 'Machines'} · {sl ? 'Konfigurirajte stroškovno strukturo stroja.' : 'Configure machine cost structure to calculate the hourly rate.'}</p>
                {/* Capacity card */}
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="w-2.5 h-2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <span className="text-[10px] font-semibold text-gray-800">{sl ? 'Kapaciteta' : 'Capacity'}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[[sl?'Prod. dni':'Prod. days','240',sl?'dni/leto':'days/yr'],[sl?'Izmene':'Shifts','1',sl?'izm/dan':'shifts/day'],[sl?'Čas/izmena':'Runtime/shift','8',sl?'h/izmena':'h/shift'],[sl?'Izkoriščenost':'Utilization','85','%']].map(([l,v,u])=>(
                      <div key={l}><p className="text-[8px] text-gray-400 mb-1">{l}</p><div className="border border-gray-200 rounded px-1.5 py-1 flex items-center justify-between"><span className="text-[9.5px] text-gray-800">{v}</span><span className="text-[8px] text-gray-400">{u}</span></div></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 flex justify-between"><span className="text-[9px] text-gray-500">{sl?'Razpoložljive ure/leto':'Available hours / yr'}</span><span className="text-[9px] font-semibold text-gray-800">1.920 h</span></div>
                    <div className="flex-1 bg-blue-50 rounded-lg px-2 py-1.5 flex justify-between"><span className="text-[9px] text-blue-600">{sl?'Neto op. ure/leto':'Net operating hours / yr'}</span><span className="text-[9px] font-bold text-blue-600">1.632 h</span></div>
                  </div>
                </div>
                {/* Fixed costs card */}
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="w-2.5 h-2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
                    <span className="text-[10px] font-semibold text-gray-800">{sl ? 'Fiksni stroški' : 'Fixed costs'}</span>
                  </div>
                  <div className="grid grid-cols-3 text-[8.5px] text-gray-400 mb-1 px-1"><span>{sl?'Postavka':'Item'}</span><span className="text-right">{sl?'Na leto':'Per year'}</span><span className="text-right">{sl?'Na uro':'Per hour'}</span></div>
                  {[['Depreciation','8.000,00 €','4,90 €'],['Interest','1.350,00 €','0,83 €'],['Insurance','1.275,00 €','0,78 €'],['Space','1.260,00 €','0,77 €']].map(([l,y,h])=>(
                    <div key={l} className="grid grid-cols-3 text-[9px] px-1 py-0.5 border-t border-gray-50"><span className="text-gray-500">{l}</span><span className="text-right text-gray-700">{y}</span><span className="text-right text-gray-700">{h}</span></div>
                  ))}
                  <div className="grid grid-cols-3 text-[9px] px-1 py-1 border-t border-gray-200 mt-0.5"><span className="font-semibold text-gray-900">{sl?'Skupaj fiksni':'Fixed costs'}</span><span className="text-right font-semibold text-gray-900">11.885,00 €</span><span className="text-right font-semibold text-gray-900">7,28 €</span></div>
                </div>
              </div>
            )}

            {/* VARIABLE COSTS + SUMMARY */}
            {step === 'variable' && (
              <div className="px-4 py-3 flex flex-col gap-2.5 overflow-hidden h-full">
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="w-2.5 h-2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
                    <span className="text-[10px] font-semibold text-gray-800">{sl ? 'Variabilni stroški' : 'Variable costs'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[[sl?'Vzdrževanje':'Maintenance','4','%/leto'],[sl?'Moč (prod.)':'Power (prod.)','22','kW'],[sl?'Strošek energije':'Energy cost','0,16','€/kWh'],[sl?'Orodje':'Tooling','6.000','€/leto']].map(([l,v,u])=>(
                      <div key={l}><p className="text-[8px] text-gray-400 mb-0.5">{l}</p><div className="border border-gray-200 rounded px-1.5 py-1 flex items-center justify-between"><span className="text-[9.5px] text-gray-800">{v}</span><span className="text-[8px] text-gray-400">{u}</span></div></div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 text-[8.5px] text-gray-400 mb-1 px-1"><span>{sl?'Postavka':'Item'}</span><span className="text-right">{sl?'Na leto':'Per year'}</span><span className="text-right">{sl?'Na uro':'Per hour'}</span></div>
                  {[['Maintenance','3.400,00 €','2,08 €'],['Electricity','5.744,64 €','3,52 €'],['Tooling','6.000,00 €','3,68 €'],['Other','1.020,00 €','0,62 €']].map(([l,y,h])=>(
                    <div key={l} className="grid grid-cols-3 text-[9px] px-1 py-0.5 border-t border-gray-50"><span className="text-gray-500">{l}</span><span className="text-right text-gray-700">{y}</span><span className="text-right text-gray-700">{h}</span></div>
                  ))}
                  <div className="grid grid-cols-3 text-[9px] px-1 py-1 border-t border-gray-200 mt-0.5"><span className="font-semibold text-gray-900">{sl?'Skupaj variabilni':'Variable costs'}</span><span className="text-right font-semibold text-gray-900">16.164,64 €</span><span className="text-right font-semibold text-gray-900">9,90 €</span></div>
                </div>
                {/* Summary */}
                <div className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="w-2.5 h-2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <span className="text-[10px] font-semibold text-gray-800">Summary</span>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] text-blue-700 font-medium">{sl ? 'Urna postavka' : 'Hourly rate'}</span>
                    <span className="text-[16px] font-bold text-blue-600">17,19 €</span>
                  </div>
                </div>
              </div>
            )}

            {/* OPERATORS LIST */}
            {step === 'operators' && (
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                  <div className="border border-gray-200 rounded-md px-2 py-1 flex items-center gap-1.5 flex-1 max-w-[140px]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span className="text-[9px] text-gray-400">Operator / role</span>
                  </div>
                </div>
                <div className="grid text-[9px] font-medium text-gray-400 px-4 py-1.5 border-b border-gray-100" style={{gridTemplateColumns:'1fr 90px 80px 60px'}}>
                  <span>Operator / role</span><span className="text-right">Annual cost</span><span className="text-right">Hourly rate</span><span className="text-center">Status</span>
                </div>
                <div className="overflow-hidden flex-1">
                  {operators.map((o, i) => (
                    <div key={i} className="grid items-center px-4 py-2 border-b border-gray-50 text-[9.5px]" style={{gridTemplateColumns:'1fr 90px 80px 60px'}}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-blue-50 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="w-2.5 h-2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <span className="text-gray-800 font-medium truncate">{o.name}</span>
                      </div>
                      <span className="text-gray-600 text-right">{o.annual}</span>
                      <span className="text-gray-800 font-medium text-right">{o.rate}</span>
                      <div className="flex justify-center"><span className="text-[8.5px] font-medium text-green-700 bg-green-50 rounded-full px-1.5 py-0.5">Active</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type CalcStep = 'material' | 'operation' | 'result' | 'quantities'

function CalcMockup({ isSl }: { isSl: boolean }) {
  const [step, setStep] = useState<CalcStep>('material')
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const steps: CalcStep[] = ['material', 'operation', 'result', 'quantities']
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setStep(s => {
          const i = steps.indexOf(s)
          return steps[(i + 1) % steps.length]
        })
        setFading(false)
      }, 300)
    }, 3800)
    return () => clearInterval(id)
  }, [])

  const sl = isSl

  const stepLabels: Record<CalcStep, string> = {
    material:   sl ? '1 · Surovina'       : '1 · Raw material',
    operation:  sl ? '2 · CNC operacija'  : '2 · CNC operation',
    result:     sl ? '3 · Režija'          : '3 · Overheads',
    quantities: sl ? '4 · Rezultati'       : '4 · Results',
  }

  // Reuse same nav icons style as HeroMockup
  const navIco = {
    dashboard: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    quotes:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    customers: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    materials: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    machines:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>,
    labor:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/></svg>,
    overheads: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    users:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    settings:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    panelleft: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>,
    building:  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>,
    logout:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  }

  function SideItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
    return (
      <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg mb-0.5 text-[11px] font-medium ${active ? 'bg-[#f1f1f1] text-gray-900' : 'text-gray-900'}`}>
        <span className="shrink-0 text-gray-500 flex items-center">{icon}</span>
        {label}
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-[0_24px_80px_rgba(0,0,0,.10)]">
      {/* Browser chrome */}
      <div className="bg-[#f6f6f6] border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"/><div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"/><div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"/>
        </div>
        <div className="flex-1 mx-2 bg-white rounded-md h-5 flex items-center px-3 border border-gray-200/60">
          <span className="text-[10px] text-gray-400">obrtdesk.com/calculation</span>
        </div>
      </div>

      {/* App shell */}
      <div className="bg-white flex" style={{ height: 460 }}>

        {/* ── Sidebar — identical to HeroMockup ── */}
        <aside className="w-[172px] bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 h-full">
          {/* Logo row */}
          <div className="h-9 px-3 border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 40 40" fill="none">
                <polyline points="26,6 10,20 26,34" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="33,6 17,20 33,34" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.28"/>
              </svg>
              <span className="text-[12px] font-semibold text-gray-900">Obrtdesk</span>
            </div>
            <span className="text-gray-400">{navIco.panelleft}</span>
          </div>
          {/* Company pill */}
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-gray-200">
              <span className="text-gray-400">{navIco.building}</span>
              <span className="text-[10px] font-medium text-gray-900 truncate">TCE d.o.o.</span>
            </div>
          </div>
          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
            <SideItem icon={navIco.dashboard} label={sl ? 'Poročila' : 'Reports'} />
            <SideItem icon={navIco.quotes}    label={sl ? 'Ponudbe' : 'Quotes'} active />
            <SideItem icon={navIco.customers} label={sl ? 'Stranke' : 'Customers'} />
            <SideItem icon={navIco.materials} label={sl ? 'Materiali' : 'Materials'} />
            <SideItem icon={navIco.machines}  label={sl ? 'Stroji' : 'Machines'} />
            <SideItem icon={navIco.labor}     label={sl ? 'Operaterji' : 'Operators'} />
            <SideItem icon={navIco.overheads} label={sl ? 'Stroški režije' : 'Overhead costs'} />
            <SideItem icon={navIco.users}     label={sl ? 'Uporabniki' : 'Users'} />
          </nav>
          {/* Bottom */}
          <div className="border-t border-gray-200 px-1.5 pt-1">
            <SideItem icon={navIco.settings} label={sl ? 'Nastavitve' : 'Settings'} />
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-[22px] h-[22px] rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-semibold shrink-0">MS</div>
              <span className="text-[10px] font-medium text-gray-900 flex-1 truncate">Miha Sajovic</span>
              <span className="text-gray-400">{navIco.logout}</span>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Page header — breadcrumb + title */}
          <div className="h-9 border-b border-gray-200 bg-white px-4 flex items-center shrink-0">
            <span className="text-[10px] text-gray-400 mr-1.5">←</span>
            <span className="text-[10px] text-gray-400">{sl ? 'Pregled ponudbe' : 'Review offer'}</span>
          </div>
          {/* Sub-header: quote name + step indicator */}
          <div className="border-b border-gray-200 px-4 py-2.5 flex items-center justify-between bg-white shrink-0">
            <div>
              <p className="text-[13px] font-semibold text-gray-900">{sl ? 'Sklop ležajnega ohišja' : 'Bearing housing assembly'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{sl ? 'Ponudba Q20260009' : 'Quote Q20260009'}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(['material','operation','result','quantities'] as CalcStep[]).map(s => (
                  <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step === s ? 'w-6 bg-gray-900' : 'w-1.5 bg-gray-200'}`}/>
                ))}
              </div>
              <div className="text-[9.5px] text-gray-500 border border-gray-200 rounded-md px-2 py-1 bg-gray-50">{stepLabels[step]}</div>
            </div>
          </div>

          {/* Content — fades between steps */}
          <div className="flex-1 overflow-hidden px-4 py-3 transition-all duration-300"
            style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(5px)' : 'translateY(0)' }}>

            {step === 'material' && (
              <div className="flex flex-col gap-3">
                {/* Section header */}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-800">{sl ? 'Surovina' : 'Raw material'}</p>
                  <span className="text-[10px] text-blue-600 font-medium">+ {sl ? 'Dodaj material' : 'Add material'}</span>
                </div>

                {/* Material card — matches real app: relative + pr-10 + absolute controls */}
                <div className="relative border border-gray-200 rounded-xl p-3 pr-10 bg-white">
                  {/* Chevron + trash — absolute top-right */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.8" strokeLinecap="round" className="w-3 h-3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </div>

                  {/* Row 1: Shape | Material | Price/kg */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Oblika' : 'Shape'}</label>
                      <div className="border border-gray-200 rounded-md px-2 py-[7px] flex items-center justify-between bg-white">
                        <span className="text-[12px] font-bold text-gray-900">Rect. bar</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5 shrink-0 ml-1"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Izberi material' : 'Select material'}</label>
                      <div className="border border-gray-200 rounded-md px-2 py-1.5 flex items-center justify-between bg-white">
                        <span className="text-[10px] text-gray-800">Al EN AW-6082</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5 shrink-0 ml-1"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Cena / kg' : 'Price / kg'}</label>
                      <div className="border border-gray-200 rounded-md flex items-center bg-white">
                        <span className="text-[10px] text-gray-800 px-2 py-1.5 flex-1">5,20</span>
                        <span className="text-[8.5px] text-gray-400 pr-2 shrink-0">€/kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: W | T | L | Pcs/stock | Scrap% */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {([
                      [sl ? 'Širina' : 'Width',     '65', 'mm'],
                      [sl ? 'Deb.' : 'Thickness',   '60', 'mm'],
                      [sl ? 'Dolžina' : 'Length',   '60', 'mm'],
                      [sl ? 'Kos/zal.' : 'Pcs/stk', '1',  ''],
                      [sl ? 'Odpad' : 'Scrap',       '0',  '%'],
                    ] as [string,string,string][]).map(([lbl, val, unit]) => (
                      <div key={lbl} className="flex flex-col gap-1">
                        <label className="text-[9px] font-medium text-gray-500">{lbl}</label>
                        <div className="border border-gray-200 rounded-md flex items-center bg-white">
                          <span className="text-[10px] text-gray-800 px-2 py-1.5 flex-1">{val}</span>
                          {unit && <span className="text-[8.5px] text-gray-400 pr-1.5 shrink-0">{unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: density · volume · weight · total */}
                  <div className="flex flex-wrap items-center gap-x-4 pt-2 border-t border-gray-200 text-[9px]">
                    <span className="text-gray-500">{sl ? 'Gostota' : 'Density'}: <strong className="text-gray-800">2,7 g/cm³</strong></span>
                    <span className="text-gray-500">{sl ? 'Volumen' : 'Volume'}: <strong className="text-gray-800">234 cm³</strong></span>
                    <span className="text-gray-500">{sl ? 'Teža' : 'Weight'}: <strong className="text-gray-800">0,632 kg</strong></span>
                    <span className="ml-auto text-gray-500">{sl ? 'Skupaj' : 'Total'}: <strong className="text-gray-900">3,29 €</strong></span>
                  </div>
                </div>

                {/* Add purchased parts placeholder */}
                <div className="border border-dashed border-gray-200 rounded-xl p-3 flex items-center justify-center">
                  <span className="text-[10px] text-gray-400">+ {sl ? 'Nakupljeni deli' : 'Purchased parts'}</span>
                </div>
              </div>
            )}

            {step === 'operation' && (
              <div className="flex flex-col gap-3">
                {/* Section header */}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-800">{sl ? 'Operacije' : 'Operations'}</p>
                  <span className="text-[10px] text-blue-600 font-medium">+ {sl ? 'Dodaj operacijo' : 'Add operation'}</span>
                </div>

                {/* Operation card */}
                <div className="relative border border-gray-200 rounded-xl p-3 pr-10 bg-white">
                  {/* Chevron + trash — absolute top-right */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.8" strokeLinecap="round" className="w-3 h-3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </div>

                  {/* Operation name — full width, large bold */}
                  <div className="flex flex-col gap-1 mb-3">
                    <label className="text-[9px] font-medium text-gray-500">{sl ? 'Ime operacije' : 'Operation name'}</label>
                    <div className="border border-gray-200 rounded-md px-2 py-[7px] flex items-center justify-between bg-white">
                      <span className="text-[12px] font-bold text-gray-900">CNC milling</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5 shrink-0 ml-1"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>

                  {/* Machine select + machine rate — side by side */}
                  <div className="flex items-end gap-2 mb-3">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Stroj' : 'Machine'}</label>
                      <div className="border border-gray-200 rounded-md px-2 py-1.5 flex items-center justify-between bg-white">
                        <span className="text-[10px] text-gray-800">3-osni CNC</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5 shrink-0 ml-1"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    <div className="w-[90px] shrink-0 flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Stroj (€/h)' : 'Machine (€/h)'}</label>
                      <div className="border border-gray-200 rounded-md flex items-center bg-gray-50">
                        <span className="text-[10px] text-gray-500 px-2 py-1.5 flex-1">17,19</span>
                        <span className="text-[8.5px] text-gray-400 pr-2">€/h</span>
                      </div>
                    </div>
                  </div>


                  {/* Cycle min + pcs/cycle */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Cikel (min)' : 'Cycle (min)'}</label>
                      <div className="border border-gray-200 rounded-md flex items-center bg-white">
                        <span className="text-[10px] text-gray-800 px-2 py-1.5 flex-1">55,00</span>
                        <span className="text-[8.5px] text-gray-400 pr-2 shrink-0">min</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Kos/cikel' : 'Pcs/cycle'}</label>
                      <div className="border border-gray-200 rounded-md flex items-center bg-white">
                        <span className="text-[10px] text-gray-800 px-2 py-1.5">1</span>
                      </div>
                    </div>
                  </div>

                  {/* Operator row: select + qty + rate */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Operater' : 'Operator'}</label>
                      <div className="border border-gray-200 rounded-md px-2 py-1.5 flex items-center justify-between bg-white">
                        <span className="text-[10px] text-gray-800">CNC operator</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="w-2.5 h-2.5 shrink-0 ml-1"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Število' : 'Qty'}</label>
                      <div className="border border-gray-200 rounded-md flex items-center bg-white">
                        <span className="text-[10px] text-gray-800 px-2 py-1.5">1</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-medium text-gray-500">{sl ? 'Operater (€/h)' : 'Operator (€/h)'}</label>
                      <div className="border border-gray-200 rounded-md flex items-center bg-gray-50">
                        <span className="text-[10px] text-gray-500 px-2 py-1.5 flex-1">28,38</span>
                        <span className="text-[8.5px] text-gray-400 pr-2">€/h</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-[9px]">
                    <span className="text-gray-500">
                      {sl ? 'Tek' : 'Run'}: <strong className="text-gray-800">41,77 €/pc</strong>
                      {' · '}{sl ? 'Priprava' : 'Setup'}: <strong className="text-gray-800">45,57 €/lot</strong>
                    </span>
                    <span className="font-semibold text-gray-900 text-[11px]">42,23 €/pc</span>
                  </div>
                </div>

                {/* Add next operation placeholder */}
                <div className="border border-dashed border-gray-200 rounded-xl p-2.5 flex items-center justify-center">
                  <span className="text-[10px] text-gray-400">+ {sl ? 'Dodaj operacijo' : 'Add operation'}</span>
                </div>
              </div>
            )}

            {step === 'result' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold text-gray-800">{sl ? 'Režija' : 'Overheads'}</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden text-[10px]">
                  {([
                    [sl ? 'Neposredni stroški' : 'Direct costs', '54,54 €', true],
                    [sl ? 'Materialna režija (10%)' : 'Material overhead (10%)', '0,55 €', false],
                    [sl ? 'Proizvod. režija (35%)' : 'Manufacturing OH (35%)', '17,15 €', false],
                    [sl ? 'Skupaj brez marže' : 'Subtotal', '72,25 €', true],
                    ['SG&A (8,89%)', '6,42 €', false],
                    [sl ? 'Logistika (3,06%)' : 'Logistics (3.06%)', '2,21 €', false],
                    [sl ? 'Lastna cena' : 'Cost / piece', '82,28 €', true],
                    [sl ? 'Marža (15%)' : 'Profit margin (15%)', '12,34 €', false],
                  ] as [string, string, boolean][]).map(([label, val, bold]) => (
                    <div key={label} className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-100 last:border-b-0 ${bold ? 'bg-gray-50' : ''}`}>
                      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-500'}>{label}</span>
                      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>{val}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-100">
                    <span className="text-gray-900 font-semibold text-[11px]">{sl ? 'Prodajna cena / kos' : 'Selling price / piece'}</span>
                    <span className="text-gray-900 font-bold text-[13px]">94,63 €</span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden text-[9px]">
                  <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100 px-3 py-1.5 text-gray-500 font-medium">
                    <span>{sl ? 'Kosov' : 'Qty'}</span><span className="text-right">100 pc</span><span className="text-right">1.000 pc</span><span className="text-right">10.000 pc</span>
                  </div>
                  {([[sl ? 'Cena/kos' : 'Cost/pc','82,28 €','80,78 €','80,63 €'],[sl ? 'Prodajno/kos' : 'Sell/pc','94,63 €','92,90 €','92,72 €']] as string[][]).map(([lbl,...vals]) => (
                    <div key={lbl} className="grid grid-cols-4 px-3 py-1.5 border-b border-gray-100 last:border-b-0">
                      <span className="text-gray-500">{lbl}</span>
                      {vals.map(v => <span key={v} className="text-right text-gray-800 font-medium">{v}</span>)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'quantities' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold text-gray-800">{sl ? 'Rezultati kalkulacije' : 'Calculation results'}</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden text-[9.5px]">
                  <div className="grid px-3 py-2 bg-gray-50 border-b border-gray-100 text-gray-500 font-medium" style={{gridTemplateColumns:'1fr 80px 80px 80px'}}>
                    <span></span><span className="text-right">10 pc</span><span className="text-right">15 pc</span><span className="text-right">20 pc</span>
                  </div>
                  {([
                    [sl ? 'Strošek materiala' : 'Material cost',        '5,56 €',   '5,56 €',      '5,56 €',      false],
                    [sl ? 'Strošek operacij'  : 'Operations cost',      '42,23 €',  '42,23 €',     '42,23 €',     false],
                    [sl ? 'Pakiranje'         : 'Packaging',            '0,00 €',   '0,00 €',      '0,00 €',      false],
                    [sl ? 'Režija'            : 'Overhead',             '17,74 €',  '17,74 €',     '17,74 €',     false],
                    [sl ? 'Lastna cena'       : 'Cost / piece',         '82,28 €',  '80,78 €',     '80,63 €',     true],
                    [sl ? 'Marža / kos'       : 'Margin / piece',       '12,34 €',  '12,12 €',     '12,09 €',     false],
                    [sl ? 'Prodajna cena'     : 'Selling price / piece','94,63 €',  '92,90 €',     '92,72 €',     true],
                    [sl ? 'Vrednost ponudbe'  : 'Quote value',          '946,30 €', '1.393,50 €',  '1.854,40 €',  false],
                  ] as [string,string,string,string,boolean][]).map(([lbl,v1,v2,v3,bold]) => (
                    <div key={lbl} className={`grid px-3 py-1.5 border-b border-gray-100 last:border-b-0 ${bold ? 'bg-gray-50' : ''}`} style={{gridTemplateColumns:'1fr 80px 80px 80px'}}>
                      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-500'}>{lbl}</span>
                      <span className={`text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{v1}</span>
                      <span className={`text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{v2}</span>
                      <span className={`text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{v3}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


function FeatureCard({ Icon, title, desc, delay }: { Icon: React.ElementType; title: string; desc: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <div ref={ref}
      className={`p-7 border-b border-r border-gray-100 last:border-r-0 transition-all duration-600 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center mb-4">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
    </div>
  )
}

function ForWhomCard({ Icon, label, desc, delay }: { Icon: React.ElementType; label: string; desc: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <div ref={ref}
      className={`group p-7 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-gray-900 flex items-center justify-center mb-4 transition-colors duration-300">
        <Icon className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors duration-300" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{label}</h3>
      <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
    </div>
  )
}

function StepCard({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <div ref={ref}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="text-5xl font-bold text-gray-100 mb-4 tabular-nums">{num}</div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
    </div>
  )
}

function TestiCard({ quote, name, role }: { quote: string; name: string; role: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <div ref={ref}
      className={`flex flex-col gap-5 p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="flex gap-0.5">
        {[0,1,2,3,4].map(i => <Star key={i} className="w-4 h-4 fill-gray-900 text-gray-900" />)}
      </div>
      <p className="text-gray-600 leading-relaxed text-sm flex-1">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
          {name[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN
═══════════════════════════════════════════ */
export default function LandingPage() {
  const { session, loading } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const l = t.landing
  const isSl = lang === 'sl'
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      supabase.rpc('is_super_admin').then(({ data }) => {
        navigate(data ? '/super-admin' : '/dashboard', { replace: true })
      })
    }
  }, [session, loading])

  if (loading) return null

  const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const

  const forWhom = isSl ? [
    { Icon: Settings,   label: 'Orodjarne',                       desc: 'Natančen izračun strojnih ur, materiala in dela za orodja, forme in priprave.' },
    { Icon: Calculator, label: 'CNC obdelava',                    desc: 'Vsaka operacija od rezkanja, struženja in EDM ima svojo urno postavko in čas obdelave.' },
    { Icon: Zap,        label: 'Varjenje in jeklene konstrukcije', desc: 'Kalkulacija stroškov materiala, časa varjenja in stroškov površinske obdelave za varjene sestave.' },
    { Icon: FileText,   label: 'Lasersko rezanje',                desc: 'Stroški rezanja, upogibanja in obdelave pločevine po materialu in debelini.' },
    { Icon: BarChart2,  label: 'Maloserijska proizvodnja',        desc: 'Vsak kos zahteva svojo kalkulacijo. Obrtdesk zagotavlja enoten proces za vsako serijo.' },
    { Icon: TrendingUp, label: 'Kooperacija',                     desc: 'Stroški zunanjih storitev so skupaj z lastnimi stroški vključeni v eno ponudbo.' },
  ] : [
    { Icon: Settings,   label: 'Tool & Die Shops',           desc: 'Precise calculation of machine hours, materials and labor for tools, molds and fixtures.' },
    { Icon: Calculator, label: 'CNC Machining',              desc: 'Every operation from milling, turning or EDM, has its own hourly rate and cycle time.' },
    { Icon: Zap,        label: 'Welding & Steel Structures', desc: 'Material, welding time and surface treatment costs calculated together for every assembly.' },
    { Icon: FileText,   label: 'Laser Cutting & Sheet Metal',desc: 'Cutting and forming costs based on material type, thickness and machine time.' },
    { Icon: BarChart2,  label: 'Custom Manufacturing',       desc: 'Every part needs its own calculation. Obrtdesk gives your team a consistent process.' },
    { Icon: TrendingUp, label: 'Subcontracting',             desc: 'External service and subcontractor costs included alongside your own in a single quote.' },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased overflow-x-hidden">

      {/* ══ NAV ══ */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <AppLogo size="sm" mono />
          </a>
          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            <a href="#features" className="text-[15px] font-medium transition-colors hover:opacity-70" style={{ color: '#2e3238' }}>{l.navFeatures}</a>
            <a href="#how-it-works" className="text-[15px] font-medium transition-colors hover:opacity-70" style={{ color: '#2e3238' }}>{l.navHowItWorks}</a>
            <a href="#faq" className="text-[15px] font-medium transition-colors hover:opacity-70" style={{ color: '#2e3238' }}>FAQ</a>
          </div>
          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 mr-1">
              {(['en', 'sl'] as const).map(lng => (
                <button key={lng} onClick={() => setLang(lng)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${lang === lng ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
            <Link to="/login"
              className="hidden md:block text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-gray-200">
              {l.navSignIn}
            </Link>
            <Link to="/register"
              className="hidden sm:block bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
              {l.navCta}
            </Link>
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu">
              {mobileOpen
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 text-gray-700"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 text-gray-700"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
              }
            </button>
          </div>
        </div>
        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-1">
            <a href="#features" onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-700 py-2.5 border-b border-gray-50 hover:text-gray-900 transition-colors">{l.navFeatures}</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-700 py-2.5 border-b border-gray-50 hover:text-gray-900 transition-colors">{l.navHowItWorks}</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-700 py-2.5 border-b border-gray-50 hover:text-gray-900 transition-colors">FAQ</a>
            <div className="flex items-center gap-2 pt-2 border-b border-gray-50 pb-2.5">
              <span className="text-xs text-gray-400 mr-1">{lang === 'sl' ? 'Jezik' : 'Language'}:</span>
              {(['en', 'sl'] as const).map(lng => (
                <button key={lng} onClick={() => setLang(lng)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${lang === lng ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="text-sm text-gray-600 font-medium text-center py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                {l.navSignIn}
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}
                className="text-sm text-white font-semibold text-center py-2.5 rounded-lg bg-gray-900 hover:bg-gray-700 transition-colors">
                {l.navCta}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══ HERO ══ */}
      <section className="pt-10 md:pt-20 pb-16 text-center px-6 relative">
        {/* Blobs clipped to section bounds */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          {/* Blue gradient blob — top-right */}
          <div className="absolute -top-32 -right-64 w-[280px] h-[280px] md:w-[600px] md:h-[600px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.09) 45%, transparent 72%)', transform: 'rotate(-20deg)', filter: 'blur(40px)' }}/>
          {/* Secondary blob — left */}
          <div className="absolute top-56 -left-24 w-[240px] h-[240px] md:w-[500px] md:h-[500px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.17) 0%, transparent 65%)', filter: 'blur(36px)' }}/>
        </div>
        <div className="relative" style={{ zIndex: 1 }}>
        {/* Announcement pill */}
        <div className="animate-fade-up flex justify-center mb-10" style={{ animationDelay: '0.05s' }}>
          <a href="#features"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 rounded-full px-[1px] py-[1px] transition-colors"
            style={{ background: 'linear-gradient(135deg, #bfdbfe, #a5c8fd)' }}>
            <span className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 hover:bg-gray-50 transition-colors">
            {isSl ? 'BETA · Brezplačno med testiranjem' : 'BETA · Free during beta'}
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </span>
          </a>
        </div>

        {/* Giant headline */}
        <div className="animate-fade-up max-w-[1100px] mx-auto mb-6" style={{ animationDelay: '0.12s' }}>
          <h1 className="font-semibold text-gray-900 tracking-tight" style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)', lineHeight: 1.08 }}>
            {l.heroTitle1}{l.heroTitle2 && <><br />{l.heroTitle2}</>}{l.heroTitle3 && <><br />{l.heroTitle3}</>}
          </h1>
        </div>

        {/* Subtitle */}
        <p className="animate-fade-up text-lg font-normal max-w-xl mx-auto mb-10 leading-relaxed text-gray-500" style={{ animationDelay: '0.2s' }}>
          {l.heroSubtitle}
        </p>

        {/* CTAs */}
        <div className="animate-fade-up flex flex-col sm:flex-row items-center justify-center gap-3 mb-16" style={{ animationDelay: '0.28s' }}>
          <Link to="/register"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors text-sm">
            {l.heroCtaPrimary} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/login"
            className="w-full sm:w-auto text-sm text-gray-600 font-semibold px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            {l.heroCtaSecondary}
          </Link>
        </div>

        {/* Product mockup — Attio style, centered, wide */}
        <div className="animate-fade-up max-w-[1340px] mx-auto" style={{ animationDelay: '0.38s' }}>
          <div className="min-w-[700px]">
            <HeroMockup isSl={isSl} />
          </div>
        </div>
        </div>{/* end relative z-1 */}
      </section>

      {/* ══ STATS ══ */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <div className="border border-gray-100 rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-3">
          {([
            { val: l.stat1Val, label: l.stat1Label },
            { val: l.stat2Val, label: l.stat2Label },
            { val: l.stat3Val, label: l.stat3Label },
          ]).map(({ val, label }, i) => (
            <FadeUp key={label} delay={i * 60}
              className="px-10 py-12 border-b sm:border-b-0 sm:border-r border-gray-100 last:border-r-0 flex flex-col items-start">
              <p className="text-5xl font-semibold text-gray-900 mb-2 tracking-tight">{val}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="border-t border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 pt-20 pb-0">
          <FadeUp className="mb-14">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-3">{l.featuresTitle}</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] max-w-xl">
                {l.featuresHeading}
              </h2>
              <p className="text-gray-500 max-w-sm leading-relaxed text-sm sm:text-base">{l.featuresSubtitle}</p>
            </div>
          </FadeUp>
        </div>
        {/* Feature grid — border style like Attio */}
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="border border-gray-100 rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard Icon={Calculator} title={l.feature1Title} desc={l.feature1Desc} delay={0}   />
            <FeatureCard Icon={Zap}        title={l.feature2Title} desc={l.feature2Desc} delay={60}  />
            <FeatureCard Icon={TrendingUp} title={l.feature3Title} desc={l.feature3Desc} delay={120} />
            <FeatureCard Icon={Box}        title={l.feature4Title} desc={l.feature4Desc} delay={0}   />
            <FeatureCard Icon={FileText}   title={l.feature5Title} desc={l.feature5Desc} delay={60}  />
            <FeatureCard Icon={BarChart2}  title={l.feature6Title} desc={l.feature6Desc} delay={120} />
          </div>
        </div>
        <div className="h-20" />
      </section>

      {/* ══ DASHBOARD — alternating ══ */}
      <section className="border-t border-gray-100 py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeUp>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-4">
                {isSl ? 'Pregled' : 'Analytics'}
              </p>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-5">
                {isSl ? 'Vse ponudbe na enem mestu' : 'All your quotes in one place'}
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                {isSl
                  ? 'Nadzorna plošča prikazuje vrednost poslanih, dobljenih in izgubljenih ponudb. Do celotne analitike lahko dostopate na enem mestu.'
                  : 'The dashboard shows the value of sent, won and lost quotes. You always know where you stand.'}
              </p>
              <div className="flex flex-col gap-3">
                {(isSl
                  ? ['Skupna vrednost oddanih ponudb', 'Skupna vrednost dobljenih poslov', 'Mesečni trend ponudb']
                  : ['Sent value tracking', 'Win rate tracking', 'Monthly quote trend']
                ).map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
            <FadeUp delay={100}>
              <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-[0_24px_80px_rgba(0,0,0,.10)]" style={{ maxHeight: 460 }}>
                <div style={{ width: 900 }}>
                  <HeroMockup isSl={isSl} views={['dashboard', 'quotes']} />
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ CALCULATION ══ */}
      <section className="border-t border-gray-100 py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeUp delay={100} className="order-2 lg:order-1 overflow-hidden">
              <div style={{ minWidth: 640 }}>
                <CalcMockup isSl={isSl} />
              </div>
            </FadeUp>
            <FadeUp className="order-1 lg:order-2">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-4">
                {isSl ? 'Kalkulacija' : 'Cost calculation'}
              </p>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-5">
                {isSl ? 'Natančna kalkulacija za vsak kos' : 'Accurate cost breakdown for every part'}
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                {isSl
                  ? 'Dodajte materiale, operacije, kupljene dele in režijske stroške. Obrtdesk samodejno izračuna lastno ceno in prodajno ceno za vsako količino.'
                  : 'Add raw materials, operations, purchased parts, tooling and overheads. Obrtdesk automatically calculates cost price and selling price for up to 3 different quantities.'}
              </p>
              <div className="flex flex-col gap-3">
                {(isSl
                  ? ['Vrsta materiala, oblika in teža', 'Strojne operacije z zagonom serije in časom obdelave', 'Lastna cena + režija + marža = prodajna cena']
                  : ['Material cost from built-in material library', 'Machine operations with setup and cycle time', 'Cost price + overhead + margin = selling price']
                ).map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ RATES ══ */}
      <section className="border-t border-gray-100 py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeUp>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-4">
                {isSl ? 'Urne postavke' : 'Hourly rates'}
              </p>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-5">
                {isSl ? 'Podroben izračun urnih postavk za vsak stroj in operaterja' : 'Detailed hourly rates for every machine and operator'}
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                {isSl
                  ? 'Vnesite investicijo, kapaciteto, fiksne in variabilne stroške. Obrtdesk samodejno izračuna urno postavko stroja. Enako velja za operaterje.'
                  : 'Enter data on investment value, capacity, and energy usage. Obrtdesk automatically calculates the hourly rate. The same applies to every operator.'}
              </p>
              <div className="flex flex-col gap-3">
                {(isSl
                  ? ['Amortizacija, obresti, zavarovanje in prostor', 'Energija, vzdrževanje, orodje in potrošni material', 'Letni stroški operaterja in kapaciteta za izračun urnih postavk']
                  : ['Depreciation, interest, insurance and space costs', 'Energy, maintenance, tooling and consumables', 'Annual operator cost and capacity to calculate hourly rate']
                ).map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
            <FadeUp delay={100} className="overflow-hidden">
              <div style={{ minWidth: 640 }}>
                <RatesMockup isSl={isSl} />
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ FOR WHOM ══ */}
      <section className="border-t border-gray-100 py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <FadeUp className="mb-14">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-3">
              {isSl ? 'Za koga' : 'For whom'}
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] max-w-2xl">
              {isSl ? 'Program za vsak tip proizvodnje' : 'Built for every type of manufacturing'}
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forWhom.map((item, i) => (
              <ForWhomCard key={item.label} {...item} delay={(i % 3) * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how-it-works" className="border-t border-gray-100 py-24 bg-[#fafafa]">
        <div className="max-w-[1440px] mx-auto px-6">
          <FadeUp className="mb-16">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-3">{l.howTitle}</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1] max-w-2xl">{l.howHeading}</h2>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <StepCard num="01" title={l.step1Title} desc={l.step1Desc} delay={0}   />
            <StepCard num="02" title={l.step2Title} desc={l.step2Desc} delay={100} />
            <StepCard num="03" title={l.step3Title} desc={l.step3Desc} delay={200} />
            <StepCard num="04" title={l.step4Title} desc={l.step4Desc} delay={300} />
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      {false && <section className="border-t border-gray-100 py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <FadeUp className="mb-14">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-3">{l.testimonialsTitle}</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1]">{l.testimonialsHeading}</h2>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TestiCard quote={l.t1Quote} name={l.t1Name} role={l.t1Role} />
            <TestiCard quote={l.t2Quote} name={l.t2Name} role={l.t2Role} />
            <TestiCard quote={l.t3Quote} name={l.t3Name} role={l.t3Role} />
          </div>
        </div>
      </section>}

      {/* ══ FAQ ══ */}
      <section id="faq" className="border-t border-gray-100 py-24 bg-[#fafafa]">
        <div className="max-w-2xl mx-auto px-6">
          <FadeUp className="mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">{l.faqHeading}</h2>
          </FadeUp>
          <div className="border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden bg-white">
            {FAQ_KEYS.map(k => (
              <div key={k}>
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === k ? null : k)}>
                  <span className="font-semibold text-gray-900 text-sm leading-relaxed">{l[`${k}Q` as keyof typeof l] as string}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-300 shrink-0 transition-transform duration-200 ${openFaq === k ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === k ? 'max-h-48' : 'max-h-0'}`}>
                  <p className="px-6 pb-5 text-gray-500 leading-relaxed text-sm">{l[`${k}A` as keyof typeof l] as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="py-24 bg-gray-900">
        <FadeUp className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight leading-[1.1]">{l.ctaHeading}</h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">{l.ctaSubtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-100 transition-colors text-base">
              {l.ctaButton} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="w-full sm:w-auto inline-flex items-center justify-center border border-white/20 text-gray-300 hover:text-white hover:border-white/40 font-medium px-6 py-3.5 rounded-xl transition-colors text-base">
              {l.navSignIn}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-gray-400 text-sm font-medium">
            {(isSl
              ? ['Brezplačna registracija', 'Brez kreditne kartice', 'Takojšen dostop']
              : ['Free to register', 'No credit card required', 'Instant access']
            ).map(item => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400" />{item}
              </div>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-gray-900 border-t border-white/[0.07]">
        <div className="max-w-[1440px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-0 justify-between">
          <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="flex items-center gap-2 group">
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <polyline points="26,6 10,20 26,34" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="33,6 17,20 33,34" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
            </svg>
            <span className="text-[15px] font-semibold text-white/90 group-hover:text-white transition-colors">Obrtdesk</span>
          </a>
          <p className="text-sm text-gray-400 order-last sm:order-none">{l.footerRights}</p>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-gray-200 transition-colors">{l.footerPrivacy}</Link>
            <Link to="/terms" className="hover:text-gray-200 transition-colors">{l.footerTerms}</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
