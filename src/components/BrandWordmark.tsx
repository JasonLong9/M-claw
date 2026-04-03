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
      ? { markSize: 18, gap: 10, fontSize: 28, glow: '0 0 18px rgba(247,103,7,0.34)' }
      : resolvedSize === 'titlebar'
        ? { markSize: 10, gap: 6, fontSize: 12, glow: '0 0 6px rgba(247,103,7,0.28)' }
        : { markSize: 14, gap: 8, fontSize: 16, glow: '0 0 10px rgba(247,103,7,0.32)' }

  return (
    <div className="flex items-center select-none" style={{ gap: metrics.gap }}>
      <span
        aria-hidden="true"
        style={{
          width: metrics.markSize,
          height: metrics.markSize,
          borderRadius: '999px',
          background:
            'radial-gradient(circle at 35% 35%, rgba(255,183,77,1) 0%, rgba(247,103,7,1) 65%, rgba(176,58,0,1) 100%)',
          boxShadow: metrics.glow,
          flexShrink: 0,
        }}
      />
      <span className={textClassName} style={{ fontSize: metrics.fontSize, fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}>
        Mclaw
      </span>
    </div>
  )
}
