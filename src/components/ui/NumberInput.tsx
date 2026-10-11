import { useState } from 'react'
import Input from './Input'

interface Props {
  id?: string
  label?: string
  unit?: string
  className?: string
  value: number | null
  onValue: (v: number | null) => void
  decimals?: number
}

function fmt(n: number, decimals?: number): string {
  return n.toLocaleString('de-DE', decimals != null
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : { maximumFractionDigits: 4 })
}

// Parse de-DE style input: dots = thousands, comma = decimal.
function parse(s: string): number | null {
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export default function NumberInput({ value, onValue, decimals, ...rest }: Props) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const display = focused ? draft : (value == null ? '' : fmt(value, decimals))

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={() => { setDraft(value == null ? '' : String(value).replace('.', ',')); setFocused(true) }}
      onBlur={() => setFocused(false)}
      onChange={e => { setDraft(e.target.value); onValue(parse(e.target.value)) }}
    />
  )
}
