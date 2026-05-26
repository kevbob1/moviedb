interface Props {
  available: boolean;
}

export function JellyfinBadge({ available }: Props) {
  if (!available) {
    return null;
  }

  return (
    <span className="badge-success">
      On Jellyfin
    </span>
  );
}