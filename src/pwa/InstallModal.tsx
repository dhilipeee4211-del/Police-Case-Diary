import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isIos: boolean;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, onConfirm, isIos }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Trap focus within the modal for accessibility (A11y)
  useEffect(() => {
    if (!isOpen) return;

    // Handle Escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Save current active element to restore later
    const previousActiveElement = document.activeElement as HTMLElement;

    // Set initial focus
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      className="pwa-modal-backdrop pwa-gpu"
      onClick={handleOutsideClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-title"
      aria-describedby="pwa-desc"
    >
      <div
        ref={modalRef}
        className="pwa-glass pwa-modal-content flex flex-col gap-5 max-w-[500px] w-full"
        style={{ color: 'var(--th-text)' }}
      >
        {/* Close Button Top Right */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-5 top-5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100/15 transition-all cursor-pointer pwa-focus-ring"
          aria-label="Close installation window"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Block */}
        <div className="flex gap-4 items-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
            style={{ background: 'var(--th-primary-xlight)', color: 'var(--th-primary)', borderColor: 'var(--th-border)' }}
          >
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 id="pwa-title" className="font-display font-bold text-lg leading-tight">
              AI Case Diary
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-500 mt-0.5">
              Progressive Web App
            </p>
          </div>
        </div>

        {/* Description */}
        <p id="pwa-desc" className="text-xs leading-relaxed text-[var(--th-text2)]">
          Install this app for a faster, smoother, native experience on your system.
        </p>

        {/* Benefits Checklist */}
        <div
          className="flex flex-col gap-3 p-4 rounded-2xl border bg-gray-50/5 dark:bg-slate-900/10"
          style={{ borderColor: 'var(--th-border3)' }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-500 mb-1">
            Installation Benefits
          </h3>
          {[
            'Faster startup & launch times',
            'Works offline with local workspace storage',
            'Immersive full-screen window (no browser bar)',
            'Better hardware performance & smooth 60fps views',
            'One-tap access directly from your Home Screen or Dock'
          ].map((benefit, idx) => (
            <div key={idx} className="flex gap-2.5 items-start text-xs font-medium text-[var(--th-text2)]">
              <span className="text-emerald-500 shrink-0 select-none">✓</span>
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        {/* Interactive action buttons / IOS instructions */}
        {isIos ? (
          <div
            className="p-4 border rounded-2xl text-xs font-medium leading-relaxed bg-amber-500/5 text-amber-700 dark:text-amber-400"
            style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}
          >
            <div className="flex gap-2.5 items-start">
              {/* Safari share icon SVG */}
              <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
              </svg>
              <div>
                <strong className="block text-xs font-bold mb-1">To Install on iOS:</strong>
                Tap the <strong className="font-bold underline">Share</strong> button in Safari's toolbar, scroll down, and select <strong className="font-bold underline">Add to Home Screen</strong>.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 mt-1 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border rounded-xl text-xs font-bold hover:bg-gray-150/10 cursor-pointer transition-all pwa-focus-ring"
              style={{ color: 'var(--th-text3)', borderColor: 'var(--th-border)' }}
            >
              Maybe Later
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2.5 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md pwa-focus-ring flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-dark))' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Install Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
