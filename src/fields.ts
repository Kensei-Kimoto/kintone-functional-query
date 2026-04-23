import {
  loginUserQueryFunctionNames,
  primaryOrganizationQueryFunctionNames,
  temporalQueryFunctionNames,
} from "./query-functions.ts";
import type { QueryFunctionName } from "./query-functions.ts";

export type QueryOperatorToken =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "in"
  | "not in"
  | "like"
  | "not like"
  | "is"
  | "is not";

export type FieldScope = "ROOT" | "SUBTABLE" | "RELATED_RECORDS";

export type FieldKind =
  | "SINGLE_LINE_TEXT"
  | "MULTI_LINE_TEXT"
  | "RICH_TEXT"
  | "LINK"
  | "NUMBER"
  | "CALC"
  | "RECORD_NUMBER"
  | "$id"
  | "DATE"
  | "DATETIME"
  | "TIME"
  | "CREATED_TIME"
  | "UPDATED_TIME"
  | "DROP_DOWN"
  | "RADIO_BUTTON"
  | "CHECK_BOX"
  | "MULTI_SELECT"
  | "USER_SELECT"
  | "ORGANIZATION_SELECT"
  | "GROUP_SELECT"
  | "CREATOR"
  | "MODIFIER"
  | "STATUS"
  | "STATUS_ASSIGNEE"
  | "CATEGORY"
  | "FILE"
  | "SUBTABLE"
  | "UNKNOWN";

export interface FieldDescriptor<
  Kind extends FieldKind = FieldKind,
  Value = unknown,
  Options extends readonly string[] | undefined = readonly string[] | undefined,
  Functions extends readonly QueryFunctionName[] = readonly QueryFunctionName[],
> {
  readonly kind: Kind;
  readonly code: string;
  readonly scope: FieldScope;
  readonly supportedOperators: readonly QueryOperatorToken[];
  readonly supportedFunctions: Functions;
  readonly options: Options;
}

export interface SubtableDescriptor<
  Fields extends Record<string, QueryField> = Record<string, QueryField>,
> {
  readonly kind: "SUBTABLE";
  readonly code: string;
  readonly fields: Fields;
}

export interface RelatedRecordsDescriptor<
  Fields extends Record<string, QueryField> = Record<string, QueryField>,
> {
  readonly kind: "RELATED_RECORDS";
  readonly code: string;
  readonly fields: Fields;
}

type NoQueryFunctions = readonly [];
type TemporalQueryFunctions = typeof temporalQueryFunctionNames;
type LoginUserQueryFunctions = typeof loginUserQueryFunctionNames;
type PrimaryOrganizationQueryFunctions = typeof primaryOrganizationQueryFunctionNames;

export type QueryField = FieldDescriptor<
  FieldKind,
  unknown,
  readonly string[] | undefined,
  readonly QueryFunctionName[]
>;

export type SingleLineTextField = FieldDescriptor<"SINGLE_LINE_TEXT", string, undefined, NoQueryFunctions>;
export type MultiLineTextField = FieldDescriptor<"MULTI_LINE_TEXT", string, undefined, NoQueryFunctions>;
export type RichTextField = FieldDescriptor<"RICH_TEXT", string, undefined, NoQueryFunctions>;
export type LinkField = FieldDescriptor<"LINK", string, undefined, NoQueryFunctions>;
export type NumberField = FieldDescriptor<"NUMBER", number, undefined, NoQueryFunctions>;
export type CalculatedField = FieldDescriptor<"CALC", number, undefined, NoQueryFunctions>;
export type RecordNumberField = FieldDescriptor<"RECORD_NUMBER", number, undefined, NoQueryFunctions>;
export type RecordIdField = FieldDescriptor<"$id", number, undefined, NoQueryFunctions>;
export type DateField = FieldDescriptor<"DATE", string, undefined, TemporalQueryFunctions>;
export type DateTimeField = FieldDescriptor<"DATETIME", string, undefined, TemporalQueryFunctions>;
export type TimeField = FieldDescriptor<"TIME", string, undefined, NoQueryFunctions>;
export type CreatedTimeField = FieldDescriptor<
  "CREATED_TIME",
  string,
  undefined,
  TemporalQueryFunctions
>;
export type UpdatedTimeField = FieldDescriptor<
  "UPDATED_TIME",
  string,
  undefined,
  TemporalQueryFunctions
>;
export type CreatorField = FieldDescriptor<"CREATOR", string, undefined, LoginUserQueryFunctions>;
export type ModifierField = FieldDescriptor<"MODIFIER", string, undefined, LoginUserQueryFunctions>;
export type UserSelectField = FieldDescriptor<"USER_SELECT", string, undefined, LoginUserQueryFunctions>;
export type OrganizationSelectField = FieldDescriptor<
  "ORGANIZATION_SELECT",
  string,
  undefined,
  PrimaryOrganizationQueryFunctions
>;
export type GroupSelectField = FieldDescriptor<"GROUP_SELECT", string, undefined, NoQueryFunctions>;
export type StatusField = FieldDescriptor<"STATUS", string, undefined, NoQueryFunctions>;
export type StatusAssigneeField = FieldDescriptor<"STATUS_ASSIGNEE", string, undefined, NoQueryFunctions>;
export type CategoryField = FieldDescriptor<"CATEGORY", string, undefined, NoQueryFunctions>;
export type AttachmentField = FieldDescriptor<"FILE", string, undefined, NoQueryFunctions>;
export type UnknownField = FieldDescriptor<"UNKNOWN", string, undefined, NoQueryFunctions>;

export type DropDownField<Options extends readonly string[] = readonly string[]> = FieldDescriptor<
  "DROP_DOWN",
  Options[number],
  Options,
  NoQueryFunctions
>;

export type RadioButtonField<Options extends readonly string[] = readonly string[]> = FieldDescriptor<
  "RADIO_BUTTON",
  Options[number],
  Options,
  NoQueryFunctions
>;

export type CheckBoxField<Options extends readonly string[] = readonly string[]> = FieldDescriptor<
  "CHECK_BOX",
  Options[number],
  Options,
  NoQueryFunctions
>;

export type MultiSelectField<Options extends readonly string[] = readonly string[]> = FieldDescriptor<
  "MULTI_SELECT",
  Options[number],
  Options,
  NoQueryFunctions
>;

export type EqualityField =
  | SingleLineTextField
  | LinkField
  | NumberField
  | CalculatedField
  | RecordNumberField
  | RecordIdField
  | DateField
  | DateTimeField
  | TimeField
  | CreatedTimeField
  | UpdatedTimeField
  | StatusField;

export type ComparisonField =
  | NumberField
  | CalculatedField
  | RecordNumberField
  | RecordIdField
  | DateField
  | DateTimeField
  | TimeField
  | CreatedTimeField
  | UpdatedTimeField;

export type OrderingField =
  | SingleLineTextField
  | LinkField
  | NumberField
  | CalculatedField
  | RecordNumberField
  | RecordIdField
  | DateField
  | DateTimeField
  | TimeField
  | CreatedTimeField
  | UpdatedTimeField;

export type PatternField =
  | SingleLineTextField
  | LinkField
  | MultiLineTextField
  | RichTextField
  | AttachmentField;

export type MembershipField =
  | SingleLineTextField
  | LinkField
  | NumberField
  | CalculatedField
  | RecordNumberField
  | RecordIdField
  | DateField
  | DateTimeField
  | TimeField
  | CreatedTimeField
  | UpdatedTimeField
  | DropDownField
  | RadioButtonField
  | CheckBoxField
  | MultiSelectField
  | CreatorField
  | ModifierField
  | UserSelectField
  | OrganizationSelectField
  | GroupSelectField
  | StatusField
  | StatusAssigneeField;

export type EmptyField = MultiLineTextField | AttachmentField;

export interface FieldFactoryOptions {
  readonly scope?: FieldScope;
}

const comparisonOperators = ["=", "!=", ">", "<", ">=", "<="] as const;
const equalityOperators = ["=", "!="] as const;
const membershipOperators = ["in", "not in"] as const;
const patternOperators = ["like", "not like"] as const;
const emptyOperators = ["is", "is not"] as const;
const noQueryFunctions = [] as const;
const operatorDisplayOrder = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "in",
  "not in",
  "like",
  "not like",
  "is",
  "is not",
] as const;

const normalizeOperators = (
  operators: readonly QueryOperatorToken[],
): readonly QueryOperatorToken[] => {
  const set = new Set<QueryOperatorToken>(operators);
  return operatorDisplayOrder.filter((operator) => set.has(operator));
};

const adjustOperatorsForScope = (
  scope: FieldScope,
  operators: readonly QueryOperatorToken[],
): readonly QueryOperatorToken[] => {
  if (scope === "ROOT") {
    return normalizeOperators(operators);
  }

  const adjusted = new Set<QueryOperatorToken>(operators);
  const hadEquality = adjusted.delete("=");
  const hadInequality = adjusted.delete("!=");

  if (hadEquality) {
    adjusted.add("in");
  }

  if (hadInequality) {
    adjusted.add("not in");
  }

  return normalizeOperators([...adjusted]);
};

const createField = <
  Kind extends FieldKind,
  Value,
  Options extends readonly string[] | undefined = undefined,
  Functions extends readonly QueryFunctionName[] = typeof noQueryFunctions,
>(
  kind: Kind,
  code: string,
  supportedOperators: readonly QueryOperatorToken[],
  supportedFunctions: Functions,
  options: Options,
  factoryOptions?: FieldFactoryOptions,
): FieldDescriptor<Kind, Value, Options, Functions> => ({
  kind,
  code,
  scope: factoryOptions?.scope ?? "ROOT",
  supportedOperators: adjustOperatorsForScope(factoryOptions?.scope ?? "ROOT", supportedOperators),
  supportedFunctions,
  options,
});

export const supportsQueryFunction = (
  field: QueryField,
  functionName: QueryFunctionName,
): boolean => field.supportedFunctions.includes(functionName);

export const text = (code: string, options?: FieldFactoryOptions): SingleLineTextField =>
  createField("SINGLE_LINE_TEXT", code, [...equalityOperators, ...membershipOperators, ...patternOperators], noQueryFunctions, undefined, options);

export const textArea = (code: string, options?: FieldFactoryOptions): MultiLineTextField =>
  createField("MULTI_LINE_TEXT", code, [...patternOperators, ...emptyOperators], noQueryFunctions, undefined, options);

export const richText = (code: string, options?: FieldFactoryOptions): RichTextField =>
  createField("RICH_TEXT", code, patternOperators, noQueryFunctions, undefined, options);

export const link = (code: string, options?: FieldFactoryOptions): LinkField =>
  createField("LINK", code, [...equalityOperators, ...membershipOperators, ...patternOperators], noQueryFunctions, undefined, options);

export const numberField = (code: string, options?: FieldFactoryOptions): NumberField =>
  createField("NUMBER", code, [...comparisonOperators, ...membershipOperators], noQueryFunctions, undefined, options);

export const calculated = (code: string, options?: FieldFactoryOptions): CalculatedField =>
  createField("CALC", code, [...comparisonOperators, ...membershipOperators], noQueryFunctions, undefined, options);

export const recordNumber = (code: string, options?: FieldFactoryOptions): RecordNumberField =>
  createField("RECORD_NUMBER", code, [...comparisonOperators, ...membershipOperators], noQueryFunctions, undefined, options);

export const recordId = (code: string, options?: FieldFactoryOptions): RecordIdField =>
  createField("$id", code, [...comparisonOperators, ...membershipOperators], noQueryFunctions, undefined, options);

export const date = (code: string, options?: FieldFactoryOptions): DateField =>
  createField("DATE", code, comparisonOperators, temporalQueryFunctionNames, undefined, options);

export const dateTime = (code: string, options?: FieldFactoryOptions): DateTimeField =>
  createField("DATETIME", code, comparisonOperators, temporalQueryFunctionNames, undefined, options);

export const time = (code: string, options?: FieldFactoryOptions): TimeField =>
  createField("TIME", code, comparisonOperators, noQueryFunctions, undefined, options);

export const createdTime = (code: string, options?: FieldFactoryOptions): CreatedTimeField =>
  createField("CREATED_TIME", code, comparisonOperators, temporalQueryFunctionNames, undefined, options);

export const updatedTime = (code: string, options?: FieldFactoryOptions): UpdatedTimeField =>
  createField("UPDATED_TIME", code, comparisonOperators, temporalQueryFunctionNames, undefined, options);

export const creator = (code: string, options?: FieldFactoryOptions): CreatorField =>
  createField("CREATOR", code, membershipOperators, loginUserQueryFunctionNames, undefined, options);

export const modifier = (code: string, options?: FieldFactoryOptions): ModifierField =>
  createField("MODIFIER", code, membershipOperators, loginUserQueryFunctionNames, undefined, options);

export const userSelect = (code: string, options?: FieldFactoryOptions): UserSelectField =>
  createField("USER_SELECT", code, membershipOperators, loginUserQueryFunctionNames, undefined, options);

export const organizationSelect = (code: string, options?: FieldFactoryOptions): OrganizationSelectField =>
  createField("ORGANIZATION_SELECT", code, membershipOperators, primaryOrganizationQueryFunctionNames, undefined, options);

export const groupSelect = (code: string, options?: FieldFactoryOptions): GroupSelectField =>
  createField("GROUP_SELECT", code, membershipOperators, noQueryFunctions, undefined, options);

export const status = (code: string, options?: FieldFactoryOptions): StatusField =>
  createField("STATUS", code, [...equalityOperators, ...membershipOperators], noQueryFunctions, undefined, options);

export const statusAssignee = (code: string, options?: FieldFactoryOptions): StatusAssigneeField =>
  createField("STATUS_ASSIGNEE", code, membershipOperators, noQueryFunctions, undefined, options);

export const category = (code: string, options?: FieldFactoryOptions): CategoryField =>
  createField("CATEGORY", code, [], noQueryFunctions, undefined, options);

export const attachment = (code: string, options?: FieldFactoryOptions): AttachmentField =>
  createField("FILE", code, [...patternOperators, ...emptyOperators], noQueryFunctions, undefined, options);

export const dropDown = <const Options extends readonly string[]>(
  code: string,
  choiceOptions: Options,
  options?: FieldFactoryOptions,
): DropDownField<Options> =>
  createField("DROP_DOWN", code, membershipOperators, noQueryFunctions, choiceOptions, options);

export const radioButton = <const Options extends readonly string[]>(
  code: string,
  choiceOptions: Options,
  options?: FieldFactoryOptions,
): RadioButtonField<Options> =>
  createField("RADIO_BUTTON", code, membershipOperators, noQueryFunctions, choiceOptions, options);

export const checkBox = <const Options extends readonly string[]>(
  code: string,
  choiceOptions: Options,
  options?: FieldFactoryOptions,
): CheckBoxField<Options> =>
  createField("CHECK_BOX", code, membershipOperators, noQueryFunctions, choiceOptions, options);

export const multiSelect = <const Options extends readonly string[]>(
  code: string,
  choiceOptions: Options,
  options?: FieldFactoryOptions,
): MultiSelectField<Options> =>
  createField("MULTI_SELECT", code, membershipOperators, noQueryFunctions, choiceOptions, options);

export const unknownField = (
  code: string,
  _originalKind: string,
  options?: FieldFactoryOptions,
): UnknownField => createField("UNKNOWN", code, [], noQueryFunctions, undefined, options);

export const subtable = <const Fields extends Record<string, QueryField>>(
  code: string,
  fields: Fields,
): SubtableDescriptor<Fields> => ({
  kind: "SUBTABLE",
  code,
  fields,
});

export const relatedRecords = <const Fields extends Record<string, QueryField>>(
  code: string,
  fields: Fields,
): RelatedRecordsDescriptor<Fields> => ({
  kind: "RELATED_RECORDS",
  code,
  fields,
});
