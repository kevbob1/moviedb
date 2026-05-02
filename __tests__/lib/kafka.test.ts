import { publishAudit } from '../../lib/kafka';
import { Kafka } from 'kafkajs';

jest.mock('kafkajs', () => {
  const sendMock = jest.fn();
  const connectMock = jest.fn();
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: () => ({
        connect: connectMock,
        send: sendMock,
        disconnect: jest.fn(),
      }),
    })),
    __sendMock: sendMock,
    __connectMock: connectMock
  };
});

describe('Kafka Producer', () => {
  const { __sendMock, __connectMock } = require('kafkajs');

  beforeEach(() => {
    __sendMock.mockClear();
    __connectMock.mockClear();
  });

  it('publishes audit event in correct format', async () => {
    const before = null;
    const after = { id: '123', title: 'Test Movie' };
    
    await publishAudit('created', '123', before, after);

    expect(__sendMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(__sendMock.mock.calls[0][0].messages[0].value);
    
    expect(payload.event).toBe('movie.created');
    expect(payload.record_id).toBe('123');
    expect(payload.before).toBeNull();
    expect(payload.after.title).toBe('Test Movie');
    expect(payload.timestamp).toBeDefined();
  });

  it('handles and logs errors without crashing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    __sendMock.mockRejectedValueOnce(new Error('Kafka down'));

    await expect(publishAudit('created', '123', null, null)).resolves.not.toThrow();
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to publish audit event to Kafka:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
