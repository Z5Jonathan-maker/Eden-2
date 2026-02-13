import React from 'react';

const ParticleEmitter = ({ active, color = '#f97316', count = 12 }) => {
  if (!active) return null;

  return (
    <div className="bp-particles" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <span
          key={idx}
          className="bp-particle"
          style={{
            '--bp-particle-angle': `${(360 / count) * idx}deg`,
            '--bp-particle-color': color,
            '--bp-particle-delay': `${idx * 18}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default ParticleEmitter;
