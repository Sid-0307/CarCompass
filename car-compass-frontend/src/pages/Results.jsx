import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import CarCard from '../components/CarCard.jsx'
import ExplanationBlock from '../components/ExplanationBlock.jsx'
import { getExplanation, getWhyNot } from '../api/client.js'

// Teal score breakdown bar
function ScoreBar({ label, value }) {
  const pct = Math.min(100, Math.max(0, (value / 10) * 100))
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 shrink-0 capitalize" style={{ color: '#7fa8a8' }}>
        {label.replace(/_/g, ' ')}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: '3px', backgroundColor: '#1a2e2e' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: '#14b8a6',
            boxShadow: pct > 60 ? '0 0 6px rgba(20,184,166,0.5)' : 'none',
          }}
        />
      </div>
      <span className="text-xs font-mono w-6 text-right shrink-0" style={{ color: '#3d6060' }}>
        {typeof value === 'number' ? value.toFixed(1) : value}
      </span>
    </div>
  )
}

// Spec row — no emojis
function SpecRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: '#7fa8a8' }}>{label}</span>
      <span className="text-xs font-medium ml-auto" style={{ color: '#e8f5f5' }}>{value}</span>
    </div>
  )
}

// Markdown stripper — Fix 5
const stripMarkdown = (text) => {
  if (!text) return text
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1')
    .trim()
}

// Background grid
const GridPattern = () => (
  <div
    className="fixed inset-0 pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(rgba(20,184,166,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20,184,166,0.02) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }}
  />
)

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const data = location.state

  // Fix 5 + explanation state
  const [explanationLoading, setExplanationLoading] = useState(true)
  const [explanationText, setExplanationText] = useState(null)

  // Fix 4 — prefetched why-not state
  const [whyNot0, setWhyNot0] = useState(null)
  const [whyNot1, setWhyNot1] = useState(null)
  const [showWhyNot0, setShowWhyNot0] = useState(false)
  const [showWhyNot1, setShowWhyNot1] = useState(false)

  // Fix 7 — collapsible score breakdown
  const [showBreakdown, setShowBreakdown] = useState(true)

  if (!data) return <Navigate to="/" replace />

  const topPick = data.top_pick || data.recommendation || data
  const alternatives = data.alternatives || []
  const userPreferences = data.user_preferences || {}
  const scoreBreakdown = topPick.score_breakdown || {}
  const price = topPick.price_lakhs ?? topPick.price ?? '—'

  // Prefetch explain and both why-not calls on mount
  useEffect(() => {
    // /explain
    getExplanation({
      user_preferences: userPreferences,
      top_pick: topPick,
      alternatives,
    })
      .then((res) => setExplanationText(stripMarkdown(res.explanation || res.text || 'No explanation available.')))
      .catch(() => setExplanationText('Our adviser is unavailable at the moment.'))
      .finally(() => setExplanationLoading(false))

    // /why-not prefetch for alternative 0
    if (alternatives[0]) {
      getWhyNot({
        user_preferences: userPreferences,
        rejected_car: alternatives[0],
        top_pick: topPick,
      })
        .then((res) => setWhyNot0(stripMarkdown(res.explanation || '')))
        .catch(() => setWhyNot0('Could not load comparison at this time.'))
    }

    // /why-not prefetch for alternative 1
    if (alternatives[1]) {
      getWhyNot({
        user_preferences: userPreferences,
        rejected_car: alternatives[1],
        top_pick: topPick,
      })
        .then((res) => setWhyNot1(stripMarkdown(res.explanation || '')))
        .catch(() => setWhyNot1('Could not load comparison at this time.'))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleWhyNot0 = () => setShowWhyNot0(v => !v)
  const handleWhyNot1 = () => setShowWhyNot1(v => !v)

  return (
    <div className="min-h-screen py-12 px-6" style={{ backgroundColor: '#0a0f0f' }}>
      <GridPattern />
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">

        {/* ── Fix 8: Top Pick Card ─────────────────────────── */}
        <div
          className="rounded-2xl p-8"
          style={{
            backgroundColor: '#0d1717',
            border: '1px solid #1a2e2e',
            boxShadow: '0 0 60px rgba(20,184,166,0.06)',
          }}
        >
          {/* 1. YOUR TOP PICK label */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#14b8a6' }} />
            <p className="text-xs tracking-widest uppercase font-semibold" style={{ color: '#14b8a6' }}>
              Your Top Pick
            </p>
          </div>

          {/* 2. Car name, variant, price, body type badge */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-3xl font-semibold leading-tight mb-1" style={{ color: '#e8f5f5' }}>
                {[topPick.brand, topPick.model].filter(Boolean).join(' ')}
              </h1>
              {topPick.variant && (
                <p className="text-base font-medium mb-2" style={{ color: '#7fa8a8' }}>
                  {topPick.variant}
                </p>
              )}
              <p className="text-2xl font-bold" style={{ color: '#14b8a6' }}>
                ₹{price}{' '}
                <span className="text-base font-normal" style={{ color: '#7fa8a8' }}>Lakhs</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {topPick.body_type && (
                <span
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    border: '1px solid #1a2e2e',
                    color: '#7fa8a8',
                    backgroundColor: 'rgba(20,184,166,0.05)',
                  }}
                >
                  {topPick.body_type}
                </span>
              )}
            </div>
          </div>

          {/* 3. Specs grid — no emojis */}
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-2 mb-6 p-4 rounded-xl"
            style={{ backgroundColor: '#0a1414', border: '1px solid #1a2e2e' }}
          >
            <SpecRow label="Fuel" value={topPick.fuel_type} />
            <SpecRow label="Power" value={topPick.power_bhp ? `${topPick.power_bhp} bhp` : null} />
            <SpecRow label="Efficiency" value={topPick.fuel_efficiency_kmpl ? `${topPick.fuel_efficiency_kmpl} kmpl` : null} />
            <SpecRow label="Seating" value={topPick.seating_capacity ? `${topPick.seating_capacity} seats` : null} />
          </div>

          {/* 4. Match score — always visible */}
          {topPick.final_score !== undefined && (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-bold" style={{ color: '#14b8a6' }}>
                  {typeof topPick.final_score === 'number'
                    ? topPick.final_score.toFixed(1)
                    : topPick.final_score}
                </span>
                <span className="text-lg" style={{ color: '#3d6060' }}>/10</span>
                <span className="text-xs uppercase tracking-widest ml-2 font-medium" style={{ color: '#3d6060' }}>
                  Match Score
                </span>
              </div>

              {/* 5. Fix 7: Collapsible score breakdown */}
              {Object.keys(scoreBreakdown).length > 0 && (
                <div>
                  <button
                    onClick={() => setShowBreakdown(v => !v)}
                    className="text-xs transition-colors duration-200 mb-3"
                    style={{ color: '#555555', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#7fa8a8'}
                    onMouseLeave={e => e.currentTarget.style.color = '#555555'}
                  >
                    {showBreakdown ? 'Hide breakdown ↑' : 'See score breakdown ↓'}
                  </button>

                  <div
                    className="overflow-hidden transition-all duration-200"
                    style={{ maxHeight: showBreakdown ? '200px' : '0px', opacity: showBreakdown ? 1 : 0 }}
                  >
                    <div className="space-y-3 pb-2">
                      {Object.entries(scoreBreakdown).map(([key, val]) => (
                        <ScoreBar key={key} label={key} value={val} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Fix 8: AI Adviser directly below top pick ─────── */}
        <ExplanationBlock loading={explanationLoading} text={explanationText} />

        {/* ── Fix 8: Alternatives ───────────────────────────── */}
        {alternatives.length > 0 && (
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold mb-4" style={{ color: '#7fa8a8' }}>
              Alternatives
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Alternative 0 */}
              {alternatives[0] && (
                <div className="flex flex-col gap-3">
                  <CarCard car={alternatives[0]} topPick={topPick} userPreferences={userPreferences} />
                  <div style={{ borderTop: '1px solid #1a2e2e' }} className="pt-2">
                    <button
                      onClick={handleWhyNot0}
                      className="text-sm transition-all duration-200"
                      style={{ color: '#7fa8a8', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#14b8a6'}
                      onMouseLeave={e => e.currentTarget.style.color = '#7fa8a8'}
                    >
                      {showWhyNot0 ? 'Hide comparison ↑' : 'Why not this? →'}
                    </button>
                    {showWhyNot0 && (
                      <p
                        className="text-sm leading-relaxed mt-2"
                        style={{ color: '#7fa8a8' }}
                      >
                        {whyNot0 ?? 'Comparing...'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Alternative 1 */}
              {alternatives[1] && (
                <div className="flex flex-col gap-3">
                  <CarCard car={alternatives[1]} topPick={topPick} userPreferences={userPreferences} />
                  <div style={{ borderTop: '1px solid #1a2e2e' }} className="pt-2">
                    <button
                      onClick={handleWhyNot1}
                      className="text-sm transition-all duration-200"
                      style={{ color: '#7fa8a8', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#14b8a6'}
                      onMouseLeave={e => e.currentTarget.style.color = '#7fa8a8'}
                    >
                      {showWhyNot1 ? 'Hide comparison ↑' : 'Why not this? →'}
                    </button>
                    {showWhyNot1 && (
                      <p
                        className="text-sm leading-relaxed mt-2"
                        style={{ color: '#7fa8a8' }}
                      >
                        {whyNot1 ?? 'Comparing...'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Start Over ────────────────────────────────────── */}
        <div className="pt-2 pb-8 text-center">
          <button
            id="start-over-btn"
            onClick={() => navigate('/')}
            className="text-sm transition-all duration-200"
            style={{ color: '#3d6060', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = '#7fa8a8'}
            onMouseLeave={e => e.currentTarget.style.color = '#3d6060'}
          >
            ← Start Over
          </button>
        </div>

      </div>
    </div>
  )
}
