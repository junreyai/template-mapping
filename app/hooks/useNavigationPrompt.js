'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function useNavigationPrompt(hasChanges) {
  const pathname = usePathname();

  useEffect(() => {
    // Update hasChanges in localStorage whenever files or mappings change
    localStorage.setItem(`${pathname}-hasChanges`, hasChanges);

    return () => {
      localStorage.removeItem(`${pathname}-hasChanges`);
    };
  }, [hasChanges, pathname]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);
}
