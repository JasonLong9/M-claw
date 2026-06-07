import logoUrl from '../assets/logo.png'

interface BrandWordmarkProps {
  compact?: boolean
  muted?: boolean
  size?: 'titlebar' | 'body' | 'hero'
}

export default function BrandWordmark({
  compact = false,
  muted = false,
  size,
}: BrandWordmarkProps) {
  const resolvedSize = size || (compact ? 'titlebar' : 'body')
  const textClassName = muted ? 'app-text-faint' : 'app-text-primary'
  const metrics =
    resolvedSize === 'hero'
      ? { markSize: 34, gap: 10, fontSize: 28, radius: 8 }
      : resolvedSize === 'titlebar'
        ? { markSize: 18, gap: 6, fontSize: 12, radius: 4 }
        : { markSize: 24, gap: 8, fontSize: 16, radius: 6 }

  return (
    <div className="flex items-center select-none" style={{ gap: metrics.gap }}>
      <img
        src={logoUrl}
        alt=""
        style={{
          width: metrics.markSize,
          height: metrics.markSize,
          borderRadius: metrics.radius,
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <span className={textClassName} style={{ fontSize: metrics.fontSize, fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}>
        Mclaw
      </span>
    </div>
  )
}
