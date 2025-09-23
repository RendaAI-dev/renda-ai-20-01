import React, { lazy, Suspense } from 'react';

// Lazy load the LandingBenefits component
const LandingBenefits = lazy(() => import('./LandingBenefits'));

const LazyLandingBenefits = () => {
  return (
    <Suspense fallback={
      <section className="py-20 bg-muted/30 w-full">
        <div className="w-full px-4">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-muted rounded mx-auto mb-4"></div>
            <div className="h-4 w-96 bg-muted rounded mx-auto mb-16"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4"></div>
                  <div className="h-6 w-32 bg-muted rounded mx-auto mb-3"></div>
                  <div className="h-4 w-48 bg-muted rounded mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    }>
      <LandingBenefits />
    </Suspense>
  );
};

export default LazyLandingBenefits;