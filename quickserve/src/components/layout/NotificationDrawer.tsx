'use client';

import React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, Sparkles, X } from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';

export function NotificationDrawer() {
  const { notifDrawerOpen, setNotifDrawerOpen, notifications, unreadCount, markAllNotificationsRead, user } = useApp();

  const requestPush = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      await Notification.requestPermission();
    }
  };

  return (
    <AnimatePresence>
      {notifDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNotifDrawerOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-orange-100 dark:border-slate-800"
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#FFF1E8] dark:bg-orange-500/15 text-[#F97316] flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-[#171717] dark:text-white">Notifications</h3>
                  <p className="text-xs text-[#737373]">{unreadCount} unread updates</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark read
                  </button>
                )}
                <button
                  onClick={() => setNotifDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#FFF7F2] dark:bg-slate-800/50 border-b border-orange-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs text-[#171717] dark:text-slate-200">
                <p className="font-bold">Browser Push Alerts</p>
                <p className="text-[#737373] dark:text-slate-400">Live ETA, OTPs, arrival & refund status</p>
              </div>
              <button
                onClick={requestPush}
                className="px-3 py-1.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shrink-0"
              >
                Enable Push
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!user ? (
                <div className="text-center py-12 space-y-3">
                  <Sparkles className="w-10 h-10 text-[#F97316] mx-auto" />
                  <p className="font-bold text-sm">Sign in to view your notification history</p>
                  <p className="text-xs text-[#737373]">
                    Receive real-time alerts for booking confirmation, live arrival, OTPs, and refunds.
                  </p>
                  <Link
                    href="/login"
                    onClick={() => setNotifDrawerOpen(false)}
                    className="inline-flex px-4 py-2 rounded-xl bg-[#F97316] text-white text-xs font-bold"
                  >
                    Sign In
                  </Link>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-sm text-[#737373]">
                  You&apos;re all caught up! Booking and arrival alerts will appear here.
                </div>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.data?.url || '/orders'}
                    onClick={() => setNotifDrawerOpen(false)}
                    className={`block p-3.5 rounded-2xl border transition-all ${
                      n.is_read
                        ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                        : 'bg-[#FFF7F2] dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm text-[#171717] dark:text-white">{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#F97316] mt-1.5 shrink-0" />}
                    </div>
                    <p className="text-xs text-[#737373] dark:text-slate-300 mt-1 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
