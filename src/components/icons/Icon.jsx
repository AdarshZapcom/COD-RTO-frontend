// Shared, restrained inline-SVG icon set (stroke-based, 24px grid,
// no emoji/dingbats) - single source of truth for every icon used across
// panel headers, tabs, and inline flag/evidence rows. Scaffold-owned like
// lib/format.js: extend rather than duplicate a one-off <svg> in a
// component when an existing icon already covers the need.
//
// Every icon accepts the usual svg props (className, width/height, etc.)
// spread last so a caller can override size; `aria-hidden="true"` is the
// default since these are always decorative accents next to real text,
// never the only label for something interactive.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export function SearchIcon(props) {
  return (
    <svg width={16} height={16} {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20 20" />
    </svg>
  );
}

export function TicketIcon(props) {
  return (
    <svg width={16} height={16} {...base} {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a1.5 1.5 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a1.5 1.5 0 0 0 0-4Z" />
      <path d="M14 6v12" strokeDasharray="2 3" />
    </svg>
  );
}

export function ListIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

export function PencilIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function FlagIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h13l-2.5 4L18 12H5" />
    </svg>
  );
}

export function ScaleIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M12 3v18" />
      <path d="M5 8l-3 6a3.5 3.5 0 0 0 6 0Z" />
      <path d="M19 8l-3 6a3.5 3.5 0 0 0 6 0Z" />
      <path d="M5 8h14" />
    </svg>
  );
}

export function HistoryIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function LayersIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 16l9 5 9-5" />
    </svg>
  );
}

export function MessageIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M4 5h16v11H8l-4 3.5V5Z" />
    </svg>
  );
}

export function BarsIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M4 19V9" />
      <path d="M11 19V5" />
      <path d="M18 19v-7" />
    </svg>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <svg width={16} height={16} {...base} {...props}>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17v.01" />
    </svg>
  );
}

export function AlertCircleIcon(props) {
  return (
    <svg width={16} height={16} {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16v.01" />
    </svg>
  );
}

export function AlertOctagonIcon(props) {
  return (
    <svg width={20} height={20} {...base} {...props}>
      <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8Z" />
      <path d="M12 8v5" />
      <path d="M12 16v.01" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg width={20} height={20} {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckCircleIcon(props) {
  return (
    <svg width={20} height={20} {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5 11 15l5-6" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg width={14} height={14} {...base} strokeWidth={2.4} {...props}>
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

export function XIcon(props) {
  return (
    <svg width={14} height={14} {...base} strokeWidth={2.4} {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
    </svg>
  );
}

export function InfoIcon(props) {
  return (
    <svg width={16} height={16} {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8v.01" />
    </svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <svg width={14} height={14} {...base} {...props}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
