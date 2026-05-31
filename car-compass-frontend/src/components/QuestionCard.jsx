export default function QuestionCard({ label, children }) {
  return (
    <div
      className="w-full max-w-xl mx-auto rounded-2xl p-8 md:p-10"
      style={{
        backgroundColor: '#0d1717',
        border: '1px solid #1a2e2e',
        boxShadow: '0 0 40px rgba(20,184,166,0.05)',
      }}
    >
      {label && (
        <p
          className="text-xs tracking-widest uppercase font-semibold mb-5"
          style={{ color: '#14b8a6' }}
        >
          {label}
        </p>
      )}
      {children}
    </div>
  )
}
