'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Zap, X, ChevronRight } from 'lucide-react';

export function ProviderStatusBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 px-4 text-center text-sm font-semibold z-30">
      <span className="inline-flex items-center gap-2 justify-center">
        <Zap size={15} className="fill-white shrink-0" />
        Are you a service professional?
        <Link
          href="/provider/register"
          className="underline underline-offset-2 inline-flex items-center gap-0.5 hover:text-orange-100 transition-colors"
        >
          Join QuickServe
          <ChevronRight size={15} />
        </Link>
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-orange-700/40 transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );
}
