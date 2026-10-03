-- Stores become rows so the panel can add one without a deploy.
--
-- Written by hand because the generated version dropped `games.store` first and
-- the 88 assignments with it. The order here is the whole point: create, seed
-- from the enum that is about to go, backfill, and only then drop.

CREATE TABLE "game_stores" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_stores_key_key" ON "game_stores"("key");

ALTER TABLE "games" ADD COLUMN "store_id" TEXT;

-- One row per store actually in use, named the way the panel showed them.
INSERT INTO "game_stores" ("id", "key", "name", "position")
SELECT gen_random_uuid(),
       s.key,
       s.name,
       s.position
FROM (VALUES
    ('steam',       'Steam',              0),
    ('ubisoft',     'Ubisoft Connect',    1),
    ('gog',         'GOG',                2),
    ('epic',        'Epic',               3),
    ('xbox',        'Xbox',               4),
    ('playstation', 'PlayStation',        5),
    ('microsoft',   'Microsoft / Mojang', 6),
    ('other',       'Otra',               7)
) AS s(key, name, position)
WHERE s.key IN (SELECT DISTINCT "store"::text FROM "games" WHERE "store" IS NOT NULL);

UPDATE "games" g
SET "store_id" = s."id"
FROM "game_stores" s
WHERE g."store"::text = s."key";

ALTER TABLE "games" DROP COLUMN "store";

ALTER TABLE "games" ADD CONSTRAINT "games_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "game_stores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
