import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectOption<V extends string | number = string> {
  value: V
  label: ReactNode
  /** small grey text on the right (e.g. a code) */
  hint?: ReactNode
}

interface Props<V extends string | number> {
  value: V | null | undefined
  options: SelectOption<V>[]
  onChange: (value: V) => void
  disabled?: boolean
  /** text on the button when nothing is chosen */
  placeholder?: ReactNode
  /** md = like an input (h-10), sm = in tables and toolbars (h-9), xs = tiny (pagination) */
  size?: 'md' | 'sm' | 'xs'
  className?: string
  /** label above the field */
  label?: ReactNode
  align?: 'left' | 'right'
}

/**
 * Dropdown in the app's own style: a white cloud drawn over the whole page (portal, so no card cuts it off),
 * opening upwards when there is no room below. Replaces the browser's native <select>.
 */
export default function Select<V extends string | number>({ value, options, onChange, disabled, placeholder, size = 'md', className, label, align = 'left' }: Props<V>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left?: number; right?: number; width: number; top?: number; bottom?: number }>({ width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const shut = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('resize', shut)
    return () => {
      document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', shut, true); window.removeEventListener('resize', shut)
    }
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    const b = btnRef.current?.getBoundingClientRect()
    if (!b) return
    const menuH = Math.min(320, options.length * 34 + 10), below = window.innerHeight - b.bottom
    const x = align === 'right' ? { right: window.innerWidth - b.right } : { left: b.left }
    setPos(below < menuH && b.top > below
      ? { ...x, width: b.width, bottom: window.innerHeight - b.top + 4 }
      : { ...x, width: b.width, top: b.bottom + 4 })
    setOpen(true)
  }

  const current = options.find(o => String(o.value) === String(value ?? ''))
  const h = size === 'md' ? 'h-10 text-sm pl-3 pr-2' : size === 'sm' ? 'h-9 text-sm pl-2.5 pr-1.5' : 'h-7 text-xs font-medium pl-2 pr-1.5'

  const button = (
    <button ref={btnRef} type="button" disabled={disabled} onClick={toggle}
      className={cn('w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
        'hover:border-gray-400 disabled:hover:border-gray-200 disabled:bg-gray-50 disabled:text-[#52525b] disabled:cursor-default', open && 'border-gray-400', h, className)}>
      <span className="flex-1 min-w-0 truncate">
        {current ? <span className="text-gray-900">{current.label}</span> : <span className="text-[#484848]">{placeholder ?? ''}</span>}
        {current?.hint && <span className="text-[#484848]"> {current.hint}</span>}
      </span>
      {!disabled && <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />}
    </button>
  )

  return (
    <>
      {label ? <div className="flex flex-col gap-1"><span className="field-label text-xs font-medium text-[#484848]">{label}</span>{button}</div> : button}
      {open && createPortal(
        <div ref={menuRef} role="listbox"
          className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-max max-h-[320px] overflow-y-auto"
          style={{ left: pos.left, right: pos.right, minWidth: pos.width, top: pos.top, bottom: pos.bottom }}>
          {options.map(o => {
            const on = String(o.value) === String(value ?? '')
            return <button key={String(o.value)} type="button" role="option" aria-selected={on}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-sm whitespace-nowrap text-left hover:bg-[#f6f6f6] transition-colors', on ? 'text-gray-900 font-medium' : 'text-gray-700')}>
              <span className="flex-1">{o.label}</span>
              {o.hint && <span className="text-xs font-normal text-[#484848]">{o.hint}</span>}
              <Check className={cn('w-3.5 h-3.5 shrink-0', on ? 'text-gray-900' : 'invisible')} />
            </button>
          })}
        </div>, document.body)}
    </>
  )
}
