/**
 * Timezone and Date/Time Utilities for Bangladesh (Asia/Dhaka)
 * Official IANA Timezone: 'Asia/Dhaka'
 */

export const DHAKA_TIMEZONE = 'Asia/Dhaka';

/**
 * Format a Date, timestamp (ms), or ISO string into Bangladesh date format (e.g. "29 Aug 2026")
 */
export function formatDhakaDate(dateOrTimestamp: Date | number | string = new Date()): string {
  const d = typeof dateOrTimestamp === 'number' || typeof dateOrTimestamp === 'string'
    ? new Date(dateOrTimestamp)
    : dateOrTimestamp;

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DHAKA_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a Date, timestamp (ms), or ISO string into Bangladesh time format (e.g. "05:30 AM" or "11:15 PM")
 */
export function formatDhakaTime(dateOrTimestamp: Date | number | string = new Date()): string {
  const d = typeof dateOrTimestamp === 'number' || typeof dateOrTimestamp === 'string'
    ? new Date(dateOrTimestamp)
    : dateOrTimestamp;

  if (isNaN(d.getTime())) {
    return 'Invalid Time';
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format a Date or timestamp into combined Bangladesh date & time string
 */
export function formatDhakaDateTime(dateOrTimestamp: Date | number | string = new Date()): string {
  return `${formatDhakaDate(dateOrTimestamp)} ${formatDhakaTime(dateOrTimestamp)}`;
}

/**
 * Get Bangladesh local date key in format "YYYY-MM-DD" for strict day matching and comparison
 */
export function getDhakaDateKey(dateOrTimestamp: Date | number | string = new Date()): string {
  const d = typeof dateOrTimestamp === 'number' || typeof dateOrTimestamp === 'string'
    ? new Date(dateOrTimestamp)
    : dateOrTimestamp;

  if (isNaN(d.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Check if a given timestamp occurred "Today" in Bangladesh (Asia/Dhaka) timezone
 */
export function isTodayInDhaka(timestampMs: number | Date | string, referenceDate: Date = new Date()): boolean {
  const itemDateKey = getDhakaDateKey(timestampMs);
  const todayDateKey = getDhakaDateKey(referenceDate);
  return Boolean(itemDateKey && todayDateKey && itemDateKey === todayDateKey);
}
