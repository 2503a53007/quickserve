'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Zap,
  MapPin,
  ChevronDown,
  Bell,
  Menu,
  X,
  User,
  LogOut,
  ShoppingBag,
  Heart,
  HelpCircle,
  Tag,
  Home,
  Wrench,
  ShieldCheck,
  Briefcase,
  Building2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useApp } from '@/components/providers/AppProvider';

const NAV_LINKS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Explore Services', href: '/services', icon: Wrench },
  { label: 'Offers', href: '/offers', icon: Tag },
  { label: 'Your Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Wishlist', href: '/wishlist', icon: Heart },
  { label: 'Help & Support', href: '/support', icon: HelpCircle },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    profile,
    signOut,
    location,
    setLocationModalOpen,
    unreadCount,
    setNotifDrawerOpen,
  } = useApp();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || user?.phone || 'User';

  return (
    <header
      className={[
        'sticky top-0 z-40 w-full transition-all duration-300 text-[#171717] dark:text-white',
        scrolled
          ? 'bg-white/85 dark:bg-[#0B1120]/85 backdrop-blur-2xl shadow-lg shadow-orange-500/5 dark:shadow-black/30 border-b border-orange-200/80 dark:border-orange-500/30'
          : 'bg-white/75 dark:bg-[#0B1120]/65 backdrop-blur-xl border-b border-orange-100 dark:border-white/10',
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <span className="icon-3d w-9 h-9 rounded-xl bg-gradient-to-br from-[#FB923C] via-[#F97316] to-[#EA580C] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Zap size={18} className="fill-white text-white" />
            </span>
            <div className="leading-none">
              <span className="font-black text-xl tracking-tight text-[#171717] dark:text-white">
                Quick<span className="text-[#F97316]">Serve</span>
              </span>
              <span className="hidden xl:block text-[10px] font-semibold text-[#737373] dark:text-orange-200/80 tracking-wide">
                Book it. Track it. Done.
              </span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'px-3 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap',
                    active
                      ? 'text-[#EA580C] bg-[#FFF1E8] border border-orange-200 dark:text-orange-300 dark:bg-[#F97316]/20 dark:border-orange-400/30'
                      : 'text-slate-700 hover:text-[#171717] hover:bg-[#FFF7F2] dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/10',
                  ].join(' ')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Location selector */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-200 dark:border-orange-400/35 text-xs font-bold text-[#171717] dark:text-white hover:border-[#F97316] hover:bg-[#FFF7F2] dark:hover:bg-white/15 transition-colors bg-white/90 dark:bg-white/10 backdrop-blur-md"
            >
              <MapPin size={14} className="text-[#F97316] shrink-0" />
              <span className="max-w-[120px] truncate">{location.label}</span>
              <ChevronDown size={12} className="text-[#737373] dark:text-orange-200" />
            </button>

            {/* Light (White & Orange) / Dark (3D Cyber-Glass) toggle */}
            <ThemeToggle size="sm" />

            {/* Notification bell */}
            <button
              type="button"
              onClick={() => setNotifDrawerOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:text-[#EA580C] dark:hover:text-orange-300 hover:bg-[#FFF1E8] dark:hover:bg-white/10 transition-colors"
              aria-label="Open notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[#F97316] text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Always-visible Login Page button so user can open /login with 1 click anytime */}
            <Link
              href="/login"
              className="btn-3d-orange inline-flex items-center justify-center px-3.5 h-9 rounded-xl text-white text-xs sm:text-sm font-extrabold shrink-0"
            >
              Login
            </Link>

            {/* Auth / Profile */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-orange-200 dark:border-orange-400/35 bg-white/90 dark:bg-white/10 hover:border-[#F97316] transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center text-white text-xs font-extrabold">
                    {displayName[0]?.toUpperCase() || 'U'}
                  </span>
                  <span className="hidden sm:block text-sm font-bold text-[#171717] dark:text-white max-w-[90px] truncate">
                    {displayName.split(' ')[0]}
                  </span>
                  <ChevronDown size={14} className="text-[#737373] dark:text-orange-200" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-orange-100 dark:ring-slate-700 py-2 overflow-hidden"
                    >
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-[#171717] dark:text-white truncate">{displayName}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F97316]">
                          {profile?.role || 'customer'} account
                        </p>
                      </div>

                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-[#FFF7F2] dark:hover:bg-slate-800"
                      >
                        <User size={15} /> Profile & Addresses
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-[#FFF7F2] dark:hover:bg-slate-800"
                      >
                        <ShoppingBag size={15} /> Your Orders
                      </Link>
                      {profile?.role === 'provider' && (
                        <Link
                          href="/provider"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#EA580C] hover:bg-[#FFF7F2] dark:hover:bg-slate-800"
                        >
                          <Briefcase size={15} /> Provider Dashboard
                        </Link>
                      )}
                      {profile?.role === 'company' && (
                        <Link
                          href="/company"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#EA580C] hover:bg-[#FFF7F2] dark:hover:bg-slate-800"
                        >
                          <Building2 size={15} /> Company Dashboard
                        </Link>
                      )}
                      {profile?.role === 'admin' && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#EA580C] hover:bg-[#FFF7F2] dark:hover:bg-slate-800"
                        >
                          <ShieldCheck size={15} /> Admin Panel
                        </Link>
                      )}

                      <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                      <Link
                        href="/login"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#FFF7F2] dark:hover:bg-slate-800"
                      >
                        <User size={15} /> Switch Account / Login
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          await signOut();
                          setUserMenuOpen(false);
                          router.push('/login');
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Mobile Hamburger */}
            <button
              type="button"
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-orange-100 dark:border-slate-800 bg-white dark:bg-slate-950"
          >
            <div className="px-4 py-3 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setLocationModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-orange-200 dark:border-slate-700 text-sm font-bold text-[#171717] dark:text-slate-200 mb-2"
              >
                <MapPin size={15} className="text-[#F97316]" />
                {location.label}
                <ChevronDown size={14} className="ml-auto" />
              </button>

              {NAV_LINKS.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold',
                      active
                        ? 'text-[#EA580C] bg-[#FFF1E8] dark:bg-orange-500/15'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-[#FFF7F2] dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <Icon size={17} />
                    {label}
                  </Link>
                );
              })}

              <div className="pt-2 pb-1 grid grid-cols-2 gap-2">
                <Link
                  href="/provider"
                  className="text-center py-2.5 rounded-xl border border-orange-200 dark:border-slate-700 text-xs font-bold text-[#EA580C]"
                >
                  Provider Portal
                </Link>
                <Link
                  href="/company"
                  className="text-center py-2.5 rounded-xl border border-orange-200 dark:border-slate-700 text-xs font-bold text-[#EA580C]"
                >
                  Company Portal
                </Link>
              </div>

              {!user && (
                <div className="pt-1 pb-2">
                  <Link
                    href="/login"
                    className="block w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold text-sm"
                  >
                    Login / Sign Up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
