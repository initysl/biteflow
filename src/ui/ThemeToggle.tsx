import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePref } from '@/lib/theme';

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL = { system: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' };

export function ThemeToggle() {
  const [pref, setPref] = useTheme();
  const Icon = ICON[pref];
  return (
    <button
      type='button'
      onClick={() => setPref(NEXT[pref])}
      aria-label={`${LABEL[pref]}. Click to change.`}
      title={LABEL[pref]}
      className='pressable inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
    >
      <Icon className='size-4.5' />
    </button>
  );
}
