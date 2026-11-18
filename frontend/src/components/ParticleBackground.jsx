import { motion } from 'framer-motion';

const particles = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  size: 4 + ((i * 7) % 18),
  left: `${(i * 13) % 100}%`,
  top: `${(i * 17) % 100}%`,
  duration: 8 + (i % 5),
}));

export default function ParticleBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="particle"
          style={{ width: p.size, height: p.size, left: p.left, top: p.top }}
          animate={{ y: [0, -22, 0], opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
