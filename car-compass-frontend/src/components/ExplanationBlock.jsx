export default function ExplanationBlock({ loading, text }) {
  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 md:p-8"
        style={{
          backgroundColor: '#0d1717',
          border: '1px solid #1a2e2e',
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#14b8a6' }}
          />
          <p className="text-xs tracking-widest uppercase font-semibold" style={{ color: '#14b8a6' }}>
            AI Adviser
          </p>
        </div>
        <div className="space-y-3">
          <div className="h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#1a2e2e', width: '100%' }} />
          <div className="h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#1a2e2e', width: '85%' }} />
          <div className="h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#1a2e2e', width: '92%' }} />
          <div className="h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#1a2e2e', width: '70%' }} />
        </div>
        <p className="text-xs mt-4" style={{ color: '#3d6060' }}>
          Our adviser is thinking...
        </p>
      </div>
    )
  }

  if (!text) return null

  return (
    <div
      className="rounded-2xl p-6 md:p-8"
      style={{
        backgroundColor: '#0d1717',
        border: '1px solid #1a2e2e',
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#14b8a6' }}
        />
        <p className="text-xs tracking-widest uppercase font-semibold" style={{ color: '#14b8a6' }}>
          AI Adviser
        </p>
      </div>
      <p className="text-sm font-normal leading-relaxed" style={{ color: '#aaaaaa' }}>
        {text}
      </p>
    </div>
  )
}
