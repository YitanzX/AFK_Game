import { t } from '../i18n';

/** 12 -> "12", 1234 -> "1.2K", 3_400_000 -> "3.4M". */
export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T'];
  let value = n;
  let i = -1;
  while (Math.abs(value) >= 1000 && i < units.length - 1) {
    value /= 1000;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)}${units[i]}`;
}

/** Localised, coarse duration: "2h 5m", "45s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(t('time.hours', { n: h }));
  if (m > 0 && h < 10) parts.push(t('time.minutes', { n: m }));
  if (h === 0 && m === 0) parts.push(t('time.seconds', { n: sec }));
  return parts.join(' ');
}
