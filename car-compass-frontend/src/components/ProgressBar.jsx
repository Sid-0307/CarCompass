export default function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs tracking-widest uppercase font-semibold"
          style={{ color: '#14b8a6' }}
        >
          Step {current} of {total}
        </span>
        <span className="text-xs font-mono" style={{ color: '#3d6060' }}>
          {pct}%
        </span>
      </div>
      {/* Track */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: '3px', backgroundColor: '#1a2e2e' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: '#14b8a6',
            boxShadow: '0 0 8px rgba(20,184,166,0.6)',
          }}
        />
      </div>
    </div>
  )
}
