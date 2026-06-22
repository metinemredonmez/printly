-- AlterTable: Organization tenant alanları (subdomain + branding)
ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;
ALTER TABLE "Organization" ADD COLUMN "theme" JSONB;

-- CreateIndex: slug unique (subdomain)
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
