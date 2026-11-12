import type { TFunction } from 'i18next';

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Usamos `n` (e não `count`) para não depender de Intl.PluralRules.

/** Formato compacto feito à mão: `notation: 'compact'` não é garantido no Hermes. */
export function formatViews(views: number, t: TFunction, language: string) {
  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 1 });
  if (views >= 1_000_000) return t('videos.viewsMillions', { n: fmt(views / 1_000_000) });
  if (views >= 1_000) return t('videos.viewsThousands', { n: fmt(views / 1_000) });
  return t('videos.views', { n: fmt(views) });
}

export function formatTimeAgo(iso: string, t: TFunction, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return t('videos.minutesAgo', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('videos.hoursAgo', { n: hours });
  return t('videos.daysAgo', { n: Math.round(hours / 24) });
}
