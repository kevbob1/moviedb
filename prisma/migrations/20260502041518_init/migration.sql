-- CreateTable
CREATE TABLE "movies" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "release_date" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "tmdb_id" INTEGER,
    "poster_path" VARCHAR(255),
    "vote_average" DECIMAL(3,1),
    "genres" VARCHAR(255),
    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movies_tmdb_id_key" ON "movies"("tmdb_id");