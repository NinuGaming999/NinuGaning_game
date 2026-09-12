import { STAT_DISPLAY } from './artifactData';

/** Formats a raw stat value (percent or flat) using the shared stat metadata. */
export function formatStatValue(key, value) {
  const meta = STAT_DISPLAY[key];
  if (!meta) return String(value);
  if (meta.isPercent) return `${(value * 100).toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

export function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}
