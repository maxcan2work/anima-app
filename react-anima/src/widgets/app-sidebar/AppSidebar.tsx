import type { CurrentUser } from '../../api';
import discordIcon from '../../assets/discord.svg';
import musicNoteIcon from '../../assets/music-note.svg';
import nekoIcon from '../../assets/neko.svg';
import randomDiceIcon from '../../assets/random-dice.svg';
import sidebarExpandIcon from '../../assets/sidebar-expand.svg';
import sidebarShrinkIcon from '../../assets/sidebar-shrink.svg';
import settingsIcon from '../../assets/settings.svg';
import watchPartyIcon from '../../assets/watch-party.svg';

type AppSidebarView = 'watch' | 'profile' | 'random' | 'settings' | 'watchParty';

type AppSidebarProps = {
  view: AppSidebarView;
  collapsed: boolean;
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  onToggleCollapsed: () => void;
  onOpenWatch: () => void;
  onOpenRandom: () => void;
  onOpenWatchParty: () => void;
  onOpenSettings: () => void;
  onLogin: () => void;
  onOpenProfile: () => void;
};

export function AppSidebar({
  view,
  collapsed,
  user,
  authStatus,
  onToggleCollapsed,
  onOpenWatch,
  onOpenRandom,
  onOpenWatchParty,
  onOpenSettings,
  onLogin,
  onOpenProfile,
}: AppSidebarProps) {
  return (
    <aside className="library-panel" aria-label="Каталог аниме">
      <div className="brand-row">
        <div>
          <p className="eyebrow">Anima</p>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
          data-tooltip={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          <img src={collapsed ? sidebarExpandIcon : sidebarShrinkIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <nav className="side-nav" aria-label="Разделы">
        <SideNavButton
          active={view === 'watch'}
          icon={nekoIcon}
          title="Просмотр"
          description="Список аниме"
          collapsed={collapsed}
          onClick={onOpenWatch}
        />
        <SideNavButton
          active={view === 'random'}
          icon={randomDiceIcon}
          title="Случайное аниме"
          description="Подборка наугад"
          collapsed={collapsed}
          onClick={onOpenRandom}
        />
        <SideNavButton
          active={view === 'watchParty'}
          icon={watchPartyIcon}
          title="Совместный просмотр"
          description="Комнаты и коды"
          collapsed={collapsed}
          onClick={onOpenWatchParty}
        />
        <SideNavButton
          disabled
          icon={musicNoteIcon}
          title="Угадай опенинг"
          description="Скоро"
          collapsed={collapsed}
          onClick={() => undefined}
        />
      </nav>

      <div className="sidebar-footer">
        <button
          className={view === 'settings' ? 'sidebar-action active' : 'sidebar-action'}
          type="button"
          data-tooltip={collapsed ? 'Настройки' : undefined}
          onClick={onOpenSettings}
        >
          <span className="nav-icon" aria-hidden="true">
            <img src={settingsIcon} alt="" />
          </span>
          <span className="nav-copy">
            <span>Настройки</span>
            <small>Скоро</small>
          </span>
        </button>
        <AuthPanel
          user={user}
          authStatus={authStatus}
          collapsed={collapsed}
          onLogin={onLogin}
          onProfile={onOpenProfile}
        />
      </div>
    </aside>
  );
}

function AuthPanel({
  user,
  authStatus,
  collapsed,
  onLogin,
  onProfile,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  collapsed: boolean;
  onLogin: () => void;
  onProfile: () => void;
}) {
  if (authStatus === 'loading') {
    return (
      <div className={collapsed ? 'auth-panel auth-placeholder collapsed-auth' : 'auth-panel auth-placeholder'} aria-hidden="true">
        <span className="auth-placeholder-avatar" />
        {collapsed ? null : <span className="auth-placeholder-copy" />}
      </div>
    );
  }

  if (!user) {
    if (collapsed) {
      return (
        <div className="auth-panel collapsed-auth">
          <button className="auth-icon-button" onClick={onLogin} data-tooltip="Войти через Discord" type="button">
            <img src={discordIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      );
    }

    return (
      <div className="auth-panel">
        <button className="discord-button" onClick={onLogin}>
          <img src={discordIcon} alt="" aria-hidden="true" />
          <span>Войти через Discord</span>
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel signed-in">
      <button className="profile-link" onClick={onProfile} data-tooltip={user.displayName}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback">{user.displayName[0]}</div>}
        <span>
          <strong>{user.displayName}</strong>
        </span>
      </button>
    </div>
  );
}

function SideNavButton({
  active,
  disabled,
  icon,
  title,
  description,
  collapsed,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: string;
  title: string;
  description: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'active' : ''}
      disabled={disabled}
      onClick={onClick}
      type="button"
      aria-label={title}
      data-tooltip={collapsed ? title : undefined}
    >
      <span className="nav-icon" aria-hidden="true">
        <img src={icon} alt="" />
      </span>
      <span className="nav-copy">
        <span>{title}</span>
        <small>{description}</small>
      </span>
    </button>
  );
}
