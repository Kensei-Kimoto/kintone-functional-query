import { QueryValidationError } from "./errors.ts";
import type {
  ComparisonField,
  EmptyField,
  EqualityField,
  FieldDescriptor,
  MembershipField,
  OrderingField,
  PatternField,
  QueryOperatorToken,
} from "./fields.ts";
import { isQueryFunctionCall } from "./query-functions.ts";
import type { QueryFunctionCall } from "./query-functions.ts";

type AnyFieldDescriptor = FieldDescriptor<any, any, any, any>;

type FieldValue<Field extends AnyFieldDescriptor> = Field extends FieldDescriptor<any, infer Value, any, any>
  ? Value
  : never;

type SupportedFunctionNames<Field extends AnyFieldDescriptor> =
  Field extends FieldDescriptor<any, any, any, infer Functions> ? Functions[number] : never;

type QueryFunctionValue<Field extends AnyFieldDescriptor> = [SupportedFunctionNames<Field>] extends [
  never,
]
  ? never
  : QueryFunctionCall<SupportedFunctionNames<Field>>;

export type QueryValue<Field extends AnyFieldDescriptor = AnyFieldDescriptor> =
  | FieldValue<Field>
  | QueryFunctionValue<Field>;

export type CollectionValue<Field extends AnyFieldDescriptor> =
  | readonly FieldValue<Field>[]
  | QueryFunctionValue<Field>;

export interface RawCondition {
  readonly kind: "raw";
  readonly value: string;
}

export interface ComparisonCondition<Field extends EqualityField = EqualityField> {
  readonly kind: "comparison";
  readonly operator: "=" | "!=" | ">" | "<" | ">=" | "<=";
  readonly field: Field;
  readonly value: QueryValue<Field>;
}

export interface PatternCondition<Field extends PatternField = PatternField> {
  readonly kind: "pattern";
  readonly operator: "like" | "not like";
  readonly field: Field;
  readonly value: string;
}

export interface CollectionCondition<Field extends MembershipField = MembershipField> {
  readonly kind: "collection";
  readonly operator: "in" | "not in";
  readonly field: Field;
  readonly value: CollectionValue<Field>;
}

export interface EmptyCondition<Field extends EmptyField = EmptyField> {
  readonly kind: "empty";
  readonly operator: "is" | "is not";
  readonly field: Field;
}

export interface LogicalCondition {
  readonly kind: "logical";
  readonly operator: "and" | "or";
  readonly conditions: readonly Condition[];
}

export type Condition =
  | RawCondition
  | ComparisonCondition
  | PatternCondition
  | CollectionCondition
  | EmptyCondition
  | LogicalCondition;

export interface OrderClause<Field extends OrderingField = OrderingField> {
  readonly field: Field;
  readonly direction: "asc" | "desc";
}

export interface CompileQueryInput {
  readonly condition?: Condition;
  readonly orderBy?: readonly OrderClause[];
  readonly limit?: number;
  readonly offset?: number;
}

const assertOperatorSupported = (
  field: AnyFieldDescriptor,
  operator: QueryOperatorToken,
): void => {
  if (field.supportedOperators.includes(operator)) {
    return;
  }

  throw new QueryValidationError(
    `Field "${field.code}" of kind "${field.kind}" does not support the "${operator}" operator.`,
  );
};

const assertFunctionSupported = (
  field: AnyFieldDescriptor,
  value: QueryValue<AnyFieldDescriptor> | CollectionValue<AnyFieldDescriptor>,
): void => {
  if (!isQueryFunctionCall(value)) {
    return;
  }

  if (field.supportedFunctions.includes(value.name)) {
    return;
  }

  throw new QueryValidationError(
    `Field "${field.code}" of kind "${field.kind}" does not support the "${value.name}()" query function.`,
  );
};

const assertNonEmptyCollection = (value: CollectionValue<AnyFieldDescriptor>): void => {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length === 0) {
    throw new QueryValidationError("Collection operators require at least one value.");
  }
};

const assertCollectionValueSupported = (
  field: AnyFieldDescriptor,
  value: CollectionValue<AnyFieldDescriptor>,
): void => {
  if (!Array.isArray(value)) {
    assertFunctionSupported(field, value);
    return;
  }

  for (const item of value) {
    if (isQueryFunctionCall(item)) {
      throw new QueryValidationError(
        "Collection operators accept either an array of literal values or a single query function.",
      );
    }
  }
};

const comparison = <Field extends EqualityField>(
  operator: ComparisonCondition<Field>["operator"],
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => {
  assertOperatorSupported(field, operator);
  assertFunctionSupported(field, value);
  return {
    kind: "comparison",
    operator,
    field,
    value,
  };
};

const pattern = <Field extends PatternField>(
  operator: PatternCondition<Field>["operator"],
  field: Field,
  value: string,
): PatternCondition<Field> => {
  assertOperatorSupported(field, operator);
  return {
    kind: "pattern",
    operator,
    field,
    value,
  };
};

const collection = <Field extends MembershipField>(
  operator: CollectionCondition<Field>["operator"],
  field: Field,
  value: CollectionValue<Field>,
): CollectionCondition<Field> => {
  assertOperatorSupported(field, operator);
  assertNonEmptyCollection(value);
  assertCollectionValueSupported(field, value);

  return {
    kind: "collection",
    operator,
    field,
    value,
  };
};

export const equals = <Field extends EqualityField>(
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => comparison("=", field, value);

export const notEquals = <Field extends EqualityField>(
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => comparison("!=", field, value);

export const greaterThan = <Field extends ComparisonField>(
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => comparison(">", field, value);

export const greaterThanOrEqual = <Field extends ComparisonField>(
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => comparison(">=", field, value);

export const lessThan = <Field extends ComparisonField>(
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => comparison("<", field, value);

export const lessThanOrEqual = <Field extends ComparisonField>(
  field: Field,
  value: QueryValue<Field>,
): ComparisonCondition<Field> => comparison("<=", field, value);

export const contains = <Field extends PatternField>(
  field: Field,
  value: string,
): PatternCondition<Field> => pattern("like", field, value);

export const doesNotContain = <Field extends PatternField>(
  field: Field,
  value: string,
): PatternCondition<Field> => pattern("not like", field, value);

export const isIn = <Field extends MembershipField>(
  field: Field,
  value: CollectionValue<Field>,
): CollectionCondition<Field> => collection("in", field, value);

export const isNotIn = <Field extends MembershipField>(
  field: Field,
  value: CollectionValue<Field>,
): CollectionCondition<Field> => collection("not in", field, value);

export const isEmpty = <Field extends EmptyField>(field: Field): EmptyCondition<Field> => {
  assertOperatorSupported(field, "is");
  return {
    kind: "empty",
    operator: "is",
    field,
  };
};

export const isNotEmpty = <Field extends EmptyField>(field: Field): EmptyCondition<Field> => {
  assertOperatorSupported(field, "is not");
  return {
    kind: "empty",
    operator: "is not",
    field,
  };
};

const compactLogicalConditions = (conditions: readonly Condition[]): readonly Condition[] => conditions;

export const and = (...conditions: readonly Condition[]): Condition => {
  if (conditions.length === 0) {
    throw new QueryValidationError("and() requires at least one condition.");
  }

  if (conditions.length === 1) {
    return conditions[0]!;
  }

  return {
    kind: "logical",
    operator: "and",
    conditions: compactLogicalConditions(conditions),
  };
};

export const or = (...conditions: readonly Condition[]): Condition => {
  if (conditions.length === 0) {
    throw new QueryValidationError("or() requires at least one condition.");
  }

  if (conditions.length === 1) {
    return conditions[0]!;
  }

  return {
    kind: "logical",
    operator: "or",
    conditions: compactLogicalConditions(conditions),
  };
};

export const rawCondition = (value: string): RawCondition => {
  if (value.trim().length === 0) {
    throw new QueryValidationError("rawCondition() requires a non-empty string.");
  }

  return {
    kind: "raw",
    value,
  };
};

export const ascending = <Field extends OrderingField>(field: Field): OrderClause<Field> => ({
  field,
  direction: "asc",
});

export const descending = <Field extends OrderingField>(field: Field): OrderClause<Field> => ({
  field,
  direction: "desc",
});
