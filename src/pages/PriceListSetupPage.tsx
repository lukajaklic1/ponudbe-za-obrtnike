import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Calculator, Plus, Trash2, Check, Settings2, Upload, ChevronDown, Pipette, ImagePlus, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { toast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import NumberInput from '../components/ui/NumberInput'
import Checkbox from '../components/ui/Checkbox'
import { PageHeader } from '../components/ui/PageHeader'
import WindowDrawing from '../components/WindowDrawing'
import ProfileSection from '../components/ProfileSection'
import { costWindow, specToLayout, CALC_LABELS, glassOf, handleOf, layoutFor, pricingFrom, makeSpec, makeSlidingSpec, allCombos, comboKey, bandKeysFor, BAND_SHAPE, allVariants, allowedVariants, offerKey, type BuilderKind, allowedCombos, makeWallSpec, applyVariant, SAMPLE_PROFILE_PRICES, type PricingSettings, type ProfilePrices, type Offer, type WindowSpec, type BandKey } from '../lib/costing'
import SpecDrawing from '../components/SpecDrawing'
import RoofWindowDrawing from '../components/RoofWindowDrawing'
import { sampleRoofCatalog, newRoofId, sampleColors, sampleGlass, sampleHandles, sampleSills, STANDARD_SILLS, newSillId, sampleShading, STANDARD_SHADING, HANDLE_COLORS, type RoofCatalog, type RoofOpening, type ProfileColor, type GlassType, type HandleType, type SillType, type ShadingType } from '../lib/costing'
import GlassIcon from '../components/GlassIcon'
import HandleIcon from '../components/HandleIcon'
import SillIcon, { SILL_MATERIALS, sillMaterialOf } from '../components/SillIcon'
import ShadingIcon, { SHADING_ICONS } from '../components/ShadingIcon'
/** option groups that have their own step in the price list (not the generic name + price rows) */
const OWN_STEP_GROUPS = ['color', 'glass', 'handle', 'sill', 'shading']
import { cn } from '../lib/cn'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ColorSwatch from '../components/ColorSwatch'
import { WINDOW_COLORS, parseColor, encodeColor } from '../lib/colors'
import { ralHex, ralName, ralCode, ralNearest } from '../lib/ral'
import {
  TEMPLATES, MATERIALS, STARTER, WL, isDoor, isOnRequest,
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
  /** product groups the profile is used for; null = all */
  applies_to: string[] | null
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
let seq = 0
const nk = () => `o${++seq}`

/** "od N …": genitive, singular only after 1. */
const ofOpenings = (n: number) => n === 1 ? 'načina odpiranja' : 'načinov odpiranja'

const TXT = {
  sl: {
    title: 'Cenik',
    groupWindows: 'Okna', groupDoors: 'Balkonska vrata', onRequest: 'Cena na povpraševanje: stranka pošlje mere, ceno vpišete v ponudbo.',
    catWindows: 'Okna', catSlidingWindows: 'Drsna okna', catDoors: 'Balkonska vrata', catSliding: 'Drsne stene', catSpecial: 'Posebne oblike',
    roofSummary: (m: number, s: number) => `${m} ${m === 1 ? 'model' : m === 2 ? 'modela' : 'modeli'} · ${s} mer`, roofModel: 'Model', roofOpening: 'Način odpiranja',
    roofCenter: 'Vrtljivo (os na sredini)', roofTop: 'Zgornje vrtišče', roofSizes: 'Mere (širina × višina) in prodajna cena brez DDV', roofAddSize: 'Dodaj mero', roofAddModel: 'Dodaj model',
    roofFlashings: 'Obrobe za kritino (prodajna cena brez DDV)', roofBrand: 'Proizvajalec', roofDescription: 'Opis za stranko', roofDescriptionHint: 'Npr. troslojno steklo, Uw 1,0 W/m²K, les ali PVC …', roofDatasheet: 'Tehnični list (povezava do PDF)', roofVariants: 'Material in barva (doplačilo na ceno mere)', roofVariantHint: 'Npr. les naravni, PVC bel …', roofAddVariant: 'Dodaj material ali barvo', roofAddFlashing: 'Dodaj obrobo', roofHint: 'Strešna okna so izdelki iz kataloga: vpišite prodajne cene brez DDV, kot jih ima stranka v ponudbi. Marža se jim ne prišteva.',
    catEntry: 'Vhodna vrata', catRoof: 'Strešna okna', catGarage: 'Garažna vrata', catShading: 'Senčila', soon: 'Kmalu',
    sashCount: 'Število kril', nWall: (n: number) => `${n === 2 ? 'Dvodelna' : n === 3 ? 'Tridelna' : 'Štiridelna'} drsna stena`, panelCount: 'Število polj',
    wallsSummary: (t: number, l: number, all: number) => `${t} od 3 tipov · ${l} od ${all} ${ofOpenings(all)}`,
    nDoor: (n: number) => n === 1 ? 'Enokrilna balkonska vrata' : n === 2 ? 'Dvokrilna balkonska vrata' : 'Trokrilna balkonska vrata',
    doorsSummary: (t: number, l: number, all: number) => `${t} od 3 tipov · ${l} od ${all} ${ofOpenings(all)}`,
    nSash: (n: number) => n === 1 ? 'Enokrilno okno' : n === 2 ? 'Dvokrilno okno' : n === 3 ? 'Trokrilno okno' : 'Štirikrilno okno',
    bands: 'Nadsvetloba in ločen spodnji del', bandTop: 'Nadsvetloba', bandTopSplit: 'Nadsvetloba, deljena po krilih', bandBottom: 'Ločen spodnji del', bandBottomSplit: 'Ločen spodnji del, deljen po krilih',
    s1b: 'Katere izvedbe in načine odpiranja ponujate?', s1bhint: 'Za vsako skupino izdelkov nastavite izvedbe, ki jih izdelujete. Kliknite na posamezno skupino, da jo razširite, in izberite vse izdelke, ki jih imate v ponudbi.',
    // "od 3 tipov oken", "od 54 načinov odpiranja": after "od" always genitive plural (only "od 1" takes the singular)
    windowsSummary: (t: number, l: number, all: number) => `${t} od 3 tipov · ${l} od ${all} ${ofOpenings(all)}`,
    typesCount: (a: number, b: number) => `${a} od ${b} ${b === 1 ? 'tipa' : 'tipov'}`,
    variantsFor: 'Načini odpiranja, ki jih izdelujete', modeFixed: 'Fiksna', modeTilt: 'Na kip', ofCount: (a: number, b: number) => `${a} od ${b}`, versionsCount: (a: number, b: number) => `${a} od ${b} ${ofOpenings(b)}`, bandsFor: 'Izvedbe', rowSummary: (b: number, o: number, t: number, bt: number) => `${b} od ${bt} izvedb · ${o} od ${t} ${ofOpenings(t)}`,
    bandLabel: { none: 'Brez nadsvetlobe in ločenega spodnjega dela', top: 'Z nadsvetlobo', topSplit: 'Z nadsvetlobo, deljeno po krilih', bottom: 'Z ločenim spodnjim delom', bottomSplit: 'Z ločenim spodnjim delom, deljenim po krilih' } as Record<string, string>,
    combosFor: 'Odpiranja, ki jih izdelujete', combosCount: (a: number, b: number) => `${a} od ${b} ${ofOpenings(b)}`, slidingSummary: (l: number, all: number) => `${l} od ${all} ${all === 1 ? 'tipa' : 'tipov'} · ${l} od ${all} ${ofOpenings(all)}`, showOpenings: 'Odpiranja', showVariants: 'Izvedbe', showVersions: 'Načini odpiranja', allOpenings: 'Vsi načini odpiranja', hideOpenings: 'Skrij', selectAll: 'Izberi vse', clearAll: 'Počisti',
    openings: 'Načini odpiranja', openFixed: 'Fiksno', openingsHint: 'Stranka v konfiguratorju za vsako krilo izbere enega od teh načinov. Cena se izračuna sama iz profila krila in okovja.',
    s1: 'Kaj ponujate?', s1hint: 'Izberite skupine izdelkov, ki jih prodajate.',
    surcharge: 'Doplačilo',
    metrePrices: 'Nabavne cene profila na tekoči meter', frameM: 'Okvir', sashM: 'Krilo', mullionM: 'Steber / prečka', beadM: 'Pritrdilna letvica',
    widths: 'Pogledne širine profilov', frameW: 'Okvir', sashW: 'Krilo', mullionW: 'Steber',
    s3: 'Delo, odrez in marža', s3hint: 'Velja za vse profile. Iz tega in dolžin profilov aplikacija izračuna ceno vsakega okna, tudi vseh kombinacij kril.',
    glassTitle: 'Katere tipe stekla ponujate?', glassHint: 'Vnesite nabavno ceno stekla na m². Prvo steklo je osnovno in je privzeto vključeno v ceno okna, pri ostalih stranka v konfiguratorju vidi doplačilo. Marža se doda na koncu na celotno okno.',
    glassName: 'Steklo', ugLabel: 'Toplotna prehodnost', glassDescLabel: 'Opis za kupca', glassLayers: 'Število stekel', glassCost: 'Nabavna cena', layers2: 'Dvoslojno', layers3: 'Troslojno', baseIncluded: 'Osnovno, vključeno', addGlass: 'Dodaj steklo',
    handleTitle: 'Katere kljuke ponujate?', handleHint: 'Vnesite nabavno ceno ene kljuke. Okno dobi toliko kljuk, kolikor ima kril, ki se odpirajo s kljuko (pasivno krilo in fiksni del je nimata). Prva kljuka je osnovna in je privzeto vključena v ceno okna, pri ostalih stranka v konfiguratorju vidi doplačilo. Marža se doda na koncu na celotno okno.', handleColor: 'Barva kljuke', customColor: 'Barva po meri …', customShort: 'Po meri', choosePhoto: 'Izberi fotografijo', changePhoto: 'Zamenjaj', handlePhotoRemoveMsg: (n: string) => `Fotografija kljuke »${n}« bo odstranjena, ko naslednjič shranite cenik. Namesto nje se bo prikazala narisana kljuka.`,
    handleName: 'Kljuka', handleKey: 'Ključ', handleKeyYes: 'Zaklepanje s ključem', handleCost: 'Nabavna cena', perHandle: 'kos', addHandle: 'Dodaj kljuko',
    glassDescPh: 'npr. 4/16/4, ekonomično',
    sillTitle: 'Katere police ponujate?', sillHint: 'Vnesite nabavno ceno police na tekoči meter. Polica je dolga toliko, kot je okno široko. Stranka v konfiguratorju izbere notranjo in zunanjo polico ali brez police in vidi doplačilo. Marža se doda na koncu na celotno okno.',
    sillInner: 'Notranje police', sillOuter: 'Zunanje police', sillName: 'Polica', sillCost: 'Nabavna cena', sillDescPh: 'npr. Globina do 30 cm, z zaključnimi kapami.', addSillInner: 'Dodaj notranjo polico', addSillOuter: 'Dodaj zunanjo polico', sillMaterial: 'Material',
    sillMaterials: { none: 'Brez materiala', pvc_white: 'PVC, bela', pvc_oak: 'PVC, dekor hrast', pvc_anthracite: 'PVC, antracit', wood_oak: 'Les, hrast', wood_walnut: 'Les, oreh', granite: 'Granit, siv', granite_dark: 'Granit, temen', marble: 'Marmor', alu_white: 'Aluminij, bel', alu_silver: 'Aluminij, srebrn', alu_anthracite: 'Aluminij, antracit', alu_brown: 'Aluminij, rjav' } as Record<string, string>, quickAdd: 'Hitro dodaj:', addPicture: 'Dodaj sliko',
    sampleTitle: 'Cenik je izpolnjen z vzorčnimi cenami.', sampleText: 'Preverite in popravite jih na svoje nabavne cene, preden objavite konfigurator. To opozorilo bo izginilo, ko boste prvič shranili cenik.',
    shadeTitle: 'Katera senčila in komarnike ponujate?', shadeHint: 'Vnesite nabavne cene in izberite, kako se obračuna: na okno ali na vsako krilo, ki se odpira. Seštejejo se fiksni znesek (pogon, končni deli), cena na meter širine (omarica), na meter višine (vodila) in na m² (lamele, mreža); pri obračunu na krilo za vsako krilo, ki se odpira, posebej. Kar ne potrebujete, pustite na 0. Najnižja prodajna cena velja za majhna okna: stranka nikoli ne plača manj od te cene. Če je komarnik vgrajen v omarico senčila, se omarica in vodila ne štejeta dvakrat: velja cena »ko je vgrajen v senčilo«. Stranka v konfiguratorju izbere senčilo in komarnik ali brez in vidi doplačilo. Marža se v kalkulaciji doda na koncu na celotno okno.',
    shadeShades: 'Senčila', shadeScreens: 'Komarniki', shadeNamePh: 'npr. Zunanje žaluzije', screenNamePh: 'npr. Okvirni komarnik', shadeDrawing: 'Slika', shadeUnit: 'Obračun', shadeCostM2: 'Na m²',
    allowsScreen: 'Omogoča vgrajen komarnik (skupna omarica in vodila)', canIntegrate: 'Lahko je vgrajen v senčilo',
    integratedTitle: 'Nabavna cena za komarnik, ko je vgrajen v senčilo (Upoštevajte samo strošek dodatnih delov, ki jih komarnik doda: mreža, letev …)',
    integratedHint: 'Omarica in vodila so že zajeti v ceni rolete, zato jih tukaj ne vpisujte. Ko stranka izbere roleto in ta komarnik, se namesto običajne cene komarnika upošteva ta znesek.',
    shadeFixed: 'Fiksni znesek', shadePerW: 'Na meter širine', shadePerH: 'Na meter višine',
    shadeFixedSash: 'Fiksni znesek na krilo', shadePerWSash: 'Na meter širine krila', shadePerHSash: 'Na meter višine krila', shadeCostM2Sash: 'Na m² krila', shadeMin: 'Najnižja prodajna cena na okno',
    shadeUnits: { m2: 'Na okno', sash: 'Na krilo' } as Record<string, string>,
    shadeIcons: { blinds: 'Žaluzije', roller: 'Rolete', pleated: 'Plise senčilo', screen: 'Okvirni komarnik', screen_roll: 'Rolo komarnik', screen_pleated: 'Plise komarnik', none: 'Brez slike' } as Record<string, string>,
    shadeDescPh: 'npr. Lamele 80 mm, ročni pogon z jermenom.', addShade: 'Dodaj senčilo', addScreen: 'Dodaj komarnik',
    shadePhotoRemoveMsg: (n: string) => `Fotografija »${n}« bo odstranjena, ko naslednjič shranite cenik. Namesto nje se bo prikazala risba.`,
    sillPhotoRemoveMsg: (n: string) => `Fotografija police »${n}« bo odstranjena, ko naslednjič shranite cenik. Namesto nje se bo prikazala risba.`, customerSeesIncluded: 'Kupec vidi: Vključeno',
    customerSees: (v: string) => `Kupec vidi pri dvokrilnem oknu 1200 × 1400 mm: ${v} (z maržo)`,
    exDataGlass: 'Osnovno steklo', exDataHandle: 'Standardna kljuka', exSrcGlass: 'korak 6, prvo steklo', exSrcHandle: 'korak 7, prva kljuka',
    hwTitle: 'Koliko znašajo dodatni stroški okovja?', exTitle: 'Primer izračuna',
    exIntro: (w: string, h: string, prof: string) => `Dvokrilno okno ${w} × ${h} mm brez stebra: levo pasivno krilo brez kljuke, desno odpiranje in kip, profil ${prof}.`, exNoProfile: '(najprej dodajte profil v koraku 3)',
    exOpening: 'Odprtina za krilo', exWide: 'široka', exHigh: 'visoka', exSashSize: 'Velikost krila', exPerimeterL: 'Obseg krila', exData: 'Uporabljeni podatki', exCalc: 'Izračun', exStepSize: 'Mere krila', exStepPassive: 'Okovje levega krila (pasivno krilo brez kljuke)', exStepTt: 'Okovje desnega krila (odpiranje in kip)', exStepTotal: 'Okovje celega okna',
    exFixedPart: 'Fiksno doplačilo', exOpenW: 'Širina odprtine', exOpenH: 'Višina odprtine', exSashW: 'Širina krila', exSashH: 'Višina krila', exMetrePart: 'Doplačilo za obseg', exSashTotal: 'Okovje krila', exDataWindow: 'Mere okna', exDataFrame: 'Pogledna širina okvirja', exDataOverlap: 'Prekrivanje krila čez okvir (na vsako stran)',
    exDataPassive: 'Okovje pasivnega krila', exDataTt: 'Okovje krila odpiranje in kip', exSrcExample: 'izbrano za primer',
    exDataProfileM: 'Nabavne cene profila', exDataLabour: 'Delo (okno + 2 krili)', exSrcLast: 'zadnji korak',
    exStepHw: 'Okovje okna', exStepCost: 'Strošek materiala in dela', exStepPrice: 'Cena okna',
    exWasteNote: (w: string) => `Dolžine profilov vključujejo ${w} % odreza. Barva bela, brez doplačila.`, exNoVat: 'brez DDV',
    exWords3: (per: string, hw: string, cost: string, m: string, price: string) => `Iz mer okna aplikacija izračuna dolžine okvirja, kril in letvic ter površino stekla. Vsako krilo ima obseg ${per} m, okovje obeh kril skupaj stane ${hw} €. Profili, steklo, okovje in delo skupaj dajo strošek ${cost} €. Na strošek se doda marža ${m} %, tako je cena okna ${price} € brez DDV. Tako aplikacija izračuna vsako okno v konfiguratorju.`,
    exSrcProfile: (p: string) => `korak 3, profil ${p}`, exSrcFixed: 'stalna vrednost v izračunu', exSrcTable: (row: string) => `tabela zgoraj, vrstica »${row}«`,
    exWindow: 'Okovje okna', exTiltSash: 'Okovje pasivnega krila', exTtSash: 'Okovje krila odpiranje in kip',
    exWords2: (fw: string, ov: string, per: string, tilt: string, tt: string, tot: string) => `Okno nima stebra, zato se od širine odšteje le okvir na obeh straneh (${fw} mm), preostanek si delita krili; od višine se odšteje okvir zgoraj in spodaj. Krilo je na vsaki strani za ${ov} mm večje od odprtine, ker prekriva okvir, zato ima vsako krilo obseg ${per} m. Levo krilo je pasivno: nima kljuke, zaklene se z zapahi in se odpre šele za desnim. Okovje se izračuna za vsako krilo posebej po cenah njegovega načina odpiranja: pasivno krilo ${tilt} €, krilo odpiranje in kip ${tt} €. Okovje celega okna je vsota obeh, ${tot} €. To je strošek, marža se doda na celotno okno.`, exFormulaL: 'Okovje krila', exPerM: 'doplačilo na meter', exPerimeter: 'obseg krila', exSash: 'Krilo', exHw: 'Okovje krila',
    exWords: (fx: string, pm: string, per: string, tot: string) => `Vsako krilo dobi fiksno doplačilo ${fx} €, nato se za vsak meter obsega krila prišteje še ${pm} €. Krilo z obsegom ${per} m ima tako okovje v vrednosti ${tot} €. Dvokrilno okno ima dve krili, zato se okovje izračuna za vsako krilo posebej in sešteje. Znesek je strošek; marža se doda na celotno okno.`, hwIntro: 'Vnesite dodatne stroške, povezane z okovjem. Nastavite lahko fiksno doplačilo na krilo ter dodatno plačilo na tekoči meter obsega krila. Vnašajte samo stroškovne cene, ki bodo dodane k nabavnim cenam profilov. Marža se doda na koncu na celotno okno.', perSash: 'krilo', hwFixed: 'Fiksno doplačilo na krilo', hwPerM: 'Doplačilo na tekoči meter obsega krila', hwHint: 'Okovje krila = fiksni znesek + cena × obseg krila. Primer: krilo 130 × 150 cm ima obseg 5,6 m, pri 20 € + 1 €/tm je okovje 25,60 €. Pasivno krilo je drugo krilo dvokrilnega okna brez stebrička (brez kljuke).', hw: { tilt_turn: 'Odpiranje in kip', turn: 'Samo odpiranje', tilt: 'Samo kip', passive: 'Pasivno krilo brez kljuke', slide_window: 'Drsno okno', slide: 'Nagibno-drsna stena', lift_slide: 'Dvižno-drsna stena' },
    glassM2: 'Osnovno steklo', labourWindow: 'Delo na okno', labourSash: 'Delo na krilo', waste: 'Odrez profilov', margin: 'Marža', bothSides: 'Barva obojestransko',
    calc: 'Kalkulacija', cost: 'Strošek', marginLine: 'Marža', windowPrice: 'Cena okna',
    s4: 'V katerih barvah so profili?', s4hint: 'Za vsak material izberite barve, ki jih ponujate. Doplačilo v % se prišteje k ceni profilov.',
    colorCount: (n: number) => `${n} ${n % 100 === 1 ? 'barva' : n % 100 === 2 ? 'barvi' : n % 100 === 3 || n % 100 === 4 ? 'barve' : 'barv'}`, showColors: 'Barve',
    colorName: 'Barva', colorCode: 'Oznaka', badRal: (c: string) => `Oznaka »${c}« ne predstavlja RAL barve. Preverite kodo ali barvo izberite s klikom na vzorec.`, ralHint: 'Vpišite RAL kodo (npr. RAL 7016) in vzorec se obarva sam. Lahko pa kliknete vzorec in barvo izberete.', colorOne: 'Doplačilo za eno stran', colorBoth: 'Doplačilo za obe strani', addColor: 'Dodaj barvo …', ownColor: 'Lastna barva', colorsNoMaterial: 'Najprej v koraku 3 izberite material.',
    s2: 'Iz katerih materialov so okna, ki jih ponujate?', s2hint: 'Izberite materiale ter pod vsakim kreirajte profile, ki jih ponujate. Za vsak profil vpišite nabavne cene na tekoči meter ter najnižjo ceno okna v primeru manjših oken.',
    matName: 'Naziv profila', matNamePh: 'npr. PVC 82 mm, 7 komor', perM2: 'Cena na m²', minPrice: 'Najnižja cena okna',
    description: 'Opis za stranko', descriptionPh: 'npr. Uw do 0,75 W/m²K, primerno za pasivne hiše', addProfile: 'Dodaj profil', removeProfile: 'Odstrani profil', removeTitle: 'Odstranim profil?', removeItemTitle: 'Res želite odstraniti?', removeItemMsg: (n: string) => n.trim() ? `»${n.trim()}« bo odstranjeno iz cenika, ko naslednjič shranite cenik.` : 'Vrstica bo odstranjena iz cenika, ko naslednjič shranite cenik.', photoRemoveMsg: (n: string) => `Slika profila »${n}« bo takoj odstranjena.`,
    removeMsg: (n: string) => `Profil »${n}« bo dokončno odstranjen iz cenika šele, ko shranite cenik. Poslane ponudbe ostanejo nespremenjene.`, minTitle: 'Najnižja prodajna cena okna brez DDV', minHint: 'Določite najnižjo prodajno ceno okna. Če je izračunana cena manjšega okna nižja, se upošteva ta cena.',
    metrePricesHint: 'Vpišite nabavne cene profilov na tekoči meter brez DDV.', widthsHint: 'Kolikšen del profila se vidi. Iz tega se izračuna velikost stekla.', usedFor: 'Uporablja se za', usedForTitle: 'Pri katerih izdelkih ponujate ta profil?', usedForHint: 'Profil bo stranki na voljo samo pri izbranih skupinah, po navedenih cenah.', colProfile: 'Profil', colFrame: 'Okvir €/m', colSash: 'Krilo €/m', colMullion: 'Steber €/m', colBead: 'Letvica €/m', colUsedFor: 'Uporablja se za', allProducts: 'Vsi izdelki', noProducts: 'Nikjer', editProfile: 'Uredi', showProfiles: 'Profili',
    profileCount: (n: number) => `${n} ${n % 100 === 1 ? 'profil' : n % 100 === 2 ? 'profila' : n % 100 === 3 || n % 100 === 4 ? 'profili' : 'profilov'}`,
    priceLine: (f: string, s2: string, m2: string) => `okvir ${f}/m · krilo ${s2}/m · vmesnik ${m2}/m`,
    profilesLine: (names: string) => `Profili: ${names}`, noProfile: 'Za to skupino ni izbran noben profil. Dodajte ga v koraku 3.', isBase: 'Osnovni profil', moreThan: (pct: number, base: string) => `${pct} % dražji od profila ${base}`, photo: 'Naloži sliko', photoChange: 'Zamenjaj sliko', photoRemove: 'Odstrani sliko', photoHint: 'Prerez ali fotografija profila. Brez slike se prikaže risba.',
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
    roofSummary: (m: number, s: number) => `${m} models · ${s} sizes`, roofModel: 'Model', roofOpening: 'Opening',
    roofCenter: 'Centre pivot', roofTop: 'Top hung', roofSizes: 'Sizes (width × height) and sale price excl. VAT', roofAddSize: 'Add size', roofAddModel: 'Add model',
    roofFlashings: 'Roof flashings (sale price excl. VAT)', roofBrand: 'Manufacturer', roofDescription: 'Description for the customer', roofDescriptionHint: 'E.g. triple glazing, Uw 1.0 W/m²K, wood or PVC …', roofDatasheet: 'Technical sheet (link to PDF)', roofVariants: 'Material and colour (surcharge on the size price)', roofVariantHint: 'E.g. natural wood, white PVC …', roofAddVariant: 'Add material or colour', roofAddFlashing: 'Add flashing', roofHint: 'Roof windows are catalogue products: enter sale prices excl. VAT as the customer sees them. No margin is added.',
    catEntry: 'Entrance doors', catRoof: 'Roof windows', catGarage: 'Garage doors', catShading: 'Shading', soon: 'Soon',
    sashCount: 'Number of sashes', nWall: (n: number) => `${n}-panel sliding wall`, panelCount: 'Number of panels',
    wallsSummary: (t: number, l: number, all: number) => `${t} of 3 types · ${l} of ${all} opening types`,
    nDoor: (n: number) => n === 1 ? 'Single balcony door' : n === 2 ? 'Double balcony door' : 'Triple balcony door',
    doorsSummary: (t: number, l: number, all: number) => `${t} of 3 types · ${l} of ${all} opening types`,
    nSash: (n: number) => n === 1 ? 'Single sash' : n === 2 ? 'Double sash' : n === 3 ? 'Triple sash' : 'Four sashes',
    bands: 'Top light and bottom panel', bandTop: 'Top light', bandTopSplit: 'Split top light', bandBottom: 'Bottom panel', bandBottomSplit: 'Split bottom panel',
    s1b: 'Which designs and opening types do you offer?', s1bhint: 'For every product group set the variants you make. Click a group to open it and select every product you offer.',
    windowsSummary: (t: number, l: number, all: number) => `${t} of 3 types · ${l} of ${all} opening types`,
    typesCount: (a: number, b: number) => `${a} of ${b} types`,
    variantsFor: 'Opening types you make', modeFixed: 'Fixed', modeTilt: 'Tilt', ofCount: (a: number, b: number) => `${a} of ${b}`, versionsCount: (a: number, b: number) => `${a} of ${b} opening types`, bandsFor: 'Designs', rowSummary: (b: number, o: number, t: number, bt: number) => `${b} of ${bt} designs · ${o} of ${t} opening types`,
    bandLabel: { none: 'No top light or bottom panel', top: 'With top light', topSplit: 'With split top light', bottom: 'With bottom panel', bottomSplit: 'With split bottom panel' } as Record<string, string>,
    combosFor: 'Openings you make', combosCount: (a: number, b: number) => `${a} of ${b} opening types`, slidingSummary: (l: number, all: number) => `${l} of ${all} types · ${l} of ${all} opening types`, showOpenings: 'Openings', showVariants: 'Designs', showVersions: 'Opening types', allOpenings: 'All opening types', hideOpenings: 'Hide', selectAll: 'Select all', clearAll: 'Clear',
    openings: 'Opening types', openFixed: 'Fixed', openingsHint: 'In the configurator the customer picks one of these for every sash. The price follows from the sash profile and hardware.',
    s1: 'What do you offer?', s1hint: 'Select the product groups you sell.',
    surcharge: 'Surcharge',
    metrePrices: 'Purchase price of the profile per metre', frameM: 'Frame', sashM: 'Sash', mullionM: 'Mullion / transom', beadM: 'Glazing bead',
    widths: 'Visible widths frame / sash / mullion', frameW: 'Frame', sashW: 'Sash', mullionW: 'Mullion',
    s3: 'Labour, waste and margin', s3hint: 'Applies to all profiles. Together with the profile lengths the app prices every window and every sash combination.',
    glassTitle: 'Which types of glass do you offer?', glassHint: 'Enter the purchase price of the glass per m². The first glass is the base glass and is included in the window price by default; for the others the customer sees the surcharge in the configurator. The margin is added to the whole window at the end.',
    glassName: 'Glass', ugLabel: 'Thermal transmittance', glassDescLabel: 'Description for the customer', glassLayers: 'Number of panes', glassCost: 'Purchase price', layers2: 'Double', layers3: 'Triple', baseIncluded: 'Base, included', addGlass: 'Add glass',
    handleTitle: 'Which handles do you offer?', handleHint: 'Enter the purchase price of one handle. A window gets one handle per sash that opens with a handle (a passive sash and a fixed field have none). The first handle is the base one and is included in the window price by default; for the others the customer sees the surcharge in the configurator. The margin is added to the whole window at the end.', handleColor: 'Handle colour', customColor: 'Custom colour …', customShort: 'Custom', choosePhoto: 'Choose a photo', changePhoto: 'Replace', handlePhotoRemoveMsg: (n: string) => `The photo of handle "${n}" is removed the next time you save the price list. The drawn handle is shown instead.`,
    handleName: 'Handle', handleKey: 'Key', handleKeyYes: 'Locks with a key', handleCost: 'Purchase price', perHandle: 'pc', addHandle: 'Add handle',
    glassDescPh: 'e.g. 4/16/4, economical',
    sillTitle: 'Which window sills do you offer?', sillHint: 'Enter the purchase price of the sill per metre. The sill is as long as the window is wide. In the configurator the customer picks an inside and an outside sill or none and sees the surcharge. The margin is added to the whole window at the end.',
    sillInner: 'Inside sills', sillOuter: 'Outside sills', sillName: 'Sill', sillCost: 'Purchase price', sillDescPh: 'e.g. Depth up to 30 cm, with end caps.', addSillInner: 'Add inside sill', addSillOuter: 'Add outside sill', sillMaterial: 'Material',
    sillMaterials: { none: 'No material', pvc_white: 'PVC, white', pvc_oak: 'PVC, oak decor', pvc_anthracite: 'PVC, anthracite', wood_oak: 'Wood, oak', wood_walnut: 'Wood, walnut', granite: 'Granite, grey', granite_dark: 'Granite, dark', marble: 'Marble', alu_white: 'Aluminium, white', alu_silver: 'Aluminium, silver', alu_anthracite: 'Aluminium, anthracite', alu_brown: 'Aluminium, brown' } as Record<string, string>, quickAdd: 'Quick add:', addPicture: 'Add a picture',
    sampleTitle: 'The price list is filled with sample prices.', sampleText: 'Check them and change them to your own purchase prices before you publish the configurator. This notice will disappear once you save the price list for the first time.',
    shadeTitle: 'Which shading and insect screens do you offer?', shadeHint: 'Enter the purchase prices and how they are counted: per window or per opening sash. The fixed amount (drive, end parts), the price per metre of width (box), per metre of height (guides) and per m² (slats, mesh) are added up; per sash for every opening sash. Leave at 0 what you do not need. The lowest sale price is for small windows: the customer never pays less than this price. When an insect screen is built into the box of the shading, the box and guides are not counted twice: the "built into a shading" price applies. In the configurator the customer picks a shading and an insect screen or none and sees the surcharge. In the costing the margin is added to the whole window at the end.',
    shadeShades: 'Shading', shadeScreens: 'Insect screens', shadeNamePh: 'e.g. External blinds', screenNamePh: 'e.g. Framed insect screen', shadeDrawing: 'Picture', shadeUnit: 'Counted', shadeCostM2: 'Per m²',
    allowsScreen: 'An insect screen can be built in (shared box and guides)', canIntegrate: 'Can be built into a shading',
    integratedTitle: 'Purchase price of the screen when built into a shading (count only the extra parts the screen adds: mesh, bar …)',
    integratedHint: 'The box and guides are already in the price of the roller shutter, so do not enter them here. When the customer picks the roller shutter and this screen, this amount is used instead of the normal screen price.',
    shadeFixed: 'Fixed amount', shadePerW: 'Per metre of width', shadePerH: 'Per metre of height',
    shadeFixedSash: 'Fixed amount per sash', shadePerWSash: 'Per metre of sash width', shadePerHSash: 'Per metre of sash height', shadeCostM2Sash: 'Per m² of sash', shadeMin: 'Lowest sale price per window',
    shadeUnits: { m2: 'Per window', sash: 'Per sash' } as Record<string, string>,
    shadeIcons: { blinds: 'Blinds', roller: 'Roller shutter', pleated: 'Pleated blind', screen: 'Framed screen', screen_roll: 'Roll-up screen', screen_pleated: 'Pleated screen', none: 'No picture' } as Record<string, string>,
    shadeDescPh: 'e.g. 80 mm slats, manual belt drive.', addShade: 'Add shading', addScreen: 'Add insect screen',
    shadePhotoRemoveMsg: (n: string) => `The photo of "${n}" is removed the next time you save the price list. The drawing is shown instead.`,
    sillPhotoRemoveMsg: (n: string) => `The photo of sill "${n}" is removed the next time you save the price list. The drawing is shown instead.`, customerSeesIncluded: 'Customer sees: Included',
    customerSees: (v: string) => `Customer sees on a double window 1200 × 1400 mm: ${v} (with margin)`,
    exDataGlass: 'Base glass', exDataHandle: 'Standard handle', exSrcGlass: 'step 6, first glass', exSrcHandle: 'step 7, first handle',
    hwTitle: 'What are the additional hardware costs?', exTitle: 'Example',
    exIntro: (w: string, h: string, prof: string) => `Double window ${w} × ${h} mm without a mullion: left passive sash without a handle, right sash tilt & turn, profile ${prof}.`, exNoProfile: '(add a profile in step 3 first)',
    exOpening: 'Opening for a sash', exWide: 'wide', exHigh: 'high', exSashSize: 'Sash size', exPerimeterL: 'Sash perimeter', exData: 'Data used', exCalc: 'Calculation', exStepSize: 'Sash size', exStepPassive: 'Left sash hardware (passive, no handle)', exStepTt: 'Right sash hardware (tilt & turn)', exStepTotal: 'Hardware of the whole window',
    exFixedPart: 'Fixed amount', exOpenW: 'Opening width', exOpenH: 'Opening height', exSashW: 'Sash width', exSashH: 'Sash height', exMetrePart: 'Amount for the perimeter', exSashTotal: 'Sash hardware', exDataWindow: 'Window size', exDataFrame: 'Visible width of the frame', exDataOverlap: 'Sash overlap over the frame (each side)',
    exDataPassive: 'Passive sash hardware', exDataTt: 'Tilt & turn sash hardware', exSrcExample: 'chosen for the example',
    exDataProfileM: 'Purchase prices of the profile', exDataLabour: 'Labour (window + 2 sashes)', exSrcLast: 'last step',
    exStepHw: 'Hardware of the window', exStepCost: 'Cost of material and labour', exStepPrice: 'Window price',
    exWasteNote: (w: string) => `Profile lengths include ${w} % waste. Colour white, no surcharge.`, exNoVat: 'excl. VAT',
    exWords3: (per: string, hw: string, cost: string, m: string, price: string) => `From the window size the app works out the lengths of the frame, sashes and beads and the glass area. Each sash has a ${per} m perimeter; the hardware of both sashes costs ${hw} €. Profiles, glass, hardware and labour add up to a cost of ${cost} €. The ${m} % margin is added to the cost, so the window price is ${price} € excl. VAT. This is how the app prices every window in the configurator.`,
    exSrcProfile: (p: string) => `step 3, profile ${p}`, exSrcFixed: 'fixed value of the calculation', exSrcTable: (row: string) => `table above, row "${row}"`,
    exWindow: 'Hardware of the window', exTiltSash: 'Passive sash hardware', exTtSash: 'Tilt & turn sash hardware',
    exWords2: (fw: string, ov: string, per: string, tilt: string, tt: string, tot: string) => `The window has no mullion, so only the frame on both sides (${fw} mm) is taken off the width and the sashes share the rest; the frame top and bottom is taken off the height. A sash is ${ov} mm larger than its opening on every side because it overlaps the frame, so each sash has a ${per} m perimeter. The left sash is passive: no handle, locked with bolts, it opens only after the right one. The hardware is worked out per sash with the prices of its opening: passive sash ${tilt} €, tilt & turn sash ${tt} €. The window's hardware is the sum, ${tot} €. This is a cost; the margin is added to the whole window.`, exFormulaL: 'Sash hardware', exPerM: 'amount per metre', exPerimeter: 'sash perimeter', exSash: 'Sash', exHw: 'Sash hardware',
    exWords: (fx: string, pm: string, per: string, tot: string) => `Every sash gets the fixed amount of ${fx} €, then ${pm} € for every metre of its perimeter. A sash with a ${per} m perimeter therefore has hardware worth ${tot} €. A double window has two sashes, so the hardware is worked out per sash and added up. The amount is a cost; the margin is added to the whole window.`, hwIntro: 'Enter the additional costs of the hardware. You can set a fixed amount per sash and an extra amount per metre of the sash perimeter. Enter cost prices only; they are added to the purchase prices of the profiles. The margin is added to the whole window at the end.', perSash: 'sash', hwFixed: 'Fixed', hwPerM: 'Per metre of sash perimeter', hwHint: 'Sash hardware = fixed amount + price × sash perimeter. Example: a 130 × 150 cm sash has a 5.6 m perimeter; at 20 € + 1 €/m the hardware is 25.60 €. A passive sash is the second sash of a double window without a mullion (no handle).', hw: { tilt_turn: 'Tilt & turn', turn: 'Turn only', tilt: 'Tilt only', passive: 'Passive sash (no handle)', slide_window: 'Sliding window', slide: 'Tilt and slide wall', lift_slide: 'Lift & slide wall' },
    glassM2: 'Base glass', labourWindow: 'Labour per window', labourSash: 'Labour per sash', waste: 'Profile waste', margin: 'Margin', bothSides: 'Colour both sides',
    calc: 'Costing', cost: 'Cost', marginLine: 'Margin', windowPrice: 'Window price',
    s4: 'Which colours are the profiles in?', s4hint: 'Choose the colours you offer for every material. The % surcharge is added to the profile price.',
    colorCount: (n: number) => `${n} ${n === 1 ? 'colour' : 'colours'}`, showColors: 'Colours',
    colorName: 'Colour', colorCode: 'Code', badRal: (c: string) => `"${c}" is not a RAL colour. Check the code or pick the colour by clicking the swatch.`, ralHint: 'Type a RAL code (e.g. RAL 7016) and the swatch takes its colour. Or click the swatch to pick a colour.', colorOne: 'Surcharge, one side', colorBoth: 'Surcharge, both sides', addColor: 'Add colour …', ownColor: 'Own colour', colorsNoMaterial: 'Choose a material in step 3 first.',
    s2: 'Which materials are your windows made of?', s2hint: 'Select the materials and create the profiles you offer under each. For every profile enter the purchase prices per metre and the minimum price of a window for smaller windows.',
    matName: 'Profile name', matNamePh: 'e.g. PVC 82 mm, 7 chambers', perM2: 'Price per m²', minPrice: 'Minimum window price',
    description: 'Description for customers', descriptionPh: 'e.g. Uw up to 0.75 W/m²K, passive-house ready', addProfile: 'Add profile', removeProfile: 'Remove profile', removeTitle: 'Remove the profile?', removeItemTitle: 'Remove it?', removeItemMsg: (n: string) => n.trim() ? `"${n.trim()}" is removed from the price list the next time you save the price list.` : 'The row is removed from the price list the next time you save the price list.', photoRemoveMsg: (n: string) => `The picture of profile "${n}" is removed right away.`,
    removeMsg: (n: string) => `Profile "${n}" is permanently removed from the price list only when you save it. Sent quotes stay as they are.`, minTitle: 'Minimum sale price of a window excl. VAT', minHint: 'Set the lowest sale price of a window. If the calculated price of a smaller window is lower, this price is used.',
    metrePricesHint: 'Enter the purchase prices of the profiles per metre, excl. VAT.', widthsHint: 'How much of the profile is visible. The glass size follows from it.', usedFor: 'Used for', usedForTitle: 'For which products do you offer this profile?', usedForHint: 'Customers get the profile only for the selected groups, at these prices.', colProfile: 'Profile', colFrame: 'Frame €/m', colSash: 'Sash €/m', colMullion: 'Mullion €/m', colBead: 'Bead €/m', colUsedFor: 'Used for', allProducts: 'All products', noProducts: 'Nowhere', editProfile: 'Edit', showProfiles: 'Profiles',
    profileCount: (n: number) => `${n} ${n === 1 ? 'profile' : 'profiles'}`,
    priceLine: (f: string, s2: string, m2: string) => `frame ${f}/m · sash ${s2}/m · mullion ${m2}/m`,
    profilesLine: (names: string) => `Profiles: ${names}`, noProfile: 'No profile is selected for this group. Add one in step 3.', isBase: 'Base profile', moreThan: (pct: number, base: string) => `${pct} % dearer than profile ${base}`, photo: 'Upload picture', photoChange: 'Replace picture', photoRemove: 'Remove picture', photoHint: 'Cross-section or photo of the profile. Without one a drawing is shown.',
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

  const [shapes, setShapes] = useState<ShapeRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [matOn, setMatOn] = useState<Record<string, boolean>>({})
  const [removedProfiles, setRemovedProfiles] = useState<string[]>([])
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [options, setOptions] = useState<OptionRow[]>([])
  const [pricing, setPricing] = useState<PricingSettings>(pricingFrom(null))
  /** the price list was never saved: everything shown is a sample */
  const [isSample, setIsSample] = useState(false)
  const [openSash, setOpenSash] = useState<string | null>(null)
  const [variantTab, setVariantTab] = useState<Record<string, string>>({})
  const [openMat, setOpenMat] = useState<Record<string, boolean>>({})
  const [openProf, setOpenProf] = useState<Record<string, boolean>>({})
  const [profileToRemove, setProfileToRemove] = useState<ProfileRow | null>(null)
  /** any other row with a bin: asks first, then removes (saved with the price list) */
  const [pendingRemove, setPendingRemove] = useState<{ name: string; run: () => void; msg?: string } | null>(null)
  const askRemove = (name: string, run: () => void, msg?: string) => setPendingRemove({ name, run, msg })
  const [openColors, setOpenColors] = useState<Record<string, boolean>>({})
  const [folds, setFolds] = useState<Record<string, boolean>>({})
  const toggleFold = (k: string) => setFolds(f => ({ ...f, [k]: !f[k] }))
  const [removed, setRemoved] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { if (company) load() }, [company?.id])
  async function load() {
    if (!company) return
    const [s, t, o, c] = await Promise.all([
      supabase.from('window_systems' as any).select('*').eq('company_id', company.id).order('sort_order'),
      supabase.from('window_types' as any).select('*').eq('company_id', company.id).order('sort_order'),
      supabase.from('window_options' as any).select('*').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
      supabase.from('companies').select('window_pricing').eq('id', company.id).single(),
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
      min: Number(x.min_price ?? 0) || null, image_url: x.image_url ?? null, applies_to: x.applies_to ?? null,
      // profiles without metre prices yet start from the sample prices of their material
      ...metreOrSample(x),
    })))
    {
      const rawPricing = (c.data as { window_pricing?: unknown } | null)?.window_pricing ?? company.window_pricing
      setIsSample(!rawPricing || typeof rawPricing !== 'object' || !('offer' in (rawPricing as object)))
      const pr = pricingFrom(rawPricing)
      // roof windows start from a sample range the supplier edits (saved with the price list)
      if (!pr.roof) pr.roof = sampleRoofCatalog()
      // glass packages and handles: start from samples; the base glass keeps the old single glass price
      if (!pr.glass?.length) pr.glass = sampleGlass(pr.glass_m2)
      if (!pr.handles?.length) pr.handles = sampleHandles()
      if (!pr.sills?.length) pr.sills = sampleSills()
      if (!pr.shading?.length) pr.shading = sampleShading()
      // 'per piece' is no longer offered: it is the same as per window with only a fixed amount
      pr.shading = pr.shading.map(x => x.unit === 'piece' ? { ...x, unit: 'm2', fixed: (x.fixed ?? 0) + x.cost, cost: 0 } : x)
      // insect screens drawn with the pleated-blind picture get their own pleated-screen picture
      pr.shading = pr.shading.map(x => x.kind === 'screen' && x.icon === 'pleated' ? { ...x, icon: 'screen_pleated' } : x)
      // per sash used to be one price per sash: it is the fixed amount per sash now
      pr.shading = pr.shading.map(x => x.unit === 'sash' && x.fixed === undefined && x.per_w === undefined ? { ...x, fixed: x.cost, cost: 0 } : x)
      // shadings saved before "built-in screen" existed: roller shutters allow it
      pr.shading = pr.shading.map(x => x.kind === 'shade' && x.allows_screen === undefined ? { ...x, allows_screen: x.icon === 'roller' } : x)
      // profile colours per material: the usual ones to start with
      pr.colors = { ...(pr.colors ?? {}) }
      for (const m of MATERIALS) if (!pr.colors[m]) pr.colors[m] = sampleColors()
      // the most popular colours first (white, anthracite, oak …); own colours keep their order at the end
      const rank = (c: ProfileColor) => { const i = WINDOW_COLORS.findIndex(p => p.sl.toLowerCase() === c.name.trim().toLowerCase()); return i < 0 ? 999 : i }
      const latin: Record<string, string> = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'н': 'n', 'к': 'k', 'м': 'm', 'т': 't', 'х': 'x', 'у': 'y', 'в': 'v' }
      for (const m of Object.keys(pr.colors)) pr.colors[m] = pr.colors[m].map(c => ({ ...c, name: c.name.replace(/[\u0400-\u04FF]/g, ch => latin[ch] ?? ch) }))
      for (const m of Object.keys(pr.colors)) pr.colors[m] = [...pr.colors[m]].sort((x, y) => rank(x) - rank(y))
      setPricing(pr)
    }
    setMatOn(Object.fromEntries(MATERIALS.map(m => [m, sys.some(x => x.material === m && x.is_active !== false)])))
    setRemovedProfiles([])
    setOptions(opt.map(x => ({ key: nk(), id: x.id, group_key: x.group_key, name: x.name, pricing: x.pricing, price: x.price == null ? null : Number(x.price), is_default: x.is_default, swatch: x.group_key === 'color' && /^#[0-9a-f]{6}$/i.test(x.description ?? '') ? x.description! : undefined })))
    setRemoved([]); setDirty(false); setLoading(false)
  }

  const touch = () => setDirty(true)
  const setProfile = (key: string, patch: Partial<ProfileRow>) => { setProfiles(xs => xs.map(x => x.key === key ? { ...x, ...patch } : x)); touch() }
  const newProfile = (m: WindowMaterial): ProfileRow => ({ key: nk(), material: m, name: L.materials[m], description: '', min: null, image_url: null, applies_to: null, ...metreOrSample({ material: m }) })
  // a door / sliding / special shape is offered only while its product group is switched on
  const catOn = (t: WindowTemplate) => !isDoor(t) && t !== 'special' ? true : t === 'special' ? pricing.offer.special : t === 'psk' || t === 'lift_slide' ? pricing.offer.sliding : pricing.offer.doors
  /** Windows and balcony doors in the price list: type (sashes) → top light / bottom part → opening types. */
  function builder(kind?: BuilderKind) {
    const offer = pricing.offer
    const door = kind === 'door'
    const sashList = (door ? offer.doorSashes : offer.sashes) ?? [1, 2, 3]
    const setSashList = (list: number[]) => setOffer(door ? { doorSashes: list } : { sashes: list })
    const rowH = door ? 2200 : 1300
    return (<>
      {groupProfiles(door ? 'doors' : 'windows')}
              <div className="space-y-5">
              {/* every window type is a row; its openings open right underneath it */}
              <div>
                <div className="text-xs font-medium text-[#7f7f7f] mb-2">{T.sashCount}</div>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {[1, 2, 3].map(n => {
                    const ok = offerKey(n, kind)
                    const on = sashList.includes(n)
                    const variants = allVariants(n, offer, kind)
                    const off = offer.variantsOff?.[ok] ?? []
                    const setOff = (keys: string[]) => setOffer({ variantsOff: { ...(offer.variantsOff ?? {}), [ok]: keys } })
                    const onCount = variants.filter(v => !off.includes(v.key)).length
                    const bandKeys = bandKeysFor(n, kind)
                    const bandsPicked = (offer.bands?.[ok] ?? bandKeys).filter(k => bandKeys.includes(k as BandKey))
                    const setBands = (keys: string[]) => setOffer({ bands: { ...(offer.bands ?? {}), [ok]: keys } })
                    const open = on && openSash === ok
                    const drawW = door ? (n === 1 ? 1000 : 700 * n) : n === 1 ? 1200 : 500 * n + 200
                    return <div key={n} className={cn(on ? 'bg-white' : 'bg-gray-50/60')}>
                      <div className="flex items-center gap-4 px-4 py-3">
                        <button type="button" disabled={!canEdit} onClick={() => setSashList(on ? sashList.filter(x => x !== n) : [...sashList, n].sort())}
                          className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', on ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                          {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                        <RowPic spec={makeSpec(n, 'none', 'none', 'fixed')} width={door ? drawW : n === 1 ? 1200 : 500 * n + 200} height={rowH} />
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm font-medium', on ? 'text-gray-900' : 'text-gray-500')}>{door ? T.nDoor(n) : T.nSash(n)}</div>
                          {on && <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{T.rowSummary(bandsPicked.length, onCount, variants.length, bandKeys.length)}</div>}
                        </div>
                        {on && <button type="button" onClick={() => { setOpenSash(open ? null : ok); setVariantTab({}) }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                          {open ? T.hideOpenings : T.showVariants}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                        </button>}
                      </div>
                      {open && <div className="px-4 pb-4">
                        <div className="ml-[9px] pl-[25px] border-l-2 border-blue-100 space-y-6">
                          {/* top light / bottom panel: one row each with a tick; its arrow opens the variants of that shape */}
                          <div>
                            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                              <AllRow all={bandsPicked.length === bandKeys.length} some={bandsPicked.length > 0} disabled={!canEdit}
                                onToggle={() => bandsPicked.length === bandKeys.length ? setBands([]) : (setBands([...bandKeys]), setOff([]))}
                                label={T.bandsFor} count={T.ofCount(bandsPicked.length, bandKeys.length)} />
                              {bandKeys.map(k => {
                                const sel = bandsPicked.includes(k)
                                const list = variants.filter(v => v.band === k)
                                const onN = list.filter(v => !off.includes(v.key)).length
                                const isOpen = sel && variantTab[ok] === k
                                const keys = list.map(v => v.key)
                                return <div key={k} className={cn(sel ? 'bg-white' : 'bg-gray-50/60')}>
                                  <div className="flex items-center gap-4 px-4 py-3">
                                    <button type="button" disabled={!canEdit} onClick={() => setBands(sel ? bandsPicked.filter(x => x !== k) : [...bandsPicked, k])}
                                      className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', sel ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                                      {sel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                    </button>
                                    <RowPic spec={makeSpec(n, BAND_SHAPE[k][0], BAND_SHAPE[k][1], 'fixed')} width={drawW} height={rowH} slim={false} />
                                    <div className="flex-1 min-w-0">
                                      <div className={cn('text-sm font-medium', sel ? 'text-gray-900' : 'text-gray-500')}>{T.bandLabel[k]}</div>
                                      {sel && <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{T.versionsCount(onN, list.length)}</div>}
                                    </div>
                                    {sel && <button type="button" onClick={() => setVariantTab(t => ({ ...t, [ok]: isOpen ? '' : k }))}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                                      {isOpen ? T.hideOpenings : T.showVersions}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                                    </button>}
                                  </div>
                                  {isOpen && <div className="px-4 pb-4">
                                    <div className="ml-[9px] pl-[25px] border-l-2 border-blue-100 space-y-4">
                                      <AllRow plain all={onN === list.length} some={onN > 0} disabled={!canEdit}
                                        onToggle={() => setOff(onN === list.length ? [...off.filter(x => !keys.includes(x)), ...keys] : off.filter(x => !keys.includes(x)))}
                                        label={T.allOpenings} count={T.ofCount(onN, list.length)} />
                                      {(() => {
                                        // one grid: the same sash opening with a fixed and a tilting top light / bottom part side by side
                                        const order = (v: typeof list[number]) => list.findIndex(x => x.mode === list[0].mode && comboKey(x.combo) === comboKey(v.combo)) * 2 + (v.mode === 'tilt' ? 1 : 0)
                                        const group = [...list].sort((a, b) => order(a) - order(b))
                                        return <div>
                                          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                            {group.map(v => {
                                              const vs = !off.includes(v.key)
                                              return <button key={v.key} type="button" disabled={!canEdit} onClick={() => setOff(vs ? [...off, v.key] : off.filter(x => x !== v.key))}
                                                className={cn('relative rounded-lg border p-3 flex items-center justify-center h-[190px] transition-colors', vs ? SEL_ON : SEL_OFF)}>
                                                {vs && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>}
                                                <span className={cn(!vs && 'opacity-40')}><SpecDrawing spec={applyVariant(makeSpec(n), v)} width={drawW} height={door ? 2300 : 1400} size={door ? 160 : n > 2 ? 170 : 150} className="max-w-full h-auto" /></span>
                                              </button>
                                            })}
                                          </div>
                                        </div>
                                      })()}
                                    </div>
                                  </div>}
                                </div>
                              })}
                            </div>
                          </div>
                        </div>
                      </div>}
                    </div>
                  })}
                </div>
              </div>
              </div>
    </>)
  }
  // product groups offered in step 1 that need profiles (roof windows are a catalogue)
  const offeredGroups: string[] = [
    ...(pricing.offer.windows ? ['windows'] : []), ...(pricing.offer.slidingWindows ? ['slidingWindows'] : []),
    ...(pricing.offer.doors ? ['doors'] : []), ...(pricing.offer.sliding ? ['walls'] : []),
  ]
  const groupLabel = (g: string) => g === 'windows' ? T.catWindows : g === 'slidingWindows' ? T.catSlidingWindows : g === 'doors' ? T.catDoors : T.catSliding
  /** active profiles that serve a product group */
  const profilesFor = (g: string) => profiles.filter(p => matOn[p.material] && (!p.applies_to || p.applies_to.includes(g)))
  const money = (n: number | null) => (n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (cur === 'EUR' ? '€' : cur)
  /** "Profili: PVC 76, PVC 82" at the top of a product group in step 2 (or a warning when none) */
  const groupProfiles = (g: string) => {
    const list = profilesFor(g)
    return list.length
      ? <p className="text-xs font-medium text-[#7f7f7f] mb-3">{T.profilesLine(list.map(p => p.name || L.materials[p.material]).join(', '))}</p>
      : <p className="text-xs font-medium mb-3 rounded-md px-2.5 py-1.5 inline-block" style={{ color: '#874d00', backgroundColor: '#fff3cc', border: '1px solid #ffe5a0' }}>{T.noProfile}</p>
  }
  // short line on a closed fold: how many window types and opening layouts are offered
  const windowsSummary = (() => {
    const o = pricing.offer
    const layouts = o.sashes.reduce((a, n) => {
      const off = o.variantsOff?.[String(n)] ?? []
      return a + allVariants(n, o).filter(v => !off.includes(v.key)).length
    }, 0)
    const all = o.sashes.reduce((a, n) => a + allVariants(n, o).length, 0)
    return T.windowsSummary(o.sashes.length, layouts, all)
  })()
  const doorsSummary = (() => {
    const o = pricing.offer, list = o.doorSashes ?? [1, 2, 3]
    const on = list.reduce((a, n) => a + allowedVariants(n, o, 'door').length, 0)
    const all = list.reduce((a, n) => a + allVariants(n, o, 'door').length, 0)
    return T.doorsSummary(list.length, on, all)
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
  function addProfile(m: WindowMaterial) { const p = newProfile(m); setProfiles(xs => [...xs, p]); setOpenProf(o => ({ ...o, [p.key]: true })); touch() }
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
  /** roof window model picture → public 'logos' bucket; kept in the price list (saved with "Shrani cenik") */
  async function uploadRoofPhoto(id: string, file: File, done: (url: string) => void, folder = 'roof') {
    if (!company) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2 MB'); return }
    setUploadingKey(id)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${company.id}/${folder}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    setUploadingKey(null)
    if (error) { toast.error(error.message); return }
    done(supabase.storage.from('logos').getPublicUrl(path).data.publicUrl)
  }
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
      // offer (types, top lights, opening types …) and price settings first
      { const { error } = await supabase.from('companies').update({ window_pricing: { ...pricing, glass_m2: pricing.glass?.[0]?.cost_m2 ?? pricing.glass_m2 }, updated_at: now } as any).eq('id', company.id); if (error) throw error }
      // profiles → window_systems (a material that is switched off keeps its profiles, inactive)
      if (removedProfiles.length) {
        const { error } = await supabase.from('window_systems' as any).delete().in('id', removedProfiles); if (error) throw error
      }
      const sysIds: Record<string, string> = {}
      const ordered = MATERIALS.flatMap(m => profiles.filter(p => p.material === m))
      for (const [i, p] of ordered.entries()) {
        const payload = { name: p.name.trim() || L.materials[p.material], material: p.material, description: p.description.trim() || null, image_url: p.image_url, min_price: p.min ?? 0, is_active: !!matOn[p.material], sort_order: i, updated_at: now,
          frame_m: p.frame_m ?? 0, sash_m: p.sash_m ?? 0, mullion_m: p.mullion_m ?? 0, bead_m: p.bead_m ?? 0, frame_w: p.frame_w, sash_w: p.sash_w, mullion_w: p.mullion_w, applies_to: p.applies_to,
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
      setIsSample(false)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!permLoading && !hasPerm('price_list', 'view')) return <Navigate to="/dashboard" replace />
  const offer = pricing.offer

  // live preview (like Fenestro): one example window, base price + every default choice as its own line

  return (
    <div>
      <ConfirmDialog open={!!profileToRemove} onClose={() => setProfileToRemove(null)} danger
        title={T.removeTitle} message={profileToRemove ? T.removeMsg(profileToRemove.name || L.materials[profileToRemove.material]) : ''} confirmLabel={T.removeProfile}
        onConfirm={() => { if (profileToRemove) removeProfile(profileToRemove); setProfileToRemove(null) }} />
      <ConfirmDialog open={!!pendingRemove} onClose={() => setPendingRemove(null)} danger
        title={T.removeItemTitle} message={pendingRemove ? pendingRemove.msg ?? T.removeItemMsg(pendingRemove.name) : ''} confirmLabel={T.remove}
        onConfirm={() => { pendingRemove?.run(); setPendingRemove(null) }} />
      <PageHeader title={T.title} icon={Calculator} action={canEdit && <Button onClick={save} loading={saving} className="gap-2"><Check className="w-4 h-4" />{T.save}</Button>} />
      <div className="p-4 lg:p-6 pb-28">
        <div className="min-w-0">
        {isSample && !loading && <div className="mb-5 flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ color: '#874d00', backgroundColor: '#fff3cc', border: '1px solid #ffe5a0' }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div><div className="font-medium">{T.sampleTitle}</div><div className="mt-0.5">{T.sampleText}</div></div>
        </div>}

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
                ['roof', T.catRoof, <RoofWindowDrawing key="r" size={104} />],
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
          {(offer.windows || offer.slidingWindows || offer.doors || offer.sliding || offer.roof) && <Step n={2} title={T.s1b} hint={T.s1bhint}>
            <div className="space-y-3">
            {/* windows: sashes, top light / bottom panel, openings */}
            {offer.windows && <Fold open={!!folds.windows} onToggle={() => { toggleFold('windows'); setOpenSash(null); setVariantTab({}) }} title={T.catWindows} summary={windowsSummary}
              pic={<SpecDrawing spec={makeSpec(2)} width={1200} height={1300} size={64} plain slim />}>
              {builder()}
            </Fold>}

            {offer.slidingWindows && (() => {
              const all = allCombos(2, offer, 'sliding')
              const picked = (offer.combos?.s2 ?? all.map(comboKey)).filter(k => all.some(c => comboKey(c) === k))
              const setPicked = (keys: string[]) => setOffer({ combos: { ...(offer.combos ?? {}), s2: keys } })
              return <Fold open={!!folds.slidingWindows} onToggle={() => toggleFold('slidingWindows')} title={T.catSlidingWindows} summary={T.slidingSummary(picked.length, all.length)}
                pic={<SpecDrawing spec={makeSlidingSpec()} width={1600} height={1200} size={85} plain slim />}>
                <div>
                {groupProfiles('slidingWindows')}
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

            {/* balcony doors: built like windows */}
            {offer.doors && <Fold open={!!folds.doors} onToggle={() => { toggleFold('doors'); setOpenSash(null); setVariantTab({}) }} title={T.catDoors} summary={doorsSummary}
              pic={<SpecDrawing spec={makeSpec(1)} width={1000} height={2200} size={64} plain slim />}>
              {builder('door')}
            </Fold>}

            {/* sliding walls (PSK): 2, 3 or 4 panels, each with the panel layouts to tick */}
            {offer.sliding && (() => {
              const list = offer.wallSashes ?? [2, 3, 4]
              const sum = list.reduce((x, n) => ({ on: x.on + allowedCombos(n, offer, 'wall').length, all: x.all + allCombos(n, offer, 'wall').length }), { on: 0, all: 0 })
              const wW = (n: number) => n * 1000
              return <Fold open={!!folds.walls} onToggle={() => { toggleFold('walls'); setOpenSash(null) }} title={T.catSliding} summary={T.wallsSummary(list.length, sum.on, sum.all)}
                pic={<SpecDrawing spec={makeWallSpec(2)} width={2000} height={2200} size={64} plain slim />}>
                {groupProfiles('walls')}
                <div className="text-xs font-medium text-[#7f7f7f] mb-2">{T.panelCount}</div>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {[2, 3, 4].map(n => {
                    const key = 'w' + n
                    const on = list.includes(n)
                    const all = allCombos(n, offer, 'wall')
                    const picked = (offer.combos?.[key] ?? all.map(comboKey)).filter(k => all.some(c => comboKey(c) === k))
                    const setPicked = (keys: string[]) => setOffer({ combos: { ...(offer.combos ?? {}), [key]: keys } })
                    const open = on && openSash === key
                    return <div key={n} className={cn(on ? 'bg-white' : 'bg-gray-50/60')}>
                      <div className="flex items-center gap-4 px-4 py-3">
                        <button type="button" disabled={!canEdit} onClick={() => setOffer({ wallSashes: on ? list.filter(x => x !== n) : [...list, n].sort() })}
                          className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', on ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                          {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                        <RowPic spec={makeSpec(n, 'none', 'none', 'fixed')} width={wW(n)} height={2200} />
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm font-medium', on ? 'text-gray-900' : 'text-gray-500')}>{T.nWall(n)}</div>
                          {on && <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{T.versionsCount(picked.length, all.length)}</div>}
                        </div>
                        {on && <button type="button" onClick={() => setOpenSash(open ? null : key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                          {open ? T.hideOpenings : T.showVersions}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                        </button>}
                      </div>
                      {open && <div className="px-4 pb-4">
                        <div className="ml-[9px] pl-[25px] border-l-2 border-blue-100">
                          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {all.map(c => {
                              const k = comboKey(c), sel = picked.includes(k)
                              return <button key={k} type="button" disabled={!canEdit} onClick={() => setPicked(sel ? picked.filter(x => x !== k) : [...picked, k])}
                                className={cn('relative rounded-lg border p-3 flex items-center justify-center h-[190px] transition-colors', sel ? SEL_ON : SEL_OFF)}>
                                {sel && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>}
                                <span className={cn(!sel && 'opacity-40')}><SpecDrawing spec={{ ...makeWallSpec(n), main: c }} width={wW(n)} height={2200} size={170} className="max-w-full h-auto" /></span>
                              </button>
                            })}
                          </div>
                        </div>
                      </div>}
                    </div>
                  })}
                </div>
              </Fold>
            })()}

            {/* roof windows: models in standard sizes + flashings */}
            {offer.roof && (() => {
              const roof: RoofCatalog = pricing.roof ?? { models: [], flashings: [] }
              const setRoof = (r: RoofCatalog) => { setPricing(x => ({ ...x, roof: r })); touch() }
              const setModel = (id: string, patch: Partial<RoofCatalog['models'][number]>) => setRoof({ ...roof, models: roof.models.map(m => m.id === id ? { ...m, ...patch } : m) })
              const inputCls = 'w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              return <Fold open={!!folds.roof} onToggle={() => toggleFold('roof')} title={T.catRoof}
                summary={T.roofSummary(roof.models.length, roof.models.reduce((a, m) => a + m.sizes.length, 0))} pic={<RoofWindowDrawing size={72} />}>
                <div className="space-y-4">
                  {roof.models.map(m => (
                    <div key={m.id} className="rounded-lg border border-gray-200 p-3 space-y-3">
                      <div className="flex flex-wrap items-end gap-3">
                        {/* picture of the model (upload) — the drawing until there is one */}
                        <label className={cn('relative w-[88px] h-[88px] shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden', canEdit && 'cursor-pointer hover:border-gray-400')}
                          title={m.image_url ? T.photoChange : T.photo}>
                          {m.image_url ? <img src={m.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <RoofWindowDrawing size={60} opening={m.opening} />}
                          {canEdit && <span className="absolute bottom-1 right-1 w-5 h-5 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-600">
                            {uploadingKey === m.id ? '…' : <Upload className="w-3 h-3" />}</span>}
                          {canEdit && <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadRoofPhoto(m.id, f, url => setModel(m.id, { image_url: url })) }} />}
                        </label>
                        <div className="w-40 flex flex-col gap-1">
                          <label className="text-xs font-medium text-[#7f7f7f]">{T.roofBrand}</label>
                          <input value={m.brand ?? ''} onChange={e => setModel(m.id, { brand: e.target.value })} disabled={!canEdit} placeholder="Velux, Fakro …" className={inputCls} />
                        </div>
                        <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                          <label className="text-xs font-medium text-[#7f7f7f]">{T.roofModel}</label>
                          <input value={m.name} onChange={e => setModel(m.id, { name: e.target.value })} disabled={!canEdit} className={inputCls} />
                        </div>
                        <div className="w-56 flex flex-col gap-1">
                          <label className="text-xs font-medium text-[#7f7f7f]">{T.roofOpening}</label>
                          <select value={m.opening} onChange={e => setModel(m.id, { opening: e.target.value as RoofOpening })} disabled={!canEdit} className={cn(inputCls, 'bg-white')}>
                            <option value="center">{T.roofCenter}</option>
                            <option value="top">{T.roofTop}</option>
                          </select>
                        </div>
                        {canEdit && <button type="button" onClick={() => askRemove(m.name, () => setRoof({ ...roof, models: roof.models.filter(x => x.id !== m.id) }))} title={T.remove}
                          className="h-[38px] px-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <div className="grid md:grid-cols-[1fr_280px] gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-[#7f7f7f]">{T.roofDescription}</label>
                          <textarea value={m.description ?? ''} onChange={e => setModel(m.id, { description: e.target.value })} disabled={!canEdit} rows={3}
                            placeholder={T.roofDescriptionHint} className={cn(inputCls, 'resize-y')} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-[#7f7f7f]">{T.roofDatasheet}</label>
                          <input value={m.datasheet_url ?? ''} onChange={e => setModel(m.id, { datasheet_url: e.target.value })} disabled={!canEdit} placeholder="https://…" className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[#7f7f7f] mb-1">{T.roofSizes}</div>
                        <div className="space-y-2">
                          {m.sizes.map(sz => (
                            <div key={sz.id} className="flex flex-wrap items-center gap-2">
                              <div className="w-28"><NumberInput value={sz.w} unit="cm" decimals={0} onValue={v => setModel(m.id, { sizes: m.sizes.map(x => x.id === sz.id ? { ...x, w: v ?? 0 } : x) })} /></div>
                              <span className="text-sm text-gray-400">×</span>
                              <div className="w-28"><NumberInput value={sz.h} unit="cm" decimals={0} onValue={v => setModel(m.id, { sizes: m.sizes.map(x => x.id === sz.id ? { ...x, h: v ?? 0 } : x) })} /></div>
                              <div className="w-36"><NumberInput value={sz.price} unit={cur} decimals={2} onValue={v => setModel(m.id, { sizes: m.sizes.map(x => x.id === sz.id ? { ...x, price: v ?? 0 } : x) })} /></div>
                              {canEdit && <button type="button" onClick={() => askRemove(`${sz.w} × ${sz.h} cm`, () => setModel(m.id, { sizes: m.sizes.filter(x => x.id !== sz.id) }))} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                          ))}
                        </div>
                        {canEdit && <button type="button" onClick={() => setModel(m.id, { sizes: [...m.sizes, { id: newRoofId(), w: 78, h: 118, price: 0 }] })}
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"><Plus className="w-4 h-4" />{T.roofAddSize}</button>}
                      </div>
                    </div>
                  ))}
                  {canEdit && <button type="button" onClick={() => setRoof({ ...roof, models: [...roof.models, { id: newRoofId(), name: '', opening: 'center', sizes: [] }] })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"><Plus className="w-4 h-4" />{T.roofAddModel}</button>}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-[#7f7f7f] mb-1">{T.roofFlashings}</div>
                    <div className="space-y-2">
                      {roof.flashings.map(f => (
                        <div key={f.id} className="flex flex-wrap items-center gap-2">
                          <input value={f.name} onChange={e => setRoof({ ...roof, flashings: roof.flashings.map(x => x.id === f.id ? { ...x, name: e.target.value } : x) })} disabled={!canEdit} className={cn(inputCls, 'flex-1 min-w-[220px] w-auto')} />
                          <div className="w-36"><NumberInput value={f.price} unit={cur} decimals={2} onValue={v => setRoof({ ...roof, flashings: roof.flashings.map(x => x.id === f.id ? { ...x, price: v ?? 0 } : x) })} /></div>
                          {canEdit && <button type="button" onClick={() => askRemove(f.name, () => setRoof({ ...roof, flashings: roof.flashings.filter(x => x.id !== f.id) }))} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      ))}
                    </div>
                    {canEdit && <button type="button" onClick={() => setRoof({ ...roof, flashings: [...roof.flashings, { id: newRoofId(), name: '', price: 0 }] })}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"><Plus className="w-4 h-4" />{T.roofAddFlashing}</button>}
                  </div>
                  <p className="text-xs font-medium text-[#7f7f7f]">{T.roofHint}</p>
                </div>
              </Fold>
            })()}
            </div>
          </Step>}

          {/* 2. materials */}
          <Step n={3} title={T.s2} hint={T.s2hint}>
            <div className="space-y-2">
              {MATERIALS.map(m => {
                const on = !!matOn[m]
                const list = profiles.filter(p => p.material === m)
                const open = on && openMat[m] !== false
                return (
                <div key={m} className={cn('rounded-xl border bg-white overflow-hidden transition-colors', on ? 'border-gray-300' : 'border-gray-200')}>
                  <div className={cn('flex items-center gap-4 px-4 py-3', !on && 'bg-gray-50/60')}>
                    <button type="button" disabled={!canEdit} onClick={() => { toggleMaterial(m); setOpenMat(o => ({ ...o, [m]: true })) }}
                      className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', on ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                      {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </button>
                    <ProfileSection material={m} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-sm font-medium', on ? 'text-gray-900' : 'text-gray-500')}>{L.materials[m]}</div>
                      {on && <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{T.profileCount(list.length)}</div>}
                    </div>
                    {on && <button type="button" onClick={() => setOpenMat(o => ({ ...o, [m]: !open }))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                      {open ? T.hideOpenings : T.showProfiles}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                    </button>}
                  </div>
                  {open && <div className="px-4 pb-4">
                    <div className="ml-[9px] pl-[25px] border-l-2 border-blue-100 space-y-3">
                    {list.length > 0 && <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {/* a small table: name, the three main per-metre prices, where it is used */}
                    <div className="hidden lg:grid grid-cols-[48px_minmax(0,1fr)_88px_88px_88px_88px_360px_76px] items-center gap-4 px-4 py-2 bg-gray-50 text-xs font-medium text-[#7f7f7f]">
                      <span /><span>{T.colProfile}</span><span className="text-right whitespace-nowrap">{T.colFrame}</span><span className="text-right whitespace-nowrap">{T.colSash}</span><span className="text-right whitespace-nowrap" title={T.mullionM}>{T.colMullion}</span><span className="text-right whitespace-nowrap">{T.colBead}</span><span className="text-right">{T.colUsedFor}</span><span />
                    </div>
                    {list.map(p => {
                      const pOpen = !!openProf[p.key]
                      const groups = offeredGroups
                      const serves = (g: string) => !p.applies_to || p.applies_to.includes(g)
                      const toggleGroup = (g: string) => {
                        const cur = p.applies_to ?? [...groups]
                        const next = cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g]
                        setProfile(p.key, { applies_to: groups.every(x => next.includes(x)) ? null : next })
                      }
                      const usedText = !p.applies_to || groups.every(g => p.applies_to!.includes(g)) ? T.allProducts
                        : groups.filter(g => p.applies_to!.includes(g)).map(groupLabel).join(', ') || T.noProducts
                      return <div key={p.key} className="bg-white">
                        <div className="grid grid-cols-[48px_minmax(0,1fr)_76px] lg:grid-cols-[48px_minmax(0,1fr)_88px_88px_88px_88px_360px_76px] items-center gap-4 px-4 py-3">
                          <div className="w-12 h-12 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                            {p.image_url ? <img src={p.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <ProfileSection material={m} size={40} />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{p.name || L.materials[m]}</div>
                            {p.description && <div className="text-xs font-medium text-[#7f7f7f] mt-0.5 truncate">{p.description}</div>}
                          </div>
                          <div className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{money(p.frame_m)}</div>
                          <div className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{money(p.sash_m)}</div>
                          <div className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{money(p.mullion_m)}</div>
                          <div className="hidden lg:block text-sm text-gray-700 text-right tabular-nums">{money(p.bead_m)}</div>
                          <div className="hidden lg:flex flex-nowrap justify-end gap-1" title={usedText}>
                            {/* every offered group: blue where the profile is used, grey where not */}
                            {groups.map(g => <span key={g} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
                              style={serves(g) ? { color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' } : { color: '#a1a1aa', backgroundColor: '#fafafa', border: '1px solid #e4e4e7' }}>{groupLabel(g)}</span>)}
                          </div>
                          <button type="button" onClick={() => setOpenProf(o => ({ ...o, [p.key]: !pOpen }))}
                            className="justify-self-end inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                            {pOpen ? T.hideOpenings : T.editProfile}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', pOpen && 'rotate-180')} />
                          </button>
                        </div>
                        {pOpen && <div className="px-4 py-5 border-t border-gray-100 bg-gray-50/50">
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* picture: uploaded photo or the schematic cross-section */}
                          <div className="md:w-40 shrink-0">
                            <label className={cn('relative block w-full h-48 rounded-lg border border-dashed bg-white flex items-center justify-center overflow-hidden', canEdit ? 'cursor-pointer border-gray-300 hover:border-gray-400' : 'border-gray-200')}>
                              {p.image_url ? <img src={p.image_url} alt="" className="max-w-full max-h-full object-contain p-1" /> : <ProfileSection material={m} className="w-full h-full p-3" />}
                              {canEdit && <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(p, f); e.target.value = '' }} />}
                            </label>
                            {canEdit && <div className="flex items-center justify-between mt-2 text-xs font-medium text-[#7f7f7f]">
                              <span className="inline-flex items-center gap-1"><Upload className="w-3 h-3" />{uploadingKey === p.key ? '…' : p.image_url ? T.photoChange : T.photo}</span>
                              {p.image_url && <button type="button" onClick={() => askRemove('', () => removePhoto(p), T.photoRemoveMsg(p.name || L.materials[p.material]))} className="hover:text-red-600" title={T.photoRemove}><Trash2 className="w-3.5 h-3.5" /></button>}
                            </div>}
                          </div>
                          <div className="flex-1 min-w-0 divide-y divide-gray-200/70">
                            {/* name and description */}
                            <div className="pb-5 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-[#7f7f7f]">{T.matName}</label>
                                <input value={p.name} placeholder={T.matNamePh} onChange={e => setProfile(p.key, { name: e.target.value })} disabled={!canEdit} className="w-full rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-[#7f7f7f]">{T.description}</label>
                                <input value={p.description} placeholder={T.descriptionPh} onChange={e => setProfile(p.key, { description: e.target.value })} disabled={!canEdit} className="w-full rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                            </div>
                            {/* purchase prices per metre */}
                            <div className="py-5">
                              <div className="text-sm font-medium text-gray-900">{T.metrePrices}</div>
                              <p className="text-xs font-medium text-[#7f7f7f] mt-0.5 mb-3">{T.metrePricesHint}</p>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <NumberInput label={T.frameM} unit={`${cur}/m`} value={p.frame_m} onValue={v => setProfile(p.key, { frame_m: v })} decimals={2} />
                                <NumberInput label={T.sashM} unit={`${cur}/m`} value={p.sash_m} onValue={v => setProfile(p.key, { sash_m: v })} decimals={2} />
                                <NumberInput label={T.mullionM} unit={`${cur}/m`} value={p.mullion_m} onValue={v => setProfile(p.key, { mullion_m: v })} decimals={2} />
                                <NumberInput label={T.beadM} unit={`${cur}/m`} value={p.bead_m} onValue={v => setProfile(p.key, { bead_m: v })} decimals={2} />
                              </div>
                            </div>
                            {/* visible widths + minimum price */}
                            <div className="py-5 grid lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-6">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{T.widths}</div>
                                <p className="text-xs font-medium text-[#7f7f7f] mt-0.5 mb-3">{T.widthsHint}</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <NumberInput label={T.frameW} unit="mm" value={p.frame_w} onValue={v => setProfile(p.key, { frame_w: v ?? 70 })} decimals={0} />
                                  <NumberInput label={T.sashW} unit="mm" value={p.sash_w} onValue={v => setProfile(p.key, { sash_w: v ?? 78 })} decimals={0} />
                                  <NumberInput label={T.mullionW} unit="mm" value={p.mullion_w} onValue={v => setProfile(p.key, { mullion_w: v ?? 82 })} decimals={0} />
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{T.minTitle}</div>
                                <p className="text-xs font-medium text-[#7f7f7f] mt-0.5 mb-3">{T.minHint}</p>
                                <NumberInput unit={cur} value={p.min} onValue={v => setProfile(p.key, { min: v })} decimals={2} />
                              </div>
                            </div>
                            {/* where the profile is used: the product groups offered in step 1 */}
                            {groups.length > 0 && <div className="py-5">
                              <div className="text-sm font-medium text-gray-900">{T.usedForTitle}</div>
                              <p className="text-xs font-medium text-[#7f7f7f] mt-0.5 mb-3">{T.usedForHint}</p>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {groups.map(g => {
                                  const sel = serves(g)
                                  return <button key={g} type="button" disabled={!canEdit} onClick={() => toggleGroup(g)} className="inline-flex items-center gap-2 text-sm text-gray-900">
                                    <span className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', sel ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                                      {sel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                    </span>{groupLabel(g)}
                                  </button>
                                })}
                              </div>
                            </div>}
                            {/* comparison with the cheapest profile of the material + remove */}
                            <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
                              <div>{(() => {
                                const ref = (x: ProfileRow) => salePrice(x, REF.template, REF.w, REF.h)
                                const priced = list.filter(x => ref(x) > 0)
                                if (priced.length < 2 || !ref(p)) return null
                                const cheapest = priced.reduce((a, x) => (ref(x) < ref(a) ? x : a))
                                const pct = Math.round((ref(p) / ref(cheapest) - 1) * 100)
                                const isBase = p.key === cheapest.key || pct === 0
                                // only the dearer profiles say how much more a window costs; the cheapest needs no label
                                return isBase ? null
                                  : <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" style={{ color: '#52525b', backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7' }}>
                                      {T.moreThan(pct, cheapest.name || L.materials[m])}
                                    </span>
                              })()}</div>
                              {canEdit && <button type="button" onClick={() => setProfileToRemove(p)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />{T.removeProfile}</button>}
                            </div>
                          </div>
                        </div>
                        </div>}
                      </div>
                    })}
                    </div>}
                    {canEdit && <button type="button" onClick={() => addProfile(m)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"><Plus className="w-4 h-4" />{T.addProfile}</button>}
                    <p className="text-xs font-medium text-[#7f7f7f]">{T.photoHint}</p>
                    </div>
                  </div>}
                </div>
              )})}
            </div>
          </Step>

          {/* 3. hardware, glass, labour, margin */}
          {/* 4. colours of the profiles, per material */}
          <Step n={4} title={T.s4} hint={T.s4hint}>
            <div className="space-y-2">
              {MATERIALS.filter(m => matOn[m]).map(m => {
                const list = pricing.colors?.[m] ?? []
                const setList = (next: ProfileColor[]) => { setPricing(x => ({ ...x, colors: { ...(x.colors ?? {}), [m]: next } })); touch() }
                const setColor = (id: string, patch: Partial<ProfileColor>) => setList(list.map(c => c.id === id ? { ...c, ...patch } : c))
                const open = !!openColors[m]
                const unused = WINDOW_COLORS.filter(p => !list.some(c => c.name.trim().toLowerCase() === p.sl.toLowerCase()
                  || (c.look === encodeColor(p.spec) && (c.code ?? '') === (p.code ?? ''))))
                return (
                <div key={m} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-4 px-4 py-3">
                    <ProfileSection material={m} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{L.materials[m]}</div>
                      <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{T.colorCount(list.length)}</div>
                    </div>
                    {/* the first colours as a preview */}
                    <div className="hidden sm:flex items-center gap-1">
                      {list.slice(0, 10).map(c => { const spec = parseColor(c.look); return spec ? <ColorSwatch key={c.id} spec={spec} size={22} rounded={6} /> : null })}
                      {list.length > 10 && <span className="text-xs font-medium text-[#7f7f7f] ml-1">+{list.length - 10}</span>}
                    </div>
                    <button type="button" onClick={() => setOpenColors(o => ({ ...o, [m]: !open }))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
                      {open ? T.hideOpenings : T.showColors}<ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                    </button>
                  </div>
                  {open && <div className="px-4 pb-4">
                    <div className="ml-[9px] pl-[25px] border-l-2 border-blue-100 space-y-3">
                      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                        <div className="hidden md:grid grid-cols-[36px_minmax(0,1fr)_120px_180px_180px_36px] items-center gap-3 px-4 py-2 bg-gray-50 text-xs font-medium text-[#7f7f7f]">
                          <span /><span>{T.colorName}</span><span>{T.colorCode}</span><span className="text-right">{T.colorOne}</span><span className="text-right">{T.colorBoth}</span><span />
                        </div>
                        {list.map(c => {
                          const spec = parseColor(c.look)
                          // a code that says RAL (or is four digits) but is not a RAL colour
                          const code = (c.code ?? '').trim()
                          const badRal = !!code && (/ral/i.test(code) || /^\d{4}$/.test(code)) && !ralCode(code)
                          return <div key={c.id} className="grid grid-cols-[36px_minmax(0,1fr)_36px] md:grid-cols-[36px_minmax(0,1fr)_120px_180px_180px_36px] items-center gap-3 px-4 py-2">
                            {/* the swatch; solid colours can be changed with the colour picker */}
                            <label className={cn('relative w-8 h-8', canEdit && spec?.finish !== 'wood' && 'cursor-pointer')} title={c.look}>
                              {spec && <ColorSwatch spec={spec} size={32} rounded={8} />}
                              {canEdit && spec && spec.finish !== 'wood' && <input type="color" value={spec.hex}
                                onChange={e => {
                                  // a picked colour snaps to the closest RAL colour, so the code and the swatch always match
                                  const near = ralNearest(e.target.value)
                                  const autoName = !c.name.trim() || c.name === ralName(c.code)
                                  setColor(c.id, { look: encodeColor({ ...spec, hex: near.hex }), code: `RAL ${near.code}`, ...(autoName ? { name: ralName(near.code) ?? '' } : {}) })
                                }} className="absolute inset-0 opacity-0 cursor-pointer" />}
                            </label>
                            <input value={c.name} onChange={e => setColor(c.id, { name: e.target.value })} disabled={!canEdit} placeholder={T.colorName}
                              className="w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input value={c.code ?? ''} disabled={!canEdit} placeholder="RAL …" title={T.ralHint}
                              onChange={e => {
                                // a RAL code colours the swatch and names an unnamed colour
                                const code = e.target.value, hex = ralHex(code)
                                setColor(c.id, { code, ...(hex ? { look: encodeColor({ hex, finish: spec && spec.finish !== 'wood' ? spec.finish : 'smooth' }) } : {}), ...(hex && !c.name.trim() ? { name: ralName(code) ?? '' } : {}) })
                              }}
                              className="hidden md:block w-full rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <div className="hidden md:block"><NumberInput unit="%" value={c.one} onValue={v => setColor(c.id, { one: v ?? 0 })} decimals={0} /></div>
                            <div className="hidden md:block"><NumberInput unit="%" value={c.both} onValue={v => setColor(c.id, { both: v ?? 0 })} decimals={0} /></div>
                            {canEdit ? <button type="button" onClick={() => askRemove(c.name, () => setList(list.filter(x => x.id !== c.id)))} title={T.remove}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button> : <span />}
                            {badRal && <p className="col-span-full -mt-1 md:pl-[48px] text-xs font-medium" style={{ color: '#874d00' }}>{T.badRal(code)}</p>}
                          </div>
                        })}
                      </div>
                      {canEdit && <div className="flex flex-wrap items-center gap-3">
                        <select value="" onChange={e => {
                          const v = e.target.value
                          if (v === '__own') setList([...list, { id: newRoofId(), name: '', look: '#ffffff', one: 0, both: 0 }])
                          else { const p = WINDOW_COLORS.find(x => x.sl === v); if (p) setList([...list, { id: newRoofId(), name: p.sl, code: p.code, look: encodeColor(p.spec), one: p.pct * 2, both: p.pct * 3 }]) }
                        }} className="rounded-lg border border-gray-200 hover:border-gray-400 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">{T.addColor}</option>
                          {unused.map(p => <option key={p.sl} value={p.sl}>{p.sl}{p.code ? ` (${p.code})` : ''}</option>)}
                          <option value="__own">{T.ownColor}</option>
                        </select>
                      </div>}
                    </div>
                  </div>}
                </div>
              )})}
              {!MATERIALS.some(m => matOn[m]) && <p className="text-sm text-[#7f7f7f]">{T.colorsNoMaterial}</p>}
            </div>
          </Step>

          <Step n={5} title={T.hwTitle} hint={T.hwIntro}>
            <div className="space-y-5">
              <div>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {(['tilt_turn', 'turn', 'tilt', 'passive', 'slide_window', 'slide', 'lift_slide'] as const).map(k => (
                    <div key={k} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_240px_240px] gap-3 items-end px-3 py-2.5">
                      <div className="text-sm text-gray-900 pb-2">{T.hw[k]}</div>
                      <NumberInput label={T.hwFixed} unit={`${cur}/${T.perSash}`} value={pricing.hw[k]} onValue={v => setHw(k, v)} decimals={2} />
                      <NumberInput label={T.hwPerM} unit={`${cur}/m`} value={pricing.hw_m[k]} onValue={v => setHwM(k, v)} decimals={2} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Step>

          {/* 6. glass packages: purchase price per m² of glass, the first one is the base glass */}
          <Step n={6} title={T.glassTitle} hint={T.glassHint}>
            {(() => {
              const list = pricing.glass ?? []
              const setList = (next: GlassType[]) => { setPricing(x => ({ ...x, glass: next })); touch() }
              const set = (id: string, patch: Partial<GlassType>) => setList(list.map(g => g.id === id ? { ...g, ...patch } : g))
              return <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {list.map((g, i) => <div key={g.id} className="px-4 py-4 flex gap-4">
                    {/* the picture on the left, over the whole row */}
                    <div className="shrink-0 hidden sm:flex w-[84px] justify-center rounded-lg bg-gray-50 border border-gray-100 py-2 self-start"><GlassIcon layers={g.layers ?? 2} size={64} /></div>
                    <div className="flex-1 min-w-0 space-y-2">
                    {/* line 1: name, base badge, remove */}
                    <div className="flex items-center gap-3">
                      <input value={g.name} onChange={e => set(g.id, { name: e.target.value })} disabled={!canEdit} placeholder={T.glassName}
                        className="flex-1 min-w-0 rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {i === 0 && <span className="shrink-0 text-xs font-medium rounded-md px-2 py-1" style={{ color: '#007d53', backgroundColor: '#e0fced' }}>{T.baseIncluded}</span>}
                      {canEdit && list.length > 1 && <button type="button" onClick={() => askRemove(g.name, () => setList(list.filter(x => x.id !== g.id)))} title={T.remove}
                        className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    {/* line 2: Ug, panes, purchase price */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <NumberInput label={T.ugLabel} unit="W/m²K" value={g.ug ?? null} onValue={v => set(g.id, { ug: v })} decimals={1} />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-[#7f7f7f]">{T.glassLayers}</label>
                        <select value={g.layers ?? 2} disabled={!canEdit} onChange={e => set(g.id, { layers: Number(e.target.value) })}
                          className="rounded-lg border border-gray-200 hover:border-gray-400 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value={2}>{T.layers2}</option><option value={3}>{T.layers3}</option>
                        </select>
                      </div>
                      <NumberInput label={T.glassCost} unit={`${cur}/m²`} value={g.cost_m2} onValue={v => set(g.id, { cost_m2: v ?? 0 })} decimals={2} />
                    </div>
                    {/* line 3: description on the customer's card */}
                    <div>
                      <label className="block text-xs font-medium text-[#7f7f7f] mb-1">{T.glassDescLabel}</label>
                      <textarea value={g.description ?? ''} onChange={e => set(g.id, { description: e.target.value })} disabled={!canEdit} placeholder={T.glassDescPh} rows={2}
                        className="w-full resize-y rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    </div>
                  </div>)}
                </div>
                {canEdit && <button type="button" onClick={() => setList([...list, { id: newRoofId(), name: '', ug: null, layers: 2, cost_m2: 0 }])}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline"><Plus className="w-4 h-4" />{T.addGlass}</button>}
              </div>
            })()}
          </Step>

          {/* 7. handles: purchase price per handle, one per sash that opens with a handle */}
          <Step n={7} title={T.handleTitle} hint={T.handleHint}>
            {(() => {
              const list = pricing.handles ?? []
              const setList = (next: HandleType[]) => { setPricing(x => ({ ...x, handles: next })); touch() }
              const set = (id: string, patch: Partial<HandleType>) => setList(list.map(h => h.id === id ? { ...h, ...patch } : h))
              return <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {list.map((h, i) => {
                    return <div key={h.id} className="px-4 py-4 flex gap-4">
                      {/* the handle picture on the left: the supplier's photo, or the drawn handle in its colour */}
                      <div className="shrink-0 hidden sm:flex flex-col items-center gap-1.5 w-[104px] self-start">
                        <div className="w-full h-[92px] flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                          {uploadingKey === h.id ? <span className="text-xs text-[#7f7f7f]">…</span>
                            : h.image_url ? <img src={h.image_url} alt={h.name} className="max-w-full max-h-full object-contain p-1" />
                            : <HandleIcon look={h.look} lockable={h.lockable} size={64} />}
                        </div>
                        {canEdit && <div className="flex items-center gap-1">
                          <label className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />{h.image_url ? T.changePhoto : T.choosePhoto}
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadRoofPhoto(h.id, f, url => set(h.id, { image_url: url }), 'handles') }} />
                          </label>
                          {h.image_url && <button type="button" title={T.remove} onClick={() => askRemove('', () => set(h.id, { image_url: null }), T.handlePhotoRemoveMsg(h.name))}
                            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* line 1: name, base badge, remove */}
                        <div className="flex items-center gap-3">
                          <input value={h.name} onChange={e => set(h.id, { name: e.target.value })} disabled={!canEdit} placeholder={T.handleName}
                            className="flex-1 min-w-0 rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {i === 0 && <span className="shrink-0 text-xs font-medium rounded-md px-2 py-1" style={{ color: '#007d53', backgroundColor: '#e0fced' }}>{T.baseIncluded}</span>}
                          {canEdit && list.length > 1 && <button type="button" onClick={() => askRemove(h.name, () => setList(list.filter(x => x.id !== h.id)))} title={T.remove}
                            className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                        {/* line 2: colour, purchase price, with a key */}
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 items-start">
                          <HandleColorPicker label={T.handleColor} look={h.look} code={h.code} disabled={!canEdit} customLabel={T.customColor} customShort={T.customShort} lang={lang}
                            onChange={(look, code) => set(h.id, { look, code })} />
                          <NumberInput label={T.handleCost} unit={`${cur}/${T.perHandle}`} value={h.cost} onValue={v => set(h.id, { cost: v ?? 0 })} decimals={2} />
                        </div>
                        <Checkbox checked={!!h.lockable} onChange={v => { if (canEdit) set(h.id, { lockable: v }) }} label={T.handleKeyYes} />
                      </div>
                    </div>
                  })}
                </div>
                {canEdit && <button type="button" onClick={() => setList([...list, { id: newRoofId(), name: '', look: '#ffffff', cost: 0 }])}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline"><Plus className="w-4 h-4" />{T.addHandle}</button>}
              </div>
            })()}
          </Step>

          {/* 8. window sills: inside and outside, purchase price per metre of the window width */}
          <Step n={8} title={T.sillTitle} hint={T.sillHint}>
            {(() => {
              const all = pricing.sills ?? []
              const setAll = (next: SillType[]) => { setPricing(x => ({ ...x, sills: next })); touch() }
              const set = (id: string, patch: Partial<SillType>) => setAll(all.map(x => x.id === id ? { ...x, ...patch } : x))
              return <div className="space-y-5">
                {(['inner', 'outer'] as const).map(side => {
                  const list = all.filter(x => x.side === side)
                  return <div key={side}>
                    <div className="text-sm font-medium text-gray-900 mb-2">{side === 'inner' ? T.sillInner : T.sillOuter}</div>
                    {list.length > 0 && <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden mb-2">
                      {list.map(x => <div key={x.id} className="px-4 py-4 flex gap-4">
                        {/* picture: the supplier's photo, or the drawing of the material */}
                        <div className="shrink-0 hidden sm:flex flex-col items-center gap-1.5 w-[104px] self-start">
                          {!x.image_url && sillMaterialOf(x.material) === 'none' && uploadingKey !== x.id
                            // no material and no photo: the box itself asks for a picture
                            ? <label className={cn('w-full h-[80px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white text-xs font-medium text-gray-500', canEdit && 'cursor-pointer hover:border-gray-400 hover:text-gray-700')}>
                                <ImagePlus className="w-5 h-5" />{T.addPicture}
                                {canEdit && <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadRoofPhoto(x.id, f, url => set(x.id, { image_url: url }), 'sills') }} />}
                              </label>
                            : <div className="w-full h-[80px] flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                                {uploadingKey === x.id ? <span className="text-xs text-[#7f7f7f]">…</span>
                                  : x.image_url ? <img src={x.image_url} alt={x.name} className="max-w-full max-h-full object-contain p-1" />
                                  : <SillIcon material={x.material} size={64} />}
                              </div>}
                          {canEdit && (x.image_url || sillMaterialOf(x.material) !== 'none') && <div className="flex items-center gap-1">
                            <label className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />{x.image_url ? T.changePhoto : T.choosePhoto}
                              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadRoofPhoto(x.id, f, url => set(x.id, { image_url: url }), 'sills') }} />
                            </label>
                            {x.image_url && <button type="button" title={T.remove} onClick={() => askRemove('', () => set(x.id, { image_url: null }), T.sillPhotoRemoveMsg(x.name))}
                              className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-3">
                            <input value={x.name} onChange={e => set(x.id, { name: e.target.value })} disabled={!canEdit} placeholder={T.sillName}
                              className="flex-1 min-w-0 rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {canEdit && <button type="button" onClick={() => askRemove(x.name, () => setAll(all.filter(y => y.id !== x.id)))} title={T.remove}
                              className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-[#7f7f7f]">{T.sillMaterial}</label>
                              <select value={sillMaterialOf(x.material)} disabled={!canEdit} onChange={e => set(x.id, { material: e.target.value })}
                                className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 px-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {SILL_MATERIALS.map(mt => <option key={mt} value={mt}>{T.sillMaterials[mt]}</option>)}
                              </select>
                            </div>
                            <NumberInput label={T.sillCost} unit={`${cur}/m`} value={x.cost_m} onValue={v => set(x.id, { cost_m: v ?? 0 })} decimals={2} />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-[#7f7f7f] mb-1">{T.glassDescLabel}</label>
                              <textarea value={x.description ?? ''} onChange={e => set(x.id, { description: e.target.value })} disabled={!canEdit} placeholder={T.sillDescPh} rows={2}
                                className="w-full resize-y rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                      </div>)}
                    </div>}
                    {canEdit && (() => {
                      // standard sills that are not in the list (by name) can be added back with one click
                      const unused = STANDARD_SILLS.filter(st => st.side === side && !list.some(x => x.name.trim().toLowerCase() === st.name.toLowerCase()))
                      return <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setAll([...all, { id: newSillId(), side, name: '', material: 'none', cost_m: 0 }])}
                          className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline mr-2"><Plus className="w-4 h-4" />{side === 'inner' ? T.addSillInner : T.addSillOuter}</button>
                        {unused.length > 0 && <span className="text-xs font-medium text-[#7f7f7f]">{T.quickAdd}</span>}
                        {unused.map(st => <button key={st.name} type="button" onClick={() => setAll([...all, { ...st, id: newSillId() }])}
                          className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-400">
                          <SillIcon material={st.material} size={16} />+ {st.name}</button>)}
                      </div>
                    })()}
                  </div>
                })}
              </div>
            })()}
          </Step>

          {/* 9. shading and insect screens: purchase price per m² of the window, per opening sash or per piece */}
          <Step n={9} title={T.shadeTitle} hint={T.shadeHint}>
            {(() => {
              const all = pricing.shading ?? []
              const setAll = (next: ShadingType[]) => { setPricing(x => ({ ...x, shading: next })); touch() }
              const set = (id: string, patch: Partial<ShadingType>) => setAll(all.map(x => x.id === id ? { ...x, ...patch } : x))
              const upload = (id: string, f: File) => uploadRoofPhoto(id, f, url => set(id, { image_url: url }), 'shading')
              return <div className="space-y-5">
                {(['shade', 'screen'] as const).map(kind => {
                  const list = all.filter(x => x.kind === kind)
                  return <div key={kind}>
                    <div className="text-sm font-medium text-gray-900 mb-2">{kind === 'shade' ? T.shadeShades : T.shadeScreens}</div>
                    {list.length > 0 && <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden mb-2">
                      {list.map(x => {
                        const noPic = !x.image_url && (x.icon ?? 'none') === 'none'
                        return <div key={x.id} className="px-4 py-4 flex gap-4">
                          {/* picture: photo, drawing, or an empty box that asks for a picture */}
                          <div className="shrink-0 hidden sm:flex flex-col items-center gap-1.5 w-[104px] self-start">
                            {noPic && uploadingKey !== x.id
                              ? <label className={cn('w-full h-[80px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white text-xs font-medium text-gray-500', canEdit && 'cursor-pointer hover:border-gray-400 hover:text-gray-700')}>
                                  <ImagePlus className="w-5 h-5" />{T.addPicture}
                                  {canEdit && <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(x.id, f) }} />}
                                </label>
                              : <div className="w-full h-[80px] flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                                  {uploadingKey === x.id ? <span className="text-xs text-[#7f7f7f]">…</span>
                                    : x.image_url ? <img src={x.image_url} alt={x.name} className="max-w-full max-h-full object-contain p-1" />
                                    : <ShadingIcon kind={x.icon} size={64} />}
                                </div>}
                            {canEdit && !noPic && <div className="flex items-center gap-1">
                              <label className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer">
                                <Upload className="w-3.5 h-3.5" />{x.image_url ? T.changePhoto : T.choosePhoto}
                                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(x.id, f) }} />
                              </label>
                              {x.image_url && <button type="button" title={T.remove} onClick={() => askRemove('', () => set(x.id, { image_url: null }), T.shadePhotoRemoveMsg(x.name))}
                                className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>}
                            </div>}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-3">
                              <input value={x.name} onChange={e => set(x.id, { name: e.target.value })} disabled={!canEdit} placeholder={kind === 'shade' ? T.shadeNamePh : T.screenNamePh}
                                className="flex-1 min-w-0 rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              {canEdit && <button type="button" onClick={() => askRemove(x.name, () => setAll(all.filter(y => y.id !== x.id)))} title={T.remove}
                                className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-[#7f7f7f]">{T.shadeDrawing}</label>
                                <select value={x.icon ?? 'none'} disabled={!canEdit} onChange={e => { const icon = e.target.value as ShadingType['icon']; set(x.id, { icon, ...(icon === 'roller' || icon === 'blinds' ? {} : { allows_screen: false }) }) }}
                                  className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 px-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                  {SHADING_ICONS.filter(k => kind === 'shade' ? ['blinds', 'roller', 'pleated', 'none'].includes(k) : ['screen', 'screen_roll', 'screen_pleated', 'none'].includes(k)).map(k => <option key={k} value={k}>{T.shadeIcons[k]}</option>)}
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-[#7f7f7f]">{T.shadeUnit}</label>
                                <select value={x.unit} disabled={!canEdit} onChange={e => set(x.id, { unit: e.target.value as ShadingType['unit'] })}
                                  className="h-10 rounded-lg border border-gray-200 hover:border-gray-400 px-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                  {(['m2', 'sash'] as const).map(u => <option key={u} value={u}>{T.shadeUnits[u]}</option>)}
                                </select>
                              </div>
                              <NumberInput label={T.shadeMin} unit={cur} value={x.min ?? 0} onValue={v => set(x.id, { min: v ?? 0 })} decimals={2} />
                            </div>
                            {/* purchase prices, all four added up: for the whole window, or for every opening sash */}
                            <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3 items-start">
                              <NumberInput label={x.unit === 'sash' ? T.shadeFixedSash : T.shadeFixed} unit={cur} value={x.fixed ?? 0} onValue={v => set(x.id, { fixed: v ?? 0 })} decimals={2} />
                              <NumberInput label={x.unit === 'sash' ? T.shadePerWSash : T.shadePerW} unit={`${cur}/m`} value={x.per_w ?? 0} onValue={v => set(x.id, { per_w: v ?? 0 })} decimals={2} />
                              <NumberInput label={x.unit === 'sash' ? T.shadePerHSash : T.shadePerH} unit={`${cur}/m`} value={x.per_h ?? 0} onValue={v => set(x.id, { per_h: v ?? 0 })} decimals={2} />
                              <NumberInput label={x.unit === 'sash' ? T.shadeCostM2Sash : T.shadeCostM2} unit={`${cur}/m²`} value={x.cost} onValue={v => set(x.id, { cost: v ?? 0 })} decimals={2} />
                            </div>
                            {/* built-in insect screen: the shading allows it, the screen has its own (lower) prices for it */}
                            {kind === 'shade'
                              ? (x.icon === 'roller' || x.icon === 'blinds') && <Checkbox checked={!!x.allows_screen} onChange={v => { if (canEdit) set(x.id, { allows_screen: v }) }} label={T.allowsScreen} />
                              : <div className="space-y-2">
                                  <Checkbox checked={!!x.can_integrate} onChange={v => { if (canEdit) set(x.id, { can_integrate: v, integrated: x.integrated ?? {} }) }} label={T.canIntegrate} />
                                  {x.can_integrate && <div className="rounded-lg bg-[#f6f6f6] border border-gray-200 p-3">
                                    <div className="text-xs font-medium text-[#7f7f7f]">{T.integratedTitle}</div>
                                    <p className="text-xs text-[#7f7f7f] mt-0.5 mb-3">{T.integratedHint}</p>
                                    <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3 items-start">
                                      {(['fixed', 'per_w', 'per_h', 'cost'] as const).map(f => (
                                        <NumberInput key={f} label={f === 'fixed' ? T.shadeFixed : f === 'per_w' ? T.shadePerW : f === 'per_h' ? T.shadePerH : T.shadeCostM2}
                                          unit={f === 'fixed' ? cur : f === 'cost' ? `${cur}/m²` : `${cur}/m`}
                                          value={x.integrated?.[f] ?? 0} onValue={v => set(x.id, { integrated: { ...(x.integrated ?? {}), [f]: v ?? 0 } })} decimals={2} />
                                      ))}
                                    </div>
                                  </div>}
                                </div>}
                            <div>
                              <label className="block text-xs font-medium text-[#7f7f7f] mb-1">{T.glassDescLabel}</label>
                              <textarea value={x.description ?? ''} onChange={e => set(x.id, { description: e.target.value })} disabled={!canEdit} placeholder={T.shadeDescPh} rows={2}
                                className="w-full resize-y rounded-lg border border-gray-200 hover:border-gray-400 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                        </div>
                      })}
                    </div>}
                    {canEdit && (() => {
                      const unused = STANDARD_SHADING.filter(st => st.kind === kind && !list.some(x => x.name.trim().toLowerCase() === st.name.toLowerCase()))
                      return <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setAll([...all, { id: newSillId(), kind, name: '', unit: kind === 'shade' ? 'm2' : 'sash', icon: 'none', cost: 0 }])}
                          className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline mr-2"><Plus className="w-4 h-4" />{kind === 'shade' ? T.addShade : T.addScreen}</button>
                        {unused.length > 0 && <span className="text-xs font-medium text-[#7f7f7f]">{T.quickAdd}</span>}
                        {unused.map(st => <button key={st.name} type="button" onClick={() => setAll([...all, { ...st, id: newSillId() }])}
                          className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-gray-400">
                          <ShadingIcon kind={st.icon} size={16} />+ {st.name}</button>)}
                      </div>
                    })()}
                  </div>
                })}
              </div>
            })()}
          </Step>

          {/* 10+. extras and services (colour, glass and handles of built windows have their own steps) */}
          {sections.filter(sec => !OWN_STEP_GROUPS.includes(sec.group)).map((sec, i) => {
            const rows = options.filter(o => o.group_key === sec.group)
            const unused = sec.presets.filter(p => !rows.some(r => r.name.trim().toLowerCase() === p.name.toLowerCase()))
            return (
              <Step key={sec.group} n={i + 10} title={sec.title} hint={sec.hint}>
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
                      {canEdit && <button type="button" onClick={() => askRemove(r.name, () => removeOption(r))} title={T.remove} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
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

          {/* last: glass, labour, waste and margin (the margin goes on the whole window) */}
          <Step n={10 + sections.filter(sec => !OWN_STEP_GROUPS.includes(sec.group)).length} title={T.s3} hint={T.s3hint}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumberInput label={T.labourWindow} unit={cur} value={pricing.labour_window} onValue={v => setPrice({ labour_window: v ?? 0 })} decimals={2} />
              <NumberInput label={T.labourSash} unit={cur} value={pricing.labour_sash} onValue={v => setPrice({ labour_sash: v ?? 0 })} decimals={2} />
              <NumberInput label={T.waste} unit="%" value={pricing.waste_pct} onValue={v => setPrice({ waste_pct: v ?? 0 })} decimals={0} />
              <NumberInput label={T.margin} unit="%" value={pricing.margin_pct} onValue={v => setPrice({ margin_pct: v ?? 0 })} decimals={0} />
            </div>
          </Step>

          {/* worked example at the very bottom: the whole price of a double window without a mullion (passive + tilt & turn sash),
              with the first profile and the supplier's own prices from all steps above: data first, then the calculation step by step */}
          {(() => {
            const prof = profiles.find(p => matOn[p.material]) ?? profiles[0]
            const pp: ProfilePrices = prof ? toPrices(prof) : { frame_m: 0, sash_m: 0, mullion_m: 0, bead_m: 0 }
            const fw = pp.frame_w ?? 70, OV = 8
            const W = 1200, H = 1400
            const spec: WindowSpec = { ...makeSpec(2), main: [{ opening: 'passive', hinge: 'left' }, { opening: 'tilt_turn', hinge: 'right' }] }
            const calc = costWindow(specToLayout(spec), W, H, pp, pricing, { labels: CALC_LABELS[lang === 'en' ? 'en' : 'sl'] })
            const fxT = pricing.hw.passive ?? 0, pmT = pricing.hw_m.passive ?? 0
            const fxK = pricing.hw.tilt_turn ?? 0, pmK = pricing.hw_m.tilt_turn ?? 0
            const openW = (W - 2 * fw) / 2, openH = H - 2 * fw
            const sashW = openW + 2 * OV, sashH = openH + 2 * OV
            const per = 2 * (sashW + sashH) / 1000
            const tilt = fxT + pmT * per, tt = fxK + pmK * per
            const marginAmt = calc.price - calc.cost
            const n = (v: number, d = 2) => v.toLocaleString(lang === 'en' ? 'en-GB' : 'sl-SI', { minimumFractionDigits: d, maximumFractionDigits: d })
            const line = (label: string, value: React.ReactNode) => <div key={label} className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-x-4 gap-y-0.5 py-1">
              <span className="text-[#7f7f7f]">{label}</span><span className="text-gray-900 tabular-nums">{value}</span>
            </div>
            const step = (no: number, title: string, children: React.ReactNode) => <div className="rounded-lg bg-white border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center">{no}</span>
                <span className="text-sm font-medium text-gray-900">{title}</span>
              </div>
              <div className="text-sm">{children}</div>
            </div>
            const pname = prof?.name || T.exNoProfile
            return <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-5 space-y-6">
              <div>
                <div className="text-base font-medium text-gray-900">{T.exTitle}</div>
                <p className="text-sm text-gray-600 mt-1">{T.exIntro(n(W, 0), n(H, 0), pname)}</p>
              </div>
              {/* 1. the data, each with where it comes from */}
              <div>
                <div className="text-sm font-medium text-gray-900 mb-2">{T.exData}</div>
                <div className="rounded-lg bg-white border border-gray-200 divide-y divide-gray-100 text-sm">
                  {([
                    [T.exDataWindow, `${n(W, 0)} × ${n(H, 0)} mm`, T.exSrcExample],
                    [T.exDataFrame, `${n(fw, 0)} mm`, T.exSrcProfile(pname)],
                    [T.exDataProfileM, `${T.frameM} ${n(pp.frame_m)} €/m · ${T.sashM} ${n(pp.sash_m)} €/m · ${T.beadM} ${n(pp.bead_m)} €/m`, T.exSrcProfile(pname)],
                    [T.exDataOverlap, `${OV} mm`, T.exSrcFixed],
                    [T.exDataPassive, `${n(fxT)} € + ${n(pmT)} €/m`, T.exSrcTable(T.hw.passive)],
                    [T.exDataTt, `${n(fxK)} € + ${n(pmK)} €/m`, T.exSrcTable(T.hw.tilt_turn)],
                    [T.exDataGlass, `${glassOf(pricing)?.name ?? ''} ${n(glassOf(pricing)?.cost_m2 ?? pricing.glass_m2)} €/m²`, T.exSrcGlass],
                    [T.exDataHandle, `${handleOf(pricing)?.name ?? ''} ${n(handleOf(pricing)?.cost ?? 0)} €`, T.exSrcHandle],
                    [T.exDataLabour, `${n(pricing.labour_window)} € + 2 × ${n(pricing.labour_sash)} €`, T.exSrcLast],
                    [T.waste, `${n(pricing.waste_pct, 0)} %`, T.exSrcLast],
                    [T.margin, `${n(pricing.margin_pct, 0)} %`, T.exSrcLast],
                  ] as [string, string, string][]).map(([k, v, src]) => (
                    <div key={k} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-x-4 gap-y-0.5 px-4 py-2">
                      <span className="text-gray-700">{k}</span>
                      <span className="text-gray-900 font-medium tabular-nums">{v}</span>
                      <span className="text-xs font-medium text-[#7f7f7f] sm:self-center">{src}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 2. the calculation, one step at a time */}
              <div>
                <div className="text-sm font-medium text-gray-900 mb-2">{T.exCalc}</div>
                <div className="flex flex-col gap-3">
                  <div className="self-start rounded-lg bg-white border border-gray-200 p-3">
                    <SpecDrawing spec={spec} width={W} height={H} size={170} showDims />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    {step(1, T.exStepSize, <>
                      {line(T.exOpenW, <>({n(W, 0)} − 2 × {n(fw, 0)}) / 2 = {n(openW, 0)} mm</>)}
                      {line(T.exOpenH, <>{n(H, 0)} − 2 × {n(fw, 0)} = {n(openH, 0)} mm</>)}
                      {line(T.exSashW, <>{n(openW, 0)} + 2 × {OV} = {n(sashW, 0)} mm</>)}
                      {line(T.exSashH, <>{n(openH, 0)} + 2 × {OV} = {n(sashH, 0)} mm</>)}
                      {line(T.exPerimeterL, <>2 × ({n(sashW / 1000, 3)} m + {n(sashH / 1000, 3)} m) = <b className="font-medium">{n(per)} m</b></>)}
                    </>)}
                    {step(2, T.exStepHw, <>
                      {line(T.hw.passive, <>{n(fxT)} € + {n(pmT)} €/m × {n(per)} m = <b className="font-medium">{n(tilt)} €</b></>)}
                      {line(T.hw.tilt_turn, <>{n(fxK)} € + {n(pmK)} €/m × {n(per)} m = <b className="font-medium">{n(tt)} €</b></>)}
                      {line(T.exWindow, <>{n(tilt)} € + {n(tt)} € = <b className="font-medium">{n(tilt + tt)} €</b></>)}
                    </>)}
                    {step(3, T.exStepCost, <>
                      <p className="text-xs font-medium text-[#7f7f7f] mb-1">{T.exWasteNote(n(pricing.waste_pct, 0))}</p>
                      {calc.lines.map(l => line(l.label, <>{n(l.qty, l.unit === 'kos' ? 0 : 2)} {l.unit} × {n(l.price)} € = {n(l.total)} €</>))}
                      <div className="border-t border-gray-100 mt-1 pt-1">{line(T.cost, <b className="font-medium">{n(calc.cost)} €</b>)}</div>
                    </>)}
                    {step(4, T.exStepPrice, <>
                      {line(T.cost, <>{n(calc.cost)} €</>)}
                      {line(`${T.marginLine} ${n(pricing.margin_pct, 0)} %`, <>{n(calc.cost)} € × {n(pricing.margin_pct, 0)} % = {n(marginAmt)} €</>)}
                      {line(T.windowPrice, <>{n(calc.cost)} € + {n(marginAmt)} € = <b className="font-semibold text-base">{n(calc.price)} €</b> <span className="text-xs text-[#7f7f7f]">{T.exNoVat}</span></>)}
                    </>)}
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{T.exWords3(n(per), n(tilt + tt), n(calc.cost), n(pricing.margin_pct, 0), n(calc.price))}</p>
            </div>
          })()}

          <Link to="/windows/advanced" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><Settings2 className="w-4 h-4" />{T.advanced}</Link>
        </div>}
        </div>

      </div>

      {/* sticky save bar */}
      {canEdit && dirty && <div className="fixed bottom-0 right-0 left-0 lg:left-72 z-30 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3">
        <span className="text-sm font-medium text-[#7f7f7f]">{T.unsaved}</span>
        <Button onClick={save} loading={saving} className="gap-2"><Check className="w-4 h-4" />{T.save}</Button>
      </div>}
    </div>
  )
}

/** Row picture: drawn directly 64 px high, the same on every level (product groups, window types, top lights). */
function RowPic({ spec, width, height = 1300, slim = true }: { spec: WindowSpec; width: number; height?: number; slim?: boolean }) {
  return (
    <div className="w-[120px] h-[64px] flex items-center justify-center shrink-0">
      <SpecDrawing spec={spec} width={width} height={height} size={Math.round(64 * Math.max(width, height) / height)} plain slim={slim} />
    </div>
  )
}

/** "Select all" of a list: one tick with three states (all / some / none) at the top, in line with the ticks below. */
function AllRow({ all, some, onToggle, label, count, disabled, plain }: { all: boolean; some: boolean; onToggle: () => void; label: string; count: string; disabled?: boolean; plain?: boolean }) {
  return (
    <div className={cn('flex items-center gap-4', plain ? 'pb-1' : 'px-4 py-2.5 bg-gray-50')}>
      <button type="button" disabled={disabled} onClick={onToggle} title={all ? 'Počisti vse' : 'Izberi vse'}
        className={cn('w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 border', some ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
        {all ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : some ? <span className="w-2 h-0.5 rounded bg-white" /> : null}
      </button>
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <span className="text-xs font-medium text-[#7f7f7f]">{count}</span>
    </div>
  )
}


/** A product group in the price list: one row you open with the arrow. */
function Fold({ open, onToggle, title, summary, pic, children }: { open: boolean; onToggle: () => void; title: string; summary: string; pic: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border bg-white overflow-hidden transition-colors', open ? 'border-gray-300' : 'border-gray-200')}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50">
        <div className="w-[120px] h-[64px] flex items-center justify-center shrink-0">{pic}</div>
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


/** Handle colour: a dropdown (like the filters) with a colour circle per common colour; the last entry opens
 *  the colour picker, and a picked colour snaps to the nearest RAL. */
function HandleColorPicker({ label, look, code, disabled, onChange, customLabel, customShort, lang }: {
  label: string; look?: string; code?: string; disabled?: boolean; onChange: (look: string, code: string | undefined) => void
  customLabel: string; customShort: string; lang: string
}) {
  const [open, setOpen] = useState(false)
  // the menu is drawn over the whole page (portal), so no card or list can cut it off;
  // it opens upwards when there is not enough room below the field
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const shut = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('resize', shut)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', shut, true); window.removeEventListener('resize', shut) }
  }, [open])
  function toggle() {
    if (open) { setOpen(false); return }
    const b = btnRef.current?.getBoundingClientRect()
    if (!b) return
    const MENU_H = 360, below = window.innerHeight - b.bottom
    setPos(below < MENU_H && b.top > below
      ? { left: b.left, width: b.width, bottom: window.innerHeight - b.top + 4 }
      : { left: b.left, width: b.width, top: b.bottom + 4 })
    setOpen(true)
  }
  const spec = parseColor(look ?? '#ffffff')
  const preset = HANDLE_COLORS.find(c => c.look.toLowerCase() === (look ?? '').toLowerCase())
  const nameOf = (c: typeof HANDLE_COLORS[number]) => (lang === 'en' ? c.en : c.sl)
  const customCode = code || (spec ? `RAL ${ralNearest(spec.hex).code}` : '')
  const circle = (lk: string, size = 20) => { const sp = parseColor(lk); return sp ? <ColorSwatch spec={sp} size={size} rounded={size / 2} /> : null }
  return <div className="flex flex-col gap-1" ref={ref}>
    <span className="text-xs font-medium text-[#7f7f7f]">{label}</span>
    <div className="relative">
      <button ref={btnRef} type="button" disabled={disabled} onClick={toggle}
        className="w-full flex items-center gap-2 h-10 rounded-lg border border-gray-200 hover:border-gray-400 bg-white pl-2.5 pr-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:hover:border-gray-200">
        {circle(look ?? '#ffffff')}
        <span className="flex-1 min-w-0 truncate">
          <span className="text-gray-900">{preset ? nameOf(preset) : customShort}</span>
          <span className="text-[#7f7f7f]"> {preset ? preset.code ?? '' : customCode}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && createPortal(<div ref={menuRef} className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-max max-h-[80vh] overflow-y-auto"
        style={{ left: pos.left, minWidth: pos.width, top: pos.top, bottom: pos.bottom }}>
        {HANDLE_COLORS.map(c => {
          const on = preset?.look === c.look
          return <button key={c.look} type="button" onClick={() => { onChange(c.look, c.code); setOpen(false) }}
            className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-sm whitespace-nowrap hover:bg-[#f6f6f6] transition-colors', on ? 'text-gray-900 font-medium' : 'text-gray-700')}>
            {circle(c.look)}
            <span className="flex-1 text-left">{nameOf(c)}</span>
            {c.code && <span className="text-xs text-[#7f7f7f]">{c.code}</span>}
            <Check className={cn('w-3.5 h-3.5', on ? 'text-gray-900' : 'invisible')} />
          </button>
        })}
        <div className="my-1 border-t border-gray-100" />
        {/* own colour: opens the colour picker */}
        <button type="button" onClick={() => { setOpen(false); pickRef.current?.click() }}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm whitespace-nowrap text-gray-700 hover:bg-[#f6f6f6] transition-colors">
          <span className="w-5 h-5 rounded-full shrink-0 border border-dashed border-gray-300 bg-white flex items-center justify-center"><Pipette className="w-3 h-3 text-gray-500" /></span>
          <span className="flex-1 text-left">{customLabel}</span>
          {!preset && <span className="text-xs text-[#7f7f7f]">{customCode}</span>}
          <Check className={cn('w-3.5 h-3.5', !preset ? 'text-gray-900' : 'invisible')} />
        </button>
      </div>, document.body)}
      <input ref={pickRef} type="color" value={spec?.hex ?? '#ffffff'} tabIndex={-1} aria-hidden className="absolute left-2 bottom-0 w-6 h-0 opacity-0 pointer-events-none"
        onChange={e => { const near = ralNearest(e.target.value); onChange(encodeColor({ ...(spec ?? { finish: 'smooth' }), hex: near.hex } as any), `RAL ${near.code}`) }} />
    </div>
  </div>
}
