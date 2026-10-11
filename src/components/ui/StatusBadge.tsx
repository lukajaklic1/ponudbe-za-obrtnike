interface StatusBadgeProps {
  active: boolean
  labelActive: string
  labelInactive: string
}

export function StatusBadge({ active, labelActive, labelInactive }: StatusBadgeProps) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs whitespace-nowrap" style={{ color: '#007d53', backgroundColor: '#e0fced', border: '1px solid #cbf7e1' }}>
      {labelActive}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-gray-200 text-xs text-gray-500 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}>
      {labelInactive}
    </span>
  )
}
