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
  readonly apiToken?: string;
  readonly username?: string;
  readonly password?: string;
  readonly guestSpaceId?: string;
  readonly lang?: "default" | "en" | "zh" | "ja" | "user";
}

export interface KintoneAppFormFieldsClient {
  getFormFields(params: {
    app: string;
    lang?: "default" | "en" | "zh" | "ja" | "user";
  }): Promise<{
    properties: Readonly<Record<string, KintoneFormFieldProperty>>;
    revision: string;
  }>;
}

export interface SnapshotBundleFromClientOptions {
  readonly appId: string;
  readonly lang?: LiveSchemaSourceOptions["lang"];
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

const fetchFormFields = async (
  appClient: KintoneAppFormFieldsClient,
  appId: string,
  lang?: LiveSchemaSourceOptions["lang"],
): Promise<KintoneFormFieldsSchema> => {
  const request = lang === undefined ? { app: appId } : { app: appId, lang };
  const response = await appClient.getFormFields(request);

  return {
    properties: response.properties,
    revision: response.revision,
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

export const createSnapshotBundleFromClient = async (
  appClient: KintoneAppFormFieldsClient,
  options: SnapshotBundleFromClientOptions,
): Promise<SnapshotSchemaBundle> => {
  const schema = await fetchFormFields(appClient, options.appId, options.lang);
  const relatedAppIds = collectRelatedAppIds(schema);
  const relatedApps = Object.fromEntries(
    await Promise.all(
      relatedAppIds.map(async (relatedAppId) => [
        relatedAppId,
        await fetchFormFields(appClient, relatedAppId, options.lang),
      ]),
    ),
  );

  return {
    appId: options.appId,
    schema,
    ...(Object.keys(relatedApps).length > 0 ? { relatedApps } : {}),
  };
};

export const hydrateRelatedRecordFields = async (
  appClient: KintoneAppFormFieldsClient,
  schema: KintoneFormFieldsSchema,
  options?: {
    readonly lang?: LiveSchemaSourceOptions["lang"];
  },
): Promise<KintoneFormFieldsSchema> => {
  const relatedSchemaCache = new Map<string, KintoneFormFieldsSchema>();
  const properties = await Promise.all(
    Object.entries(schema.properties).map(async ([fieldCode, property]) => {
      if (
        property.type !== "REFERENCE_TABLE" ||
        property.referenceTable === undefined ||
        property.referenceTable === null ||
        property.referenceTable.relatedApp?.app === undefined
      ) {
        return [fieldCode, property] as const;
      }

      const relatedAppId = property.referenceTable.relatedApp.app;
      let relatedSchema = relatedSchemaCache.get(relatedAppId);

      if (relatedSchema === undefined) {
        relatedSchema = await fetchFormFields(appClient, relatedAppId, options?.lang);
        relatedSchemaCache.set(relatedAppId, relatedSchema);
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
    properties: Object.fromEntries(properties),
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

const createKintoneClient = async (options: LiveSchemaSourceOptions) => {
  const module = await import("@kintone/rest-api-client");
  const auth =
    options.apiToken !== undefined
      ? { apiToken: options.apiToken }
      : options.username !== undefined && options.password !== undefined
        ? { username: options.username, password: options.password }
        : null;

  if (auth === null) {
    throw new CliUsageError(
      "Live schema fetch requires either --api-token or both --username and --password.",
    );
  }

  const clientOptions: ConstructorParameters<typeof module.KintoneRestAPIClient>[0] = {
    baseUrl: options.baseUrl,
    auth,
  };

  if (options.guestSpaceId !== undefined) {
    clientOptions.guestSpaceId = options.guestSpaceId;
  }

  return new module.KintoneRestAPIClient(clientOptions);
};

export const loadSchemaFromLiveKintone = async (
  options: LiveSchemaSourceOptions,
): Promise<KintoneSchemaSource> => {
  const client = await createKintoneClient(options);
  const snapshotBundle = await createSnapshotBundleFromClient(client.app, {
    appId: String(options.appId),
    ...(options.lang === undefined ? {} : { lang: options.lang }),
  });
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
  const client = await createKintoneClient(options);
  return createSnapshotBundleFromClient(client.app, {
    appId: String(options.appId),
    ...(options.lang === undefined ? {} : { lang: options.lang }),
  });
};
