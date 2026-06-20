import clsx from 'clsx';
import styles from './ProfileStatusCard.module.css';

type ProfileStatusCardProps = {
  icon: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

export function ProfileStatusCard({ icon, label, count, active, onClick }: ProfileStatusCardProps) {
  return (
    <button className={clsx(styles.card, active && styles.active)} type="button" onClick={onClick} aria-pressed={active}>
      <img src={icon} alt="" aria-hidden="true" />
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}
