import type { PriceCategory, PriceUnit } from '../types/database'

// Starter price list for painters / facade work (net prices, editable after import).
export const STARTER: { code: string; category: PriceCategory; unit: PriceUnit; price: number; sl: string; en: string }[] = [
  { code: 'P01', category: 'prep',     unit: 'm2',   price: 1.5,  sl: 'Zaščita tal in pohištva s folijo', en: 'Floor and furniture protection with foil' },
  { code: 'P02', category: 'prep',     unit: 'm',    price: 1.2,  sl: 'Lepljenje zaščitnega traku', en: 'Masking tape application' },
  { code: 'P03', category: 'prep',     unit: 'm2',   price: 2.5,  sl: 'Strganje stare barve', en: 'Scraping old paint' },
  { code: 'G01', category: 'plaster',  unit: 'm2',   price: 4.5,  sl: 'Krpanje razpok in poškodb', en: 'Patching cracks and damage' },
  { code: 'G02', category: 'plaster',  unit: 'm2',   price: 7.0,  sl: 'Glajenje sten (2×)', en: 'Wall skimming (2 coats)' },
  { code: 'G03', category: 'plaster',  unit: 'm2',   price: 3.0,  sl: 'Brušenje in odpraševanje', en: 'Sanding and dust removal' },
  { code: 'B01', category: 'painting', unit: 'm2',   price: 1.2,  sl: 'Impregnacija (globinski temelj)', en: 'Primer (deep penetrating)' },
  { code: 'B02', category: 'painting', unit: 'm2',   price: 4.5,  sl: 'Beljenje sten – bela, 2×', en: 'Wall painting – white, 2 coats' },
  { code: 'B03', category: 'painting', unit: 'm2',   price: 5.5,  sl: 'Beljenje stropov – bela, 2×', en: 'Ceiling painting – white, 2 coats' },
  { code: 'B04', category: 'painting', unit: 'm2',   price: 6.5,  sl: 'Barvanje sten – barvni ton, 2×', en: 'Wall painting – colour, 2 coats' },
  { code: 'B05', category: 'painting', unit: 'm',    price: 4.0,  sl: 'Ločna linija (dva tona)', en: 'Cut-in line between two colours' },
  { code: 'L01', category: 'painting', unit: 'pcs',  price: 45,   sl: 'Lakiranje notranjih vrat', en: 'Interior door varnishing' },
  { code: 'L02', category: 'painting', unit: 'm',    price: 6.0,  sl: 'Pleskanje radiatorskih cevi', en: 'Painting radiator pipes' },
  { code: 'F01', category: 'facade',   unit: 'm2',   price: 32,   sl: 'Fasada – EPS 10 cm, lepilo, mrežica', en: 'Facade – EPS 10 cm, adhesive, mesh' },
  { code: 'F02', category: 'facade',   unit: 'm2',   price: 9,    sl: 'Zaključni sloj – silikonski omet', en: 'Finish coat – silicone render' },
  { code: 'F03', category: 'facade',   unit: 'm',    price: 8,    sl: 'Vogalniki in zaključne letve', en: 'Corner beads and trims' },
  { code: 'F04', category: 'facade',   unit: 'lump', price: 450,  sl: 'Postavitev in najem odra', en: 'Scaffolding setup and rental' },
  { code: 'D01', category: 'decor',    unit: 'm2',   price: 18,   sl: 'Dekorativna tehnika (beton, apno)', en: 'Decorative finish (concrete look, lime)' },
  { code: 'O01', category: 'other',    unit: 'h',    price: 28,   sl: 'Dodatna dela po urah', en: 'Additional work, hourly' },
  { code: 'O02', category: 'other',    unit: 'lump', price: 60,   sl: 'Čiščenje po končanih delih', en: 'Final cleaning' },
]

