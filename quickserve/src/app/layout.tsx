import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AppProvider } from '@/components/providers/AppProvider';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { NotificationProvider } from '@/components/layout/NotificationProvider';
import { LocationModal } from '@/components/layout/LocationModal';
import { NotificationDrawer } from '@/components/layout/NotificationDrawer';

export const metadata: Metadata = {
  title: 'QuickServe – Your Services. Your Vibe. | Book it. Track it. Done.',
  description:
    'Find trusted local service professionals and registered companies across India. Electricians, plumbers, AC repair, cleaning & more — book by hours, track live ETA, verify with OTP, and pay via Cash or UPI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <SmoothScrollProvider>
            <AppProvider>
              <NotificationProvider>
                {children}
                <LocationModal />
                <NotificationDrawer />
              </NotificationProvider>
            </AppProvider>
          </SmoothScrollProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
