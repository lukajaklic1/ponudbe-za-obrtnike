import type { PriceCategory, PriceUnit } from '../types/database'

// Starter list of services for window suppliers / installers (net prices, editable after import).
// Windows themselves are priced in the window catalog (systems × types × price matrix).
export const STARTER: { code: string; category: PriceCategory; unit: PriceUnit; price: number; sl: string; en: string }[] = [
  { code: 'I01', category: 'measure',     unit: 'lump', price: 40,   sl: 'Izmera na objektu', en: 'On-site measurement' },
  { code: 'I02', category: 'measure',     unit: 'h',    price: 35,   sl: 'Svetovanje in ogled', en: 'Consulting and site visit' },
  { code: 'D01', category: 'removal',     unit: 'pcs',  price: 35,   sl: 'Demontaža starega okna', en: 'Removal of old window' },
  { code: 'D02', category: 'removal',     unit: 'pcs',  price: 55,   sl: 'Demontaža starih balkonskih vrat', en: 'Removal of old balcony door' },
  { code: 'D03', category: 'removal',     unit: 'lump', price: 80,   sl: 'Odvoz in ekološka odstranitev odpada', en: 'Disposal of old windows' },
  { code: 'M01', category: 'install',     unit: 'pcs',  price: 60,   sl: 'Klasična montaža okna (PU pena, sidra)', en: 'Standard window installation (PU foam, anchors)' },
  { code: 'M02', category: 'install',     unit: 'pcs',  price: 95,   sl: 'RAL montaža okna (tesnilni trakovi)', en: 'RAL installation (sealing tapes)' },
  { code: 'M03', category: 'install',     unit: 'pcs',  price: 120,  sl: 'Montaža balkonskih vrat', en: 'Balcony door installation' },
  { code: 'M04', category: 'install',     unit: 'pcs',  price: 25,   sl: 'Montaža notranje police', en: 'Interior sill installation' },
  { code: 'M05', category: 'install',     unit: 'pcs',  price: 30,   sl: 'Montaža zunanje police', en: 'Exterior sill installation' },
  { code: 'M06', category: 'install',     unit: 'pcs',  price: 70,   sl: 'Montaža zunanjih žaluzij / rolet', en: 'External blinds / shutter installation' },
  { code: 'M07', category: 'install',     unit: 'm',    price: 18,   sl: 'Zidarska obdelava špalet', en: 'Reveal plastering' },
  { code: 'A01', category: 'accessories', unit: 'm',    price: 22,   sl: 'Notranja polica PVC (po meri)', en: 'Interior PVC sill (custom)' },
  { code: 'A02', category: 'accessories', unit: 'm',    price: 28,   sl: 'Zunanja ALU polica (po meri)', en: 'Exterior aluminium sill (custom)' },
  { code: 'A03', category: 'accessories', unit: 'pcs',  price: 65,   sl: 'Komarnik (okvirni)', en: 'Insect screen (frame)' },
  { code: 'A04', category: 'accessories', unit: 'm',    price: 6,    sl: 'Zaključna letvica', en: 'Cover trim' },
  { code: 'T01', category: 'transport',   unit: 'lump', price: 50,   sl: 'Dostava na objekt', en: 'Delivery to site' },
  { code: 'T02', category: 'transport',   unit: 'lump', price: 0.6,  sl: 'Kilometrina (na km)', en: 'Mileage (per km)' },
  { code: 'O01', category: 'other',       unit: 'h',    price: 32,   sl: 'Dodatna dela po urah', en: 'Additional work, hourly' },
  { code: 'O02', category: 'other',       unit: 'lump', price: 45,   sl: 'Čiščenje po montaži', en: 'Cleaning after installation' },
]
