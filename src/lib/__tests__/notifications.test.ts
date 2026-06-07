// src/lib/__tests__/notifications.test.ts
import { sendRequestNotification, sendDailySummary, NotificationRequest } from '../notifications';
import { logger } from '../logger';
import nodemailer from 'nodemailer';

jest.mock('nodemailer');
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedCreateTransport = nodemailer.createTransport as jest.Mock;

const mockSendMail = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateTransport.mockReturnValue(mockTransporter);
  mockSendMail.mockResolvedValue({ messageId: 'test-id' });
  process.env.SMTP_HOST = 'smtp.gmail.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test@gmail.com';
  process.env.SMTP_PASS = 'testpass';
  process.env.NOTIFICATION_EMAIL = 'admin@example.com';
  process.env.APP_BASE_URL = 'https://example.com';
});

afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.NOTIFICATION_EMAIL;
  delete process.env.APP_BASE_URL;
});

describe('sendRequestNotification', () => {
  it('sends an email with request details', async () => {
    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await sendRequestNotification(request as NotificationRequest);

    expect(mockedCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@gmail.com',
        pass: 'testpass',
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'test@gmail.com',
      to: 'admin@example.com',
      subject: 'New Request: Inception',
      text: 'Someone requested "Inception" on Jellyfin Request Tracker.',
    });
  });

  it('logs error but does not throw if email fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await expect(sendRequestNotification(request as NotificationRequest)).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'SMTP error' },
      'Failed to send request notification'
    );
  });

  it('returns gracefully if required env vars are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;

    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await expect(sendRequestNotification(request as NotificationRequest)).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith('Skipping request notification: SMTP not configured');
  });
});

describe('sendDailySummary', () => {
  it('sends an email with all active requests', async () => {
    const requests = [
      {
        id: 1,
        title: 'Inception',
        requested_by: 'Alice',
        status: 'pending',
        requested_at: new Date('2026-06-06T10:00:00Z'),
      },
      {
        id: 2,
        title: 'The Matrix',
        requested_by: 'Bob',
        status: 'downloading',
        requested_at: new Date('2026-06-05T10:00:00Z'),
      },
    ];

    await sendDailySummary(requests as NotificationRequest[]);

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'test@gmail.com',
      to: 'admin@example.com',
      subject: 'Daily Summary: 2 active requests',
      text: expect.stringContaining('Inception'),
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://example.com/requests'),
      })
    );
  });

  it('logs error but does not throw if email fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    await expect(sendDailySummary([] as NotificationRequest[])).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'SMTP error' },
      'Failed to send daily summary'
    );
  });

  it('returns gracefully if SMTP env vars are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;

    await expect(sendDailySummary([] as NotificationRequest[])).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith('Skipping daily summary: SMTP not configured');
  });

  it('returns gracefully if APP_BASE_URL is missing', async () => {
    delete process.env.APP_BASE_URL;

    await expect(sendDailySummary([] as NotificationRequest[])).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith('Skipping daily summary: APP_BASE_URL not configured');
  });
});
