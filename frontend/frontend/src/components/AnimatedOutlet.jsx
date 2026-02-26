import React from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const AnimatedOutlet = () => {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } }}
        exit={{ opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } }}
        style={{ minHeight: '100%' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedOutlet;
