import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "gold" | "glass" | "ghost" | "danger" | "felt";
type Size = "sm" | "md" | "lg";

const base =
  "shine inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-[transform,filter,background,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300";

const variants: Record<Variant, string> = {
  gold: "btn-gold",
  glass: "glass text-cream hover:bg-white/10",
  ghost: "text-cream/80 hover:text-cream hover:bg-white/5",
  danger: "bg-gradient-to-b from-ruby-400 to-ruby-600 text-white shadow-[0_10px_30px_-10px_rgba(217,58,80,.7)] hover:brightness-110",
  felt: "bg-gradient-to-b from-felt-500 to-felt-700 text-white shadow-[0_10px_30px_-10px_rgba(19,119,79,.8)] ring-1 ring-white/10 hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-14 px-8 text-base",
};

export function Button({
  variant = "gold",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "gold",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
