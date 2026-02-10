import React from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: 'easeIn' } },
};

const AnimatedOutlet = () => {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ minHeight: '100%' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedOutlet;
