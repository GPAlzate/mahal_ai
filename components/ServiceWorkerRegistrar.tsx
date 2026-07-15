'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/client/push';

/**
 * Registers the push service worker on load so already-subscribed devices
 * keep receiving notifications after SW updates. Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
