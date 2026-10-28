import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Inline-SVG icon set — one component keyed by name, so templates never
 * inline raw `<svg>` markup. All glyphs share a 20×20 grid and a 1.5 stroke.
 * Unknown names (e.g. a new enum icon) fall back to `grid`.
 */
const PATHS = {
  // navigation & layout
  home: 'M3 9.5L10 4l7 5.5V16a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3H8v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z',
  map: 'M7.5 3.5 2.5 5.5v11l5-2 5 2 5-2v-11l-5 2-5-2Zm0 0v11m5-9v11',
  'map-pin':
    'M10 17.5s5.5-5.2 5.5-9.5a5.5 5.5 0 1 0-11 0c0 4.3 5.5 9.5 5.5 9.5Zm0-7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  grid: 'M3 3h5.5v5.5H3V3Zm8.5 0H17v5.5h-5.5V3ZM3 11.5h5.5V17H3v-5.5Zm8.5 0H17V17h-5.5v-5.5Z',
  menu: 'M3 5h14M3 10h14M3 15h14',
  sidebar: 'M3.5 4h13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm8.5 0v12',
  layers: 'M10 3 2.5 7 10 11l7.5-4L10 3Zm-7.5 7L10 14l7.5-4M2.5 13 10 17l7.5-4',
  'chevron-down': 'M5.5 8 10 12.5 14.5 8',
  'chevron-left': 'M12 5.5 7.5 10l4.5 4.5',
  'chevron-right': 'M8 5.5l4.5 4.5L8 14.5',
  'arrow-left': 'M16 10H4m0 0 5-5m-5 5 5 5',
  'arrow-right': 'M4 10h12m0 0-5-5m5 5-5 5',
  external:
    'M11 3.5h5.5V9M16.5 3.5 9 11M14 11.5V16a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 4 16V7a.5.5 0 0 1 .5-.5H9',
  more: 'M10 5.5h.01M10 10h.01M10 14.5h.01',
  close: 'M5 5l10 10M15 5 5 15',

  // entities
  bike: 'M5.5 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm9 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5.5 13l3-5.5h4.5l1.5 5.5M8.5 7.5l2 5.5h-1M12 5h2',
  user: 'M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 7c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5',
  users:
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 16c.3-2.5 2-4 4.5-4S11 13.5 11 16M9.5 12.2c.4-1.6 1.9-2.7 4-2.7 2.5 0 4.2 1.5 4.5 4',
  building:
    'M4 17V4.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1V17m0-9h3a1 1 0 0 1 1 1v8M2.5 17h15M7 7h2M7 10h2M7 13h2',
  route:
    'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 15h5.5a2.5 2.5 0 0 0 0-5h-5a2.5 2.5 0 0 1 0-5H13',
  file: 'M6 2.5h5.5L15 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm5 0V6h3.5',
  image:
    'M3.5 4h13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm-1 9 4-4 4 4 2-2 4 4M13 8.5h.01',
  video:
    'M3.5 5.5h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Zm10 3 4-2.5v8l-4-2.5',
  card: 'M3 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 3.5h16M5 12h3',
  cash: 'M2.5 5.5h15v9h-15v-9Zm7.5 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5 8v4m10-4v4',
  phone: 'M6.5 2.5h7a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm3 12.5h1',
  key: 'M12.5 11a4 4 0 1 0-3.9-3.1L3 13.5V17h3.5v-2h2v-2h2l.6-.6A4 4 0 0 0 12.5 11Zm1-4.5h.01',

  // fleet & maintenance
  wrench:
    'M12.5 3a4 4 0 0 0-3.8 5.3L3.5 13.5a1.4 1.4 0 0 0 2 2l5.2-5.2A4 4 0 0 0 16.9 7l-2.4 2.4-2.1-.5-.5-2.1L14.3 4.4A4 4 0 0 0 12.5 3Z',
  droplet: 'M10 2.5s5 5.3 5 9a5 5 0 0 1-10 0c0-3.7 5-9 5-9Z',
  gauge: 'M3.5 14a6.5 6.5 0 1 1 13 0M10 14l3-4.5M10 14h.01',
  power: 'M10 2.5v7M6 5a6 6 0 1 0 8 0',
  battery:
    'M3 6.5h12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Zm15 2v3M5 9v2m3-2v2',
  wifi: 'M2.5 7.5a10.5 10.5 0 0 1 15 0M5 10.5a7 7 0 0 1 10 0M7.5 13.5a3.5 3.5 0 0 1 5 0M10 16.5h.01',
  'wifi-off':
    'M3 3l14 14M7.5 13.5a3.5 3.5 0 0 1 5 0M5 10.5a7 7 0 0 1 3-1.8M2.5 7.5a10.5 10.5 0 0 1 4-2.5M12.5 8.8a7 7 0 0 1 2.5 1.7M10 16.5h.01',
  'cloud-off':
    'M3 3l14 14M6 6.5A4 4 0 0 0 5.5 14.5H14m2.7-1.4A3 3 0 0 0 14.5 8h-.2A5 5 0 0 0 9 4.6',
  target:
    'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm0-4a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-3.5h.01',
  navigation: 'M10 2.5 16 17l-6-3.5L4 17l6-14.5Z',
  speed: 'M10 17a7 7 0 1 1 7-7M10 10l3.5-3.5M17 13.5l-2 2.5-1.5-1',

  // status
  'check-circle': 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM6.8 10.2l2.2 2.2 4.2-4.6',
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  alert: 'M10 3 2.5 16.5h15L10 3Zm0 5v3.5m0 2.5h.01',
  info: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 9v4.5M10 6.5h.01',
  help: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM7.9 7.7a2.2 2.2 0 0 1 4.2.8c0 1.5-2.1 1.9-2.1 3.2M10 14h.01',
  'minus-circle': 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM6.5 10h7',
  ban: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM4.7 4.7l10.6 10.6',
  clock: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 6v4l2.5 2',
  shield: 'M10 2.5 16 5v4.5c0 3.8-2.6 6.7-6 8-3.4-1.3-6-4.2-6-8V5l6-2.5Zm-2.5 7.7 1.8 1.8 3.4-3.6',
  bell: 'M10 3a4 4 0 0 0-4 4v2.4c0 .5-.2 1-.5 1.4L4 13h12l-1.5-2.2a2.3 2.3 0 0 1-.5-1.4V7a4 4 0 0 0-4-4Zm-1.7 12a1.8 1.8 0 0 0 3.4 0',
  pulse: 'M2.5 10h3l2-5 4 10 2-5h4',
  pie: 'M10 2.5V10h7.5A7.5 7.5 0 1 1 10 2.5Zm2.5-.1A7.5 7.5 0 0 1 17.6 7.5h-5.1V2.4Z',
  archive: 'M2.5 4h15v3.5h-15V4Zm1.5 3.5V16h12V7.5M8 11h4',
  pause: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM8.3 7.5v5m3.4-5v5',
  play: 'M6.5 4.5v11l9-5.5-9-5.5Z',

  // actions
  plus: 'M10 4.5v11M4.5 10h11',
  edit: 'M11.8 4.2 15.8 8.2M3.5 16.5l1-4.2 8.8-8.8a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-8.8 8.8-4.2 1Z',
  trash:
    'M3.5 5.5h13M8 5.5V3.5h4v2M5 5.5l.8 11a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1l.8-11M8.5 9v5m3-5v5',
  search: 'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm8.5 2-4-4',
  filter: 'M3 4.5h14l-5.5 6.5v5l-3-1.5V11L3 4.5Z',
  refresh: 'M16.5 4.5v4h-4M3.5 15.5v-4h4M15.6 8.5A6 6 0 0 0 4.7 6.5M4.4 11.5a6 6 0 0 0 10.9 2',
  download: 'M10 3v10m0 0-4-4m4 4 4-4M3.5 16.5h13',
  upload: 'M10 13V3m0 0L6 7m4-4 4 4M3.5 16.5h13',
  copy: 'M7.5 7.5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM13.5 7.5v-3a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2',
  print: 'M5.5 7.5v-4h9v4M5.5 14h-2v-6a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .5.5v6h-2m-9-2.5h9v6h-9v-6Z',
  send: 'M17.5 2.5 9 11M17.5 2.5 12 17.5 9 11 2.5 8l15-5.5Z',
  whatsapp:
    'M3 17l1.1-3.6A7 7 0 1 1 6.8 16L3 17Zm4.6-10.3c.3-.4.7-.4.9 0l.8 1.5c.1.3 0 .6-.2.8l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.5-.3.8-.2l1.5.8c.4.2.4.6 0 .9-.7.7-1.6 1-2.6.6A8.4 8.4 0 0 1 7.2 9.3c-.4-1-.1-1.9.4-2.6Z',
  logout: 'M8 3.5H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3M13 13.5 16.5 10 13 6.5M16.5 10H8',
  lock: 'M5.5 9h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm1.5 0V6.5a3 3 0 0 1 6 0V9m-3 3v2',
  mail: 'M3.5 5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-.5 1 7 5 7-5',
  eye: 'M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Zm8 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  'eye-off':
    'M3 3l14 14M8.2 5a8 8 0 0 1 1.8-.2c5 0 8 5.2 8 5.2a14 14 0 0 1-2.2 2.8M12.6 15a7.6 7.6 0 0 1-2.6.5c-5 0-8-5.5-8-5.5a14.5 14.5 0 0 1 3.4-3.8M8.3 8.3a2.5 2.5 0 0 0 3.4 3.4',
  settings:
    'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7-2.5-1.6-.3a5.4 5.4 0 0 0-.5-1.2l1-1.4-1.4-1.4-1.4 1a5.4 5.4 0 0 0-1.2-.5L11.6 3H8.4l-.3 1.7c-.4.1-.8.3-1.2.5l-1.4-1L4.1 5.6l1 1.4c-.2.4-.4.8-.5 1.2L3 10.5v0l1.6.3c.1.4.3.8.5 1.2l-1 1.4 1.4 1.4 1.4-1c.4.2.8.4 1.2.5l.3 1.7h3.2l.3-1.7c.4-.1.8-.3 1.2-.5l1.4 1 1.4-1.4-1-1.4c.2-.4.4-.8.5-1.2L17 10Z',
  chart: 'M4 16V9M9 16V4M14 16v-6M3 17h13',
  calendar:
    'M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 4h14M7 3v4m6-4v4',
  sun: 'M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1.1 1.1M14.6 14.6l1.1 1.1M4.3 15.7l1.1-1.1M14.6 5.4l1.1-1.1',
  moon: 'M16.5 12.2A6.5 6.5 0 0 1 7.8 3.5a6.5 6.5 0 1 0 8.7 8.7Z',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [style.width.rem]="size() / 16"
      [style.height.rem]="size() / 16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        [attr.d]="path()"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; flex-shrink: 0; }'],
})
export class IconComponent {
  /** An `IconName`, or any string (enum metadata) — unknown names render `grid`. */
  readonly name = input.required<IconName | string>();
  /** Design size in px at UI scale 1; rendered in rem so it follows `--ui-scale`. */
  readonly size = input<number>(16);

  protected readonly path = computed(
    () => (PATHS as Record<string, string>)[this.name()] ?? PATHS.grid,
  );
}
