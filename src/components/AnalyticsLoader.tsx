import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

export default function AnalyticsLoader() {
  useEffect(() => {
    let mounted = true;
    // Try to dynamically import the React Analytics component provided by the package
    (async () => {
      try {
        // Preferred entry for Vercel analytics React integration
        const mod = await import('@vercel/analytics/react');
        if (!mounted) return;
        const Analytics = (mod as any).Analytics || (mod as any).default;
        if (Analytics) {
          // create a container at the end of body to render the Analytics component
          try {
            const container = document.createElement('div');
            container.id = 'vercel-analytics-root';
            document.body.appendChild(container);
            const root = createRoot(container);
            root.render(
              // @ts-ignore
              <Analytics />
            );
          } catch (e) {
            console.warn('Failed to mount Vercel Analytics component', e);
          }
        }
      } catch (err) {
        // Fall back: try the generic package entry
        try {
          const mod2 = await import('@vercel/analytics');
          const AnalyticsInit = (mod2 as any).init || (mod2 as any).default;
          if (typeof AnalyticsInit === 'function') {
            try { AnalyticsInit(); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          // No analytics available; ignore silently
        }
      }
    })();

    return () => { mounted = false; };
  }, []);

  return null;
}
