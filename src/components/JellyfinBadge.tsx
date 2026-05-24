interface Props {
  available: boolean;
}

export function JellyfinBadge({ available }: Props) {
  if (!available) {
    return null;
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      On Jellyfin
    </span>
  );
}