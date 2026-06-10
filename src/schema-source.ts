import { readFile } from "node:fs/promises";

import type { KintoneFormFieldProperty, KintoneFormFieldsSchema } from "./codegen.ts";
import { CliUsageError, QueryValidationError } from "./errors.ts";

export interface KintoneSchemaSource {
  readonly appId: string;
  readonly schema: KintoneFormFieldsSchema;
}

export interface SnapshotSchemaSourceOptions {
  readonly appId?: string;
  readonly snapshotPath: string;
}

export interface SnapshotSchemaBundle {
  readonly appId?: string;
  readonly schema: KintoneFormFieldsSchema;
  readonly relatedApps?: Readonly<Record<string, KintoneFormFieldsSchema>>;
}

export interface LiveSchemaSourceOptions {
  readonly baseUrl: string;
  readonly appId: string;
  readonly username?: string;
  readonly password?: string;
  readonly guestSpaceId?: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isKintoneFormFieldPropertyLike = (value: unknown): value is KintoneFormFieldProperty =>
  isPlainObject(value) && typeof value.type === "string";

const isKintoneFormFieldsSchema = (value: unknown): value is KintoneFormFieldsSchema =>
  isPlainObject(value) &&
  typeof value.revision === "string" &&
  isPlainObject(value.properties) &&
  Object.values(value.properties).every(isKintoneFormFieldPropertyLike);

const isSnapshotSchemaBundle = (value: unknown): value is SnapshotSchemaBundle =>
  isPlainObject(value) &&
  (value.appId === undefined || typeof value.appId === "string") &&
  "schema" in value &&
  isKintoneFormFieldsSchema(value.schema) &&
  (value.relatedApps === undefined ||
    (isPlainObject(value.relatedApps) &&
      Object.values(value.relatedApps).every(isKintoneFormFieldsSchema)));

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/u, "");

const buildFormFieldsUrl = (
  options: Pick<LiveSchemaSourceOptions, "baseUrl" | "guestSpaceId">,
  appId: string,
): URL => {
  const path = options.guestSpaceId === undefined
    ? "/k/v1/app/form/fields.json"
    : `/k/guest/${encodeURIComponent(options.guestSpaceId)}/v1/app/form/fields.json`;
  const url = new URL(path, `${normalizeBaseUrl(options.baseUrl)}/`);

  url.searchParams.set("app", appId);

  return url;
};

const buildAuthHeaders = (
  options: Pick<LiveSchemaSourceOptions, "username" | "password">,
): Headers => {
  const headers = new Headers({
    "Accept": "application/json",
  });

  if (options.username !== undefined && options.password !== undefined) {
    headers.set(
      "X-Cybozu-Authorization",
      Buffer.from(`${options.username}:${options.password}`).toString("base64"),
    );
    return headers;
  }

  throw new CliUsageError(
    "Live schema fetch requires both --username and --password.",
  );
};

const fetchFormFieldsFromKintone = async (
  options: LiveSchemaSourceOptions,
  appId: string,
): Promise<KintoneFormFieldsSchema> => {
  const url = buildFormFieldsUrl(options, appId);
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(options),
  });

  if (!response.ok) {
    throw new QueryValidationError(
      `Failed to fetch form fields for app "${appId}": HTTP ${response.status} ${response.statusText}.`,
    );
  }

  const parsed = await response.json() as unknown;

  if (!isKintoneFormFieldsSchema(parsed)) {
    throw new QueryValidationError(
      `Kintone form fields response for app "${appId}" is not a valid Get Form Fields response.`,
    );
  }

  return {
    properties: parsed.properties,
    revision: parsed.revision,
  };
};

const collectRelatedAppIds = (schema: KintoneFormFieldsSchema): readonly string[] => {
  const relatedAppIds = new Set<string>();

  for (const property of Object.values(schema.properties)) {
    const relatedAppId = property.referenceTable?.relatedApp?.app;

    if (property.type === "REFERENCE_TABLE" && relatedAppId !== undefined) {
      relatedAppIds.add(relatedAppId);
    }
  }

  return [...relatedAppIds];
};

const nonInlineRelatedRecordsTypes = new Set([
  "LABEL",
  "SPACER",
  "HR",
  "GROUP",
  "REFERENCE_TABLE",
  "SUBTABLE",
]);

const qualifyRelatedRecordProperty = (
  relatedRecordsCode: string,
  fieldCode: string,
  property?: KintoneFormFieldProperty,
): KintoneFormFieldProperty => {
  const qualifiedCode = `${relatedRecordsCode}.${fieldCode}`;

  if (property === undefined) {
    return {
      type: "UNKNOWN",
      code: qualifiedCode,
    };
  }

  if (nonInlineRelatedRecordsTypes.has(property.type)) {
    return {
      type: "UNKNOWN",
      code: qualifiedCode,
    };
  }

  return {
    ...property,
    code: qualifiedCode,
  };
};

const resolveRelatedRecordFields = (
  property: KintoneFormFieldProperty,
  relatedSchema: KintoneFormFieldsSchema,
): Readonly<Record<string, KintoneFormFieldProperty>> => {
  const relatedRecordsCode = property.code;
  const displayFields = property.referenceTable?.displayFields;

  if (relatedRecordsCode === undefined || displayFields === undefined) {
    return property.fields ?? {};
  }

  return Object.fromEntries(
    displayFields.map((fieldCode) => [
      fieldCode,
      qualifyRelatedRecordProperty(
        relatedRecordsCode,
        fieldCode,
        relatedSchema.properties[fieldCode],
      ),
    ]),
  );
};

export const hydrateRelatedRecordFieldsFromSchemas = (
  schema: KintoneFormFieldsSchema,
  relatedSchemas: Readonly<Record<string, KintoneFormFieldsSchema>>,
): KintoneFormFieldsSchema => {
  const properties = Object.fromEntries(
    Object.entries(schema.properties).map(([fieldCode, property]) => {
      if (
        property.type !== "REFERENCE_TABLE" ||
        property.referenceTable === undefined ||
        property.referenceTable === null ||
        property.referenceTable.relatedApp?.app === undefined
      ) {
        return [fieldCode, property] as const;
      }

      const relatedSchema = relatedSchemas[property.referenceTable.relatedApp.app];

      if (relatedSchema === undefined) {
        return [fieldCode, property] as const;
      }

      return [
        fieldCode,
        {
          ...property,
          fields: resolveRelatedRecordFields(property, relatedSchema),
        },
      ] as const;
    }),
  );

  return {
    ...schema,
    properties,
  };
};

const createSnapshotBundleFromLiveOptions = async (
  options: LiveSchemaSourceOptions,
): Promise<SnapshotSchemaBundle> => {
  const schema = await fetchFormFieldsFromKintone(options, String(options.appId));
  const relatedAppIds = collectRelatedAppIds(schema);
  const relatedApps = Object.fromEntries(
    await Promise.all(
      relatedAppIds.map(async (relatedAppId) => [
        relatedAppId,
        await fetchFormFieldsFromKintone(options, relatedAppId),
      ]),
    ),
  );

  return {
    appId: String(options.appId),
    schema,
    ...(Object.keys(relatedApps).length > 0 ? { relatedApps } : {}),
  };
};

export const loadSchemaFromSnapshot = async (
  options: SnapshotSchemaSourceOptions,
): Promise<KintoneSchemaSource> => {
  const raw = await readFile(options.snapshotPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (isKintoneFormFieldsSchema(parsed)) {
    return {
      appId: options.appId ?? "unknown",
      schema: parsed,
    };
  }

  if (isSnapshotSchemaBundle(parsed)) {
    return {
      appId: options.appId ?? parsed.appId ?? "unknown",
      schema:
        parsed.relatedApps === undefined
          ? parsed.schema
          : hydrateRelatedRecordFieldsFromSchemas(parsed.schema, parsed.relatedApps),
    };
  }

  throw new QueryValidationError(
    `Snapshot file "${options.snapshotPath}" is not a valid Get Form Fields response or snapshot bundle.`,
  );
};

export const loadSchemaFromLiveKintone = async (
  options: LiveSchemaSourceOptions,
): Promise<KintoneSchemaSource> => {
  const snapshotBundle = await createSnapshotBundleFromLiveOptions(options);
  const schema =
    snapshotBundle.relatedApps === undefined
      ? snapshotBundle.schema
      : hydrateRelatedRecordFieldsFromSchemas(snapshotBundle.schema, snapshotBundle.relatedApps);

  return {
    appId: String(options.appId),
    schema,
  };
};

export const createSnapshotBundleFromLiveKintone = async (
  options: LiveSchemaSourceOptions,
): Promise<SnapshotSchemaBundle> => {
  return createSnapshotBundleFromLiveOptions(options);
};
