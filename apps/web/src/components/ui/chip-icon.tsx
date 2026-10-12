/** A small casino chip glyph for bankroll displays. */
export function ChipIcon({ className = "h-5 w-5", color = "#d4a94f" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill={color} />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="5" strokeDasharray="6 8.9" />
      <circle cx="20" cy="20" r="12.5" fill={color} stroke="#000" strokeOpacity=".25" strokeWidth="1" />
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}
