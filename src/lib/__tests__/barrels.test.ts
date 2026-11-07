type EnvSnapshot = Record<string, string | undefined>;

function clearEnv(names: string[]): () => void {
  const snapshot: EnvSnapshot = {};
  for (const name of names) {
    snapshot[name] = process.env[name];
    delete process.env[name];
  }
  return () => {
    for (const [name, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

describe('module barrels', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('jellyfin barrel binds every catalog verb to one default adapter', async () => {
    const restore = clearEnv(['JELLYFIN_URL', 'JELLYFIN_API_KEY']);
    jest.resetModules();
    const jellyfin = await import('@/lib/jellyfin');

    try {
      await expect(jellyfin.isOnJellyfin(1)).resolves.toMatchObject({ configured: false });
      await expect(jellyfin.seasonsFor(1)).resolves.toMatchObject({ configured: false });
      await expect(jellyfin.availabilityFor([1])).resolves.toMatchObject({
        1: expect.objectContaining({ configured: false }),
      });
      await expect(jellyfin.seasonsForMany([1])).resolves.toMatchObject({
        1: expect.objectContaining({ configured: false }),
      });
      await expect(jellyfin.ping()).resolves.toEqual({
        configured: false,
        reachable: false,
        error: 'Jellyfin not configured',
      });
    } finally {
      restore();
    }
  });

  it('transmission barrel degrades to an empty catalog and an unconfigured ping', async () => {
    const restore = clearEnv([
      'TRANSMISSION_URL',
      'TRANSMISSION_USERNAME',
      'TRANSMISSION_PASSWORD',
    ]);
    jest.resetModules();
    const transmission = await import('@/lib/transmission');

    try {
      await expect(transmission.getAll()).resolves.toEqual([]);
      await expect(transmission.ping()).resolves.toEqual({
        configured: false,
        reachable: false,
      });
      expect(transmission.transmissionAdapter).toBeDefined();
      expect(transmission.transmissionCatalog).toBeDefined();
    } finally {
      restore();
    }
  });

  it('notifications barrel sends through the default mailer without throwing when unconfigured', async () => {
    const restore = clearEnv([
      'SMTP_USER',
      'SMTP_PASS',
      'NOTIFICATION_EMAIL',
      'APP_BASE_URL',
    ]);
    jest.resetModules();
    const notifications = await import('@/lib/notifications');

    try {
      await expect(
        notifications.sendRequest({
          id: 1,
          title: 'Movie',
          requested_by: 'kev',
          status: 'pending',
          requested_at: new Date('2026-01-01T00:00:00Z'),
        }),
      ).resolves.toBeUndefined();
      await expect(
        notifications.sendTvSeries({
          title: 'Show',
          requestedBy: 'kev',
          seasons: [1],
          totalSeasons: 1,
          posterPath: null,
          releaseDate: null,
        }),
      ).resolves.toBeUndefined();
      await expect(notifications.sendDailySummary([])).resolves.toBeUndefined();
    } finally {
      restore();
    }
  });

  it('jobs barrel registers every job type at its single registration site', async () => {
    jest.resetModules();
    const jobs = await import('@/lib/jobs');

    expect(() => jobs.registerAllJobTypes()).not.toThrow();
  });
});
