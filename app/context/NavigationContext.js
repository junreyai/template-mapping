'use client';

import React, { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '../components/ConfirmationModal';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState('');
  const [navigationCheck, setNavigationCheck] = useState(null);

  const handleNavigation = (path, checkFn) => {
    if (checkFn && checkFn()) {
      setShowModal(true);
      setPendingNavigation(path);
      setNavigationCheck(checkFn);
    } else {
      router.push(path);
    }
  };

  const handleConfirm = () => {
    setShowModal(false);
    router.push(pendingNavigation);
  };

  const handleCancel = () => {
    setShowModal(false);
    setPendingNavigation('');
    setNavigationCheck(null);
  };

  return (
    <NavigationContext.Provider value={{ handleNavigation }}>
      {children}
      {showModal && (
        <ConfirmationModal
          isOpen={showModal}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title="Confirm Navigation"
          message="You have unsaved changes. Are you sure you want to navigate away?"
        />
      )}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
