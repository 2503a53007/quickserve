import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (QuickServe Orange & White — Gen-Z Edition)
        brand: {
          50: '#FFF7ED', 100: '#FFF1E8', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C',
          500: '#F97316', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412', 900: '#7C2D12',
        },
        // Semantic tokens (CSS variables flip in dark mode)
        background: 'rgb(var(--background) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        success: '#16A34A',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem', '4xl': '2rem' },
      boxShadow: {
        soft: '0 4px 24px -6px rgb(23 23 23 / 0.08)',
        card: '0 2px 12px -2px rgb(249 115 22 / 0.12)',
        glow: '0 10px 30px -8px rgb(249 115 22 / 0.55)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
        'brand-soft': 'linear-gradient(135deg, #FFF1E8 0%, #FFFFFF 60%)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        ping2: { '75%,100%': { transform: 'scale(2.2)', opacity: '0' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 5s ease-in-out infinite',
        pop: 'pop .25s ease-out',
        ping2: 'ping2 1.6s cubic-bezier(0,0,.2,1) infinite',
      },
    },
  },
  plugins: [],
};
export default config;
