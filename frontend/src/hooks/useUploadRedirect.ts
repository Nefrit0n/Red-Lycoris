import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Hook for handling automatic redirect to product after upload
 */
export function useUploadRedirect(pageSize: number) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryProduct = params.get('product') || params.get('productId');
    const queryImportJobId = params.get('import_job_id');

    // Don't redirect if already has product or import_job_id in URL
    if (queryProduct || queryImportJobId) return;

    const raw = localStorage.getItem('red_lycoris_last_upload');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { productId?: string | null };
      if (parsed.productId) {
        params.set('product', parsed.productId);
        params.set('page', '1');
        params.set('limit', pageSize.toString());
        navigate(
          {
            pathname: location.pathname,
            search: `?${params.toString()}`,
          },
          { replace: true }
        );
      }
    } finally {
      localStorage.removeItem('red_lycoris_last_upload');
    }
  }, [location.pathname, location.search, navigate, pageSize]);
}
