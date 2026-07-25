import React, { useEffect } from 'react';
import { usePwaInstall } from './usePwaInstall';
import { InstallButton } from './InstallButton';
import { InstallModal } from './InstallModal';
import { InstallSuccessAnimation } from './InstallSuccessAnimation';
import './install.css';

interface InstallManagerProps {
  hasUser: boolean;
}

export const InstallManager: React.FC<InstallManagerProps> = ({ hasUser }) => {
  const {
    isSupported,
    showModal,
    showSuccess,
    isIos,
    setShowModal,
    setShowSuccess,
    handleInstallClick,
    triggerInstall,
    handleDismiss
  } = usePwaInstall();

  // Register service worker on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then(() => {
            // Service worker successfully registered
          })
          .catch((err) => {
            console.warn('%c[PWA Diagnostics] Service worker registration failed: ' + err.message, 'color: #ca8a04; font-weight: bold;');
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return (
    <>
      {isSupported && (
        <InstallButton
          onClick={handleInstallClick}
          hasUser={hasUser}
        />
      )}

      <InstallModal
        isOpen={showModal}
        onClose={handleDismiss}
        onConfirm={triggerInstall}
        isIos={isIos}
      />

      <InstallSuccessAnimation
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
};

export default InstallManager;
