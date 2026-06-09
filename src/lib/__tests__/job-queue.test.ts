import { registerJobType, processJob, processPendingJobs } from '../job-queue';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('job-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerJobType and processJob', () => {
    it('invokes the registered handler for a job type', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('test_type', { handle: handler });

      const job = {
        id: 1,
        type: 'test_type',
        payload: { message: 'hello' },
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await processJob(job as any);

      expect(handler).toHaveBeenCalledWith({ message: 'hello' });
    });

    it('throws if no handler is registered for job type', async () => {
      const job = {
        id: 99,
        type: 'unknown_type',
        payload: {},
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(processJob(job as any)).rejects.toThrow('No handler for job type: unknown_type');
    });
  });

  describe('processPendingJobs', () => {
    it('claims pending jobs and processes them', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('claim_test', { handle: handler });

      const jobs = [
        { id: 1, type: 'claim_test', payload: { a: 1 }, status: 'pending', attempts: 0, maxAttempts: 3, error: null, created_at: new Date(), updated_at: new Date(), completed_at: null },
      ];

      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const result = await processPendingJobs();

      expect(handler).toHaveBeenCalledWith({ a: 1 });
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'completed', completed_at: expect.any(Date) },
      });
      expect(result.processed).toBe(1);
    });

    it('resets stuck processing jobs older than 5 minutes', async () => {
      (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await processPendingJobs();

      expect(prisma.job.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'processing',
            updated_at: expect.any(Object),
          }),
          data: { status: 'pending' },
        })
      );
    });

    it('marks a job as failed after max attempts', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('SMTP down'));

      registerJobType('fail_test', { handle: handler });

      const jobs = [
        { id: 2, type: 'fail_test', payload: {}, status: 'processing', attempts: 2, maxAttempts: 3, error: null, created_at: new Date(), updated_at: new Date(), completed_at: null },
      ];

      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const result = await processPendingJobs();

      expect(handler).toHaveBeenCalled();
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { status: 'failed', error: 'SMTP down' },
      });
      expect(result.failed).toBe(1);
    });

    it('resets to pending on failure when attempts remain', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('transient'));

      registerJobType('retry_test', { handle: handler });

      const jobs = [
        { id: 3, type: 'retry_test', payload: {}, status: 'processing', attempts: 1, maxAttempts: 3, error: null, created_at: new Date(), updated_at: new Date(), completed_at: null },
      ];

      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const result = await processPendingJobs();

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { status: 'pending', error: 'transient' },
      });
      expect(result.failed).toBe(0);
    });
  });
});
