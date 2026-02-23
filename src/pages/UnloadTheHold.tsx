import { useEffect, useRef } from 'react';
import { PackageOpen } from 'lucide-react';
import { useHelmContext } from '../contexts/HelmContext';
import { usePageContext } from '../hooks/usePageContext';
import './UnloadTheHold.css';

export default function UnloadTheHold() {
  usePageContext({ page: 'helm' });

  const { activeConversation, startGuidedConversation, openDrawer } = useHelmContext();
  const initiated = useRef(false);

  // On mount, start a guided conversation and open the drawer
  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    const init = async () => {
      // Only start a new guided conversation if we don't already have one active
      if (activeConversation?.guided_mode !== 'unload_the_hold') {
        await startGuidedConversation('unload_the_hold');
      }
      openDrawer();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page unload-page">
      <div className="unload-page__header">
        <div className="unload-page__icon">
          <PackageOpen size={32} strokeWidth={1.5} />
        </div>
        <h1>Unload the Hold</h1>
        <p className="unload-page__subtitle">
          Get it all out of your head and into safe hands.
        </p>
      </div>

      <div className="unload-page__description">
        <p>
          Your mind is full. Tasks, worries, ideas, things you can't forget — they're
          all rattling around in the hold. This is the place to dump them all without
          worrying about organizing anything.
        </p>
        <p>
          Just talk. When you're done, I'll sort through everything and help you
          route each item where it belongs — tasks to the Compass, reflections to the
          Log, principles to the Mast.
        </p>
      </div>

      <div className="unload-page__steps">
        <div className="unload-page__step">
          <span className="unload-page__step-number">1</span>
          <div>
            <strong>Brain dump</strong>
            <p>Tell me everything on your mind. No order needed.</p>
          </div>
        </div>
        <div className="unload-page__step">
          <span className="unload-page__step-number">2</span>
          <div>
            <strong>Review & sort</strong>
            <p>I'll organize what you shared into categories.</p>
          </div>
        </div>
        <div className="unload-page__step">
          <span className="unload-page__step-number">3</span>
          <div>
            <strong>Route it</strong>
            <p>Send each item to the right place in StewardShip.</p>
          </div>
        </div>
      </div>

      <p className="unload-page__hint">
        Use the conversation below to get started.
      </p>
    </div>
  );
}
