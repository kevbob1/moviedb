import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'moviedb',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();

export async function publishAudit(
  action: 'created' | 'updated' | 'deleted',
  recordId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<void> {
  try {
    await producer.connect();
    await producer.send({
      topic: 'movie.audit',
      messages: [{
        value: JSON.stringify({
          event: `movie.${action}`,
          record_id: recordId,
          before,
          after,
          timestamp: new Date().toISOString()
        })
      }]
    });
  } catch (error) {
    console.error('Failed to publish audit event to Kafka:', error);
  } finally {
    await producer.disconnect();
  }
}
