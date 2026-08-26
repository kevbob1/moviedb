'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Chrome/Android best effort only; this worker intentionally does not cache content.
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure should never affect the app; there is no offline fallback.
    });
  }, []);

  return null;
}
