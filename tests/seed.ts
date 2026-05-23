import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg(url);
const prisma = new PrismaClient({ adapter });

async function seed() {
  await prisma.movie.create({
    data: {
      tmdb_id: 603,
      title: "The Matrix",
      description: "A computer hacker learns about the true nature of his reality.",
      release_date: 1999,
      vote_average: 8.7,
      genres: "Action, Sci-Fi",
    },
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });