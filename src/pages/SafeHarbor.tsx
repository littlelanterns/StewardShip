import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageContext } from '../hooks/usePageContext';
import { useHelmContext } from '../contexts/HelmContext';
import { SafeHarborLanding } from '../components/safeharbor/SafeHarborLanding';
import './SafeHarbor.css';

export default function SafeHarbor() {
  usePageContext({ page: 'safeharbor' });
  const navigate = useNavigate();
  const { startGuidedConversation } = useHelmContext();

  const handleStartConversation = useCallback(() => {
    startGuidedConversation('safe_harbor');
    navigate('/helm');
  }, [startGuidedConversation, navigate]);

  return (
    <div className="page safe-harbor-page">
      <SafeHarborLanding onStartConversation={handleStartConversation} />
    </div>
  );
}
