import { useNavigate } from 'react-router-dom'

// Subtle background grid pattern
const GridPattern = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(rgba(20,184,166,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20,184,166,0.04) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }}
  />
)

// Ambient glow behind headline
const AmbientGlow = () => (
  <div
    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
    style={{
      width: '600px',
      height: '400px',
      background: 'radial-gradient(ellipse at center, rgba(20,184,166,0.07) 0%, transparent 70%)',
    }}
  />
)

// Small stat pill
function StatPill({ label }) {
  return (
    <div
      className="flex items-center px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: 'rgba(20,184,166,0.08)',
        border: '1px solid rgba(20,184,166,0.2)',
        color: '#14b8a6',
      }}
    >
      {label}
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ backgroundColor: '#0a0f0f' }}
    >
      <GridPattern />
      <AmbientGlow />

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* Brand badge */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full mb-10 text-xs font-semibold tracking-widest uppercase"
          style={{
            backgroundColor: 'rgba(20,184,166,0.08)',
            border: '1px solid rgba(20,184,166,0.25)',
            color: '#14b8a6',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#14b8a6' }}
          />
          Car Compass
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-6 max-w-3xl"
          style={{ color: '#e8f5f5' }}
        >
          Pointing you towards{' '}
          <span style={{ color: '#14b8a6' }}>the right</span>{' '}
          direction.
        </h1>

        {/* Subtagline */}
        <p
          className="text-lg max-w-lg leading-relaxed mb-12"
          style={{ color: '#7fa8a8' }}
        >
           No research rabbit holes. <br></br>Just your perfect car, in 2 minutes.
        </p>

        {/* CTA */}
        <button
          id="start-journey-btn"
          onClick={() => navigate('/questionnaire')}
          className="
            px-8 py-4 rounded-xl text-sm font-semibold tracking-wide
            transition-all duration-200
            hover:scale-[1.02] active:scale-[0.98]
            cursor-pointer mb-12
          "
          style={{
            backgroundColor: '#14b8a6',
            color: '#0a0f0f',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0d9488'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#14b8a6'}
        >
          Start Your Journey →
        </button>

        {/* Social proof pills */}
        <div className="flex flex-wrap gap-3 justify-center">
          <StatPill label="25+ Cars Indexed" />
          <StatPill label="Results in 30 sec" />
          <StatPill label="Gemini AI Powered" />
          <StatPill label="Budget-first Matching" />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-xs select-none" style={{ color: '#3d6060' }}>
          Car Compass · AI-native car buying adviser
        </p>
      </footer>
    </div>
  )
}
