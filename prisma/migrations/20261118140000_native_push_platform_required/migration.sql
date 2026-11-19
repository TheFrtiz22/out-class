-- Correction to 20261118130000_native_push_subscriptions: its endpoint CHECK let a native ('EXPO')
-- row through with a NULL platform, because `NULL IN (...)` is unknown and a CHECK passes on unknown.
-- A native row must name its platform (it decides which web push the device no longer needs).
-- Same constraint, with the NULL case closed. No row can violate it: the only writer
-- (actions/push-subscriptions.ts saveNativePushDevice) always sets the platform.
-- Rollback: restore the constraint text from 20261118130000.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "WebPushSubscription" DROP CONSTRAINT "WebPushSubscription_endpoint_shape";
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_endpoint_shape" CHECK (
 ("kind" = 'WEB' AND "endpoint" LIKE 'https://%' AND length("endpoint") <= 2048)
 OR ("kind" = 'EXPO' AND "endpoint" ~ '^expo:Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$' AND "platform" IS NOT NULL AND "platform" IN ('IOS','ANDROID'))
);
COMMIT;
