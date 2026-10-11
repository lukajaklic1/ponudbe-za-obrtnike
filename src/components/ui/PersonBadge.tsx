interface PersonBadgeProps {
  name: string
}

export function PersonBadge({ name }: PersonBadgeProps) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-200 text-sm font-medium text-gray-500 whitespace-nowrap" style={{ backgroundColor: '#fbfbfb' }}>
      <span
        className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
        style={{ backgroundColor: '#00d17e', width: 16, height: 16, fontSize: 9 }}
      >
        {letter}
      </span>
      {name}
    </span>
  )
}
