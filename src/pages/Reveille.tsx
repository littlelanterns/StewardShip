import { usePageContext } from '../hooks/usePageContext';
import { ReveilleScreen } from '../components/reveille/Reveille';

export default function Reveille() {
  usePageContext({ page: 'reveille' });

  return <ReveilleScreen />;
}
