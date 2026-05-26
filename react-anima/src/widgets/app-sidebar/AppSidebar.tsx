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
import { useI18n } from '@shared/i18n/I18nProvider';
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
  const { t } = useI18n();

  return (
    <aside className={clsx(styles.libraryPanel, collapsed && styles.collapsed)} aria-label={t('sidebar.aria')}>
      <div className={styles.brandRow}>
        <div className={styles.brandCopy}>
          <p className="eyebrow">Anima</p>
        </div>
        <button
          className={styles.toggle}
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          data-tooltip={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <img src={collapsed ? sidebarExpandIcon : sidebarShrinkIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <nav className={styles.nav} aria-label={t('sidebar.sections')}>
        <SideNavButton
          active={view === 'watch'}
          icon={nekoIcon}
          title={t('sidebar.watch')}
          description={t('sidebar.watchDescription')}
          collapsed={collapsed}
          onClick={requestWatchView}
        />
        <SideNavButton
          active={view === 'random'}
          icon={randomDiceIcon}
          title={t('sidebar.random')}
          description={t('sidebar.randomDescription')}
          collapsed={collapsed}
          onClick={() => requestRoute('/random', 'random')}
        />
        <SideNavButton
          active={view === 'watchParty'}
          icon={watchPartyIcon}
          title={t('sidebar.party')}
          description={t('sidebar.partyDescription')}
          collapsed={collapsed}
          onClick={() => openWatchParty(watchPartyCode ? `/watch-party/${watchPartyCode}` : '/watch-party')}
        />
        <SideNavButton
          disabled
          icon={musicNoteIcon}
          title={t('sidebar.opening')}
          description={t('sidebar.openingDescription')}
          collapsed={collapsed}
          onClick={() => undefined}
        />
      </nav>

      <div className={styles.footer}>
        <button
          className={clsx(styles.footerAction, view === 'settings' && styles.footerActionActive)}
          type="button"
          data-tooltip={collapsed ? t('sidebar.settings') : undefined}
          onClick={() => requestRoute('/settings', 'settings')}
        >
          <span className={styles.navIcon} aria-hidden="true">
            <img src={settingsIcon} alt="" />
          </span>
          <span className={styles.navCopy}>
            <span>{t('sidebar.settings')}</span>
            <small>{t('common.soon')}</small>
          </span>
        </button>
        <AuthPanel collapsed={collapsed} onProfile={() => requestRoute('/profile', 'profile')} />
      </div>
    </aside>
  );
}

function AuthPanel({ collapsed, onProfile }: { collapsed: boolean; onProfile: () => void }) {
  const { user, authStatus, login } = useAuth();
  const { t } = useI18n();

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
          data-tooltip={collapsed ? t('sidebar.loginDiscord') : undefined}
          type="button"
        >
          <img src={discordIcon} alt="" aria-hidden="true" />
          <span>{t('sidebar.loginDiscord')}</span>
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
