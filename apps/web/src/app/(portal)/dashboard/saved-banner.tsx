'use client';

import { useState } from 'react';

/** Shown once, right after `upsertProfileAction` redirects here with `?saved=1`. */
export function SavedBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <p
      role="status"
      className="flex items-center justify-between gap-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200"
    >
      <span>Your Account Info was saved.</span>
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-emerald-300 hover:text-emerald-100"
      >
        ✕
      </button>
    </p>
  );
}
