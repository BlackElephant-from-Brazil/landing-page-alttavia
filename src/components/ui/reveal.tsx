"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const smooth = [0.22, 0.61, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

type RevealProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "header" | "footer";
};

export function Reveal({
  children,
  delay = 0,
  duration = 0.75,
  y = 28,
  className,
  as = "div",
}: RevealProps) {
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0% -8% 0%" }}
      transition={{ duration, delay, ease: smooth }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: smooth },
  },
};

export { fadeUp };
