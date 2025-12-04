import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '5000', 10);

interface UsePollingOptions {
  enabled?: boolean;
  interval?: number;
}

export function usePolling(callback: () => void, options: UsePollingOptions = {}) {
  const { enabled = true, interval = DEFAULT_INTERVAL } = options;
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the polling interval
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      savedCallback.current();
    };

    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [enabled, interval]);
}
