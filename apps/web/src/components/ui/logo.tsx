import Link from "next/link";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Felt home">
      <span
        className={`relative grid place-items-center rounded-full gold-border ${size === "lg" ? "h-11 w-11" : "h-9 w-9"}`}
      >
        <span className={`gold-text font-display leading-none ${size === "lg" ? "text-2xl" : "text-xl"}`}>♠</span>
      </span>
      <span className={`font-display font-semibold tracking-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}>
        <span className="gold-text">Felt</span>
      </span>
    </Link>
  );
}
