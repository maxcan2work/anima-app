import clsx from 'clsx';
import discordIcon from '@assets/discord.svg';
import musicNoteIcon from '@assets/music-note.svg';
import nekoIcon from '@assets/neko.svg';
import randomDiceIcon from '@assets/random-dice.svg';
import sidebarExpandIcon from '@assets/sidebar-expand.svg';
import sidebarShrinkIcon from '@assets/sidebar-shrink.svg';
import settingsIcon from '@assets/settings.svg';
import watchPartyIcon from '@assets/watch-party.svg';
import { useAuth } from '@features/auth/AuthProvider';
import { useNavigation } from '@features/navigation/NavigationProvider';
import styles from './AppSidebar.module.css';

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {
  const {
    view,
    watchPartyCode,
    requestWatchView,
    requestRoute,
    openWatchParty,
  } = useNavigation();

  return (
    <aside className={styles.libraryPanel} aria-label="Каталог аниме">
      <div className={styles.brandRow}>
        <div className={styles.brandCopy}>
          <p className="eyebrow">Anima</p>
        </div>
        <button
          className={styles.toggle}
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
          data-tooltip={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          <img src={collapsed ? sidebarExpandIcon : sidebarShrinkIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <nav className={styles.nav} aria-label="Разделы">
        <SideNavButton
          active={view === 'watch'}
          icon={nekoIcon}
          title="Просмотр"
          description="Список аниме"
          collapsed={collapsed}
          onClick={requestWatchView}
        />
        <SideNavButton
          active={view === 'random'}
          icon={randomDiceIcon}
          title="Случайное аниме"
          description="Подборка наугад"
          collapsed={collapsed}
          onClick={() => requestRoute('/random', 'random')}
        />
        <SideNavButton
          active={view === 'watchParty'}
          icon={watchPartyIcon}
          title="Совместный просмотр"
          description="Комнаты и коды"
          collapsed={collapsed}
          onClick={() => openWatchParty(watchPartyCode ? `/watch-party/${watchPartyCode}` : '/watch-party')}
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

      <div className={styles.footer}>
        <button
          className={clsx(styles.footerAction, view === 'settings' && styles.footerActionActive)}
          type="button"
          data-tooltip={collapsed ? 'Настройки' : undefined}
          onClick={() => requestRoute('/settings', 'settings')}
        >
          <span className={styles.navIcon} aria-hidden="true">
            <img src={settingsIcon} alt="" />
          </span>
          <span className={styles.navCopy}>
            <span>Настройки</span>
            <small>Скоро</small>
          </span>
        </button>
        <AuthPanel collapsed={collapsed} onProfile={() => requestRoute('/profile', 'profile')} />
      </div>
    </aside>
  );
}

function AuthPanel({ collapsed, onProfile }: { collapsed: boolean; onProfile: () => void }) {
  const { user, authStatus, login } = useAuth();

  if (authStatus === 'loading') {
    return (
      <div
        className={
          collapsed
            ? clsx(styles.authPanel, styles.authPlaceholder, styles.collapsedAuth)
            : clsx(styles.authPanel, styles.authPlaceholder)
        }
        aria-hidden="true"
      >
        <span className={styles.placeholderAvatar} />
        {collapsed ? null : <span className={styles.placeholderCopy} />}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.authPanel}>
        <button
          className={styles.discordButton}
          onClick={login}
          data-tooltip={collapsed ? 'Войти через Discord' : undefined}
          type="button"
        >
          <img src={discordIcon} alt="" aria-hidden="true" />
          <span>Войти через Discord</span>
        </button>
      </div>
    );
  }

  return (
    <div className={clsx(styles.authPanel, styles.authPanelSignedIn)}>
      <button className={styles.profileLink} onClick={onProfile} data-tooltip={user.displayName}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className={styles.avatarFallback}>{user.displayName[0]}</div>}
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
      className={clsx(styles.navButton, active && styles.navButtonActive)}
      disabled={disabled}
      onClick={onClick}
      type="button"
      aria-label={title}
      data-tooltip={collapsed ? title : undefined}
    >
      <span className={styles.navIcon} aria-hidden="true">
        <img src={icon} alt="" />
      </span>
      <span className={styles.navCopy}>
        <span>{title}</span>
        <small>{description}</small>
      </span>
    </button>
  );
}
