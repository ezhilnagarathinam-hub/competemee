import { useEffect } from 'react';

export default function AnalyticsLoader() {
  useEffect(() => {
    let mounted = true;
    // Dynamically import to avoid build-time issues and to allow runtime fallback
    import('@vercel/analytics').then((mod) => {
      if (!mounted) return;
      // Try common export shapes
      const Analytics = (mod as any).Analytics || (mod as any).default || (mod as any).init || null;
      if (Analytics) {
        try {
          // If it's a React component, we can't render it here, but some packages provide an `init()` function
          // For best compatibility, if it's a function named `init`, call it.
          if (typeof Analytics === 'function' && Analytics.name === 'init') {
            (Analytics as any)();
          }
        } catch (e) {
          console.warn('Analytics init failed', e);
        }
      }
      // Some builds export a React component at /react - try to dynamically attach a script tag
    }).catch((err) => {
      // If package shape is different (e.g. @vercel/analytics/next), try the react entry
      import('@vercel/analytics/react').then((m2) => {
        // nothing to do here; the component will be imported and rendered by lazy loader in App
      }).catch(() => {
        // ignore
      });
    });

    return () => { mounted = false; };
  }, []);

  return null;
}
