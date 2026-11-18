import { motion } from 'framer-motion';

export default function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-6">
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-gradient-to-r from-cyan-200 via-indigo-200 to-fuchsia-200 bg-clip-text text-2xl font-bold text-transparent md:text-3xl"
      >
        {title}
      </motion.h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">{subtitle}</p>
    </div>
  );
}
