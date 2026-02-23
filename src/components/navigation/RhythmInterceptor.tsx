import { useEffect, useState } from 'react';
import { useRhythms } from '../../hooks/useRhythms';
import { ReveilleScreen } from '../reveille/Reveille';
import { ReckoningScreen } from '../reckoning/Reckoning';

interface RhythmInterceptorProps {
  children: React.ReactNode;
}

export function RhythmInterceptor({ children }: RhythmInterceptorProps) {
  const { shouldShowReveille, shouldShowReckoning, initializeRhythms } = useRhythms();
  const [initialized, setInitialized] = useState(false);
  const [activeRhythm, setActiveRhythm] = useState<'reveille' | 'reckoning' | null>(null);

  useEffect(() => {
    let mounted = true;
    initializeRhythms().then(() => {
      if (mounted) setInitialized(true);
    });
    return () => { mounted = false; };
  }, [initializeRhythms]);

  useEffect(() => {
    if (!initialized) return;
    if (shouldShowReveille()) {
      setActiveRhythm('reveille');
    } else if (shouldShowReckoning()) {
      setActiveRhythm('reckoning');
    } else {
      setActiveRhythm(null);
    }
  }, [initialized, shouldShowReveille, shouldShowReckoning]);

  if (!initialized) {
    return <>{children}</>;
  }

  if (activeRhythm === 'reveille') {
    return <ReveilleScreen />;
  }

  if (activeRhythm === 'reckoning') {
    return <ReckoningScreen />;
  }

  return <>{children}</>;
}
