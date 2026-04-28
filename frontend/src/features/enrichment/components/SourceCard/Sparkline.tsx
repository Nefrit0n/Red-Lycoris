export function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const d = points.map((p, i) => `${(i / Math.max(points.length - 1, 1)) * 200},${22 - (p / max) * 20}`).join(' ');
  return <svg width='100%' height='22' viewBox='0 0 200 22'><polyline fill='none' stroke='currentColor' strokeWidth='2' points={d} className='text-emerald-400' /></svg>;
}
