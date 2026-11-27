import type { WindowCalc } from '../lib/windowCalc'

const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
const num = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

/**
 * The open calculation of one window: every cost line at the purchase price, then material and labour,
 * the margins and how the price per piece comes out. Nothing is hidden: it is the supplier's own page.
 */
export default function WindowCalcTable({ calc, lang, saved }: { calc: WindowCalc; lang: 'sl' | 'en'; saved?: number | null }) {
  const sl = lang === 'sl'
  const T = sl
    ? { title: 'Kalkulacija', item: 'Postavka', qty: 'Količina', price: 'Nabavna cena', cost: 'Nabavna vrednost', material: 'Material', labour: 'Delo', all: 'Nabavna vrednost skupaj',
        marginMat: 'Marža na material', marginLab: 'Marža na delo', alone: 'Cena okna', additions: 'Dodatki (steklo, kljuka, police, senčila …)', unit: 'Cena na kos',
        profit: 'Marža na kos', min: 'Najnižja cena profila', calc: 'izračunano', applied: 'velja najnižja cena', colour: 'Doplačilo za barvo', sale: 'Prodajna cena', differs: 'Cena v ponudbi se razlikuje (ročno spremenjena):', roof: 'Cena iz kataloga strešnih oken' }
    : { title: 'Calculation', item: 'Item', qty: 'Quantity', price: 'Purchase price', cost: 'Purchase value', material: 'Material', labour: 'Labour', all: 'Total purchase value',
        marginMat: 'Margin on material', marginLab: 'Margin on labour', alone: 'Window price', additions: 'Additions (glass, handle, sills, shading …)', unit: 'Price per piece',
        profit: 'Margin per piece', min: 'Profile lowest price', calc: 'calculated', applied: 'the lowest price applies', colour: 'Colour surcharge', sale: 'Sale price', differs: 'The price on the quote differs (edited by hand):', roof: 'Price from the roof window catalogue' }
  const unitLabel = (u: string) => (u === 'kos' ? (sl ? 'kos' : 'pcs') : u)
  const matMargin = Math.round(calc.material * calc.materialMarginPct) / 100
  const labMargin = Math.round(calc.labour * calc.labourMarginPct) / 100
  const roof = calc.kind === 'roof'
  return (
    <div className="rounded-xl border border-gray-200 bg-[#fbfbfb] p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-sm font-semibold text-gray-900">{T.title}{calc.system ? <span className="font-normal text-[#5e5e5e]"> · {calc.system}</span> : null}</div>
        {calc.colorPct > 0 && <div className="text-xs text-[#7f7f7f]">{T.colour}: +{num(calc.colorPct)} %</div>}
      </div>
      {/* plain grid, not a table: the app's table styles would make the rows tall */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-4 text-xs leading-5 tabular-nums">
        <div className="font-medium text-[#5e5e5e] pb-1">{T.item}</div>
        <div className="font-medium text-[#5e5e5e] pb-1 text-right whitespace-nowrap">{T.qty}</div>
        <div className="font-medium text-[#5e5e5e] pb-1 text-right whitespace-nowrap">{roof ? T.sale : T.price}</div>
        <div className="font-medium text-[#5e5e5e] pb-1 text-right whitespace-nowrap">{roof ? T.sale : T.cost}</div>
        {calc.lines.map(l => (
          <div key={l.key} className="contents">
            <div className="py-1 border-t border-gray-200 text-gray-900">
              {l.label}
              {l.how && <div className="text-[11px] leading-4 text-[#7f7f7f] whitespace-normal">{l.how}</div>}
            </div>
            <div className="py-1 border-t border-gray-200 text-right text-[#5e5e5e] whitespace-nowrap">{num(l.qty)} {unitLabel(l.unit)}</div>
            <div className="py-1 border-t border-gray-200 text-right text-[#5e5e5e] whitespace-nowrap">{eur(l.price)}</div>
            <div className="py-1 border-t border-gray-200 text-right text-gray-900 whitespace-nowrap">{eur(l.total)}</div>
          </div>
        ))}
      </div>
      {roof ? <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold text-gray-900"><span>{T.roof}</span><span className="tabular-nums">{eur(calc.unitPrice)}</span></div> : <>
        <dl className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-xs tabular-nums">
          <dt className="text-[#5e5e5e]">{T.material}</dt><dd className="text-right text-gray-900">{eur(calc.material)}</dd>
          <dt className="text-[#5e5e5e]">{T.labour}</dt><dd className="text-right text-gray-900">{eur(calc.labour)}</dd>
          <dt className="font-medium text-gray-900">{T.all}</dt><dd className="text-right font-medium text-gray-900">{eur(calc.cost)}</dd>
          <dt className="text-[#5e5e5e]">{T.marginMat} ({num(calc.materialMarginPct)} %)</dt><dd className="text-right text-gray-900">+ {eur(matMargin)}</dd>
          <dt className="text-[#5e5e5e]">{T.marginLab} ({num(calc.labourMarginPct)} %)</dt><dd className="text-right text-gray-900">+ {eur(labMargin)}</dd>
        </dl>
        <dl className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-xs tabular-nums">
          <dt className="text-[#5e5e5e]">{T.alone}{calc.minApplied && <span className="text-[#8a6100]"> · {T.min} {eur(calc.minPrice)} &gt; {T.calc} {eur(calc.calculatedAlone)}: {T.applied}</span>}</dt>
          <dd className="text-right text-gray-900">{eur(calc.windowAlone)}</dd>
          {calc.additions !== 0 && <><dt className="text-[#5e5e5e]">{T.additions}</dt><dd className="text-right text-gray-900">{calc.additions > 0 ? '+ ' : '− '}{eur(Math.abs(calc.additions))}</dd></>}
          <dt className="text-sm font-semibold text-gray-900">{T.unit}</dt><dd className="text-right text-sm font-semibold text-gray-900">{eur(calc.unitPrice)}</dd>
          <dt className="text-[#5e5e5e]">{T.profit}</dt>
          <dd className="text-right text-[#267a47]">{eur(calc.margin)}{calc.unitPrice > 0 && <span className="text-[#5e5e5e]"> ({num(Math.round(calc.margin / calc.unitPrice * 1000) / 10)} %)</span>}</dd>
        </dl>
      </>}
      {saved != null && Math.abs(saved - calc.unitPrice) > 0.01 && <div className="mt-2 text-xs text-[#8a6100]">{T.differs} {eur(saved)}</div>}
    </div>
  )
}
