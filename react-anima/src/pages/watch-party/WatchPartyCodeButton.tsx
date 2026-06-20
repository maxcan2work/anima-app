import CopyIcon from '@assets/copy.svg?react';
import styles from './WatchPartyCodeButton.module.css';

type WatchPartyCodeButtonProps = {
  code: string;
  onCopy: () => void;
};

export function WatchPartyCodeButton({ code, onCopy }: WatchPartyCodeButtonProps) {
  return (
    <button className={styles.button} type="button" onClick={onCopy}>
      <span>{code}</span>
      <CopyIcon aria-hidden="true" />
    </button>
  );
}
