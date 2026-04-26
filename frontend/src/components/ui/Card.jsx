export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`card ${hover ? 'hover:border-stellar-accent/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
