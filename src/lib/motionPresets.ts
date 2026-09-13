import { useReducedMotion, type Transition } from 'motion/react'

export const MOTION_EASE = [0.16, 1, 0.3, 1] as const
export const MOTION_DURATION_S = 0.18

export function useFadeMotion(offsetY = 6) {
  const reduce = Boolean(useReducedMotion())
  const transition: Transition = reduce
    ? { duration: 0 }
    : { duration: MOTION_DURATION_S, ease: MOTION_EASE }

  return {
    reduce,
    transition,
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: offsetY },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 },
  }
}
