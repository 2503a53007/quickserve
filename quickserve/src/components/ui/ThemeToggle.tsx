'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function ThemeToggle({ size = 'md', className = '' }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;
  const toggle = () => setTheme(isDark ? 'light' : 'dark');
  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to White 3D theme' : 'Switch to Dark 3D theme'}
      className={[
        'relative inline-flex items-center gap-1.5 rounded-full font-extrabold transition-all duration-200 border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
        'bg-white/90 text-[#EA580C] border-orange-200 hover:border-[#F97316] hover:bg-[#FFF1E8]',
        'dark:bg-white/10 dark:text-orange-200 dark:border-orange-400/40 dark:hover:bg-white/20',
        size === 'sm' ? 'px-2.5 h-8 text-[11px]' : 'px-3.5 h-9 text-xs',
        className,
      ].join(' ')}
    >
      {isDark ? (
        <>
          <Sun size={iconSize} className="text-amber-400" />
          <span>White 3D</span>
        </>
      ) : (
        <>
          <Moon size={iconSize} className="text-[#EA580C]" />
          <span>Dark 3D</span>
        </>
      )}
    </button>
  );
}
