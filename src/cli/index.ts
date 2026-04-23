#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  generateFieldModule,
  readGeneratedMetadataFromFile,
} from "../codegen.ts";
import { CliUsageError, KintoneFunctionalQueryError } from "../errors.ts";
import {
  createSnapshotBundleFromLiveKintone,
  loadSchemaFromLiveKintone,
  loadSchemaFromSnapshot,
  type KintoneSchemaSource,
} from "../schema-source.ts";

type FlagMap = Map<string, string | true>;
type EnvMap = NodeJS.ProcessEnv;

const parseFlags = (argv: readonly string[]): FlagMap => {
  const flags: FlagMap = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("--")) {
      throw new CliUsageError(`Unexpected argument "${token}".`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      flags.set(key, true);
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return flags;
};

const getStringFlag = (flags: FlagMap, name: string): string | undefined => {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
};

const getStringInput = (
  flags: FlagMap,
  name: string,
  env: EnvMap,
  envName?: string,
): string | undefined => {
  const flagValue = getStringFlag(flags, name);

  if (flagValue !== undefined) {
    return flagValue;
  }

  if (envName === undefined) {
    return undefined;
  }

  const envValue = env[envName];
  return typeof envValue === "string" && envValue.length > 0 ? envValue : undefined;
};

const requireStringInput = (
  flags: FlagMap,
  name: string,
  env: EnvMap,
  envName?: string,
): string => {
  const value = getStringInput(flags, name, env, envName);

  if (value === undefined) {
    throw new CliUsageError(`Missing required flag --${name}.`);
  }

  return value;
};

const loadLiveOptions = (flags: FlagMap, env: EnvMap) => {
  const apiToken = getStringInput(flags, "api-token", env, "KINTONE_API_TOKEN");
  const username = getStringInput(flags, "username", env, "KINTONE_USERNAME");
  const password = getStringInput(flags, "password", env, "KINTONE_PASSWORD");
  const guestSpaceId = getStringInput(flags, "guest-space-id", env, "KINTONE_GUEST_SPACE_ID");
  const lang = getStringInput(flags, "lang", env, "KINTONE_LANG");

  return {
    baseUrl: requireStringInput(flags, "base-url", env, "KINTONE_BASE_URL"),
    appId: requireStringInput(flags, "app-id", env, "KINTONE_APP_ID"),
    ...(apiToken !== undefined ? { apiToken } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(password !== undefined ? { password } : {}),
    ...(guestSpaceId !== undefined ? { guestSpaceId } : {}),
    ...(lang === "default" || lang === "en" || lang === "zh" || lang === "ja" || lang === "user"
      ? { lang }
      : {}),
    } satisfies Parameters<typeof loadSchemaFromLiveKintone>[0];
};

const loadSchemaSource = async (
  flags: FlagMap,
  env: EnvMap,
): Promise<KintoneSchemaSource> => {
  const snapshotPath = getStringInput(flags, "snapshot", env);

  if (snapshotPath !== undefined) {
    const appId = getStringInput(flags, "app-id", env, "KINTONE_APP_ID");
    return loadSchemaFromSnapshot(
      appId !== undefined ? { snapshotPath, appId } : { snapshotPath },
    );
  }

  return loadSchemaFromLiveKintone(loadLiveOptions(flags, env));
};

const printHelp = (): void => {
  const lines = [
    "kintone-functional-query",
    "",
    "Commands:",
    "  generate      Generate a typed field module",
    "  snapshot      Save a reusable schema snapshot bundle",
    "  check-schema  Compare generated metadata with a live or snapshot schema",
    "",
    "Generate from snapshot:",
    "  kintone-functional-query generate --snapshot ./schema.json --app-id 42 --out ./generated/app.fields.ts",
    "",
    "Generate from live Kintone:",
    "  kintone-functional-query generate --base-url https://example.cybozu.com --app-id 42 --api-token <token> --out ./generated/app.fields.ts",
    "",
    "Write a schema snapshot bundle from live Kintone:",
    "  kintone-functional-query snapshot --base-url https://example.cybozu.com --app-id 42 --api-token <token> --out ./schema/app.bundle.json",
    "",
    "Check schema drift:",
    "  kintone-functional-query check-schema --generated ./generated/app.fields.ts --snapshot ./schema.json",
  ];

  console.log(lines.join("\n"));
};

const runGenerate = async (flags: FlagMap): Promise<void> => {
  const outputPath = requireStringInput(flags, "out", process.env);
  const source = await loadSchemaSource(flags, process.env);
  const moduleSource = generateFieldModule({
    appId: source.appId,
    schema: source.schema,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, moduleSource, "utf8");

  console.log(`Generated ${outputPath}`);
};

const runSnapshot = async (flags: FlagMap): Promise<void> => {
  const outputPath = requireStringInput(flags, "out", process.env);
  const snapshotBundle = await createSnapshotBundleFromLiveKintone(
    loadLiveOptions(flags, process.env),
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshotBundle, null, 2)}\n`, "utf8");

  console.log(`Wrote snapshot ${outputPath}`);
};

const runCheckSchema = async (flags: FlagMap): Promise<void> => {
  const generatedPath = requireStringInput(flags, "generated", process.env);
  const generatedMetadata = await readGeneratedMetadataFromFile(generatedPath);

  if (generatedMetadata === null) {
    throw new CliUsageError(
      `Could not find generated metadata in "${generatedPath}". Re-run generate first.`,
    );
  }

  const liveSource = await loadSchemaSource(flags, process.env);
  const revisionMatches = generatedMetadata.revision === liveSource.schema.revision;
  const appIdMatches =
    generatedMetadata.appId === "unknown" || generatedMetadata.appId === liveSource.appId;

  if (revisionMatches && appIdMatches) {
    console.log(
      `Schema is up to date. appId=${liveSource.appId} revision=${liveSource.schema.revision}`,
    );
    return;
  }

  console.error("Schema drift detected.");
  console.error(`  generated appId: ${generatedMetadata.appId}`);
  console.error(`  generated revision: ${generatedMetadata.revision}`);
  console.error(`  current appId: ${liveSource.appId}`);
  console.error(`  current revision: ${liveSource.schema.revision}`);
  process.exitCode = 1;
};

export const run = async (argv: readonly string[]): Promise<void> => {
  const [command, ...flagArgs] = argv;

  if (command === undefined || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  const flags = parseFlags(flagArgs);

  switch (command) {
    case "generate":
      await runGenerate(flags);
      return;
    case "snapshot":
      await runSnapshot(flags);
      return;
    case "check-schema":
      await runCheckSchema(flags);
      return;
    default:
      throw new CliUsageError(`Unknown command "${command}".`);
  }
};

const shouldRunAsCli =
  process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;

if (shouldRunAsCli) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof KintoneFunctionalQueryError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    console.error(error);
    process.exitCode = 1;
  });
}
