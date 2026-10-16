import { useEffect, useState } from 'react';

export function useCooldown(retryAt: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  return Math.max(0, Math.ceil((retryAt - now) / 1_000));
}
