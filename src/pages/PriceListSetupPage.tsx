import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BadgeEuro, Plus, Trash2, Check, Settings2, Upload, TrendingUp, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import NumberInput from '../components/ui/NumberInput'
import { PageHeader } from '../components/ui/PageHeader'
import WindowDrawing from '../components/WindowDrawing'
import ProfileSection from '../components/ProfileSection'
import { costWindow, layoutFor, pricingFrom, makeSpec, makeSlidingSpec, specToLayout, allCombos, comboKey, BAND_KEYS, BAND_SHAPE, allowedBandModes, withBandMode, SAMPLE_PROFILE_PRICES, type PricingSettings, type ProfilePrices, type Offer, type WindowSpec } from '../lib/costing'
import SpecDrawing from '../components/SpecDrawing'
import { cn } from '../lib/cn'
import {
  TEMPLATES, MATERIALS, STARTER, WL, SERVICE_GROUPS, serviceLine, isDoor, isOnRequest,
  type WindowSystem, type WindowType, type WindowOption, type WindowTemplate, type WindowMaterial,
  type OptionGroup, type OptionPricing,
} from '../lib/windows'

// Guided price list: one page, top to bottom. Shapes → materials (price per m²) → colours,
// glass, handles, sills & shading → services. Saving builds window_prices for every
// material × shape automatically, so nobody has to fill in tables.

interface ShapeRow { id?: string; template: WindowTemplate; on: boolean; name: string; surcharge: number | null; min_width: number; max_width: number; min_height: number; max_height: number }
/** one profile system (window_systems row); a material can have several */
interface ProfileRow {
  key: string; id?: string; material: WindowMaterial; name: string; description: string; min: number | null; image_url: string | null
  /** per-metre prices + visible widths in mm */
  frame_m: number | null; sash_m: number | null; mullion_m: number | null; bead_m: number | null
  frame_w: number; sash_w: number; mullion_w: number
}
const toPrices = (p: ProfileRow): ProfilePrices => ({ frame_m: p.frame_m ?? 0, sash_m: p.sash_m ?? 0, mullion_m: p.mullion_m ?? 0, bead_m: p.bead_m ?? 0, frame_w: p.frame_w, sash_w: p.sash_w, mullion_w: p.mullion_w })
// reference window used to compare profiles and to derive the per-m² price for the current configurator
const REF = { template: 'double_mullion' as WindowTemplate, w: 1200, h: 1400 }
interface OptionRow { key: string; id?: string; group_key: OptionGroup; name: string; pricing: OptionPricing; price: number | null; is_default: boolean; swatch?: string }

interface Preset { name: string; pricing: OptionPricing; price: number; swatch?: string }
interface Section { group: OptionGroup; title: string; hint: string; units: OptionPricing[]; single: boolean; presets: Preset[] }

function metreOrSample(x: Partial<WindowSystem> & { material: WindowMaterial }) {
  const has = [x.frame_m, x.sash_m, x.mullion_m, x.bead_m].some(v => Number(v ?? 0) > 0)
  const s = SAMPLE_PROFILE_PRICES[x.material] ?? SAMPLE_PROFILE_PRICES.pvc
  return {
    frame_m: has ? Number(x.frame_m ?? 0) : s.frame_m, sash_m: has ? Number(x.sash_m ?? 0) : s.sash_m,
    mullion_m: has ? Number(x.mullion_m ?? 0) : s.mullion_m, bead_m: has ? Number(x.bead_m ?? 0) : s.bead_m,
    frame_w: Number(x.frame_w ?? 70) || 70, sash_w: Number(x.sash_w ?? 78) || 78, mullion_w: Number(x.mullion_w ?? 82) || 82,
  }
}
const CALC_LABELS = {
  sl: { frame: 'Okvir', mullion: 'Steber / prečka', sash: 'Krila', bead: 'Steklitvene letvice', glass: 'Steklo', labour: 'Delo',
    hw_tilt_turn: 'Okovje odpiranje in kip', hw_turn: 'Okovje odpiranje', hw_tilt: 'Okovje kip', hw_passive: 'Okovje pasivno krilo', hw_slide_window: 'Okovje drsno okno', hw_slide: 'Okovje drsno', hw_lift_slide: 'Okovje dvižno-drsno' },
  en: { frame: 'Frame', mullion: 'Mullion / transom', sash: 'Sashes', bead: 'Glazing beads', glass: 'Glass', labour: 'Labour',
    hw_tilt_turn: 'Hardware tilt & turn', hw_turn: 'Hardware turn', hw_tilt: 'Hardware tilt', hw_passive: 'Hardware passive sash', hw_slide_window: 'Hardware sliding window', hw_slide: 'Hardware sliding', hw_lift_slide: 'Hardware lift & slide' },
}

let seq = 0
const nk = () => `o${++seq}`

const TXT = {
  sl: {
    title: 'Cenik',
    groupWindows: 'Okna', groupDoors: 'Balkonska vrata', onRequest: 'Cena na povpraševanje: stranka pošlje mere, ceno vpišete v ponudbo.',
    catWindows: 'Okna', catSlidingWindows: 'Drsna okna', catDoors: 'Balkonska vrata', catSliding: 'Drsne stene', catSpecial: 'Posebne oblike',
    catEntry: 'Vhodna vrata', catRoof: 'Strešna okna', catGarage: 'Garažna vrata', catShading: 'Senčila', soon: 'Kmalu',
    sashCount: 'Število kril', nSash: (n: number) => n === 1 ? 'Enokrilno okno' : n === 2 ? 'Dvokrilno okno' : n === 3 ? 'Trokrilno okno' : 'Štirikrilno okno',
    bands: 'Nadsvetloba in parapet', bandTop: 'Nadsvetloba', bandTopSplit: 'Razdeljena nadsvetloba', bandBottom: 'Parapet', bandBottomSplit: 'Razdeljen parapet',
    s1b: 'Nastavitve izdelkov', s1bhint: 'Za vsako skupino izdelkov nastavite izvedbe, ki jih izdelujete. Kliknite na skupino, da jo razširite.',
    windowsSummary: (t: number, l: number) => `${t} ${t === 1 ? 'tip okna' : t === 2 ? 'tipa oken' : t <= 4 ? 'tipi oken' : 'tipov oken'} · ${l} načinov odpiranja`,
    typesCount: (a: number, b: number) => `${a} od ${b} izvedb`,
    modeFixed: 'Fiksna', modeTilt: 'Na kip', ofCount: (a: number, b: number) => `${a} od ${b}`, bandsFor: 'Nadsvetloba in parapet', rowSummary: (b: number, o: number) => `${b} od 5 izvedb nadsvetlobe · ${o} načinov odpiranja`,
    bandLabel: { none: 'Brez nadsvetlobe in parapeta', top: 'Z nadsvetlobo', topSplit: 'Z razdeljeno nadsvetlobo', bottom: 'S parapetom', bottomSplit: 'Z razdeljenim parapetom' } as Record<string, string>,
    combosFor: 'Odpiranja, ki jih izdelujete', combosCount: (a: number, b: number) => `${a} od ${b} načinov odpiranja`, showOpenings: 'Odpiranja', showVariants: 'Izvedbe', hideOpenings: 'Skrij', selectAll: 'Izberi vse', clearAll: 'Počisti',
    openings: 'Načini odpiranja', openFixed: 'Fiksno', openingsHint: 'Stranka v konfiguratorju za vsako krilo izbere enega od teh načinov. Cena se izračuna sama iz profila krila in okovja.',
    s1: 'Kaj ponujate?', s1hint: 'Izberite skupine izdelkov in različice oken, ki jih prodajate. Vse kombinacije in cene se izračunajo same.',
    surcharge: 'Doplačilo',
    metrePrices: 'Nabavne cene profila na tekoči meter', frameM: 'Okvir', sashM: 'Krilo', mullionM: 'Steber / prečka', beadM: 'Steklitvena letvica',
    widths: 'Pogledne širine okvir / krilo / steber', frameW: 'Okvir', sashW: 'Krilo', mullionW: 'Steber',
    s3: 'Okovje, steklo, delo in marža', s3hint: 'Velja za vse profile. Iz tega in dolžin profilov aplikacija izračuna ceno vsakega okna, tudi vseh kombinacij kril.',
    hwTitle: 'Okovje na krilo', perSash: 'krilo', hwFixed: 'Fiksno', hwPerM: 'Na tm obsega krila', hwHint: 'Okovje krila = fiksni znesek + cena × obseg krila. Primer: krilo 130 × 150 cm ima obseg 5,6 m, pri 20 € + 1 €/tm je okovje 25,60 €. Pasivno krilo je drugo krilo dvokrilnega okna brez stebrička (brez kljuke).', hw: { tilt_turn: 'Odpiranje in kip', turn: 'Samo odpiranje', tilt: 'Samo kip', passive: 'Pasivno krilo (brez kljuke)', slide_window: 'Drsno okno', slide: 'Drsna stena (PSK)', lift_slide: 'Dvižno-drsna stena' },
    glassM2: 'Osnovno steklo', labourWindow: 'Delo na okno', labourSash: 'Delo na krilo', waste: 'Odrez profilov', margin: 'Marža', bothSides: 'Barva obojestransko',
    calc: 'Kalkulacija', cost: 'Strošek', marginLine: 'Marža', windowPrice: 'Cena okna',
    s2: 'Iz katerih materialov?', s2hint: 'Izberite materiale in pod vsakim dodajte profile, ki jih ponujate. Za vsak profil vpišite nabavne cene na tekoči meter. Najnižja cena okna velja za majhna okna.',
    matName: 'Naziv profila', matNamePh: 'npr. PVC 82 mm, 7 komor', perM2: 'Cena na m²', minPrice: 'Najnižja cena okna',
    description: 'Opis za stranko', descriptionPh: 'npr. Uw do 0,75 W/m²K, primerno za pasivne hiše', addProfile: 'Dodaj profil', isBase: 'Osnovni profil', moreThan: (base: string) => `glede na ${base}`, photo: 'Naloži sliko', photoChange: 'Zamenjaj sliko', photoRemove: 'Odstrani sliko', photoHint: 'Prerez ali fotografija profila. Brez slike se prikaže risba.',
    add: 'Dodaj', name: 'Naziv', price: 'Cena', dflt: 'Privzeto', quick: 'Hitro dodaj:', remove: 'Odstrani',
    save: 'Shrani cenik', saved: 'Cenik je shranjen', unsaved: 'Spremembe niso shranjene',
    example: 'Primer', exampleText: (shape: string, mat: string, price: string) => `${shape}, ${mat}, 1200 × 1400 mm: ${price}`,
    advanced: 'Napredno: cenovne matrike in spletni konfigurator',
    preview: 'Predogled cene', live: 'v živo', width: 'Širina', height: 'Višina', totalNet: 'Skupaj brez DDV', previewHint: 'Vključene so privzete izbire. Tako bo stranka videla ceno v konfiguratorju.',
  },
  en: {
    title: 'Price list',
    groupWindows: 'Windows', groupDoors: 'Balcony doors', onRequest: 'Price on request: the customer sends sizes, you price it in the quote.',
    catWindows: 'Windows', catSlidingWindows: 'Sliding windows', catDoors: 'Balcony doors', catSliding: 'Sliding walls', catSpecial: 'Special shapes',
    catEntry: 'Entrance doors', catRoof: 'Roof windows', catGarage: 'Garage doors', catShading: 'Shading', soon: 'Soon',
    sashCount: 'Number of sashes', nSash: (n: number) => n === 1 ? 'Single sash' : n === 2 ? 'Double sash' : n === 3 ? 'Triple sash' : 'Four sashes',
    bands: 'Top light and bottom panel', bandTop: 'Top light', bandTopSplit: 'Split top light', bandBottom: 'Bottom panel', bandBottomSplit: 'Split bottom panel',
    s1b: 'Product settings', s1bhint: 'For every product group set the variants you make. Click a group to open it.',
    windowsSummary: (t: number, l: number) => `${t} window types · ${l} opening layouts`,
    typesCount: (a: number, b: number) => `${a} of ${b} variants`,
    modeFixed: 'Fixed', modeTilt: 'Tilt', ofCount: (a: number, b: number) => `${a} of ${b}`, bandsFor: 'Top light and bottom panel', rowSummary: (b: number, o: number) => `${b} of 5 top light variants · ${o} opening layouts`,
    bandLabel: { none: 'No top light or bottom panel', top: 'With top light', topSplit: 'With split top light', bottom: 'With bottom panel', bottomSplit: 'With split bottom panel' } as Record<string, string>,
    combosFor: 'Openings you make', combosCount: (a: number, b: number) => `${a} of ${b} opening layouts`, showOpenings: 'Openings', showVariants: 'Variants', hideOpenings: 'Hide', selectAll: 'Select all', clearAll: 'Clear',
    openings: 'Opening types', openFixed: 'Fixed', openingsHint: 'In the configurator the customer picks one of these for every sash. The price follows from the sash profile and hardware.',
    s1: 'What do you offer?', s1hint: 'Select the product groups and window variants you sell. All combinations and prices are calculated automatically.',
    surcharge: 'Surcharge',
    metrePrices: 'Purchase price of the profile per metre', frameM: 'Frame', sashM: 'Sash', mullionM: 'Mullion / transom', beadM: 'Glazing bead',
    widths: 'Visible widths frame / sash / mullion', frameW: 'Frame', sashW: 'Sash', mullionW: 'Mullion',
    s3: 'Hardware, glass, labour and margin', s3hint: 'Applies to all profiles. Together with the profile lengths the app prices every window and every sash combination.',
    hwTitle: 'Hardware per sash', perSash: 'sash', hwFixed: 'Fixed', hwPerM: 'Per metre of sash perimeter', hwHint: 'Sash hardware = fixed amount + price × sash perimeter. Example: a 130 × 150 cm sash has a 5.6 m perimeter; at 20 € + 1 €/m the hardware is 25.60 €. A passive sash is the second sash of a double window without a mullion (no handle).', hw: { tilt_turn: 'Tilt & turn', turn: 'Turn only', tilt: 'Tilt only', passive: 'Passive sash (no handle)', slide_window: 'Sliding window', slide: 'Sliding wall (PSK)', lift_slide: 'Lift & slide wall' },
    glassM2: 'Base glass', labourWindow: 'Labour per window', labourSash: 'Labour per sash', waste: 'Profile waste', margin: 'Margin', bothSides: 'Colour both sides',
    calc: 'Costing', cost: 'Cost', marginLine: 'Margin', windowPrice: 'Window price',
    s2: 'Which materials?', s2hint: 'Select the materials and add the profiles you offer. Enter purchase prices per metre for every profile. The minimum price applies to small windows.',
    matName: 'Profile name', matNamePh: 'e.g. PVC 82 mm, 7 chambers', perM2: 'Price per m²', minPrice: 'Minimum window price',
    description: 'Description for customers', descriptionPh: 'e.g. Uw up to 0.75 W/m²K, passive-house ready', addProfile: 'Add profile', isBase: 'Base profile', moreThan: (base: string) => `vs ${base}`, photo: 'Upload picture', photoChange: 'Replace picture', photoRemove: 'Remove picture', photoHint: 'Cross-section or photo of the profile. Without one a drawing is shown.',
    add: 'Add', name: 'Name', price: 'Price', dflt: 'Default', quick: 'Quick add:', remove: 'Remove',
    save: 'Save price list', saved: 'Price list saved', unsaved: 'Unsaved changes',
    example: 'Example', exampleText: (shape: string, mat: string, price: string) => `${shape}, ${mat}, 1200 × 1400 mm: ${price}`,
    advanced: 'Advanced: price matrices and online configurator',
    preview: 'Price preview', live: 'live', width: 'Width', height: 'Height', totalNet: 'Total excl. VAT', previewHint: 'Default choices are included. This is the price the customer sees in the configurator.',
  },
}

function sectionsFor(lang: 'sl' | 'en'): Section[] {
  const sl = lang === 'sl'
  return [
    { group: 'color', title: sl ? 'Barve' : 'Colours', hint: sl ? 'Za koliko barva zviša ceno okna na m² (bela je običajno brez doplačila).' : 'How much a colour adds to the window price per m² (white is usually free).',
      units: ['m2', 'percent'], single: true,
      presets: [{ name: 'Bela', pricing: 'm2', price: 0, swatch: '#ffffff' }, { name: 'Antracit', pricing: 'm2', price: 35, swatch: '#383e42' }, { name: 'Zlati hrast', pricing: 'm2', price: 45, swatch: '#b5763a' }, { name: 'Orehov les', pricing: 'm2', price: 45, swatch: '#6b4a2e' }, { name: 'Črna', pricing: 'm2', price: 40, swatch: '#1d1d1d' }] },
    { group: 'glass', title: sl ? 'Steklo' : 'Glass', hint: sl ? 'Doplačilo za steklo na m² okna.' : 'Glass surcharge per m² of window.',
      units: ['m2'], single: true,
      presets: [{ name: 'Dvoslojno Ug 1,1', pricing: 'm2', price: 0 }, { name: 'Troslojno Ug 0,6', pricing: 'm2', price: 45 }, { name: 'Varnostno steklo', pricing: 'm2', price: 85 }] },
    { group: 'handle', title: sl ? 'Kljuke' : 'Handles', hint: sl ? 'Cena na kos okna.' : 'Price per window.',
      units: ['piece'], single: true,
      presets: [{ name: 'Standardna kljuka', pricing: 'piece', price: 0 }, { name: 'Kljuka s ključem', pricing: 'piece', price: 28 }] },
    { group: 'sill', title: sl ? 'Police' : 'Sills', hint: sl ? 'Police se običajno računajo na tekoči meter širine okna.' : 'Sills are usually priced per metre of window width.',
      units: ['width', 'piece'], single: false,
      presets: [{ name: 'Notranja polica PVC', pricing: 'width', price: 38 }, { name: 'Zunanja ALU polica', pricing: 'width', price: 42 }] },
    { group: 'shading', title: sl ? 'Senčila in komarniki' : 'Shading and insect screens', hint: sl ? 'Žaluzije in rolete na m², komarniki na kos.' : 'Blinds per m², insect screens per piece.',
      units: ['m2', 'piece', 'width'], single: false,
      presets: [{ name: 'Zunanje žaluzije', pricing: 'm2', price: 160 }, { name: 'Rolete', pricing: 'm2', price: 120 }, { name: 'Komarnik', pricing: 'piece', price: 65 }] },
    { group: 'installation', title: sl ? 'Montaža' : 'Installation', hint: sl ? 'Montaža na tekoči meter obsega okna 2 × (širina + višina) ali na kos. Stranka izbere eno.' : 'Installation per metre of perimeter 2 × (width + height) or per piece. The customer picks one.',
      units: ['perimeter', 'piece'], single: true,
      presets: [{ name: 'Klasična montaža (PU pena, sidra)', pricing: 'perimeter', price: 9 }, { name: 'RAL montaža (tesnilni trakovi)', pricing: 'perimeter', price: 16 }] },
    { group: 'removal', title: sl ? 'Demontaža' : 'Removal', hint: sl ? 'Demontaža starih oken, na tm obsega ali na kos.' : 'Removing old windows, per metre of perimeter or per piece.',
      units: ['perimeter', 'piece'], single: false,
      presets: [{ name: 'Demontaža starih oken', pricing: 'perimeter', price: 6 }] },
    { group: 'finishing', title: sl ? 'Zaključna dela' : 'Finishing', hint: sl ? 'Obdelava špalet, montaža polic …' : 'Reveal finishing, fitting sills …',
      units: ['perimeter', 'width', 'piece'], single: false,
      presets: [{ name: 'Zidarska obdelava špalet', pricing: 'perimeter', price: 12 }, { name: 'Montaža notranjih polic', pricing: 'width', price: 14 }] },
    { group: 'transport', title: sl ? 'Prevoz in odvoz' : 'Transport and disposal', hint: sl ? 'Pavšal enkrat na ponudbo.' : 'Flat, once per quote.',
      units: ['flat'], single: false,
      presets: [{ name: 'Dostava na objekt', pricing: 'flat', price: 50 }, { name: 'Odvoz in ekološka odstranitev', pricing: 'flat', price: 80 }] },
  ]
}

export default function PriceListSetupPage() {
  const { company, hasPerm, loading: permLoading } = useCompany()
  const { lang } = useLanguage()
  const T = TXT[lang]
  const L = WL[lang]
  const sections = useMemo(() => sectionsFor(lang), [lang])
  const canEdit = hasPerm('price_list', 'create')
  const cur = company?.currency ?? 'EUR'
  const money = (n: number) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: cur })

  const [shapes, setShapes] = useState<ShapeRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [matOn, setMatOn] = useState<Record<string, boolean>>({})
  const [removedProfiles, setRemovedProfiles] = useState<string[]>([])
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [options, setOptions] = useState<OptionRow[]>([])
  const [pricing, setPricing] = useState<PricingSettings>(pricingFrom(null))
  const [showCalc, setShowCalc] = useState(false)
  const [openSash, setOpenSash] = useState<number | null>(null)
  const [folds, setFolds] = useState<Record<string, boolean>>({})
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({})
  const toggleSub = (k: string) => setSubOpen(f => ({ ...f, [k]: !f[k] }))
  const toggleFold = (k: string) => setFolds(f => ({ ...f, [k]: !f[k] }))
  const [removed, setRemoved] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pv, setPv] = useState<{ template?: string; profile?: string; width: number; height: number }>({ width: 1200, height: 1400 })

  useEffect(() => { if (company) load() }, [company?.id])
  async function load() {
    if (!company) return
    const [s, t, o] = await Promise.all([
      supabase.from('window_systems' as any).select('*').eq('company_id', company.id).order('sort_order'),
      supabase.from('window_types' as any).select('*').eq('company_id', company.id).order('sort_order'),
      supabase.from('window_options' as any).select('*').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
    ])
    const sys = (s.data ?? []) as unknown as WindowSystem[]
    const typ = (t.data ?? []) as unknown as WindowType[]
    const opt = (o.data ?? []) as unknown as WindowOption[]
    const starterType = (tpl: WindowTemplate) => STARTER.types.find(x => x.template === tpl)
    setShapes(TEMPLATES.map(tpl => {
      const row = typ.find(x => x.template === tpl)
      const st = starterType(tpl)
      return {
        id: row?.id, template: tpl, on: !!row && row.is_active !== false, name: row?.name ?? st?.name ?? L.templates[tpl],
        surcharge: row ? Number(row.surcharge_pct ?? 0) : st ? Math.round((st.factor - 1) * 100) : 0,
        min_width: row?.min_width ?? 400, max_width: row?.max_width ?? st?.max_width ?? (isDoor(tpl) ? 2200 : 2400),
        min_height: row?.min_height ?? 400, max_height: row?.max_height ?? st?.max_height ?? (isDoor(tpl) ? 2500 : 1800),
      }
    }))
    setProfiles(sys.filter(x => (MATERIALS as string[]).includes(x.material)).map(x => ({
      key: nk(), id: x.id, material: x.material, name: x.name, description: x.description ?? '',
      min: Number(x.min_price ?? 0) || null, image_url: x.image_url ?? null,
      // profiles without metre prices yet start from the sample prices of their material
      ...metreOrSample(x),
    })))
    setPricing(pricingFrom(company.window_pricing))
    setMatOn(Object.fromEntries(MATERIALS.map(m => [m, sys.some(x => x.material === m && x.is_active !== false)])))
    setRemovedProfiles([])
    setOptions(opt.map(x => ({ key: nk(), id: x.id, group_key: x.group_key, name: x.name, pricing: x.pricing, price: x.price == null ? null : Number(x.price), is_default: x.is_default, swatch: x.group_key === 'color' && /^#[0-9a-f]{6}$/i.test(x.description ?? '') ? x.description! : undefined })))
    setRemoved([]); setDirty(false); setLoading(false)
  }

  const touch = () => setDirty(true)
  const setShape = (tpl: WindowTemplate, patch: Partial<ShapeRow>) => { setShapes(xs => xs.map(x => x.template === tpl ? { ...x, ...patch } : x)); touch() }
  const setProfile = (key: string, patch: Partial<ProfileRow>) => { setProfiles(xs => xs.map(x => x.key === key ? { ...x, ...patch } : x)); touch() }
  const newProfile = (m: WindowMaterial): ProfileRow => ({ key: nk(), material: m, name: L.materials[m], description: '', min: null, image_url: null, ...metreOrSample({ material: m }) })
  // a door / sliding / special shape is offered only while its product group is switched on
  const catOn = (t: WindowTemplate) => !isDoor(t) && t !== 'special' ? true : t === 'special' ? pricing.offer.special : t === 'psk' || t === 'lift_slide' ? pricing.offer.sliding : pricing.offer.doors
  // short line on a closed fold: how many window types and opening layouts are offered
  const windowsSummary = (() => {
    const o = pricing.offer
    const layouts = o.sashes.reduce((a, n) => {
      const all = allCombos(n, o).map(comboKey)
      return a + (o.combos?.[String(n)] ?? all).filter(k => all.includes(k)).length
    }, 0)
    return T.windowsSummary(o.sashes.length, layouts)
  })()
  const setOffer = (patch: Partial<Offer>) => { setPricing(x => ({ ...x, offer: { ...x.offer, ...patch } })); touch() }
  const setPrice = (patch: Partial<PricingSettings>) => { setPricing(x => ({ ...x, ...patch })); touch() }
  const setHw = (k: keyof PricingSettings['hw'], v: number | null) => { setPricing(x => ({ ...x, hw: { ...x.hw, [k]: v ?? 0 } })); touch() }
  const setHwM = (k: keyof PricingSettings['hw'], v: number | null) => { setPricing(x => ({ ...x, hw_m: { ...x.hw_m, [k]: v ?? 0 } })); touch() }
  const salePrice = (p: ProfileRow, tpl: WindowTemplate, w: number, h: number) => Math.max(p.min ?? 0, costWindow(layoutFor(tpl), w, h, toPrices(p), pricing).price)
  function toggleMaterial(m: WindowMaterial) {
    const on = !matOn[m]
    setMatOn(x => ({ ...x, [m]: on }))
    // switching a material on for the first time starts it with one profile
    if (on && !profiles.some(p => p.material === m)) setProfiles(xs => [...xs, newProfile(m)])
    touch()
  }
  function addProfile(m: WindowMaterial) { setProfiles(xs => [...xs, newProfile(m)]); touch() }
  function removeProfile(p: ProfileRow) {
    if (p.id) setRemovedProfiles(r => [...r, p.id!])
    const rest = profiles.filter(x => x.key !== p.key)
    setProfiles(rest)
    if (!rest.some(x => x.material === p.material)) setMatOn(x => ({ ...x, [p.material]: false }))
    touch()
  }
  // profile picture → public 'logos' bucket, own sub-folder; the previous file is deleted
  const storagePath = (url: string | null) => url && url.includes('/logos/') ? decodeURIComponent(url.split('/logos/')[1].split('?')[0]) : null
  async function uploadPhoto(p: ProfileRow, file: File) {
    if (!company) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2 MB'); return }
    setUploadingKey(p.key)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${company.id}/profiles/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    setUploadingKey(null)
    if (error) { toast.error(error.message); return }
    const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
    await setPhoto(p, url)
  }
  async function removePhoto(p: ProfileRow) { await setPhoto(p, null) }
  // The picture is stored right away (like the logo), independent of "Shrani cenik"
  async function setPhoto(p: ProfileRow, url: string | null) {
    if (p.id) {
      const { error } = await supabase.from('window_systems' as any).update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', p.id)
      if (error) { toast.error(error.message); return }
    }
    setProfiles(xs => xs.map(x => x.key === p.key ? { ...x, image_url: url } : x))
    if (p.image_url) await deleteIfUnused(p.image_url, p.key)
  }
  // Quotes keep a frozen copy of the picture URL, so the old file stays while any quote still uses it
  async function deleteIfUnused(url: string, exceptKey: string) {
    const path = storagePath(url)
    if (!path || !company || profiles.some(x => x.key !== exceptKey && x.image_url === url)) return
    try {
      const [l, q] = await Promise.all([
        supabase.from('quote_lines').select('id').eq('company_id', company.id).contains('config', { image_url: url }).limit(1),
        supabase.from('quotes').select('id').eq('company_id', company.id).contains('snapshot', { lines: [{ config: { image_url: url } }] }).limit(1),
      ])
      if (l.error || q.error || (l.data ?? []).length || (q.data ?? []).length) return
      await supabase.storage.from('logos').remove([path])
    } catch { /* when unsure, keep the file */ }
  }
  const setOption = (key: string, patch: Partial<OptionRow>) => { setOptions(xs => xs.map(x => x.key === key ? { ...x, ...patch } : x)); touch() }
  function addOption(sec: Section, preset?: Preset) {
    const first = !options.some(o => o.group_key === sec.group)
    setOptions(xs => [...xs, { key: nk(), group_key: sec.group, name: preset?.name ?? '', pricing: preset?.pricing ?? sec.units[0], price: preset?.price ?? null, is_default: sec.single && first, swatch: sec.group === 'color' ? preset?.swatch ?? '#ffffff' : undefined }])
    touch()
  }
  function removeOption(row: OptionRow) {
    if (row.id) setRemoved(r => [...r, row.id!])
    setOptions(xs => xs.filter(x => x.key !== row.key)); touch()
  }
  function setDefault(sec: Section, row: OptionRow) {
    // single-choice groups have exactly one default, add-ons toggle freely
    if (sec.single) setOptions(xs => xs.map(x => x.group_key === sec.group ? { ...x, is_default: x.key === row.key } : x))
    else setOption(row.key, { is_default: !row.is_default })
    touch()
  }

  async function save() {
    if (!company) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      // profiles → window_systems (a material that is switched off keeps its profiles, inactive)
      if (removedProfiles.length) {
        const { error } = await supabase.from('window_systems' as any).delete().in('id', removedProfiles); if (error) throw error
      }
      const sysIds: Record<string, string> = {}
      const ordered = MATERIALS.flatMap(m => profiles.filter(p => p.material === m))
      for (const [i, p] of ordered.entries()) {
        const payload = { name: p.name.trim() || L.materials[p.material], material: p.material, description: p.description.trim() || null, image_url: p.image_url, min_price: p.min ?? 0, is_active: !!matOn[p.material], sort_order: i, updated_at: now,
          frame_m: p.frame_m ?? 0, sash_m: p.sash_m ?? 0, mullion_m: p.mullion_m ?? 0, bead_m: p.bead_m ?? 0, frame_w: p.frame_w, sash_w: p.sash_w, mullion_w: p.mullion_w,
          price_per_m2: Math.round(salePrice(p, REF.template, REF.w, REF.h) / (REF.w * REF.h / 1e6) * 100) / 100 }
        if (p.id) {
          const { error } = await supabase.from('window_systems' as any).update(payload).eq('id', p.id); if (error) throw error
          sysIds[p.key] = p.id
        } else {
          const { data, error } = await supabase.from('window_systems' as any).insert({ ...payload, company_id: company.id }).select('id').single(); if (error) throw error
          sysIds[p.key] = (data as unknown as { id: string }).id
        }
      }
      // shapes → window_types
      const typeIds: Record<string, string> = {}
      for (const [i, s] of shapes.entries()) {
        const payload = { name: s.name.trim() || L.templates[s.template], template: s.template, surcharge_pct: s.surcharge ?? 0, min_width: s.min_width, max_width: s.max_width, min_height: s.min_height, max_height: s.max_height, is_active: s.on && catOn(s.template), sort_order: i, updated_at: now }
        if (s.id) {
          const { error } = await supabase.from('window_types' as any).update(payload).eq('id', s.id); if (error) throw error
          typeIds[s.template] = s.id
        } else if (s.on) {
          const { data, error } = await supabase.from('window_types' as any).insert({ ...payload, company_id: company.id }).select('id').single(); if (error) throw error
          typeIds[s.template] = (data as unknown as { id: string }).id
        }
      }
      // every active material × shape gets a price (matrices from the advanced page stay untouched)
      { const { error } = await supabase.from('companies').update({ window_pricing: pricing, updated_at: now } as any).eq('id', company.id); if (error) throw error }
      // the current configurator still prices per m²: derive it per profile × shape from the metre costing
      const priceRows = profiles.filter(m => matOn[m.material] && sysIds[m.key]).flatMap(m => shapes.filter(s => s.on && typeIds[s.template] && !isOnRequest(s.template)).map(s => {
        const w = isDoor(s.template) ? 900 : 1200, h = isDoor(s.template) ? 2100 : 1400
        return {
          company_id: company.id, system_id: sysIds[m.key], type_id: typeIds[s.template],
          price_per_m2: Math.round(salePrice(m, s.template, w, h) / (w * h / 1e6) * 100) / 100,
          min_price: Math.round(salePrice(m, s.template, s.min_width, s.min_height) * 100) / 100, updated_at: now,
        }
      }))
      if (priceRows.length) {
        const { error } = await supabase.from('window_prices' as any).upsert(priceRows, { onConflict: 'system_id,type_id' }); if (error) throw error
      }
      // extras and services
      if (removed.length) {
        const { error } = await supabase.from('window_options' as any).delete().in('id', removed); if (error) throw error
      }
      for (const [i, o] of options.entries()) {
        if (!o.name.trim()) continue
        const payload = { group_key: o.group_key, name: o.name.trim(), pricing: o.pricing, price: o.price ?? 0, is_default: o.is_default, is_active: true, sort_order: i, updated_at: now, ...(o.group_key === 'color' ? { description: o.swatch ?? null } : {}) }
        const { error } = o.id
          ? await supabase.from('window_options' as any).update(payload).eq('id', o.id)
          : await supabase.from('window_options' as any).insert({ ...payload, company_id: company.id })
        if (error) throw error
      }
      toast.success(T.saved)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!permLoading && !hasPerm('price_list', 'view')) return <Navigate to="/dashboard" replace />

  // live preview (like Fenestro): one example window, base price + every default choice as its own line
  // preview: windows built from sashes (what the supplier offers) + balcony doors / sliding systems
  const offer = pricing.offer
  const doorShapes = shapes.filter(sh => sh.on && isDoor(sh.template) && !isOnRequest(sh.template) && (sh.template === 'psk' || sh.template === 'lift_slide' ? offer.sliding : offer.doors))
  const pvChoices: { key: string; label: string; spec?: WindowSpec; template?: WindowTemplate; min_width: number; max_width: number; min_height: number; max_height: number }[] = [
    ...(offer.windows ? [...offer.sashes].sort().map(n => ({ key: 'w' + n, label: T.nSash(n), spec: makeSpec(n), min_width: 400 * n, max_width: 1200 * n, min_height: 400, max_height: 2200 })) : []),
    ...(offer.slidingWindows ? [{ key: 'sw', label: T.catSlidingWindows, spec: makeSlidingSpec(), min_width: 800, max_width: 3200, min_height: 400, max_height: 2200 }] : []),
    ...doorShapes.map(sh => ({ key: sh.template, label: L.templates[sh.template], template: sh.template, min_width: sh.min_width, max_width: sh.max_width, min_height: sh.min_height, max_height: sh.max_height })),
  ]
  const activeMats = profiles.filter(m => matOn[m.material])
  const pShape = pvChoices.find(c => c.key === pv.template) ?? pvChoices.find(c => c.key === 'w2') ?? pvChoices[0]
  const pMat = activeMats.find(m => m.key === pv.profile) ?? activeMats[0]
  const area = pv.width * pv.height / 1_000_000
  const pCalc = pShape && pMat ? costWindow(pShape.spec ? specToLayout(pShape.spec) : layoutFor(pShape.template!), pv.width, pv.height, toPrices(pMat), pricing, { labels: CALC_LABELS[lang] }) : null
  const pBase = pShape && pMat && pCalc ? Math.round(Math.max(pMat.min ?? 0, pCalc.price) * 100) / 100 : null
  const addOn = (o: OptionRow) => {
    const price = o.price ?? 0
    if (o.pricing === 'piece') return price
    if (o.pricing === 'm2') return price * area
    if (o.pricing === 'percent') return (pBase ?? 0) * price / 100
    if (o.pricing === 'perimeter') return price * 2 * (pv.width + pv.height) / 1000
    if (o.pricing === 'width') return price * pv.width / 1000
    return price
  }
  const isSvc = (o: OptionRow) => (SERVICE_GROUPS as string[]).includes(o.group_key) || o.pricing === 'flat'
  const pExtras = options.filter(o => o.is_default && o.name.trim() && !isSvc(o)).map(o => ({ name: o.name, swatch: o.swatch, amount: Math.round(addOn(o) * 100) / 100 }))
  const pServices = options.filter(o => o.is_default && o.name.trim() && isSvc(o)).map(o => ({
    name: o.name,
    amount: serviceLine({ id: o.key, group_key: o.group_key, name: o.name, description: null, pricing: o.pricing, price: o.price, is_default: true }, [{ width: pv.width, height: pv.height, quantity: 1, base: pBase }]).total,
  }))
  const pTotal = (pBase ?? 0) + pExtras.reduce((a, x) => a + x.amount, 0) + pServices.reduce((a, x) => a + x.amount, 0)
  const pColor = options.find(o => o.group_key === 'color' && o.is_default)?.swatch

  return (
    <div>
      <PageHeader title={T.title} icon={BadgeEuro} action={canEdit && <Button onClick={save} loading={saving} className="gap-2"><Check className="w-4 h-4" />{T.save}</Button>} />
      <div className={`p-4 lg:p-6 pb-28 grid gap-6 items-start${pShape && pMat ? " lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <div className="min-w-0">

        {loading ? <div className="text-sm text-gray-400">…</div> : <div className="space-y-6">
          {/* 1. shapes */}
          <Step n={1} title={T.s1} hint={T.s1hint}>
            {/* product categories, like the start page of a window shop */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                ['windows', T.catWindows, <SpecDrawing key="w" spec={makeSpec(2)} width={1200} height={1300} size={104} plain />],
                ['slidingWindows', T.catSlidingWindows, <SpecDrawing key="sw" spec={makeSlidingSpec()} width={1600} height={1200} size={110} plain />],
                ['doors', T.catDoors, <WindowDrawing key="d" template="door" width={900} height={2100} size={104} plain />],
                ['sliding', T.catSliding, <WindowDrawing key="s" template="lift_slide" width={2400} height={2100} size={110} plain />],
              ] as [keyof Offer, string, React.ReactNode][]).map(([k, label, pic]) => {
                const on = !!offer[k]
                return <button key={k} type="button" disabled={!canEdit} onClick={() => setOffer({ [k]: !on } as Partial<Offer>)}
                  className={cn('relative rounded-xl border p-3 text-left transition-colors', on ? SEL_ON : SEL_OFF)}>
                  {on && <SelBadge />}
                  <div className="h-[128px] flex items-center justify-center rounded-lg bg-gray-50">{pic}</div>
                  <div className={cn('mt-3 text-sm font-medium', on ? 'text-blue-700' : 'text-gray-900')}>{label}</div>
                </button>
              })}
            </div>

          </Step>

          {/* 2. settings per product group, each one a fold you open with the arrow */}
          {(offer.windows || offer.slidingWindows || offer.doors || offer.sliding) && <Step n={2} title={T.s1b} hint={T.s1bhint}>
            <div className="space-y-3">
            {/* windows: sashes, top light / bottom panel, openings */}
            {offer.windows && <Fold open={!!folds.windows} onToggle={() => toggleFold('windows')} title={T.catWindows} summary={windowsSummary}
              pic={<SpecDrawing spec={makeSpec(2)} width={1200} height={1300} size={44} plain />}>
              <div className="space-y-5">
              {/* every window type is a row; its openings open right underneath it */}
              <div>
                <div className="text-xs font-medium text-[#7f7f7f] mb-2">{T.sashCount}</div>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {[1, 2, 3, 4].map(n => {
                    const on = offer.sashes.includes(n)
                    const all = allCombos(n, offer)
                    const picked = (offer.combos?.[String(n)] ?? all.map(comboKey)).filter(k => all.some(c => comboKey(c) === k))
                    const setPicked = (keys: string[]) => setOffer({ combos: { ...(offer.combos ?? {}), [String(n)]: keys } })
                    const bandsPicked = offer.bands?.[String(n)] ?? [...BAND_KEYS]
                    const setBands = (keys: string[]) => setOffer({ bands: { ...(offer.bands ?? {}), [String(n)]: keys } })
                    const open = on && openSash === n
                    return <div key={n} className={cn(on ? 'bg-white' : 'bg-gray-50/60')}>
                      <div className="flex items-center gap-4 px-4 py-3">
                        <button type="button" disabled={!canEdit} onClick={() => setOffer({ sashes: on ? offer.sashes.filter(x => x !== n) : [...offer.sashes, n].sort() })}
                          className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', on ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                          {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                        <div className="w-[120px] h-[64px] flex items-center justify-center shrink-0">
                          <SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={500 * n + 200} height={1300} size={n > 2 ? 104 : 64} plain />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm font-medium', on ? 'text-gray-900' : 'text-gray-500')}>{T.nSash(n)}</div>
                          {on && <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{T.rowSummary(bandsPicked.length, picked.length)}</div>}
                        </div>
                        {on && <button type="button" onClick={() => setOpenSash(open ? null : n)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                          {open ? T.hideOpenings : T.showVariants}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                        </button>}
                      </div>
                      {open && <div className="px-4 pb-4">
                        <div className="ml-[9px] pl-[25px] border-l-2 border-blue-100 space-y-2">
                          {/* top light / bottom panel variants of this window type */}
                          <SubFold open={!!subOpen[n + 'b']} onToggle={() => toggleSub(n + 'b')} title={T.bandsFor} count={T.ofCount(bandsPicked.length, BAND_KEYS.length)}
                            actions={canEdit && <>
                              <button type="button" onClick={() => setBands([...BAND_KEYS])} className="text-blue-600 hover:text-blue-700">{T.selectAll}</button>
                              <button type="button" onClick={() => setBands([])} className="text-[#7f7f7f] hover:text-gray-700">{T.clearAll}</button>
                            </>}>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                              {BAND_KEYS.map(k => {
                                const sel = bandsPicked.includes(k)
                                const modes = allowedBandModes(n, k, offer)
                                const setModes = (m: string[]) => setOffer({ bandModes: { ...(offer.bandModes ?? {}), [`${n}:${k}`]: m } })
                                return <div key={k} className={cn('relative rounded-lg border transition-colors', sel ? SEL_ON : SEL_OFF)}>
                                  <button type="button" disabled={!canEdit} onClick={() => setBands(sel ? bandsPicked.filter(x => x !== k) : [...bandsPicked, k])}
                                    className="w-full p-3 flex flex-col items-center justify-center gap-2 h-[190px]">
                                    {sel && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>}
                                    <SpecDrawing spec={makeSpec(n, BAND_SHAPE[k][0], BAND_SHAPE[k][1], 'fixed')} width={500 * n + 200} height={1500} size={n > 2 ? 140 : 120} className="max-w-full h-auto" plain />
                                    <span className={cn('text-xs font-medium', sel ? 'text-blue-700' : 'text-gray-900')}>{T.bandLabel[k]}</span>
                                  </button>
                                  {/* the top light / bottom panel itself: fixed and / or tilt */}
                                  {sel && k !== 'none' && <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                                    {(['fixed', 'tilt'] as const).map(m => {
                                      const on = modes.includes(m)
                                      return <button key={m} type="button" disabled={!canEdit} onClick={() => setModes(on ? modes.filter(x => x !== m) : [...modes, m])}
                                        className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5 bg-white text-left', on ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300')}>
                                        <SpecDrawing spec={withBandMode(makeSpec(1, BAND_SHAPE[k][0] === 'none' ? 'none' : 'single', BAND_SHAPE[k][1] === 'none' ? 'none' : 'single', 'fixed'), m)} width={700} height={1300} size={30} />
                                        <span className={cn('text-xs font-medium', on ? 'text-blue-700' : 'text-gray-600')}>{m === 'fixed' ? T.modeFixed : T.modeTilt}</span>
                                        {on && <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" strokeWidth={3} />}
                                      </button>
                                    })}
                                  </div>}
                                </div>
                              })}
                            </div>
                          </SubFold>
                          {/* opening combinations of this window type */}
                          <SubFold open={!!subOpen[n + 'o']} onToggle={() => toggleSub(n + 'o')} title={T.combosFor} count={T.ofCount(picked.length, all.length)}
                            actions={canEdit && <>
                              <button type="button" onClick={() => setPicked(all.map(comboKey))} className="text-blue-600 hover:text-blue-700">{T.selectAll}</button>
                              <button type="button" onClick={() => setPicked([])} className="text-[#7f7f7f] hover:text-gray-700">{T.clearAll}</button>
                            </>}>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                              {all.map(c => {
                                const k = comboKey(c), sel = picked.includes(k)
                                return <button key={k} type="button" disabled={!canEdit} onClick={() => setPicked(sel ? picked.filter(x => x !== k) : [...picked, k])}
                                  className={cn('relative rounded-lg border p-2 flex items-center justify-center h-[170px] transition-colors', sel ? SEL_ON : SEL_OFF)}>
                                  {sel && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>}
                                  <SpecDrawing spec={{ ...makeSpec(n), main: c }} width={500 * n + 200} height={1300} size={n > 2 ? 150 : n === 2 ? 130 : 110} className="max-w-full h-auto" />
                                </button>
                              })}
                            </div>
                          </SubFold>
                        </div>
                      </div>}
                    </div>
                  })}
                </div>
              </div>
              </div>
            </Fold>}

            {offer.slidingWindows && (() => {
              const all = allCombos(2, offer, 'sliding')
              const picked = (offer.combos?.s2 ?? all.map(comboKey)).filter(k => all.some(c => comboKey(c) === k))
              const setPicked = (keys: string[]) => setOffer({ combos: { ...(offer.combos ?? {}), s2: keys } })
              return <Fold open={!!folds.slidingWindows} onToggle={() => toggleFold('slidingWindows')} title={T.catSlidingWindows} summary={T.combosCount(picked.length, all.length)}
                pic={<SpecDrawing spec={makeSlidingSpec()} width={1600} height={1200} size={48} plain />}>
                <div>
                <div className="text-xs font-medium text-[#7f7f7f] mb-3">{T.combosFor}</div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {all.map(c => {
                    const k = comboKey(c), sel = picked.includes(k)
                    return <button key={k} type="button" disabled={!canEdit} onClick={() => setPicked(sel ? picked.filter(x => x !== k) : [...picked, k])}
                      className={cn('relative rounded-lg border p-2 flex items-center justify-center h-[170px] transition-colors', sel ? SEL_ON : SEL_OFF)}>
                      {sel && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>}
                      <SpecDrawing spec={{ ...makeSlidingSpec(), main: c }} width={1600} height={1200} size={150} className="max-w-full h-auto" />
                    </button>
                  })}
                </div>
                </div>
              </Fold>
            })()}

            {/* balcony doors / sliding walls: the existing shape cards */}
            {([[offer.doors, T.catDoors, (t: WindowTemplate) => t.startsWith('door')], [offer.sliding, T.catSliding, (t: WindowTemplate) => t === 'psk' || t === 'lift_slide']] as [boolean, string, (t: WindowTemplate) => boolean][])
              .filter(([on]) => on).map(([, groupLabel, match]) => (
              <Fold key={groupLabel} open={!!folds[groupLabel]} onToggle={() => toggleFold(groupLabel)} title={groupLabel}
                summary={T.typesCount(shapes.filter(sh => match(sh.template) && sh.on).length, shapes.filter(sh => match(sh.template)).length)}
                pic={<WindowDrawing template={groupLabel === T.catDoors ? 'door' : 'lift_slide'} width={groupLabel === T.catDoors ? 900 : 2400} height={2100} size={44} plain />}>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {shapes.filter(sh => match(sh.template)).map(sh => (
                    <div key={sh.template} className={cn('relative rounded-xl border p-3 flex flex-col transition-colors', sh.on ? SEL_ON : SEL_OFF)}>
                      {sh.on && <SelBadge />}
                      <button type="button" disabled={!canEdit} onClick={() => setShape(sh.template, { on: !sh.on })} className="text-left">
                        <div className="h-[136px] flex items-center justify-center rounded-lg bg-gray-50">
                          <WindowDrawing template={sh.template} width={isDoor(sh.template) ? 900 : 1200} height={isDoor(sh.template) ? 2100 : 1300} size={116} plain />
                        </div>
                        <div className={cn('mt-3 text-xs font-medium leading-snug', sh.on ? 'text-blue-700' : 'text-gray-900')}>{L.templates[sh.template]}</div>
                      </button>
                      {sh.on && isOnRequest(sh.template) && <p className="mt-2 text-xs font-medium text-[#7f7f7f]">{T.onRequest}</p>}
                    </div>
                  ))}
                </div>
              </Fold>
            ))}
            </div>
          </Step>}

          {/* 2. materials */}
          <Step n={3} title={T.s2} hint={T.s2hint}>
            <div className="space-y-2">
              {MATERIALS.map(m => {
                const on = !!matOn[m]
                const list = profiles.filter(p => p.material === m)
                return (
                <div key={m} className={cn('rounded-xl border transition-colors', on ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300')}>
                  <button type="button" disabled={!canEdit} onClick={() => toggleMaterial(m)} className="flex items-center gap-3 w-full text-left px-4 py-3">
                    <span className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', on ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>{on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                    <ProfileSection material={m} size={44} />
                    <span className="text-sm font-medium text-gray-900">{L.materials[m]}</span>
                  </button>
                  {on && <div className="px-4 pb-4 space-y-3">
                    {list.map(p => (
                      <div key={p.key} className="rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row gap-4">
                        {/* picture: uploaded photo or the schematic cross-section */}
                        <div className="sm:w-48 shrink-0">
                          <label className={cn('relative block w-full h-64 rounded-lg border border-dashed flex items-center justify-center overflow-hidden bg-gray-50', canEdit ? 'cursor-pointer border-gray-300 hover:border-gray-400' : 'border-gray-200')}>
                            {p.image_url ? <img src={p.image_url} alt="" className="max-w-full max-h-full object-contain p-1" /> : <ProfileSection material={m} className="w-full h-full p-3" />}
                            {canEdit && <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(p, f); e.target.value = '' }} />}
                          </label>
                          {canEdit && <div className="flex items-center justify-between mt-1.5 text-xs font-medium text-[#7f7f7f]">
                            <span className="inline-flex items-center gap-1"><Upload className="w-3 h-3" />{uploadingKey === p.key ? '…' : p.image_url ? T.photoChange : T.photo}</span>
                            {p.image_url && <button type="button" onClick={() => removePhoto(p)} className="hover:text-red-600" title={T.photoRemove}><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>}
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-end gap-3">
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-xs font-medium text-[#7f7f7f]">{T.matName}</label>
                              <input value={p.name} placeholder={T.matNamePh} onChange={e => setProfile(p.key, { name: e.target.value })} disabled={!canEdit}
                                className="rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            {canEdit && <button type="button" onClick={() => removeProfile(p)} title={T.remove}
                              className="h-[38px] px-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-[#7f7f7f] mb-1">{T.metrePrices}</div>
                            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                              <NumberInput label={T.frameM} unit={`${cur}/m`} value={p.frame_m} onValue={v => setProfile(p.key, { frame_m: v })} decimals={2} />
                              <NumberInput label={T.sashM} unit={`${cur}/m`} value={p.sash_m} onValue={v => setProfile(p.key, { sash_m: v })} decimals={2} />
                              <NumberInput label={T.mullionM} unit={`${cur}/m`} value={p.mullion_m} onValue={v => setProfile(p.key, { mullion_m: v })} decimals={2} />
                              <NumberInput label={T.beadM} unit={`${cur}/m`} value={p.bead_m} onValue={v => setProfile(p.key, { bead_m: v })} decimals={2} />
                              <NumberInput label={T.minPrice} unit={cur} value={p.min} onValue={v => setProfile(p.key, { min: v })} decimals={2} />
                            </div>
                          </div>
                          <details className="group">
                            <summary className="cursor-pointer list-none text-xs font-medium text-[#7f7f7f] hover:text-gray-700">{T.widths}: {p.frame_w} / {p.sash_w} / {p.mullion_w} mm</summary>
                            <div className="grid grid-cols-3 gap-3 mt-2">
                              <NumberInput label={T.frameW} unit="mm" value={p.frame_w} onValue={v => setProfile(p.key, { frame_w: v ?? 70 })} decimals={0} />
                              <NumberInput label={T.sashW} unit="mm" value={p.sash_w} onValue={v => setProfile(p.key, { sash_w: v ?? 78 })} decimals={0} />
                              <NumberInput label={T.mullionW} unit="mm" value={p.mullion_w} onValue={v => setProfile(p.key, { mullion_w: v ?? 82 })} decimals={0} />
                            </div>
                          </details>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-[#7f7f7f]">{T.description}</label>
                            <input value={p.description} placeholder={T.descriptionPh} onChange={e => setProfile(p.key, { description: e.target.value })} disabled={!canEdit}
                              className="rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          {(() => {
                            const ref = (x: ProfileRow) => salePrice(x, REF.template, REF.w, REF.h)
                            const priced = list.filter(x => ref(x) > 0)
                            if (priced.length < 2 || !ref(p)) return null
                            const cheapest = priced.reduce((a, x) => (ref(x) < ref(a) ? x : a))
                            const pct = Math.round((ref(p) / ref(cheapest) - 1) * 100)
                            const isBase = p.key === cheapest.key || pct === 0
                            return <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                              {isBase
                                ? <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={{ color: '#007d53', backgroundColor: '#e0fced', border: '1px solid #cbf7e1' }}>
                                    <Check className="w-3 h-3" strokeWidth={2.5} />{T.isBase}
                                  </span>
                                : <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" style={{ color: '#52525b', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7' }}>
                                    <TrendingUp className="w-3 h-3" /><span className="font-semibold text-gray-900">+{pct} %</span>{T.moreThan(cheapest.name || L.materials[m])}
                                  </span>}
                            </div>
                          })()}
                        </div>
                      </div>
                    ))}
                    {canEdit && <button type="button" onClick={() => addProfile(m)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"><Plus className="w-4 h-4" />{T.addProfile}</button>}
                    <p className="text-xs font-medium text-[#7f7f7f]">{T.photoHint}</p>
                  </div>}
                </div>
              )})}
            </div>
          </Step>

          {/* 3. hardware, glass, labour, margin */}
          <Step n={4} title={T.s3} hint={T.s3hint}>
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium text-[#7f7f7f] mb-1">{T.hwTitle}</div>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {(['tilt_turn', 'turn', 'tilt', 'passive', 'slide_window', 'slide', 'lift_slide'] as const).map(k => (
                    <div key={k} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px_150px] gap-3 items-end px-3 py-2.5">
                      <div className="text-sm text-gray-900 pb-2">{T.hw[k]}</div>
                      <NumberInput label={T.hwFixed} unit={`${cur}/${T.perSash}`} value={pricing.hw[k]} onValue={v => setHw(k, v)} decimals={2} />
                      <NumberInput label={T.hwPerM} unit={`${cur}/tm`} value={pricing.hw_m[k]} onValue={v => setHwM(k, v)} decimals={2} />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium text-[#7f7f7f] mt-2">{T.hwHint}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumberInput label={T.glassM2} unit={`${cur}/m²`} value={pricing.glass_m2} onValue={v => setPrice({ glass_m2: v ?? 0 })} decimals={2} />
                <NumberInput label={T.labourWindow} unit={cur} value={pricing.labour_window} onValue={v => setPrice({ labour_window: v ?? 0 })} decimals={2} />
                <NumberInput label={T.labourSash} unit={cur} value={pricing.labour_sash} onValue={v => setPrice({ labour_sash: v ?? 0 })} decimals={2} />
                <NumberInput label={T.waste} unit="%" value={pricing.waste_pct} onValue={v => setPrice({ waste_pct: v ?? 0 })} decimals={0} />
                <NumberInput label={T.margin} unit="%" value={pricing.margin_pct} onValue={v => setPrice({ margin_pct: v ?? 0 })} decimals={0} />
                <NumberInput label={T.bothSides} unit="%" value={pricing.both_sides_pct} onValue={v => setPrice({ both_sides_pct: v ?? 0 })} decimals={0} />
              </div>
            </div>
          </Step>

          {/* 4+. extras and services */}
          {sections.map((sec, i) => {
            const rows = options.filter(o => o.group_key === sec.group)
            const unused = sec.presets.filter(p => !rows.some(r => r.name.trim().toLowerCase() === p.name.toLowerCase()))
            return (
              <Step key={sec.group} n={i + 5} title={sec.title} hint={sec.hint}>
                <div className="space-y-2">
                  {rows.map(r => (
                    <div key={r.key} className="flex flex-wrap items-center gap-2">
                      {sec.group === 'color' && <label className="relative w-9 h-9 rounded-full border border-gray-300 shrink-0 cursor-pointer overflow-hidden" style={{ backgroundColor: r.swatch ?? '#ffffff' }} title={r.swatch}>
                        <input type="color" value={r.swatch ?? '#ffffff'} disabled={!canEdit} onChange={e => setOption(r.key, { swatch: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </label>}
                      <input value={r.name} onChange={e => setOption(r.key, { name: e.target.value })} placeholder={T.name} disabled={!canEdit}
                        className="flex-1 min-w-[200px] rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="w-32"><NumberInput value={r.price} onValue={v => setOption(r.key, { price: v })} unit={r.pricing === 'percent' ? '%' : cur} decimals={2} /></div>
                      {sec.units.length > 1
                        ? <select value={r.pricing} disabled={!canEdit} onChange={e => setOption(r.key, { pricing: e.target.value as OptionPricing })}
                            className="rounded-lg border border-gray-200 hover:border-gray-400 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {sec.units.map(u => <option key={u} value={u}>{L.pricing[u]}</option>)}
                          </select>
                        : <span className="text-sm text-gray-500 px-1">{L.pricing[r.pricing]}</span>}
                      <button type="button" disabled={!canEdit} onClick={() => setDefault(sec, r)} title={T.dflt}
                        className={cn('inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium', r.is_default ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400 hover:text-gray-700')}>
                        {r.is_default && <Check className="w-3 h-3" />}{T.dflt}
                      </button>
                      {canEdit && <button type="button" onClick={() => removeOption(r)} title={T.remove} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                {canEdit && <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button type="button" onClick={() => addOption(sec)} className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline"><Plus className="w-4 h-4" />{T.add}</button>
                  {unused.length > 0 && <>
                    <span className="text-xs font-medium text-[#7f7f7f] ml-2">{T.quick}</span>
                    {unused.map(p => <button key={p.name} type="button" onClick={() => addOption(sec, p)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-400">{p.swatch && <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: p.swatch }} />}+ {p.name}</button>)}
                  </>}
                </div>}
              </Step>
            )
          })}

          <Link to="/windows/advanced" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><Settings2 className="w-4 h-4" />{T.advanced}</Link>
        </div>}
        </div>

        {/* live preview */}
        {!loading && pShape && pMat && <aside className="lg:sticky lg:top-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{T.preview}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{T.live}</span>
          </div>
          {pShape && pMat ? <div className="p-4 space-y-4">
            <div className="flex justify-center rounded-lg bg-gray-50 py-4" style={{ backgroundImage: 'linear-gradient(#eef0f2 1px, transparent 1px), linear-gradient(90deg, #eef0f2 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
              {pShape.spec
                ? <SpecDrawing spec={pShape.spec} width={pv.width} height={pv.height} size={190} showDims frameColor={pColor && pColor.toLowerCase() !== '#ffffff' ? pColor : '#f8fafc'} />
                : <WindowDrawing template={pShape.template!} width={pv.width} height={pv.height} size={190} showDims frameColor={pColor && pColor.toLowerCase() !== '#ffffff' ? pColor : '#f8fafc'} />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pvChoices.map(sh => <button key={sh.key} type="button" onClick={() => setPv(v => ({ ...v, template: sh.key }))}
                className={cn('px-2 py-1 rounded-md border text-xs', sh.key === pShape.key ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400')}>{sh.label}</button>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeMats.map(m => <button key={m.key} type="button" onClick={() => setPv(v => ({ ...v, profile: m.key }))}
                className={cn('px-2 py-1 rounded-md border text-xs', m.key === pMat.key ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400')}>{m.name || L.materials[m.material]}</button>)}
            </div>
            {([['width', T.width, pShape.min_width, pShape.max_width], ['height', T.height, pShape.min_height, pShape.max_height]] as const).map(([k, label, min, max]) => (
              <div key={k}>
                <div className="flex justify-between text-xs font-medium text-[#7f7f7f] mb-1"><span>{label}</span><span className="font-medium text-gray-900">{pv[k]} mm</span></div>
                <input type="range" min={min} max={max} step={10} value={Math.min(max, Math.max(min, pv[k]))} onChange={e => setPv(v => ({ ...v, [k]: Number(e.target.value) }))} className="w-full accent-gray-900" />
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><span className="text-gray-900">{pShape.label} · {pMat.name || L.materials[pMat.material]}</span><span className="text-gray-900 whitespace-nowrap">{money(pBase ?? 0)}</span></div>
              {/* internal costing: cut list with lengths, glass, hardware, labour, margin */}
              {pCalc && <div className="rounded-lg border border-gray-200 bg-gray-50/60">
                <button type="button" onClick={() => setShowCalc(v => !v)} className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-[#7f7f7f] hover:text-gray-700">
                  <span>{T.calc}</span><span>{showCalc ? '−' : '+'}</span>
                </button>
                {showCalc && <div className="px-2.5 pb-2 space-y-1 text-xs">
                  {pCalc.lines.map(l => <div key={l.key} className="flex justify-between gap-2 text-gray-600">
                    <span className="min-w-0 truncate">{l.label} <span className="text-gray-400">{l.qty.toLocaleString('de-DE')} {l.unit} × {money(l.price)}</span></span>
                    <span className="whitespace-nowrap">{money(l.total)}</span>
                  </div>)}
                  <div className="flex justify-between gap-2 pt-1 border-t border-gray-200 text-gray-700"><span>{T.cost}</span><span>{money(pCalc.cost)}</span></div>
                  <div className="flex justify-between gap-2 text-gray-700"><span>{T.marginLine} {pricing.margin_pct} %</span><span>+ {money(pCalc.price - pCalc.cost)}</span></div>
                  <div className="flex justify-between gap-2 font-medium text-gray-900"><span>{T.windowPrice}</span><span>{money(pCalc.price)}</span></div>
                </div>}
              </div>}
              {pExtras.map(x => <div key={x.name} className="flex justify-between gap-3 text-gray-500"><span className="flex items-center gap-1.5 min-w-0 truncate">{x.swatch && <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: x.swatch }} />}{x.name}</span><span className="whitespace-nowrap">+ {money(x.amount)}</span></div>)}
              {pServices.map(x => <div key={x.name} className="flex justify-between gap-3 text-gray-500"><span className="min-w-0 truncate">{x.name}</span><span className="whitespace-nowrap">+ {money(x.amount)}</span></div>)}
              <div className="flex justify-between gap-3 pt-2 border-t border-gray-100 font-semibold text-gray-900"><span>{T.totalNet}</span><span>{money(pTotal)}</span></div>
              <p className="text-xs font-medium text-[#7f7f7f]">{T.previewHint}</p>
            </div>
          </div> : null}
        </aside>}
      </div>

      {/* sticky save bar */}
      {canEdit && dirty && <div className="fixed bottom-0 right-0 left-0 lg:left-72 z-30 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3">
        <span className="text-sm font-medium text-[#7f7f7f]">{T.unsaved}</span>
        <Button onClick={save} loading={saving} className="gap-2"><Check className="w-4 h-4" />{T.save}</Button>
      </div>}
    </div>
  )
}

/** A part of a window type (top light variants, openings): closed by default, opens with the arrow. */
function SubFold({ open, onToggle, title, count, actions, children }: { open: boolean; onToggle: () => void; title: string; count: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <ChevronDown className={cn('w-4 h-4 text-gray-500 shrink-0 transition-transform', !open && '-rotate-90')} />
          <span className="text-sm font-medium text-gray-900">{title}</span>
          <span className="text-xs font-medium text-[#7f7f7f]">{count}</span>
        </button>
        {open && actions && <div className="flex gap-3 text-xs font-medium">{actions}</div>}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

/** A product group in the price list: one row you open with the arrow. */
function Fold({ open, onToggle, title, summary, pic, children }: { open: boolean; onToggle: () => void; title: string; summary: string; pic: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border bg-white overflow-hidden transition-colors', open ? 'border-gray-300' : 'border-gray-200')}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50">
        <div className="w-14 h-12 flex items-center justify-center shrink-0">{pic}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{summary}</div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-gray-100 p-4">{children}</div>}
    </div>
  )
}

// Selected card: blue outline, light blue tint and a check badge in the corner (same everywhere)
const SEL_ON = 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50'
const SEL_OFF = 'border-gray-200 bg-white hover:border-gray-300'
function SelBadge() {
  return <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm"><Check className="w-3 h-3" strokeWidth={3} /></span>
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">{n}</span>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs font-medium text-[#7f7f7f] mt-1 max-w-3xl">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
