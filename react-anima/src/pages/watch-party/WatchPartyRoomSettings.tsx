import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@shared/i18n/I18nProvider';
import { useConfirmModal } from '@shared/ui/ModalProvider';
import type { WatchPartyPermission, WatchPartyRoomSettings } from './types';
import styles from './WatchPartyRoomSettings.module.css';

type WatchPartyRoomSettingsProps = {
  settings: WatchPartyRoomSettings;
  participantCount: number;
  onSave: (settings: WatchPartyRoomSettings, password?: string | null) => void;
  onClose: () => void;
};

export function WatchPartyRoomSettings({ settings, participantCount, onSave, onClose }: WatchPartyRoomSettingsProps) {
  const { t } = useI18n();
  const confirm = useConfirmModal();
  const [draft, setDraft] = useState(settings);
  const [passwordEnabled, setPasswordEnabled] = useState(settings.passwordProtected);
  const [password, setPassword] = useState('');

  useEffect(() => {
    setDraft(settings);
    setPasswordEnabled(settings.passwordProtected);
    setPassword('');
  }, [settings]);

  const passwordChanged = passwordEnabled !== settings.passwordProtected || Boolean(password);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings) || passwordChanged,
    [draft, passwordChanged, settings],
  );

  function setValue<Key extends keyof WatchPartyRoomSettings>(key: Key, value: WatchPartyRoomSettings[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    if (!dirty) return;
    const next = { ...draft, passwordProtected: passwordEnabled };
    const nextPassword = passwordEnabled
      ? password || undefined
      : null;
    onSave(next, nextPassword);
  }

  async function handleClose() {
    const confirmed = await confirm({
      title: t('watchParty.closeRoomTitle'),
      content: <p>{t('watchParty.closeRoomDescription')}</p>,
      cancelLabel: t('common.cancel'),
      confirmLabel: t('watchParty.closeRoom'),
      confirmVariant: 'danger',
    });
    if (confirmed) onClose();
  }

  return (
    <section className={styles.settings}>
      <header className={styles.header}>
        <h3>{t('watchParty.roomSettings')}</h3>
        <p>{t('watchParty.roomSettingsDescription')}</p>
      </header>

      <div className={styles.scroll}>
        <SettingsSection title={t('watchParty.settingsGeneral')}>
          <label className={styles.field}>
            <span>{t('watchParty.roomName')}</span>
            <input
              value={draft.name}
              maxLength={48}
              placeholder={t('watchParty.roomNamePlaceholder')}
              onChange={(event) => setValue('name', event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>{t('watchParty.participantLimit')}</span>
            <div className={styles.limit}>
              <input
                type="range"
                min={Math.max(2, participantCount)}
                max={16}
                value={draft.maxParticipants}
                onChange={(event) => setValue('maxParticipants', Number(event.target.value))}
              />
              <strong>{draft.maxParticipants}</strong>
            </div>
          </label>

          <Segmented
            label={t('watchParty.visibility')}
            value={draft.visibility}
            options={[
              { value: 'code', label: t('watchParty.visibilityCode') },
              { value: 'public', label: t('watchParty.visibilityPublic') },
            ]}
            onChange={(value) => setValue('visibility', value as WatchPartyRoomSettings['visibility'])}
          />

          <Toggle
            checked={passwordEnabled}
            label={t('watchParty.passwordProtection')}
            onChange={setPasswordEnabled}
          />
          {passwordEnabled ? (
            <label className={styles.field}>
              <span>{settings.passwordProtected ? t('watchParty.newPassword') : t('watchParty.password')}</span>
              <input
                type="password"
                value={password}
                maxLength={128}
                placeholder={settings.passwordProtected ? t('watchParty.passwordUnchanged') : t('watchParty.passwordPlaceholder')}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : null}
        </SettingsSection>

        <SettingsSection title={t('watchParty.settingsPermissions')}>
          <PermissionControl label={t('watchParty.chooseAnimePermission')} value={draft.animeSelection} onChange={(value) => setValue('animeSelection', value)} />
          <PermissionControl label={t('watchParty.episodePermission')} value={draft.episodeControl} onChange={(value) => setValue('episodeControl', value)} />
          <PermissionControl label={t('watchParty.playbackPermission')} value={draft.playbackControl} onChange={(value) => setValue('playbackControl', value)} />
        </SettingsSection>

        <SettingsSection title={t('watchParty.settingsBehavior')}>
          <Toggle checked={draft.transferHost} label={t('watchParty.transferHost')} onChange={(value) => setValue('transferHost', value)} />
          <Toggle checked={draft.autoPlay} label={t('watchParty.autoPlay')} onChange={(value) => setValue('autoPlay', value)} />
          <Toggle checked={draft.allowJoinAfterStart} label={t('watchParty.allowJoinAfterStart')} onChange={(value) => setValue('allowJoinAfterStart', value)} />
        </SettingsSection>
      </div>

      <div className={styles.actions}>
        <button className={styles.close} type="button" onClick={handleClose}>{t('watchParty.closeRoom')}</button>
        <button className={styles.save} type="button" disabled={!dirty} onClick={handleSave}>{t('common.save')}</button>
      </div>
    </section>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4>{title}</h4>
      <div className={styles.sectionContent}>{children}</div>
    </section>
  );
}

function PermissionControl({ label, value, onChange }: { label: string; value: WatchPartyPermission; onChange: (value: WatchPartyPermission) => void }) {
  const { t } = useI18n();
  return (
    <Segmented
      label={label}
      value={value}
      options={[
        { value: 'host', label: t('watchParty.onlyHost') },
        { value: 'everyone', label: t('watchParty.everyone') },
      ]}
      onChange={(next) => onChange(next as WatchPartyPermission)}
    />
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className={styles.control}>
      <span>{label}</span>
      <div className={styles.segmented}>
        {options.map((option) => (
          <button
            className={value === option.value ? styles.selected : undefined}
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button className={styles.toggleRow} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className={styles.toggle} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
