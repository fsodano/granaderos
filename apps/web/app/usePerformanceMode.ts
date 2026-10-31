'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}
function readPerformanceMode() {
  const query = new URLSearchParams(window.location.search);
  return query.get('qa') === '1' && query.get('performance') === '1';
}
export function usePerformanceMode() {
  return useSyncExternalStore(subscribe, readPerformanceMode, () => false);
}
