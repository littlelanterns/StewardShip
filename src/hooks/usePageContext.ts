import { useEffect } from 'react';
import { useHelm, type HelmPageContext } from '../contexts/HelmContext';

export function usePageContext(ctx: HelmPageContext) {
  const { setPageContext } = useHelm();
  useEffect(() => {
    setPageContext(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.page]);
}
