import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a SQLite CURRENT_TIMESTAMP value ("YYYY-MM-DD HH:MM:SS", always UTC
 * but without a zone). `new Date()` would read that format as local time.
 */
export function parseSqliteTimestamp(value: string): Date {
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  return new Date(utc);
}
