/**
 * Confetti celebration animation for quiz pass
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#eab308', '#ec4899'];

function makeParticles(count = 60) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 800,
    y: Math.random() * -500 - 100,
    rotation: Math.random() * 1080 - 540,
    scale: Math.random() * 0.6 + 0.4,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.3,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }));
}

export default function Confetti({ show }) {
  const [particles, setParticles] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setParticles(makeParticles());
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{
                x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
                y: -20,
                opacity: 1,
                scale: 0,
                rotate: 0,
              }}
              animate={{
                x: (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) + p.x,
                y: (typeof window !== 'undefined' ? window.innerHeight : 800) + p.y,
                opacity: 0,
                scale: p.scale,
                rotate: p.rotation,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.5,
                delay: p.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute"
              style={{
                width: p.shape === 'circle' ? 10 : 12,
                height: p.shape === 'circle' ? 10 : 8,
                borderRadius: p.shape === 'circle' ? '50%' : '2px',
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
