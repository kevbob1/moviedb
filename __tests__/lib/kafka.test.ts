import { publishAudit } from '../../lib/kafka';
import { Kafka } from 'kafkajs';

jest.mock('kafkajs', () => {
  const sendMock = jest.fn();
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: () => ({
        connect: jest.fn(),
        send: sendMock,
        disconnect: jest.fn(),
      }),
    })),
    __sendMock: sendMock
  };
});

describe('Kafka Producer', () => {
  it('publishes audit event in correct format', async () => {
    const { __sendMock } = require('kafkajs');
    __sendMock.mockClear();

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
});
