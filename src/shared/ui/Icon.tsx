export type IconName = 'menu' | 'grid' | 'store' | 'users' | 'shield' | 'clock' | 'search' | 'lock' | 'box' | 'key' | 'logout' | 'bell' | 'clipboard' | 'alert' | 'inventory' | 'layers' | 'truck' | 'tool' | 'bike'

const paths: Record<IconName, string> = {
  bell: 'M5 17h14l-2-3V9a5 5 0 00-10 0v5l-2 3zm5 3h4',
  clipboard: 'M9 4H5v17h14V4h-4M9 3h6v4H9zM8 11h8m-8 4h6',
  alert: 'M12 3L2 21h20L12 3zm0 6v5m0 3v1',
  inventory: 'M3 20h18M6 17V9m6 8V4m6 13V7M4 12h4m2-4h4m2 4h4',
  layers: 'M12 3L2 8l10 5 10-5-10-5zM2 12l10 5 10-5M2 16l10 5 10-5',
  truck: 'M3 5h11v12H3zM14 9h4l3 4v4h-7M7 21a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z',
  tool: 'M14 4a5 5 0 00-5 6L3 16a3 3 0 004 4l6-6a5 5 0 006-6l-4 3-3-3 2-4z',
  bike: 'M5 20a4 4 0 110-8 4 4 0 010 8zm14 0a4 4 0 110-8 4 4 0 010 8zM5 16l5-9 5 9h4l-4-12h-3M8 7h4',
  menu: 'M4 6h16M4 12h16M4 18h16', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  store: 'M4 10h16M5 10v9h14v-9M3.5 10l1.6-5h13.8l1.6 5M9 19v-5h6v5',
  users: 'M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 18.5V20m6-8a4 4 0 110-8 4 4 0 010 8zm6-7a4 4 0 010 7m2 3h1a3 3 0 013 3v2',
  shield: 'M12 3l8 3v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3zm-3 9l2 2 4-4',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v5l3 2', search: 'M10.8 18a7.2 7.2 0 110-14.4 7.2 7.2 0 010 14.4zm5.2-1l4 4',
  lock: 'M6 10h12v10H6zM8.5 10V7a3.5 3.5 0 017 0v3m-3.5 4v2', box: 'M4 7l8-4 8 4-8 4-8-4zm0 0v10l8 4 8-4V7m-8 4v10',
  key: 'M7.5 14a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm4-2.5L21 21m-4-4 2-2m-5-1 2-2', logout: 'M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 012 2v14a2 2 0 01-2 2h-7',
}

export default function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[name]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
