import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { THEME_FONTS } from '../lib/configuratorTheme'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Check, Loader2, Phone, Mail, ArrowLeft, FileText, EyeOff, Ban, Pencil, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import WindowDrawing from '../components/WindowDrawing'
import ProfileSection from '../components/ProfileSection'
import ColorSwatch from '../components/ColorSwatch'
import { parseColor } from '../lib/colors'
import { shadeColorsOf, shadeColorOf, shadeColorName, type ShadeColor } from '../lib/shadeColors'
import SpecDrawing from '../components/SpecDrawing'
import RoofWindowDrawing from '../components/RoofWindowDrawing'
import type { RoofCatalog } from '../lib/costing'
import GlassIcon from '../components/GlassIcon'
import HandleIcon from '../components/HandleIcon'
import SillIcon, { sillMaterialOf } from '../components/SillIcon'
import ShadingIcon from '../components/ShadingIcon'
import {
  costWindow, specToLayout, makeSpec, makeSlidingSpec, reshapeSpec, allowedCombos, allowedBands, bandKeyOf, comboKey, BAND_SHAPE, bandModeOf, sameField, pricingFrom, allowedVariants, applyVariant, specVariantKey, makeDoorSpec, makeWallSpec, type BuilderKind, type Variant, roofUnitPrice, productGroupOf, profileServes, colorPctOf, type ColorCatalog,
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
    logo_size?: 's' | 'm' | 'l' | null; theme?: Record<string, string> | null }
  systems: WindowSystem[]
  types: WindowType[]
  prices: WindowPrice[]
  combos: { system_id: string; type_id: string }[]
  options: WindowOption[]
  /** windows built from sashes (null when the supplier did not set it up) */
  builder?: { offer: Offer; pricing: PricingSettings | null; roof?: RoofCatalog | null; colors?: ColorCatalog | null; glass?: GlassType[] | null; handles?: HandleType[] | null; sills?: SillType[] | null; shading?: ShadingType[] | null; shade_colors?: ShadeColor[] | null } | null
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

const INTERNAL_TXT = {
  sl: {
    stepProduct: 'Izberite tip izdelka', stepProductHint: 'Izberite vrsto izdelka za ponudbo.', stepSashes: 'Izberite število kril', stepDoorSashes: 'Izberite število kril', stepParts: 'Izberite število delov', stepRoof: 'Izberite model strešnega okna',
    stepSizeWindow: 'Vnesite mere okna', stepSizeDoor: 'Vnesite mere balkonskih vrat', stepSizeWall: 'Vnesite mere drsne stene',
    cBands: 'Izberite izvedbo', cBandsEnd: '', cOpening: 'Izberite način odpiranja kril', cMaterial: 'Izberite material okvirja', cColorOut: 'Izberite barvo okvirja zunaj', cColorIn: 'Izberite barvo okvirja znotraj',
    cHandle: 'Izberite kljuko', cSillOut: 'Zunanja polica', cSillIn: 'Notranja polica', cShading: 'Senčila in komarniki', cExtras: 'Dodatna oprema', cServices: 'Storitve',
  },
  en: {
    stepProduct: 'Choose the product type', stepProductHint: 'Choose the type of product for the quote.', stepSashes: 'Choose the number of sashes', stepDoorSashes: 'Choose the number of sashes', stepParts: 'Choose the number of panels', stepRoof: 'Choose the roof window model',
    stepSizeWindow: 'Enter the window size', stepSizeDoor: 'Enter the balcony door size', stepSizeWall: 'Enter the sliding wall size',
    cBands: 'Choose the version', cBandsEnd: '', cOpening: 'Choose how the sashes open', cMaterial: 'Choose the frame material', cColorOut: 'Choose the frame colour outside', cColorIn: 'Choose the frame colour inside',
    cHandle: 'Choose the handle', cSillOut: 'Outside sill', cSillIn: 'Inside sill', cShading: 'Shading and insect screens', cExtras: 'Extra equipment', cServices: 'Services',
  },
}

const TXT = {
  sl: {
    title: 'Konfigurator oken', notFound: 'Konfigurator ni na voljo.', notFoundHint: 'Ponudnik konfiguratorja še ni objavil.',
    notIncluded: 'Ni vključena', includedTitle: 'Vključeno', windowsTotal: 'Okna skupaj', quoteWindows: 'Okna v ponudbi', quoteWindowsHint: 'Okna te ponudbe. Kliknite na okno za urejanje, dodajte novo ali ga odstranite.', qtyTitle: 'Količina', sizeTitle: 'Mere', forWindow: 'za okno', forDoor: 'za balkonska vrata', forWall: 'za drsno steno', forRoof: 'za strešno okno', ofWindow: 'vašega okna', ofDoor: 'vaših balkonskih vrat', ofWall: 'vaše drsne stene', ofRoof: 'vašega strešnega okna', cBands: 'Kakšna naj bo izvedba', cBandsEnd: '?', cProfile: 'Izberite profilni sistem', cGlass: 'Izberite steklo', cOpening: 'Kako naj se odpirajo krila?', cMaterial: 'Iz katerega materiala naj bo okvir?', cColorOut: 'V kateri barvi naj bo okvir zunaj?', cColorIn: 'V kateri barvi naj bo okvir znotraj?', cHandle: 'Katero kljuko želite?', cSillOut: 'Ali želite zunanjo polico?', cSillIn: 'Ali želite notranjo polico?', cShading: 'Ali želite senčila ali komarnik?', cExtras: 'Ali želite še kakšno dodatno opremo?', cServices: 'Katere storitve potrebujete?', stepSizeWindow: 'Vpišite mere vašega okna', stepSizeDoor: 'Vpišite mere vaših balkonskih vrat', stepSizeWall: 'Vpišite mere vaše drsne stene', roofWindow: 'Strešno okno', roofModelTitle: 'Model strešnega okna', roofVariant: 'Material in barva', roofDatasheet: 'Tehnični list (PDF)', roofSize: 'Mera', roofFlashing: 'Obroba za kritino', roofCenter: 'Vrtljivo', roofTop: 'Zgornje vrtišče', from: 'od',
    nSash: (n: number) => n === 1 ? 'Enokrilno okno' : n === 2 ? 'Dvokrilno okno' : n === 3 ? 'Trokrilno okno' : 'Štirikrilno okno', slidingWindow: 'Drsno okno', sillTitle: 'Police', shadeTitle: 'Senčila in komarniki', shadeColor: 'Barva senčila in omarice', shadeColorHint: 'Brez doplačila. Končno barvo potrdimo pri izmeri.', shadeLabel: 'Senčilo', screenLabel: 'Komarnik', noShade: 'Brez senčila', noShadeDesc: 'Okno ostane brez senčila.', noScreenDesc: 'Okno ostane brez komarnika.', noSillDesc: 'Okno ostane brez police.', noScreen: 'Brez komarnika', sillIn: 'Notranja polica', sillOut: 'Zunanja polica', noSill: 'Brez police', glassTitle: 'Steklo', handleTitle: 'Kljuka', lockable: 'Zaklepanje s ključem', included: 'Vključeno', layers: (n: number) => n === 3 ? 'troslojno' : n === 2 ? 'dvoslojno' : `${n}-slojno`, colorTitle: 'Barva', colorOut: 'Zunaj', colorIn: 'Znotraj', nWall: (n: number) => `${n === 2 ? 'Dvodelna' : n === 3 ? 'Tridelna' : 'Štiridelna'} drsna stena`, nDoor: (n: number) => n === 1 ? 'Enokrilna balkonska vrata' : n === 2 ? 'Dvokrilna balkonska vrata' : 'Trokrilna balkonska vrata',
    bandsTitle: 'Nadsvetloba / ločen spodnji del', band: { none: 'Brez', top: 'Z nadsvetlobo', topSplit: 'Z nadsvetlobo, deljeno po krilih', bottom: 'Z ločenim spodnjim delom', bottomSplit: 'Z ločenim spodnjim delom, deljenim po krilih' } as Record<string, string>,
    openTitle: 'Odpiranje', openHint: 'Izberite, kako se odpira vsako krilo. Cena je razlika do najcenejše izvedbe.', topLight: 'Nadsvetloba', bottomPanel: 'Ločen spodnji del', bandFixed: 'Fiksna', bandTilt: 'Na kip', topHeight: 'Višina nadsvetlobe', bottomHeight: 'Višina ločenega spodnjega dela',
    preset: { all_open: 'Vse odpiranje in kip', one_open: 'Eno krilo na odpiranje', outer_open: 'Zunanji krili na odpiranje', all_fixed: 'Vse fiksno' } as Record<string, string>,
    step1: 'Tip okna', step2: 'Profilni sistem', step3: 'Mere in odpiranje', step4: 'Oprema', step5: 'Storitve',
    stepProduct: 'Kaj želite kupiti?', stepProductHint: 'Izberite vrsto izdelka, ki ga želite kupiti.',
    hSashes: 'Krilo je del okna ali vrat, ki se odpira.', hParts: 'Iz koliko delov naj bo drsna stena?', hRoof: 'Izberite model strešnega okna, material in mero.',
    hSize: 'Natančna izmera bo opravljena pred izdelavo, zato lahko vnesete približne mere.', hQty: 'Koliko enakih strešnih oken potrebujete?',
    hBands: 'Ali ima okno nad krili (nadsvetloba) ali pod njimi še poseben del?', hMaterial: 'Iz katerega materiala naj bo okvir okna?',
    hProfile: 'Profil določa toplotno izolacijo in videz okvirja. Cena se ob vsakem profilu spremeni.', hColor: 'Barva okvirja zunaj in znotraj. Lahko sta različni.', colorOutTitle: 'Barva okvirja zunaj', colorInTitle: 'Barva okvirja znotraj',
    hColorOut: 'Barva, ki jo vidite s ceste (zunanja stran okna).', hColorIn: 'Barva, ki jo vidite v prostoru (notranja stran okna). Lahko je drugačna kot zunaj.',
    hSillOut: 'Polica na zunanji strani okna, pod oknom na fasadi. Lahko je brez.', hSillIn: 'Polica na notranji strani okna, v prostoru. Lahko je brez.', naturalWood: 'Naravna barva lesa',
    hGlass: 'Več slojev stekla pomeni boljšo toplotno izolacijo (nižji Ug). Prvo steklo je vključeno v ceno.', hHandle: 'Izberite kljuko. Standardna je vključena v ceno.',
    hSills: 'Po želji dodajte notranjo in zunanjo polico.', hShading: 'Po želji dodajte roleto, žaluzije ali komarnik.', hExtras: 'Dodatna oprema po želji.',
    pricesAfterSize: 'Ceno vidite, ko vpišete mere.', stepSashes: 'Koliko kril naj ima vaše okno?', stepDoorSashes: 'Koliko kril naj imajo vaša balkonska vrata?', stepParts: 'Iz koliko delov naj bo vaša drsna stena?', stepRoof: 'Kateri model strešnega okna želite?', stepSize: 'Mere in odpiranje', stepLayout: 'Postavitev in odpiranje', stepBands: 'Izvedba', extrasTitle: 'Dodatna oprema', stepOpening: 'Tip odpiranja', stepMaterial: 'Material', profilesN: (n: number) => `${n} ${n === 1 ? 'profil' : n === 2 ? 'profila' : n < 5 ? 'profili' : 'profilov'}`, stepNext: 'Naprej', stepOf: (i: number, n: number) => `Korak ${i} od ${n}`, editing: 'Urejate', stepDone: 'Končano', stepEdit: 'Uredi', stdEquip: 'Standardna oprema',
    grpWindows: 'Okna', grpSliding: 'Drsna okna', grpDoors: 'Balkonska vrata', grpWalls: 'Drsne stene', grpRoof: 'Strešna okna', servicesHint: 'Izbrane storitve bodo dodane vsem oknom v povpraševanju.', servicesTitle: 'Storitve', roofServices: 'Strešna okna',
    width: 'Širina', height: 'Višina', range: 'dovoljeno', hinge: 'Stran nasadil (gledano od znotraj)', qty: 'Količina', label: 'Prostor (neobvezno)', labelPh: 'npr. dnevna soba',
    none: 'Brez', yourOrder: 'Vaše povpraševanje', inQuote: 'Okna za ponudbo', position: 'Pozicija', addWindow: 'Dodaj okno', duplicate: 'Podvoji', remove: 'Odstrani', removeAsk: (n: number) => `Odstranim pozicijo ${n}?`, removeHint: 'Okno in vse njegove izbire bodo odstranjeni iz povpraševanja.',
    unit: 'cena/kos', total: 'Skupaj brez DDV', vat: 'DDV', gross: 'Skupaj z DDV', estimate: 'Okvirna cena. Končno ponudbo pripravimo po izmeri na terenu.',
    basePrice: 'Osnovna cena', noPrice: 'Cena po izmeri', pricesHidden: 'Ceno prejmete v ponudbi na e-mail.', pricesAtEnd: 'Ceno boste videli na koncu, ko vpišete svoje podatke.', rangeTitle: 'Okvirna cena z DDV', rangeNote: 'Okvirni razpon. Natančno ceno pripravimo po izmeri na terenu.',
    getOffer: 'Prenesi ponudbo', getOfferPdf: 'Prenesi ponudbo (PDF)', orEnquiry: 'Ali samo pošljite povpraševanje',
    pdfDoneTitle: 'Vaša ponudba je prenesena', pdfDoneText: 'Informativna ponudba se je prenesla na vašo napravo. Ponudnik je o tem obveščen in vas bo po potrebi kontaktiral.', quoteNoLabel: 'Številka ponudbe', pdfAgain: 'Prenesi ponudbo znova', yourTotal: 'Skupaj z DDV',
    pdfNote: 'Informativna ponudba, izračunana v spletnem konfiguratorju. Končno ponudbo pripravimo po izmeri na terenu.', pdfTaken: 'Stranka je prenesla informativno ponudbo (PDF).',
    next: 'Nadaljuj na podatke', back: 'Nazaj na okna', send: 'Pošlji povpraševanje', sending: 'Pošiljam …',
    contact: 'Vaši podatki', person: 'Fizična oseba', company: 'Podjetje', companyName: 'Naziv podjetja', vatNo: 'ID za DDV', contactPersonHint: 'Kontaktna oseba', firstName: 'Ime', lastName: 'Priimek', email: 'E-pošta', phone: 'Telefon', address: 'Naslov montaže', street: 'Ulica in hišna številka', postal: 'Poštna številka', city: 'Kraj', country: 'Država', postalPick: 'Vpišite številko ali kraj', outOfArea: 'Na tem naslovu montaže ne izvajamo. Povpraševanje lahko pošljete brez montaže.', note: 'Opomba',
    consent: 'Strinjam se, da ponudnik moje podatke uporabi za pripravo ponudbe.',
    doneTitle: 'Hvala, povpraševanje je oddano!', doneText: 'Ponudnik bo pripravil ponudbo in vas kontaktiral.', enquiryNoLabel: 'Številka povpraševanja',
    startOver: 'Začni znova', startOverConfirm: 'Vsa okna v povpraševanju bodo izbrisana. Želite začeti znova?', newOne: 'Novo povpraševanje', invalidSize: 'Mere so izven dovoljenega razpona', pcs: 'kos',
    errors: { invalid_email: 'Vnesite veljaven e-poštni naslov.', name_required: 'Vnesite ime in priimek.', company_required: 'Vnesite naziv podjetja.', address_required: 'Vnesite celoten naslov montaže.', rate_limited: 'Preveč povpraševanj v kratkem času. Poskusite kasneje.', size_out_of_range: 'Nekatere mere so izven dovoljenega razpona.' } as Record<string, string>,
    genericError: 'Pošiljanje ni uspelo. Poskusite znova.',
    addToQuote: 'Dodaj v ponudbo', cancel: 'Prekliči', room: 'Prostor', roofOpeningLabel: 'Odpiranje',
    heard: 'Kje ste izvedeli za nas?', heardPick: 'Izberite',
    reviewTitle: 'Pregled povpraševanja', reviewHint: 'Okna lahko uredite ali odstranite, dodate novo okno ali nadaljujete na vpis podatkov.', addToEnquiry: 'Dodaj v povpraševanje', backToEnquiry: 'Nazaj na povpraševanje', summary: 'Povzetek', saveChanges: 'Shrani spremembe', addAnother: 'Dodaj še eno okno', notFinished: 'Ni dokončano', finishWindow: 'Dokončaj', toEnquiry: (n: number) => `Vaše povpraševanje (${n})`, toReview: 'Naprej na pregled', toContact: 'Naprej na vaše podatke', yourOrderHint: 'Spodaj so prikazana okna, ki ste jih izbrali. Kliknite na posamezno okno za urejanje.', finishHint: 'Pregledate okna in vpišete svoje podatke.', finishHintEnquiry: 'V zadnjem koraku pošljete povpraševanje.', finishHintOffer: 'V zadnjem koraku prenesete ponudbo.', finishHintChoose: 'V zadnjem koraku prenesete ponudbo ali pošljete povpraševanje.', finishOpen: (n: number) => `Najprej izberite vse korake za pozicijo ${n}.`, toPosition: (n: number) => `Naprej na pozicijo ${n}`, editWindow: 'Uredi', backToReview: 'Nazaj na pregled',
    sashWidths: 'Širina kril', sashN: (n: number) => `Krilo ${n}`, sashRest: 'izračuna se samo', sashTooNarrow: 'Krilo mora biti široko vsaj 300 mm.', sashEqual: 'Enako široka krila',
    subKind: 'Vrsta', subLength: 'Dolžina', subSize: 'Mere', subDesc: 'Opis', offerPreview: 'Predogled ponudbe', offerPreviewHint: 'Pozicije se dodajajo sproti, ko izbirate.', windowAlone: 'Okno', positionPrice: 'Cena pozicije', positionNote: 'Cena tega okna z izbrano opremo, brez storitev.', servicesForAll: 'za vsa okna',
  },
  en: {
    title: 'Window configurator', notFound: 'Configurator not available.', notFoundHint: 'The supplier has not published the configurator yet.',
    notIncluded: 'Not included', includedTitle: 'Included', windowsTotal: 'Windows total', quoteWindows: 'Windows in the quote', quoteWindowsHint: 'The windows of this quote. Click a window to edit it, add a new one or remove it.', qtyTitle: 'Quantity', sizeTitle: 'Size', forWindow: 'for the window', forDoor: 'for the balcony door', forWall: 'for the sliding wall', forRoof: 'for the roof window', ofWindow: 'your window', ofDoor: 'your balcony door', ofWall: 'your sliding wall', ofRoof: 'your roof window', cBands: 'What version of', cBandsEnd: ' would you like?', cProfile: 'Choose the profile system of', cGlass: 'Choose the glass of', cOpening: 'How should the sashes open?', cMaterial: 'What material should the frame be?', cColorOut: 'What colour should the frame be outside?', cColorIn: 'What colour should the frame be inside?', cHandle: 'Which handle would you like?', cSillOut: 'Would you like an outside sill?', cSillIn: 'Would you like an inside sill?', cShading: 'Would you like shading or an insect screen?', cExtras: 'Would you like any extra equipment?', cServices: 'Which services do you need?', stepSizeWindow: 'Enter the size of your window', stepSizeDoor: 'Enter the size of your balcony door', stepSizeWall: 'Enter the size of your sliding wall', roofWindow: 'Roof window', roofModelTitle: 'Roof window model', roofVariant: 'Material and colour', roofDatasheet: 'Technical sheet (PDF)', roofSize: 'Size', roofFlashing: 'Roof flashing', roofCenter: 'Centre pivot', roofTop: 'Top hung', from: 'from',
    nSash: (n: number) => n === 1 ? 'Single sash' : n === 2 ? 'Double sash' : n === 3 ? 'Triple sash' : 'Four sashes', slidingWindow: 'Sliding window', sillTitle: 'Window sills', shadeTitle: 'Shading and insect screens', shadeColor: 'Colour of the shading and its box', shadeColorHint: 'No extra charge. We confirm the colour when measuring.', shadeLabel: 'Shading', screenLabel: 'Insect screen', noShade: 'No shading', noShadeDesc: 'The window stays without shading.', noScreenDesc: 'The window stays without an insect screen.', noSillDesc: 'The window stays without a sill.', noScreen: 'No insect screen', sillIn: 'Inside sill', sillOut: 'Outside sill', noSill: 'No sill', glassTitle: 'Glass', handleTitle: 'Handle', lockable: 'Locks with a key', included: 'Included', layers: (n: number) => n === 3 ? 'triple glazed' : n === 2 ? 'double glazed' : `${n} panes`, colorTitle: 'Colour', colorOut: 'Outside', colorIn: 'Inside', nWall: (n: number) => `${n}-panel sliding wall`, nDoor: (n: number) => n === 1 ? 'Single balcony door' : n === 2 ? 'Double balcony door' : 'Triple balcony door',
    bandsTitle: 'Top light / bottom panel', band: { none: 'None', top: 'With top light', topSplit: 'With split top light', bottom: 'With bottom panel', bottomSplit: 'With split bottom panel' } as Record<string, string>,
    openTitle: 'Opening', openHint: 'Choose how each sash opens. The price is the difference to the cheapest one.', topLight: 'Top light', bottomPanel: 'Bottom panel', bandFixed: 'Fixed', bandTilt: 'Tilt', topHeight: 'Top light height', bottomHeight: 'Bottom panel height',
    preset: { all_open: 'All tilt & turn', one_open: 'One opening sash', outer_open: 'Outer sashes open', all_fixed: 'All fixed' } as Record<string, string>,
    step1: 'Window type', step2: 'Profile system', step3: 'Size and opening', step4: 'Equipment', step5: 'Services',
    stepProduct: 'What would you like to buy?', stepProductHint: 'Choose the type of product you would like to buy.',
    hSashes: 'A sash is the part of the window or door that opens.', hParts: 'How many panels should the sliding wall have?', hRoof: 'Choose the roof window model, material and size.',
    hSize: 'We measure exactly before production, so sizes can be approximate.', hQty: 'How many identical roof windows do you need?',
    hBands: 'Does the window have a part above (top light) or below the sashes?', hMaterial: 'Which material should the frame be made of?',
    hProfile: 'The profile sets the insulation and the look of the frame. The price changes with each profile.', hColor: 'Frame colour outside and inside. They can differ.', colorOutTitle: 'Frame colour outside', colorInTitle: 'Frame colour inside',
    hColorOut: 'The colour you see from the street (outside of the window).', hColorIn: 'The colour you see in the room (inside of the window). It can differ from the outside.',
    hSillOut: 'The sill on the outside, under the window on the facade. Can be left out.', hSillIn: 'The sill on the inside, in the room. Can be left out.', naturalWood: 'Natural wood',
    hGlass: 'More panes mean better insulation (lower Ug). The first glass is included in the price.', hHandle: 'Choose the handle. The standard one is included.',
    hSills: 'Add an inside and outside sill if you like.', hShading: 'Add a shutter, blinds or an insect screen if you like.', hExtras: 'Extra equipment if you like.',
    pricesAfterSize: 'You see the price once you enter the sizes.', stepSashes: 'How many sashes should your window have?', stepDoorSashes: 'How many sashes should your balcony door have?', stepParts: 'How many panels should your sliding wall have?', stepRoof: 'Which roof window model would you like?', stepSize: 'Size and opening', stepLayout: 'Layout and opening', stepBands: 'Version', extrasTitle: 'Other extras', stepOpening: 'Opening type', stepMaterial: 'Material', profilesN: (n: number) => `${n} ${n === 1 ? 'profile' : 'profiles'}`, stepNext: 'Next', stepOf: (i: number, n: number) => `Step ${i} of ${n}`, editing: 'Editing', stepDone: 'Done', stepEdit: 'Edit', stdEquip: 'Standard equipment',
    grpWindows: 'Windows', grpSliding: 'Sliding windows', grpDoors: 'Balcony doors', grpWalls: 'Sliding walls', grpRoof: 'Roof windows', servicesHint: 'The chosen services will be selected on all windows in the enquiry.', servicesTitle: 'Services', roofServices: 'Roof windows',
    width: 'Width', height: 'Height', range: 'allowed', hinge: 'Hinge side (seen from inside)', qty: 'Quantity', label: 'Room (optional)', labelPh: 'e.g. living room',
    none: 'None', yourOrder: 'Your enquiry', inQuote: 'Windows for the quote', position: 'Position', addWindow: 'Add window', duplicate: 'Duplicate', remove: 'Remove', removeAsk: (n: number) => `Remove position ${n}?`, removeHint: 'The window and all its choices will be removed from the enquiry.',
    unit: 'price/pc', total: 'Total excl. VAT', vat: 'VAT', gross: 'Total incl. VAT', estimate: 'Estimated price. The final quote follows an on-site measurement.',
    basePrice: 'Base price', noPrice: 'Price after measurement', pricesHidden: 'You will receive the price in the quote by e-mail.', pricesAtEnd: 'You will see the price at the end, after entering your details.', rangeTitle: 'Estimated price incl. VAT', rangeNote: 'An estimated range. We prepare the exact price after measuring on site.',
    getOffer: 'Download the quote', getOfferPdf: 'Download the quote (PDF)', orEnquiry: 'Or just send an enquiry',
    pdfDoneTitle: 'Your quote has been downloaded', pdfDoneText: 'The informative quote was downloaded to your device. The supplier has been notified and will contact you if needed.', quoteNoLabel: 'Quote number', pdfAgain: 'Download the quote again', yourTotal: 'Total incl. VAT',
    pdfNote: 'Informative quote, calculated in the online configurator. We prepare the final quote after measuring on site.', pdfTaken: 'The customer downloaded the informative quote (PDF).',
    next: 'Continue to details', back: 'Back to windows', send: 'Send enquiry', sending: 'Sending …',
    contact: 'Your details', person: 'Private person', company: 'Company', companyName: 'Company name', vatNo: 'VAT number', contactPersonHint: 'Contact person', firstName: 'First name', lastName: 'Last name', email: 'E-mail', phone: 'Phone', address: 'Installation address', street: 'Street and house number', postal: 'Postal code', city: 'Town', country: 'Country', postalPick: 'Type the code or the town', outOfArea: 'We do not install at this address. You can still send the enquiry without installation.', note: 'Note',
    consent: 'I agree that the supplier uses my data to prepare a quote.',
    doneTitle: 'Thank you, your enquiry was sent!', doneText: 'The supplier will prepare a quote and contact you.', enquiryNoLabel: 'Enquiry number',
    startOver: 'Start over', startOverConfirm: 'All windows in the enquiry will be deleted. Start over?', newOne: 'New enquiry', invalidSize: 'Size is outside the allowed range', pcs: 'pc',
    errors: { invalid_email: 'Enter a valid e-mail address.', name_required: 'Enter your first and last name.', company_required: 'Enter the company name.', address_required: 'Enter the full installation address.', rate_limited: 'Too many enquiries in a short time. Try again later.', size_out_of_range: 'Some sizes are outside the allowed range.' } as Record<string, string>,
    genericError: 'Sending failed. Please try again.',
    addToQuote: 'Add to quote', cancel: 'Cancel', room: 'Room', roofOpeningLabel: 'Opening',
    heard: 'How did you hear about us?', heardPick: 'Choose',
    reviewTitle: 'Review your enquiry', reviewHint: 'Edit or remove windows, add another one or continue to your details.', addToEnquiry: 'Add to enquiry', backToEnquiry: 'Back to the enquiry', summary: 'Summary', saveChanges: 'Save changes', addAnother: 'Add another window', notFinished: 'Not finished', finishWindow: 'Finish', toEnquiry: (n: number) => `Your enquiry (${n})`, toReview: 'Continue to the review', toContact: 'Continue to your details', yourOrderHint: 'Below are the windows you chose. Click a window to edit it.', finishHint: 'You check the windows and enter your details.', finishHintEnquiry: 'In the last step you send the enquiry.', finishHintOffer: 'In the last step you download the quote.', finishHintChoose: 'In the last step you download the quote or send an enquiry.', finishOpen: (n: number) => `First go through every step for position ${n}.`, toPosition: (n: number) => `On to position ${n}`, editWindow: 'Edit', backToReview: 'Back to the review',
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
    // also the keys of windows that were removed: their step progress is still in the maps, a new window must not inherit it
    const keys = [...d.items.map((x: { key: string }) => x.key), ...Object.keys(d.openMap ?? {}), ...Object.keys(d.reachedMap ?? {}), ...Object.keys(d.doneKeys ?? {})]
    for (const k of keys) { const n = Number(String(k).slice(1)); if (n > seq) seq = n }
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
  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-6 h-6 animate-spin text-[#7f7f7f]" /></div>
  if (state === 'missing' || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
      <div className="flex flex-col items-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-[#f3f3f3] flex items-center justify-center mb-4"><EyeOff className="w-6 h-6 text-[#7f7f7f]" /></div>
        <p className="text-lg font-semibold text-gray-900">{T.notFound}</p><p className="text-sm font-medium text-[#5e5e5e] mt-1">{T.notFoundHint}</p>
      </div>
    </div>
  )
  return <ConfiguratorCore data={data} slug={slug ?? ''} />
}

/** the supplier's own look as CSS variables (only what they changed; the rest stays default) */
export function themeVars(t?: Record<string, string> | null): React.CSSProperties | undefined {
  if (!t) return undefined
  const v: Record<string, string> = {}
  const font = THEME_FONTS.find(f => f.key === t.font); if (font?.stack) v['--cfg-font'] = font.stack
  for (const k of ['bg', 'button', 'ink', 'muted', 'border']) if (/^#[0-9a-f]{6}$/i.test(t[k] ?? '')) v['--cfg-' + k] = t[k]
  return v as React.CSSProperties
}

/** the supplier set up enough for a configurator (types or a builder, and at least one profile) */
export const isUsable = (d: ConfigData | null): d is ConfigData => !!d && (!!d.types.length || !!d.builder) && !!d.systems.length

/** a window as it goes onto a quote: the configuration, its price per piece and every choice in words */
/** a sill, shading or insect screen of a window, priced on its own (like a sub-position on the quote) */
export interface ConfiguredSub {
  code: string; title: string; rows: [string, string][]; unitPrice: number
  /** the supplier's photo of the sill / shading, or what to draw instead (sill material / shading kind) */
  image_url?: string | null; sill?: string | null; shade?: string | null
  /** colour of the shading (hex), drawn as a swatch on the offer */
  color?: string | null
}
export interface ConfiguredWindow { item: ConfigItem; unitPrice: number | null; title: string; rows: [string, string][]; subs?: ConfiguredSub[] }

/**
 * The configurator. mode="public": the customer's page with header, contact step and services.
 * mode="internal": inside a quote in the app — no header, no contact step, no services (the quote has its own);
 * "Dodaj v ponudbo" hands the configured windows back with their prices and choices.
 */
export function ConfiguratorCore({ data: rawData, slug = '', mode = 'public', initialItems, onAdd, onCancel, addLabel }: {
  data: ConfigData; slug?: string; mode?: 'public' | 'internal'; initialItems?: ConfigItem[]
  onAdd?: (windows: ConfiguredWindow[]) => void; onCancel?: () => void; addLabel?: string
}) {
  // the customer's page is in Slovene only (no language switch); inside the app it follows the app's language
  const { lang: appLang } = useLanguage()
  const lang = mode === 'internal' ? appLang : 'sl'
  const T = mode === 'internal' ? { ...TXT[lang], ...INTERNAL_TXT[lang] } : TXT[lang]
  // wood always has its natural colour first (no surcharge, the default); the other profiles do not
  const data = useMemo<ConfigData>(() => {
    const cat = rawData.builder?.colors
    if (!rawData.builder || !cat?.wood?.length || cat.wood.some(c => c.look === 'wood:natural')) return rawData
    const natural = { id: NATURAL_WOOD_ID, name: T.naturalWood, look: 'wood:natural', one: 0, both: 0 }
    return { ...rawData, builder: { ...rawData.builder, colors: { ...cat, wood: [natural, ...cat.wood] } } }
  }, [rawData, T])
  const L = WL[lang]
  const internal = mode === 'internal'
  // public page: what the customer had before a reload
  const [draft] = useState(() => internal || !slug ? null : loadDraft(slug))
  const [items, setItems] = useState<ConfigItem[]>(initialItems ?? draft?.items ?? [])
  const [active, setActive] = useState<number>(draft ? Math.min(draft.active ?? 0, draft.items.length - 1) : 0)
  const [stage, setStage] = useState<'config' | 'review' | 'contact' | 'done'>(draft?.stage === 'review' || draft?.stage === 'contact' ? draft.stage : 'config')
  /** the customer was on the enquiry (review) at least once: only then the configurator offers a way back to it */
  const [seenReview, setSeenReview] = useState<boolean>(() => !!draft && (draft.stage === 'review' || draft.stage === 'contact' || (draft.items?.length ?? 0) > 1))
  useEffect(() => { if (stage === 'review' || stage === 'contact') setSeenReview(true); if (stage === 'done') setSeenReview(false) }, [stage])
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

  // the app's blue unless the supplier chose a colour of their own (the old neutral black counts as "none chosen")
  const NEUTRALS = ['#101112', '#131313', '#111111', '#111827', '#000000']
  const chosen = (/^#[0-9a-f]{6}$/i.test(data?.company.theme?.button ?? '') ? data?.company.theme?.button : null) || data?.company.accent || ''
  const accent = chosen && !NEUTRALS.includes(chosen.toLowerCase()) ? chosen : '#266df0'
  const cur = data?.company.currency || 'EUR'
  const currency = cur
  // prices are worked out whenever the supplier sends them; how they are shown depends on the mode (in a quote always)
  const calc = !!data?.company.show_prices
  const priceMode: PriceMode = internal ? 'live' : (data?.company.price_mode ?? (calc ? 'live' : 'never'))
  const endMode: EndMode = internal ? 'enquiry' : (data?.company.end_mode ?? 'enquiry')
  /** the way on names where it leads: sending an enquiry, getting the offer, or either */
  const finishLabel = T.toReview
  const showLive = calc && priceMode === 'live'
  const showRangeLive = calc && priceMode === 'range'
  /** a from–to range around a price (−10 % … +10 %, rounded to 10) */
  const priceRange = (v: number) => `${money(Math.floor(v * 0.9 / 10) * 10, cur)} – ${money(Math.ceil(v * 1.1 / 10) * 10, cur)}`

  const builder = data?.builder ?? null
  const bPricing = builder?.pricing ? pricingFrom({ ...builder.pricing, glass: builder.glass ?? undefined, handles: builder.handles ?? undefined, sills: builder.sills ?? undefined, shading: builder.shading ?? undefined }) : null
  const glassList = builder?.glass ?? [], handleList = builder?.handles ?? [], sillList = builder?.sills ?? [], shadeList = builder?.shading ?? []
  const shadeColors = shadeColorsOf(builder?.shade_colors)
  const sashWidth = (n: number) => (n === 1 ? 900 : n * 650)
  const doorWidth = (n: number) => (n === 1 ? 900 : n * 700)
  /** windows and balcony doors keep their offer apart */
  const bk = (sp: WindowSpec): BuilderKind => (sp.kind === 'door' ? 'door' : undefined)
  const wallWidth = (n: number) => n * 1000
  /** sliding windows and sliding walls: panel layouts instead of top lights and variants */
  const slidingKind = (sp: WindowSpec) => (sp.kind === 'sliding' || sp.kind === 'wall' ? sp.kind : undefined)
  /**
   * The opening most people buy: a double window opens on one sash and tilts and opens on the other
   * (no mullion between them), not two tilt-and-turn sashes; otherwise tilt and turn everywhere.
   */
  /** the usual opening: a double window is a passive sash + a tilt & turn one (no mullion), otherwise all tilt & turn */
  function usualVariant(vs: Variant[], n: number): Variant | undefined {
    const ok = vs.filter(v => v.mode !== 'tilt')
    const ops = (v: Variant) => v.combo.map(c => c.opening).join(',')
    return (n === 2 ? ok.find(v => ops(v) === 'passive,tilt_turn') ?? ok.find(v => ops(v) === 'tilt_turn,passive') : undefined)
      ?? ok.find(v => v.combo.every(c => c.opening === 'tilt_turn'))
  }
  function popularSpec(sp: WindowSpec, offer: Offer | undefined): WindowSpec {
    if (!offer || slidingKind(sp)) return sp
    const pick = usualVariant(allowedVariants(sp.sashes, offer, bk(sp)).filter(v => v.band === bandKeyOf(sp)), sp.sashes)
    return pick ? applyVariant(sp, pick) : sp
  }
  function defaultSpecItem(d: ConfigData, n: number): ConfigItem {
    return {
      key: newKey(), type_id: '', system_id: d.systems[0].id, width: sashWidth(n), height: 1400, hinge: 'left', quantity: 1, label: '',
      option_ids: d.options.filter(o => o.is_default && SINGLE_CHOICE_GROUPS.includes(o.group_key)).map(o => o.id), spec: popularSpec(makeSpec(n), d.builder?.offer),
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
  function serviceRowsOf(xs: ConfigItem[]) {
    if (!data) return []
    const wins = xs.map(x => ({ width: x.width ?? 0, height: x.height ?? 0, quantity: x.quantity, base: baseOf(x), roof: !!x.roof,
      sills: (x.sills?.in ? 1 : 0) + (x.sills?.out ? 1 : 0), shades: x.shading?.shade ? 1 : 0, screens: x.shading?.screen ? 1 : 0 }))
    // work on chosen sills / shadings / insect screens comes automatically with the chosen installation
    const installing = data.options.some(o => o.group_key === 'installation' && services.includes(o.id))
    const auto = (o: WindowOption) => !!o.per_item && o.per_item !== 'window' && o.per_item !== 'roof'
    return data.options.filter(o => auto(o) ? installing : services.includes(o.id)).map(o => ({ option: o, ...serviceLine(o, wins) }))
      .filter(r => r.qty > 0 || r.option.pricing === 'flat' || r.option.pricing === 'percent')
  }
  const serviceRows = useMemo(() => serviceRowsOf(items), [data, items, services])
  /** what a service costs for the position being configured (the whole enquiry is added up on the review) */
  function serviceTotalOf(o: WindowOption): number {
    return serviceRowsOf([it]).find(r => r.option.id === o.id)?.total ?? serviceLine(o, [{ width: it.width ?? 0, height: it.height ?? 0, quantity: it.quantity, base: baseOf(it), roof: !!it.roof }]).total
  }
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
      next = applyVariant(next, usualVariant(vs, next.sashes) ?? vs[0])
    }
    return next
  }
  function pickSashes(n: number) {
    const cur = spec && !spec.kind ? spec : makeSpec(n)
    const wasWindow = !!spec && !spec.kind
    const shaped = fitOffer(reshapeSpec(cur, n, cur.top, cur.bottom))
    // a new number of sashes starts with the usual opening
    update({ roof: null, spec: wasWindow && spec!.sashes === n ? shaped : popularSpec(shaped, offer), type_id: '', system_id: sysFor(undefined), width: wasWindow && spec!.sashes === n ? it.width : sashWidth(n), height: wasWindow ? it.height : 1400 })
  }
  function pickWall(n: number) {
    const was = spec?.kind === 'wall' && spec.sashes === n
    update({ roof: null, spec: fitOffer(was ? spec! : makeWallSpec(n)), type_id: '', system_id: sysFor('wall'), width: was ? it.width : wallWidth(n), height: spec?.kind === 'wall' ? it.height : 2200 })
  }
  function pickDoor(n: number) {
    const wasDoor = spec?.kind === 'door'
    const cur = wasDoor ? spec! : makeDoorSpec(n)
    const shaped = fitOffer(reshapeSpec(cur, n, cur.top, 'none'))
    update({ roof: null, spec: wasDoor && spec!.sashes === n ? shaped : popularSpec(shaped, offer), type_id: '', system_id: sysFor('door'), width: wasDoor && spec!.sashes === n ? it.width : doorWidth(n), height: wasDoor ? it.height : 2200 })
  }
  // the opening is chosen after the version, so a new version starts with the usual opening again
  function pickBand(top: Band, bottom: Band) { if (spec) setSpec(popularSpec(fitOffer(reshapeSpec(spec, spec.sashes, top, bottom)), offer)) }
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
    else {
      // a new window starts at the first step, whatever an earlier window with this key left behind
      const clean = <T,>(m: Record<string, T>) => { const { [next.key]: _gone, ...rest } = m; return rest }
      setOpenMap(clean); setReachedMap(clean); setDoneKeys(clean)
    }
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
      p_customer: { ...contact, lead_source: heard || null, outcome: withPdf ? 'offer' : 'enquiry' },
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
      console.error('submit_configuration failed', error)
      const code = Object.keys(T.errors).find(k => String(error.message).includes(k))
      setError(code ? T.errors[code] : `${T.genericError} (${[error.code, error.message].filter(Boolean).join(': ')})`)
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
        config: { kind: 'sub', parent: uid, code: sb.code, title: sb.title, rows: sb.rows, image_url: sb.image_url ?? null, sill: sb.sill ?? null, shade: sb.shade ?? null, color: sb.color ?? null } })
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
  /** full = the review: also says what was NOT chosen (sills, shading, screen) and which work is included */
  function describe(x: ConfigItem, full = false): { title: string; rows: [string, string][] } {
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
      if (!full) { if (x.shading?.shade) add(T.shadeColor, shadeColorName(shadeColorOf(shadeColors, x.shading?.color), lang)) }
      if (full) {
        const nameOf = (list: { id: string; name: string }[], id?: string | null) => list.find(y => y.id === id)?.name
        if (sillList.some(y => y.side === 'outer')) add(T.sillOut, nameOf(sillList, x.sills?.out) ?? T.none)
        if (sillList.some(y => y.side === 'inner')) add(T.sillIn, nameOf(sillList, x.sills?.in) ?? T.none)
        if (shadeList.some(y => y.kind === 'shade')) add(T.shadeLabel, nameOf(shadeList, x.shading?.shade) ?? T.none)
        // the colour belongs to the shading, so it comes right after it
        if (x.shading?.shade) add(T.shadeColor, shadeColorName(shadeColorOf(shadeColors, x.shading?.color), lang))
        if (shadeList.some(y => y.kind === 'screen')) add(T.screenLabel, nameOf(shadeList, x.shading?.screen) ?? T.none)
      }
    } else if (t && hasHingeChoice(t.template)) add(T.hinge, L.hinge[x.hinge])
    const extras = data.options.filter(o => x.option_ids.includes(o.id) && !isService(o)).map(o => o.name)
    add(T.step4, extras.join(', '))
    if (full && !internal) {
      // installation and removal are chosen once for the whole enquiry: say plainly whether they are in
      for (const g of ['installation', 'removal'] as const) {
        const offered = data.options.filter(o => o.group_key === g)
        if (offered.length) add(L.groups[g], offered.filter(o => services.includes(o.id)).map(o => o.name).join(', ') || T.notIncluded)
      }
    }
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
      ['shade', x.shading?.shade, 'S', T.shadeLabel, id => shadeList.find(s => s.id === id), [[T.subSize, size], [T.shadeColor, shadeColorName(shadeColorOf(shadeColors, x.shading?.color), lang)]]],
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
        color: k === 'shade' ? shadeColorOf(shadeColors, x.shading?.color).hex : null,
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
    // a roof window has its size in the model; with no quantity on the public page nothing is left to ask
    ...(roofSel && !internal ? [] : ['size']),
    ...(showBands ? ['bands'] : []),
    ...(spec && offer ? ['opening'] : []),
    ...(!roofSel && materials.length > 1 ? ['material'] : []),
    ...(!roofSel ? ['profile'] : []),
    // outside and inside are steps of their own, so nobody mixes them up
    ...(colorList.length >= 2 ? ['colorOut', 'colorIn'] : []),
    ...(spec && glassList.length > 1 ? ['glass'] : []),
    ...(spec && handleList.length > 1 ? ['handle'] : []),
    ...(spec && sillList.some(x => x.side === 'outer') ? ['sillOut'] : []),
    ...(spec && sillList.some(x => x.side === 'inner') ? ['sillIn'] : []),
    ...(spec && shadeList.length > 0 ? ['shading'] : []),
    ...(!roofSel && extraGroups.length > 0 ? ['extras'] : []),
    ...(!internal && data.options.some(isService) ? ['services'] : []),
  ]
  const openStep = openMap[it.key] ?? 'product'
  const openIdx = stepIds.indexOf(openStep)
  const reached = openStep === 'none' ? 99 : Math.max(reachedMap[it.key] ?? 0, openIdx)
  // a price only means something with the sizes: none before that step is done (in a quote always)
  const unlockIdx = stepIds.indexOf(roofSel ? 'variant' : 'size')
  // inside a quote a new window follows the same rule as for the customer (no price before the sizes); a window that is only being edited shows everything
  const editingExisting = internal && (initialItems?.length ?? 0) > 0
  const pricesOn = editingExisting || stage !== 'config' || unlockIdx < 0 || reached > unlockIdx
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
  const finishNote = firstOpen >= 0 ? T.finishOpen(firstOpen + 1) : `${T.finishHint} ${!calc || endMode === 'enquiry' ? T.finishHintEnquiry : endMode === 'pdf' ? T.finishHintOffer : T.finishHintChoose}`
  const finish = () => { setStage('review'); window.scrollTo({ top: 0 }) }
  /** a window's sizes show once the customer reached the size step (not on the first steps, before they chose anything) */
  const dimsOn = (x: ConfigItem) => editingExisting || stage !== 'config' || (x.key === it.key ? (unlockIdx < 0 || reached >= unlockIdx) : (reachedMap[x.key] ?? 0) >= (x.roof ? 1 : 2))
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
    // on the inside colour step the drawing shows the inside
    const out = colorList.find(c => c.id === (openStep === 'colorIn' ? it.colors?.in : it.colors?.out)) ?? colorList[0]
    const hnd = handleList.find(h => h.id === it.handle) ?? handleList[0]
    const shadeX = shadeList.find(x => x.id === it.shading?.shade)
    return {
      frame: parseColor(out?.look)?.hex ?? '#fbfbfa',
      extras: {
        shade: it.shading?.shade ? (shadeX?.icon ?? 'roller') : null,
        shadeColor: shadeColorOf(shadeColors, it.shading?.color).hex,
        screen: !!it.shading?.screen,
        sillOut: it.sills?.out ? sillList.find(x => x.id === it.sills?.out)?.material ?? 'alu_silver' : null,
        sillIn: it.sills?.in ? sillList.find(x => x.id === it.sills?.in)?.material ?? 'pvc_white' : null,
        handle: parseColor(hnd?.look)?.hex ?? null,
      },
    }
  })()
  const materialSummary = matNow ? L.materials[matNow] : ''
  const colorSummary = colorList.length ? `${T.colorOut}: ${(colorList.find(c => c.id === it.colors?.out) ?? colorList[0]).name} · ${T.colorIn}: ${(colorList.find(c => c.id === it.colors?.in) ?? colorList[0]).name}` : ''
  const sizeSummary = roofSel ? `${it.quantity} ${T.pcs}` : `${it.width ?? '—'} × ${it.height ?? '—'} mm${internal ? ` · ${it.quantity} ${T.pcs}` : ''}`
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
      className={cn('relative rounded-xl border px-4 pt-5 pb-4 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
      style={on ? selStyle(accent) : undefined}>
      {on && <SelBadge accent={accent} />}
      {/* the first choice: big pictures, so the products are easy to tell apart */}
      <div className="h-[140px] flex items-end justify-center">{drawing}</div>
      <div className="text-sm leading-5 font-medium text-gray-900 mt-4">{label}</div>
    </button>
  }
  /** a line under the title only where the title alone does not say enough: a term to explain, a size rule, what the price includes */
  const forN = roofSel ? T.forRoof : spec?.kind === 'door' ? T.forDoor : spec?.kind === 'wall' ? T.forWall : T.forWindow
  const ofN = roofSel ? T.ofRoof : spec?.kind === 'door' ? T.ofDoor : spec?.kind === 'wall' ? T.ofWall : T.ofWindow
  const stepHints: Record<string, string> = {
    services: T.servicesHint,
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
      ? <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[#dbfce7] text-[#267a47] ring-1 ring-inset ring-[#b7ecc9]"><Check className="w-3.5 h-3.5" strokeWidth={2.75} /></span>
      : <span className="w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: internal ? '#101112' : accent }}>{idx + 1}</span>
    const last = !done && idx === frontier
    // one rhythm for every step: title 15 px semibold, the subtitle (12 px, light grey) right under it, 16px to the content
    return <section id={'step-' + id} key={id} className={cn('bg-white border border-gray-200 rounded-xl p-5 scroll-mt-[100px]', last && idx > 0 && 'cfg-step-in')}>
      <div className="flex items-start gap-3 mb-4">
        {num}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="min-w-0 text-[15px] leading-6 font-semibold text-gray-900">{title}</h2>
            {!internal && <span className="text-xs leading-6 font-medium text-[#7f7f7f] whitespace-nowrap">{T.stepOf(idx + 1, stepIds.length)}</span>}
          </div>
          {hint && <p className="text-xs font-medium text-[#7f7f7f] mt-1 max-w-3xl">{hint}</p>}
                  </div>
      </div>
      <div className="space-y-6">{body}</div>
            {/* only the newest step moves on; the last one goes to the review */}
      {last && <div className="flex justify-end mt-6">
        <button type="button" onClick={() => { if (nextId) setOpen(nextId); else { setOpen('none'); if (!internal) finish() } }}
          className="h-11 px-6 rounded-[10px] text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={btn}>{nextId ? T.stepNext : internal ? T.stepDone : T.addToEnquiry}</button>
      </div>}
    </section>
  }

  return (
    <div className={cn('cfg-scope', internal ? 'text-gray-900' : 'cfg-public min-h-screen bg-[#f5f5f6] text-gray-900')} style={internal ? undefined : themeVars(data.company.theme)}>
      {/* Header */}
      {!internal && <header className="bg-white border-b border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.03)] sticky top-0 z-30">
        <div className={cn('px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3', data.company.logo_size === 'l' ? 'h-[72px] sm:h-20' : data.company.logo_size === 's' ? 'h-14 sm:h-16' : 'h-16 sm:h-[72px]')}>
          <div className={cn('flex items-center gap-2.5 min-w-0', (stage === 'review' || stage === 'contact') && 'cursor-pointer')}
            onClick={() => { if (stage === 'review' || stage === 'contact') { setStage('config'); window.scrollTo({ top: 0 }) } }}>
            {/* only the supplier's logo; without a logo its name stands in */}
            {data.company.logo_url
              ? <img src={data.company.logo_url} alt={data.company.name} className={cn('w-auto object-contain object-left', data.company.logo_size === 'l' ? 'h-12 sm:h-14 max-w-[200px] sm:max-w-[320px]' : data.company.logo_size === 's' ? 'h-8 sm:h-9 max-w-[150px] sm:max-w-[200px]' : 'h-10 sm:h-12 max-w-[180px] sm:max-w-[260px]')} />
              : <div className="text-lg font-bold tracking-[-0.01em] text-gray-900 truncate">{data.company.name}</div>}
          </div>
          {/* contact as buttons (on a phone only the icons), then the language */}
          <div className="flex items-center gap-2">
            {/* contact shown as information, not as buttons (no link, no hover) */}
            {data.company.phone && <span title={data.company.phone}
              className="inline-flex items-center gap-2 h-10 px-3 sm:px-3.5 rounded-[10px] border border-[#eeeff1] bg-white text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.06)] cursor-default select-text">
              <Phone className="w-4 h-4" /><span className="hidden sm:inline">{data.company.phone}</span></span>}
            {data.company.email && <span title={data.company.email}
              className="inline-flex items-center gap-2 h-10 px-3 sm:px-3.5 rounded-[10px] border border-[#eeeff1] bg-white text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.06)] cursor-default select-text">
              <Mail className="w-4 h-4" /><span className="hidden md:inline">{data.company.email}</span></span>}
          </div>
        </div>
      </header>}

      {stage === 'done' ? (
        <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.03)] px-6 py-8 sm:px-10 sm:py-10 text-center">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center bg-[#dbfce7] text-[#267a47] ring-1 ring-inset ring-[#b7ecc9]"><Check className="w-7 h-7" strokeWidth={2.5} /></div>
            <h1 className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-gray-900 mt-5">{offerSnap ? T.pdfDoneTitle : T.doneTitle}</h1>
            <p className="text-sm leading-6 text-[#5e5e5e] mt-2 max-w-md mx-auto">{offerSnap ? T.pdfDoneText : T.doneText}</p>

            {/* the number and, when the price is shown after the details, the total */}
            <dl className="mt-6 rounded-xl bg-[#f7f7f8] border border-gray-200 text-left divide-y divide-gray-200">
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-[#5e5e5e]">{offerSnap ? T.quoteNoLabel : T.enquiryNoLabel}</dt>
                <dd className="text-sm font-semibold text-gray-900 tabular-nums">{result?.quote_number}</dd>
              </div>
              {calc && (offerSnap || priceMode === 'end') && <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-[#5e5e5e]">{T.yourTotal}</dt>
                <dd className="text-[22px] leading-7 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money(offerSnap?.total_gross ?? totals.gross, cur)}</dd>
              </div>}
            </dl>

            <div className="mt-6 flex flex-col gap-2.5">
              {offerSnap && <button onClick={() => downloadOffer(offerSnap, result?.quote_number ?? '')}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={btn}><FileText className="w-4 h-4" />{T.pdfAgain}</button>}
              <button onClick={() => { setItems([defaultItem(data)]); setActive(0); setStage('config'); setConsent(false); setOfferSnap(null); setContact(c => ({ ...c, note: '' })); window.scrollTo({ top: 0 }) }}
                className={cn('w-full h-11 rounded-lg text-sm font-semibold transition-colors', offerSnap ? 'border border-gray-200 bg-white text-gray-900 hover:border-gray-400' : 'text-white hover:opacity-90')} style={offerSnap ? undefined : btn}>{T.newOne}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn('w-full px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start', 'max-w-[1480px] mx-auto')}>
          {/* The order at a glance (wide screens): the windows, one line of services, the final price */}

          {/* Main column */}
          <div className="flex flex-col gap-4 min-w-0">
            {stage === 'config' && !internal && data.company.intro && <p className="text-sm leading-6 text-[#5e5e5e] whitespace-pre-line">{data.company.intro}</p>}

            {stage === 'config' ? <>
              {/* back to the enquiry only once there is one: after the first window was finished and the review was seen */}
              {!internal && seenReview && <button type="button" onClick={finish}
                className="self-start inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-[10px] border border-gray-200 bg-white text-sm font-semibold text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-gray-400 transition-colors"><ArrowLeft className="w-4 h-4" />{T.backToEnquiry}</button>}
              {renderStep('product', T.stepProduct, groupLabel, <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {offer?.windows && !!(offer.sashes ?? []).length && prodCard('windows', T.grpWindows, <SpecDrawing spec={{ ...makeSpec(2), main: [{ opening: 'passive', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' }] }} width={1300} height={1300} size={122} plain photo />,
                  () => pickSashes(spec && !spec.kind ? spec.sashes : (offer.sashes ?? []).includes(2) ? 2 : [...(offer.sashes ?? [])].sort()[0]), 'variant')}
                {offer?.slidingWindows && prodCard('sliding', T.grpSliding, <SpecDrawing spec={makeSlidingSpec()} width={1600} height={1200} size={160} plain photo />, pickSliding, 'profile')}
                {offer?.doors && prodCard('door', T.grpDoors, <SpecDrawing spec={makeSpec(1, 'none', 'none', 'turn')} width={900} height={2200} size={128} plain photo />,
                  () => pickDoor(spec?.kind === 'door' ? spec.sashes : [...(offer.doorSashes ?? [1, 2, 3])].sort()[0]), 'variant')}
                {offer?.sliding && firstWall != null && prodCard('wall', T.grpWalls, <SpecDrawing spec={makeSpec(firstWall, 'none', 'none', 'fixed')} width={wallWidth(firstWall)} height={2200} size={Math.min(170, 128 * wallWidth(firstWall) / 2200)} plain photo />,
                  () => pickWall(spec?.kind === 'wall' ? spec.sashes : firstWall), 'variant')}
                {offer?.roof && !!roofCat?.models.length && prodCard('roof', T.grpRoof, <RoofWindowDrawing size={132} photo />, () => { if (!roofSel) pickRoof() }, 'variant')}
                {visibleTypes.map(t => {
                  const door = t.template.startsWith('door') || t.template === 'lift_slide'
                  return prodCard('type:' + t.id, t.name, <WindowDrawing template={t.template} width={door ? 900 : 1200} height={door ? 2100 : 1300} size={130} plain />, () => pickType(t), 'profile')
                })}
              </div>)}

              {renderStep('variant', roofSel ? T.stepRoof : spec?.kind === 'wall' ? T.stepParts : spec?.kind === 'door' ? T.stepDoorSashes : T.stepSashes, variantSummary, <>
                {(group === 'windows' || group === 'door' || group === 'wall') && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group === 'windows' && (offer?.windows && [...(offer.sashes ?? [])].sort().map(n => {
                    const on = spec?.sashes === n && !spec.kind
                    return <button key={'w' + n} onClick={() => pickSashes(n)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={sashWidth(n)} height={1300} size={n > 2 ? 100 : 78} plain photo /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.nSash(n)}</div>
                    </button>
                  }))}
                  {group === 'door' && (offer?.doors && [...(offer.doorSashes ?? [1, 2, 3])].sort().map(n => {
                    const on = spec?.sashes === n && spec.kind === 'door'
                    return <button key={'d' + n} onClick={() => pickDoor(n)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={doorWidth(n)} height={2200} size={84} plain photo /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.nDoor(n)}</div>
                    </button>
                  }))}
                  {group === 'wall' && (offer?.sliding && [...(offer.wallSashes ?? [2, 3, 4])].sort().filter(n => allowedCombos(n, offer, 'wall').length).map(n => {
                    const on = spec?.sashes === n && spec.kind === 'wall'
                    return <button key={'wall' + n} onClick={() => pickWall(n)}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={makeSpec(n, 'none', 'none', 'fixed')} width={wallWidth(n)} height={2200} size={n > 3 ? 110 : 96} plain photo /></div>
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
                        <div className="h-[84px] flex items-center justify-center">{m.image_url ? <img src={m.image_url} alt="" className="max-h-full max-w-full object-contain" /> : <RoofWindowDrawing size={80} opening={m.opening} photo />}</div>
                        {m.brand && <div className="text-xs font-medium text-[#5e5e5e] mt-2.5 leading-snug">{m.brand}</div>}
                        <div className={cn('text-sm font-medium text-gray-900 leading-snug', !m.brand && 'mt-2.5')}>{m.name}</div>
                        <div className="text-xs font-medium text-[#5e5e5e] mt-0.5">{m.opening === 'top' ? T.roofTop : T.roofCenter}{show && from != null ? ` · ${T.from} ${money(from, cur)}` : ''}</div>
                      </button>
                    })}
                  </div>
                </Sub>
                {roofModel && (roofModel.description || roofModel.datasheet_url) && <div className="rounded-xl border border-gray-200 bg-[#fbfbfb] px-4 py-3 -mt-2">
                  {roofModel.description && <p className="text-sm text-gray-900 whitespace-pre-line">{roofModel.description}</p>}
                  {roofModel.datasheet_url && <a href={roofModel.datasheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium hover:underline" style={{ color: accent }}>
                    <FileText className="w-4 h-4" />{T.roofDatasheet}</a>}
                </div>}
                {roofModel && (roofModel.variants ?? []).length > 0 && <Sub title={T.roofVariant}>
                  <div className="flex flex-wrap gap-2">
                    {(roofModel.variants ?? []).map(v => <Chip key={v.id} on={roofSel.variant === v.id} onClick={() => pickRoof({ variant: v.id })} accent={accent} single>
                      {v.name}{show && Number(v.pct) > 0 && <span className="ml-1.5 font-medium text-[#5e5e5e]">+ {Number(v.pct)}%</span>}
                    </Chip>)}
                  </div>
                </Sub>}
                {roofModel && <Sub title={T.roofSize}>
                  <div className="flex flex-wrap gap-2">
                    {roofModel.sizes.map(sz => <Chip key={sz.id} on={roofSel.size === sz.id} onClick={() => pickRoof({ size: sz.id })} accent={accent} single>
                      {sz.w} × {sz.h} cm{show && <span className="ml-1.5 font-medium text-[#5e5e5e]">{money(roofUnitPrice(Number(sz.price), Number(roofModel.variants?.find(x => x.id === roofSel.variant)?.pct ?? 0), 0), cur)}</span>}
                    </Chip>)}
                  </div>
                </Sub>}
                {roofCat.flashings.length > 0 && <Sub title={T.roofFlashing}>
                  <div className="flex flex-wrap gap-2">
                    <Chip on={!roofSel.flashing} onClick={() => pickRoof({ flashing: null })} accent={accent} single>{T.none}</Chip>
                    {roofCat.flashings.map(f => <Chip key={f.id} on={roofSel.flashing === f.id} onClick={() => pickRoof({ flashing: f.id })} accent={accent} single>
                      {f.name}{show && Number(f.price) > 0 && <span className="ml-1.5 font-medium text-[#5e5e5e]">+ {money(Number(f.price), cur)}</span>}
                    </Chip>)}
                  </div>
                </Sub>}
              </>}
              </>)}

              {renderStep('size', roofSel ? T.qtyTitle : spec?.kind === 'door' ? T.stepSizeDoor : spec?.kind === 'wall' ? T.stepSizeWall : T.stepSizeWindow, sizeSummary, <>
<Sub>
                <div className="grid sm:grid-cols-2 gap-3">
                  {!roofSel && <MmInput label={T.width} value={it.width} onChange={v => update({ width: v, ...(it.sashWidths && it.width && v ? { sashWidths: it.sashWidths.map(x => Math.round(x * v / it.width!)) } : {}) })} min={range.min_width} max={range.max_width} rangeLabel={T.range} />}
                  {!roofSel && <MmInput label={T.height} value={it.height} onChange={v => update({ height: v })} min={range.min_height} max={range.max_height} rangeLabel={T.range} />}
                  {!roofSel && <div className="sm:col-span-2 rounded-lg bg-[#f4f4f5] px-3.5 py-2.5 text-xs leading-5 text-[#5e5e5e]">{T.hSize}</div>}
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
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-900">{T.label}</label>
                    <input value={it.label} onChange={e => update({ label: e.target.value.slice(0, 60) })} placeholder={T.labelPh}
                      className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                  </div>
                </div>
              </Sub>
              </>)}

              {renderStep('bands', `${T.cBands} ${ofN}${T.cBandsEnd}`, bandsSummary, <>
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
                      <div className="h-[84px] flex items-center justify-center"><SpecDrawing spec={preview} width={it.width ?? 1200} height={it.height ?? 1400} size={80} plain photo /></div>
                      <div className="text-sm font-medium text-gray-900 mt-2.5 leading-snug">{T.band[k]}</div>
                      {pr != null && curP != null && Math.round((pr - curP) * 100) / 100 !== 0 && <div className="text-xs font-medium text-[#5e5e5e] mt-0.5">{pr > curP ? '+' : '−'} {money(Math.abs(Math.round((pr - curP) * 100) / 100), cur)}</div>}
                    </button>
                  })}
                </div>
              </Sub>}
              {spec && (spec.top !== 'none' || spec.bottom !== 'none') && <div className="grid sm:grid-cols-2 gap-3">
                  {spec && spec.top !== 'none' && <MmInput label={T.topHeight} value={Math.round((it.height ?? 0) * spec.topRatio)} onChange={v => v && it.height && setSpec({ ...spec, topRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
                  {spec && spec.bottom !== 'none' && <MmInput label={T.bottomHeight} value={Math.round((it.height ?? 0) * spec.bottomRatio)} onChange={v => v && it.height && setSpec({ ...spec, bottomRatio: clamp(v / it.height, 0.1, 0.5) })} min={Math.round((it.height ?? 0) * 0.1)} max={Math.round((it.height ?? 0) * 0.5)} rangeLabel={T.range} />}
              </div>}
              </>)}

              {renderStep('opening', T.cOpening, openingSummary, <>
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
                      const d = prices[i] != null && min != null ? Math.round((prices[i]! - min) * 100) / 100 : null
                      return <button key={i} onClick={() => setSpec(sp)}
                        className={cn('relative rounded-xl border p-3.5 bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="h-[104px] flex items-center justify-center"><SpecDrawing spec={sp} width={it.width ?? 1200} height={it.height ?? 1400} size={spec.sashes > 2 ? 110 : 92} photo /></div>
                        {d != null && <div className="text-xs font-medium text-[#5e5e5e] mt-1.5">{d > 0 ? `+ ${money(d, cur)}` : T.basePrice}</div>}
                      </button>
                    })}
                  </div>
                })()}
              </Sub>}
              </>)}

              {renderStep('material', T.cMaterial, materialSummary, <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {materials.map(m => {
                  const on = m === matNow
                  const prices = allowedSystems.filter(x => x.material === m).map(x => sysPrice(x.id)).filter((v): v is number => v != null)
                  const from = prices.length ? Math.min(...prices) : null
                  return <button key={m} onClick={() => pickMaterial(m)}
                    className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                    style={on ? selStyle(accent) : undefined}>
                    {on && <SelBadge accent={accent} />}
                    <div className="h-[116px] rounded-lg bg-[#fbfbfb] flex items-center justify-center overflow-hidden"><ProfileSection material={m} className="h-full p-1" /></div>
                    <div className="text-sm font-semibold text-gray-900 mt-2.5">{L.materials[m]}</div>
                    <div className="text-xs font-medium text-[#5e5e5e] mt-0.5">{T.profilesN(allowedSystems.filter(x => x.material === m).length)}{show && from != null ? ` · ${T.from} ${money(from, cur)}` : ''}</div>
                  </button>
                })}
              </div>)}

              {renderStep('profile', `${T.cProfile} ${ofN}`, profileSummary, <>
{!roofSel && <Sub>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(() => {
                    // price of the same window in every profile; the cheapest is the base
                    const bases = Object.fromEntries(matSystems.map(s => [s.id, spec ? specBase(it, s.id) : basePrice(data.prices.find(x => x.system_id === s.id && x.type_id === type!.id), it.width ?? 0, it.height ?? 0)]))
                    const known = Object.values(bases).filter((v): v is number => v != null)
                    const min = known.length > 1 ? Math.min(...known) : null
                    return matSystems.map(s => {
                    const b = bases[s.id]
                    const diff = show && min != null && b != null ? Math.round((b - min) * 100) / 100 : null
                    return <button key={s.id} onClick={() => update({ system_id: s.id })}
                    className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors', it.system_id === s.id ? '' : 'border-gray-200 hover:border-gray-400')}
                    style={it.system_id === s.id ? selStyle(accent) : undefined}>
                    {it.system_id === s.id && <SelBadge accent={accent} />}
                    <div className="flex items-start gap-3">
                      <div className="w-28 h-36 rounded-lg bg-[#fbfbfb] border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {s.image_url ? <img src={s.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <ProfileSection material={s.material} className="w-full h-full p-1.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className="text-xs font-semibold px-[7px] py-[3px] rounded-lg bg-[#eeeff1] text-[#52525b]">{L.materials[s.material]}</span><span className="text-sm font-semibold text-gray-900">{s.name}</span></div>
                        {s.description && <div className="text-xs leading-5 text-[#5e5e5e] mt-1.5">{s.description}</div>}
                        {diff != null && <div className="inline-flex items-center mt-2.5 rounded-lg px-[7px] py-[3px] text-xs font-semibold"
                          style={diff > 0 ? { color: '#52525b', backgroundColor: '#eeeff1' } : { color: '#267a47', backgroundColor: '#dbfce7' }}>
                          {diff > 0 ? `+ ${money(diff, cur)}` : T.basePrice}
                        </div>}
                        {/* the price of this window in this profile */}
                        {show && b != null && <div className="mt-2"><span className="text-sm font-semibold text-gray-900">{money(b, cur)}</span><span className="text-xs font-medium text-[#5e5e5e]"> {forN}</span></div>}
                      </div>
                    </div>
                  </button>})
                  })()}
                </div>
              </Sub>}
              </>)}

              {(['out', 'in'] as const).map(side => renderStep(side === 'out' ? 'colorOut' : 'colorIn', side === 'out' ? T.cColorOut : T.cColorIn, colorSummary, <>
{spec && (() => {
                const sy = data.systems.find(x => x.id === it.system_id)
                const list = sy ? data.builder?.colors?.[sy.material] ?? [] : []
                if (list.length < 2) return null
                const cur2 = { out: list.find(c => c.id === it.colors?.out)?.id ?? list[0].id, in: list.find(c => c.id === it.colors?.in)?.id ?? list[0].id }
                // every colour shows its fixed surcharge against the base colour on that side, the chosen one too, so nothing moves
                const base = { out: specPriceWith({ ...cur2, out: list[0].id }), in: specPriceWith({ ...cur2, in: list[0].id }) }
                const row = (side: 'out' | 'in') => <div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {list.map(c => {
                      const on = cur2[side] === c.id
                      const lookSpec = parseColor(c.look)
                      const p = show ? specPriceWith({ ...cur2, [side]: c.id }) : null
                      const now = base[side]
                      return <button key={c.id} onClick={() => update({ colors: { ...cur2, [side]: c.id } })}
                        className={cn('relative flex flex-col items-start gap-2 p-2.5 rounded-xl border bg-white text-left transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        {lookSpec && <ColorSwatch spec={lookSpec} size={64} rounded={8} className="w-full h-auto max-w-[64px]" />}
                        <span className="text-sm font-medium leading-5 text-gray-900">{c.name}</span>
                        {p != null && now != null && Math.round((p - now) * 100) / 100 !== 0 && <span className="text-xs font-medium text-[#5e5e5e] -mt-1.5">{p > now ? '+' : '−'} {money(Math.abs(Math.round((p - now) * 100) / 100), cur)}</span>}
                      </button>
                    })}
                  </div>
                </div>
                return <Sub>{row(side)}</Sub>
              })()}
              </>))}


              {renderStep('glass', `${T.cGlass} ${ofN}`, glassSummary, <>
{/* glass package: cards with Ug; the first one is included */}
              {spec && glassList.length > 1 && <Sub>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {glassList.map((g, i) => {
                    const sel = glassList.find(x => x.id === it.glass) ?? glassList[0]
                    const on = sel.id === g.id
                    // how much more THIS window costs with this glass than with the base glass (follows the entered size)
                    const d = i === 0 ? null : (() => {
                      if (!show) return null
                      const base = specBase({ ...it, glass: glassList[0].id }), p = specBase({ ...it, glass: g.id })
                      return base == null || p == null ? null : Math.round((p - base) * 100) / 100
                    })()
                    return <button key={g.id} onClick={() => update({ glass: g.id })}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="flex justify-center py-2"><GlassIcon layers={g.layers ?? 2} size={104} /></div>
                      <div className="text-sm font-semibold text-gray-900 mt-1">{g.ug != null ? `Ug ${Number(g.ug).toFixed(1).replace('.', ',')}` : g.name}</div>
                      <div className="text-xs leading-5 text-[#5e5e5e] mt-1 flex-1">{g.ug != null ? g.name : null}{g.description ? <>{g.ug != null ? ' ' : ''}{g.description}</> : null}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{i === 0 ? T.included : d != null && d !== 0 ? `${d > 0 ? '+' : '−'} ${money(Math.abs(d), cur)} ${forN}` : ''}</div>
                    </button>
                  })}
                </div>
              </Sub>}

              </>)}

              {renderStep('handle', T.cHandle, handleSummary, <>
              {/* handle: one per sash that opens with a handle */}
              {spec && handleList.length > 1 && <Sub>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {handleList.map((h, i) => {
                    const on = (handleList.find(x => x.id === it.handle) ?? handleList[0]).id === h.id
                    // price against the standard handle, so every card keeps its own surcharge
                    const d = i === 0 || !show ? null : (() => {
                      const base = specBase({ ...it, handle: handleList[0].id }), p = specBase({ ...it, handle: h.id })
                      return base == null || p == null ? null : Math.round((p - base) * 100) / 100
                    })()
                    return <button key={h.id} onClick={() => update({ handle: h.id })}
                      className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                      style={on ? selStyle(accent) : undefined}>
                      {on && <SelBadge accent={accent} />}
                      <div className="flex justify-center items-center h-[72px] py-1">
                        {h.image_url ? <img src={h.image_url} alt={h.name} className="max-h-full max-w-full object-contain" /> : <HandleIcon look={h.look} lockable={h.lockable} size={56} />}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-1">{h.name}</div>
                      <div className="text-xs leading-5 text-[#5e5e5e] mt-0.5 flex-1">{h.lockable ? T.lockable : ''}</div>
                      <div className="text-sm font-medium text-gray-900 mt-2">{i === 0 ? T.included : d != null && d !== 0 ? `${d > 0 ? '+' : '−'} ${money(Math.abs(d), cur)}` : ''}</div>
                    </button>
                  })}
                </div>
              </Sub>}

              </>)}

              {/* window sills: outside and inside are steps of their own, none by default */}
              {(['outer', 'inner'] as const).map(side => renderStep(side === 'outer' ? 'sillOut' : 'sillIn', side === 'outer' ? T.cSillOut : T.cSillIn, sillsSummary, <>
              {spec && sillList.length > 0 && <Sub>
                <div className="space-y-7 [&>*+*]:pt-7 [&>*+*]:border-t [&>*+*]:border-gray-100">
                  {[side].map(side => {
                    const list = sillList.filter(x => x.side === side)
                    if (!list.length) return null
                    const key = side === 'inner' ? 'in' : 'out'
                    const cur = it.sills?.[key] ?? null
                    const none = specBase({ ...it, sills: { ...(it.sills ?? {}), [key]: null } })
                    const card = (id: string | null, title: string, desc?: string) => {
                      const on = (cur ?? null) === id
                      const p = id && show ? specBase({ ...it, sills: { ...(it.sills ?? {}), [key]: id } }) : null
                      const d = p != null && none != null ? Math.round((p - none) * 100) / 100 : null
                      return <button key={id ?? 'none'} onClick={() => update({ sills: { ...(it.sills ?? {}), [key]: id } })}
                        className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="flex justify-center py-1 h-[64px] items-center">{(() => { const x = list.find(y => y.id === id); return !x ? <NoneTile /> : x.image_url ? <img src={x.image_url} alt={x.name} className="max-h-full max-w-full object-contain" /> : sillMaterialOf(x.material) === 'none' ? null : <SillIcon material={x.material} size={56} /> })()}</div>
                        <div className="text-sm font-medium text-gray-900 mt-1 pr-5">{title}</div>
                        <div className="text-xs leading-5 text-[#5e5e5e] mt-0.5 flex-1">{desc}</div>
                        <div className="text-sm font-medium text-gray-900 mt-2">{id && d != null && d !== 0 ? `+ ${money(d, currency)}` : ''}</div>
                      </button>
                    }
                    return <div key={side} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {card(null, T.noSill, T.noSillDesc)}
                      {list.map(x => card(x.id, x.name, x.description))}
                    </div>
                  })}
                </div>
              </Sub>}

              </>))}

              {renderStep('shading', T.cShading, shadingSummary, <>
              {/* shading and insect screen, none by default */}
              {spec && shadeList.length > 0 && <Sub>
                <div className="space-y-7 [&>*+*]:pt-7 [&>*+*]:border-t [&>*+*]:border-gray-100">
                  {(['shade', 'screen'] as const).map(kind => {
                    const list = shadeList.filter(x => x.kind === kind)
                    if (!list.length) return null
                    const chosen = it.shading?.[kind] ?? null
                    const none = specBase({ ...it, shading: { ...(it.shading ?? {}), [kind]: null } })
                    const card = (x: ShadingType | null) => {
                      const on = chosen === (x?.id ?? null)
                      const p = x && show ? specBase({ ...it, shading: { ...(it.shading ?? {}), [kind]: x.id } }) : null
                      const d = p != null && none != null ? Math.round((p - none) * 100) / 100 : null
                      return <button key={x?.id ?? 'none'} onClick={() => update({ shading: { ...(it.shading ?? {}), [kind]: x?.id ?? null } })}
                        className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                        style={on ? selStyle(accent) : undefined}>
                        {on && <SelBadge accent={accent} />}
                        <div className="flex justify-center py-1 h-[64px] items-center">
                          {!x ? <NoneTile /> : x.image_url ? <img src={x.image_url} alt={x.name} className="max-h-full max-w-full object-contain" /> : (x.icon ?? 'none') === 'none' ? null : <ShadingIcon kind={x.icon} size={56} />}
                        </div>
                        <div className="text-sm font-medium text-gray-900 mt-1 pr-5">{x ? x.name : kind === 'shade' ? T.noShade : T.noScreen}</div>
                        <div className="text-xs leading-5 text-[#5e5e5e] mt-0.5 flex-1">{x ? x.description : kind === 'shade' ? T.noShadeDesc : T.noScreenDesc}</div>
                        <div className="text-sm font-medium text-gray-900 mt-2">{x && d != null && d !== 0 ? `+ ${money(d, currency)}` : ''}</div>
                      </button>
                    }
                    return <div key={kind}>
                      <SubHead title={kind === 'shade' ? T.shadeLabel : T.screenLabel} />
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {card(null)}
                        {list.map(x => card(x))}
                      </div>
                    </div>
                  })}
                  {it.shading?.shade && <div>
                    <SubHead title={T.shadeColor} hint={T.shadeColorHint} />
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {shadeColors.map(c => {
                        const on = shadeColorOf(shadeColors, it.shading?.color).id === c.id
                        return <button key={c.id} type="button" onClick={() => update({ shading: { ...(it.shading ?? {}), color: c.id } })}
                          className={cn('relative flex flex-col items-start gap-2 p-2.5 rounded-xl border bg-white text-left transition-colors', on ? '' : 'border-gray-200 hover:border-gray-400')}
                          style={on ? selStyle(accent) : undefined}>
                          {on && <SelBadge accent={accent} />}
                          <span className="w-16 h-16 rounded-lg border border-black/10" style={{ background: c.hex }} />
                          <span className="text-sm font-medium leading-5 text-gray-900">{shadeColorName(c, lang)}</span>
                        </button>
                      })}
                    </div>
                  </div>}
                </div>
              </Sub>}

              </>)}

              {renderStep('extras', T.cExtras, extrasSummary, <>
              {!roofSel && extraGroups.length > 0 && <Sub>
                <div className="space-y-7 [&>*+*]:pt-7 [&>*+*]:border-t [&>*+*]:border-gray-100">
                  {extraGroups.map(g => <OptionGroupPicker key={g} group={g} title={L.groups[g]}
                    options={data.options.filter(o => o.group_key === g)} selected={it.option_ids} onToggle={toggleOption}
                    onClear={() => update({ option_ids: it.option_ids.filter(id => !data.options.some(o => o.group_key === g && o.id === id)) })}
                    accent={accent} show={show} currency={cur} noneLabel={T.none} pricingLabels={L.pricing} />)}
                </div>
              </Sub>}
              </>)}

              {renderStep('services', T.cServices, servicesSummary, <>
{!internal && data.options.some(isService) && <Sub>
                <div className="space-y-7 [&>*+*]:pt-7 [&>*+*]:border-t [&>*+*]:border-gray-100">
                  {items.some(x => x.roof) && data.options.some(o => o.per_item === 'roof') && <div>
                    <SubHead title={T.roofServices} />
                    <div className="flex flex-wrap gap-2">
                      {data.options.filter(o => o.per_item === 'roof').map(o => <Chip key={o.id} on={services.includes(o.id)} onClick={() => toggleService(o)} accent={accent}>
                        {o.name}{show && Number(o.price_piece ?? 0) > 0 && <span className="ml-1.5 font-medium text-[#5e5e5e]">{money(Number(o.price_piece), cur)} {L.pricing.piece}</span>}
                      </Chip>)}
                    </div>
                  </div>}
                  {SERVICE_GROUPS.filter(g => data.options.some(o => o.group_key === g && (!o.per_item || o.per_item === 'window'))).map(g => <div key={g}>
                    <SubHead title={L.groups[g]} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data.options.filter(o => o.group_key === g && (!o.per_item || o.per_item === 'window')).map(o => {
                        const on = services.includes(o.id)
                        const total = show ? serviceTotalOf(o) : 0
                        // how it is counted, in words: "20,00 € na kos + 6,00 € na tekoči meter obsega okna"
                        const how = [Number(o.price_piece ?? 0) > 0 ? `${money(Number(o.price_piece), cur)} ${L.pricing.piece}` : '', o.price != null && Number(o.price) > 0 ? `${money(Number(o.price), cur)} ${L.pricing[o.pricing]}` : ''].filter(Boolean).join(' + ')
                        return <button key={o.id} type="button" onClick={() => toggleService(o)}
                          className={cn('relative rounded-xl border p-3.5 text-left bg-white transition-colors flex flex-col', on ? '' : 'border-gray-200 hover:border-gray-400')}
                          style={on ? selStyle(accent) : undefined}>
                          {on && <SelBadge accent={accent} />}
                          <div className="text-sm font-medium text-gray-900 pr-6">{o.name}</div>
                          {show && how && <div className="text-xs leading-5 text-[#5e5e5e] mt-0.5 flex-1">{how}</div>}
                          {show && total > 0 && <div className="text-sm font-medium text-gray-900 mt-2">+ {money(total, cur)}</div>}
                        </button>
                      })}
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
              <div className="flex flex-col gap-4">
                <div className="px-1">
                  <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">{T.yourOrder}</h2>
                  <p className="text-sm text-[#5e5e5e] mt-1">{T.reviewHint}</p>
                </div>
                {items.map((x, i) => {
                  const d = describe(x, true)
                  const t = data.types.find(tt => tt.id === x.type_id)
                  const xp = priceOf(x)
                  return <div key={x.key} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)] gap-6 items-start">
                    <div className="flex items-center justify-center rounded-xl bg-[#f7f8fa] h-[200px]">
                      {x.roof ? <RoofWindowDrawing size={120} photo /> : x.spec ? <SpecDrawing spec={x.spec} width={x.width ?? 0} height={x.height ?? 0} size={140} showDims photo /> : t && <WindowDrawing template={t.template} width={x.width ?? 0} height={x.height ?? 0} hinge={x.hinge} size={140} showDims />}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#5e5e5e]">{T.position} {i + 1}</div>
                          <div className="text-base leading-6 font-semibold text-gray-900">{d.title}</div>
                          {!isDone(x) && <span className="mt-1 inline-flex items-center h-6 px-2 rounded-md text-xs font-semibold bg-[#fef3cd] text-[#8a6100]">{T.notFinished}</span>}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => { setActive(i); setStage('config'); window.scrollTo({ top: 0 }) }}
                            className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:border-gray-400 transition-colors inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" />{isDone(x) ? T.editWindow : T.finishWindow}</button>
                          {items.length > 1 && <button type="button" onClick={() => setAskRemove(i)} title={T.remove} aria-label={`${T.remove} ${T.position} ${i + 1}`}
                            className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-[#5e5e5e] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                        </div>
                      </div>
                      {(() => {
                        // like on the offer: profile, size, colours, glass, handle as text; sills, shading and the insect screen as rows of their own
                        const sp = split(x)
                        // the window alone: sills and shading are priced in their own rows below
                        const own = x.spec && !x.roof ? sp.unitPrice : xp
                        const picked = new Set([T.sillOut, T.sillIn, T.shadeLabel, T.shadeColor, T.screenLabel])
                        const once = new Set([L.groups.installation, L.groups.removal])
                        const rows = (x.spec && !x.roof ? d.rows.filter(([k]) => !picked.has(k)) : d.rows).filter(([k]) => !once.has(k))
                        const without = x.spec && !x.roof ? d.rows.filter(([k, v]) => picked.has(k) && v === T.none).map(([k]) => k) : []
                        return <>
                          <div className="mt-3 flex items-start justify-between gap-4">
                          <dl className="grid grid-cols-[minmax(96px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm flex-1 min-w-0">
                            {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-[#5e5e5e]">{k}</dt><dd className="font-medium text-gray-900">{v}</dd></div>)}
                            {x.sashWidths && <div className="contents"><dt className="text-[#5e5e5e]">{T.sashWidths}</dt><dd className="font-medium text-gray-900">{x.sashWidths.map(w => `${w} mm`).join(' · ')}</dd></div>}
                          </dl>
                          {show && own != null && <div className="text-right shrink-0">
                            <div className="text-base leading-5 font-semibold text-gray-900 tabular-nums">{money(own * x.quantity, cur)}</div>
                            {x.quantity > 1 && <div className="text-xs leading-4 text-[#5e5e5e] mt-0.5">{x.quantity} × {money(own, cur)}</div>}
                          </div>}
                          </div>
                          {sp.subs.length > 0 && <ul className="mt-4 border-t border-gray-100 divide-y divide-gray-100">
                            {sp.subs.map(sb => <li key={sb.code} className="flex items-center gap-3.5 py-3">
                              <span className="w-12 h-12 shrink-0 rounded-lg bg-[#f7f8fa] flex items-center justify-center overflow-hidden">
                                {sb.image_url ? <img src={sb.image_url} alt="" className="max-h-full max-w-full object-contain" />
                                  : sb.sill != null ? <SillIcon material={sb.sill} size={44} />
                                  : sb.shade ? <ShadingIcon kind={sb.shade} size={44} /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm leading-5 font-medium text-gray-900">{(() => { const kind = sb.rows.find(([k]) => k === T.subKind)?.[1]; return kind ? `${kind}: ${sb.title}` : sb.title })()}</span>
                                {sb.color && <span className="flex items-center gap-1.5 text-xs leading-5 text-[#5e5e5e]"><span className="w-3 h-3 shrink-0 rounded-[3px] border border-black/20" style={{ background: sb.color }} />{sb.rows.filter(([k]) => k === T.shadeColor).map(([, v]) => v).join('')}</span>}
                              </span>
                              {show && <span className="text-sm font-medium text-gray-900 tabular-nums whitespace-nowrap">+ {money(sb.unitPrice * x.quantity, cur)}</span>}
                            </li>)}
                          </ul>}
                          {without.length > 0 && <div className="mt-2 text-xs text-[#7f7f7f]">{without.map(k => `${k}: ${T.none}`).join(' · ')}</div>}
                        </>
                      })()}
                      {show && <div className="mt-auto pt-4">
                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-baseline justify-between gap-3">
                          <span className="text-sm text-[#5e5e5e]">{x.quantity > 1 || internal ? `${x.quantity} × ${xp != null ? money(xp, cur) : T.noPrice}` : T.positionPrice}</span>
                          <span className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-gray-900 tabular-nums">{xp != null ? money(xp * x.quantity, cur) : ''}</span>
                        </div>
                      </div>}
                    </div>
                  </div>
                })}
                <button type="button" onClick={() => { addItem(false); setStage('config'); window.scrollTo({ top: 0 }) }}
                  className="w-full h-12 rounded-xl border border-dashed border-gray-300 bg-white text-sm font-semibold text-gray-900 flex items-center justify-center gap-2 hover:border-gray-500 transition-colors"><Plus className="w-4 h-4" strokeWidth={2.5} />{T.addAnother}</button>
                {/* installation and the other services chosen for the whole enquiry, listed under the windows */}
                {serviceRows.length > 0 && <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                  <div className="text-base leading-6 font-semibold tracking-[-0.01em] text-gray-900">{T.servicesTitle}</div>
                  <ul className="mt-2 divide-y divide-gray-100">
                    {serviceRows.map(r => <li key={r.option.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 text-gray-900">{r.option.name}<span className="text-xs text-[#5e5e5e]"> · {r.qty.toLocaleString('de-DE')} {Number(r.option.price_piece ?? 0) > 0 || (r.option.per_item && r.option.per_item !== 'window') || r.option.pricing === 'piece' ? L.pricing.piece.replace('na ', '') : r.option.pricing === 'm2' ? 'm²' : 'm'}</span></span>
                      {show && <span className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{money(r.total, cur)}</span>}
                    </li>)}
                  </ul>
                </div>}
              </div>
            ) : (
              /* Contact stage: the way back is a button above the card */
              <div className="flex flex-col items-start gap-3">
                <button type="button" onClick={() => setStage('review')} className="self-start inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-[10px] border border-gray-200 bg-white text-sm font-semibold text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-gray-400 transition-colors"><ArrowLeft className="w-4 h-4" />{T.backToReview}</button>
              <div className="w-full bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900 mb-5">{T.contact}</h2>
                <div className="inline-flex p-1 rounded-[10px] bg-[#f1f1f1] mb-5">
                  {(['person', 'company'] as const).map(k => <button key={k} type="button" onClick={() => setContact({ ...contact, customer_type: k })}
                    className={cn('h-9 px-4 rounded-lg text-sm font-semibold transition-colors', contact.customer_type === k ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#5e5e5e] hover:text-gray-900')}>
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
                  <div className="sm:col-span-2 text-sm font-semibold text-gray-900 pt-3">{T.address}</div>
                  <div className="sm:col-span-2"><Field label={T.street} value={contact.street} onChange={v => setContact({ ...contact, street: v })} autoComplete="address-line1" /></div>
                  {contact.country === 'SI'
                    ? <PostFields postalLabel={T.postal} cityLabel={T.city} code={contact.postal_code} city={contact.city}
                        onChange={(postal_code, city) => setContact(c => ({ ...c, postal_code, city }))} />
                    : <>
                      <Field label={T.postal} value={contact.postal_code} onChange={v => setContact({ ...contact, postal_code: v })} autoComplete="postal-code" />
                      <Field label={T.city} value={contact.city} onChange={v => setContact({ ...contact, city: v })} autoComplete="address-level2" />
                    </>}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900">{T.country}</span>
                    <Select value={contact.country} onChange={v => setContact({ ...contact, country: v, postal_code: '', city: '' })}
                      options={COUNTRIES.map(c => ({ value: c.code, label: c[lang] }))} />
                  </div>
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
              </div>
            )}
          </div>

          {/* Summary column */}
          <aside className="lg:sticky lg:top-[100px] space-y-3">
            {stage === 'config' && <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-center py-2 overflow-hidden">
                {roofSel ? <RoofWindowDrawing size={internal ? 200 : 270} opening={roofModel?.opening} photo />
                  : spec ? <SpecDrawing spec={spec} width={it.width ?? 0} height={it.height ?? 0} size={internal ? 220 : 290} showDims={dimsOn(it)} frameColor={look.frame} extras={look.extras} plain={drawPlain} photo />
                  : type && <WindowDrawing template={type.template} width={it.width ?? 0} height={it.height ?? 0} hinge={it.hinge} size={internal ? 220 : 290} showDims={dimsOn(it)} />}
              </div>
              {!sizeOk(it) && <p className="text-xs text-red-600 text-center mt-1">{T.invalidSize}</p>}
              {(() => {
                // this position only: the window, its sub-positions, the price of one piece and of the position
                const sp = split(it)
                const txt = (v: number | null) => v == null ? T.noPrice : show ? money(v, cur) : showRange ? priceRange(v) : '—'
                const priced = show || showRange
                // services chosen for THIS position (the other windows come together on the review)
                const svc = !internal && show && p != null ? serviceRowsOf([it]).reduce((acc, r) => acc + r.total, 0) : 0
                return <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="text-sm font-semibold text-gray-900">{T.position} {active + 1}{it.label ? ` · ${it.label}` : ''}</div>
                  {priced && <div className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-[#5e5e5e]">{T.windowAlone}</span><span className="font-medium text-gray-900 tabular-nums">{txt(sp.unitPrice)}</span></div>
                    {sp.subs.map(sb => <div key={sb.code} className="flex justify-between gap-3"><span className="text-[#5e5e5e] min-w-0 truncate">{sb.title}</span><span className="font-medium text-gray-900 tabular-nums">{txt(sb.unitPrice)}</span></div>)}
                    {sp.subs.length > 0 && <div className="flex justify-between gap-3 border-t border-gray-100 pt-1.5"><span className="text-[#5e5e5e]">{T.unit}</span><span className="font-medium text-gray-900 tabular-nums">{txt(p)}</span></div>}
                    {(internal || it.quantity > 1) && <div className="flex justify-between gap-3"><span className="text-[#5e5e5e]">{T.qty}</span><span className="font-medium text-gray-900 tabular-nums">× {it.quantity}</span></div>}
                  </div>}
                  {svc > 0 ? <>
                    {/* with services the final price is the big one; the price of the window alone becomes a row */}
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3"><span className="text-[#5e5e5e]">{T.positionPrice}</span><span className="font-medium text-gray-900 tabular-nums">{txt(p != null ? p * it.quantity : null)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-[#5e5e5e]">{T.servicesTitle}</span><span className="font-medium text-gray-900 tabular-nums">+ {money(svc, cur)}</span></div>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 mt-3 pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-900">{T.total}</span>
                      <span className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money((p ?? 0) * it.quantity + svc, cur)}</span>
                    </div>
                  </> : <>
                    <div className="flex items-baseline justify-between gap-3 mt-3 pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-900">{T.positionPrice}</span>
                      <span className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{priced ? txt(p != null ? p * it.quantity : null) : '—'}</span>
                    </div>
                    <p className="text-xs text-[#5e5e5e] mt-1">{priced ? T.positionNote : hiddenPriceText}</p>
                  </>}
                </div>
              })()}
            </div>}

            <div className={cn(internal ? '' : 'bg-white border border-gray-200 rounded-xl p-5', !internal && stage === 'config' && 'hidden')}>
              {!internal && <div className={cn('text-base font-semibold text-gray-900', stage !== 'config' ? 'mb-2' : '')}>{T.summary}</div>}
              {!internal && stage === 'config' && <p className="text-xs leading-5 text-[#5e5e5e] mt-1 mb-4">{T.yourOrderHint}</p>}
              {!internal && show && <ul className="border-t border-gray-100 pt-3 space-y-1.5">
                {items.map((x, i) => {
                  const xp = priceOf(x)
                  return <li key={x.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-gray-900">{T.position} {i + 1} · {describe(x).title}{x.quantity > 1 && <span className="text-xs text-[#5e5e5e]"> {x.quantity} ×</span>}</span>
                    <span className="font-medium text-gray-900 whitespace-nowrap tabular-nums">{xp != null ? money(xp * x.quantity, cur) : '—'}</span>
                  </li>
                })}
                <li className="flex items-baseline justify-between gap-3 text-sm pt-1.5 mt-1 border-t border-gray-100">
                  <span className="font-semibold text-gray-900">{T.windowsTotal}</span>
                  <span className="font-semibold text-gray-900 whitespace-nowrap tabular-nums">{money(items.reduce((a, x) => a + (priceOf(x) ?? 0) * x.quantity, 0), cur)}</span>
                </li>
              </ul>}
              {!internal && serviceRows.length > 0 && <ul className="border-t border-gray-100 pt-2 mt-3">
                <li className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-gray-900">{T.servicesTitle}</span>
                  {show && <span className="font-semibold text-gray-900 whitespace-nowrap tabular-nums">{money(serviceRows.reduce((a, r) => a + r.total, 0), cur)}</span>}
                </li>
              </ul>}
              {internal ? null : show ? <div className="border-t border-gray-200 mt-3 pt-3 space-y-1.5 text-sm">
                <Row l={T.total} r={money(totals.net, cur)} />
                {totals.vatRate > 0 && <Row l={`${T.vat} ${totals.vatRate.toLocaleString('de-DE')}%`} r={money(totals.vat, cur)} muted />}
                <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">{T.gross}</span>
                  <span className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums">{money(totals.gross, cur)}</span>
                </div>
                {!internal && <p className="text-xs leading-5 text-[#5e5e5e] pt-1.5">{T.estimate}</p>}
              </div> : showRange ? <div className="border-t border-gray-200 mt-3 pt-3">
                <div className="text-sm font-semibold text-gray-900">{T.rangeTitle}</div>
                <div className="text-[22px] leading-8 font-bold tracking-[-0.02em] text-gray-900 tabular-nums mt-1">{priceRange(totals.gross)}</div>
                <p className="text-xs leading-5 text-[#5e5e5e] pt-1.5">{T.rangeNote}</p>
              </div> : <p className="text-xs text-[#5e5e5e] border-t border-gray-200 mt-3 pt-3">{hiddenPriceText}</p>}

              {internal ? (
                <div className="mt-4 flex gap-2">
                  {onCancel && <button type="button" onClick={onCancel} className="h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:border-gray-400 transition-colors">{T.cancel}</button>}
                  <button type="button" disabled={!items.every(sizeOk)} onClick={handBack}
                    className="flex-1 h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{addLabel ?? T.addToQuote}</button>
                </div>
              ) : stage === 'config' ? (<>
                <button disabled={!canFinish} onClick={finish}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{finishLabel}</button>
                <p className="text-xs text-[#7f7f7f] mt-2 text-center">{finishNote}</p>
              </>
              ) : stage === 'review' ? (<>
                <button disabled={!canFinish} onClick={() => { setStage('contact'); window.scrollTo({ top: 0 }) }}
                  className="mt-4 w-full h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity" style={btn}>{T.toContact}</button>
                {!canFinish && <p className="text-xs text-[#7f7f7f] mt-2 text-center">{finishNote}</p>}
                <button type="button" onClick={() => { if (window.confirm(T.startOverConfirm)) { setItems([defaultItem(data)]); setActive(0); setStage('config'); setConsent(false); setOfferSnap(null); setContact(c => ({ ...c, note: '' })); window.scrollTo({ top: 0 }) } }}
                  className="mt-2 w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-[#5e5e5e] hover:border-gray-400 hover:text-gray-900 transition-colors"><RotateCcw className="w-4 h-4" />{T.startOver}</button>
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
          <div className="text-base font-semibold text-gray-900">{T.removeAsk(askRemove + 1)}</div>
          <p className="text-sm font-medium text-[#5e5e5e] mt-1">{T.removeHint}</p>
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
            <div className="text-xs font-medium text-[#5e5e5e]">{T.gross}</div>
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

/** id of the natural wood colour the configurator adds to wooden profiles */
const NATURAL_WOOD_ID = 'wood_natural'

/**
 * colours of a shutter / blind and its box. No "same as the frame": a wooden frame would give a
 * wood-coloured box, which does not exist. White is the default (also for older choices without a colour).
 */
const OPEN_SL: Record<string, string> = { fixed: 'fiksno', tilt_turn: 'odpiranje in kip', turn: 'odpiranje', tilt: 'kip', passive: 'pasivno', slide_window: 'drsno', slide: 'drsno', lift_slide: 'dvižno-drsno' }
const OPEN_EN: Record<string, string> = { fixed: 'fixed', tilt_turn: 'tilt & turn', turn: 'turn', tilt: 'tilt', passive: 'passive', slide_window: 'sliding', slide: 'sliding', lift_slide: 'lift & slide' }

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

/** heading of a part inside a step (shading / insect screen, box colour, service groups …) */
function SubHead({ title, hint }: { title: string; hint?: string }) {
  return <div className="mb-3">
    <h3 className="text-sm leading-6 font-semibold text-gray-900">{title}</h3>
    {hint && <p className="text-xs leading-5 text-[#5e5e5e] mt-0.5">{hint}</p>}
  </div>
}

function Sub({ title, children }: { title?: string; children: React.ReactNode }) {
  return <div>{title && <SubHead title={title} />}{children}</div>
}

function MmInput({ label, value, onChange, min, max, rangeLabel }: { label: string; value: number | null; onChange: (v: number | null) => void; min: number; max: number; rangeLabel: string }) {
  const bad = value != null && (value < min || value > max)
  return <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-gray-900">{label}</label>
    <div className={cn('flex items-center h-10 rounded-lg border bg-white transition-colors focus-within:ring-2', bad ? 'border-red-400' : 'border-gray-200 hover:border-gray-400 focus-within:ring-blue-500')}>
      <input type="number" inputMode="numeric" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
        className="flex-1 min-w-0 h-full px-3 text-sm text-gray-900 bg-transparent focus:outline-none" />
      <span className="px-3 text-sm text-[#5e5e5e]">mm</span>
    </div>
    <span className={cn('text-xs', bad ? 'text-red-600' : 'text-[#5e5e5e]')}>{rangeLabel} {min}–{max} mm</span>
  </div>
}

/**
 * Slovenian address: the postal code and the town in two fields. Each suggests from the list of
 * post offices; a full code fills in its town and a known town fills in its code.
 */
export function PostFields({ postalLabel, cityLabel, code, city, onChange }: { postalLabel: string; cityLabel: string; code: string; city: string; onChange: (code: string, city: string) => void }) {
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const byCode = code && !SI_POSTS.some(p => p.code === code) ? SI_POSTS.filter(p => p.code.startsWith(code)).slice(0, 8) : []
  const byCity = city.trim() && !SI_POSTS.some(p => norm(p.name) === norm(city)) ? SI_POSTS.filter(p => norm(p.name).includes(norm(city))).slice(0, 8) : []
  return <>
    <Suggest label={postalLabel} value={code} inputMode="numeric" autoComplete="postal-code" hits={byCode}
      onType={v => {
        const c = v.replace(/\D/g, '').slice(0, 4)
        const hit = c.length === 4 ? SI_POSTS.find(p => p.code === c) : undefined
        onChange(c, hit ? hit.name : city)
      }}
      onPick={p => onChange(p.code, p.name)} />
    <Suggest label={cityLabel} value={city} autoComplete="address-level2" hits={byCity}
      onType={v => {
        const same = SI_POSTS.filter(p => norm(p.name) === norm(v))
        onChange(same.length === 1 ? same[0].code : code, v.slice(0, 80))
      }}
      onPick={p => onChange(p.code, p.name)} />
  </>
}

function Suggest({ label, value, hits, onType, onPick, inputMode, autoComplete }: {
  label: string; value: string; hits: { code: string; name: string }[]; onType: (v: string) => void; onPick: (p: { code: string; name: string }) => void
  inputMode?: 'numeric'; autoComplete?: string
}) {
  const [open, setOpen] = useState(false)
  return <div className="flex flex-col gap-1 relative">
    <label className="text-sm font-semibold text-gray-900">{label}</label>
    <input value={value} inputMode={inputMode} autoComplete={autoComplete}
      onChange={e => { onType(e.target.value); setOpen(true) }}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
    {open && hits.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
      {hits.map(p => <button key={p.code + p.name} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(p); setOpen(false) }}
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
  return <div className={cn('flex justify-between font-medium', bold ? 'text-sm font-semibold text-gray-900' : muted ? 'text-[#5e5e5e]' : 'text-gray-900')}><span>{l}</span><span>{r}</span></div>
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
    <SubHead title={title} />
    <div className="flex flex-wrap gap-2">
      {!single && <Chip on={!anySelected} onClick={onClear} accent={accent} single>{noneLabel}</Chip>}
      {options.map(o => <Chip key={o.id} on={selected.includes(o.id)} onClick={() => onToggle(o)} accent={accent} single={single}>
        {o.name}{price(o) && <span className="ml-1.5 font-medium text-[#5e5e5e]">{price(o)}</span>}
      </Chip>)}
    </div>
    {void pricingLabels}
  </div>
}

// Selected state, same as in the app: outline + light tint in the accent colour + check badge
const tint = (hex: string, a: number) => /^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : 'transparent'
const selStyle = (accent: string): React.CSSProperties => ({ borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}`, backgroundColor: tint(accent, 0.05) })
/** the "none" choice: an empty light-grey tile with a thin grey border, the size of the other samples (56 px), so every card looks the same */
function NoneTile() {
  return <span className="w-14 h-14 rounded-lg bg-[#fbfbfb] border border-gray-200 flex items-center justify-center text-gray-400"><Ban className="w-6 h-6" strokeWidth={1.5} /></span>
}
function SelBadge({ accent }: { accent: string }) {
  return <span className="absolute top-2 right-2 w-5 h-5 rounded-full text-white flex items-center justify-center shadow-sm" style={{ backgroundColor: accent }}><Check className="w-3 h-3" strokeWidth={3} /></span>
}

function Chip({ on, onClick, accent, single, children }: { on: boolean; onClick: () => void; accent: string; single?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick}
    className={cn('h-10 px-3.5 rounded-[10px] border text-sm font-medium flex items-center gap-1.5 transition-colors', on ? 'bg-white' : 'bg-white border-gray-200 text-gray-900 hover:border-gray-400')}
    style={on ? { ...selStyle(accent), color: '#101112' } : undefined}>
    {on && !single && <Check className="w-3.5 h-3.5" />}{children}
  </button>
}
