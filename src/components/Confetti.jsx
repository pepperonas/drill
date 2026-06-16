// Lightweight CSS confetti burst — rendered briefly on peak moments (level-up,
// achievement unlock). Deterministic spread (no RNG), themed chart colors.
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function Confetti({ pieces = 30 }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => (
        <span key={i} className="confetti-piece" style={{
          left: `${(i * 36.7) % 100}%`,
          background: COLORS[i % COLORS.length],
          '--delay': `${(i % 6) * 45}ms`,
          '--dur': `${1100 + (i % 5) * 190}ms`,
          '--rot': `${(i * 53) % 360}deg`,
          '--drift': `${((i % 7) - 3) * 20}px`,
        }} />
      ))}
    </div>
  );
}
