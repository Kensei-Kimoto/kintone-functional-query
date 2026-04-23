import { readFile } from "node:fs/promises";

import { QueryValidationError } from "./errors.ts";

export interface KintoneFieldOption {
  readonly label?: string;
  readonly index?: number | string;
}

export interface KintoneRelatedRecordsSettings {
  readonly relatedApp?: {
    readonly app?: string;
    readonly code?: string;
  };
  readonly displayFields?: readonly string[];
}

export interface KintoneFormFieldProperty {
  readonly type: string;
  readonly code?: string;
  readonly label?: string;
  readonly options?: Readonly<Record<string, KintoneFieldOption>>;
  readonly fields?: Readonly<Record<string, KintoneFormFieldProperty>>;
  readonly referenceTable?: KintoneRelatedRecordsSettings | null;
}

export interface KintoneFormFieldsSchema {
  readonly properties: Readonly<Record<string, KintoneFormFieldProperty>>;
  readonly revision: string;
}

export interface GeneratedModuleMetadata {
  readonly appId: string;
  readonly revision: string;
  readonly generatedAt: string;
}

export interface GenerateFieldModuleInput {
  readonly appId: string;
  readonly schema: KintoneFormFieldsSchema;
  readonly generatedAt?: string;
  readonly packageName?: string;
}

export const GENERATED_METADATA_PREFIX = "// kintone-functional-query metadata: ";

const SKIPPED_FIELD_TYPES = new Set([
  "LABEL",
  "SPACER",
  "HR",
  "GROUP",
]);

const escapeStringLiteral = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const optionNames = (property: KintoneFormFieldProperty): readonly string[] => {
  if (property.options === undefined) {
    return [];
  }

  return [...Object.entries(property.options)]
    .sort(
      (
        left: readonly [string, KintoneFieldOption],
        right: readonly [string, KintoneFieldOption],
      ) => Number(left[1].index ?? 0) - Number(right[1].index ?? 0),
    )
    .map(([name]) => name);
};

const scopeArgument = (scope: "ROOT" | "SUBTABLE" | "RELATED_RECORDS"): string =>
  scope === "ROOT" ? "" : `, { scope: "${scope}" }`;

const renderStringTuple = (values: readonly string[]): string =>
  `[${values.map((value) => `"${escapeStringLiteral(value)}"`).join(", ")}] as const`;

const renderObjectKey = (value: string): string =>
  /^[$A-Z_a-z][$\w]*$/u.test(value) ? value : `"${escapeStringLiteral(value)}"`;

const renderUnknownRelatedRecordFields = (
  property: KintoneFormFieldProperty,
): Readonly<Record<string, KintoneFormFieldProperty>> => {
  const relatedRecordsCode = property.code;
  const displayFields = property.referenceTable?.displayFields;

  if (relatedRecordsCode === undefined || displayFields === undefined) {
    return {};
  }

  return Object.fromEntries(
    displayFields.map((fieldCode) => [
      fieldCode,
      {
        type: "UNKNOWN",
        code: `${relatedRecordsCode}.${fieldCode}`,
      } satisfies KintoneFormFieldProperty,
    ]),
  );
};

const renderFieldExpression = (
  property: KintoneFormFieldProperty,
  scope: "ROOT" | "SUBTABLE" | "RELATED_RECORDS",
): string | null => {
  const code = property.code;

  if (code === undefined || SKIPPED_FIELD_TYPES.has(property.type)) {
    return null;
  }

  switch (property.type) {
    case "SINGLE_LINE_TEXT":
      return `text("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "MULTI_LINE_TEXT":
      return `textArea("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "RICH_TEXT":
      return `richText("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "LINK":
      return `link("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "NUMBER":
      return `numberField("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "CALC":
      return `calculated("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "RECORD_NUMBER":
      return `recordNumber("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "DATE":
      return `date("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "DATETIME":
      return `dateTime("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "TIME":
      return `time("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "CREATED_TIME":
      return `createdTime("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "UPDATED_TIME":
      return `updatedTime("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "CREATOR":
      return `creator("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "MODIFIER":
      return `modifier("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "USER_SELECT":
      return `userSelect("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "ORGANIZATION_SELECT":
      return `organizationSelect("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "GROUP_SELECT":
      return `groupSelect("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "STATUS":
      return `status("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "STATUS_ASSIGNEE":
      return `statusAssignee("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "CATEGORY":
      return `category("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "FILE":
      return `attachment("${escapeStringLiteral(code)}"${scopeArgument(scope)})`;
    case "DROP_DOWN":
      return `dropDown("${escapeStringLiteral(code)}", ${renderStringTuple(optionNames(property))}${scopeArgument(scope)})`;
    case "RADIO_BUTTON":
      return `radioButton("${escapeStringLiteral(code)}", ${renderStringTuple(optionNames(property))}${scopeArgument(scope)})`;
    case "CHECK_BOX":
      return `checkBox("${escapeStringLiteral(code)}", ${renderStringTuple(optionNames(property))}${scopeArgument(scope)})`;
    case "MULTI_SELECT":
      return `multiSelect("${escapeStringLiteral(code)}", ${renderStringTuple(optionNames(property))}${scopeArgument(scope)})`;
    case "SUBTABLE":
      return renderSubtable(property, scope);
    case "REFERENCE_TABLE":
      return renderRelatedRecords(property);
    default:
      return `unknownField("${escapeStringLiteral(code)}", "${escapeStringLiteral(property.type)}"${scopeArgument(scope)})`;
  }
};

const renderFieldsObject = (
  properties: Readonly<Record<string, KintoneFormFieldProperty>>,
  scope: "ROOT" | "SUBTABLE" | "RELATED_RECORDS",
  indentLevel = 1,
): string => {
  const indent = "  ".repeat(indentLevel);
  const nestedIndent = "  ".repeat(indentLevel + 1);
  const lines = Object.entries(properties).flatMap(([key, property]) => {
    const rendered = renderFieldExpression(property, scope);

    if (rendered === null) {
      return [];
    }

    return `${nestedIndent}${renderObjectKey(key)}: ${rendered},`;
  });

  if (lines.length === 0) {
    return "{}";
  }

  return `{\n${lines.join("\n")}\n${indent}}`;
};

const renderSubtable = (
  property: KintoneFormFieldProperty,
  _scope: "ROOT" | "SUBTABLE" | "RELATED_RECORDS",
): string => {
  const code = property.code;
  const fields = property.fields;

  if (code === undefined || fields === undefined) {
    return `unknownField("${escapeStringLiteral(code ?? "")}", "SUBTABLE")`;
  }

  return `subtable("${escapeStringLiteral(code)}", ${renderFieldsObject(fields, "SUBTABLE", 2)})`;
};

const renderRelatedRecords = (property: KintoneFormFieldProperty): string => {
  const code = property.code;

  if (code === undefined) {
    return `unknownField("", "REFERENCE_TABLE")`;
  }

  const fields = property.fields ?? renderUnknownRelatedRecordFields(property);

  return `relatedRecords("${escapeStringLiteral(code)}", ${renderFieldsObject(fields, "RELATED_RECORDS", 2)})`;
};

export const generateFieldModule = (input: GenerateFieldModuleInput): string => {
  const metadata: GeneratedModuleMetadata = {
    appId: input.appId,
    revision: input.schema.revision,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };

  const packageName = input.packageName ?? "kintone-functional-query";
  const importLine =
    'import { attachment, calculated, category, checkBox, createdTime, creator, date, dateTime, dropDown, groupSelect, link, modifier, multiSelect, numberField, organizationSelect, radioButton, recordId, recordNumber, relatedRecords, richText, status, statusAssignee, subtable, text, textArea, time, unknownField, updatedTime, userSelect } from "' +
    packageName +
    '";';

  return [
    `${GENERATED_METADATA_PREFIX}${JSON.stringify(metadata)}`,
    importLine,
    "",
    `export const appMetadata = ${JSON.stringify(metadata, null, 2)} as const;`,
    "",
    "export const systemFields = {",
    '  $id: recordId("$id"),',
    "} as const;",
    "",
    `export const fields = ${renderFieldsObject(input.schema.properties, "ROOT")} as const;`,
    "",
  ].join("\n");
};

export const readGeneratedMetadata = (
  source: string,
): GeneratedModuleMetadata | null => {
  const firstLine = source.split("\n", 1)[0] ?? "";

  if (!firstLine.startsWith(GENERATED_METADATA_PREFIX)) {
    return null;
  }

  const payload = firstLine.slice(GENERATED_METADATA_PREFIX.length);

  try {
    return JSON.parse(payload) as GeneratedModuleMetadata;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new QueryValidationError(
      `Failed to parse generated module metadata from the first line: ${payload}. ${reason}`,
    );
  }
};

export const readGeneratedMetadataFromFile = async (
  filePath: string,
): Promise<GeneratedModuleMetadata | null> => {
  const source = await readFile(filePath, "utf8");
  return readGeneratedMetadata(source);
};
