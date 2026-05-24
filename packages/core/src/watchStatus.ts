export type WatchStatus = 'planned' | 'watching' | 'completed' | 'dropped';

export type ServerWatchStatus = 'PLANNED' | 'WATCHING' | 'COMPLETED' | 'DROPPED';

export type ShikimoriWatchStatus = 'planned' | 'watching' | 'rewatching' | 'completed' | 'on_hold' | 'dropped';

export const WATCH_STATUS_OPTIONS: Array<{ value: WatchStatus; label: string }> = [
  { value: 'planned', label: 'В планах' },
  { value: 'watching', label: 'Смотрю' },
  { value: 'completed', label: 'Просмотрено' },
  { value: 'dropped', label: 'Брошено' },
];

export function fromServerWatchStatus(status: string): WatchStatus {
  switch (status) {
    case 'WATCHING':
      return 'watching';
    case 'COMPLETED':
      return 'completed';
    case 'DROPPED':
      return 'dropped';
    default:
      return 'planned';
  }
}

export function toServerWatchStatus(status: WatchStatus): ServerWatchStatus {
  switch (status) {
    case 'watching':
      return 'WATCHING';
    case 'completed':
      return 'COMPLETED';
    case 'dropped':
      return 'DROPPED';
    default:
      return 'PLANNED';
  }
}

export function watchStatusLabel(status: WatchStatus) {
  return WATCH_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'В планах';
}

export function fromShikimoriWatchStatus(status: ShikimoriWatchStatus): WatchStatus {
  switch (status) {
    case 'watching':
    case 'rewatching':
      return 'watching';
    case 'completed':
      return 'completed';
    case 'dropped':
      return 'dropped';
    case 'planned':
    case 'on_hold':
    default:
      return 'planned';
  }
}
