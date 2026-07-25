import React, { useEffect } from 'react';

interface InstallSuccessAnimationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallSuccessAnimation: React.FC<InstallSuccessAnimationProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    // Automatically close the success banner after 2 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="pwa-modal-backdrop pwa-gpu z-[250]">
      <div className="pwa-glass pwa-success-content flex flex-col items-center gap-4 text-center">
        {/* Animated Confetti Particles */}
        <div className="pwa-confetti-container">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="pwa-confetti-particle" />
          ))}
        </div>

        {/* Custom SVG Drawing Checkmark */}
        <svg className="pwa-checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle className="pwa-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
          <path className="pwa-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>

        {/* Text Details */}
        <div className="flex flex-col gap-1 z-10">
          <h3 className="font-display font-bold text-base text-green-600 dark:text-green-400">
            App Installed Successfully
          </h3>
          <p className="text-xs text-[var(--th-text2)] leading-relaxed">
            Enjoy your faster, offline-ready native experience.
          </p>
        </div>
      </div>
    </div>
  );
};
