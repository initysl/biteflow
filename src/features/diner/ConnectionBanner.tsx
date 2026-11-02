import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConnectionStatus } from '@/lib/realtime';

/** Only surfaces when live updates have been down for a few seconds, so brief blips stay invisible. */
export function ConnectionBanner({ enabled }: { enabled: boolean }) {
  const status = useConnectionStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled || status === 'online') {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, [status, enabled]);

  if (!show) return null;
  return (
    <div role='status' className='border-b border-warning/20 bg-warning-soft'>
      <div className='mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm text-warning sm:px-6'>
        <WifiOff className='size-4' />
        Reconnecting… order updates may be delayed.
      </div>
    </div>
  );
}
