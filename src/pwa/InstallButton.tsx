import React from 'react';

interface InstallButtonProps {
  onClick: () => void;
  hasUser: boolean;
}

export const InstallButton: React.FC<InstallButtonProps> = ({ onClick, hasUser }) => {
  return (
    <button
      onClick={onClick}
      className={`pwa-gpu pwa-install-btn pwa-focus-ring ${hasUser ? 'has-mobile-nav' : 'no-mobile-nav'}`}
      aria-label="Install Case Diary Application"
      title="Install App"
    >
      {/* Modern Download + Mobile SVG Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4.5 h-4.5 shrink-0"
      >
        {/* Mobile device frame */}
        <rect x="5" y="2" width="14" height="20" rx="3" ry="3" strokeOpacity="0.4" />
        {/* Device screen separator or line */}
        <path d="M12 18h.01" strokeWidth="3" />
        {/* Down arrow icon inside the device */}
        <path d="M12 6v6m0 0l-3-3m3 3l3-3" stroke="var(--th-primary)" strokeWidth="2.5" />
      </svg>
      <span>Install App</span>
    </button>
  );
};
