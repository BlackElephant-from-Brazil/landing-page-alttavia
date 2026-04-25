import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  tone?: "ink" | "cream";
};

export function Logo({ className, tone = "ink" }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="Alttavia"
      width={170}
      height={136}
      className={cn(
        "h-9 w-auto",
        tone === "cream" && "brightness-0 invert",
        className
      )}
      priority
    />
  );
}
