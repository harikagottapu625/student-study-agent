import { motion } from 'framer-motion';

export default function AnimatedButton({ children, className = '', ...props }) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`ripple-btn rounded-xl px-5 py-3 text-sm font-semibold text-white ${className}`}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
