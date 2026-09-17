# Melodia Wine Shop

Wine-sale application for Ensemble de Cuivres Mélodia. See `CLAUDE.md`
and `docs/` for product/architecture specifications.

## Local development

```
pnpm install
cp .env.example .env.local   # DATABASE_URL / DATABASE_URL_UNPOOLED / DATABASE_DRIVER=postgres
docker compose up -d         # starts local PostgreSQL (never used in production)
pnpm db:migrate               # applies migrations to local Postgres
pnpm test:db                  # PostgreSQL integration tests (needs the two steps above)
pnpm db:seed                  # optional — fictional demo campaign/products/sellers
pnpm dev
```

`pnpm test` (plain unit tests) never needs PostgreSQL running.
`pnpm test:db` does — it's a separate suite/config specifically for
tests that need a real database.

Stop the database without losing data:

```
docker compose down
```

**Destructive reset** (deletes all local database data — only ever run this deliberately):

```
docker compose down -v
```

Production target is Vercel (app) + Neon (PostgreSQL) + Infomaniak (DNS
for `vins.ecmelodia.ch`) — see `docs/05-ARCHITECTURE.md`. Neon is never
required for local development; `DATABASE_DRIVER` (`postgres` | `neon`)
selects which database driver the app uses, and is never inferred from
the hosting platform.
