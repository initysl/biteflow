import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'bf:theme';

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function initTheme() {
  try {
    apply((localStorage.getItem(KEY) as ThemePref) || 'system');
  } catch {
    /* storage unavailable */
  }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemePref) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    apply(pref);
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
  }, [pref]);
  return [pref, setPref] as const;
}
