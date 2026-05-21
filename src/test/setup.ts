import { config } from 'dotenv';
config({ path: '.env.test' });

jest.mock('../lib/prisma', () => ({
  prisma: {
    movie: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));
