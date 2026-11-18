import { AnimatePresence, motion } from 'framer-motion';
import { Cpu } from 'lucide-react';

export default function LoadingScreen({ show }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.2 }}
            className="flex items-center gap-3 rounded-2xl border border-cyan-300/30 bg-white/5 px-6 py-4"
          >
            <Cpu className="text-cyan-300" />
            <span className="text-sm font-semibold tracking-widest text-cyan-100">
              BOOTING AI CAREER ENGINE
            </span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
