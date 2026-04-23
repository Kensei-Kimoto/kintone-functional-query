import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { KintoneFormFieldProperty, KintoneFormFieldsSchema } from "../src/codegen.ts";
import {
  createSnapshotBundleFromClient,
  hydrateRelatedRecordFields,
  loadSchemaFromSnapshot,
} from "../src/schema-source.ts";

test("hydrateRelatedRecordFields resolves displayed related-record fields from the datasource app", async () => {
  const calls: string[] = [];

  const appClient = {
    async getFormFields(params: { app: string }) {
      calls.push(params.app);

      if (params.app === "100") {
        return {
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
          } satisfies Record<string, KintoneFormFieldProperty>,
        };
      }

      throw new Error(`Unexpected app ${params.app}`);
    },
  };

  const schema: KintoneFormFieldsSchema = {
    revision: "17",
    properties: {
      Company_DB: {
        type: "REFERENCE_TABLE",
        code: "Company_DB",
        referenceTable: {
          relatedApp: {
            app: "100",
          },
          displayFields: ["company_name", "created_on", "NestedTable", "missing_field"],
        },
      },
    },
  };

  const hydrated = await hydrateRelatedRecordFields(appClient, schema);
  const companyDb = hydrated.properties.Company_DB;

  assert.deepEqual(calls, ["100"]);
  assert.ok(companyDb?.fields !== undefined);
  assert.deepEqual(companyDb?.fields?.company_name, {
    type: "SINGLE_LINE_TEXT",
    code: "Company_DB.company_name",
  });
  assert.deepEqual(companyDb?.fields?.created_on, {
    type: "DATE",
    code: "Company_DB.created_on",
  });
  assert.deepEqual(companyDb?.fields?.NestedTable, {
    type: "UNKNOWN",
    code: "Company_DB.NestedTable",
  });
  assert.deepEqual(companyDb?.fields?.missing_field, {
    type: "UNKNOWN",
    code: "Company_DB.missing_field",
  });
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

test("createSnapshotBundleFromClient collects related app schemas once per app", async () => {
  const calls: string[] = [];

  const appClient = {
    async getFormFields(params: { app: string }) {
      calls.push(params.app);

      switch (params.app) {
        case "42":
          return {
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
            } satisfies Record<string, KintoneFormFieldProperty>,
          };
        case "100":
          return {
            revision: "7",
            properties: {
              company_name: {
                type: "SINGLE_LINE_TEXT",
                code: "company_name",
              },
            } satisfies Record<string, KintoneFormFieldProperty>,
          };
        case "200":
          return {
            revision: "9",
            properties: {
              department_name: {
                type: "SINGLE_LINE_TEXT",
                code: "department_name",
              },
            } satisfies Record<string, KintoneFormFieldProperty>,
          };
        default:
          throw new Error(`Unexpected app ${params.app}`);
      }
    },
  };

  const bundle = await createSnapshotBundleFromClient(appClient, { appId: "42" });

  assert.deepEqual(calls, ["42", "100", "200"]);
  assert.equal(bundle.appId, "42");
  assert.equal(bundle.schema.revision, "17");
  assert.equal(bundle.relatedApps?.["100"]?.revision, "7");
  assert.equal(bundle.relatedApps?.["200"]?.revision, "9");
});
