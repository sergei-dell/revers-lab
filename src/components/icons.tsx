import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const ApertureMark = (props: P) => (
  <svg {...base(props)} strokeWidth={1.4}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M12 2.8 8.1 9.6M21.2 12h-7.9M17.6 19.6l-3.9-6.8M6.4 19.6l3.9-6.8M2.8 12h7.9M12 2.8l3.9 6.8" />
    <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUpload = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconLink = (props: P) => (
  <svg {...base(props)}>
    <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.2 1.2" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.2-1.2" />
  </svg>
);

export const IconPlay = (props: P) => (
  <svg {...base(props)}>
    <path d="M7.5 4.8v14.4L19.5 12z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPause = (props: P) => (
  <svg {...base(props)}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconShutter = (props: P) => (
  <svg {...base(props)}>
    <rect x="2.8" y="6.4" width="18.4" height="13.2" rx="2.2" />
    <path d="M8.6 3.6h6.8l1 2.8H7.6z" />
    <circle cx="12" cy="13" r="3.6" />
  </svg>
);

export const IconFilm = (props: P) => (
  <svg {...base(props)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M7.2 4.5v15M16.8 4.5v15M3 9.4h4.2M3 14.6h4.2M16.8 9.4H21M16.8 14.6H21" />
  </svg>
);

export const IconSpark = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2 10.3 12.4 4.5 10.7 10.3 9z" />
    <path d="M18.6 3.4v3M17.1 4.9h3M5.4 17.2v2.4M4.2 18.4h2.4" />
  </svg>
);

export const IconWave = (props: P) => (
  <svg {...base(props)}>
    <path d="M3 15.5h2.6L8 8.2l2.6 9.6L13.4 5l2.4 10.5h5.2" />
  </svg>
);

export const IconHistory = (props: P) => (
  <svg {...base(props)}>
    <path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1L3.4 8.6" />
    <path d="M3.2 4.4v4.4h4.4M12 7.6V12l3 1.8" />
  </svg>
);

export const IconCopy = (props: P) => (
  <svg {...base(props)}>
    <rect x="9" y="9" width="11.4" height="11.4" rx="2" />
    <path d="M15 6.2V5.4A1.8 1.8 0 0 0 13.2 3.6H5.4A1.8 1.8 0 0 0 3.6 5.4v7.8A1.8 1.8 0 0 0 5.4 15h.8" />
  </svg>
);

export const IconCheck = (props: P) => (
  <svg {...base(props)}>
    <path d="M4.6 12.6 9.4 17.4 19.4 6.8" />
  </svg>
);

export const IconDownload = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 3.8v11.6m0 0 4.4-4.4M12 15.4l-4.4-4.4" />
    <path d="M4 17.4v1.4A1.6 1.6 0 0 0 5.6 20.4h12.8a1.6 1.6 0 0 0 1.6-1.6v-1.4" />
  </svg>
);

export const IconTrash = (props: P) => (
  <svg {...base(props)}>
    <path d="M4.6 6.8h14.8M9.4 6.8V4.6h5.2v2.2M6.6 6.8l.9 12.1a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12.1" />
    <path d="M10.4 10.6v6M13.6 10.6v6" />
  </svg>
);

export const IconClose = (props: P) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconScissors = (props: P) => (
  <svg {...base(props)}>
    <circle cx="6.2" cy="6.4" r="2.6" />
    <circle cx="6.2" cy="17.6" r="2.6" />
    <path d="M8.5 7.6 20 18M20 6 8.5 16.4" />
  </svg>
);

export const IconSheet = (props: P) => (
  <svg {...base(props)}>
    <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="1.8" />
    <path d="M3.2 9.4h17.6M3.2 14.6h17.6M9.2 4.4v15.2M15 4.4v15.2" />
  </svg>
);

export const IconArchive = (props: P) => (
  <svg {...base(props)}>
    <rect x="3.2" y="4.2" width="17.6" height="4.2" rx="1.2" />
    <path d="M4.8 8.4v10.2a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6V8.4" />
    <path d="M10 12.2h4" />
  </svg>
);

export const IconAlert = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 4.4 21 19.6H3z" />
    <path d="M12 10v4.2M12 17.1v.1" />
  </svg>
);

export const IconLoader = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 3.4v3.4M12 17.2v3.4M20.6 12h-3.4M6.8 12H3.4M18.1 5.9l-2.4 2.4M8.3 15.7l-2.4 2.4M18.1 18.1l-2.4-2.4M8.3 8.3 5.9 5.9" />
  </svg>
);

export const IconGrid = (props: P) => (
  <svg {...base(props)}>
    <rect x="3.6" y="3.6" width="7" height="7" rx="1.4" />
    <rect x="13.4" y="3.6" width="7" height="7" rx="1.4" />
    <rect x="3.6" y="13.4" width="7" height="7" rx="1.4" />
    <rect x="13.4" y="13.4" width="7" height="7" rx="1.4" />
  </svg>
);

export const IconClock = (props: P) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7v5.2l3.2 2" />
  </svg>
);

export const IconSplit = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 5.6h5.2L15 12l-5.8 6.4H4l5.8-6.4z" />
    <path d="M16.4 5.6H20l-3.4 6.4L20 18.4h-3.6" />
  </svg>
);

export const IconBolt = (props: P) => (
  <svg {...base(props)}>
    <path d="M13.4 2.8 5.2 13.6h5.4L10 21.2l8.6-11.2h-5.6z" />
  </svg>
);
