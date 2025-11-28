import { useState, useEffect, useRef } from 'react';

export const useAnimatedValue = (value: number, duration: number = 100) => {
  const [displayValue, setDisplayValue] = useState(value);
  const startValue = useRef(value);
  const startTime = useRef(Date.now());
  const targetValue = useRef(value);

  useEffect(() => {
    // Only update targets if value actually changed to avoid jitter
    if (value !== targetValue.current) {
        startValue.current = displayValue;
        targetValue.current = value;
        startTime.current = Date.now();
    }

    let animationFrameId: number;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      
      const current = startValue.current + (targetValue.current - startValue.current) * ease;
      
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration, displayValue]);

  return displayValue;
};