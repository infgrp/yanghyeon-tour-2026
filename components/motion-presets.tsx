"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";

/**
 * 자식 요소가 staggered 로 등장하는 컨테이너.
 * 사용:
 *   <FadeStaggerContainer>
 *     <FadeStaggerItem>...</FadeStaggerItem>
 *     <FadeStaggerItem>...</FadeStaggerItem>
 *   </FadeStaggerContainer>
 */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export function FadeStaggerContainer({
  children, className, ...rest
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function FadeStaggerItem({
  children, className, ...rest
}: HTMLMotionProps<"div">) {
  return (
    <motion.div className={className} variants={itemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

/** 단일 fade-in (stagger 불필요한 경우) */
export function FadeIn({
  children, className, delay = 0, ...rest
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** 카운터 등 강조 요소에 적용하는 pop-in */
export function PopIn({
  children, className, delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, delay, type: "spring", stiffness: 220, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}
