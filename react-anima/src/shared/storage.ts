import type { WatchStatus } from '@anima/core';

export type WatchState = {
  episode: number;
  status: WatchStatus;
};

const STORAGE_KEY = 'anima.watchState.v1';
const SIDEBAR_STORAGE_KEY = 'anima.sidebarCollapsed.v1';

export function loadWatchState(): Record<string, WatchState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWatchState(value: Record<string, WatchState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function loadSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

export function saveSidebarCollapsed(value: boolean) {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
}
