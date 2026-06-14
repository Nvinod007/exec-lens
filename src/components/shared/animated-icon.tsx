"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface AnimatedIconProps extends HTMLMotionProps<"span"> {
  icon: LucideIcon;
  size?: number;
  active?: boolean;
}

/** Lucide icon wrapper with a subtle motion pulse when active. */
export function AnimatedIcon({
  icon: Icon,
  size = 16,
  active = false,
  className,
  ...props
}: AnimatedIconProps) {
  return (
    <motion.span
      animate={active ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={{ duration: 0.8, repeat: active ? Infinity : 0 }}
      className={className}
      {...props}
    >
      <Icon size={size} />
    </motion.span>
  );
}
