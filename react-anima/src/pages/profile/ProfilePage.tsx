import { useState } from 'react';
import { fromServerWatchStatus, watchStatusLabel, type WatchStatus } from '@anima/core';
import detachIcon from '../../assets/detach.svg';
import importIcon from '../../assets/import.svg';
import profileCheckIcon from '../../assets/profile-check.svg';
import profileEyeIcon from '../../assets/profile-eye.svg';
import profileNoteIcon from '../../assets/profile-note.svg';
import settingsIcon from '../../assets/settings.svg';
import shikimoriIcon from '../../assets/shikimori.png';
import trashIcon from '../../assets/trash.svg';
import { useAuth } from '../../features/auth/AuthProvider';
import { useToast } from '../../shared/ui/ToastProvider';

export function ProfilePage() {
  const { user, authStatus, diaryEntries: entries, login, logout } = useAuth();
  const profileFilters: Array<{ status: WatchStatus; label: string; count: number; icon: string }> = [
    { status: 'watching', label: 'Смотрю', count: entries.filter((entry) => entry.status === 'WATCHING').length, icon: profileEyeIcon },
    { status: 'completed', label: 'Просмотрено', count: entries.filter((entry) => entry.status === 'COMPLETED').length, icon: profileCheckIcon },
    { status: 'dropped', label: 'Брошено', count: entries.filter((entry) => entry.status === 'DROPPED').length, icon: trashIcon },
    { status: 'planned', label: 'В планах', count: entries.filter((entry) => entry.status === 'PLANNED').length, icon: profileNoteIcon },
  ];
  const profileFriends = [
    { id: 'mira', name: 'Mira', status: 'online' },
    { id: 'kira', name: 'Kira', status: 'online' },
    { id: 'ren', name: 'Ren', status: 'offline' },
    { id: 'yuki', name: 'Yuki', status: 'offline' },
    { id: 'sora', name: 'Sora', status: 'offline' },
  ];
  const sortedFriends = [...profileFriends].sort((left, right) => Number(right.status === 'online') - Number(left.status === 'online'));
  const [selectedStatus, setSelectedStatus] = useState<WatchStatus>('watching');
  const [sidebarMode, setSidebarMode] = useState<'overview' | 'settings'>('overview');
  const selectedFilter = profileFilters.find((filter) => filter.status === selectedStatus) ?? profileFilters[0];
  const filteredEntries = entries.filter((entry) => fromServerWatchStatus(entry.status) === selectedStatus);

  if (authStatus === 'loading') {
    return <section className="profile-page empty-state">Загружаем профиль...</section>;
  }

  if (!user) {
    return (
      <section className="profile-page empty-state">
        <h2>Профиль</h2>
        <p>Войди через Discord, чтобы вести дневник просмотра, оценки и рецензии.</p>
        <button className="discord-button" onClick={login}>Войти через Discord</button>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <section className="diary-list">
          <h3>{selectedFilter.label}</h3>
          {entries.length === 0 ? (
            <p className="muted-copy">Пока нет записей. Выбери тайтл и сохрани первую запись.</p>
          ) : filteredEntries.length === 0 ? (
            <p className="muted-copy">В этом разделе пока нет аниме.</p>
          ) : (
            filteredEntries.map((entry) => (
              <article key={entry.id} className="diary-row">
                {entry.anime?.posterUrl ? <img src={entry.anime.posterUrl} alt="" /> : <div className="poster-fallback" />}
                <span>
                  <strong>{entry.anime?.title ?? entry.animeId}</strong>
                  <small>{watchStatusLabel(fromServerWatchStatus(entry.status))} · серия {entry.currentEpisode}</small>
                  {entry.review ? <small className="diary-review">{entry.review}</small> : null}
                </span>
                {entry.score ? <em>{entry.score}/10</em> : null}
              </article>
            ))
          )}
        </section>

      <aside className="profile-sidebar">
        <header className="profile-header">
          <div className="profile-avatar-frame">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback large">{user.displayName[0]}</div>}
            <h2>{user.displayName}</h2>
          </div>
        </header>

        <div className={`profile-sidebar-content ${sidebarMode === 'settings' ? 'slide-up' : 'slide-down'}`} key={sidebarMode}>
          {sidebarMode === 'overview' ? (
            <>
              <section className="profile-sidebar-section" aria-labelledby="profile-watch-section">
                <h3 id="profile-watch-section">Просмотр</h3>
                <div className="profile-stats" aria-label="Фильтр дневника">
                  {profileFilters.map((filter) => (
                    <button
                      key={filter.status}
                      className={filter.status === selectedStatus ? 'active' : ''}
                      type="button"
                      onClick={() => setSelectedStatus(filter.status)}
                    >
                      <img className="profile-stat-icon" src={filter.icon} alt="" aria-hidden="true" />
                      <span>{filter.label}</span>
                      <strong>{filter.count}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <section className="profile-sidebar-section profile-friends-section" aria-labelledby="profile-friends-section">
                <div className="profile-section-title">
                  <h3 id="profile-friends-section">Друзья</h3>
                  <span>{profileFriends.length}</span>
                </div>
                <div className="profile-friends-list">
                  {sortedFriends.slice(0, 5).map((friend) => (
                    <article key={friend.id} className="profile-friend-row">
                      <span className="profile-friend-avatar">{friend.name[0]}</span>
                      <span className="profile-friend-name">{friend.name}</span>
                      <span className={`profile-friend-status ${friend.status}`}>{friend.status === 'online' ? 'Онлайн' : 'Оффлайн'}</span>
                    </article>
                  ))}
                </div>
                <button className="profile-show-all" type="button">
                  Показать всех
                </button>
              </section>
            </>
          ) : (
            <>
              <section className="profile-sidebar-section" aria-labelledby="profile-edit-section">
                <h3 id="profile-edit-section">Профиль</h3>
                <div className="profile-settings-card">
                  <span>Редактирование ника и аватарки появится позже.</span>
                </div>
              </section>

              <section className="profile-sidebar-section profile-integration-section" aria-labelledby="profile-integrations-section">
                <h3 id="profile-integrations-section">Интеграции</h3>
                <ShikimoriIntegration />
              </section>
            </>
          )}
        </div>

        <div className="profile-sidebar-actions">
          <button
            className={sidebarMode === 'settings' ? 'profile-settings-toggle active' : 'profile-settings-toggle'}
            type="button"
            onClick={() => setSidebarMode((current) => (current === 'settings' ? 'overview' : 'settings'))}
            aria-label={sidebarMode === 'settings' ? 'Вернуться к профилю' : 'Настройки профиля'}
          >
            <img src={settingsIcon} alt="" aria-hidden="true" />
          </button>
          <button className="profile-logout" type="button" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>
    </section>
  );
}

function ShikimoriIntegration() {
  const {
    authStatus,
    user,
    connectShikimori,
    disconnectShikimori,
    importShikimoriList,
  } = useAuth();
  const toast = useToast();
  const canConnect = authStatus === 'ready' && Boolean(user);
  const shikimori = user?.integrations.shikimori ?? null;
  const isAuthLoading = authStatus === 'loading';
  const [disconnecting, setDisconnecting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleDisconnect() {
    if (disconnecting) return;

    setDisconnecting(true);
    try {
      await disconnectShikimori();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleImport() {
    if (importing) return;

    setImporting(true);
    toast('Импортируем список Shikimori. Не закрывай страницу.');

    try {
      const result = await importShikimoriList();
      const firstError = result.errors?.[0];
      const changed = result.imported + result.updated;

      if (changed > 0) {
        toast({ message: `Импорт завершён: ${result.imported} новых, ${result.updated} обновлено, ${result.skipped} пропущено`, variant: 'success' });
      } else {
        const reason = firstError ? ` Причина: ${firstError.reason}` : '';
        toast({ message: `Не удалось импортировать список Shikimori.${reason}`, variant: 'danger' });
      }
    } catch {
      toast({ message: 'Не удалось импортировать список Shikimori. Попробуй подключить профиль заново.', variant: 'danger' });
    } finally {
      setImporting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="connected-account settings-account-placeholder" aria-hidden="true">
        <span className="settings-placeholder-avatar" />
        <span className="settings-placeholder-copy">
          <span />
          <strong />
        </span>
      </div>
    );
  }

  if (shikimori) {
    return (
      <div className="connected-account">
        <a className="connected-account-main" href={shikimori.profileUrl} target="_blank" rel="noreferrer">
          <span className="connected-account-avatar">
            {shikimori.avatarUrl ? <img src={shikimori.avatarUrl} alt="" /> : <span className="connected-account-fallback">{shikimori.nickname[0]}</span>}
            <img className="connected-account-badge" src={shikimoriIcon} alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>{shikimori.nickname}</strong>
          </span>
        </a>
        <div className="connected-account-actions">
          <button className="settings-icon-button" type="button" onClick={handleImport} disabled={importing} data-tooltip={importing ? 'Импортируем...' : 'Импортировать список'}>
            {importing ? <span className="settings-button-loader" aria-hidden="true" /> : <img src={importIcon} alt="" aria-hidden="true" />}
          </button>
          <button className="settings-icon-button" type="button" onClick={handleDisconnect} disabled={disconnecting} data-tooltip={disconnecting ? 'Отключаем...' : 'Отвязать профиль'}>
            <img src={detachIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-integration-empty">
      <p>Подключи Shikimori, чтобы импортировать список просмотра.</p>
      <button className="settings-connect-button" type="button" onClick={connectShikimori} disabled={!canConnect}>
        {canConnect ? 'Подключить' : 'Нужен вход'}
      </button>
    </div>
  );
}
