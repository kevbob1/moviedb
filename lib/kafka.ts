import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'moviedb',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'scram-sha-512',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD as string,
  } : undefined,
});

const producer = kafka.producer();

export async function publishAudit(action: string, recordId: string, before: any, after: any) {
  await producer.connect();
  await producer.send({
    topic: 'moviedb.audit',
    messages: [{
      value: JSON.stringify({
        event: `movie.${action}`,
        record_id: recordId,
        timestamp: new Date().toISOString(),
        before,
        after,
      }),
    }],
  });
  await producer.disconnect();
}
