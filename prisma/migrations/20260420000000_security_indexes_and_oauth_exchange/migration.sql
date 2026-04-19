-- Security hardening migration
-- 1. Indexes on User for soft-delete + password-reset lookups
-- 2. Composite index on Post(flagStatus, createdAt) for admin/public feed queries
-- 3. OAuthExchangeCode table for short-lived Google OAuth code exchange flow
--    (replaces the insecure JWT-in-URL redirect pattern)

-- User indexes
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");

-- Post composite index (admin moderation + public feed both filter by flagStatus then sort by createdAt)
CREATE INDEX "Post_flagStatus_createdAt_idx" ON "Post"("flagStatus", "createdAt");

-- OAuth exchange-code table
CREATE TABLE "OAuthExchangeCode" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthExchangeCode_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "OAuthExchangeCode_expiresAt_idx" ON "OAuthExchangeCode"("expiresAt");
