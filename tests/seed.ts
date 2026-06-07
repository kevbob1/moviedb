import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "../src/lib/logger";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg(url);
const prisma = new PrismaClient({ adapter });

async function seed() {
  await prisma.request.create({
    data: {
      tmdb_id: 603,
      title: "The Matrix",
      requested_by: "system",
    },
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    logger.error({ error: e instanceof Error ? e.message : String(e) }, "Seed failed");
    prisma.$disconnect();
    process.exit(1);
  });