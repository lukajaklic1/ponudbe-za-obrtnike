import { useId } from 'react'
import { PhotoDefs, PhotoGlass, Profile, photoIds } from './photoParts'

/**
 * Roof window lying in the roof slope, seen from the front: the top edge leans back
 * (shifted right), like the usual roof window pictures. The dashed line marks the pivot.
 */
export default function RoofWindowDrawing({ size = 100, opening, frameColor = '#fbfbfa', className, photo = false }: { size?: number; opening?: 'center' | 'top'; frameColor?: string; className?: string; photo?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const axisY = opening === 'top' ? -28 : -2
  if (photo) {
    // product-photo look: grey flashing around the window, mitred frame and sash, neutral glass
    const ids = photoIds(uid)
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden>
        <defs><PhotoDefs ids={ids} /></defs>
        <ellipse cx={48} cy={92} rx={26} ry={2.4} fill="#1b2430" opacity={0.16} filter={`url(#${ids.floor})`} />
        <g transform="translate(50 50) skewX(-20)">
          {/* the window lies in the roof slope: the lower side of the frame shows below it */}
          <rect x={-24.5} y={-36.5} width={49} height={75} rx={1} fill="#d4d6d7" stroke="#2a323b" strokeOpacity={0.3} strokeWidth={0.5} />
          {/* frame and sash */}
          <rect x={-24.5} y={-40.5} width={49} height={75} fill={frameColor} />
          <Profile x={-24.5} y={-40.5} w={49} h={75} t={4.5} color={frameColor} />
          <rect x={-20} y={-36} width={40} height={66} fill="#1b2430" fillOpacity={0.2} />
          <Profile x={-19.5} y={-35.5} w={39} h={65} t={4.6} color={frameColor} />
          <PhotoGlass x={-14.9} y={-30.9} w={29.8} h={55.8} ids={ids} />
          {opening && <line x1={-19} y1={axisY} x2={19} y2={axisY} stroke="#7c7f82" strokeWidth={1} strokeDasharray="3 2" />}
          {/* the handle bar on the top of the sash */}
          <rect x={-8} y={-35} width={16} height={2.4} rx={1} fill="#e9eaec" stroke="#4d535a" strokeWidth={0.4} />
        </g>
      </svg>
    )
  }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden>
      <g transform="translate(50 50) skewX(-20)">
        {/* frame depth (side of the frame visible below) */}
        <rect x={-24} y={-36} width={48} height={76} rx={1.5} fill="#d4d6d7" stroke="#5b6168" strokeWidth={1} />
        {/* frame + sash + glass */}
        <rect x={-24} y={-40} width={48} height={76} rx={1.5} fill={frameColor} stroke="#5b6168" strokeWidth={1.3} />
        <rect x={-19} y={-35} width={38} height={66} rx={1} fill={frameColor} stroke="#5b6168" strokeWidth={0.9} />
        <rect x={-15} y={-30.5} width={30} height={57} fill="#cfe3f3" stroke="#5b6168" strokeWidth={0.8} />
        <line x1={-10} y1={-18} x2={-2} y2={-24} stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
        {opening && <line x1={-19} y1={axisY} x2={19} y2={axisY} stroke="#7c7f82" strokeWidth={1} strokeDasharray="3 2" />}
        {/* handle on the lower edge */}
        <rect x={-6} y={27.5} width={12} height={2.6} rx={0.8} fill="#5b6168" />
      </g>
    </svg>
  )
}
