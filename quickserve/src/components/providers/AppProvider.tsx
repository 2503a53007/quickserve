'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserRow } from '@/types/db';

export interface SelectedLocation {
  label: string;
  city: string;
  state?: string;
  pinCode?: string;
  lat: number | null;
  lng: number | null;
  source: 'gps' | 'manual' | 'pin' | 'default';
}

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  data?: Record<string, string>;
  created_at: string;
}

interface AppContextValue {
  configured: boolean;
  loadingAuth: boolean;
  user: { id: string; email?: string | null; phone?: string | null } | null;
  profile: UserRow | null;
  providerProfile: Record<string, any> | null;
  companyProfile: Record<string, any> | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  location: SelectedLocation;
  setLocation: (loc: SelectedLocation) => void;
  detectGpsLocation: () => Promise<boolean>;
  detectingGps: boolean;
  locationNotice: string;
  locationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;
  notifications: InAppNotification[];
  unreadCount: number;
  notifDrawerOpen: boolean;
  setNotifDrawerOpen: (open: boolean) => void;
  markAllNotificationsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  localWishlistIds: string[];
  toggleLocalWishlist: (serviceSlug: string) => void;
}

const DEFAULT_LOCATION: SelectedLocation = {
  label: 'Select City / PIN',
  city: 'All India',
  state: 'India',
  pinCode: '',
  lat: null,
  lng: null,
  source: 'default',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [configured, setConfigured] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<AppContextValue['user']>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [providerProfile, setProviderProfile] = useState<Record<string, any> | null>(null);
  const [companyProfile, setCompanyProfile] = useState<Record<string, any> | null>(null);

  const [location, setLocationState] = useState<SelectedLocation>(DEFAULT_LOCATION);
  const [detectingGps, setDetectingGps] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [localWishlistIds, setLocalWishlistIds] = useState<string[]>([]);

  // Restore saved location & wishlist preferences from localStorage
  useEffect(() => {
    try {
      const savedLoc = localStorage.getItem('qs_location');
      if (savedLoc) setLocationState(JSON.parse(savedLoc));
      const savedWish = localStorage.getItem('qs_wishlist');
      if (savedWish) setLocalWishlistIds(JSON.parse(savedWish));
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLocation = useCallback((loc: SelectedLocation) => {
    setLocationState(loc);
    try {
      localStorage.setItem('qs_location', JSON.stringify(loc));
    } catch {
      // ignore
    }
  }, []);

  const toggleLocalWishlist = useCallback((serviceSlug: string) => {
    setLocalWishlistIds((prev) => {
      const next = prev.includes(serviceSlug) ? prev.filter((x) => x !== serviceSlug) : [...prev, serviceSlug];
      try {
        localStorage.setItem('qs_wishlist', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.data) {
        setConfigured(Boolean(json.data.configured));
        setUser(json.data.user ?? null);
        setProfile(json.data.profile ?? null);
        setProviderProfile(json.data.provider ?? null);
        setCompanyProfile(json.data.company ?? null);
      }
    } catch {
      // ignore network glitches
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.data?.notifications) {
        setNotifications(json.data.notifications);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Always show /login first on a fresh browser tab or whenever the user is not authenticated
  useEffect(() => {
    if (loadingAuth) return;
    const isAuthPage =
      pathname === '/login' || pathname === '/signup' || pathname === '/verify-otp';
    const tabVerified =
      typeof window !== 'undefined' && window.sessionStorage.getItem('qs_login_verified_this_tab') === '1';
    if ((!user || !tabVerified) && !isAuthPage) {
      router.replace('/login');
    }
  }, [loadingAuth, user, pathname, router]);

  useEffect(() => {
    if (user) refreshNotifications();
    else setNotifications([]);
  }, [user, refreshNotifications]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('qs_login_verified_this_tab');
    }
    setUser(null);
    setProfile(null);
    setProviderProfile(null);
    setCompanyProfile(null);
    setNotifications([]);
  }, []);

  const detectGpsLocation = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    setDetectingGps(true);
    setLocationNotice('');

    const getBrowserPosition = (highAccuracy: boolean, timeout: number) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Geolocation unsupported'));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout,
          maximumAge: 60000,
        });
      });

    try {
      let pos: GeolocationPosition;
      try {
        pos = await getBrowserPosition(false, 5000);
      } catch {
        pos = await getBrowserPosition(true, 7000);
      }
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`/api/location/geocode?lat=${latitude}&lng=${longitude}`);
      const json = await res.json();
      const d = json?.data;
      const areaOrCity = d?.area && d?.city && d.area !== d.city ? `${d.area}, ${d.city}` : d?.city || 'Current Location';
      setLocation({
        label: d?.pinCode ? `${areaOrCity} (${d.pinCode})` : areaOrCity,
        city: d?.city || 'Current Location',
        state: d?.state || 'India',
        pinCode: d?.pinCode || '',
        lat: latitude,
        lng: longitude,
        source: 'gps',
      });
      setLocationNotice(`Exact GPS detected: ${d?.formattedAddress || areaOrCity}`);
      return true;
    } catch {
      // Browser GPS was blocked/denied (common inside VS Code Simple Browser webview) — fall back to live IP geolocation
      try {
        const res = await fetch('/api/location/geocode?ip=1');
        const json = await res.json();
        const d = json?.data;
        if (d?.city) {
          setLocation({
            label: d.pinCode ? `${d.city} (${d.pinCode})` : `${d.city}, ${d.state || 'India'}`,
            city: d.city,
            state: d.state || 'India',
            pinCode: d.pinCode || '',
            lat: d.lat ?? null,
            lng: d.lng ?? null,
            source: 'gps',
          });
          setLocationNotice(
            `Detected ${d.city}${d.state ? `, ${d.state}` : ''} via network location (open in Chrome/Safari for pinpoint GPS).`,
          );
          return true;
        }
      } catch {
        // ignore
      }
      setLocationNotice('Location permission blocked. Please enter your 6-digit PIN code or pick your city below.');
      return false;
    } finally {
      setDetectingGps(false);
    }
  }, [setLocation]);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (user) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      }).catch(() => {});
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AppContext.Provider
      value={{
        configured,
        loadingAuth,
        user,
        profile,
        providerProfile,
        companyProfile,
        refreshSession,
        signOut,
        location,
        setLocation,
        detectGpsLocation,
        detectingGps,
        locationNotice,
        locationModalOpen,
        setLocationModalOpen,
        notifications,
        unreadCount,
        notifDrawerOpen,
        setNotifDrawerOpen,
        markAllNotificationsRead,
        refreshNotifications,
        localWishlistIds,
        toggleLocalWishlist,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
