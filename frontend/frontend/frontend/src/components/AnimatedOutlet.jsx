import React from 'react';
import { useLocation, useOutlet } from 'react-router-dom';

const AnimatedOutlet = () => {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <div key={location.pathname} className="animate-fadeIn" style={{ minHeight: '100%' }}>
      {outlet}
    </div>
  );
};

export default AnimatedOutlet;
