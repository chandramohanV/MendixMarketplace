import type { SubmissionStatus, SupportLevel } from '../types';
import { Icon } from './icons';

/** Support level badge; Community is hidden in the short form (cards), shown in the long form. */
export function SupportBadge({ support, long = false }: { support: SupportLevel; long?: boolean }) {
  if (support === 'Community' && !long) return null;
  return (
    <span className={`badge badge-${support.toLowerCase()}`}>
      {support === 'Partner' && <Icon name="partner" size={10} />}
      {long ? `${support} supported` : support}
    </span>
  );
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: 'Pending review',
  published: 'Published',
  rejected: 'Rejected',
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`badge badge-status-${status}`}>{STATUS_LABEL[status]}</span>;
}
