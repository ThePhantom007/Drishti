import React, { useId } from 'react';

/**
 * The Drishti brand mark -- a teal-to-navy "D", a white person+medical-cross
 * silhouette, and a green-teal leaf overlapping the bottom-left edge.
 *
 * Rendered as inline SVG (not `<img src="/logo-mark.svg">`) on purpose: an
 * external file reference depends on that file actually having been
 * deployed/copied to the right path, and if it's missing or 404s, the
 * browser just shows a broken-image icon with no way to recover. Inlining
 * the markup means the logo is part of the component tree itself -- if
 * this component rendered at all, the logo rendered.
 *
 * `useId()` keeps the gradient ids unique per instance, since this
 * component is used several times on one page (navbar, login modal,
 * register modal, auth gate screen) and duplicate SVG ids across
 * simultaneously-mounted instances can make browsers pick the wrong
 * gradient definition for the others.
 */
export default function DrishtiLogo({ className = '', title = 'Drishti' }) {
  const uid = useId();
  const dGradId = `drishti-d-grad-${uid}`;
  const leafGradId = `drishti-leaf-grad-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={dGradId} x1="10%" y1="0%" x2="95%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="45%" stopColor="#0e8fb0" />
          <stop offset="100%" stopColor="#123a63" />
        </linearGradient>
        <linearGradient id={leafGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      {/* "D" body: flat left edge, semicircular bulge on the right */}
      <path d="M38 8 H55 A42 42 0 1 1 55 92 H38 Z" fill={`url(#${dGradId})`} />

      {/* Medical cross, upper-right of the D */}
      <rect x="69" y="15" width="6" height="22" rx="2" fill="#ffffff" />
      <rect x="61" y="23" width="22" height="6" rx="2" fill="#ffffff" />

      {/* Person: head + open-armed body, silhouetted in white */}
      <circle cx="58" cy="34" r="9" fill="#ffffff" />
      <path
        d="M40 74 C48 54 55 48 62 48 C69 48 78 56 85 74 C76 67 68 63 62 63 C55 63 46 67 40 74 Z"
        fill="#ffffff"
      />

      {/* Leaf, overlapping the D's left edge */}
      <path
        d="M15 78 C28 55 48 45 68 50 C62 68 48 88 28 96 C20 90 14 85 15 78 Z"
        fill={`url(#${leafGradId})`}
      />
      <path
        d="M20 80 Q40 70 62 52"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
