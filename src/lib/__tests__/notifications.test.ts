// src/lib/__tests__/notifications.test.ts
import { sendRequestNotification, sendDailySummary } from '../notifications';
import nodemailer from 'nodemailer';

jest.mock('nodemailer');

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

    await sendRequestNotification(request as any);

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
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await expect(sendRequestNotification(request as any)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send request notification:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('throws if required env vars are missing', async () => {
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

    await expect(sendRequestNotification(request as any)).rejects.toThrow(
      'Missing required SMTP configuration'
    );
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

    await sendDailySummary(requests as any);

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
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    await expect(sendDailySummary([] as any)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send daily summary:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('throws if required env vars are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.APP_BASE_URL;

    await expect(sendDailySummary([] as any)).rejects.toThrow(
      'Missing required SMTP configuration'
    );
  });
});
