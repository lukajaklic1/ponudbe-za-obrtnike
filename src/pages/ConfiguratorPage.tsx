import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Copy, Check, Loader2, Phone, Mail, ArrowLeft, FileText, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import WindowDrawing from '../components/WindowDrawing'
import ProfileSection from '../components/ProfileSection'
import ColorSwatch from '../components/ColorSwatch'
import { parseColor } from '../lib/colors'
import SpecDrawing from '../components/SpecDrawing'
import RoofWindowDrawing from '../components/RoofWindowDrawing'
import type { RoofCatalog } from '../lib/costing'
import GlassIcon from '../components/GlassIcon'
import HandleIcon from '../components/HandleIcon'
import SillIcon, { sillMaterialOf } from '../components/SillIcon'
import ShadingIcon from '../components/ShadingIcon'
import {
  costWindow, specToLayout, makeSpec, makeSlidingSpec, reshapeSpec, allowedCombos, allowedBands, bandKeyOf, comboKey, BAND_SHAPE, bandModeOf, sameField, pricingFrom, allowedVariants, applyVariant, specVariantKey, makeDoorSpec, makeWallSpec, type BuilderKind, roofUnitPrice, productGroupOf, profileServes, colorPctOf, type ColorCatalog,
  type WindowSpec, type Band, type Offer, type PricingSettings, type GlassType, type HandleType, type SillType, type ShadingType,
} from '../lib/costing'
import { cn } from '../lib/cn'
import Select from '../components/ui/Select'
import { SI_POSTS, COUNTRIES, inArea, type InstallArea } from '../lib/siPosts'
import { leadSourceOptions } from '../lib/leadSources'
import {
  WL, OPTION_GROUPS, SERVICE_GROUPS, SINGLE_CHOICE_GROUPS, basePrice, unitPrice, serviceLine, isService, money, hasHingeChoice, isDoor,
  type WindowSystem, type WindowType, type WindowPrice, type WindowOption, type Hinge, type OptionGroup,
} from '../lib/windows'

// Public window configurator: /k/:slug — no login. Prices are recomputed on the server on submit.

export interface ConfigData {
  company: { name: string; logo_url: string | null; email: string | null; phone: string | null; currency: string; accent: string; intro: string | null; show_prices: boolean; vat_rate: number; area?: InstallArea | null }
  systems: WindowSystem[]
  types: WindowType[]
  prices: WindowPrice[]
  combos: { system_id: string; type_id: string }[]
  options: WindowOption[]
  /** windows built from sashes (null when the supplier did not set it up) */
  builder?: { offer: Offer; pricing: PricingSettings | null; roof?: RoofCatalog | null; colors?: ColorCatalog | null; glass?: GlassType[] | null; handles?: HandleType[] | null; sills?: SillType[] | null; shading?: ShadingType[] | null } | null
}

export interface ConfigItem {
  key: string
  type_id: string
  system_id: string
  width: number | null
  height: number | null
  hinge: Hinge
  quantity: number
  label: string
  option_ids: string[]
  /** window built from sashes; when set, type_id is not used */
  spec?: WindowSpec | null
  /** profile colour outside / inside (ids from the colours of the profile's material) */
  colors?: { out?: string | null; in?: string | null } | null
  /** glass package and handle (ids from the supplier's price list; missing = the first = standard) */
  glass?: string | null
  handle?: string | null
  /** window sills inside / outside (ids; missing = no sill) */
  sills?: { in?: string | null; out?: string | null } | null
  /** shading and insect screen (ids; missing = none) */
  shading?: { shade?: string | null; screen?: string | null } | null
  /** roof window from the catalogue: model + size (+ flashing) */
  roof?: { model: string; size: string; flashing: string | null; variant?: string | null } | null
  /** width of each sash in mm (the last one fills the rest); missing = all the same */
  sashWidths?: number[] | null
}

const TXT = {
  sl: {
    title: 'Konfigurator oken', notFound: 'Konfigurator ni na voljo.', notFoundHint: 'Ponudnik konfiguratorja še ni objavil.',
    qtyTitle: 'Količina', sizeTitle: 'Mere', roofWindow: 'Strešno okno', roofModelTitle: 'Model strešnega okna', roofVariant: 'Material in barva', roofDatasheet: 'Tehnični list (PDF)', roofSize: 'Mera', roofFlashing: 'Obroba za kritino', roofCenter: 'Vrtljivo', roofTop: 'Zgornje vrtišče', from: 'od',
    nSash: (n: number) => n === 1 ? 'Enokrilno okno' : n === 2 ? 'Dvokrilno okno' : n === 3 ? 'Trokrilno okno' : 'Štirikrilno okno', slidingWindow: 'Drsno okno', sillTitle: 'Police', shadeTitle: 'Senčila in komarniki', shadeLabel: 'Senčilo', screenLabel: 'Komarnik', noShade: 'Brez senčila', noScreen: 'Brez komarnika', sillIn: 'Notranja polica', sillOut: 'Zunanja polica', noSill: 'Brez police', glassTitle: 'Steklo', handleTitle: 'Kljuka', lockable: 'Zaklepanje s ključem', included: 'Vključeno', layers: (n: number) => n === 3 ? 'troslojno' : n === 2 ? 'dvoslojno' : `${n}-slojno`, colorTitle: 'Barva', colorOut: 'Zunaj', colorIn: 'Znotraj', nWall: (n: number) => `${n === 2 ? 'Dvodelna' : n === 3 ? 'Tridelna' : 'Štiridelna'} drsna stena`, nDoor: (n: number) => n === 1 ? 'Enokrilna balkonska vrata' : n === 2 ? 'Dvokrilna balkonska vrata' : 'Trokrilna balkonska vrata',
    bandsTitle: 'Nadsvetloba / ločen spodnji del', band: { none: 'Brez', top: 'Z nadsvetlobo', topSplit: 'Z nadsvetlobo, deljeno po krilih', bottom: 'Z ločenim spodnjim delom', bottomSplit: 'Z ločenim spodnjim delom, deljenim po krilih' } as Record<string, string>,
    openTitle: 'Odpiranje', openHint: 'Kliknite na krilo v risbi, da spremenite način odpiranja.', topLight: 'Nadsvetloba', bottomPanel: 'Ločen spodnji del', bandFixed: 'Fiksna', bandTilt: 'Na kip', topHeight: 'Višina nadsvetlobe', bottomHeight: 'Višina ločenega spodnjega dela',
    preset: { all_open: 'Vse odpiranje in kip', one_open: 'Eno krilo na odpiranje', outer_open: 'Zunanji krili na odpiranje', all_fixed: 'Vse fiksno' } as Record<string, string>,
    step1: 'Tip okna', step2: 'Profilni sistem', step3: 'Mere in odpiranje', step4: 'Oprema', step5: 'Storitve',
    stepProduct: 'Izdelek', stepSashes: 'Število kril', stepParts: 'Število delov', stepRoof: 'Model in mera', stepSize: 'Mere in odpiranje', stepLayout: 'Postavitev in odpiranje', stepMaterial: 'Material', profilesN: (n: number) => `${n} ${n === 1 ? 'profil' : n === 2 ? 'profila' : n < 5 ? 'profili' : 'profilov'}`, stepNext: 'Naprej', stepDone: 'Končano', stepEdit: 'Uredi', stdEquip: 'Standardna oprema',
    grpWindows: 'Okna', grpSliding: 'Drsna okna', grpDoors: 'Balkonska vrata', grpWalls: 'Drsne stene', grpRoof: 'Strešna okna', servicesHint: 'Velja za vsa okna v povpraševanju.', servicesTitle: 'Storitve', roofServices: 'Strešna okna',
    width: 'Širina', height: 'Višina', range: 'dovoljeno', hinge: 'Stran nasadil (gledano od znotraj)', qty: 'Količina', label: 'Prostor (neobvezno)', labelPh: 'npr. dnevna soba',
    none: 'Brez', yourOrder: 'Vaše povpraševanje', inQuote: 'Okna za ponudbo', position: 'Pozicija', addWindow: 'Dodaj okno', duplicate: 'Podvoji', remove: 'Odstrani',
    unit: 'cena/kos', total: 'Skupaj brez DDV', vat: 'DDV', gross: 'Skupaj z DDV', estimate: 'Okvirna cena. Končno ponudbo pripravimo po izmeri na terenu.',
    basePrice: 'Osnovna cena', noPrice: 'Cena po izmeri', pricesHidden: 'Ceno prejmete v ponudbi na e-mail.',
    next: 'Nadaljuj na podatke', back: 'Nazaj na okna', send: 'Pošlji povpraševanje', sending: 'Pošiljam …',
    contact: 'Vaši podatki', person: 'Fizična oseba', company: 'Podjetje', companyName: 'Naziv podjetja', vatNo: 'ID za DDV', contactPersonHint: 'Kontaktna oseba', firstName: 'Ime', lastName: 'Priimek', email: 'E-pošta', phone: 'Telefon', address: 'Naslov montaže', street: 'Ulica in hišna številka', postal: 'Poštna številka', city: 'Kraj', country: 'Država', postalPick: 'Vpišite številko ali kraj', outOfArea: 'Na tem naslovu montaže ne izvajamo. Povpraševanje lahko pošljete brez montaže.', note: 'Opomba',
    consent: 'Strinjam se, da ponudnik moje podatke uporabi za pripravo ponudbe.',
    doneTitle: 'Hvala, povpraševanje je oddano!', doneText: 'Ponudnik bo pripravil ponudbo in vas kontaktiral. Številka vašega povpraševanja:',
    newOne: 'Novo povpraševanje', invalidSize: 'Mere so izven dovoljenega razpona', pcs: 'kos',
    errors: { invalid_email: 'Vnesite veljaven e-poštni naslov.', name_required: 'Vnesite ime in priimek.', company_required: 'Vnesite naziv podjetja.', address_required: 'Vnesite celoten naslov montaže.', rate_limited: 'Preveč povpraševanj v kratkem času. Poskusite kasneje.', size_out_of_range: 'Nekatere mere so izven dovoljenega razpona.' } as Record<string, string>,
    genericError: 'Pošiljanje ni uspelo. Poskusite znova.',
    addToQuote: 'Dodaj v ponudbo', cancel: 'Prekliči', room: 'Prostor', roofOpeningLabel: 'Odpiranje',
    heard: 'Kje ste izvedeli za nas?', heardPick: 'Izberite',
    reviewTitle: 'Pregled povpraševanja', reviewHint: 'Preverite okna in izbire, preden vpišete svoje podatke.', toReview: 'Pregled povpraševanja', editWindow: 'Uredi', backToReview: 'Nazaj na pregled',
    sashWidths: 'Širina kril', sashN: (n: number) => `Krilo ${n}`, sashRest: 'izračuna se samo', sashTooNarrow: 'Krilo mora biti široko vsaj 300 mm.', sashEqual: 'Enako široka krila',
    subKind: 'Vrsta', subLength: 'Dolžina', subSize: 'Mere', subDesc: 'Opis',
  },
  en: {
    title: 'Window configurator', notFound: 'Configurator not available.', notFoundHint: 'The supplier has not published the configurator yet.',
    qtyTitle: 'Quantity', sizeTitle: 'Size', roofWindow: 'Roof window', roofModelTitle: 'Roof window model', roofVariant: 'Material and colour', roofDatasheet: 'Technical sheet (PDF)', roofSize: 'Size', roofFlashing: 'Roof flashing', roofCenter: 'Centre pivot', roofTop: 'Top hung', from: 'from',
    nSash: (n: number) => n === 1 ? 'Single sash' : n === 2 ? 'Double sash' : n === 3 ? 'Triple sash' : 'Four sashes', slidingWindow: 'Sliding window', sillTitle: 'Window sills', shadeTitle: 'Shading and insect screens', shadeLabel: 'Shading', screenLabel: 'Insect screen', noShade: 'No shading', noScreen: 'No insect screen', sillIn: 'Inside sill', sillOut: 'Outside sill', noSill: 'No sill', glassTitle: 'Glass', handleTitle: 'Handle', lockable: 'Locks with a key', included: 'Included', layers: (n: number) => n === 3 ? 'triple glazed' : n === 2 ? 'double glazed' : `${n} panes`, colorTitle: 'Colour', colorOut: 'Outside', colorIn: 'Inside', nWall: (n: number) => `${n}-panel sliding wall`, nDoor: (n: number) => n === 1 ? 'Single balcony door' : n === 2 ? 'Double balcony door' : 'Triple balcony door',
    bandsTitle: 'Top light / bottom panel', band: { none: 'None', top: 'With top light', topSplit: 'With split top light', bottom: 'With bottom panel', bottomSplit: 'With split bottom panel' } as Record<string, string>,
    openTitle: 'Opening', openHint: 'Click a sash in the drawing to change how it opens.', topLight: 'Top light', bottomPanel: 'Bottom panel', bandFixed: 'Fixed', bandTilt: 'Tilt', topHeight: 'Top light height', bottomHeight: 'Bottom panel height',
    preset: { all_open: 'All tilt & turn', one_open: 'One opening sash', outer_open: 'Outer sashes open', all_fixed: 'All fixed' } as Record<string, string>,
    step1: 'Window type', step2: 'Profile system', step3: 'Size and opening', step4: 'Equipment', step5: 'Services',
    stepProduct: 'Product', stepSashes: 'Number of sashes', stepParts: 'Number of panels', stepRoof: 'Model and size', stepSize: 'Size and opening', stepLayout: 'Layout and opening', stepMaterial: 'Material', profilesN: (n: number) => `${n} ${n === 1 ? 'profile' : 'profiles'}`, stepNext: 'Next', stepDone: 'Done', stepEdit: 'Edit', stdEquip: 'Standard equipment',
    grpWindows: 'Windows', grpSliding: 'Sliding windows', grpDoors: 'Balcony doors', grpWalls: 'Sliding walls', grpRoof: 'Roof windows', servicesHint: 'Applies to all windows in this enquiry.', servicesTitle: 'Services', roofServices: 'Roof windows',
    width: 'Width', height: 'Height', range: 'allowed', hinge: 'Hinge side (seen from inside)', qty: 'Quantity', label: 'Room (optional)', labelPh: 'e.g. living room',
    none: 'None', yourOrder: 'Your enquiry', inQuote: 'Windows for the quote', position: 'Position', addWindow: 'Add window', duplicate: 'Duplicate', remove: 'Remove',
    unit: 'price/pc', total: 'Total excl. VAT', vat: 'VAT', gross: 'Total incl. VAT', estimate: 'Estimated price. The final quote follows an on-site measurement.',
    basePrice: 'Base price', noPrice: 'Price after measurement', pricesHidden: 'You will receive the price in the quote by e-mail.',
    next: 'Continue to details', back: 'Back to windows', send: 'Send enquiry', sending: 'Sending …',
    contact: 'Your details', person: 'Private person', company: 'Company', companyName: 'Company name', vatNo: 'VAT number', contactPersonHint: 'Contact person', firstName: 'First name', lastName: 'Last name', email: 'E-mail', phone: 'Phone', address: 'Installation address', street: 'Street and house number', postal: 'Postal code', city: 'Town', country: 'Country', postalPick: 'Type the code or the town', outOfArea: 'We do not install at this address. You can still send the enquiry without installation.', note: 'Note',
    consent: 'I agree that the supplier uses my data to prepare a quote.',
    doneTitle: 'Thank you, your enquiry was sent!', doneText: 'The supplier will prepare a quote and contact you. Your enquiry number:',
    newOne: 'New enquiry', invalidSize: 'Size is outside the allowed range', pcs: 'pc',
    errors: { invalid_email: 'Enter a valid e-mail address.', name_required: 'Enter your first and last name.', company_required: 'Enter the company name.', address_required: 'Enter the full installation address.', rate_limited: 'Too many enquiries in a short time. Try again later.', size_out_of_range: 'Some sizes are outside the allowed range.' } as Record<string, string>,
    genericError: 'Sending failed. Please try again.',
    addToQuote: 'Add to quote', cancel: 'Cancel', room: 'Room', roofOpeningLabel: 'Opening',
    heard: 'How did you hear about us?', heardPick: 'Choose',
    reviewTitle: 'Review your enquiry', reviewHint: 'Check the windows and choices before you enter your details.', toReview: 'Review enquiry', editWindow: 'Edit', backToReview: 'Back to the review',
    sashWidths: 'Sash widths', sashN: (n: number) => `Sash ${n}`, sashRest: 'worked out for you', sashTooNarrow: 'A sash must be at least 300 mm wide.', sashEqual: 'Equal sashes',
    subKind: 'Type', subLength: 'Length', subSize: 'Size', subDesc: 'Description',
  },
}

let seq = 0
const newKey = () => `i${++seq}`

/** Public configurator /k/:slug: loads the supplier's data, then shows the same configurator the app uses inside quotes. */
export default function ConfiguratorPage() {
  const { slug } = useParams()
  const { lang } = useLanguage()
  const T = TXT[lang]
  const [data, setData] = useState<ConfigData | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading')
  useEffect(() => {
    (supabase as any).rpc('get_configurator', { p_slug: slug }).then(({ data, error }: { data: ConfigData | null; error: unknown }) => {
      if (error || !isUsable(data)) { setState('missing'); return }
      setData(data); setState('ready')
      document.title = `${T.title} · ${data!.company.name}`
    })
  }, [slug])
  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (state === 'missing' || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
      <div className="flex flex-col items-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-[#f3f3f3] flex items-center justify-center mb-4"><EyeOff className="w-6 h-6 text-gray-400" /></div>
        <p className="text-lg font-semibold text-gray-900">{T.notFound}</p><p className="text-sm font-medium text-[#4f4f4f] mt-1">{T.notFoundHint}</p>
      </div>
    </div>
  )
  return <ConfiguratorCore data={data} slug={slug ?? ''} />
}

/** the supplier set up enough for a configurator (types or a builder, and at least one profile) */
export const isUsable = (d: ConfigData | null): d is ConfigData => !!d && (!!d.types.length || !!d.builder) && !!d.systems.length

/** a window as it goes onto a quote: the configuration, its price per piece and every choice in words */
/** a sill, shading or insect screen of a window, priced on its own (like a sub-position on the quote) */
export interface ConfiguredSub {
  code: string; title: string; rows: [string, string][]; unitPrice: number
  /** the supplier's photo of the sill / shading, or what to draw instead (sill material / shading kind) */
  image_url?: string | null; sill?: string | null; shade?: string | null
}
export interface ConfiguredWindow { item: ConfigItem; unitPrice: number | null; title: string; rows: [string, string][]; subs?: ConfiguredSub[] }

/**
 * The configurator. mode="public": the customer's page with header, contact step and services.
 * mode="internal": inside a quote in the app — no header, no contact step, no services (the quote has its own);
 * "Dodaj v ponudbo" hands the configured windows back with their prices and choices.
 */
export function ConfiguratorCore({ data, slug = '', mode = 'public', initialItems, onAdd, onCancel, addLabel }: {
  data: ConfigData; slug?: string; mode?: 'public' | 'internal'; initialItems?: ConfigItem[]
  onAdd?: (windows: ConfiguredWindow[]) => void; onCancel?: () => void; addLabel?: string
}) {
  const { lang, setLang } = useLanguage()
  const T = TXT[lang]
  const L = WL[lang]
  const internal = mode === 'internal'
  const [items, setItems] = useState<ConfigItem[]>(initialItems ?? [])
  const [active, setActive] = useState(0)
  const [stage, setStage] = useState<'config' | 'review' | 'contact' | 'done'>('config')
  const [contact, setContact] = useState({ customer_type: 'person' as 'person' | 'company', company_name: '', vat_number: '', first_name: '', last_name: '', email: '', phone: '', street: '', postal_code: '', city: '', country: 'SI', note: '' })
  const [heard, setHeard] = useState('')
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ quote_number: string } | null>(null)
  // services are chosen once for the whole order (montaža, demontaža, odvoz …)
  const [openMap, setOpenMap] = useState<Record<string, string>>(() => Object.fromEntries((initialItems ?? []).map(x => [x.key, 'none'])))
  const [services, setServices] = useState<string[]>(() => data.options.filter(o => isService(o) && o.is_default).map(o => o.id))
  // start with one window (or the windows handed in when a quote position is edited)
  useEffect(() => { if (!items.length) setItems([defaultItem(data)]) }, [])
  // an installation address outside the supplier's area: the enquiry goes without installation
  const outOfArea = !!contact.postal_code.trim() && !inArea(data.company.area, contact.country, contact.postal_code)
  useEffect(() => {
    if (!outOfArea) return
    const inst = data.options.filter(o => o.group_key === 'installation').map(o => o.id)
    setServices(sv => sv.filter(id => !inst.includes(id)))
  }, [outOfArea])

  const accent = data?.company.accent || '#131313'
  const cur = data?.company.currency || 'EUR'
  const currency = cur
  const show = !!data?.company.show_prices

  const builder = data?.builder ?? null
  const bPricing = builder?.pricing ? pricingFrom({ ...builder.pricing, glass: builder.glass ?? undefined, handles: builder.handles ?? undefined, sills: builder.sills ?? undefined, shading: builder.shading ?? undefined }) : null
  const glassList = builder?.glass ?? [], handleList = builder?.handles ?? [], sillList = builder?.sills ?? [], shadeList = builder?.shading ?? []
  const sashWidth = (n: number) => (n === 1 ? 900 : n * 650)
  const doorWidth = (n: number) => (n === 1 ? 900 : n * 700)
  /** windows and balcony doors keep their offer apart */
  const bk = (sp: WindowSpec): BuilderKind => (sp.kind === 'door' ? 'door' : undefined)
  const wallWidth = (n: number) => n * 1000
  /** sliding windows and sliding walls: panel layouts instead of top lights and variants */
  const slidingKind = (sp: WindowSpec) => (sp.kind === 'sliding' || sp.kind === 'wall' ? sp.kind : undefined)
  function defaultSpecItem(d: ConfigData, n: number): ConfigItem {
    return {
      key: newKey(), type_id: '', system_id: d.systems[0].id, width: sashWidth(n), height: 1400, hinge: 'left', quantity: 1, label: '',
      option_ids: d.options.filter(o => o.is_default && SINGLE_CHOICE_GROUPS.includes(o.group_key)).map(o => o.id), spec: makeSpec(n),
    }
  }
  /** base price of a window built from sashes, in this profile */
  function specBase(it: ConfigItem, systemId = it.system_id): number | null {
    if (!data || !bPricing || !it.spec || !it.width || !it.height) return null
    const sy = data.systems.find(x => x.id === systemId)
    if (!sy) return null
    const prof = {
      frame_m: Number(sy.frame_m ?? 0), sash_m: Number(sy.sash_m ?? 0), mullion_m: Number(sy.mullion_m ?? 0), bead_m: Number(sy.bead_m ?? 0),
      frame_w: sy.frame_w, sash_w: sy.sash_w, mullion_w: sy.mullion_w,
    }
    const colorPct = colorPctOf(data.builder?.colors?.[sy.material], it.colors?.out, it.colors?.in)
    const c = costWindow(specToLayout(it.spec), it.width, it.height, prof, bPricing, { colorPct, glassId: it.glass, handleId: it.handle, sillIn: it.sills?.in, sillOut: it.sills?.out, shadeId: it.shading?.shade, screenId: it.shading?.screen })
    // the profile's lowest price is for the window alone (standard glass and handle):
    // better glass, a dearer handle, sills, shading and insect screens are added on top of it
    const win = costWindow(specToLayout(it.spec), it.width, it.height, prof, bPricing, { colorPct, glassId: glassList[0]?.id ?? it.glass, handleId: handleList[0]?.id ?? it.handle })
    return Math.round((Math.max(Number(sy.min_price ?? 0), win.price) + (c.price - win.price)) * 100) / 100
  }

  function defaultItem(d: ConfigData, typeId?: string): ConfigItem {
    const b = d.builder
    const sashes = (b?.offer?.sashes ?? []).filter(n => n <= 3)
    if (!typeId && b?.offer?.windows && sashes.length) return defaultSpecItem(d, sashes.includes(2) ? 2 : sashes[0])
    const type = d.types.find(t => t.id === typeId) ?? d.types.find(t => t.template === 'tilt_turn') ?? d.types[0]
    if (!type) return defaultSpecItem(d, 1)
    const sys = d.systems.find(s => d.combos.some(c => c.system_id === s.id && c.type_id === type.id)) ?? d.systems[0]
    const door = type.template.startsWith('door') || type.template === 'lift_slide'
    return {
      key: newKey(), type_id: type.id, system_id: sys.id,
      width: clamp(door ? 900 : 1200, type.min_width, type.max_width),
      height: clamp(door ? 2200 : 1400, type.min_height, type.max_height),
      hinge: 'left', quantity: 1, label: '',
      option_ids: d.options.filter(o => o.is_default && SINGLE_CHOICE_GROUPS.includes(o.group_key)).map(o => o.id),
    }
  }

  /** roof window: sale price of the size with the material / colour surcharge (+ flashing) */
  function roofPrice(it: ConfigItem): number | null {
    const cat = data?.builder?.roof
    if (!cat || !it.roof) return null
    const m = cat.models.find(x => x.id === it.roof!.model), sz = m?.sizes.find(x => x.id === it.roof!.size)
    if (!sz) return null
    const fl = cat.flashings.find(x => x.id === it.roof!.flashing)
    const v = m?.variants?.find(x => x.id === it.roof!.variant)
    return roofUnitPrice(Number(sz.price), Number(v?.pct ?? 0), Number(fl?.price ?? 0))
  }
  function priceOf(it: ConfigItem): number | null {
    if (it.roof) return show ? roofPrice(it) : null
    if (!data || !show || !it.width || !it.height) return null
    const base = it.spec ? specBase(it) : basePrice(data.prices.find(x => x.system_id === it.system_id && x.type_id === it.type_id), it.width, it.height)
    return unitPrice(base, it.width, it.height, data.options.filter(o => it.option_ids.includes(o.id) && !isService(o)))
  }
  function baseOf(it: ConfigItem): number | null {
    if (it.roof) return roofPrice(it)
    if (!data || !it.width || !it.height) return null
    if (it.spec) return specBase(it)
    return basePrice(data.prices.find(x => x.system_id === it.system_id && x.type_id === it.type_id), it.width, it.height)
  }
  const serviceRows = useMemo(() => {
    if (!data) return []
    const wins = items.map(x => ({ width: x.width ?? 0, height: x.height ?? 0, quantity: x.quantity, base: baseOf(x), roof: !!x.roof,
      sills: (x.sills?.in ? 1 : 0) + (x.sills?.out ? 1 : 0), shades: x.shading?.shade ? 1 : 0, screens: x.shading?.screen ? 1 : 0 }))
    // work on chosen sills / shadings / insect screens comes automatically with the chosen installation
    const installing = data.options.some(o => o.group_key === 'installation' && services.includes(o.id))
    const auto = (o: WindowOption) => !!o.per_item && o.per_item !== 'window' && o.per_item !== 'roof'
    return data.options.filter(o => auto(o) ? installing : services.includes(o.id)).map(o => ({ option: o, ...serviceLine(o, wins) }))
      .filter(r => r.qty > 0 || r.option.pricing === 'flat' || r.option.pricing === 'percent')
  }, [data, items, services])
  function toggleService(o: WindowOption) {
    // one way of installation at a time; everything else is an on/off add-on
    if (o.group_key === 'installation') {
      const same = data!.options.filter(x => x.group_key === 'installation').map(x => x.id)
      setServices(sv => sv.includes(o.id) ? sv.filter(id => id !== o.id) : [...sv.filter(id => !same.includes(id)), o.id])
    } else setServices(sv => sv.includes(o.id) ? sv.filter(id => id !== o.id) : [...sv, o.id])
  }
  function sizeOk(it: ConfigItem) {
    if (it.roof) return roofPrice(it) != null || !show
    if (it.spec) { const n = it.spec.sashes; return !!it.width && !!it.height && it.width >= 300 * n && it.width <= 1600 * n && it.height >= 300 && it.height <= 2800 && !(it.sashWidths ?? []).some(x => x < 300) }
    const t = data?.types.find(x => x.id === it.type_id)
    return !!t && !!it.width && !!it.height && it.width >= t.min_width && it.width <= t.max_width && it.height >= t.min_height && it.height <= t.max_height
  }

  const totals = useMemo(() => {
    const net = items.reduce((a, it) => a + (priceOf(it) ?? 0) * it.quantity, 0) + (show ? serviceRows.reduce((a, r) => a + r.total, 0) : 0)
    const installing = !!data?.options.some(o => o.group_key === 'installation' && services.includes(o.id))
    const baseRate = data?.company.vat_rate ?? 22
    const vatRate = baseRate === 0 ? 0 : installing && contact.customer_type === 'person' ? 9.5 : baseRate
    const vat = Math.round(net * vatRate) / 100
    return { net, vat, gross: net + vat, vatRate, complete: items.every(it => priceOf(it) != null) }
  }, [items, data, serviceRows, services, contact.customer_type])

  if (!items.length) return null
  const it = items[active] ?? items[0]
  const spec = it.spec ?? null
  const roofSel = it.roof ?? null
  const roofCat = builder?.roof ?? null
  const type = spec || roofSel ? null : (data.types.find(t => t.id === it.type_id) ?? null)
  // with the builder only balcony doors, sliding systems and special shapes stay as fixed types
  const visibleTypes = builder ? data.types.filter(t => isDoor(t.template) && !(builder.offer?.doors && t.template.startsWith('door')) && !(builder.offer?.sliding && (t.template === 'psk' || t.template === 'lift_slide'))) : data.types.filter(t => t.template !== 'special')
  // built windows / doors / walls: only the profiles the supplier uses for that product group
  const allowedSystems = spec ? data.systems.filter(s => profileServes(s.applies_to, productGroupOf(spec.kind))) : data.systems.filter(s => type && data.combos.some(c => c.system_id === s.id && c.type_id === type.id))
  // older saved offers miss newer switches: fill them with the defaults
  const offer = builder?.offer ? pricingFrom({ offer: builder.offer }).offer : undefined
  const range = spec ? { min_width: 300 * spec.sashes, max_width: 1600 * spec.sashes, min_height: 300, max_height: 2800 } : type ?? { min_width: 0, max_width: 99999, min_height: 0, max_height: 99999 }
  const roofModel = roofSel && roofCat ? roofCat.models.find(m => m.id === roofSel.model) ?? null : null
  function pickRoof(patch?: Partial<NonNullable<ConfigItem['roof']>>) {
    if (!roofCat?.models.length) return
    const cur = roofSel ?? { model: roofCat.models[0].id, size: '', flashing: roofCat.flashings[0]?.id ?? null, variant: null }
    const next = { ...cur, ...patch }
    const m = roofCat.models.find(x => x.id === next.model) ?? roofCat.models[0]
    // material / colour: keep it when the model has it, otherwise the first one
    const vs = m.variants ?? []
    next.variant = vs.some(x => x.id === next.variant) ? next.variant : vs[0]?.id ?? null
    const sz = m.sizes.find(x => x.id === next.size) ?? m.sizes.find(x => x.w === 78 && x.h === 118) ?? m.sizes[0]
    // sizes in cm → mm, so services per piece / metre still work for roof windows
    update({ roof: { ...next, model: m.id, size: sz?.id ?? '' }, spec: null, type_id: '', width: sz ? sz.w * 10 : null, height: sz ? sz.h * 10 : null, option_ids: [] })
  }
  const specName = (sp: WindowSpec) => (sp.kind === 'sliding' ? T.slidingWindow : sp.kind === 'door' ? T.nDoor(sp.sashes) : sp.kind === 'wall' ? T.nWall(sp.sashes) : T.nSash(sp.sashes))
  /** keep the chosen profile when it serves the new product, otherwise the first one that does */
  const sysFor = (kind: WindowSpec['kind']) => {
    const ok = data!.systems.filter(x => profileServes(x.applies_to, productGroupOf(kind)))
    return ok.some(x => x.id === it.system_id) ? it.system_id : ok[0]?.id ?? it.system_id
  }
  function pickSliding() { update({ roof: null, spec: fitOffer(makeSlidingSpec()), type_id: '', system_id: sysFor('sliding'), width: spec?.kind === 'sliding' ? it.width : 1600, height: it.height ?? 1200 }) }
  const setSpec = (sp: WindowSpec) => update({ spec: sp })
  /** a spec that only uses a top light / opening layout the supplier ticked for this window type */
  function fitOffer(sp: WindowSpec): WindowSpec {
    if (!offer) return sp
    const bands = allowedBands(sp.sashes, offer, bk(sp))
    let next = bands.includes(bandKeyOf(sp)) || !bands.length ? sp : reshapeSpec(sp, sp.sashes, ...BAND_SHAPE[bands[0]])
    if (slidingKind(next)) {
      const combos = allowedCombos(next.sashes, offer, slidingKind(next))
      if (combos.length && !combos.some(c => comboKey(c) === comboKey(next.main))) next = { ...next, main: combos[0] }
      return next
    }
    const vs = allowedVariants(next.sashes, offer, bk(next)).filter(v => v.band === bandKeyOf(next))
    if (vs.length && !vs.some(v => v.key === specVariantKey(next))) {
      next = applyVariant(next, vs.find(v => v.combo.every(f => f.opening === 'tilt_turn') && v.mode !== 'tilt') ?? vs[0])
    }
    return next
  }
  function pickSashes(n: number) {
    const cur = spec && !spec.kind ? spec : makeSpec(n)
    const wasWindow = !!spec && !spec.kind
    update({ roof: null, spec: fitOffer(reshapeSpec(cur, n, cur.top, cur.bottom)), type_id: '', system_id: sysFor(undefined), width: wasWindow && spec!.sashes === n ? it.width : sashWidth(n), height: wasWindow ? it.height : 1400 })
  }
  function pickWall(n: number) {
    const was = spec?.kind === 'wall' && spec.sashes === n
    update({ roof: null, spec: fitOffer(was ? spec! : makeWallSpec(n)), type_id: '', system_id: sysFor('wall'), width: was ? it.width : wallWidth(n), height: spec?.kind === 'wall' ? it.height : 2200 })
  }
  function pickDoor(n: number) {
    const wasDoor = spec?.kind === 'door'
    const cur = wasDoor ? spec! : makeDoorSpec(n)
    update({ roof: null, spec: fitOffer(reshapeSpec(cur, n, cur.top, 'none')), type_id: '', system_id: sysFor('door'), width: wasDoor && spec!.sashes === n ? it.width : doorWidth(n), height: wasDoor ? it.height : 2200 })
  }
  function pickBand(top: Band, bottom: Band) { if (spec) setSpec(fitOffer(reshapeSpec(spec, spec.sashes, top, bottom))) }
  const specPrice = (sp: WindowSpec) => specBase({ ...it, spec: sp })
  const specPriceWith = (colors: ConfigItem['colors']) => specBase({ ...it, colors })
  /** extras groups shown for this window: built windows take colour / glass / handle from the builder's own catalogues */
  const extraGroups = data ? OPTION_GROUPS.filter(g => data.options.some(o => o.group_key === g)
    && !(spec && ((g === 'color' && data.builder?.colors) || (g === 'glass' && glassList.length) || (g === 'handle' && handleList.length) || (g === 'sill' && sillList.length) || (g === 'shading' && shadeList.length)))) : []
  const update = (patch: Partial<ConfigItem>) => setItems(xs => xs.map((x, i) => {
    if (i !== active) return x
    const next = { ...x, ...patch }
    if (next.spec) {
      const ws = next.sashWidths && next.sashWidths.length === next.spec.main.length && !next.spec.kind?.match(/sliding|wall/) ? next.sashWidths : null
      next.sashWidths = ws
      next.spec = { ...next.spec, main: next.spec.main.map((f, j) => (ws ? { ...f, weight: ws[j] } : (({ weight: _w, ...rest }) => rest)(f))) }
    }
    return next
  }))
  /** the customer types the sashes' widths: all but the last, which fills the rest */
  function setSashWidth(j: number, v: number | null) {
    if (!it.spec || !it.width) return
    const n = it.spec.main.length
    const cur = it.sashWidths && it.sashWidths.length === n ? [...it.sashWidths] : Array.from({ length: n }, () => Math.round(it.width! / n))
    cur[j] = v ?? 0
    cur[n - 1] = Math.max(0, it.width - cur.slice(0, n - 1).reduce((a, b) => a + b, 0))
    update({ sashWidths: cur })
  }

  function pickType(t: WindowType) {
    const keepSystem = data!.combos.some(c => c.system_id === it.system_id && c.type_id === t.id)
    const d = defaultItem(data!, t.id)
    update({ roof: null, spec: null, type_id: t.id, system_id: keepSystem ? it.system_id : d.system_id, width: clamp(it.width ?? d.width!, t.min_width, t.max_width), height: d.height })
  }
  function toggleOption(o: WindowOption) {
    const single = SINGLE_CHOICE_GROUPS.includes(o.group_key)
    const sameGroup = data!.options.filter(x => x.group_key === o.group_key).map(x => x.id)
    if (single) update({ option_ids: [...it.option_ids.filter(id => !sameGroup.includes(id)), o.id] })
    else update({ option_ids: it.option_ids.includes(o.id) ? it.option_ids.filter(id => id !== o.id) : [...it.option_ids, o.id] })
  }
  function addItem(copy = false) {
    const next = copy ? { ...it, key: newKey(), option_ids: [...it.option_ids] } : defaultItem(data!)
    // a copy keeps its choices, so its steps start closed
    if (copy) setOpenMap(m => ({ ...m, [next.key]: 'none' }))
    setItems(xs => [...xs, next]); setActive(items.length)
  }
  function removeItem(i: number) {
    if (items.length === 1) return
    setItems(xs => xs.filter((_, j) => j !== i)); setActive(a => Math.max(0, a >= i ? a - 1 : a))
  }

  async function submit() {
    setError('')
    if (!consent) return
    setSending(true)
    const { data: res, error } = await (supabase as any).rpc('submit_configuration', {
      p_slug: slug,
      p_customer: { ...contact, lead_source: heard || null },
      p_items: items.map(x => x.roof
        ? { roof: x.roof, quantity: x.quantity, option_ids: [], label: x.label }
        : x.spec
        ? { system_id: x.system_id, spec: x.spec, colors: x.colors ?? null, glass: x.glass ?? null, handle: x.handle ?? null, sills: x.sills ?? null, shading: x.shading ?? null, width: x.width, height: x.height, quantity: x.quantity, option_ids: x.option_ids, label: x.label }
        : { system_id: x.system_id, type_id: x.type_id, width: x.width, height: x.height, quantity: x.quantity, hinge: x.hinge, option_ids: x.option_ids, label: x.label }),
      p_note: contact.note,
      p_services: services,
    })
    setSending(false)
    if (error) {
      const code = Object.keys(T.errors).find(k => String(error.message).includes(k))
      setError(code ? T.errors[code] : T.genericError)
      return
    }
    setResult(res); setStage('done'); window.scrollTo({ top: 0 })
  }

  /** title + every choice of a window in words, in the order of the configurator */
  function describe(x: ConfigItem): { title: string; rows: [string, string][] } {
    const rows: [string, string][] = []
    const add = (l: string, v: string | null | undefined) => { if (v) rows.push([l, v]) }
    if (x.roof) {
      const m = roofCat?.models.find(mm => mm.id === x.roof!.model)
      const v = m?.variants?.find(vv => vv.id === x.roof!.variant)
      const fl = roofCat?.flashings.find(ff => ff.id === x.roof!.flashing)
      add(T.roofModelTitle, [m?.brand, m?.name].filter(Boolean).join(' '))
      add(T.roofOpeningLabel, m ? (m.opening === 'top' ? T.roofTop : T.roofCenter) : null)
      add(T.roofVariant, v?.name)
      add(T.roofSize, `${(x.width ?? 0) / 10} × ${(x.height ?? 0) / 10} cm`)
      add(T.roofFlashing, fl?.name ?? T.none)
      add(T.room, x.label)
      return { title: `${T.roofWindow}${m ? ` ${[m.brand, m.name].filter(Boolean).join(' ')}` : ''}`, rows }
    }
    const t = data.types.find(tt => tt.id === x.type_id)
    const sy = data.systems.find(ss => ss.id === x.system_id)
    add(T.step2, sy ? (sy.material && sy.name.trim().toLowerCase() !== L.materials[sy.material].toLowerCase() ? `${sy.name} (${L.materials[sy.material]})` : sy.name) : null)
    add(T.sizeTitle, `${x.width} × ${x.height} mm`)
    if (x.spec) {
      const list = sy ? data.builder?.colors?.[sy.material] ?? [] : []
      const out = list.find(c => c.id === x.colors?.out) ?? list[0], inn = list.find(c => c.id === x.colors?.in) ?? list[0]
      if (out || inn) add(T.colorTitle, `${T.colorOut}: ${out?.name ?? '—'} · ${T.colorIn}: ${inn?.name ?? '—'}`)
      const g = glassList.find(gg => gg.id === x.glass) ?? glassList[0]
      add(T.glassTitle, g ? [g.name, g.ug != null ? `Ug ${Number(g.ug).toFixed(1).replace('.', ',')} W/m²K` : null].filter(Boolean).join(', ') : null)
      const h = handleList.find(hh => hh.id === x.handle) ?? handleList[0]
      add(T.handleTitle, h ? `${h.name}${h.lockable ? ` · ${T.lockable}` : ''}` : null)
    } else if (t && hasHingeChoice(t.template)) add(T.hinge, L.hinge[x.hinge])
    const extras = data.options.filter(o => x.option_ids.includes(o.id) && !isService(o)).map(o => o.name)
    add(T.step4, extras.join(', '))
    add(T.room, x.label)
    return { title: x.spec ? specName(x.spec) : t?.name ?? '', rows }
  }
  /** the window without its sills / shading / screens, and each of them as its own priced sub-position:
   *  added one after another, so window + sub-positions add up to exactly the configurator's price */
  function split(x: ConfigItem): { unitPrice: number | null; subs: ConfiguredSub[] } {
    if (!x.spec) return { unitPrice: priceOf(x), subs: [] }
    const pick = { sIn: null as string | null, sOut: null as string | null, shade: null as string | null, screen: null as string | null }
    const at = () => priceOf({ ...x, sills: { in: pick.sIn, out: pick.sOut }, shading: { shade: pick.shade, screen: pick.screen } })
    const base = at()
    if (base == null) return { unitPrice: priceOf(x), subs: [] }
    let prev = base
    const subs: ConfiguredSub[] = []
    const size = `${x.width} × ${x.height} mm`
    type Found = { name: string; description?: string; image_url?: string | null; material?: string; icon?: string }
    const steps: [keyof typeof pick, string | null | undefined, string, string, (id: string) => Found | undefined, [string, string][]][] = [
      ['sIn', x.sills?.in, 'P1', T.sillIn, id => sillList.find(s => s.id === id), [[T.subLength, `${x.width} mm`]]],
      ['sOut', x.sills?.out, 'P2', T.sillOut, id => sillList.find(s => s.id === id), [[T.subLength, `${x.width} mm`]]],
      ['shade', x.shading?.shade, 'S', T.shadeLabel, id => shadeList.find(s => s.id === id), [[T.subSize, size]]],
      ['screen', x.shading?.screen, 'K', T.screenLabel, id => shadeList.find(s => s.id === id), [[T.subSize, size]]],
    ]
    for (const [k, id, code, kind, find, rows] of steps) {
      if (!id) continue
      pick[k] = id
      const p = at() ?? prev
      const o = find(id)
      const isSill = k === 'sIn' || k === 'sOut'
      subs.push({
        code, title: o?.name ?? kind, rows: [[T.subKind, kind], ...rows, ...(o?.description ? [[T.subDesc, o.description] as [string, string]] : [])],
        unitPrice: Math.round((p - prev) * 100) / 100,
        image_url: o?.image_url ?? null, sill: isSill ? o?.material ?? null : null, shade: isSill ? null : o?.icon ?? (k === 'screen' ? 'screen_fixed' : 'roller'),
      })
      prev = p
    }
    return { unitPrice: base, subs }
  }
  function handBack() {
    onAdd?.(items.map(x => ({ item: x, ...split(x), ...describe(x) })))
  }

  const p = priceOf(it)
  const btn = { backgroundColor: accent }

  // ── the configurator goes step by step: product, sashes, profile, colour, size and opening, equipment, services
  const group = roofSel ? 'roof' : spec ? (spec.kind === 'sliding' ? 'sliding' : spec.kind === 'door' ? 'door' : spec.kind === 'wall' ? 'wall' : 'windows') : 'type:' + it.type_id
  const firstWall = offer ? [...(offer.wallSashes ?? [2, 3, 4])].sort().find(n => allowedCombos(n, offer, 'wall').length) ?? null : null
  const sysNow = data.systems.find(x => x.id === it.system_id)
  // material first (PVC, aluminium, wood …), then the profiles of that material
  const materials = [...new Set(allowedSystems.map(x => x.material))]
  const matNow = sysNow && materials.includes(sysNow.material) ? sysNow.material : materials[0]
  const matSystems = allowedSystems.filter(x => x.material === matNow)
  const sysPrice = (id: string) => spec ? specBase(it, id) : type ? basePrice(data.prices.find(x => x.system_id === id && x.type_id === type.id), it.width ?? 0, it.height ?? 0) : null
  /** choosing a material: its cheapest profile for this window */
  function pickMaterial(m: string) {
    if (m === matNow) return
    const list = allowedSystems.filter(x => x.material === m)
    const priced = list.map(x => ({ x, p: sysPrice(x.id) })).sort((a, b) => (a.p ?? Infinity) - (b.p ?? Infinity))
    if (priced[0]) update({ system_id: priced[0].x.id })
  }
  const colorList = spec && sysNow ? data.builder?.colors?.[sysNow.material] ?? [] : []
  const stepIds = [
    'product',
    ...(roofSel || (spec && spec.kind !== 'sliding') ? ['variant'] : []),
    ...(spec && offer ? ['layout'] : []),
    ...(!roofSel && materials.length > 1 ? ['material'] : []),
    ...(!roofSel ? ['profile'] : []),
    ...(colorList.length >= 2 ? ['color'] : []),
    'size',
    ...(!roofSel && ((spec && (glassList.length > 1 || handleList.length > 1 || sillList.length > 0 || shadeList.length > 0)) || extraGroups.length > 0) ? ['equipment'] : []),
    ...(!internal && data.options.some(isService) ? ['services'] : []),
  ]
  const openStep = openMap[it.key] ?? 'product'
  const openIdx = stepIds.indexOf(openStep)
  function setOpen(id: string) {
    setOpenMap(m => ({ ...m, [it.key]: id }))
    if (id !== 'none') setTimeout(() => document.getElementById('step-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const groupLabel = group === 'roof' ? T.grpRoof : group === 'sliding' ? T.grpSliding : group === 'door' ? T.grpDoors : group === 'wall' ? T.grpWalls : group === 'windows' ? T.grpWindows : type?.name ?? ''
  const roofSize = roofModel?.sizes.find(x => x.id === roofSel?.size)
  const variantSummary = roofSel
    ? [roofModel ? [roofModel.brand, roofModel.name].filter(Boolean).join(' ') : '', roofSize ? `${roofSize.w} × ${roofSize.h} cm` : ''].filter(Boolean).join(' · ')
    : spec ? specName(spec) : ''
  // the layout step: top light / bottom panel and how each sash opens
  const layoutSummary = spec ? [
    !slidingKind(spec) ? T.band[bandKeyOf(spec)] : '',
    spec.main.map(f => (lang === 'sl' ? OPEN_SL : OPEN_EN)[f.opening as string] ?? '').filter(Boolean).join(' + '),
  ].filter(Boolean).join(' · ') : ''
  const profileSummary = sysNow?.name ?? ''
  const materialSummary = matNow ? L.materials[matNow] : ''
  const colorSummary = colorList.length ? `${T.colorOut}: ${(colorList.find(c => c.id === it.colors?.out) ?? colorList[0]).name} · ${T.colorIn}: ${(colorList.find(c => c.id === it.colors?.in) ?? colorList[0]).name}` : ''
  const sizeSummary = roofSel ? `${it.quantity} ${T.pcs}` : `${it.width ?? '—'} × ${it.height ?? '—'} mm · ${it.quantity} ${T.pcs}`
  const equipSummary = [
    spec && glassList.length > 1 ? (glassList.find(g => g.id === it.glass) ?? glassList[0]).name : '',
    spec && handleList.length > 1 ? (handleList.find(h => h.id === it.handle) ?? handleList[0]).name : '',
    ...[it.sills?.in, it.sills?.out].map(id => sillList.find(x => x.id === id)?.name ?? ''),
    ...[it.shading?.shade, it.shading?.screen].map(id => shadeList.find(x => x.id === id)?.name ?? ''),
    ...data.options.filter(o => it.option_ids.includes(o.id) && !isService(o)).map(o => o.name),
  ].filter(Boolean).join(', ') || T.stdEquip
  const servicesSummary = data.options.filter(o => services.includes(o.id)).map(o => o.name).join(', ') || T.none
  /** a product card in the first step: picking it only selects it, "Naprej" goes on */
  const prodCard = (key: string, label: string, drawing: React.ReactNode, onPick: () => void, _next?: string) => {
    const on = group === key
    return <button key={key} onClick={() => { if (!on) onPick() }}
      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
      style={on ? selStyle(accent) : undefined}>
      {on && <SelBadge accent={accent} />}
      <div className="h-[84px] flex items-center justify-center">{drawing}</div>
      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{label}</div>
    </button>
  }
  /** one step: open with its choices and "Naprej", or closed to one row with the choice and "Uredi" */
  function renderStep(id: string, title: string, summary: string, body: React.ReactNode) {
    const idx = stepIds.indexOf(id)
    if (idx < 0) return null
    const done = openIdx < 0 || idx < openIdx
    const nextId = stepIds[idx + 1]
    const num = <span className="w-7 h-7 rounded-full text-[13px] font-semibold flex items-center justify-center shrink-0"
      style={done || openStep === id ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: '#f1f1f1', color: '#4f4f4f' }}>
      {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : idx + 1}</span>
    if (openStep !== id) return <button id={'step-' + id} key={id} type="button" onClick={() => setOpen(id)}
      className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-3 text-left hover:border-gray-400 transition-colors scroll-mt-4">
      {num}
      <span className="text-[15px] font-semibold text-gray-900 shrink-0">{title}</span>
      <span className="flex-1 min-w-0 truncate text-right text-sm font-medium text-[#4f4f4f]">{done ? summary : ''}</span>
      {done && <span className="text-sm font-semibold shrink-0 underline-offset-2 hover:underline" style={{ color: accent }}>{T.stepEdit}</span>}
    </button>
    return <section id={'step-' + id} key={id} className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 scroll-mt-4">
      <h2 className="flex items-center gap-3 text-lg font-semibold tracking-[-0.01em] text-gray-900 mb-4">{num}{title}</h2>
      <div className="space-y-6">{body}</div>
      <div className="flex justify-end mt-6">
        <button type="button" onClick={() => setOpen(nextId ?? 'none')} className="h-10 px-5 rounded-[10px] text-sm font-semibold text-white" style={btn}>{nextId ? T.stepNext : T.stepDone}</button>
      </div>
    </section>
  }

  return (
    <div className={internal ? 'text-gray-900' : 'min-h-screen bg-white text-gray-900'}>
      {/* Header */}
      {!internal && <header className="bg-white border-b border-gray-200">
        <div className="px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {data.company.logo_url
              ? <img src={data.company.logo_url} alt="" className="h-12 w-auto max-w-[240px] object-contain" />
              : <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-lg font-semibold" style={btn}>{data.company.name.charAt(0)}</div>}
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-gray-900 truncate">{data.company.name}</div>
              <div className="text-[13px] font-medium text-gray-500">{T.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[13px] font-medium text-gray-500">
            {data.company.phone && <a href={`tel:${data.company.phone}`} className="hidden sm:flex items-center gap-1.5 hover:text-gray-900 transition-colors"><Phone className="w-3.5 h-3.5" />{data.company.phone}</a>}
            {data.company.email && <a href={`mailto:${data.company.email}`} className="hidden md:flex items-center gap-1.5 hover:text-gray-900 transition-colors"><Mail className="w-3.5 h-3.5" />{data.company.email}</a>}
            <div className="flex p-0.5 rounded-lg bg-[#f4f4f4]">
              {(['sl', 'en'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={cn('px-2 h-6 rounded-md text-xs font-semibold uppercase transition-colors', lang === l ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-900')}>{l}</button>)}
            </div>
          </div>
        </div>
      </header>}

      {stage === 'done' ? (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white mb-4" style={btn}><Check className="w-6 h-6" /></div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">{T.doneTitle}</h1>
          <p className="text-[15px] text-gray-500 mt-2">{T.doneText}</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">{result?.quote_number}</p>
          <button onClick={() => { setItems([defaultItem(data)]); setActive(0); setStage('config'); setConsent(false); setContact(c => ({ ...c, note: '' })) }}
            className="mt-6 text-sm font-medium hover:underline" style={{ color: accent }}>{T.newOne}</button>
        </div>
      ) : (
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-6 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Main column */}
          <div className="space-y-4 min-w-0">
            {stage === 'config' && !internal && data.company.intro && <p className="text-[15px] leading-6 text-gray-500 whitespace-pre-line">{data.company.intro}</p>}

            {stage === 'config' ? <>
              {/* Position tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {items.map((x, i) => <button key={x.key} onClick={() => setActive(i)}
                  className={cn('shrink-0 h-9 px-3.5 rounded-[10px] text-sm font-medium border transition-colors', i === active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-900 hover:border-gray-400')}
                  style={i === active ? btn : undefined}>
                  {T.position} {i + 1}{x.label ? ` · ${x.label}` : ''}
                </button>)}
                <button onClick={() => addItem(false)} className="shrink-0 h-9 px-3.5 rounded-[10px] text-sm font-medium border border-dashed border-gray-300 text-gray-900 hover:border-gray-500 flex items-center gap-1.5 transition-colors"><Plus className="w-3.5 h-3.5" />{T.addWindow}</button>
              </div>

              {renderStep('product', T.stepProduct, groupLabel, <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {offer?.windows && !!(offer.sashes ?? []).length && prodCard('windows', T.grpWindows, <SpecDrawing spec={makeSpec(2, 'none', 'none', 'fixed')} width={1300} height={1300} size={84} plain />,
                  () => pickSashes(spec && !spec.kind ? spec.sashes : (offer.sashes ?? []).includes(2) ? 2 : [...(offer.sashes ?? [])].sort()[0]), 'variant')}
                {offer?.slidingWindows && prodCard('sliding', T.grpSliding, <SpecDrawing spec={makeSlidingSpec()} width={1600} height={1200} size={96} plain />, pickSliding, 'profile')}
                {offer?.doors && prodCard('door', T.grpDoors, <SpecDrawing spec={makeSpec(1, 'none', 'none', 'fixed')} width={900} height={2200} size={84} plain />,
                  () => pickDoor(spec?.kind === 'door' ? spec.sashes : [...(offer.doorSashes ?? [1, 2, 3])].sort()[0]), 'variant')}
                {offer?.sliding && firstWall != null && prodCard('wall', T.grpWalls, <SpecDrawing spec={makeSpec(firstWall, 'none', 'none', 'fixed')} width={wallWidth(firstWall)} height={2200} size={96} plain />,
                  () => pickWall(spec?.kind === 'wall' ? spec.sashes : firstWall), 'variant')}
                {offer?.roof && !!roofCat?.models.length && prodCard('roof', T.grpRoof, <RoofWindowDrawing size={78} />, () => { if (!roofSel) pickRoof() }, 'variant')}
                {visibleTypes.map(t => {
                  const door = t.template.startsWith('door') || t.template === 'lift_slide'
                  return prodCard('type:' + t.id, t.name, <WindowDrawing template={t.template} width={door ? 900 : 1200} height={door ? 2100 : 1300} size={78} plain />, () => pickType(t), 'profile')
                })}
              </div>)}

              {renderStep('variant', roofSel ? T.stepRoof : spec?.kind === 'wall' ? T.stepParts : T.stepSashes, variantSummary, <>
                {(group === 'windows' || group === 'door' || group === 'wall') && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {group === 'windows' && (offer?.windows && [...(offer.sashes ?? [])].sort().map(n => {
                    const on = spec?.sashes === n && !spec.kind
                    return <button key={'w' + n} onClick={() => pickSashes(n)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={sashWidth(n)} height={1300} size={n > 2 ? 100 : 78} plain /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.nSash(n)}</div>
                    </button>
                  }))}
                  {group === 'door' && (offer?.doors && [...(offer.doorSashes ?? [1, 2, 3])].sort().map(n => {
                    const on = spec?.sashes === n && spec.kind === 'door'
                    return <button key={'d' + n} onClick={() => pickDoor(n)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={doorWidth(n)} height={2200} size={84} plain /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.nDoor(n)}</div>
                    </button>
                  }))}
                  {group === 'wall' && (offer?.sliding && [...(offer.wallSashes ?? [2, 3, 4])].sort().filter(n => allowedCombos(n, offer, 'wall').length).map(n => {
                    const on = spec?.sashes === n && spec.kind === 'wall'
                    return <button key={'wall' + n} onClick={() => pickWall(n)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={wallWidth(n)} height={2200} size={n > 3 ? 110 : 96} plain /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.nWall(n)}</div>
                    </button>
                  }))}
                </div>}
{roofSel && roofCat && <>
                <Sub title={T.roofModelTitle}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {roofCat.models.map(m => {
                      const on = roofSel.model === m.id
                      const from = m.sizes.length ? Math.min(...m.sizes.map(x => Number(x.price))) : null
                      return <button key={m.id} onClick={() => pickRoof({ model: m.id })}
                        className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="h-[84px] flex items-center justify-center">{m.image_url ? <img src={m.image_url} alt="" className="max-h-full max-w-full object-contain" /> : <RoofWindowDrawing size={80} opening={m.opening} />}</div>
                        {m.brand && <div className="text-[13px] font-medium text-gray-500 mt-2.5 leading-snug">{m.brand}</div>}
                        <div className={cn('text-sm font-medium text-gray-900 leading-snug', !m.brand && 'mt-2.5')}>{m.name}</div>
                        <div className="text-[13px] font-medium text-gray-500 mt-0.5">{m.opening === 'top' ? T.roofTop : T.roofCenter}{show && from != null ? ` · ${T.from} ${money(from, cur)}` : ''}</div>
                      </button>
                    })}
                  </div>
                </Sub>
                {roofModel && (roofModel.description || roofModel.datasheet_url) && <div className="rounded-xl border border-gray-200 bg-[#fafafa] px-4 py-3 -mt-2">
                  {roofModel.description && <p className="text-sm text-gray-900 whitespace-pre-line">{roofModel.description}</p>}
                  {roofModel.datasheet_url && <a href={roofModel.datasheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium hover:underline" style={{ color: accent }}>
                    <FileText className="w-4 h-4" />{T.roofDatasheet}</a>}
                </div>}
                {roofModel && (roofModel.variants ?? []).length > 0 && <Sub title={T.roofVariant}>
                  <div className="flex flex-wrap gap-2">
                    {(roofModel.variants ?? []).map(v => <Chip key={v.id} on={roofSel.variant === v.id} onClick={() => pickRoof({ variant: v.id })} accent={accent} single>
                      {v.name}{show && Number(v.pct) > 0 && <span className="ml-1.5 font-medium text-gray-500">+ {Number(v.pct)}%</span>}
                    </Chip>)}
                  </div>
                </Sub>}
                {roofModel && <Sub title={T.roofSize}>
                  <div className="flex flex-wrap gap-2">
                    {roofModel.sizes.map(sz => <Chip key={sz.id} on={roofSel.size === sz.id} onClick={() => pickRoof({ size: sz.id })} accent={accent} single>
                      {sz.w} × {sz.h} cm{show && <span className="ml-1.5 font-medium text-gray-500">{money(roofUnitPrice(Number(sz.price), Number(roofModel.variants?.find(x => x.id === roofSel.variant)?.pct ?? 0), 0), cur)}</span>}
                    </Chip>)}
                  </div>
                </Sub>}
                {roofCat.flashings.length > 0 && <Sub title={T.roofFlashing}>
                  <div className="flex flex-wrap gap-2">
                    <Chip on={!roofSel.flashing} onClick={() => pickRoof({ flashing: null })} accent={accent} single>{T.none}</Chip>
                    {roofCat.flashings.map(f => <Chip key={f.id} on={roofSel.flashing === f.id} onClick={() => pickRoof({ flashing: f.id })} accent={accent} single>
                      {f.name}{show && Number(f.price) > 0 && <span className="ml-1.5 font-medium text-gray-500">+ {money(Number(f.price), cur)}</span>}
                    </Chip>)}
                  </div>
                </Sub>}
              </>}
              </>)}

              {renderStep('layout', T.stepLayout, layoutSummary, <>
{spec && !slidingKind(spec) && offer && allowedBands(spec.sashes, offer, bk(spec)).filter(k => allowedVariants(spec.sashes, offer, bk(spec)).some(v => v.band === k)).length > 1 && <Sub title={T.bandsTitle}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {allowedBands(spec.sashes, offer, bk(spec)).filter(k => allowedVariants(spec.sashes, offer, bk(spec)).some(v => v.band === k)).map(k => [k, ...BAND_SHAPE[k]] as [string, Band, Band]).map(([k, top, bottom]) => {
                    const on = spec.top === top && spec.bottom === bottom
                    const preview = reshapeSpec(spec, spec.sashes, top, bottom)
                    const pr = show && !on ? specPrice(preview) : null, curP = show ? specPrice(spec) : null
                    return <button key={k} onClick={() => pickBand(top, bottom)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={preview} width={it.width ?? 1200} height={it.height ?? 1400} size={80} plain /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.band[k]}</div>
                      {pr != null && curP != null && Math.round(pr - curP) !== 0 && <div className="text-[13px] font-medium text-gray-500 mt-0.5">{pr > curP ? '+' : '−'} {money(Math.abs(Math.round(pr - curP)), cur)}</div>}
                    </button>
                  })}
                </div>
              </Sub>}
{spec && offer && <Sub title={T.openTitle}>
                {(() => {
                  // every sash combination the supplier ticked × top light / bottom panel fixed or tilt
                  // sliding windows: their combinations; windows: the ticked complete variants of the chosen top light / bottom panel
                  const cards = slidingKind(spec)
                    ? allowedCombos(spec.sashes, offer, slidingKind(spec)).map(cb => ({ ...spec, main: cb }))
                    : allowedVariants(spec.sashes, offer, bk(spec)).filter(v => v.band === bandKeyOf(spec)).map(v => applyVariant(spec, v))
                  const prices = cards.map(sp => (show ? specPrice(sp) : null))
                  const known = prices.filter((x): x is number => x != null)
                  const min = known.length ? Math.min(...known) : null
                  const curMode = bandModeOf(spec)
                  return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {cards.map((sp, i) => {
                      const on = sp.main.every((f, j) => sameField(f, spec.main[j])) && bandModeOf(sp) === curMode
                      const d = prices[i] != null && min != null ? Math.round(prices[i]! - min) : null
                      return <button key={i} onClick={() => setSpec(sp)}
                        className={cn('relative rounded-xl border p-3.5 bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="h-[104px] flex items-center justify-center"><SpecDrawing spec={sp} width={it.width ?? 1200} height={it.height ?? 1400} size={spec.sashes > 2 ? 110 : 92} /></div>
                        {d != null && <div className="text-[13px] font-medium text-gray-500 mt-1.5">{d > 0 ? `+ ${money(d, cur)}` : T.basePrice}</div>}
                      </button>
                    })}
                  </div>
                })()}
              </Sub>}
              </>)}

              {renderStep('material', T.stepMaterial, materialSummary, <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {materials.map(m => {
                  const on = m === matNow
                  const prices = allowedSystems.filter(x => x.material === m).map(x => sysPrice(x.id)).filter((v): v is number => v != null)
                  const from = prices.length ? Math.min(...prices) : null
                  return <button key={m} onClick={() => pickMaterial(m)}
                    className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                    style={on ? selStyle(accent) : undefined}>
                    {on && <SelBadge accent={accent} />}
                    <div className="h-[96px] rounded-lg bg-[#fafafa] flex items-center justify-center overflow-hidden"><ProfileSection material={m} className="h-full p-2" /></div>
                    <div className="text-[15px] font-semibold text-gray-900 mt-2.5">{L.materials[m]}</div>
                    <div className="text-[13px] font-medium text-[#4f4f4f] mt-0.5">{T.profilesN(allowedSystems.filter(x => x.material === m).length)}{show && from != null ? ` · ${T.from} ${money(from, cur)}` : ''}</div>
                  </button>
                })}
              </div>)}

              {renderStep('profile', T.step2, profileSummary, <>
{!roofSel && <Sub>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(() => {
                    // price of the same window in every profile; the cheapest is the base
                    const bases = Object.fromEntries(matSystems.map(s => [s.id, spec ? specBase(it, s.id) : basePrice(data.prices.find(x => x.system_id === s.id && x.type_id === type!.id), it.width ?? 0, it.height ?? 0)]))
                    const known = Object.values(bases).filter((v): v is number => v != null)
                    const min = known.length > 1 ? Math.min(...known) : null
                    return matSystems.map(s => {
                    const b = bases[s.id]
                    const diff = show && min != null && b != null ? Math.round(b - min) : null
                    return <button key={s.id} onClick={() => update({ system_id: s.id })}
                    className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', it.system_id === s.id ? '' : 'border-gray-200 hover:border-gray-400')}
                    style={it.system_id === s.id ? selStyle(accent) : undefined}>
                    {it.system_id === s.id && <SelBadge accent={accent} />}
                    <div className="flex items-start gap-3">
                      <div className="w-28 h-36 rounded-lg bg-[#fafafa] border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {s.image_url ? <img src={s.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <ProfileSection material={s.material} className="w-full h-full p-1.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className="text-xs font-semibold px-[7px] py-[3px] rounded-lg bg-[#ececec] text-[#4a4a4a]">{L.materials[s.material]}</span><span className="text-[15px] font-semibold text-gray-900">{s.name}</span></div>
                        {s.description && <div className="text-[13px] leading-5 text-gray-500 mt-1.5">{s.description}</div>}
                        {diff != null && <div className="inline-flex items-center mt-2.5 rounded-lg px-[7px] py-[3px] text-xs font-semibold"
                          style={diff > 0 ? { color: '#4a4a4a', backgroundColor: '#ececec' } : { color: '#267a47', backgroundColor: '#dbfce7' }}>
                          {diff > 0 ? `+ ${money(diff, cur)}` : T.basePrice}
                        </div>}
                        {/* the price of this window in this profile */}
                        {show && b != null && <div className="mt-2"><span className="text-[15px] font-semibold text-gray-900">{money(b, cur)}</span><span className="text-[13px] font-medium text-gray-500"> / {T.pcs}</span></div>}
                      </div>
                    </div>
                  </button>})
                  })()}
                </div>
              </Sub>}
              </>)}

              {renderStep('color', T.colorTitle, colorSummary, <>
{spec && (() => {
                const sy = data.systems.find(x => x.id === it.system_id)
                const list = sy ? data.builder?.colors?.[sy.material] ?? [] : []
                if (list.length < 2) return null
                const cur2 = { out: list.find(c => c.id === it.colors?.out)?.id ?? list[0].id, in: list.find(c => c.id === it.colors?.in)?.id ?? list[0].id }
                const now = specPriceWith(cur2)
                const row = (side: 'out' | 'in') => <div>
                  <div className="text-sm font-semibold text-gray-900 mb-2">{side === 'out' ? T.colorOut : T.colorIn}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map(c => {
                      const on = cur2[side] === c.id
                      const lookSpec = parseColor(c.look)
                      const p = show && !on ? specPriceWith({ ...cur2, [side]: c.id }) : null
                      return <button key={c.id} onClick={() => update({ colors: { ...cur2, [side]: c.id } })}
                        className={cn('inline-flex items-center gap-2 h-10 pl-2 pr-3 rounded-[10px] border bg-white text-sm font-medium transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {lookSpec && <ColorSwatch spec={lookSpec} size={22} rounded={6} />}
                        <span className="text-gray-900">{c.name}</span>
                        {p != null && now != null && Math.round(p - now) !== 0 && <span className="text-[13px] font-medium text-gray-500">{p > now ? '+' : '−'} {money(Math.abs(Math.round(p - now)), cur)}</span>}
                      </button>
                    })}
                  </div>
                </div>
                return <Sub>
                  <div className="space-y-4">{row('out')}{row('in')}</div>
                </Sub>
              })()}
              </>)}

              {renderStep('size', roofSel ? T.qtyTitle : T.sizeTitle, sizeSummary, <>
<Sub title={roofSel ? '' : T.sizeTitle}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {!roofSel && <MmInput label={T.width} value={it.width} onChange={v => update({ width: v, ...(it.sashWidths && it.width && v ? { sashWidths: it.sashWidths.map(x => Math.round(x * v / it.width!)) } : {}) })} min={range.min_width} max={range.max_width} rangeLabel={T.range} />}
                  {!roofSel && <MmInput label={T.height} value={it.height} onChange={v => update({ height: v })} min={range.min_height} max={range.max_height} rangeLabel={T.range} />}
                  {/* width of each sash: all but the last one, which takes what is left */}
                  {spec && !slidingKind(spec) && spec.main.length > 1 && it.width ? (() => {
                    const n = spec.main.length
                    const ws = it.sashWidths && it.sashWidths.length === n ? it.sashWidths : Array.from({ length: n }, () => Math.round(it.width! / n))
                    const bad = ws.some(x => x < 300)
                    return <div className="sm:col-span-2">
                      <div className="text-sm font-semibold text-gray-900 mb-1.5">{T.sashWidths}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {ws.map((x, j) => j < n - 1
                          ? <MmInput key={j} label={T.sashN(j + 1)} value={x} onChange={v => setSashWidth(j, v)} min={300} max={Math.max(300, it.width! - 300 * (n - 1))} rangeLabel={T.range} />
                          : <div key={j} className="flex flex-col gap-1">
                              <label className="text-sm font-semibold text-gray-900">{T.sashN(j + 1)}</label>
                              <div className={cn('flex items-center h-10 rounded-lg border bg-[#fafafa] px-3 text-sm text-gray-900', x < 300 ? 'border-red-400' : 'border-gray-200')}>{x}<span className="ml-auto text-gray-500">mm</span></div>
                              <span className="text-[13px] text-gray-500">{T.sashRest}</span>
                            </div>)}
                      </div>
                      {bad && <p className="text-[13px] text-red-600 mt-1">{T.sashTooNarrow}</p>}
                      {it.sashWidths && <button type="button" onClick={() => update({ sashWidths: null })} className="mt-2 text-sm font-medium text-gray-900 hover:underline">{T.sashEqual}</button>}
                    </div>
                  })() : null}
                  {spec && spec.top !== 'none' && <MmInput label={T.topHeight} value={Math.round((it.height ?? 0) * spec.topRatio)} onChange={v => v && it.height && setSpec({ ...spec, topRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
                  {spec && spec.bottom !== 'none' && <MmInput label={T.bottomHeight} value={Math.round((it.height ?? 0) * spec.bottomRatio)} onChange={v => v && it.height && setSpec({ ...spec, bottomRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
                  {type && hasHingeChoice(type.template) && <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-900">{T.hinge}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['left', 'right'] as Hinge[]).map(h => <button key={h} onClick={() => update({ hinge: h })}
                        className={cn('h-10 rounded-lg border px-3 text-sm font-medium bg-white transition-colors', it.hinge === h ? 'text-white border-transparent' : 'border-gray-200 text-gray-900 hover:border-gray-400')}
                        style={it.hinge === h ? btn : undefined}>{L.hinge[h]}</button>)}
                    </div>
                  </div>}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-900">{T.qty}</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => update({ quantity: Math.max(1, it.quantity - 1) })} className="w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-900 text-base hover:border-gray-400 transition-colors">−</button>
                      <input type="number" min={1} max={100} value={it.quantity} onChange={e => update({ quantity: clamp(Number(e.target.value) || 1, 1, 100) })}
                        className="w-16 h-10 text-center rounded-lg border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => update({ quantity: Math.min(100, it.quantity + 1) })} className="w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-900 text-base hover:border-gray-400 transition-colors">+</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-900">{T.label}</label>
                    <input value={it.label} onChange={e => update({ label: e.target.value.slice(0, 60) })} placeholder={T.labelPh}
                      className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                  </div>
                </div>
              </Sub>
              </>)}

              {renderStep('equipment', T.step4, equipSummary, <>
{/* glass package: cards with Ug; the first one is included */}
              {spec && glassList.length > 1 && <Sub title={T.glassTitle}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {glassList.map((g, i) => {
                    const sel = glassList.find(x => x.id === it.glass) ?? glassList[0]
                    const on = sel.id === g.id
                    // price against the base glass, so every card keeps its own surcharge
                    const d = i === 0 ? null : (() => {
                      if (!show) return null
                      const base = specBase({ ...it, glass: glassList[0].id }), p = specBase({ ...it, glass: g.id })
                      return base == null || p == null ? null : Math.round(p - base)
                    })()
                    return <button key={g.id} onClick={() => update({ glass: g.id })}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="flex justify-center py-2"><GlassIcon layers={g.layers ?? 2} size={104} /></div>
                      <div className="text-[15px] font-semibold text-gray-900 mt-1">{g.ug != null ? `Ug ${Number(g.ug).toFixed(1).replace('.', ',')}` : g.name}</div>
                      <div className="text-[13px] leading-5 text-gray-500 mt-1 flex-1">{g.ug != null ? g.name : null}{g.description ? <>{g.ug != null ? ' ' : ''}{g.description}</> : null}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{i === 0 ? T.included : d != null && d !== 0 ? `${d > 0 ? '+' : '−'} ${money(Math.abs(d), cur)}` : ''}</div>
                    </button>
                  })}
                </div>
              </Sub>}

              {/* handle: one per sash that opens with a handle */}
              {spec && handleList.length > 1 && <Sub title={T.handleTitle}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {handleList.map((h, i) => {
                    const on = (handleList.find(x => x.id === it.handle) ?? handleList[0]).id === h.id
                    // price against the standard handle, so every card keeps its own surcharge
                    const d = i === 0 || !show ? null : (() => {
                      const base = specBase({ ...it, handle: handleList[0].id }), p = specBase({ ...it, handle: h.id })
                      return base == null || p == null ? null : Math.round(p - base)
                    })()
                    return <button key={h.id} onClick={() => update({ handle: h.id })}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="flex justify-center items-center h-[72px] py-1">
                        {h.image_url ? <img src={h.image_url} alt={h.name} className="max-h-full max-w-full object-contain" /> : <HandleIcon look={h.look} lockable={h.lockable} size={56} />}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-1">{h.name}</div>
                      <div className="text-[13px] leading-5 text-gray-500 mt-0.5 flex-1">{h.lockable ? T.lockable : ''}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{i === 0 ? T.included : d != null && d !== 0 ? `${d > 0 ? '+' : '−'} ${money(Math.abs(d), cur)}` : ''}</div>
                    </button>
                  })}
                </div>
              </Sub>}

              {/* window sills: inside and outside, none by default */}
              {spec && sillList.length > 0 && <Sub title={T.sillTitle}>
                <div className="space-y-4">
                  {(['inner', 'outer'] as const).map(side => {
                    const list = sillList.filter(x => x.side === side)
                    if (!list.length) return null
                    const key = side === 'inner' ? 'in' : 'out'
                    const cur = it.sills?.[key] ?? null
                    const none = specBase({ ...it, sills: { ...(it.sills ?? {}), [key]: null } })
                    const card = (id: string | null, title: string, desc?: string) => {
                      const on = (cur ?? null) === id
                      const p = id && show ? specBase({ ...it, sills: { ...(it.sills ?? {}), [key]: id } }) : null
                      const d = p != null && none != null ? Math.round(p - none) : null
                      return <button key={id ?? 'none'} onClick={() => update({ sills: { ...(it.sills ?? {}), [key]: id } })}
                        className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="flex justify-center py-1 h-[64px] items-center">{(() => { const x = list.find(y => y.id === id); return !x ? <span className="text-2xl text-gray-300">—</span> : x.image_url ? <img src={x.image_url} alt={x.name} className="max-h-full max-w-full object-contain" /> : sillMaterialOf(x.material) === 'none' ? null : <SillIcon material={x.material} size={56} /> })()}</div>
                        <div className="text-sm font-medium text-gray-900 mt-1 pr-5">{title}</div>
                        <div className="text-[13px] leading-5 text-gray-500 mt-0.5 flex-1">{desc}</div>
                        <div className="text-sm font-medium text-gray-900 mt-2">{id ? (d != null && d !== 0 ? `+ ${money(d, currency)}` : '') : ''}</div>
                      </button>
                    }
                    return <div key={side}>
                      <div className="text-sm font-semibold text-gray-900 mb-2">{side === 'inner' ? T.sillIn : T.sillOut}</div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {card(null, T.noSill)}
                        {list.map(x => card(x.id, x.name, x.description))}
                      </div>
                    </div>
                  })}
                </div>
              </Sub>}

              {/* shading and insect screen, none by default */}
              {spec && shadeList.length > 0 && <Sub title={T.shadeTitle}>
                <div className="space-y-4">
                  {(['shade', 'screen'] as const).map(kind => {
                    const list = shadeList.filter(x => x.kind === kind)
                    if (!list.length) return null
                    const chosen = it.shading?.[kind] ?? null
                    const none = specBase({ ...it, shading: { ...(it.shading ?? {}), [kind]: null } })
                    const card = (x: ShadingType | null) => {
                      const on = chosen === (x?.id ?? null)
                      const p = x && show ? specBase({ ...it, shading: { ...(it.shading ?? {}), [kind]: x.id } }) : null
                      const d = p != null && none != null ? Math.round(p - none) : null
                      return <button key={x?.id ?? 'none'} onClick={() => update({ shading: { ...(it.shading ?? {}), [kind]: x?.id ?? null } })}
                        className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="flex justify-center py-1 h-[64px] items-center">
                          {!x ? <span className="text-2xl text-gray-300">—</span> : x.image_url ? <img src={x.image_url} alt={x.name} className="max-h-full max-w-full object-contain" /> : (x.icon ?? 'none') === 'none' ? null : <ShadingIcon kind={x.icon} size={56} />}
                        </div>
                        <div className="text-sm font-medium text-gray-900 mt-1 pr-5">{x ? x.name : kind === 'shade' ? T.noShade : T.noScreen}</div>
                        <div className="text-[13px] leading-5 text-gray-500 mt-0.5 flex-1">{x?.description}</div>
                        <div className="text-sm font-medium text-gray-900 mt-2">{x && d != null && d !== 0 ? `+ ${money(d, currency)}` : ''}</div>
                      </button>
                    }
                    return <div key={kind}>
                      <div className="text-sm font-semibold text-gray-900 mb-2">{kind === 'shade' ? T.shadeLabel : T.screenLabel}</div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {card(null)}
                        {list.map(x => card(x))}
                      </div>
                    </div>
                  })}
                </div>
              </Sub>}

              {!roofSel && extraGroups.length > 0 && <Sub title={T.step4}>
                <div className="space-y-4">
                  {extraGroups.map(g => <OptionGroupPicker key={g} group={g} title={L.groups[g]}
                    options={data.options.filter(o => o.group_key === g)} selected={it.option_ids} onToggle={toggleOption}
                    onClear={() => update({ option_ids: it.option_ids.filter(id => !data.options.some(o => o.group_key === g && o.id === id)) })}
                    accent={accent} show={show} currency={cur} noneLabel={T.none} pricingLabels={L.pricing} />)}
                </div>
              </Sub>}
              </>)}

              {renderStep('services', T.step5, servicesSummary, <>
{!internal && data.options.some(isService) && <Sub>
                <p className="text-sm text-gray-500 -mt-2 mb-4">{T.servicesHint}</p>
                <div className="space-y-4">
                  {items.some(x => x.roof) && data.options.some(o => o.per_item === 'roof') && <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">{T.roofServices}</div>
                    <div className="flex flex-wrap gap-2">
                      {data.options.filter(o => o.per_item === 'roof').map(o => <Chip key={o.id} on={services.includes(o.id)} onClick={() => toggleService(o)} accent={accent}>
                        {o.name}{show && Number(o.price_piece ?? 0) > 0 && <span className="ml-1.5 font-medium text-gray-500">{money(Number(o.price_piece), cur)} {L.pricing.piece}</span>}
                      </Chip>)}
                    </div>
                  </div>}
                  {SERVICE_GROUPS.filter(g => data.options.some(o => o.group_key === g && (!o.per_item || o.per_item === 'window'))).map(g => <div key={g}>
                    <div className="text-sm font-semibold text-gray-900 mb-2">{L.groups[g]}</div>
                    <div className="flex flex-wrap gap-2">
                      {data.options.filter(o => o.group_key === g && (!o.per_item || o.per_item === 'window')).map(o => <Chip key={o.id} on={services.includes(o.id)} onClick={() => toggleService(o)} accent={accent}>
                        {o.name}{show && <span className="ml-1.5 font-medium text-gray-500">{[Number(o.price_piece ?? 0) > 0 ? `${money(Number(o.price_piece), cur)} ${L.pricing.piece}` : '', o.price != null && Number(o.price) > 0 ? `${money(Number(o.price), cur)} ${L.pricing[o.pricing]}` : ''].filter(Boolean).join(' + ')}</span>}
                      </Chip>)}
                    </div>
                  </div>)}
                </div>
              </Sub>}
              </>)}

              <div className="flex gap-2">
                <button onClick={() => addItem(true)} className="flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:border-gray-400 transition-colors"><Copy className="w-4 h-4" />{T.duplicate}</button>
                {items.length > 1 && <button onClick={() => removeItem(active)} className="flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:text-red-600 hover:border-red-200 transition-colors"><Trash2 className="w-4 h-4" />{T.remove}</button>}
              </div>
            </> : stage === 'review' ? (
              /* Review: what the customer is about to send */
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <button onClick={() => setStage('config')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"><ArrowLeft className="w-4 h-4" />{T.back}</button>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">{T.reviewTitle}</h2>
                <p className="text-sm text-gray-500 mt-1 mb-5">{T.reviewHint}</p>
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {items.map((x, i) => {
                    const d = describe(x)
                    const t = data.types.find(tt => tt.id === x.type_id)
                    const xp = priceOf(x)
                    return <div key={x.key} className="py-5 grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)_auto] gap-5">
                      <div className="flex justify-center">
                        {x.roof ? <RoofWindowDrawing size={110} /> : x.spec ? <SpecDrawing spec={x.spec} width={x.width ?? 0} height={x.height ?? 0} size={130} showDims /> : t && <WindowDrawing template={t.template} width={x.width ?? 0} height={x.height ?? 0} hinge={x.hinge} size={130} showDims />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2"><span className="text-[13px] font-medium text-gray-500">{T.position} {i + 1}</span><span className="text-[15px] font-semibold text-gray-900">{d.title}</span></div>
                        <dl className="mt-2 grid grid-cols-[minmax(100px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                          {d.rows.map(([k, v]) => <div key={k} className="contents"><dt className="font-medium text-gray-500">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>)}
                          {x.sashWidths && <div className="contents"><dt className="font-medium text-gray-500">{T.sashWidths}</dt><dd className="font-medium text-gray-900">{x.sashWidths.map(w => `${w} mm`).join(' · ')}</dd></div>}
                        </dl>
                      </div>
                      <div className="sm:text-right flex sm:flex-col justify-between gap-2">
                        {show && <div><div className="text-sm font-medium text-gray-500">{x.quantity} × {xp != null ? money(xp, cur) : T.noPrice}</div><div className="text-[17px] font-semibold text-gray-900">{xp != null ? money(xp * x.quantity, cur) : ''}</div></div>}
                        <button type="button" onClick={() => { setActive(i); setStage('config'); window.scrollTo({ top: 0 }) }} className="self-start sm:self-end text-sm font-medium text-gray-900 hover:underline">{T.editWindow}</button>
                      </div>
                    </div>
                  })}
                </div>
                {serviceRows.length > 0 && <div className="border-t border-gray-100 pt-4">
                  <div className="text-sm font-semibold text-gray-900 mb-2">{T.servicesTitle}</div>
                  {serviceRows.map(r => <div key={r.option.id} className="flex items-baseline justify-between gap-3 text-sm py-1">
                    <span className="font-medium text-gray-900">{r.option.name}</span>
                    {show && <span className="font-medium text-gray-900 whitespace-nowrap">{money(r.total, cur)}</span>}
                  </div>)}
                </div>}
              </div>
            ) : (
              /* Contact stage */
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <button onClick={() => setStage('review')} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"><ArrowLeft className="w-4 h-4" />{T.backToReview}</button>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900 mb-5">{T.contact}</h2>
                <div className="inline-flex p-1 rounded-[10px] bg-[#f1f1f1] mb-5">
                  {(['person', 'company'] as const).map(k => <button key={k} type="button" onClick={() => setContact({ ...contact, customer_type: k })}
                    className={cn('h-9 px-4 rounded-lg text-sm font-semibold transition-colors', contact.customer_type === k ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#4f4f4f] hover:text-gray-900')}>
                    {k === 'person' ? T.person : T.company}</button>)}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {contact.customer_type === 'company' && <>
                    <Field label={T.companyName} value={contact.company_name} onChange={v => setContact({ ...contact, company_name: v })} autoComplete="organization" />
                    <Field label={T.vatNo} value={contact.vat_number} onChange={v => setContact({ ...contact, vat_number: v })} />
                    <div className="sm:col-span-2 text-sm font-semibold text-gray-900 pt-2">{T.contactPersonHint}</div>
                  </>}
                  <Field label={T.firstName} value={contact.first_name} onChange={v => setContact({ ...contact, first_name: v })} autoComplete="given-name" />
                  <Field label={T.lastName} value={contact.last_name} onChange={v => setContact({ ...contact, last_name: v })} autoComplete="family-name" />
                  <Field label={T.email} type="email" value={contact.email} onChange={v => setContact({ ...contact, email: v })} autoComplete="email" />
                  <Field label={T.phone} type="tel" value={contact.phone} onChange={v => setContact({ ...contact, phone: v })} autoComplete="tel" />
                  <div className="sm:col-span-2 text-[15px] font-semibold text-gray-900 pt-3">{T.address}</div>
                  <div className="sm:col-span-2"><Field label={T.street} value={contact.street} onChange={v => setContact({ ...contact, street: v })} autoComplete="address-line1" /></div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900">{T.country}</span>
                    <Select value={contact.country} onChange={v => setContact({ ...contact, country: v, postal_code: '', city: '' })}
                      options={COUNTRIES.map(c => ({ value: c.code, label: c[lang] }))} />
                  </div>
                  {contact.country === 'SI'
                    ? <PostPicker label={T.postal} placeholder={T.postalPick} code={contact.postal_code} city={contact.city}
                        onPick={(code, city) => setContact({ ...contact, postal_code: code, city })} />
                    : <Field label={T.postal} value={contact.postal_code} onChange={v => setContact({ ...contact, postal_code: v })} autoComplete="postal-code" />}
                  {contact.country !== 'SI' && <Field label={T.city} value={contact.city} onChange={v => setContact({ ...contact, city: v })} autoComplete="address-level2" />}
                  {outOfArea && <p className="sm:col-span-2 text-sm font-medium text-[#8a6100] bg-[#fef3cd] rounded-lg px-3 py-2">{T.outOfArea}</p>}
                  {/* where the customer heard of the supplier (goes to the enquiry's note) */}
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900">{T.heard}<span className="req-star"> *</span></span>
                    <Select value={heard} onChange={setHeard} placeholder={T.heardPick}
                      options={leadSourceOptions(lang)} />
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-sm font-semibold text-gray-900">{T.note}</label>
                    <textarea rows={3} value={contact.note} onChange={e => setContact({ ...contact, note: e.target.value.slice(0, 2000) })}
                      className="rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                  </div>
                </div>
                <label className="flex items-start gap-2.5 mt-5 text-sm text-gray-900 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: accent }} />
                  {T.consent}
                </label>
                {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
              </div>
            )}
          </div>

          {/* Summary column */}
          <aside className="lg:sticky lg:top-4 space-y-3">
            {stage === 'config' && <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-center py-2 overflow-hidden">
                {roofSel ? <RoofWindowDrawing size={200} opening={roofModel?.opening} />
                  : spec ? <SpecDrawing spec={spec} width={it.width ?? 0} height={it.height ?? 0} size={220} showDims />
                  : type && <WindowDrawing template={type.template} width={it.width ?? 0} height={it.height ?? 0} hinge={it.hinge} size={220} showDims />}
              </div>
              {!sizeOk(it) && <p className="text-[13px] text-red-600 text-center mt-1">{T.invalidSize}</p>}
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-sm font-medium text-gray-500">{T.unit}</span>
                <span className="text-xl font-bold tracking-[-0.01em] text-gray-900">{show ? (p != null ? money(p, cur) : T.noPrice) : '—'}</span>
              </div>
            </div>}

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-base font-semibold text-gray-900 mb-2">{internal ? T.inQuote : T.yourOrder}</div>
              <ul className="divide-y divide-gray-100">
                {items.map((x, i) => {
                  const t = data.types.find(tt => tt.id === x.type_id)
                  const xp = priceOf(x)
                  return <li key={x.key}>
                    <button onClick={() => { setActive(i); setStage('config') }} className="w-full flex items-center gap-3 py-2 text-left">
                      <div className="w-10 flex justify-center shrink-0">{x.roof ? <RoofWindowDrawing size={36} /> : x.spec ? <SpecDrawing spec={x.spec} width={x.width ?? 0} height={x.height ?? 0} size={36} /> : t && <WindowDrawing template={t.template} width={x.width ?? 0} height={x.height ?? 0} hinge={x.hinge} size={36} />}</div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm font-medium truncate', i === active && stage === 'config' ? 'text-gray-900' : 'text-gray-500')}>{x.quantity} × {x.roof ? (() => { const m = roofCat?.models.find(mm => mm.id === x.roof!.model); const v = m?.variants?.find(vv => vv.id === x.roof!.variant); return `${T.roofWindow} · ${[m?.brand, m?.name].filter(Boolean).join(' ')}${v ? ` · ${v.name}` : ''}` })() : x.spec ? specName(x.spec) : t?.name}</div>
                        <div className="text-[13px] text-gray-500">{x.roof ? `${(x.width ?? 0) / 10} × ${(x.height ?? 0) / 10} cm` : `${x.width} × ${x.height} mm`}{x.label ? ` · ${x.label}` : ''}</div>
                      </div>
                      {show && <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{xp != null ? money(xp * x.quantity, cur) : '—'}</div>}
                    </button>
                  </li>
                })}
              </ul>
              {!internal && serviceRows.length > 0 && <ul className="border-t border-gray-100 pt-2 space-y-1">
                <li className="text-[13px] font-medium text-gray-500">{T.servicesTitle}</li>
                {serviceRows.map(r => <li key={r.option.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-gray-900 min-w-0 truncate">{r.option.name} <span className="text-[13px] text-gray-500">{Number(r.option.price_piece ?? 0) > 0 || (r.option.per_item && r.option.per_item !== 'window') ? `${r.qty.toLocaleString('de-DE')} ${L.unitShort.piece}` : r.option.pricing === 'flat' || r.option.pricing === 'percent' ? '' : `${r.qty.toLocaleString('de-DE')} ${L.unitShort[r.option.pricing]}`}</span></span>
                  {show && <span className="font-medium text-gray-900 whitespace-nowrap">{money(r.total, cur)}</span>}
                </li>)}
              </ul>}
              {show ? <div className="border-t border-gray-200 mt-3 pt-3 space-y-1.5 text-sm">
                <Row l={T.total} r={money(totals.net, cur)} />
                {totals.vatRate > 0 && <Row l={`${T.vat} ${totals.vatRate.toLocaleString('de-DE')}%`} r={money(totals.vat, cur)} muted />}
                <Row l={T.gross} r={money(totals.gross, cur)} bold />
                {!internal && <p className="text-[13px] leading-5 text-gray-500 pt-1.5">{T.estimate}</p>}
              </div> : <p className="text-[13px] text-gray-500 border-t border-gray-200 mt-3 pt-3">{T.pricesHidden}</p>}

              {internal ? (
                <div className="mt-4 flex gap-2">
                  {onCancel && <button type="button" onClick={onCancel} className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:border-gray-400 transition-colors">{T.cancel}</button>}
                  <button type="button" disabled={!items.every(sizeOk)} onClick={handBack}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{addLabel ?? T.addToQuote}</button>
                </div>
              ) : stage === 'config' ? (
                <button disabled={!items.every(sizeOk)} onClick={() => { setStage('review'); window.scrollTo({ top: 0 }) }}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{T.toReview}</button>
              ) : stage === 'review' ? (
                <button onClick={() => { setStage('contact'); window.scrollTo({ top: 0 }) }}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={btn}>{T.next}</button>
              ) : (
                <button disabled={sending || !consent || !heard || !contact.email || !(contact.first_name || contact.last_name) || (contact.customer_type === 'company' && !contact.company_name.trim()) || !contact.street.trim() || !contact.postal_code.trim() || !contact.city.trim()} onClick={submit}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2" style={btn}>
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}{sending ? T.sending : T.send}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* phones: the price stays in sight while configuring (the summary is far down under the steps) */}
      {!internal && stage === 'config' && <>
        <div className="lg:hidden h-20" />
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-[#4f4f4f]">{T.gross}</div>
            <div className="text-lg font-bold text-gray-900 tabular-nums">{show ? money(totals.gross, cur) : '—'}</div>
          </div>
          <button disabled={!items.every(sizeOk)} onClick={() => { setStage('review'); window.scrollTo({ top: 0 }) }}
            className="h-11 px-5 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={btn}>{T.toReview}</button>
        </div>
      </>}
    </div>
  )
}

const OPEN_SL: Record<string, string> = { fixed: 'fiksno', tilt_turn: 'odpiranje in kip', turn: 'odpiranje', tilt: 'kip', passive: 'pasivno', slide_window: 'drsno', slide: 'drsno', lift_slide: 'dvižno-drsno' }
const OPEN_EN: Record<string, string> = { fixed: 'fixed', tilt_turn: 'tilt & turn', turn: 'turn', tilt: 'tilt', passive: 'passive', slide_window: 'sliding', slide: 'sliding', lift_slide: 'lift & slide' }

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

function Sub({ title, children }: { title?: string; children: React.ReactNode }) {
  return <div>{title && <h3 className="text-[15px] font-semibold text-gray-900 mb-3">{title}</h3>}{children}</div>
}

function MmInput({ label, value, onChange, min, max, rangeLabel }: { label: string; value: number | null; onChange: (v: number | null) => void; min: number; max: number; rangeLabel: string }) {
  const bad = value != null && (value < min || value > max)
  return <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-gray-900">{label}</label>
    <div className={cn('flex items-center h-10 rounded-lg border bg-white transition-colors focus-within:ring-2', bad ? 'border-red-400' : 'border-gray-200 hover:border-gray-400 focus-within:ring-blue-500')}>
      <input type="number" inputMode="numeric" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
        className="flex-1 min-w-0 h-full px-3 text-sm text-gray-900 bg-transparent focus:outline-none" />
      <span className="px-3 text-sm text-gray-500">mm</span>
    </div>
    <span className={cn('text-[13px]', bad ? 'text-red-600' : 'text-gray-500')}>{rangeLabel} {min}–{max} mm</span>
  </div>
}

function PostPicker({ label, placeholder, code, city, onPick }: { label: string; placeholder: string; code: string; city: string; onPick: (code: string, city: string) => void }) {
  const [q, setQ] = useState(code ? `${code} ${city}` : '')
  const [open, setOpen] = useState(false)
  useEffect(() => { setQ(code ? `${code} ${city}` : '') }, [code, city])
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const hits = q.trim() && !(code && q === `${code} ${city}`)
    ? SI_POSTS.filter(p => p.code.startsWith(q.trim()) || norm(p.name).includes(norm(q.trim()))).slice(0, 8)
    : []
  return <div className="flex flex-col gap-1 relative">
    <label className="text-sm font-semibold text-gray-900">{label}</label>
    <input value={q} placeholder={placeholder} autoComplete="off"
      onChange={e => { setQ(e.target.value); setOpen(true); if (code) onPick('', '') }}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
    {open && hits.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
      {hits.map(p => <button key={p.code + p.name} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(p.code, p.name); setOpen(false) }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-[#f5f5f5] flex gap-3"><span className="font-semibold tabular-nums w-10">{p.code}</span><span className="text-gray-900">{p.name}</span></button>)}
    </div>}
  </div>
}

function Field({ label, value, onChange, type = 'text', autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-gray-900">{label}</label>
    <input type={type} value={value} autoComplete={autoComplete} onChange={e => onChange(e.target.value.slice(0, 200))}
      className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
  </div>
}

function Row({ l, r, bold, muted }: { l: string; r: string; bold?: boolean; muted?: boolean }) {
  return <div className={cn('flex justify-between font-medium', bold ? 'text-[15px] font-semibold text-gray-900' : muted ? 'text-gray-500' : 'text-gray-900')}><span>{l}</span><span>{r}</span></div>
}

function OptionGroupPicker({ group, title, options, selected, onToggle, onClear, accent, show, currency, noneLabel, pricingLabels }: {
  group: OptionGroup; title: string; options: WindowOption[]; selected: string[]; onToggle: (o: WindowOption) => void; onClear: () => void
  accent: string; show: boolean; currency: string; noneLabel: string; pricingLabels: Record<string, string>
}) {
  const single = SINGLE_CHOICE_GROUPS.includes(group)
  const price = (o: WindowOption) => {
    if (!show || o.price == null || Number(o.price) === 0) return null
    return o.pricing === 'percent' ? `+${Number(o.price).toLocaleString('de-DE')}%` : `+${money(Number(o.price), currency)}${o.pricing === 'm2' ? ' / m²' : ''}`
  }
  const anySelected = options.some(o => selected.includes(o.id))
  return <div>
    <div className="text-sm font-semibold text-gray-900 mb-2">{title}</div>
    <div className="flex flex-wrap gap-2">
      {!single && <Chip on={!anySelected} onClick={onClear} accent={accent} single>{noneLabel}</Chip>}
      {options.map(o => <Chip key={o.id} on={selected.includes(o.id)} onClick={() => onToggle(o)} accent={accent} single={single}>
        {o.name}{price(o) && <span className="ml-1.5 font-medium text-gray-500">{price(o)}</span>}
      </Chip>)}
    </div>
    {void pricingLabels}
  </div>
}

// Selected state, same as in the app: outline + light tint in the accent colour + check badge
const tint = (hex: string, a: number) => /^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : 'transparent'
const selStyle = (accent: string): React.CSSProperties => ({ borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}`, backgroundColor: tint(accent, 0.04) })
function SelBadge({ accent }: { accent: string }) {
  return <span className="absolute top-2 right-2 w-5 h-5 rounded-full text-white flex items-center justify-center shadow-sm" style={{ backgroundColor: accent }}><Check className="w-3 h-3" strokeWidth={3} /></span>
}

function Chip({ on, onClick, accent, single, children }: { on: boolean; onClick: () => void; accent: string; single?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick}
    className={cn('h-10 px-3.5 rounded-[10px] border text-sm font-medium flex items-center gap-1.5 transition-colors', on ? 'bg-white' : 'bg-white border-gray-200 text-gray-900 hover:border-gray-400')}
    style={on ? { ...selStyle(accent), color: '#131313' } : undefined}>
    {on && !single && <Check className="w-3.5 h-3.5" />}{children}
  </button>
}
