import { useState, useEffect } from 'react';

const STORAGE_KEY = 'eden_onboarding_complete';

export function useOnboarding() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setShowTour(true);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowTour(false);
  };

  return { showTour, completeTour };
}
