import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'moviedb',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const globalForKafka = globalThis as unknown as {
  producer: Producer | undefined;
};

export const producer = globalForKafka.producer ?? kafka.producer();

if (process.env.NODE_ENV !== 'production') {
  globalForKafka.producer = producer;
}

let isConnected = false;

export async function publishAudit(
  action: 'created' | 'updated' | 'deleted',
  recordId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<void> {
  try {
    if (!isConnected) {
      await producer.connect();
      isConnected = true;
    }
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
  }
  // No longer disconnecting here
}
