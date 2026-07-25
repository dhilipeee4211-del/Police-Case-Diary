import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  // Check if app is in standalone display mode
  const checkStandalone = useCallback(() => {
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (navigator as any).standalone === true;
    return isStandaloneMedia || isIosStandalone;
  }, []);

  // Check if the user has dismissed the installer in the last 7 days
  const isWithinDismissalWindow = useCallback(() => {
    try {
      const dismissedTime = localStorage.getItem('pwa-install-dismissed');
      if (!dismissedTime) return false;
      
      const parsedTime = parseInt(dismissedTime, 10);
      if (isNaN(parsedTime)) return false;

      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      return (now - parsedTime) < sevenDaysInMs;
    } catch {
      return false;
    }
  }, []);

  // Run automated manifest and PWA registration checks
  const runPwaDiagnostics = useCallback(async () => {
    // 1. Check meta tags
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      console.warn('%c[PWA Diagnostics] Missing <meta name="theme-color"> tag in index.html', 'color: #ea580c; font-weight: bold; font-size: 11px;');
    } else {
      const content = themeColorMeta.getAttribute('content');
      if (!content) {
        console.warn('%c[PWA Diagnostics] <meta name="theme-color"> tag exists but is missing the content attribute', 'color: #ea580c; font-weight: bold; font-size: 11px;');
      }
    }

    // 2. Fetch manifest.json
    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (!manifestLink) {
        console.warn('%c[PWA Diagnostics] Missing <link rel="manifest" href="..."> in index.html head', 'color: #ea580c; font-weight: bold; font-size: 11px;');
      }

      const res = await fetch('/manifest.json');
      if (!res.ok) {
        console.warn(`%c[PWA Diagnostics] Could not fetch manifest.json: Server responded with status ${res.status}`, 'color: #dc2626; font-weight: bold; font-size: 11px;');
        return;
      }

      const manifest = await res.json();
      
      const requiredFields = ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color', 'icons'];
      requiredFields.forEach(field => {
        if (!manifest[field]) {
          console.warn(`%c[PWA Diagnostics] manifest.json is missing required field: "${field}"`, 'color: #ea580c; font-weight: bold; font-size: 11px;');
        }
      });

      if (manifest.display && manifest.display !== 'standalone') {
        console.warn(`%c[PWA Diagnostics] manifest.json "display" property is "${manifest.display}". It is recommended to use "standalone" for a native feel.`, 'color: #ca8a04; font-weight: bold; font-size: 11px;');
      }

      if (manifest.icons && Array.isArray(manifest.icons)) {
        if (manifest.icons.length === 0) {
          console.warn('%c[PWA Diagnostics] manifest.json "icons" array is empty. Specify at least one 192x192 and one 512x512 app icon.', 'color: #ea580c; font-weight: bold; font-size: 11px;');
        } else {
          manifest.icons.forEach((icon: any, idx: number) => {
            if (!icon.src || !icon.sizes || !icon.type) {
              console.warn(`%c[PWA Diagnostics] manifest.json icon details at index ${idx} are incomplete. Require "src", "sizes" and "type".`, 'color: #ea580c; font-weight: bold; font-size: 11px;');
            }
          });
        }
      }
    } catch (err: any) {
      console.warn(`%c[PWA Diagnostics] Failed parsing manifest.json: ${err.message}`, 'color: #dc2626; font-weight: bold; font-size: 11px;');
    }

    // 3. Check service worker registration status
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) {
          console.warn('%c[PWA Diagnostics] No active Service Workers detected. PWA requires an active service worker with a fetch event handler to trigger install prompts.', 'color: #ca8a04; font-weight: bold; font-size: 11px;');
        }
      } catch (err: any) {
        console.warn(`%c[PWA Diagnostics] Error checking service worker registration: ${err.message}`, 'color: #dc2626; font-weight: bold; font-size: 11px;');
      }
    } else {
      console.warn('%c[PWA Diagnostics] Service Workers are not supported in this browser.', 'color: #dc2626; font-weight: bold; font-size: 11px;');
    }
  }, []);

  useEffect(() => {
    const isStandalone = checkStandalone();
    setIsInstalled(isStandalone);

    // Detect if device is iOS Safari (does not support beforeinstallprompt)
    const userAgent = window.navigator.userAgent;
    const isIphone = /iphone|ipad|ipod/i.test(userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const iosDevice = isIphone && isSafari;
    setIsIos(iosDevice);

    if (isStandalone) {
      setIsSupported(false);
      return;
    }

    // If already dismissed recently, do not display
    if (isWithinDismissalWindow()) {
      setIsSupported(false);
    } else if (iosDevice) {
      setIsSupported(true);
    }

    // Handle beforeinstallprompt event for Chromium browsers
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // If we are not standalone and haven't dismissed recently, display button
      if (!checkStandalone() && !isWithinDismissalWindow()) {
        setIsSupported(true);
      }
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsSupported(false);
      setDeferredPrompt(null);
      
      // Clear any dismissal state
      localStorage.removeItem('pwa-install-dismissed');
      
      // Trigger native-feel success animation
      setShowModal(false);
      setShowSuccess(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Run diagnostics
    runPwaDiagnostics();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [checkStandalone, isWithinDismissalWindow, runPwaDiagnostics]);

  // Actions
  const handleInstallClick = useCallback(async () => {
    if (isIos) {
      // iOS doesn't trigger deferredPrompt. Show instruction modal.
      setShowModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback in case deferredPrompt is lost or not supported yet, open manual display modal
      setShowModal(true);
      return;
    }

    setShowModal(true);
  }, [deferredPrompt, isIos]);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        // App is installing! On Chrome, this usually triggers 'appinstalled' immediately or in a bit.
        // We will show success animation in response to 'appinstalled' event.
        setShowModal(false);
      } else {
        // Dismissed prompt.
        // Set standard 7 days snooze logic on explicit cancel of browser prompt
        handleDismiss();
      }
    } catch (err) {
      console.error('[PWA Install] Deferred prompt trigger error:', err);
      setShowModal(false);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    } catch (e) {
      console.warn('[PWA Install] LocalStorage error on dismiss save:', e);
    }
    setShowModal(false);
    setIsSupported(false);
  }, []);

  return {
    isSupported,
    isInstalled,
    showModal,
    showSuccess,
    isIos,
    setShowModal,
    setShowSuccess,
    handleInstallClick,
    triggerInstall,
    handleDismiss
  };
}
