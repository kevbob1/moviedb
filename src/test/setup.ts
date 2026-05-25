import { config } from 'dotenv';
config({ path: '.env.test' });

import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'node:stream/web';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
global.ReadableStream = ReadableStream as typeof globalThis.ReadableStream;
global.Request = globalThis.Request;
global.Response = globalThis.Response;
global.Headers = globalThis.Headers;

global.fetch = jest.fn();

const mockResponseJson = jest.fn((body, init) => ({
  ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
  status: init?.status ?? 200,
  json: async () => body,
  headers: new Map(Object.entries(init?.headers ?? {})),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: mockResponseJson,
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    movie: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));
