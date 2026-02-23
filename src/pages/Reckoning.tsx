import { usePageContext } from '../hooks/usePageContext';
import { ReckoningScreen } from '../components/reckoning/Reckoning';

export default function Reckoning() {
  usePageContext({ page: 'reckoning' });

  return <ReckoningScreen />;
}
