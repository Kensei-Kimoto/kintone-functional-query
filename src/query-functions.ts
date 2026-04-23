export type Weekday =
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

export type RelativePeriod = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
export type MonthBoundary = number | "LAST";

export const loginUserQueryFunctionNames = ["LOGINUSER"] as const;
export const primaryOrganizationQueryFunctionNames = ["PRIMARY_ORGANIZATION"] as const;
export const temporalQueryFunctionNames = [
  "NOW",
  "TODAY",
  "YESTERDAY",
  "TOMORROW",
  "FROM_TODAY",
  "THIS_WEEK",
  "LAST_WEEK",
  "NEXT_WEEK",
  "THIS_MONTH",
  "LAST_MONTH",
  "NEXT_MONTH",
  "THIS_YEAR",
  "LAST_YEAR",
  "NEXT_YEAR",
] as const;

export type LoginUserQueryFunctionName = (typeof loginUserQueryFunctionNames)[number];
export type PrimaryOrganizationQueryFunctionName =
  (typeof primaryOrganizationQueryFunctionNames)[number];
export type TemporalQueryFunctionName = (typeof temporalQueryFunctionNames)[number];

export type QueryFunctionName =
  | LoginUserQueryFunctionName
  | PrimaryOrganizationQueryFunctionName
  | TemporalQueryFunctionName;

export interface QueryKeyword {
  readonly kind: "keyword";
  readonly value: string;
}

export interface QueryFunctionCall<Name extends QueryFunctionName = QueryFunctionName> {
  readonly kind: "function";
  readonly name: Name;
  readonly args: readonly QueryFunctionArgument[];
}

export type QueryFunctionArgument = number | string | QueryKeyword;
export type LoginUserFunctionCall = QueryFunctionCall<LoginUserQueryFunctionName>;
export type PrimaryOrganizationFunctionCall =
  QueryFunctionCall<PrimaryOrganizationQueryFunctionName>;
export type TemporalFunctionCall = QueryFunctionCall<TemporalQueryFunctionName>;

const keyword = (value: string): QueryKeyword => ({
  kind: "keyword",
  value,
});

const createFunction = <Name extends QueryFunctionName>(
  name: Name,
  args: readonly QueryFunctionArgument[],
): QueryFunctionCall<Name> => ({
  kind: "function",
  name,
  args,
});

export const isQueryFunctionCall = (value: unknown): value is QueryFunctionCall =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "function";

const optionalWeekday = (day?: Weekday): readonly QueryFunctionArgument[] =>
  day === undefined ? [] : [keyword(day)];

const optionalMonthBoundary = (value?: MonthBoundary): readonly QueryFunctionArgument[] =>
  value === undefined ? [] : [typeof value === "number" ? value : keyword(value)];

export const loginUser = (): LoginUserFunctionCall =>
  createFunction("LOGINUSER", []);

export const primaryOrganization = (): PrimaryOrganizationFunctionCall =>
  createFunction("PRIMARY_ORGANIZATION", []);

export const now = (): TemporalFunctionCall => createFunction("NOW", []);
export const today = (): TemporalFunctionCall => createFunction("TODAY", []);
export const yesterday = (): TemporalFunctionCall => createFunction("YESTERDAY", []);
export const tomorrow = (): TemporalFunctionCall => createFunction("TOMORROW", []);

export const fromToday = (
  amount: number,
  period: RelativePeriod,
): TemporalFunctionCall => createFunction("FROM_TODAY", [amount, period]);

export const thisWeek = (day?: Weekday): TemporalFunctionCall =>
  createFunction("THIS_WEEK", optionalWeekday(day));

export const lastWeek = (day?: Weekday): TemporalFunctionCall =>
  createFunction("LAST_WEEK", optionalWeekday(day));

export const nextWeek = (day?: Weekday): TemporalFunctionCall =>
  createFunction("NEXT_WEEK", optionalWeekday(day));

export const thisMonth = (value?: MonthBoundary): TemporalFunctionCall =>
  createFunction("THIS_MONTH", optionalMonthBoundary(value));

export const lastMonth = (value?: MonthBoundary): TemporalFunctionCall =>
  createFunction("LAST_MONTH", optionalMonthBoundary(value));

export const nextMonth = (value?: MonthBoundary): TemporalFunctionCall =>
  createFunction("NEXT_MONTH", optionalMonthBoundary(value));

export const thisYear = (): TemporalFunctionCall =>
  createFunction("THIS_YEAR", []);

export const lastYear = (): TemporalFunctionCall =>
  createFunction("LAST_YEAR", []);

export const nextYear = (): TemporalFunctionCall =>
  createFunction("NEXT_YEAR", []);
