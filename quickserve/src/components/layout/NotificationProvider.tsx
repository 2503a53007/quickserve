'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Zap } from 'lucide-react';
import { isFirebaseClientConfigured, publicEnv } from '@/lib/env';

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    // Only prompt if the browser supports notifications and we haven't asked yet
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const current = Notification.permission;
    setPermissionState(current);

    if (current === 'default') {
      // Show our custom banner after a short delay
      const timer = setTimeout(() => setShowBanner(true), 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  const requestPermission = async () => {
    setShowBanner(false);
    if (!('Notification' in window)) return;

    const permission = await Notification.requestPermission();
    setPermissionState(permission);

    if (permission !== 'granted') return;

    // Only register Firebase SW if fully configured
    if (!isFirebaseClientConfigured()) return;

    try {
      // Dynamic import so it never crashes when firebase isn't configured
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken } = await import('firebase/messaging');

      const firebaseConfig = {
        apiKey: publicEnv.firebase.apiKey,
        authDomain: publicEnv.firebase.authDomain,
        projectId: publicEnv.firebase.projectId,
        storageBucket: publicEnv.firebase.storageBucket,
        messagingSenderId: publicEnv.firebase.messagingSenderId,
        appId: publicEnv.firebase.appId,
      };

      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const messaging = getMessaging(app);

      const swReg =
        'serviceWorker' in navigator
          ? await navigator.serviceWorker.register('/firebase-messaging-sw.js')
          : undefined;

      const token = await getToken(messaging, {
        vapidKey: publicEnv.firebase.vapidKey,
        serviceWorkerRegistration: swReg,
      });
      if (token) {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, deviceLabel: navigator.userAgent.slice(0, 100) }),
        }).catch(() => {});
      }
    } catch (err) {
      // Gracefully degrade — user still gets the app
      console.warn('[QuickServe] Push notifications unavailable:', err);
    }
  };

  return (
    <>
      {children}

      {/* Notification permission banner */}
      <AnimatePresence>
        {showBanner && permissionState === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', duration: 0.45, bounce: 0.25 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] w-full max-w-md px-4"
          >
            <div className="rounded-2xl bg-[#0F172A] text-white shadow-2xl ring-1 ring-white/10 p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Bell size={20} className="text-orange-400" />
                </span>
                <div>
                  <p className="font-bold text-base">🔔 Stay in the loop!</p>
                  <p className="text-sm text-slate-300 mt-0.5">
                    Get notified about your bookings, provider arrival, and exclusive offers.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={requestPermission}
                  className="flex-1 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Zap size={15} className="fill-white" />
                  Allow Notifications
                </button>
                <button
                  onClick={() => setShowBanner(false)}
                  className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-semibold text-sm flex items-center gap-1.5"
                >
                  <BellOff size={15} />
                  Skip
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
