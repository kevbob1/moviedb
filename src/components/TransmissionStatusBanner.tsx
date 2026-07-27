import { Surface } from '@/components/ui/Surface';

export interface TransmissionSyncInfo {
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface TransmissionStatusBannerProps {
  state: 'ok' | 'unreachable' | 'not_configured';
  error?: string | null;
  torrentCount: number | null;
  lastSync: TransmissionSyncInfo | null;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATE_STYLES: Record<TransmissionStatusBannerProps['state'], { border: string; label: string }> = {
  ok: { border: 'border-emerald-500/30', label: 'text-emerald-300' },
  unreachable: { border: 'border-rose-500/30', label: 'text-rose-300' },
  not_configured: { border: 'border-border-subtle', label: 'text-muted-foreground' },
};

export function TransmissionStatusBanner({ state, error, torrentCount, lastSync }: TransmissionStatusBannerProps) {
  const styles = STATE_STYLES[state];

  return (
    <Surface elevation="raised" className={`mb-6 border p-3 sm:p-4 ${styles.border}`}>
      <div className="flex flex-col gap-1 text-sm">
        <p className={`font-medium ${styles.label}`}>
          {state === 'ok' && (
            <>Transmission connected{torrentCount !== null && <> · {torrentCount} torrent{torrentCount === 1 ? '' : 's'} observed</>}</>
          )}
          {state === 'unreachable' && <>Transmission problem: {error ?? 'unreachable'}</>}
          {state === 'not_configured' && <>Transmission is not configured — set TRANSMISSION_URL and credentials to observe torrents.</>}
        </p>
        {state === 'unreachable' && (
          <p className="text-xs text-muted-foreground">
            Torrent list unavailable — matching and download progress sync are not working.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {lastSync ? (
            <>
              Last sync {timeAgo(lastSync.completedAt ?? lastSync.createdAt)} · {lastSync.status}
              {lastSync.error && <span className="text-rose-300"> — {lastSync.error.split('\n')[0]}</span>}
            </>
          ) : (
            <>No sync job has run yet — downloading requests will not auto-fulfill.</>
          )}
        </p>
      </div>
    </Surface>
  );
}
