export const TYPOGRAPHY_FONT_FAMILIES = {
  ui: '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const TYPOGRAPHY_SCALE = {
  compact: { px: 10, lineHeight: 14 },
  sm: { px: 11, lineHeight: 16 },
  ui: { px: 12, lineHeight: 16 },
  body: { px: 13, lineHeight: 20 },
  message: { px: 13.5, lineHeight: 21 },
  title: { px: 15, lineHeight: 20 },
  display: { px: 24, lineHeight: 32 },
} as const;
