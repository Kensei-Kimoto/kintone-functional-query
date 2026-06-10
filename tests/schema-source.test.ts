import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { QueryValidationError } from "../src/errors.ts";
import {
  createSnapshotBundleFromLiveKintone,
  loadSchemaFromLiveKintone,
  loadSchemaFromSnapshot,
} from "../src/schema-source.ts";

const withMockFetch = async <T>(
  handler: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>,
  callback: () => Promise<T>,
): Promise<T> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("loadSchemaFromLiveKintone fetches root and related app schemas with native fetch", async () => {
  const calls: Array<{ url: URL; headers: Headers }> = [];

  const source = await withMockFetch(
    async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      calls.push({ url, headers });
      const appId = url.searchParams.get("app");

      if (appId === "42") {
        return Response.json({
          revision: "17",
          properties: {
            Company_DB: {
              type: "REFERENCE_TABLE",
              code: "Company_DB",
              referenceTable: {
                relatedApp: { app: "100" },
                displayFields: ["company_name", "created_on", "NestedTable", "missing_field"],
              },
            },
          },
        });
      }

      if (appId === "100") {
        return Response.json({
          revision: "7",
          properties: {
            company_name: {
              type: "SINGLE_LINE_TEXT",
              code: "company_name",
            },
            created_on: {
              type: "DATE",
              code: "created_on",
            },
            NestedTable: {
              type: "SUBTABLE",
              code: "NestedTable",
              fields: {},
            },
          },
        });
      }

      return new Response("not found", { status: 404, statusText: "Not Found" });
    },
    () =>
      loadSchemaFromLiveKintone({
        baseUrl: "https://example.cybozu.com/",
        appId: "42",
        username: "user",
        password: "pass",
      }),
  );

  assert.deepEqual(
    calls.map((call) => call.url.searchParams.get("app")),
    ["42", "100"],
  );
  assert.equal(calls[0]?.url.href, "https://example.cybozu.com/k/v1/app/form/fields.json?app=42");
  assert.equal(
    calls[0]?.headers.get("X-Cybozu-Authorization"),
    Buffer.from("user:pass").toString("base64"),
  );
  assert.deepEqual(source.schema.properties.Company_DB?.fields?.company_name, {
    type: "SINGLE_LINE_TEXT",
    code: "Company_DB.company_name",
  });
  assert.deepEqual(source.schema.properties.Company_DB?.fields?.NestedTable, {
    type: "UNKNOWN",
    code: "Company_DB.NestedTable",
  });
});

test("loadSchemaFromLiveKintone uses guest space URLs when guest-space-id is passed", async () => {
  const calls: URL[] = [];

  await withMockFetch(
    async (input) => {
      const url = new URL(String(input));
      calls.push(url);

      return Response.json({
        revision: "17",
        properties: {},
      });
    },
    () =>
      loadSchemaFromLiveKintone({
        baseUrl: "https://example.cybozu.com",
        appId: "42",
        guestSpaceId: "12",
        username: "user",
        password: "pass",
      }),
  );

  assert.equal(calls[0]?.href, "https://example.cybozu.com/k/guest/12/v1/app/form/fields.json?app=42");
});

test("loadSchemaFromSnapshot accepts bundle format and hydrates related-record fields", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "kfq-schema-"));
  const snapshotPath = join(tempDir, "schema-bundle.json");

  await writeFile(
    snapshotPath,
    JSON.stringify(
      {
        appId: "42",
        schema: {
          revision: "17",
          properties: {
            Company_DB: {
              type: "REFERENCE_TABLE",
              code: "Company_DB",
              referenceTable: {
                relatedApp: {
                  app: "100",
                },
                displayFields: ["company_name"],
              },
            },
          },
        },
        relatedApps: {
          "100": {
            revision: "7",
            properties: {
              company_name: {
                type: "SINGLE_LINE_TEXT",
                code: "company_name",
              },
            },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const loaded = await loadSchemaFromSnapshot({ snapshotPath });

  assert.equal(loaded.appId, "42");
  assert.deepEqual(loaded.schema.properties.Company_DB?.fields?.company_name, {
    type: "SINGLE_LINE_TEXT",
    code: "Company_DB.company_name",
  });
});

test("createSnapshotBundleFromLiveKintone collects related app schemas once per app", async () => {
  const calls: string[] = [];

  const bundle = await withMockFetch(
    async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      const appId = url.searchParams.get("app");
      calls.push(String(appId));
      assert.equal(
        headers.get("X-Cybozu-Authorization"),
        Buffer.from("user:pass").toString("base64"),
      );

      switch (appId) {
        case "42":
          return Response.json({
            revision: "17",
            properties: {
              Company_DB: {
                type: "REFERENCE_TABLE",
                code: "Company_DB",
                referenceTable: {
                  relatedApp: { app: "100" },
                  displayFields: ["company_name"],
                },
              },
              Department_DB: {
                type: "REFERENCE_TABLE",
                code: "Department_DB",
                referenceTable: {
                  relatedApp: { app: "200" },
                  displayFields: ["department_name"],
                },
              },
              Company_DB_Copy: {
                type: "REFERENCE_TABLE",
                code: "Company_DB_Copy",
                referenceTable: {
                  relatedApp: { app: "100" },
                  displayFields: ["company_name"],
                },
              },
            },
          });
        case "100":
          return Response.json({
            revision: "7",
            properties: {
              company_name: {
                type: "SINGLE_LINE_TEXT",
                code: "company_name",
              },
            },
          });
        case "200":
          return Response.json({
            revision: "9",
            properties: {
              department_name: {
                type: "SINGLE_LINE_TEXT",
                code: "department_name",
              },
            },
          });
        default:
          return new Response("not found", { status: 404, statusText: "Not Found" });
      }
    },
    () =>
      createSnapshotBundleFromLiveKintone({
        baseUrl: "https://example.cybozu.com",
        appId: "42",
        username: "user",
        password: "pass",
      }),
  );

  assert.deepEqual(calls, ["42", "100", "200"]);
  assert.equal(bundle.appId, "42");
  assert.equal(bundle.schema.revision, "17");
  assert.equal(bundle.relatedApps?.["100"]?.revision, "7");
  assert.equal(bundle.relatedApps?.["200"]?.revision, "9");
});

test("loadSchemaFromSnapshot rejects malformed snapshot shapes with a typed error", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "kfq-schema-"));
  const snapshotPath = join(tempDir, "invalid-schema.json");

  await writeFile(
    snapshotPath,
    JSON.stringify(
      {
        revision: "17",
        properties: null,
      },
      null,
      2,
    ),
    "utf8",
  );

  await assert.rejects(
    loadSchemaFromSnapshot({ snapshotPath }),
    (error: unknown) => {
      assert.ok(error instanceof QueryValidationError);
      assert.match(error.message, /is not a valid Get Form Fields response or snapshot bundle/u);
      return true;
    },
  );
});
