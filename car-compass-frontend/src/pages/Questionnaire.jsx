import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProgressBar from '../components/ProgressBar.jsx'
import QuestionCard from '../components/QuestionCard.jsx'
import { getRecommendations } from '../api/client.js'

// ── Pill button ───────────────────────────────────────────────────────────────
function Pill({ label, selected, onClick, disabled, fullWidth }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${fullWidth ? 'w-full ' : ''}px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer`}
      style={{
        backgroundColor: selected ? '#14b8a6' : 'transparent',
        color: selected ? '#0a0f0f' : '#e8f5f5',
        border: selected ? '1.5px solid #14b8a6' : '1.5px solid #1a2e2e',
        boxShadow: selected ? '0 0 16px rgba(20,184,166,0.3)' : 'none',
        opacity: disabled && !selected ? 0.3 : 1,
        cursor: disabled && !selected ? 'not-allowed' : 'pointer',
        fontWeight: selected ? 600 : 500,
      }}
      onMouseEnter={e => {
        if (!selected && !disabled) {
          e.currentTarget.style.borderColor = '#14b8a6'
          e.currentTarget.style.color = '#14b8a6'
        }
      }}
      onMouseLeave={e => {
        if (!selected && !disabled) {
          e.currentTarget.style.borderColor = '#1a2e2e'
          e.currentTarget.style.color = '#e8f5f5'
        }
      }}
    >
      {label}
    </button>
  )
}

// ── Sortable drag item ────────────────────────────────────────────────────────
function SortableItem({ id, rank, label }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.95 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: isDragging ? '#0d1f1f' : '#0d1717',
        border: isDragging ? '1.5px solid #14b8a6' : '1.5px solid #1a2e2e',
        boxShadow: isDragging ? '0 8px 30px rgba(0,0,0,0.4)' : 'none',
        transform: isDragging ? `${style.transform} scale(1.03)` : style.transform,
      }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
    >
      {/* Rank badge */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          backgroundColor: isDragging ? 'rgba(20,184,166,0.2)' : 'rgba(20,184,166,0.1)',
          color: '#14b8a6',
          border: '1px solid rgba(20,184,166,0.25)',
        }}
      >
        {rank}
      </div>

      {/* Label */}
      <span className="text-sm font-medium flex-1" style={{ color: '#e8f5f5' }}>
        {label}
      </span>

      {/* Drag handle */}
      <button
        className="touch-none p-1 -mr-1 shrink-0 transition-colors duration-150"
        style={{ color: '#3d6060', cursor: isDragging ? 'grabbing' : 'grab' }}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        onMouseEnter={e => e.currentTarget.style.color = '#14b8a6'}
        onMouseLeave={e => e.currentTarget.style.color = '#3d6060'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.3"/>
          <circle cx="10" cy="3" r="1.3"/>
          <circle cx="4" cy="7" r="1.3"/>
          <circle cx="10" cy="7" r="1.3"/>
          <circle cx="4" cy="11" r="1.3"/>
          <circle cx="10" cy="11" r="1.3"/>
        </svg>
      </button>
    </div>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────
const PRIORITY_META = {
  safety:      { label: 'Safety' },
  mileage:     { label: 'Mileage' },
  features:    { label: 'Features' },
  performance: { label: 'Performance' },
}

const BUDGET_OPTIONS = [
  { label: 'Under ₹10L',  min: 0,  max: 10  },
  { label: '₹10L – ₹20L', min: 10, max: 20  },
  { label: '₹20L – ₹30L', min: 20, max: 30  },
  { label: '₹30L – ₹50L', min: 30, max: 50  },
  { label: 'Above ₹50L',  min: 50, max: 100 },
]

const PASSENGER_OPTIONS = [
  { label: 'Just Me (1-2)', value: '1-2' },
  { label: 'Small Family (3-4)', value: '3-4' },
  { label: 'Large Family (5+)', value: '5+' },
]
const USAGE_OPTIONS = [
  { label: 'City Commute', value: 'city' },
  { label: 'Highway Trips', value: 'highway' },
  { label: 'Mixed', value: 'mixed' },
]
const BODY_OPTIONS = [
  { label: 'Hatchback', value: 'hatchback' },
  { label: 'Sedan', value: 'sedan' },
  { label: 'SUV', value: 'suv' },
  { label: 'MUV', value: 'muv' },
  { label: 'No Preference', value: 'no_preference' },
]
const BRAND_OPTIONS = [
  'Maruti', 'Hyundai', 'Tata', 'Mahindra', 'Honda',
  'Toyota', 'Kia', 'MG', 'Skoda', 'Volkswagen', 'Jeep', 'BMW', 'Mercedes',
]
const BRAND_MAX = 5

// Background grid
const GridPattern = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(rgba(20,184,166,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20,184,166,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }}
  />
)

export default function Questionnaire() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // ── Answers ──
  const [budget, setBudget] = useState(null)           // { min, max, label }
  const [passengers, setPassengers] = useState(null)
  const [primaryUsage, setPrimaryUsage] = useState(null)
  const [bodyType, setBodyType] = useState(null)
  const [preferredBrands, setPreferredBrands] = useState([])
  const [priorities, setPriorities] = useState(['safety', 'mileage', 'features', 'performance'])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setPriorities((prev) => {
        const oldIdx = prev.indexOf(active.id)
        const newIdx = prev.indexOf(over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  const toggleBrand = (brand) => {
    setPreferredBrands((prev) => {
      if (prev.includes(brand)) return prev.filter((b) => b !== brand)
      if (prev.length >= BRAND_MAX) return prev
      return [...prev, brand]
    })
  }

  const isStepValid = () => {
    if (step === 1) return budget !== null
    if (step === 2) return passengers !== null
    if (step === 3) return primaryUsage !== null
    if (step === 4) return bodyType !== null
    if (step === 5) return true
    if (step === 6) return true
    return false
  }

  const handleNext = async () => {
    if (!isStepValid()) return

    if (step < 6) {
      setStep((s) => s + 1)
      return
    }

    // Step 6 — submit
    setSubmitting(true)
    setError(null)

    const payload = {
      budget_min_lakhs: budget.min,
      budget_lakhs: budget.max,
      passengers,
      primary_usage: primaryUsage,
      body_type: bodyType,
      preferred_brands: preferredBrands,
      priorities,
    }

    try {
      const data = await getRecommendations(payload)
      navigate('/results', { state: { ...data, user_preferences: payload } })
    } catch (err) {
      setError('Could not reach the server. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1)
  }

  const stepHints = ['Budget', 'Passengers', 'Usage', 'Body Type', 'Brands', 'Priorities']

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ backgroundColor: '#0a0f0f' }}
    >
      <GridPattern />

      {/* Header */}
      <header className="relative z-10 px-6 pt-8 pb-4 max-w-xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="text-sm font-medium transition-all duration-200"
            style={{
              color: step === 1 ? 'transparent' : '#7fa8a8',
              pointerEvents: step === 1 ? 'none' : 'auto',
              cursor: step === 1 ? 'default' : 'pointer',
            }}
            onMouseEnter={e => { if (step > 1) e.currentTarget.style.color = '#14b8a6' }}
            onMouseLeave={e => { if (step > 1) e.currentTarget.style.color = '#7fa8a8' }}
          >
            ← Back
          </button>
          <span className="text-xs font-medium" style={{ color: '#3d6060' }}>
            {stepHints[step - 1]}
          </span>
        </div>
        <ProgressBar current={step} total={6} />
      </header>

      {/* Question area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">

        {/* Step 1 — Budget */}
        {step === 1 && (
          <QuestionCard label="Budget">
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#e8f5f5' }}>
              What's your budget?
            </h2>
            <p className="text-sm mb-8" style={{ color: '#7fa8a8' }}>
              We'll only show cars you can actually afford.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BUDGET_OPTIONS.map((opt) => (
                <Pill
                  key={opt.max}
                  label={opt.label}
                  selected={budget?.max === opt.max}
                  onClick={() => setBudget(opt)}
                />
              ))}
            </div>
          </QuestionCard>
        )}

        {/* Step 2 — Passengers */}
        {step === 2 && (
          <QuestionCard label="Passengers">
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#e8f5f5' }}>
              How many people travel with you?
            </h2>
            <p className="text-sm mb-8" style={{ color: '#7fa8a8' }}>
              This determines seating and comfort scoring.
            </p>
            <div className="flex flex-col gap-3">
              {PASSENGER_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  selected={passengers === opt.value}
                  onClick={() => setPassengers(opt.value)}
                />
              ))}
            </div>
          </QuestionCard>
        )}

        {/* Step 3 — Usage */}
        {step === 3 && (
          <QuestionCard label="Primary Usage">
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#e8f5f5' }}>
              Where will you drive most?
            </h2>
            <p className="text-sm mb-8" style={{ color: '#7fa8a8' }}>
              City and highway drive very differently — your match depends on it.
            </p>
            <div className="flex flex-col gap-3">
              {USAGE_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  selected={primaryUsage === opt.value}
                  onClick={() => setPrimaryUsage(opt.value)}
                />
              ))}
            </div>
          </QuestionCard>
        )}

        {/* Step 4 — Body Type */}
        {step === 4 && (
          <QuestionCard label="Body Type">
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#e8f5f5' }}>
              Any body type preference?
            </h2>
            <p className="text-sm mb-8" style={{ color: '#7fa8a8' }}>
              Not sure? Pick "No Preference" and we'll handle it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {BODY_OPTIONS.map((opt) => (
                <div key={opt.value} className={opt.value === 'no_preference' ? 'col-span-2' : ''}>
                  <Pill
                    label={opt.label}
                    selected={bodyType === opt.value}
                    onClick={() => setBodyType(opt.value)}
                    fullWidth
                  />
                </div>
              ))}
            </div>
          </QuestionCard>
        )}

        {/* Step 5 — Brands */}
        {step === 5 && (
          <QuestionCard label="Preferred Brands">
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#e8f5f5' }}>
              Any brand loyalty?
            </h2>
            <p className="text-sm mb-8" style={{ color: '#7fa8a8' }}>
              Optional — leave blank to see all brands. Pick up to 5.
            </p>
            <div className="flex flex-wrap gap-2.5 mb-4">
              {BRAND_OPTIONS.map((brand) => {
                const selected = preferredBrands.includes(brand)
                const maxed = preferredBrands.length >= BRAND_MAX && !selected
                return (
                  <Pill
                    key={brand}
                    label={brand}
                    selected={selected}
                    disabled={maxed}
                    onClick={() => toggleBrand(brand)}
                  />
                )
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              {preferredBrands.length > 0 ? (
                <span className="text-xs font-medium" style={{ color: '#14b8a6' }}>
                  {preferredBrands.length}/{BRAND_MAX} selected
                </span>
              ) : (
                <span className="text-xs" style={{ color: '#3d6060' }}>
                  No filter applied — all brands included
                </span>
              )}
              {preferredBrands.length > 0 && (
                <button
                  onClick={() => setPreferredBrands([])}
                  className="text-xs transition-colors duration-200"
                  style={{ color: '#3d6060', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#7fa8a8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3d6060'}
                >
                  Clear all
                </button>
              )}
            </div>
          </QuestionCard>
        )}

        {/* Step 6 — Priorities */}
        {step === 6 && (
          <QuestionCard label="Rank Your Priorities">
            <h2 className="text-2xl font-semibold mb-2" style={{ color: '#e8f5f5' }}>
              What matters most to you?
            </h2>
            <p className="text-xs mb-3" style={{ color: '#7fa8a8' }}>
              Your #1 choice carries the most weight.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={priorities} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {priorities.map((id, index) => (
                    <SortableItem
                      key={id}
                      id={id}
                      rank={index + 1}
                      label={PRIORITY_META[id].label}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </QuestionCard>
        )}

        {/* Error */}
        {error && (
          <p
            className="mt-6 text-sm text-center max-w-sm px-4 py-3 rounded-xl"
            style={{
              color: '#f87171',
              backgroundColor: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
            }}
          >
            {error}
          </p>
        )}
      </main>

      {/* CTA footer */}
      <footer className="relative z-10 px-6 pb-10 pt-4 flex justify-center">
        <button
          onClick={handleNext}
          disabled={!isStepValid() || submitting}
          className="px-10 py-4 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200"
          style={{
            backgroundColor: isStepValid() && !submitting ? '#14b8a6' : '#0d2020',
            color: isStepValid() && !submitting ? '#0a0f0f' : '#3d6060',
            cursor: isStepValid() && !submitting ? 'pointer' : 'not-allowed',
            transform: 'scale(1)',
          }}
          onMouseEnter={e => {
            if (isStepValid() && !submitting) {
              e.currentTarget.style.backgroundColor = '#0d9488'
              e.currentTarget.style.transform = 'scale(1.02)'
            }
          }}
          onMouseLeave={e => {
            if (isStepValid() && !submitting) {
              e.currentTarget.style.backgroundColor = '#14b8a6'
              e.currentTarget.style.transform = 'scale(1)'
            }
          }}
        >
          {submitting
            ? 'Analysing your match...'
            : step === 6
            ? 'Find My Car →'
            : 'Continue →'
          }
        </button>
      </footer>
    </div>
  )
}