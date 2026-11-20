import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Check, Loader2, Phone, Mail, ArrowLeft, FileText, EyeOff, X } from 'lucide-react'
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
  company: { name: string; logo_url: string | null; email: string | null; phone: string | null; currency: string; accent: string; intro: string | null; show_prices: boolean; vat_rate: number; area?: InstallArea | null
    /** how the configurator works: prices live / at the end / as a range / never; the end: enquiry / offer PDF / the customer picks */
    price_mode?: PriceMode | null; end_mode?: EndMode | null
    /** size of the logo in the top bar: s / m / l */
    logo_size?: 's' | 'm' | 'l' | null }
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
  /** color: colour of the shutter / blind and its box (null = same as the frame) */
  shading?: { shade?: string | null; screen?: string | null; color?: string | null } | null
  /** roof window from the catalogue: model + size (+ flashing) */
  roof?: { model: string; size: string; flashing: string | null; variant?: string | null } | null
  /** width of each sash in mm (the last one fills the rest); missing = all the same */
  sashWidths?: number[] | null
}

const TXT = {
  sl: {
    title: 'Konfigurator oken', notFound: 'Konfigurator ni na voljo.', notFoundHint: 'Ponudnik konfiguratorja še ni objavil.',
    qtyTitle: 'Količina', sizeTitle: 'Mere', roofWindow: 'Strešno okno', roofModelTitle: 'Model strešnega okna', roofVariant: 'Material in barva', roofDatasheet: 'Tehnični list (PDF)', roofSize: 'Mera', roofFlashing: 'Obroba za kritino', roofCenter: 'Vrtljivo', roofTop: 'Zgornje vrtišče', from: 'od',
    nSash: (n: number) => n === 1 ? 'Enokrilno okno' : n === 2 ? 'Dvokrilno okno' : n === 3 ? 'Trokrilno okno' : 'Štirikrilno okno', slidingWindow: 'Drsno okno', sillTitle: 'Police', shadeTitle: 'Senčila in komarniki', shadeColor: 'Barva senčila in omarice', shadeColorHint: 'Brez doplačila. Končno barvo potrdimo pri izmeri.', shadeLabel: 'Senčilo', screenLabel: 'Komarnik', noShade: 'Brez senčila', noScreen: 'Brez komarnika', sillIn: 'Notranja polica', sillOut: 'Zunanja polica', noSill: 'Brez police', glassTitle: 'Steklo', handleTitle: 'Kljuka', lockable: 'Zaklepanje s ključem', included: 'Vključeno', layers: (n: number) => n === 3 ? 'troslojno' : n === 2 ? 'dvoslojno' : `${n}-slojno`, colorTitle: 'Barva', colorOut: 'Zunaj', colorIn: 'Znotraj', nWall: (n: number) => `${n === 2 ? 'Dvodelna' : n === 3 ? 'Tridelna' : 'Štiridelna'} drsna stena`, nDoor: (n: number) => n === 1 ? 'Enokrilna balkonska vrata' : n === 2 ? 'Dvokrilna balkonska vrata' : 'Trokrilna balkonska vrata',
    bandsTitle: 'Nadsvetloba / ločen spodnji del', band: { none: 'Brez', top: 'Z nadsvetlobo', topSplit: 'Z nadsvetlobo, deljeno po krilih', bottom: 'Z ločenim spodnjim delom', bottomSplit: 'Z ločenim spodnjim delom, deljenim po krilih' } as Record<string, string>,
    openTitle: 'Odpiranje', openHint: 'Izberite, kako se odpira vsako krilo. Cena je razlika do najcenejše izvedbe.', topLight: 'Nadsvetloba', bottomPanel: 'Ločen spodnji del', bandFixed: 'Fiksna', bandTilt: 'Na kip', topHeight: 'Višina nadsvetlobe', bottomHeight: 'Višina ločenega spodnjega dela',
    preset: { all_open: 'Vse odpiranje in kip', one_open: 'Eno krilo na odpiranje', outer_open: 'Zunanji krili na odpiranje', all_fixed: 'Vse fiksno' } as Record<string, string>,
    step1: 'Tip okna', step2: 'Profilni sistem', step3: 'Mere in odpiranje', step4: 'Oprema', step5: 'Storitve',
    stepProduct: 'Kaj želite kupiti?', stepProductHint: 'Izberite vrsto izdelka, ki ga želite kupiti.',
    hSashes: 'Koliko kril naj ima okno? Krilo je del okna, ki se odpira.', hParts: 'Iz koliko delov naj bo drsna stena?', hRoof: 'Izberite model strešnega okna, material in mero.',
    hSize: 'Vpišite širino in višino okna v milimetrih. Natančno izmerimo pred izdelavo, zato so lahko mere približne.', hQty: 'Koliko enakih strešnih oken potrebujete?',
    hBands: 'Ali ima okno nad krili (nadsvetloba) ali pod njimi še poseben del?', hMaterial: 'Iz katerega materiala naj bo okvir okna?',
    hProfile: 'Profil določa toplotno izolacijo in videz okvirja. Cena se ob vsakem profilu spremeni.', hColor: 'Barva okvirja zunaj in znotraj. Lahko sta različni.',
    hGlass: 'Več slojev stekla pomeni boljšo toplotno izolacijo (nižji Ug). Prvo steklo je vključeno v ceno.', hHandle: 'Izberite kljuko. Standardna je vključena v ceno.',
    hSills: 'Po želji dodajte notranjo in zunanjo polico.', hShading: 'Po želji dodajte roleto, žaluzije ali komarnik.', hExtras: 'Dodatna oprema po želji.',
    pricesAfterSize: 'Ceno vidite, ko vpišete mere.', stepSashes: 'Število kril', stepParts: 'Število delov', stepRoof: 'Model in mera', stepSize: 'Mere in odpiranje', stepLayout: 'Postavitev in odpiranje', stepBands: 'Izvedba', extrasTitle: 'Dodatna oprema', stepOpening: 'Tip odpiranja', stepMaterial: 'Material', profilesN: (n: number) => `${n} ${n === 1 ? 'profil' : n === 2 ? 'profila' : n < 5 ? 'profili' : 'profilov'}`, stepNext: 'Naprej', stepOf: (i: number, n: number) => `Korak ${i} od ${n}`, editing: 'Urejate', stepDone: 'Končano', stepEdit: 'Uredi', stdEquip: 'Standardna oprema',
    grpWindows: 'Okna', grpSliding: 'Drsna okna', grpDoors: 'Balkonska vrata', grpWalls: 'Drsne stene', grpRoof: 'Strešna okna', servicesHint: 'Montaža in ostale storitve veljajo za vsa okna v povpraševanju.', servicesTitle: 'Storitve', roofServices: 'Strešna okna',
    width: 'Širina', height: 'Višina', range: 'dovoljeno', hinge: 'Stran nasadil (gledano od znotraj)', qty: 'Količina', label: 'Prostor (neobvezno)', labelPh: 'npr. dnevna soba',
    none: 'Brez', yourOrder: 'Vaše povpraševanje', inQuote: 'Okna za ponudbo', position: 'Pozicija', addWindow: 'Dodaj okno', duplicate: 'Podvoji', remove: 'Odstrani', removeAsk: (n: number) => `Odstranim pozicijo ${n}?`, removeHint: 'Okno in vse njegove izbire bodo odstranjeni iz povpraševanja.',
    unit: 'cena/kos', total: 'Skupaj brez DDV', vat: 'DDV', gross: 'Skupaj z DDV', estimate: 'Okvirna cena. Končno ponudbo pripravimo po izmeri na terenu.',
    basePrice: 'Osnovna cena', noPrice: 'Cena po izmeri', pricesHidden: 'Ceno prejmete v ponudbi na e-mail.', pricesAtEnd: 'Ceno boste videli na koncu, ko vpišete svoje podatke.', rangeTitle: 'Okvirna cena z DDV', rangeNote: 'Okvirni razpon. Natančno ceno pripravimo po izmeri na terenu.',
    getOffer: 'Pridobi ponudbo', getOfferPdf: 'Prenesi ponudbo (PDF)', orEnquiry: 'Ali samo pošljite povpraševanje',
    pdfDoneTitle: 'Vaša ponudba je pripravljena', pdfDoneText: 'Informativna ponudba se je prenesla na vašo napravo. Ponudnik je prejel tudi vaše povpraševanje. Številka:', pdfAgain: 'Prenesi ponudbo znova', yourTotal: 'Skupaj z DDV',
    pdfNote: 'Informativna ponudba, izračunana v spletnem konfiguratorju. Končno ponudbo pripravimo po izmeri na terenu.', pdfTaken: 'Stranka je prenesla informativno ponudbo (PDF).',
    next: 'Nadaljuj na podatke', back: 'Nazaj na okna', send: 'Pošlji povpraševanje', sending: 'Pošiljam …',
    contact: 'Vaši podatki', person: 'Fizična oseba', company: 'Podjetje', companyName: 'Naziv podjetja', vatNo: 'ID za DDV', contactPersonHint: 'Kontaktna oseba', firstName: 'Ime', lastName: 'Priimek', email: 'E-pošta', phone: 'Telefon', address: 'Naslov montaže', street: 'Ulica in hišna številka', postal: 'Poštna številka', city: 'Kraj', country: 'Država', postalPick: 'Vpišite številko ali kraj', outOfArea: 'Na tem naslovu montaže ne izvajamo. Povpraševanje lahko pošljete brez montaže.', note: 'Opomba',
    consent: 'Strinjam se, da ponudnik moje podatke uporabi za pripravo ponudbe.',
    doneTitle: 'Hvala, povpraševanje je oddano!', doneText: 'Ponudnik bo pripravil ponudbo in vas kontaktiral. Številka vašega povpraševanja:',
    newOne: 'Novo povpraševanje', invalidSize: 'Mere so izven dovoljenega razpona', pcs: 'kos',
    errors: { invalid_email: 'Vnesite veljaven e-poštni naslov.', name_required: 'Vnesite ime in priimek.', company_required: 'Vnesite naziv podjetja.', address_required: 'Vnesite celoten naslov montaže.', rate_limited: 'Preveč povpraševanj v kratkem času. Poskusite kasneje.', size_out_of_range: 'Nekatere mere so izven dovoljenega razpona.' } as Record<string, string>,
    genericError: 'Pošiljanje ni uspelo. Poskusite znova.',
    addToQuote: 'Dodaj v ponudbo', cancel: 'Prekliči', room: 'Prostor', roofOpeningLabel: 'Odpiranje',
    heard: 'Kje ste izvedeli za nas?', heardPick: 'Izberite',
    reviewTitle: 'Pregled povpraševanja', reviewHint: 'Okna lahko uredite ali odstranite, dodate novo okno ali nadaljujete na oddajo.', addToEnquiry: 'Dodaj v povpraševanje', summary: 'Povzetek', saveChanges: 'Shrani spremembe', addAnother: 'Dodaj še eno okno', notFinished: 'Ni dokončano', finishWindow: 'Dokončaj', toEnquiry: (n: number) => `Vaše povpraševanje (${n})`, toReview: 'Naprej na oddajo povpraševanja', toOffer: 'Naprej do ponudbe', toSend: 'Naprej na oddajo', yourOrderHint: 'Spodaj so prikazana okna, ki ste jih izbrali. Kliknite na posamezno okno za urejanje.', finishHint: 'Pregledate okna, vpišete svoje podatke in pošljete.', finishOpen: (n: number) => `Najprej izberite vse korake za pozicijo ${n}.`, toPosition: (n: number) => `Naprej na pozicijo ${n}`, editWindow: 'Uredi', backToReview: 'Nazaj na pregled',
    sashWidths: 'Širina kril', sashN: (n: number) => `Krilo ${n}`, sashRest: 'izračuna se samo', sashTooNarrow: 'Krilo mora biti široko vsaj 300 mm.', sashEqual: 'Enako široka krila',
    subKind: 'Vrsta', subLength: 'Dolžina', subSize: 'Mere', subDesc: 'Opis', offerPreview: 'Predogled ponudbe', offerPreviewHint: 'Pozicije se dodajajo sproti, ko izbirate.', windowAlone: 'Okno', positionPrice: 'Cena pozicije', positionNote: 'Cena tega okna z izbrano opremo, brez storitev.', servicesForAll: 'za vsa okna',
  },
  en: {
    title: 'Window configurator', notFound: 'Configurator not available.', notFoundHint: 'The supplier has not published the configurator yet.',
    qtyTitle: 'Quantity', sizeTitle: 'Size', roofWindow: 'Roof window', roofModelTitle: 'Roof window model', roofVariant: 'Material and colour', roofDatasheet: 'Technical sheet (PDF)', roofSize: 'Size', roofFlashing: 'Roof flashing', roofCenter: 'Centre pivot', roofTop: 'Top hung', from: 'from',
    nSash: (n: number) => n === 1 ? 'Single sash' : n === 2 ? 'Double sash' : n === 3 ? 'Triple sash' : 'Four sashes', slidingWindow: 'Sliding window', sillTitle: 'Window sills', shadeTitle: 'Shading and insect screens', shadeColor: 'Colour of the shading and its box', shadeColorHint: 'No extra charge. We confirm the colour when measuring.', shadeLabel: 'Shading', screenLabel: 'Insect screen', noShade: 'No shading', noScreen: 'No insect screen', sillIn: 'Inside sill', sillOut: 'Outside sill', noSill: 'No sill', glassTitle: 'Glass', handleTitle: 'Handle', lockable: 'Locks with a key', included: 'Included', layers: (n: number) => n === 3 ? 'triple glazed' : n === 2 ? 'double glazed' : `${n} panes`, colorTitle: 'Colour', colorOut: 'Outside', colorIn: 'Inside', nWall: (n: number) => `${n}-panel sliding wall`, nDoor: (n: number) => n === 1 ? 'Single balcony door' : n === 2 ? 'Double balcony door' : 'Triple balcony door',
    bandsTitle: 'Top light / bottom panel', band: { none: 'None', top: 'With top light', topSplit: 'With split top light', bottom: 'With bottom panel', bottomSplit: 'With split bottom panel' } as Record<string, string>,
    openTitle: 'Opening', openHint: 'Choose how each sash opens. The price is the difference to the cheapest one.', topLight: 'Top light', bottomPanel: 'Bottom panel', bandFixed: 'Fixed', bandTilt: 'Tilt', topHeight: 'Top light height', bottomHeight: 'Bottom panel height',
    preset: { all_open: 'All tilt & turn', one_open: 'One opening sash', outer_open: 'Outer sashes open', all_fixed: 'All fixed' } as Record<string, string>,
    step1: 'Window type', step2: 'Profile system', step3: 'Size and opening', step4: 'Equipment', step5: 'Services',
    stepProduct: 'What would you like to buy?', stepProductHint: 'Choose the type of product you would like to buy.',
    hSashes: 'How many sashes should the window have? A sash is the part that opens.', hParts: 'How many panels should the sliding wall have?', hRoof: 'Choose the roof window model, material and size.',
    hSize: 'Enter the width and height of the window in millimetres. We measure exactly before production, so sizes can be approximate.', hQty: 'How many identical roof windows do you need?',
    hBands: 'Does the window have a part above (top light) or below the sashes?', hMaterial: 'Which material should the frame be made of?',
    hProfile: 'The profile sets the insulation and the look of the frame. The price changes with each profile.', hColor: 'Frame colour outside and inside. They can differ.',
    hGlass: 'More panes mean better insulation (lower Ug). The first glass is included in the price.', hHandle: 'Choose the handle. The standard one is included.',
    hSills: 'Add an inside and outside sill if you like.', hShading: 'Add a shutter, blinds or an insect screen if you like.', hExtras: 'Extra equipment if you like.',
    pricesAfterSize: 'You see the price once you enter the sizes.', stepSashes: 'Number of sashes', stepParts: 'Number of panels', stepRoof: 'Model and size', stepSize: 'Size and opening', stepLayout: 'Layout and opening', stepBands: 'Version', extrasTitle: 'Other extras', stepOpening: 'Opening type', stepMaterial: 'Material', profilesN: (n: number) => `${n} ${n === 1 ? 'profile' : 'profiles'}`, stepNext: 'Next', stepOf: (i: number, n: number) => `Step ${i} of ${n}`, editing: 'Editing', stepDone: 'Done', stepEdit: 'Edit', stdEquip: 'Standard equipment',
    grpWindows: 'Windows', grpSliding: 'Sliding windows', grpDoors: 'Balcony doors', grpWalls: 'Sliding walls', grpRoof: 'Roof windows', servicesHint: 'Applies to all windows in this enquiry.', servicesTitle: 'Services', roofServices: 'Roof windows',
    width: 'Width', height: 'Height', range: 'allowed', hinge: 'Hinge side (seen from inside)', qty: 'Quantity', label: 'Room (optional)', labelPh: 'e.g. living room',
    none: 'None', yourOrder: 'Your enquiry', inQuote: 'Windows for the quote', position: 'Position', addWindow: 'Add window', duplicate: 'Duplicate', remove: 'Remove', removeAsk: (n: number) => `Remove position ${n}?`, removeHint: 'The window and all its choices will be removed from the enquiry.',
    unit: 'price/pc', total: 'Total excl. VAT', vat: 'VAT', gross: 'Total incl. VAT', estimate: 'Estimated price. The final quote follows an on-site measurement.',
    basePrice: 'Base price', noPrice: 'Price after measurement', pricesHidden: 'You will receive the price in the quote by e-mail.', pricesAtEnd: 'You will see the price at the end, after entering your details.', rangeTitle: 'Estimated price incl. VAT', rangeNote: 'An estimated range. We prepare the exact price after measuring on site.',
    getOffer: 'Get the quote', getOfferPdf: 'Download the quote (PDF)', orEnquiry: 'Or just send an enquiry',
    pdfDoneTitle: 'Your quote is ready', pdfDoneText: 'The informative quote was downloaded to your device. The supplier received your enquiry too. Number:', pdfAgain: 'Download the quote again', yourTotal: 'Total incl. VAT',
    pdfNote: 'Informative quote, calculated in the online configurator. We prepare the final quote after measuring on site.', pdfTaken: 'The customer downloaded the informative quote (PDF).',
    next: 'Continue to details', back: 'Back to windows', send: 'Send enquiry', sending: 'Sending …',
    contact: 'Your details', person: 'Private person', company: 'Company', companyName: 'Company name', vatNo: 'VAT number', contactPersonHint: 'Contact person', firstName: 'First name', lastName: 'Last name', email: 'E-mail', phone: 'Phone', address: 'Installation address', street: 'Street and house number', postal: 'Postal code', city: 'Town', country: 'Country', postalPick: 'Type the code or the town', outOfArea: 'We do not install at this address. You can still send the enquiry without installation.', note: 'Note',
    consent: 'I agree that the supplier uses my data to prepare a quote.',
    doneTitle: 'Thank you, your enquiry was sent!', doneText: 'The supplier will prepare a quote and contact you. Your enquiry number:',
    newOne: 'New enquiry', invalidSize: 'Size is outside the allowed range', pcs: 'pc',
    errors: { invalid_email: 'Enter a valid e-mail address.', name_required: 'Enter your first and last name.', company_required: 'Enter the company name.', address_required: 'Enter the full installation address.', rate_limited: 'Too many enquiries in a short time. Try again later.', size_out_of_range: 'Some sizes are outside the allowed range.' } as Record<string, string>,
    genericError: 'Sending failed. Please try again.',
    addToQuote: 'Add to quote', cancel: 'Cancel', room: 'Room', roofOpeningLabel: 'Opening',
    heard: 'How did you hear about us?', heardPick: 'Choose',
    reviewTitle: 'Review your enquiry', reviewHint: 'Edit or remove windows, add another one or continue to send.', addToEnquiry: 'Add to enquiry', summary: 'Summary', saveChanges: 'Save changes', addAnother: 'Add another window', notFinished: 'Not finished', finishWindow: 'Finish', toEnquiry: (n: number) => `Your enquiry (${n})`, toReview: 'Continue to send the enquiry', toOffer: 'Continue to your offer', toSend: 'Continue to send', yourOrderHint: 'Below are the windows you chose. Click a window to edit it.', finishHint: 'You check the windows, enter your details and send.', finishOpen: (n: number) => `First go through every step for position ${n}.`, toPosition: (n: number) => `On to position ${n}`, editWindow: 'Edit', backToReview: 'Back to the review',
    sashWidths: 'Sash widths', sashN: (n: number) => `Sash ${n}`, sashRest: 'worked out for you', sashTooNarrow: 'A sash must be at least 300 mm wide.', sashEqual: 'Equal sashes',
    subKind: 'Type', subLength: 'Length', subSize: 'Size', subDesc: 'Description', offerPreview: 'Quote preview', offerPreviewHint: 'Positions are added as you choose.', windowAlone: 'Window', positionPrice: 'Position price', positionNote: 'This window with the chosen equipment, without services.', servicesForAll: 'for all windows',
  },
}

let seq = 0
const newKey = () => `i${++seq}`

/** the customer's windows are kept in the browser while they configure, so a reload never loses them */
const draftKey = (slug: string) => `fenestio-cfg-${slug}`
function loadDraft(slug: string): any | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(slug)) || 'null')
    if (!d || d.v !== 1 || !Array.isArray(d.items) || !d.items.length) return null
    // new windows must not take a key a kept one already has
    for (const x of d.items) { const n = Number(String(x.key).slice(1)); if (n > seq) seq = n }
    return d
  } catch { return null }
}

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
  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-6 h-6 animate-spin text-[#8a8a8a]" /></div>
  if (state === 'missing' || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
      <div className="flex flex-col items-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-[#f3f3f3] flex items-center justify-center mb-4"><EyeOff className="w-6 h-6 text-[#8a8a8a]" /></div>
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
  // public page: what the customer had before a reload
  const [draft] = useState(() => internal || !slug ? null : loadDraft(slug))
  const [items, setItems] = useState<ConfigItem[]>(initialItems ?? draft?.items ?? [])
  const [active, setActive] = useState<number>(draft ? Math.min(draft.active ?? 0, draft.items.length - 1) : 0)
  const [stage, setStage] = useState<'config' | 'review' | 'contact' | 'done'>(draft?.stage === 'review' || draft?.stage === 'contact' ? draft.stage : 'config')
  const [contact, setContact] = useState({ customer_type: 'person' as 'person' | 'company', company_name: '', vat_number: '', first_name: '', last_name: '', email: '', phone: '', street: '', postal_code: '', city: '', country: 'SI', note: '', ...((draft?.contact ?? {}) as {}) })
  const [heard, setHeard] = useState<string>(draft?.heard ?? '')
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ quote_number: string; valid_until?: string; company?: Record<string, any> } | null>(null)
  // the informative offer the customer downloaded (kept to download it again)
  const [offerSnap, setOfferSnap] = useState<any>(null)
  // removing a position always asks first
  const [askRemove, setAskRemove] = useState<number | null>(null)
  // services are chosen once for the whole order (montaža, demontaža, odvoz …)
  const [openMap, setOpenMap] = useState<Record<string, string>>(() => draft?.openMap ?? Object.fromEntries((initialItems ?? []).map(x => [x.key, 'none'])))
  const [reachedMap, setReachedMap] = useState<Record<string, number>>(() => draft?.reachedMap ?? Object.fromEntries((initialItems ?? []).map(x => [x.key, 99])))
  // windows that reached their last step (so finishing is possible even before "Naprej" there)
  const [doneKeys, setDoneKeys] = useState<Record<string, boolean>>(() => draft?.doneKeys ?? {})
  const [services, setServices] = useState<string[]>(() => Array.isArray(draft?.services) ? draft.services.filter((id: string) => data.options.some(o => o.id === id)) : data.options.filter(o => isService(o) && o.is_default).map(o => o.id))
  // keep the draft on every change; once the enquiry is sent it is gone
  useEffect(() => {
    if (internal || !slug) return
    try {
      if (stage === 'done') localStorage.removeItem(draftKey(slug))
      else if (items.length) localStorage.setItem(draftKey(slug), JSON.stringify({ v: 1, items, active, stage, contact, heard, openMap, reachedMap, doneKeys, services }))
    } catch { /* storage off: nothing kept */ }
  }, [items, active, stage, contact, heard, openMap, reachedMap, doneKeys, services])
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
  // prices are worked out whenever the supplier sends them; how they are shown depends on the mode (in a quote always)
  const calc = !!data?.company.show_prices
  const priceMode: PriceMode = internal ? 'live' : (data?.company.price_mode ?? (calc ? 'live' : 'never'))
  const endMode: EndMode = internal ? 'enquiry' : (data?.company.end_mode ?? 'enquiry')
  /** the way on names where it leads: sending an enquiry, getting the offer, or either */
  const finishLabel = endMode === 'pdf' ? T.toOffer : endMode === 'choose' ? T.toSend : T.toReview
  const showLive = calc && priceMode === 'live'
  const showRangeLive = calc && priceMode === 'range'
  /** a from–to range around a price (−10 % … +10 %, rounded to 10) */
  const priceRange = (v: number) => `${money(Math.floor(v * 0.9 / 10) * 10, cur)} – ${money(Math.ceil(v * 1.1 / 10) * 10, cur)}`

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
    if (it.roof) return calc ? roofPrice(it) : null
    if (!data || !calc || !it.width || !it.height) return null
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
    if (it.roof) return roofPrice(it) != null || !calc
    if (it.spec) { const n = it.spec.sashes; return !!it.width && !!it.height && it.width >= 300 * n && it.width <= 1600 * n && it.height >= 300 && it.height <= 2800 && !(it.sashWidths ?? []).some(x => x < 300) }
    const t = data?.types.find(x => x.id === it.type_id)
    return !!t && !!it.width && !!it.height && it.width >= t.min_width && it.width <= t.max_width && it.height >= t.min_height && it.height <= t.max_height
  }

  const totals = useMemo(() => {
    const net = items.reduce((a, it) => a + (priceOf(it) ?? 0) * it.quantity, 0) + (calc ? serviceRows.reduce((a, r) => a + r.total, 0) : 0)
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
    if (copy) { setOpenMap(m => ({ ...m, [next.key]: 'none' })); setReachedMap(m => ({ ...m, [next.key]: 99 })) }
    setItems(xs => [...xs, next]); setActive(items.length)
  }
  function removeItem(i: number) {
    if (items.length === 1) return
    setItems(xs => xs.filter((_, j) => j !== i)); setActive(a => Math.max(0, a >= i ? a - 1 : a))
  }

  async function submit(withPdf = false) {
    setError('')
    if (!consent) return
    setSending(true)
    // the lines of the offer are worked out before sending (the same prices the customer saw)
    const offerLines = withPdf ? offerLinesNow() : null
    const { data: res, error } = await (supabase as any).rpc('submit_configuration', {
      p_slug: slug,
      p_customer: { ...contact, lead_source: heard || null },
      p_items: items.map(x => x.roof
        ? { roof: x.roof, quantity: x.quantity, option_ids: [], label: x.label }
        : x.spec
        ? { system_id: x.system_id, spec: x.spec, colors: x.colors ?? null, glass: x.glass ?? null, handle: x.handle ?? null, sills: x.sills ?? null, shading: x.shading ?? null, width: x.width, height: x.height, quantity: x.quantity, option_ids: x.option_ids, label: x.label }
        : { system_id: x.system_id, type_id: x.type_id, width: x.width, height: x.height, quantity: x.quantity, hinge: x.hinge, option_ids: x.option_ids, label: x.label }),
      p_note: [contact.note, withPdf ? T.pdfTaken : ''].filter(Boolean).join('\n'),
      p_services: services,
    })
    if (error) {
      setSending(false)
      const code = Object.keys(T.errors).find(k => String(error.message).includes(k))
      setError(code ? T.errors[code] : T.genericError)
      return
    }
    if (withPdf && offerLines) {
      try {
        const snap = await makeOfferSnapshot(res, offerLines)
        setOfferSnap(snap)
        await downloadOffer(snap, res.quote_number)
      } catch (e) { console.error('offer pdf', e) }
    }
    setSending(false)
    setResult(res); setStage('done'); window.scrollTo({ top: 0 })
  }

  /** the offer's lines: each window with its sills / shading as sub-positions, then the services */
  function offerLinesNow() {
    const vat = totals.vatRate
    const lines: any[] = []
    for (const x of items) {
      const d = describe(x), sp = split(x)
      const uid = Math.random().toString(36).slice(2, 10)
      lines.push({ room: x.label || null, name: d.title, description: d.rows.filter(([l]) => l !== '').slice(0, 2).map(([, v]) => v).join(' · ') || null,
        unit: 'pcs', quantity: x.quantity, unit_price: sp.unitPrice ?? 0, discount_pct: 0, vat_rate: vat,
        config: { kind: 'window', uid, item: x, title: d.title, rows: d.rows, template: data.types.find(t => t.id === x.type_id)?.template ?? null } })
      for (const sb of sp.subs) lines.push({ room: x.label || null, name: sb.title, description: sb.rows.map(([k, v]) => `${k}: ${v}`).join(' · '),
        unit: 'pcs', quantity: x.quantity, unit_price: sb.unitPrice, discount_pct: 0, vat_rate: vat,
        config: { kind: 'sub', parent: uid, code: sb.code, title: sb.title, rows: sb.rows, image_url: sb.image_url ?? null, sill: sb.sill ?? null, shade: sb.shade ?? null } })
    }
    for (const r of serviceRows) {
      const o = r.option
      const unit = Number(o.price_piece ?? 0) > 0 || (o.per_item && o.per_item !== 'window') ? 'pcs'
        : o.pricing === 'piece' ? 'pcs' : o.pricing === 'm2' ? 'm2' : o.pricing === 'perimeter' || o.pricing === 'width' ? 'm' : 'lump'
      lines.push({ room: null, name: o.name, description: o.description ?? null, unit, quantity: r.qty, unit_price: r.unitPrice, discount_pct: 0, vat_rate: vat,
        config: { kind: 'service', option_id: o.id } })
    }
    return lines
  }
  /** the offer as the PDF reads it: the supplier from the server, the customer from the form */
  async function makeOfferSnapshot(res: { quote_number: string; valid_until?: string; company?: Record<string, any> }, lines: any[]) {
    const { buildSnapshot } = await import('../lib/offerSnapshot')
    const person = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    const site = [contact.street, [contact.postal_code, contact.city].filter(Boolean).join(' '), contact.country !== 'SI' ? COUNTRIES.find(c => c.code === contact.country)?.[lang] : ''].filter(Boolean).join(', ')
    const co = res.company ?? { name: data.company.name, logo_url: data.company.logo_url, email: data.company.email, phone: data.company.phone, currency: data.company.currency }
    return buildSnapshot({
      quote_number: res.quote_number, title: '', valid_until: res.valid_until ?? null, lead_time: null, payment_terms: co.default_payment_terms ?? null, parity: null,
      contact_person: person || null, contact_email: contact.email || null, contact_phone: contact.phone || null,
      notes: T.pdfNote, site_address: site || null, discount_pct: 0, advance_discount_pct: co.advance_discount_pct ?? null,
    } as any, {
      name: contact.customer_type === 'company' && contact.company_name.trim() ? contact.company_name.trim() : person, vat_number: contact.customer_type === 'company' ? contact.vat_number || null : null,
      address: site || null,
    } as any, co as any, lines)
  }
  async function downloadOffer(snap: any, number: string) {
    const { downloadOfferPdf } = await import('../components/OfferPdfPreview')
    await downloadOfferPdf(snap, lang, `Ponudba_${number}.pdf`)
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
      if (x.shading?.shade) add(T.shadeColor, SHADE_COLORS.find(c => c.key === (x.shading?.color ?? null))?.[lang] ?? null)
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
      ['shade', x.shading?.shade, 'S', T.shadeLabel, id => shadeList.find(s => s.id === id), [[T.subSize, size], [T.shadeColor, SHADE_COLORS.find(c => c.key === (x.shading?.color ?? null))?.[lang] ?? '']]],
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
  const showBands = !!spec && !slidingKind(spec) && !!offer && allowedBands(spec.sashes, offer, bk(spec)).filter(k => allowedVariants(spec.sashes, offer, bk(spec)).some(v => v.band === k)).length > 1
  const stepIds = [
    'product',
    ...(roofSel || (spec && spec.kind !== 'sliding') ? ['variant'] : []),
    'size',
    ...(showBands ? ['bands'] : []),
    ...(spec && offer ? ['opening'] : []),
    ...(!roofSel && materials.length > 1 ? ['material'] : []),
    ...(!roofSel ? ['profile'] : []),
    ...(colorList.length >= 2 ? ['color'] : []),
    ...(spec && glassList.length > 1 ? ['glass'] : []),
    ...(spec && handleList.length > 1 ? ['handle'] : []),
    ...(spec && sillList.length > 0 ? ['sills'] : []),
    ...(spec && shadeList.length > 0 ? ['shading'] : []),
    ...(!roofSel && extraGroups.length > 0 ? ['extras'] : []),
    ...(!internal && data.options.some(isService) ? ['services'] : []),
  ]
  const openStep = openMap[it.key] ?? 'product'
  const openIdx = stepIds.indexOf(openStep)
  const reached = openStep === 'none' ? 99 : Math.max(reachedMap[it.key] ?? 0, openIdx)
  // a price only means something with the sizes: none before that step is done (in a quote always)
  const unlockIdx = stepIds.indexOf(roofSel ? 'variant' : 'size')
  const pricesOn = internal || stage !== 'config' || unlockIdx < 0 || reached > unlockIdx
  const show = showLive && pricesOn
  const showRange = showRangeLive && pricesOn
  // the drawing shows how the sashes open only from the opening step on
  const openingIdx = stepIds.indexOf('opening')
  const drawPlain = !internal && stage === 'config' && openingIdx >= 0 && reached < openingIdx
  /** the enquiry can be finished once every window went through all its steps */
  const atLast = !!it && stepIds.length > 0 && reached >= stepIds.length - 1
  const isDone = (x: ConfigItem) => !!doneKeys[x.key] || (reachedMap[x.key] ?? 0) >= 99 || (x.key === it.key && atLast)
  const firstOpen = items.findIndex(x => !isDone(x))
  const canFinish = items.every(sizeOk) && firstOpen < 0
  const finishNote = firstOpen >= 0 ? T.finishOpen(firstOpen + 1) : T.finishHint
  const finish = () => { setStage('review'); window.scrollTo({ top: 0 }) }
  /** a window's sizes show once the customer reached the size step (not on the first steps, before they chose anything) */
  const dimsOn = (x: ConfigItem) => internal || stage !== 'config' || (x.key === it.key ? (unlockIdx < 0 || reached >= unlockIdx) : (reachedMap[x.key] ?? 0) >= (x.roof ? 1 : 2))
  /** a window's own price can show once its sizes were entered (each window on its own) */
  const itemPriced = (x: ConfigItem) => internal || stage !== 'config' || (x.key === it.key ? pricesOn : (reachedMap[x.key] ?? 0) > (x.roof ? 1 : 2))
  const hiddenPriceText = (showLive || showRangeLive) && !pricesOn ? T.pricesAfterSize : priceMode === 'end' ? T.pricesAtEnd : T.pricesHidden
  function setOpen(id: string) {
    const i = id === 'none' ? 99 : stepIds.indexOf(id)
    setReachedMap(m => ({ ...m, [it.key]: Math.max(m[it.key] ?? 0, i) }))
    if (i >= stepIds.length - 1) setDoneKeys(m => m[it.key] ? m : { ...m, [it.key]: true })
    setOpenMap(m => ({ ...m, [it.key]: id }))
    if (id !== 'none') setTimeout(() => document.getElementById('step-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }
  const groupLabel = group === 'roof' ? T.grpRoof : group === 'sliding' ? T.grpSliding : group === 'door' ? T.grpDoors : group === 'wall' ? T.grpWalls : group === 'windows' ? T.grpWindows : type?.name ?? ''
  const roofSize = roofModel?.sizes.find(x => x.id === roofSel?.size)
  const variantSummary = roofSel
    ? [roofModel ? [roofModel.brand, roofModel.name].filter(Boolean).join(' ') : '', roofSize ? `${roofSize.w} × ${roofSize.h} cm` : ''].filter(Boolean).join(' · ')
    : spec ? specName(spec) : ''
  // the version (top light / bottom panel) and the opening are steps of their own
  const bandsSummary = spec && !slidingKind(spec) ? T.band[bandKeyOf(spec)] : ''
  const openingSummary = spec ? spec.main.map(f => (lang === 'sl' ? OPEN_SL : OPEN_EN)[f.opening as string] ?? '').filter(Boolean).join(' + ') : ''
  const profileSummary = sysNow?.name ?? ''
  // what the drawing shows of the choices: outside colour of the frame, handle colour, sills, shading, screen
  const look = (() => {
    const out = colorList.find(c => c.id === it.colors?.out) ?? colorList[0]
    const hnd = handleList.find(h => h.id === it.handle) ?? handleList[0]
    const shadeX = shadeList.find(x => x.id === it.shading?.shade)
    return {
      frame: parseColor(out?.look)?.hex ?? '#fbfbfa',
      extras: {
        shade: it.shading?.shade ? (shadeX?.icon ?? 'roller') : null,
        shadeColor: SHADE_COLORS.find(c => c.key === (it.shading?.color ?? null))?.hex ?? null,
        screen: !!it.shading?.screen,
        sillOut: it.sills?.out ? sillList.find(x => x.id === it.sills?.out)?.material ?? 'alu_silver' : null,
        sillIn: it.sills?.in ? sillList.find(x => x.id === it.sills?.in)?.material ?? 'pvc_white' : null,
        handle: parseColor(hnd?.look)?.hex ?? null,
      },
    }
  })()
  const materialSummary = matNow ? L.materials[matNow] : ''
  const colorSummary = colorList.length ? `${T.colorOut}: ${(colorList.find(c => c.id === it.colors?.out) ?? colorList[0]).name} · ${T.colorIn}: ${(colorList.find(c => c.id === it.colors?.in) ?? colorList[0]).name}` : ''
  const sizeSummary = roofSel ? `${it.quantity} ${T.pcs}` : `${it.width ?? '—'} × ${it.height ?? '—'} mm · ${it.quantity} ${T.pcs}`
  const glassSummary = glassList.length ? (glassList.find(g => g.id === it.glass) ?? glassList[0]).name : ''
  const handleSummary = handleList.length ? (handleList.find(h => h.id === it.handle) ?? handleList[0]).name : ''
  const sillsSummary = [it.sills?.in, it.sills?.out].map(id => sillList.find(x => x.id === id)?.name ?? '').filter(Boolean).join(', ') || T.noSill
  const shadingSummary = [it.shading?.shade, it.shading?.screen].map(id => shadeList.find(x => x.id === id)?.name ?? '').filter(Boolean).join(', ') || T.noShade
  const extrasSummary = data.options.filter(o => it.option_ids.includes(o.id) && !isService(o)).map(o => o.name).join(', ') || T.none
  const servicesSummary = data.options.filter(o => services.includes(o.id)).map(o => o.name).join(', ') || T.none
  /** a product card in the first step: picking it only selects it, "Naprej" goes on */
  const prodCard = (key: string, label: string, drawing: React.ReactNode, onPick: () => void, _next?: string) => {
    const on = group === key
    return <button key={key} onClick={() => { if (!on) onPick() }}
      className={cn('relative rounded-xl border p-4 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
      style={on ? selStyle(accent) : undefined}>
      {on && <SelBadge accent={accent} />}
      {/* the first choice: big pictures, so the products are easy to tell apart */}
      <div className="h-[150px] flex items-center justify-center">{drawing}</div>
      <div className="text-[15px] font-medium text-gray-900 mt-3 leading-snug">{label}</div>
    </button>
  }
  /** what to do on each step, under its title */
  const stepHints: Record<string, string> = {
    product: T.stepProductHint,
    variant: roofSel ? T.hRoof : spec?.kind === 'wall' ? T.hParts : T.hSashes,
    size: roofSel ? T.hQty : T.hSize,
    bands: T.hBands, opening: T.openHint, material: T.hMaterial, profile: T.hProfile, color: T.hColor,
    glass: T.hGlass, handle: T.hHandle, sills: T.hSills, shading: T.hShading, extras: T.hExtras, services: T.servicesHint,
  }
  /**
   * The steps show one after another: every step reached so far stays open with its choices
   * (so the whole window can be seen and changed), the next one appears with "Naprej".
   */
  function renderStep(id: string, title: string, _summary: string, body: React.ReactNode, hint?: string) {
    const idx = stepIds.indexOf(id)
    if (idx < 0) return null
    hint = hint ?? stepHints[id]
    const allDone = reached >= 99
    const frontier = Math.min(reached, stepIds.length - 1)
    if (idx > frontier) return null
    const done = allDone || idx < frontier
    const nextId = stepIds[idx + 1]
    const num = done
      ? <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[#dbfce7] text-[#267a47] ring-1 ring-inset ring-[#b7ecc9]"><Check className="w-4 h-4" strokeWidth={2.75} /></span>
      : <span className="w-7 h-7 rounded-full text-[13px] font-semibold flex items-center justify-center shrink-0 bg-white text-gray-900 ring-1 ring-inset ring-[#d4d4d4]">{idx + 1}</span>
    const last = !done && idx === frontier
    return <section id={'step-' + id} key={id} className={cn('bg-white border border-gray-200 rounded-xl p-5 sm:p-6 scroll-mt-[100px]', last && idx > 0 && 'cfg-step-in')}>
      <div className={cn('flex items-center gap-3', hint ? 'mb-1' : 'mb-4')}>
        {num}
        <h2 className="flex-1 min-w-0 text-lg font-semibold tracking-[-0.01em] text-gray-900">{title}</h2>
        {!internal && <span className="text-[13px] font-medium text-[#8a8a8a] whitespace-nowrap">{T.stepOf(idx + 1, stepIds.length)}</span>}
      </div>
      {hint && <p className="text-sm text-[#4f4f4f] pl-10 mb-5">{hint}</p>}
      <div className="space-y-6">{body}</div>
      {/* only the newest step moves on; the last one goes to the review */}
      {last && <div className="flex justify-end mt-6">
        <button type="button" onClick={() => { if (nextId) setOpen(nextId); else { setOpen('none'); if (!internal) finish() } }}
          className="h-11 px-6 rounded-[10px] text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={btn}>{nextId ? T.stepNext : internal ? T.stepDone : T.addToEnquiry}</button>
      </div>}
    </section>
  }

  return (
    <div className={cn('cfg-scope', internal ? 'text-gray-900' : 'min-h-screen bg-[#f5f5f6] text-gray-900')}>
      {/* Header */}
      {!internal && <header className="bg-white border-b border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.03)] sticky top-0 z-30">
        <div className={cn('px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3', data.company.logo_size === 'l' ? 'h-[72px] sm:h-20' : data.company.logo_size === 's' ? 'h-14 sm:h-16' : 'h-16 sm:h-[72px]')}>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* only the supplier's logo; without a logo its name stands in */}
            {data.company.logo_url
              ? <img src={data.company.logo_url} alt={data.company.name} className={cn('w-auto object-contain object-left', data.company.logo_size === 'l' ? 'h-12 sm:h-14 max-w-[200px] sm:max-w-[320px]' : data.company.logo_size === 's' ? 'h-8 sm:h-9 max-w-[150px] sm:max-w-[200px]' : 'h-10 sm:h-12 max-w-[180px] sm:max-w-[260px]')} />
              : <div className="text-lg font-bold tracking-[-0.01em] text-gray-900 truncate">{data.company.name}</div>}
          </div>
          {/* contact as buttons (on a phone only the icons), then the language */}
          <div className="flex items-center gap-2">
            {data.company.phone && <a href={`tel:${data.company.phone}`} title={data.company.phone}
              className="inline-flex items-center gap-2 h-10 px-3 sm:px-3.5 rounded-[10px] border border-[#dfdfdf] bg-white text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:border-[#c4c4c4] hover:bg-[#fafafa] transition-colors">
              <Phone className="w-4 h-4" /><span className="hidden sm:inline">{data.company.phone}</span></a>}
            {data.company.email && <a href={`mailto:${data.company.email}`} title={data.company.email}
              className="inline-flex items-center gap-2 h-10 px-3 sm:px-3.5 rounded-[10px] border border-[#dfdfdf] bg-white text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:border-[#c4c4c4] hover:bg-[#fafafa] transition-colors">
              <Mail className="w-4 h-4" /><span className="hidden md:inline">{data.company.email}</span></a>}
            <div className="flex items-center h-10 p-1 rounded-[10px] border border-[#dfdfdf] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
              {(['sl', 'en'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={cn('px-2.5 h-full rounded-md text-xs font-semibold uppercase transition-colors', lang === l ? 'bg-[#131313] text-white' : 'text-[#4f4f4f] hover:text-gray-900')}>{l}</button>)}
            </div>
          </div>
        </div>
      </header>}

      {stage === 'done' ? (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white mb-4" style={btn}><Check className="w-6 h-6" /></div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">{offerSnap ? T.pdfDoneTitle : T.doneTitle}</h1>
          <p className="text-[15px] text-[#4f4f4f] mt-2">{offerSnap ? T.pdfDoneText : T.doneText}</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">{result?.quote_number}</p>
          {/* the price after the details: when it was hidden until now, or with the offer */}
          {calc && (offerSnap || priceMode === 'end') && <div className="mt-5 inline-flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-4">
            <span className="text-sm font-medium text-[#4f4f4f]">{T.yourTotal}</span>
            <span className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money(offerSnap?.total_gross ?? totals.gross, cur)}</span>
          </div>}
          {offerSnap && <div><button onClick={() => downloadOffer(offerSnap, result?.quote_number ?? '')}
            className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={btn}><FileText className="w-4 h-4" />{T.pdfAgain}</button></div>}
          <button onClick={() => { setItems([defaultItem(data)]); setActive(0); setStage('config'); setConsent(false); setOfferSnap(null); setContact(c => ({ ...c, note: '' })) }}
            className="mt-6 text-sm font-medium hover:underline" style={{ color: accent }}>{T.newOne}</button>
        </div>
      ) : (
        <div className={cn('w-full px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start', internal ? 'xl:grid-cols-[360px_minmax(0,1fr)_380px]' : 'max-w-[1480px] mx-auto')}>
          {/* The order at a glance (wide screens): the windows, one line of services, the final price */}
          {internal && <aside className="hidden xl:flex xl:flex-col xl:sticky xl:top-[100px] bg-white border border-gray-200 rounded-xl p-5 max-h-[calc(100vh-116px)] overflow-y-auto">
            <div className="text-base font-semibold text-gray-900">{T.yourOrder}</div>
            <p className="text-[13px] leading-5 text-[#4f4f4f] mt-1 mb-5">{T.yourOrderHint}</p>
            <div className="space-y-2">
              {items.map((x, i) => {
                const t = data.types.find(tt => tt.id === x.type_id)
                const xp = priceOf(x)
                const on = i === active && stage === 'config'
                return <div key={x.key} role="button" tabIndex={0} onClick={() => { setActive(i); setStage('config') }} onKeyDown={e => { if (e.key === 'Enter') { setActive(i); setStage('config') } }}
                  className={cn('group relative w-full rounded-xl border p-2.5 flex items-center gap-3.5 cursor-pointer transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                  // the window being configured: a clear black outline (inline, so it wins over the soft card border)
                  style={on ? { borderColor: '#131313', boxShadow: '0 0 0 1px #131313, 0 1px 3px rgba(16,24,40,.08)' } : undefined}>
                  <div className="w-[112px] h-[104px] flex items-center justify-center shrink-0">
                    {x.roof ? <RoofWindowDrawing size={92} /> : x.spec ? <SpecDrawing spec={x.spec} width={x.width ?? 0} height={x.height ?? 0} size={100} slim plain /> : t && <WindowDrawing template={t.template} width={x.width ?? 0} height={x.height ?? 0} hinge={x.hinge} size={100} />}
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="text-[15px] font-semibold text-gray-900 leading-snug">{x.quantity > 1 ? `${x.quantity} × ` : ''}{x.roof ? T.roofWindow : x.spec ? specName(x.spec) : t?.name}</div>
                    {dimsOn(x) && <div className="text-[13px] font-medium text-[#8a8a8a] mt-0.5">{x.roof ? `${(x.width ?? 0) / 10} × ${(x.height ?? 0) / 10} cm` : `${x.width ?? '—'} × ${x.height ?? '—'} mm`}</div>}
                    {x.label && <div className="text-[13px] font-medium text-[#4f4f4f] break-words">{x.label}</div>}
                    <div className="text-[15px] font-semibold text-gray-900 tabular-nums mt-1.5">{xp == null || !itemPriced(x) ? '' : showLive ? money(xp * x.quantity, cur) : showRangeLive ? priceRange(xp * x.quantity) : ''}</div>
                  </div>
                  {items.length > 1 && <button type="button" onClick={e => { e.stopPropagation(); setAskRemove(i) }} title={T.remove} aria-label={`${T.remove} ${T.position} ${i + 1}`}
                    className="absolute top-2 right-2 w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-[#5f5f5f] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                </div>
              })}
            </div>
            <button type="button" onClick={() => addItem(false)} className="mt-3 w-full h-12 rounded-xl bg-[#131313] text-white text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-black transition-colors"><Plus className="w-4 h-4" strokeWidth={2.5} />{T.addWindow}</button>
            {serviceRows.length > 0 && <div className="mt-4 text-[13px] font-medium text-[#8a8a8a]">
              {T.servicesTitle}: <span className="text-gray-900">{serviceRows.map(r => r.option.name).join(', ')}</span>
            </div>}
            {/* the final price of the whole order */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {show ? <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold text-gray-900">{T.gross}</span>
                <span className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money(totals.gross, cur)}</span>
              </div> : showRange ? <div>
                <div className="text-[15px] font-semibold text-gray-900">{T.rangeTitle}</div>
                <div className="text-[22px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{priceRange(totals.gross)}</div>
              </div> : <p className="text-[13px] font-medium text-[#8a8a8a]">{hiddenPriceText}</p>}
            </div>
            {!internal && <>
              <button type="button" disabled={!canFinish} onClick={finish}
                className="mt-4 w-full h-12 rounded-xl text-[15px] font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{finishLabel}</button>
              <p className="text-[13px] text-[#8a8a8a] mt-2 text-center">{finishNote}</p>
            </>}
          </aside>}

          {/* Main column */}
          <div className="flex flex-col gap-4 min-w-0">
            {stage === 'config' && !internal && data.company.intro && <p className="text-[15px] leading-6 text-[#4f4f4f] whitespace-pre-line">{data.company.intro}</p>}

            {stage === 'config' ? <>
              {!internal && (items.length > 1 || isDone(it)) && <button type="button" onClick={finish}
                className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-[#4f4f4f] hover:text-gray-900 transition-colors"><ArrowLeft className="w-4 h-4" />{T.toEnquiry(items.length)}</button>}
              {/* Position tabs (wide screens: adding, picking and removing windows is in the summary on the left) */}
              <div className={cn('gap-1.5 overflow-x-auto pb-1', internal ? 'flex xl:hidden' : 'hidden')}>
                {items.map((x, i) => <div key={x.key} className={cn('shrink-0 h-9 pl-3.5 rounded-[10px] text-sm font-medium border transition-colors flex items-center', items.length > 1 ? 'pr-1' : 'pr-3.5', i === active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-900 hover:border-gray-400')}
                  style={i === active ? btn : undefined}>
                  <button type="button" onClick={() => setActive(i)} className="h-full">{T.position} {i + 1}{x.label ? ` · ${x.label}` : ''}</button>
                  {items.length > 1 && <button type="button" onClick={() => setAskRemove(i)} title={T.remove} aria-label={`${T.remove} ${T.position} ${i + 1}`}
                    className={cn('ml-1 w-7 h-7 rounded-md flex items-center justify-center transition-colors', i === active ? 'hover:bg-white/15' : 'text-[#8a8a8a] hover:text-gray-900 hover:bg-[#f1f1f1]')}><X className="w-3.5 h-3.5" /></button>}
                </div>)}
                <button onClick={() => addItem(false)} className="shrink-0 h-9 px-3.5 rounded-[10px] text-sm font-medium border border-dashed border-gray-300 text-gray-900 hover:border-gray-500 flex items-center gap-1.5 transition-colors"><Plus className="w-3.5 h-3.5" />{T.addWindow}</button>
              </div>

              {renderStep('product', T.stepProduct, groupLabel, <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {offer?.windows && !!(offer.sashes ?? []).length && prodCard('windows', T.grpWindows, <SpecDrawing spec={makeSpec(2, 'none', 'none', 'fixed')} width={1300} height={1300} size={140} plain />,
                  () => pickSashes(spec && !spec.kind ? spec.sashes : (offer.sashes ?? []).includes(2) ? 2 : [...(offer.sashes ?? [])].sort()[0]), 'variant')}
                {offer?.slidingWindows && prodCard('sliding', T.grpSliding, <SpecDrawing spec={makeSlidingSpec()} width={1600} height={1200} size={160} plain />, pickSliding, 'profile')}
                {offer?.doors && prodCard('door', T.grpDoors, <SpecDrawing spec={makeSpec(1, 'none', 'none', 'fixed')} width={900} height={2200} size={140} plain />,
                  () => pickDoor(spec?.kind === 'door' ? spec.sashes : [...(offer.doorSashes ?? [1, 2, 3])].sort()[0]), 'variant')}
                {offer?.sliding && firstWall != null && prodCard('wall', T.grpWalls, <SpecDrawing spec={makeSpec(firstWall, 'none', 'none', 'fixed')} width={wallWidth(firstWall)} height={2200} size={160} plain />,
                  () => pickWall(spec?.kind === 'wall' ? spec.sashes : firstWall), 'variant')}
                {offer?.roof && !!roofCat?.models.length && prodCard('roof', T.grpRoof, <RoofWindowDrawing size={130} />, () => { if (!roofSel) pickRoof() }, 'variant')}
                {visibleTypes.map(t => {
                  const door = t.template.startsWith('door') || t.template === 'lift_slide'
                  return prodCard('type:' + t.id, t.name, <WindowDrawing template={t.template} width={door ? 900 : 1200} height={door ? 2100 : 1300} size={130} plain />, () => pickType(t), 'profile')
                })}
              </div>, T.stepProductHint)}

              {renderStep('variant', roofSel ? T.stepRoof : spec?.kind === 'wall' ? T.stepParts : T.stepSashes, variantSummary, <>
                {(group === 'windows' || group === 'door' || group === 'wall') && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {roofCat.models.map(m => {
                      const on = roofSel.model === m.id
                      const from = m.sizes.length ? Math.min(...m.sizes.map(x => Number(x.price))) : null
                      return <button key={m.id} onClick={() => pickRoof({ model: m.id })}
                        className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="h-[84px] flex items-center justify-center">{m.image_url ? <img src={m.image_url} alt="" className="max-h-full max-w-full object-contain" /> : <RoofWindowDrawing size={80} opening={m.opening} />}</div>
                        {m.brand && <div className="text-[13px] font-medium text-[#4f4f4f] mt-2.5 leading-snug">{m.brand}</div>}
                        <div className={cn('text-sm font-medium text-gray-900 leading-snug', !m.brand && 'mt-2.5')}>{m.name}</div>
                        <div className="text-[13px] font-medium text-[#4f4f4f] mt-0.5">{m.opening === 'top' ? T.roofTop : T.roofCenter}{show && from != null ? ` · ${T.from} ${money(from, cur)}` : ''}</div>
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
                      {v.name}{show && Number(v.pct) > 0 && <span className="ml-1.5 font-medium text-[#4f4f4f]">+ {Number(v.pct)}%</span>}
                    </Chip>)}
                  </div>
                </Sub>}
                {roofModel && <Sub title={T.roofSize}>
                  <div className="flex flex-wrap gap-2">
                    {roofModel.sizes.map(sz => <Chip key={sz.id} on={roofSel.size === sz.id} onClick={() => pickRoof({ size: sz.id })} accent={accent} single>
                      {sz.w} × {sz.h} cm{show && <span className="ml-1.5 font-medium text-[#4f4f4f]">{money(roofUnitPrice(Number(sz.price), Number(roofModel.variants?.find(x => x.id === roofSel.variant)?.pct ?? 0), 0), cur)}</span>}
                    </Chip>)}
                  </div>
                </Sub>}
                {roofCat.flashings.length > 0 && <Sub title={T.roofFlashing}>
                  <div className="flex flex-wrap gap-2">
                    <Chip on={!roofSel.flashing} onClick={() => pickRoof({ flashing: null })} accent={accent} single>{T.none}</Chip>
                    {roofCat.flashings.map(f => <Chip key={f.id} on={roofSel.flashing === f.id} onClick={() => pickRoof({ flashing: f.id })} accent={accent} single>
                      {f.name}{show && Number(f.price) > 0 && <span className="ml-1.5 font-medium text-[#4f4f4f]">+ {money(Number(f.price), cur)}</span>}
                    </Chip>)}
                  </div>
                </Sub>}
              </>}
              </>)}

              {renderStep('size', roofSel ? T.qtyTitle : T.sizeTitle, sizeSummary, <>
<Sub>
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
                              <div className={cn('flex items-center h-10 rounded-lg border bg-[#fafafa] px-3 text-sm text-gray-900', x < 300 ? 'border-red-400' : 'border-gray-200')}>{x}<span className="ml-auto text-[#4f4f4f]">mm</span></div>
                              <span className="text-[13px] text-[#4f4f4f]">{T.sashRest}</span>
                            </div>)}
                      </div>
                      {bad && <p className="text-[13px] text-red-600 mt-1">{T.sashTooNarrow}</p>}
                      {it.sashWidths && <button type="button" onClick={() => update({ sashWidths: null })} className="mt-2 text-sm font-medium text-gray-900 hover:underline">{T.sashEqual}</button>}
                    </div>
                  })() : null}
                  {!showBands && spec && spec.top !== 'none' && <MmInput label={T.topHeight} value={Math.round((it.height ?? 0) * spec.topRatio)} onChange={v => v && it.height && setSpec({ ...spec, topRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
                  {!showBands && spec && spec.bottom !== 'none' && <MmInput label={T.bottomHeight} value={Math.round((it.height ?? 0) * spec.bottomRatio)} onChange={v => v && it.height && setSpec({ ...spec, bottomRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
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

              {renderStep('bands', T.stepBands, bandsSummary, <>
{spec && !slidingKind(spec) && offer && allowedBands(spec.sashes, offer, bk(spec)).filter(k => allowedVariants(spec.sashes, offer, bk(spec)).some(v => v.band === k)).length > 1 && <Sub>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
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
                      {pr != null && curP != null && Math.round(pr - curP) !== 0 && <div className="text-[13px] font-medium text-[#4f4f4f] mt-0.5">{pr > curP ? '+' : '−'} {money(Math.abs(Math.round(pr - curP)), cur)}</div>}
                    </button>
                  })}
                </div>
              </Sub>}
              {spec && (spec.top !== 'none' || spec.bottom !== 'none') && <div className="grid sm:grid-cols-2 gap-3">
                  {spec && spec.top !== 'none' && <MmInput label={T.topHeight} value={Math.round((it.height ?? 0) * spec.topRatio)} onChange={v => v && it.height && setSpec({ ...spec, topRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
                  {spec && spec.bottom !== 'none' && <MmInput label={T.bottomHeight} value={Math.round((it.height ?? 0) * spec.bottomRatio)} onChange={v => v && it.height && setSpec({ ...spec, bottomRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
              </div>}
              </>)}

              {renderStep('opening', T.stepOpening, openingSummary, <>
{spec && offer && <Sub>
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
                  return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {cards.map((sp, i) => {
                      const on = sp.main.every((f, j) => sameField(f, spec.main[j])) && bandModeOf(sp) === curMode
                      const d = prices[i] != null && min != null ? Math.round(prices[i]! - min) : null
                      return <button key={i} onClick={() => setSpec(sp)}
                        className={cn('relative rounded-xl border p-3.5 bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="h-[104px] flex items-center justify-center"><SpecDrawing spec={sp} width={it.width ?? 1200} height={it.height ?? 1400} size={spec.sashes > 2 ? 110 : 92} /></div>
                        {d != null && <div className="text-[13px] font-medium text-[#4f4f4f] mt-1.5">{d > 0 ? `+ ${money(d, cur)}` : T.basePrice}</div>}
                      </button>
                    })}
                  </div>
                })()}
              </Sub>}
              </>)}

              {renderStep('material', T.stepMaterial, materialSummary, <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                <div className="grid sm:grid-cols-2 gap-3">
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
                        {s.description && <div className="text-[13px] leading-5 text-[#4f4f4f] mt-1.5">{s.description}</div>}
                        {diff != null && <div className="inline-flex items-center mt-2.5 rounded-lg px-[7px] py-[3px] text-xs font-semibold"
                          style={diff > 0 ? { color: '#4a4a4a', backgroundColor: '#ececec' } : { color: '#267a47', backgroundColor: '#dbfce7' }}>
                          {diff > 0 ? `+ ${money(diff, cur)}` : T.basePrice}
                        </div>}
                        {/* the price of this window in this profile */}
                        {show && b != null && <div className="mt-2"><span className="text-[15px] font-semibold text-gray-900">{money(b, cur)}</span><span className="text-[13px] font-medium text-[#4f4f4f]"> / {T.pcs}</span></div>}
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
                // every colour shows its fixed surcharge against the base colour on that side, the chosen one too, so nothing moves
                const base = { out: specPriceWith({ ...cur2, out: list[0].id }), in: specPriceWith({ ...cur2, in: list[0].id }) }
                const row = (side: 'out' | 'in') => <div>
                  <div className="text-sm font-semibold text-gray-900 mb-2">{side === 'out' ? T.colorOut : T.colorIn}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map(c => {
                      const on = cur2[side] === c.id
                      const lookSpec = parseColor(c.look)
                      const p = show ? specPriceWith({ ...cur2, [side]: c.id }) : null
                      const now = base[side]
                      return <button key={c.id} onClick={() => update({ colors: { ...cur2, [side]: c.id } })}
                        className={cn('inline-flex items-center gap-2 h-10 pl-2 pr-3 rounded-[10px] border bg-white text-sm font-medium transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {lookSpec && <ColorSwatch spec={lookSpec} size={22} rounded={6} />}
                        <span className="text-gray-900">{c.name}</span>
                        {p != null && now != null && Math.round(p - now) !== 0 && <span className="text-[13px] font-medium text-[#4f4f4f]">{p > now ? '+' : '−'} {money(Math.abs(Math.round(p - now)), cur)}</span>}
                      </button>
                    })}
                  </div>
                </div>
                return <Sub>
                  <div className="space-y-4">{row('out')}{row('in')}</div>
                </Sub>
              })()}
              </>)}


              {renderStep('glass', T.glassTitle, glassSummary, <>
{/* glass package: cards with Ug; the first one is included */}
              {spec && glassList.length > 1 && <Sub>
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
                      <div className="text-[13px] leading-5 text-[#4f4f4f] mt-1 flex-1">{g.ug != null ? g.name : null}{g.description ? <>{g.ug != null ? ' ' : ''}{g.description}</> : null}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{i === 0 ? T.included : d != null && d !== 0 ? `${d > 0 ? '+' : '−'} ${money(Math.abs(d), cur)}` : ''}</div>
                    </button>
                  })}
                </div>
              </Sub>}

              </>)}

              {renderStep('handle', T.handleTitle, handleSummary, <>
              {/* handle: one per sash that opens with a handle */}
              {spec && handleList.length > 1 && <Sub>
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
                      <div className="text-[13px] leading-5 text-[#4f4f4f] mt-0.5 flex-1">{h.lockable ? T.lockable : ''}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{i === 0 ? T.included : d != null && d !== 0 ? `${d > 0 ? '+' : '−'} ${money(Math.abs(d), cur)}` : ''}</div>
                    </button>
                  })}
                </div>
              </Sub>}

              </>)}

              {renderStep('sills', T.sillTitle, sillsSummary, <>
              {/* window sills: inside and outside, none by default */}
              {spec && sillList.length > 0 && <Sub>
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
                        <div className="text-[13px] leading-5 text-[#4f4f4f] mt-0.5 flex-1">{desc}</div>
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

              </>)}

              {renderStep('shading', T.shadeTitle, shadingSummary, <>
              {/* shading and insect screen, none by default */}
              {spec && shadeList.length > 0 && <Sub>
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
                        <div className="text-[13px] leading-5 text-[#4f4f4f] mt-0.5 flex-1">{x?.description}</div>
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
                  {it.shading?.shade && <div>
                    <div className="text-sm font-semibold text-gray-900">{T.shadeColor}</div>
                    <p className="text-[13px] text-[#4f4f4f] mt-0.5 mb-2">{T.shadeColorHint}</p>
                    <div className="flex flex-wrap gap-2">
                      {SHADE_COLORS.map(c => {
                        const on = (it.shading?.color ?? null) === c.key
                        return <button key={c.key ?? 'frame'} type="button" onClick={() => update({ shading: { ...(it.shading ?? {}), color: c.key } })}
                          className={cn('inline-flex items-center gap-2 h-10 pl-2 pr-3 rounded-[10px] border bg-white text-sm font-medium transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                          style={on ? selStyle(accent) : undefined}>
                          <span className="w-[22px] h-[22px] rounded-md border border-black/10" style={{ background: c.hex ?? look.frame }} />
                          <span className="text-gray-900">{c[lang]}</span>
                        </button>
                      })}
                    </div>
                  </div>}
                </div>
              </Sub>}

              </>)}

              {renderStep('extras', T.extrasTitle, extrasSummary, <>
              {!roofSel && extraGroups.length > 0 && <Sub>
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
                <div className="space-y-4">
                  {items.some(x => x.roof) && data.options.some(o => o.per_item === 'roof') && <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">{T.roofServices}</div>
                    <div className="flex flex-wrap gap-2">
                      {data.options.filter(o => o.per_item === 'roof').map(o => <Chip key={o.id} on={services.includes(o.id)} onClick={() => toggleService(o)} accent={accent}>
                        {o.name}{show && Number(o.price_piece ?? 0) > 0 && <span className="ml-1.5 font-medium text-[#4f4f4f]">{money(Number(o.price_piece), cur)} {L.pricing.piece}</span>}
                      </Chip>)}
                    </div>
                  </div>}
                  {SERVICE_GROUPS.filter(g => data.options.some(o => o.group_key === g && (!o.per_item || o.per_item === 'window'))).map(g => <div key={g}>
                    <div className="text-sm font-semibold text-gray-900 mb-2">{L.groups[g]}</div>
                    <div className="flex flex-wrap gap-2">
                      {data.options.filter(o => o.group_key === g && (!o.per_item || o.per_item === 'window')).map(o => <Chip key={o.id} on={services.includes(o.id)} onClick={() => toggleService(o)} accent={accent}>
                        {o.name}{show && <span className="ml-1.5 font-medium text-[#4f4f4f]">{[Number(o.price_piece ?? 0) > 0 ? `${money(Number(o.price_piece), cur)} ${L.pricing.piece}` : '', o.price != null && Number(o.price) > 0 ? `${money(Number(o.price), cur)} ${L.pricing[o.pricing]}` : ''].filter(Boolean).join(' + ')}</span>}
                      </Chip>)}
                    </div>
                  </div>)}
                </div>
              </Sub>}
              </>)}

              {!internal && reached >= 99 && <div className="flex justify-end">
                <button type="button" onClick={finish} className="h-11 px-6 rounded-[10px] text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={btn}>{T.saveChanges}</button>
              </div>}
            </> : stage === 'review' ? (
              /* Review: what the customer is about to send */
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">{T.yourOrder}</h2>
                <p className="text-sm text-[#4f4f4f] mt-1 mb-5">{T.reviewHint}</p>
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
                        <div className="flex items-baseline gap-2 flex-wrap"><span className="text-[13px] font-medium text-[#4f4f4f]">{T.position} {i + 1}</span><span className="text-[15px] font-semibold text-gray-900">{d.title}</span>
                          {!isDone(x) && <span className="self-center inline-flex items-center h-6 px-2 rounded-md text-xs font-semibold bg-[#fef3cd] text-[#8a6100]">{T.notFinished}</span>}</div>
                        <dl className="mt-2 grid grid-cols-[minmax(100px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                          {d.rows.map(([k, v]) => <div key={k} className="contents"><dt className="font-medium text-[#4f4f4f]">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>)}
                          {x.sashWidths && <div className="contents"><dt className="font-medium text-[#4f4f4f]">{T.sashWidths}</dt><dd className="font-medium text-gray-900">{x.sashWidths.map(w => `${w} mm`).join(' · ')}</dd></div>}
                        </dl>
                      </div>
                      <div className="sm:text-right flex sm:flex-col justify-between gap-2">
                        {show && <div><div className="text-sm font-medium text-[#4f4f4f]">{x.quantity} × {xp != null ? money(xp, cur) : T.noPrice}</div><div className="text-[17px] font-semibold text-gray-900">{xp != null ? money(xp * x.quantity, cur) : ''}</div></div>}
                        <div className="flex items-center gap-2 self-start sm:self-end">
                          <button type="button" onClick={() => { setActive(i); setStage('config'); window.scrollTo({ top: 0 }) }}
                            className="h-9 px-3.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:border-gray-400 transition-colors">{isDone(x) ? T.editWindow : T.finishWindow}</button>
                          {items.length > 1 && <button type="button" onClick={() => setAskRemove(i)} title={T.remove} aria-label={`${T.remove} ${T.position} ${i + 1}`}
                            className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-[#5f5f5f] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </div>
                    </div>
                  })}
                </div>
                <button type="button" onClick={() => { addItem(false); setStage('config'); window.scrollTo({ top: 0 }) }}
                  className="mt-1 mb-5 w-full h-12 rounded-xl border border-dashed border-gray-300 text-[15px] font-semibold text-gray-900 flex items-center justify-center gap-2 hover:border-gray-500 transition-colors"><Plus className="w-4 h-4" strokeWidth={2.5} />{T.addAnother}</button>
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
                <button onClick={() => setStage('review')} className="flex items-center gap-1.5 text-sm font-medium text-[#4f4f4f] hover:text-gray-900 mb-4 transition-colors"><ArrowLeft className="w-4 h-4" />{T.backToReview}</button>
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
          <aside className="lg:sticky lg:top-[100px] space-y-3">
            {stage === 'config' && <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-center py-2 overflow-hidden">
                {roofSel ? <RoofWindowDrawing size={200} opening={roofModel?.opening} />
                  : spec ? <SpecDrawing spec={spec} width={it.width ?? 0} height={it.height ?? 0} size={220} showDims={dimsOn(it)} frameColor={look.frame} extras={look.extras} plain={drawPlain} />
                  : type && <WindowDrawing template={type.template} width={it.width ?? 0} height={it.height ?? 0} hinge={it.hinge} size={220} showDims={dimsOn(it)} />}
              </div>
              {!sizeOk(it) && <p className="text-[13px] text-red-600 text-center mt-1">{T.invalidSize}</p>}
              {(() => {
                // this position only: the window, its sub-positions, the price of one piece and of the position
                const sp = split(it)
                const txt = (v: number | null) => v == null ? T.noPrice : show ? money(v, cur) : showRange ? priceRange(v) : '—'
                const priced = show || showRange
                return <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="text-sm font-semibold text-gray-900">{T.position} {active + 1}{it.label ? ` · ${it.label}` : ''}</div>
                  {priced && <div className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-[#4f4f4f]">{T.windowAlone}</span><span className="font-medium text-gray-900 tabular-nums">{txt(sp.unitPrice)}</span></div>
                    {sp.subs.map(sb => <div key={sb.code} className="flex justify-between gap-3"><span className="text-[#4f4f4f] min-w-0 truncate">{sb.title}</span><span className="font-medium text-gray-900 tabular-nums">{txt(sb.unitPrice)}</span></div>)}
                    {sp.subs.length > 0 && <div className="flex justify-between gap-3 border-t border-gray-100 pt-1.5"><span className="text-[#4f4f4f]">{T.unit}</span><span className="font-medium text-gray-900 tabular-nums">{txt(p)}</span></div>}
                    <div className="flex justify-between gap-3"><span className="text-[#4f4f4f]">{T.qty}</span><span className="font-medium text-gray-900 tabular-nums">× {it.quantity}</span></div>
                  </div>}
                  <div className="flex items-baseline justify-between gap-3 mt-3 pt-3 border-t border-gray-200">
                    <span className="text-[15px] font-semibold text-gray-900">{T.positionPrice}</span>
                    <span className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{priced ? txt(p != null ? p * it.quantity : null) : '—'}</span>
                  </div>
                  <p className="text-[13px] text-[#4f4f4f] mt-1">{priced ? T.positionNote : hiddenPriceText}</p>
                </div>
              })()}
            </div>}

            <div className={cn('bg-white border border-gray-200 rounded-xl p-5', !internal && stage === 'config' && 'hidden')}>
              <div className={cn('text-base font-semibold text-gray-900', internal || stage !== 'config' ? 'mb-2' : '')}>{internal ? T.inQuote : T.summary}</div>
              {!internal && stage === 'config' && <p className="text-[13px] leading-5 text-[#4f4f4f] mt-1 mb-4">{T.yourOrderHint}</p>}
              <ul className={cn('divide-y divide-gray-100', internal ? 'xl:hidden' : 'hidden')}>
                {items.map((x, i) => {
                  const t = data.types.find(tt => tt.id === x.type_id)
                  const xp = priceOf(x)
                  return <li key={x.key}>
                    <button onClick={() => { setActive(i); setStage('config') }} className="w-full flex items-center gap-3 py-2 text-left">
                      <div className="w-10 flex justify-center shrink-0">{x.roof ? <RoofWindowDrawing size={36} /> : x.spec ? <SpecDrawing spec={x.spec} width={x.width ?? 0} height={x.height ?? 0} size={36} /> : t && <WindowDrawing template={t.template} width={x.width ?? 0} height={x.height ?? 0} hinge={x.hinge} size={36} />}</div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm font-medium truncate', i === active && stage === 'config' ? 'text-gray-900' : 'text-[#4f4f4f]')}>{x.quantity} × {x.roof ? (() => { const m = roofCat?.models.find(mm => mm.id === x.roof!.model); const v = m?.variants?.find(vv => vv.id === x.roof!.variant); return `${T.roofWindow} · ${[m?.brand, m?.name].filter(Boolean).join(' ')}${v ? ` · ${v.name}` : ''}` })() : x.spec ? specName(x.spec) : t?.name}</div>
                        <div className="text-[13px] text-[#4f4f4f]">{x.roof ? `${(x.width ?? 0) / 10} × ${(x.height ?? 0) / 10} cm` : `${x.width} × ${x.height} mm`}{x.label ? ` · ${x.label}` : ''}</div>
                      </div>
                      {show && <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{xp != null ? money(xp * x.quantity, cur) : '—'}</div>}
                    </button>
                  </li>
                })}
              </ul>
              {!internal && serviceRows.length > 0 && <ul className="border-t border-gray-100 pt-2 space-y-1">
                <li className="text-[13px] font-medium text-[#4f4f4f]">{T.servicesTitle}</li>
                {serviceRows.map(r => <li key={r.option.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-gray-900 min-w-0 truncate">{r.option.name} <span className="text-[13px] text-[#4f4f4f]">{Number(r.option.price_piece ?? 0) > 0 || (r.option.per_item && r.option.per_item !== 'window') ? `${r.qty.toLocaleString('de-DE')} ${L.unitShort.piece}` : r.option.pricing === 'flat' || r.option.pricing === 'percent' ? '' : `${r.qty.toLocaleString('de-DE')} ${L.unitShort[r.option.pricing]}`}</span></span>
                  {show && <span className="font-medium text-gray-900 whitespace-nowrap">{money(r.total, cur)}</span>}
                </li>)}
              </ul>}
              {show ? <div className="border-t border-gray-200 mt-3 pt-3 space-y-1.5 text-sm">
                <Row l={T.total} r={money(totals.net, cur)} />
                {totals.vatRate > 0 && <Row l={`${T.vat} ${totals.vatRate.toLocaleString('de-DE')}%`} r={money(totals.vat, cur)} muted />}
                <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200">
                  <span className="text-[15px] font-semibold text-gray-900">{T.gross}</span>
                  <span className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money(totals.gross, cur)}</span>
                </div>
                {!internal && <p className="text-[13px] leading-5 text-[#4f4f4f] pt-1.5">{T.estimate}</p>}
              </div> : showRange ? <div className="border-t border-gray-200 mt-3 pt-3">
                <div className="text-[15px] font-semibold text-gray-900">{T.rangeTitle}</div>
                <div className="text-[22px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums mt-1">{priceRange(totals.gross)}</div>
                <p className="text-[13px] leading-5 text-[#4f4f4f] pt-1.5">{T.rangeNote}</p>
              </div> : <p className="text-[13px] text-[#4f4f4f] border-t border-gray-200 mt-3 pt-3">{hiddenPriceText}</p>}

              {internal ? (
                <div className="mt-4 flex gap-2">
                  {onCancel && <button type="button" onClick={onCancel} className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:border-gray-400 transition-colors">{T.cancel}</button>}
                  <button type="button" disabled={!items.every(sizeOk)} onClick={handBack}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{addLabel ?? T.addToQuote}</button>
                </div>
              ) : stage === 'config' ? (<>
                <button disabled={!canFinish} onClick={finish}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{finishLabel}</button>
                <p className="text-[13px] text-[#8a8a8a] mt-2 text-center">{finishNote}</p>
              </>
              ) : stage === 'review' ? (<>
                <button disabled={!canFinish} onClick={() => { setStage('contact'); window.scrollTo({ top: 0 }) }}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{finishLabel}</button>
                {!canFinish && <p className="text-[13px] text-[#8a8a8a] mt-2 text-center">{finishNote}</p>}
              </>
              ) : (
                (() => {
                  const blocked = sending || !consent || !heard || !contact.email || !(contact.first_name || contact.last_name) || (contact.customer_type === 'company' && !contact.company_name.trim()) || !contact.street.trim() || !contact.postal_code.trim() || !contact.city.trim()
                  const primary = (label: string, pdf: boolean) => <button disabled={blocked} onClick={() => submit(pdf)}
                    className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2" style={btn}>
                    {sending && <Loader2 className="w-4 h-4 animate-spin" />}{sending ? T.sending : label}
                  </button>
                  if (endMode === 'enquiry' || !calc) return primary(T.send, false)
                  if (endMode === 'pdf') return primary(T.getOffer, true)
                  return <>
                    {primary(T.getOfferPdf, true)}
                    <button disabled={blocked} onClick={() => submit(false)}
                      className="mt-2 w-full h-11 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-900 disabled:opacity-40 hover:border-gray-400 transition-colors">{T.orEnquiry}</button>
                  </>
                })()
              )}
            </div>
          </aside>
        </div>
      )}

      {askRemove != null && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setAskRemove(null)}>
        <div role="dialog" aria-modal="true" className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5" onClick={e => e.stopPropagation()}>
          <div className="text-[17px] font-semibold text-gray-900">{T.removeAsk(askRemove + 1)}</div>
          <p className="text-sm font-medium text-[#4f4f4f] mt-1">{T.removeHint}</p>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setAskRemove(null)} className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-900 hover:border-gray-400">{T.cancel}</button>
            <button type="button" autoFocus onClick={() => { removeItem(askRemove); setAskRemove(null) }} className="h-10 px-4 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700">{T.remove}</button>
          </div>
        </div>
      </div>}

      {/* phones: the price stays in sight while configuring (the summary is far down under the steps) */}
      {!internal && stage === 'config' && <>
        <div className="lg:hidden h-20" />
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-[#4f4f4f]">{T.gross}</div>
            <div className="text-lg font-bold text-gray-900 tabular-nums">{show ? money(totals.gross, cur) : showRange ? priceRange(totals.gross) : '—'}</div>
          </div>
          {(items.length > 1 || isDone(it)) && <button onClick={finish}
            className="h-11 px-5 rounded-lg text-sm font-semibold text-white" style={btn}>{T.toEnquiry(items.length)}</button>}
        </div>
      </>}
    </div>
  )
}

export type PriceMode = 'live' | 'end' | 'range' | 'never'
export type EndMode = 'enquiry' | 'pdf' | 'choose'

/** colours of a shutter / blind and its box; the first follows the frame */
const SHADE_COLORS: { key: string | null; sl: string; en: string; hex: string | null }[] = [
  { key: null, sl: 'Enako kot okvir', en: 'Same as the frame', hex: null },
  { key: 'white', sl: 'Bela', en: 'White', hex: '#f4f4f2' },
  { key: 'silver', sl: 'Srebrna', en: 'Silver', hex: '#c3c6c8' },
  { key: 'anthracite', sl: 'Antracit', en: 'Anthracite', hex: '#383e42' },
  { key: 'brown', sl: 'Rjava', en: 'Brown', hex: '#5a3e2b' },
]
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
      <span className="px-3 text-sm text-[#4f4f4f]">mm</span>
    </div>
    <span className={cn('text-[13px]', bad ? 'text-red-600' : 'text-[#4f4f4f]')}>{rangeLabel} {min}–{max} mm</span>
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
  return <div className={cn('flex justify-between font-medium', bold ? 'text-[15px] font-semibold text-gray-900' : muted ? 'text-[#4f4f4f]' : 'text-gray-900')}><span>{l}</span><span>{r}</span></div>
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
        {o.name}{price(o) && <span className="ml-1.5 font-medium text-[#4f4f4f]">{price(o)}</span>}
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
