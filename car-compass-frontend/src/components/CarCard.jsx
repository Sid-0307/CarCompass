// CarCard — display only. Why-not is now prefetched and controlled by Results.jsx.
const price_display = (car) => car.price_lakhs ?? car.price ?? '—'

export default function CarCard({ car, topPick, userPreferences }) {
  const price = price_display(car)
  const score = car.final_score

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200"
      style={{
        backgroundColor: '#0d1717',
        border: '1px solid #1a2e2e',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#243d3d'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1a2e2e'}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs tracking-widest uppercase font-semibold mb-1" style={{ color: '#14b8a6' }}>
            {car.brand}
          </p>
          <h3 className="text-lg font-semibold leading-tight" style={{ color: '#e8f5f5' }}>
            {car.model}
            {car.variant && (
              <span className="text-base font-normal ml-1" style={{ color: '#7fa8a8' }}>
                {car.variant}
              </span>
            )}
          </h3>
        </div>
        {car.body_type && (
          <span
            className="shrink-0 text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{
              border: '1px solid #1a2e2e',
              color: '#7fa8a8',
              backgroundColor: 'rgba(20,184,166,0.05)',
            }}
          >
            {car.body_type}
          </span>
        )}
      </div>

      {/* Price + Score */}
      <div className="flex items-center justify-between">
        <span className="text-xl font-semibold" style={{ color: '#e8f5f5' }}>
          ₹{price}{' '}
          <span className="text-sm font-normal" style={{ color: '#7fa8a8' }}>Lakhs</span>
        </span>
        {score !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: '#14b8a6' }}>
              {typeof score === 'number' ? score.toFixed(1) : score}
            </span>
            <span className="text-xs" style={{ color: '#3d6060' }}>/10</span>
          </div>
        )}
      </div>

      {/* Extra info pills */}
      <div className="flex flex-wrap gap-1.5">
        {car.fuel_type && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: '#7fa8a8', backgroundColor: 'rgba(127,168,168,0.08)', border: '1px solid #1a2e2e' }}
          >
            {car.fuel_type}
          </span>
        )}
        {car.fuel_efficiency_kmpl && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: '#7fa8a8', backgroundColor: 'rgba(127,168,168,0.08)', border: '1px solid #1a2e2e' }}
          >
            {car.fuel_efficiency_kmpl} kmpl
          </span>
        )}
        {car.seating_capacity && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: '#7fa8a8', backgroundColor: 'rgba(127,168,168,0.08)', border: '1px solid #1a2e2e' }}
          >
            {car.seating_capacity} seats
          </span>
        )}
      </div>
    </div>
  )
}
