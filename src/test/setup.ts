import { config } from 'dotenv';
config({ path: '.env.test' });

global.fetch = jest.fn();

jest.mock('../lib/prisma', () => ({
  prisma: {
    movie: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));
