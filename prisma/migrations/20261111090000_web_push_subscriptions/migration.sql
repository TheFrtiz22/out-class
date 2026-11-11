-- Web Push (S1-8): browser push subscriptions and a per-(notification, subscription)
-- delivery ledger. Additive only: no existing table, trigger, grant or row changes.
-- Both tables are server-only, like the notification email outbox: RLS on, no
-- browser-role access, and only the bounded runtime role with explicit policies
-- (same posture as 20261109150000_applicant_recusal, plus DELETE for unsubscribe
-- and for push-service 404/410 cleanup).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "WebPushSubscription" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "endpoint" TEXT NOT NULL,
 "p256dh" TEXT NOT NULL,
 "auth" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSuccessAt" TIMESTAMP(3),
 "failureCount" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "WebPushSubscription_endpoint_https" CHECK ("endpoint" LIKE 'https://%' AND length("endpoint") <= 2048),
 CONSTRAINT "WebPushSubscription_keys_bounded" CHECK (length("p256dh") BETWEEN 1 AND 200 AND length("auth") BETWEEN 1 AND 100),
 CONSTRAINT "WebPushSubscription_failure_count" CHECK ("failureCount" >= 0)
);
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX "WebPushSubscription_userId_createdAt_idx" ON "WebPushSubscription"("userId", "createdAt");
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebPushDelivery" (
 "notificationId" TEXT NOT NULL,
 "subscriptionId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "attemptedAt" TIMESTAMP(3),
 CONSTRAINT "WebPushDelivery_pkey" PRIMARY KEY ("notificationId", "subscriptionId"),
 CONSTRAINT "WebPushDelivery_status" CHECK ("status" IN ('PENDING','SENDING','SENT','FAILED','SKIPPED'))
);
CREATE INDEX "WebPushDelivery_status_createdAt_idx" ON "WebPushDelivery"("status", "createdAt");
CREATE INDEX "WebPushDelivery_subscriptionId_idx" ON "WebPushDelivery"("subscriptionId");
ALTER TABLE "WebPushDelivery" ADD CONSTRAINT "WebPushDelivery_notificationId_fkey"
 FOREIGN KEY ("notificationId") REFERENCES "UserNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebPushDelivery" ADD CONSTRAINT "WebPushDelivery_subscriptionId_fkey"
 FOREIGN KEY ("subscriptionId") REFERENCES "WebPushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebPushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebPushDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "WebPushSubscription","WebPushDelivery" FROM PUBLIC;
DO $runtime$
DECLARE r text; t text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
  EXECUTE format('REVOKE ALL ON "WebPushSubscription","WebPushDelivery" FROM %I',r);
 END IF; END LOOP;
 -- Only the existing bounded server role, with explicit row policies (see 20261103200000).
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  FOREACH t IN ARRAY ARRAY['WebPushSubscription','WebPushDelivery'] LOOP
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO outclass_production_app',t);
   EXECUTE format('CREATE POLICY web_push_runtime_read ON %I FOR SELECT TO outclass_production_app USING (true)',t);
   EXECUTE format('CREATE POLICY web_push_runtime_insert ON %I FOR INSERT TO outclass_production_app WITH CHECK (true)',t);
   EXECUTE format('CREATE POLICY web_push_runtime_update ON %I FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (true)',t);
   EXECUTE format('CREATE POLICY web_push_runtime_delete ON %I FOR DELETE TO outclass_production_app USING (true)',t);
  END LOOP;
 END IF;
END $runtime$;
COMMIT;
