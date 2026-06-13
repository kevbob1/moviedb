import { SmtpMailer, InMemoryMailer } from '../mailer';
import { logger } from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('nodemailer', () => {
  const sendMail = jest.fn();
  return {
    createTransport: jest.fn(() => ({ sendMail })),
    __sendMail: sendMail,
  };
});

const { createTransport: mockedCreateTransport, __sendMail: mockedSendMail } = jest.requireMock('nodemailer') as {
  createTransport: jest.Mock;
  __sendMail: jest.Mock;
};

describe('SmtpMailer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@gmail.com';
    process.env.SMTP_PASS = 'secret';
    process.env.NOTIFICATION_EMAIL = 'admin@example.com';
    process.env.APP_BASE_URL = 'https://example.com';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isConfigured', () => {
    it('returns { ok: false, reason: "smtp" } when SMTP_USER missing', () => {
      delete process.env.SMTP_USER;
      const m = new SmtpMailer();
      expect(m.isConfigured()).toEqual({ ok: false, reason: 'smtp' });
    });

    it('returns { ok: false, reason: "smtp" } when SMTP_PASS missing', () => {
      delete process.env.SMTP_PASS;
      const m = new SmtpMailer();
      expect(m.isConfigured()).toEqual({ ok: false, reason: 'smtp' });
    });

    it('returns { ok: false, reason: "smtp" } when NOTIFICATION_EMAIL missing', () => {
      delete process.env.NOTIFICATION_EMAIL;
      const m = new SmtpMailer();
      expect(m.isConfigured()).toEqual({ ok: false, reason: 'smtp' });
    });

    it('returns { ok: false, reason: "app_base_url" } when APP_BASE_URL missing', () => {
      delete process.env.APP_BASE_URL;
      const m = new SmtpMailer();
      expect(m.isConfigured()).toEqual({ ok: false, reason: 'app_base_url' });
    });

    it('returns { ok: true } when all set', () => {
      const m = new SmtpMailer();
      expect(m.isConfigured()).toEqual({ ok: true });
    });
  });

  describe('send', () => {
    it('calls nodemailer with the right transport config and sendMail payload', async () => {
      mockedSendMail.mockResolvedValueOnce({ messageId: 'm1' });
      const m = new SmtpMailer();
      await m.send({
        to: 'admin@example.com',
        from: 'user@gmail.com',
        message: { subject: 's', text: 't', html: '<p>h</p>' },
      });

      expect(mockedCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: 'user@gmail.com', pass: 'secret' },
      });
      expect(mockedSendMail).toHaveBeenCalledWith({
        from: 'user@gmail.com',
        to: 'admin@example.com',
        subject: 's',
        text: 't',
        html: '<p>h</p>',
      });
    });

    it('propagates SMTP errors (does not catch)', async () => {
      mockedSendMail.mockRejectedValueOnce(new Error('SMTP error'));
      const m = new SmtpMailer();
      await expect(
        m.send({ to: 'a', from: 'b', message: { subject: 's', text: 't', html: '' } })
      ).rejects.toThrow('SMTP error');
    });
  });
});

describe('InMemoryMailer', () => {
  it('records sent messages', async () => {
    const m = new InMemoryMailer();
    await m.send({ to: 'a', from: 'b', message: { subject: 's', text: 't', html: 'h' } });
    expect(m.sent).toEqual([
      { to: 'a', from: 'b', message: { subject: 's', text: 't', html: 'h' } },
    ]);
  });

  it('returns { ok: true } from isConfigured by default', () => {
    const m = new InMemoryMailer();
    expect(m.isConfigured()).toEqual({ ok: true });
  });

  it('honors configured override', () => {
    const m = new InMemoryMailer({ ok: false, reason: 'smtp' });
    expect(m.isConfigured()).toEqual({ ok: false, reason: 'smtp' });
  });

  it('does not call logger', async () => {
    const m = new InMemoryMailer();
    await m.send({ to: 'a', from: 'b', message: { subject: 's', text: 't', html: '' } });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
