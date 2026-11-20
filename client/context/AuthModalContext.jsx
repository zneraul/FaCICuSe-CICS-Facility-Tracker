import React, { createContext, useCallback, useContext, useState } from 'react';
import { SignInModal } from '../components/SignInModal.jsx';

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    returnTo: '/app/dashboard',
    initialNotice: '',
    initialNoticeType: 'info',
  });

  const openSignInModal = useCallback((options = {}) => {
    setModalState({
      isOpen: true,
      returnTo: options.returnTo || '/app/dashboard',
      initialNotice: options.notice || '',
      initialNoticeType: options.noticeType || 'info',
    });
  }, []);

  const closeSignInModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <AuthModalContext.Provider value={{ openSignInModal, closeSignInModal, isModalOpen: modalState.isOpen }}>
      {children}
      <SignInModal
        isOpen={modalState.isOpen}
        onClose={closeSignInModal}
        returnTo={modalState.returnTo}
        initialNotice={modalState.initialNotice}
        initialNoticeType={modalState.initialNoticeType}
      />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error('useAuthModal must be used inside AuthModalProvider');
  }
  return ctx;
}
