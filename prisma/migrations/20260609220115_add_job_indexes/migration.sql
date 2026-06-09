-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_status_created_at_idx" ON "jobs"("status", "created_at");
