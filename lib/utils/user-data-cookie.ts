'use client';

import type { User } from '@/lib/contexts/user-context';

export const USER_DATA_COOKIE_NAME = 'it_aware_user_data';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export interface UserPreferences {
  timezone?: string;
}

export interface UserDataCookiePayload {
  user?: User;
  preferences?: UserPreferences;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function decodeBase64(value: string): string | null {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(value, 'base64').toString('utf-8');
    }
    if (typeof atob === 'undefined') return null;
    const binary = atob(value);
    if (typeof TextDecoder === 'undefined') return binary;
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  }
}

function encodeBase64(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64');
  }
  if (typeof TextEncoder !== 'undefined' && typeof btoa !== 'undefined') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }
  return value;
}

function parseCookieValue(raw: string): unknown | null {
  const base64Decoded = decodeBase64(raw);
  if (base64Decoded) {
    try {
      return JSON.parse(base64Decoded) as unknown;
    } catch {
      // Fallback to URL decoding below
    }
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as unknown;
  } catch {
    return null;
  }
}

function isUserLike(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.account === 'object' && typeof record.permissions === 'object';
}

function normalizePayload(parsed: unknown): UserDataCookiePayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;

  if (isUserLike(record)) {
    return { user: record };
  }

  const payload: UserDataCookiePayload = {};
  const maybeUser = record.user;
  if (isUserLike(maybeUser)) {
    payload.user = maybeUser;
  }

  const maybePreferences = record.preferences;
  if (maybePreferences && typeof maybePreferences === 'object') {
    const prefRecord = maybePreferences as Record<string, unknown>;
    if (typeof prefRecord.timezone === 'string') {
      payload.preferences = { timezone: prefRecord.timezone };
    }
  }

  if (payload.user || payload.preferences) return payload;
  return null;
}

export function readUserDataCookie(): UserDataCookiePayload | null {
  const cookieValue = getCookie(USER_DATA_COOKIE_NAME);
  if (!cookieValue) return null;
  const parsed = parseCookieValue(cookieValue);
  return normalizePayload(parsed);
}

export function writeUserDataCookie(payload: UserDataCookiePayload): void {
  if (typeof document === 'undefined') return;
  const encoded = encodeBase64(JSON.stringify(payload));
  document.cookie = `${USER_DATA_COOKIE_NAME}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearUserDataCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${USER_DATA_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

export function updateUserPreferences(preferences: Partial<UserPreferences>): void {
  const existing = readUserDataCookie();
  const nextPreferences: UserPreferences = {
    ...(existing?.preferences ?? {}),
    ...preferences,
  };

  if (nextPreferences.timezone === undefined) {
    delete nextPreferences.timezone;
  }

  const nextPayload: UserDataCookiePayload = {
    user: existing?.user,
    preferences: Object.keys(nextPreferences).length > 0 ? nextPreferences : undefined,
  };

  if (!nextPayload.user && !nextPayload.preferences) {
    clearUserDataCookie();
    return;
  }

  writeUserDataCookie(nextPayload);
}
