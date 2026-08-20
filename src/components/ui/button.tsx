import { cn } from "@/lib/cn";
import { ArrowUpRight } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "gold" | "ghost" | "outline";
type Size = "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] transition-all duration-300 ease-out rounded-full whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  /** Dark navy button with bright white text. Use on light backgrounds. */
  primary:
    "bg-navy text-white hover:bg-gold hover:text-navy hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5 active:translate-y-0",
  /** Gold accent button. Use on dark navy or plum backgrounds. */
  gold:
    "bg-gold text-white hover:bg-gold-dark hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5 active:translate-y-0",
  ghost:
    "text-navy hover:text-gold-dark",
  outline:
    "border border-navy/20 text-navy bg-transparent hover:bg-navy hover:text-white hover:border-navy",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
type LinkProps = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & { href: string };

export function Button({
  variant = "primary",
  size = "md",
  withArrow,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
      {withArrow && (
        <ArrowUpRight
          className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
          aria-hidden
        />
      )}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  withArrow,
  className,
  children,
  ...props
}: LinkProps) {
  return (
    <a
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
      {withArrow && (
        <ArrowUpRight
          className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
          aria-hidden
        />
      )}
    </a>
  );
}
