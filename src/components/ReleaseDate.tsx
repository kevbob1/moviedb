interface ReleaseDateProps {
  date: string;
  mediaType?: string;
}

export function ReleaseDate({ date, mediaType }: ReleaseDateProps) {
  if (!date || mediaType === 'tv') return null;

  return <span className="ml-1 text-sm font-normal text-muted-foreground">({date.split('-')[0]})</span>;
}
