import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));

test("CLI can generate a field module and verify schema drift from a snapshot", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "kfq-"));
  const snapshotPath = join(tempDir, "schema.json");
  const generatedPath = join(tempDir, "generated", "customer-app.fields.ts");

  await writeFile(
    snapshotPath,
    JSON.stringify(
      {
        revision: "17",
        properties: {
          CustomerName: {
            type: "SINGLE_LINE_TEXT",
            code: "CustomerName",
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await execFile(
    process.execPath,
    [
      "./src/cli/index.ts",
      "generate",
      "--snapshot",
      snapshotPath,
      "--app-id",
      "42",
      "--out",
      generatedPath,
    ],
    { cwd: workspaceRoot },
  );

  const generatedSource = await readFile(generatedPath, "utf8");
  assert.match(generatedSource, /CustomerName: text\("CustomerName"\)/u);

  const result = await execFile(
    process.execPath,
    [
      "./src/cli/index.ts",
      "check-schema",
      "--generated",
      generatedPath,
      "--snapshot",
      snapshotPath,
      "--app-id",
      "42",
    ],
    { cwd: workspaceRoot },
  );

  assert.match(result.stdout, /Schema is up to date/u);
});

test("CLI can read app id from environment variables for snapshot mode", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "kfq-"));
  const snapshotPath = join(tempDir, "schema.json");
  const generatedPath = join(tempDir, "generated", "customer-app.fields.ts");
  const env = {
    ...process.env,
    KINTONE_APP_ID: "42",
  };

  await writeFile(
    snapshotPath,
    JSON.stringify(
      {
        revision: "17",
        properties: {
          CustomerName: {
            type: "SINGLE_LINE_TEXT",
            code: "CustomerName",
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await execFile(
    process.execPath,
    [
      "./src/cli/index.ts",
      "generate",
      "--snapshot",
      snapshotPath,
      "--out",
      generatedPath,
    ],
    { cwd: workspaceRoot, env },
  );

  const generatedSource = await readFile(generatedPath, "utf8");
  assert.match(generatedSource, /"appId":"42"/u);

  const result = await execFile(
    process.execPath,
    [
      "./src/cli/index.ts",
      "check-schema",
      "--generated",
      generatedPath,
      "--snapshot",
      snapshotPath,
    ],
    { cwd: workspaceRoot, env },
  );

  assert.match(result.stdout, /Schema is up to date\. appId=42 revision=17/u);
});

test("CLI can generate related-record fields from a bundled snapshot", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "kfq-"));
  const snapshotPath = join(tempDir, "schema-bundle.json");
  const generatedPath = join(tempDir, "generated", "customer-app.fields.ts");

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
                displayFields: ["company_name", "created_on"],
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
              created_on: {
                type: "DATE",
                code: "created_on",
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

  await execFile(
    process.execPath,
    [
      "./src/cli/index.ts",
      "generate",
      "--snapshot",
      snapshotPath,
      "--out",
      generatedPath,
    ],
    { cwd: workspaceRoot },
  );

  const generatedSource = await readFile(generatedPath, "utf8");
  assert.match(generatedSource, /Company_DB: relatedRecords\("Company_DB"/u);
  assert.match(
    generatedSource,
    /company_name: text\("Company_DB\.company_name", \{ scope: "RELATED_RECORDS" \}\)/u,
  );
  assert.match(
    generatedSource,
    /created_on: date\("Company_DB\.created_on", \{ scope: "RELATED_RECORDS" \}\)/u,
  );

  const result = await execFile(
    process.execPath,
    [
      "./src/cli/index.ts",
      "check-schema",
      "--generated",
      generatedPath,
      "--snapshot",
      snapshotPath,
    ],
    { cwd: workspaceRoot },
  );

  assert.match(result.stdout, /Schema is up to date/u);
});

test("CLI rejects unsupported live-fetch language values", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "kfq-"));
  const generatedPath = join(tempDir, "generated", "customer-app.fields.ts");

  await assert.rejects(
    execFile(
      process.execPath,
      [
        "./src/cli/index.ts",
        "generate",
        "--base-url",
        "https://example.cybozu.com",
        "--app-id",
        "42",
        "--api-token",
        "dummy-token",
        "--lang",
        "fr",
        "--out",
        generatedPath,
      ],
      { cwd: workspaceRoot },
    ),
    (error: NodeJS.ErrnoException & { stderr?: string }) => {
      assert.match(String(error.stderr), /Invalid --lang "fr"/u);
      return true;
    },
  );
});
