-- Drop Movies Table
DROP TABLE IF EXISTS "movies";

-- CreateRequests
CREATE TABLE "requests" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "tmdb_id" INTEGER,
    "poster_path" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "media_type" TEXT NOT NULL DEFAULT 'movie',

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requests_tmdb_id_key" ON "requests"("tmdb_id");
