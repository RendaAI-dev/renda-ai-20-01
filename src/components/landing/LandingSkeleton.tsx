import React from 'react';

const LandingSkeleton = () => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header Skeleton */}
      <div className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
            <div className="h-6 w-24 bg-muted rounded animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-16 bg-muted rounded animate-pulse"></div>
            <div className="h-9 w-24 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Hero Skeleton */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <div className="h-12 w-3/4 bg-muted rounded animate-pulse mx-auto"></div>
            <div className="h-12 w-2/3 bg-muted rounded animate-pulse mx-auto"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse mx-auto"></div>
            <div className="h-4 w-1/2 bg-muted rounded animate-pulse mx-auto"></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="h-12 w-48 bg-muted rounded animate-pulse"></div>
            <div className="h-12 w-32 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Features Skeleton */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-4">
              <div className="h-16 w-16 bg-muted rounded-full animate-pulse mx-auto"></div>
              <div className="h-6 w-32 bg-muted rounded animate-pulse mx-auto"></div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse mx-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingSkeleton;