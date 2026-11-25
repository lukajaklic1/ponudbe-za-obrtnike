import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  unit?: string
  /** shows a dark red star after the label (the field must be filled in) */
  requiredMark?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, unit, requiredMark, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="field-label text-xs font-medium" style={{ color: '#5e5e5e' }}>
            {label}{requiredMark && <span className="req-star" aria-hidden> *</span>}
          </label>
        )}
        {unit ? (
          <div className={cn(
            'field-control flex items-center rounded-lg border bg-white transition-colors focus-within:ring-2 focus-within:ring-blue-500',
            error ? 'border-red-400 bg-red-50 focus-within:ring-red-400' : 'border-gray-200 hover:border-gray-400',
          )}>
            <input
              ref={ref}
              id={id}
              className={cn('flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none', className)}
              {...props}
            />
            <span className="px-3 text-sm text-gray-400 whitespace-nowrap border-l border-gray-200 self-stretch flex items-center">{unit}</span>
          </div>
        ) : (
          <input
            ref={ref}
            id={id}
            className={cn(
              'field-control block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-[#5e5e5e] disabled:border-[#eeeff1] disabled:cursor-not-allowed',
              error
                ? 'border-red-400 bg-red-50 focus:ring-red-400'
                : 'border-gray-200 bg-white hover:border-gray-400',
              className,
            )}
            {...props}
          />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

export default Input
