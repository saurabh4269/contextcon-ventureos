"use client";
// Global: every framer-motion animation honours the OS "reduce motion" setting.
import { MotionConfig } from "framer-motion";
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
