
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppContext } from '@/contexts/AppContext';
import { logRole, logAuthError } from '@/utils/consoleOptimizer';

export const useUserRole = () => {
  const { user } = useAppContext();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<number>(0);

  // Extended cache duration to reduce API calls
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (increased from 30 minutes)

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Check cache first
      const now = Date.now();
      if (now - lastChecked < CACHE_DURATION && lastChecked > 0) {
        setIsLoading(false);
        return;
      }

      const MAX_RETRIES = 1; // Reduced to 1 retry
      const RETRY_DELAY = 3000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data, error } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin'
          });

          if (error) {            
            if (attempt === MAX_RETRIES) {
              // Only log critical security events
              logRole('security: Failed to verify admin role after max retries', {
                userId: user.id,
                error: error.message
              });
              setIsAdmin(false);
            } else {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              continue;
            }
          } else {
            setIsAdmin(data || false);
            setLastChecked(now);
            
            // Only log successful admin verification (security audit)
            if (data) {
              logRole('Admin role verified', { userId: user.id });
            }
          }
          break;
        } catch (error) {
          if (attempt === MAX_RETRIES) {
            logAuthError('Exception verifying admin role', error);
            setIsAdmin(false);
          } else {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }

      setIsLoading(false);
    };

    // Only run the check if user exists and cache is expired
    if (user && (Date.now() - lastChecked >= CACHE_DURATION || lastChecked === 0)) {
      checkUserRole();
    } else if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [user?.id, lastChecked, CACHE_DURATION]);

  // Force refresh role check (useful after role changes)
  const refreshRole = () => {
    setLastChecked(0);
    setIsLoading(true);
  };

  return { isAdmin, isLoading, refreshRole };
};
