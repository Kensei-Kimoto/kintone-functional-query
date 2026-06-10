# kintone-functional-query

`kintone-functional-query` is a schema-aware query compiler for Kintone.

The v2 reboot focuses on one job:

- generate typed field descriptors from `Get Form Fields`
- compose conditions with descriptive functions
- compile those conditions into Kintone `condition` and `query` strings

It is intentionally optimized for TypeScript projects with a build step.
Plain JavaScript + CDN usage is not a primary goal for v2.

## Status

This repository currently contains the initial v2 scaffold:

- field descriptor model
- descriptive condition builders
- `compileCondition()` and `compileQuery()`
- field-aware query function compatibility checks
- related-record field generation for live schema fetches
- codegen helpers for generated schema modules
- CLI entrypoints for `generate` and `check-schema`

The public API shape is in place, and the core flow has been verified against a live Kintone app:

- live fetch
- snapshot bundle generation
- TypeScript module generation
- schema drift checks
- compiled `condition` and `query` strings used through the Kintone REST API

This repository is currently being refreshed as the v2 reboot line on GitHub first.
npm publication for v2 will come later.

## Install

```bash
git clone https://github.com/Kensei-Kimoto/kintone-functional-query.git
cd kintone-functional-query
npm install
npm run build
```

The v2 reboot is not published to npm yet. Run the CLI from a local clone:

```bash
node ./dist/cli/index.js --help
```

The CLI can read live-fetch connection and password-auth settings from environment variables too.
Pass `--app-id` explicitly for each command so generated artifacts always name their target app.

```bash
KINTONE_BASE_URL=
KINTONE_USERNAME=
KINTONE_PASSWORD=
```

API token authentication is intentionally not supported by the live schema fetcher. Related-record
field expansion may require reading datasource apps discovered at runtime, so username/password
authentication provides a clearer and less error-prone workflow for v2 schema generation.

## Generate Schema

Generate from a saved `Get Form Fields` JSON snapshot:

```bash
node ./dist/cli/index.js generate \
  --snapshot ./schema/customer-app.json \
  --app-id 42 \
  --out ./generated/customer-app.fields.ts
```

If you want typed related-record fields from snapshot mode too, you can pass a bundle snapshot:

```json
{
  "appId": "42",
  "schema": { "...": "root Get Form Fields response" },
  "relatedApps": {
    "100": { "...": "datasource app Get Form Fields response" }
  }
}
```

Generate by fetching the schema directly from Kintone:

```bash
node ./dist/cli/index.js generate \
  --base-url https://example.cybozu.com \
  --app-id 42 \
  --username $KINTONE_USERNAME \
  --password $KINTONE_PASSWORD \
  --out ./generated/customer-app.fields.ts
```

Write a reusable bundle snapshot from live Kintone:

```bash
node ./dist/cli/index.js snapshot \
  --base-url https://example.cybozu.com \
  --app-id 42 \
  --username $KINTONE_USERNAME \
  --password $KINTONE_PASSWORD \
  --out ./schema/customer-app.bundle.json
```

For guest space apps, pass the guest space ID with the app-specific command:

```bash
node ./dist/cli/index.js snapshot \
  --base-url https://example.cybozu.com \
  --guest-space-id 12 \
  --app-id 42 \
  --username $KINTONE_USERNAME \
  --password $KINTONE_PASSWORD \
  --out ./schema/customer-app.bundle.json
```

If you prefer `.env`, Node 22 can load it directly:

```bash
node --env-file=.env ./dist/cli/index.js snapshot --app-id 42 --out ./schema/customer-app.bundle.json
node --env-file=.env ./dist/cli/index.js generate --app-id 42 --out ./generated/customer-app.fields.ts
```

When generating from live Kintone, related-record fields are expanded from the datasource App's
displayed fields when permissions allow it. Snapshot inputs can also contain that expanded shape,
and bundle snapshots can provide the datasource schemas explicitly. A raw `Get Form Fields` snapshot
will still fall back to `unknownField(...)` entries for related-record fields.

## Check Schema Drift

Compare the generated module metadata with the current schema snapshot:

```bash
node ./dist/cli/index.js check-schema \
  --generated ./generated/customer-app.fields.ts \
  --snapshot ./schema/customer-app.json \
  --app-id 42
```

## Usage

```ts
import {
  and,
  ascending,
  compileCondition,
  compileOrderBy,
  compileQuery,
  contains,
  equals,
  greaterThanOrEqual,
  isIn,
  today,
} from "kintone-functional-query";
import { fields, systemFields } from "./generated/customer-app.fields.js";

const condition = and(
  equals(fields.CustomerName, "Cybozu"),
  greaterThanOrEqual(fields.ContractDate, today()),
  isIn(fields.Status, ["Qualified", "Won"]),
);

const conditionString = compileCondition(condition);

const queryString = compileQuery({
  condition,
  orderBy: [ascending(systemFields.$id)],
  limit: 100,
  offset: 0,
});
```

Compatible query functions are enforced at both type-check and runtime.
For example, `today()` works with date-like fields, `loginUser()` works with user-like fields,
and unsupported combinations such as `equals(fields.CustomerName, today())` are rejected.

## condition vs query

Use `compileCondition()` when the Kintone client expects only the condition part.
This is a good fit for `getAllRecordsWithId()`:

```ts
import {
  and,
  compileCondition,
  greaterThanOrEqual,
  isIn,
  today,
} from "kintone-functional-query";
import { fields } from "./generated/customer-app.fields.js";

const condition = compileCondition(
  and(
    greaterThanOrEqual(fields.ContractDate, today()),
    isIn(fields.Status, ["Qualified", "Won"]),
  ),
);

// Use the compiled condition with your preferred Kintone REST client.
const records = await client.record.getAllRecordsWithId({
  app: "42",
  condition,
});
```

Use `compileOrderBy()` when the client takes `condition` and `orderBy` separately:

```ts
const condition = compileCondition(
  greaterThanOrEqual(fields.ContractDate, today()),
);

const orderBy = compileOrderBy([
  ascending(systemFields.$id),
]);

const records = await client.record.getAllRecords({
  app: "42",
  condition,
  orderBy,
});
```

Use `compileQuery()` when the client expects a full Kintone query string:

```ts
const query = compileQuery({
  condition: greaterThanOrEqual(fields.ContractDate, today()),
  orderBy: [ascending(systemFields.$id)],
  limit: 100,
  offset: 0,
});

const records = await client.record.getAllRecordsWithCursor({
  app: "42",
  query,
});
```

## Recommended Flow

1. Run `snapshot` in development when you want a Git-managed schema artifact.
2. Commit the bundle snapshot if you want offline regeneration and stable review diffs.
3. Run `generate` from that snapshot in normal development.
4. Run `check-schema` in CI or before release to catch schema drift.
