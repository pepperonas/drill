import { decodePolyline } from '../lib/activity.js';

/**
 * Tiny dependency-free SVG preview of a GPS route (aspect-preserving,
 * longitude corrected by cos(lat)). Used in the activities list; the detail
 * view uses a full MapLibre map.
 */
export function RouteThumb({ polyline, size = 84, stroke = 'var(--primary)' }) {
  const pts = decodePolyline(polyline);
  const box = {
    width: size, height: size, borderRadius: 'var(--shape-md)',
    background: 'var(--surface-container-highest)', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  if (pts.length < 2) return <div style={box}>🗺️</div>;

  const midLat = ((Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2) * Math.PI / 180;
  const xs = pts.map((p) => p[1] * Math.cos(midLat));
  const ys = pts.map((p) => p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const pad = 0.12;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const proj = (i) => {
    const x = ((xs[i] - cx) / span + 0.5) * (1 - 2 * pad) + pad;
    const y = 0.5 - (ys[i] - cy) / span; // invert lat for screen y
    const yy = (y * (1 - 2 * pad) + pad);
    return `${(x * 100).toFixed(1)},${(yy * 100).toFixed(1)}`;
  };
  const d = 'M' + pts.map((_, i) => proj(i)).join(' L');
  return (
    <div style={box}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <path d={d} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={proj(0).split(',')[0]} cy={proj(0).split(',')[1]} r="3.5" fill="var(--on-surface-variant)" />
        <circle cx={proj(pts.length - 1).split(',')[0]} cy={proj(pts.length - 1).split(',')[1]} r="3.5" fill={stroke} />
      </svg>
    </div>
  );
}
