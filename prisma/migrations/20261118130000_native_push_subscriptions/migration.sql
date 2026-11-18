-- Native push (iOS/Android app) as another channel of the existing push path (S1-8).
-- A native device is one more row in "WebPushSubscription", so the per-(notification,
-- subscription) ledger "WebPushDelivery", the preference checks and the at-most-once claim in
-- utils/notification-push.ts apply to it unchanged.
--   kind      'WEB' (browser Web Push, every existing row) or 'EXPO' (a native device's Expo push token)
--   platform  where the subscription lives: 'IOS', 'ANDROID' or 'OTHER'; NULL for rows saved before this
--             migration. A phone that has the native app does not also get the web push for one event.
-- For 'EXPO' rows "endpoint" holds 'expo:' + the token (still the unique device key) and the Web Push
-- key columns hold '-'. The two CHECK constraints are replaced by ones that keep today's rule for
-- 'WEB' rows exactly and add the native shape; every existing row is 'WEB' and already satisfies them.
-- Additive columns with defaults; no row rewrite beyond the default, no grant, policy or trigger change
-- (the table's existing runtime policies cover the new columns).
-- Rollback: delete 'EXPO' rows, restore the two original CHECKs, drop the two columns.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "WebPushSubscription" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE "WebPushSubscription" ADD COLUMN "platform" TEXT;
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_kind" CHECK ("kind" IN ('WEB','EXPO'));
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_platform" CHECK ("platform" IS NULL OR "platform" IN ('IOS','ANDROID','OTHER'));

ALTER TABLE "WebPushSubscription" DROP CONSTRAINT "WebPushSubscription_endpoint_https";
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_endpoint_shape" CHECK (
 ("kind" = 'WEB' AND "endpoint" LIKE 'https://%' AND length("endpoint") <= 2048)
 OR ("kind" = 'EXPO' AND "endpoint" ~ '^expo:Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$' AND "platform" IN ('IOS','ANDROID'))
);
ALTER TABLE "WebPushSubscription" DROP CONSTRAINT "WebPushSubscription_keys_bounded";
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_keys_bounded" CHECK (
 ("kind" = 'WEB' AND length("p256dh") BETWEEN 1 AND 200 AND length("auth") BETWEEN 1 AND 100)
 OR ("kind" = 'EXPO' AND "p256dh" = '-' AND "auth" = '-')
);
COMMIT;
