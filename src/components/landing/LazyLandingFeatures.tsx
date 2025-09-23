import React, { lazy, Suspense } from 'react';

// Lazy load the heavy LandingFeatures component
const LandingFeatures = lazy(() => import('./LandingFeatures'));

const LazyLandingFeatures = () => {
  return (
    <Suspense fallback={
      <section className="py-20 bg-muted/30 w-full">
        <div className="w-full px-4">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-muted rounded mx-auto mb-4"></div>
            <div className="h-4 w-96 bg-muted rounded mx-auto mb-16"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-card rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    }>
      <LandingFeatures />
    </Suspense>
  );
};

export default LazyLandingFeatures;