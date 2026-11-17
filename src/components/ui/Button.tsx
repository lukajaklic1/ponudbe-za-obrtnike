import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={variant === 'danger' ? { backgroundColor: '#ff5454', border: '1px solid #f04f4f' } : undefined}
        onMouseEnter={variant === 'danger' ? e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f04f4f' } : undefined}
        onMouseLeave={variant === 'danger' ? e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ff5454' } : undefined}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-[0_1px_2px_rgba(16,24,40,0.12),inset_0_1px_0_rgba(255,255,255,0.15)]': variant === 'primary',
            'bg-white text-gray-700 border border-[#d5d9e0] hover:bg-gray-50 focus:ring-blue-500 shadow-[0_1px_2px_rgba(16,24,40,0.06)]': variant === 'secondary',
            'text-gray-600 hover:text-gray-900 hover:bg-[#f6f6f6] focus:ring-gray-400': variant === 'ghost',
            'text-white focus:ring-red-400': variant === 'danger',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export default Button
