'use client';

import { useState } from 'react';

export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy">
      <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {} // clipboard blocked: the field is selectable, so copying by hand still works
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
