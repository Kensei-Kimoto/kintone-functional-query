import { QueryValidationError } from "./errors.ts";
import type {
  CollectionCondition,
  CollectionValue,
  CompileQueryInput,
  Condition,
  EmptyCondition,
  LogicalCondition,
  OrderClause,
  PatternCondition,
  QueryValue,
} from "./conditions.ts";
import { supportsQueryFunction } from "./fields.ts";
import type { FieldDescriptor } from "./fields.ts";
import type {
  QueryFunctionArgument,
  QueryFunctionCall,
  QueryKeyword,
} from "./query-functions.ts";
import { isQueryFunctionCall } from "./query-functions.ts";

const escapeQueryString = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const validateOperatorSupported = (
  field: FieldDescriptor,
  operator: string,
): void => {
  if (field.supportedOperators.includes(operator as never)) {
    return;
  }

  throw new QueryValidationError(
    `Field "${field.code}" of kind "${field.kind}" does not support the "${operator}" operator.`,
  );
};

const isQueryKeyword = (value: unknown): value is QueryKeyword =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "keyword";

const compileFunctionArgument = (argument: QueryFunctionArgument): string => {
  if (typeof argument === "number") {
    if (!Number.isFinite(argument)) {
      throw new QueryValidationError("Query function arguments must be finite numbers.");
    }

    return String(argument);
  }

  if (typeof argument === "string") {
    return `"${escapeQueryString(argument)}"`;
  }

  if (isQueryKeyword(argument)) {
    return argument.value;
  }

  throw new QueryValidationError("Unsupported query function argument.");
};

const compileFunction = (value: QueryFunctionCall): string =>
  `${value.name}(${value.args.map(compileFunctionArgument).join(", ")})`;

const validateFunctionSupported = (
  field: FieldDescriptor,
  value: QueryValue<FieldDescriptor> | CollectionValue<FieldDescriptor>,
): void => {
  if (!isQueryFunctionCall(value)) {
    return;
  }

  if (supportsQueryFunction(field, value.name)) {
    return;
  }

  throw new QueryValidationError(
    `Field "${field.code}" of kind "${field.kind}" does not support the "${value.name}()" query function.`,
  );
};

const compileLiteralValue = (value: string | number): string => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new QueryValidationError("Numeric query values must be finite.");
    }

    return String(value);
  }

  if (typeof value === "string") {
    return `"${escapeQueryString(value)}"`;
  }

  throw new QueryValidationError("Unsupported query value.");
};

const compileScalarValue = (
  field: FieldDescriptor,
  value: QueryValue<FieldDescriptor>,
): string => {
  if (isQueryFunctionCall(value)) {
    validateFunctionSupported(field, value);
    return compileFunction(value);
  }

  if (typeof value === "string" || typeof value === "number") {
    return compileLiteralValue(value);
  }

  throw new QueryValidationError("Unsupported query value.");
};

const compileCollectionValue = (
  field: FieldDescriptor,
  value: CollectionValue<FieldDescriptor>,
): string => {
  if (isQueryFunctionCall(value)) {
    validateFunctionSupported(field, value);
    return compileFunction(value);
  }

  return value
    .map((item) => {
      if (isQueryFunctionCall(item)) {
        throw new QueryValidationError(
          "Collection operators accept either an array of literal values or a single query function.",
        );
      }

      if (typeof item === "string" || typeof item === "number") {
        return compileLiteralValue(item);
      }

      throw new QueryValidationError("Unsupported query value.");
    })
    .join(", ");
};

const compileCollectionCondition = (condition: CollectionCondition): string =>
  (validateOperatorSupported(condition.field, condition.operator),
  `${condition.field.code} ${condition.operator} (${compileCollectionValue(condition.field, condition.value)})`);

const compilePatternCondition = (condition: PatternCondition): string =>
  (validateOperatorSupported(condition.field, condition.operator),
  `${condition.field.code} ${condition.operator} ${compileScalarValue(condition.field, condition.value)}`);

const compileEmptyCondition = (condition: EmptyCondition): string =>
  (validateOperatorSupported(condition.field, condition.operator),
  `${condition.field.code} ${condition.operator} empty`);

const precedenceFor = (condition: Condition): number => {
  if (condition.kind !== "logical") {
    return 3;
  }

  return condition.operator === "or" ? 1 : 2;
};

const compileLogicalCondition = (
  condition: LogicalCondition,
  parentPrecedence: number,
): string => {
  const currentPrecedence = precedenceFor(condition);
  const joined = condition.conditions
    .map((item) => compileConditionInternal(item, currentPrecedence))
    .join(` ${condition.operator} `);

  if (currentPrecedence < parentPrecedence) {
    return `(${joined})`;
  }

  return joined;
};

const compileConditionInternal = (
  condition: Condition,
  parentPrecedence: number,
): string => {
  switch (condition.kind) {
    case "raw":
      return condition.value;
    case "comparison":
      validateOperatorSupported(condition.field, condition.operator);
      return `${condition.field.code} ${condition.operator} ${compileScalarValue(condition.field, condition.value)}`;
    case "pattern":
      return compilePatternCondition(condition);
    case "collection":
      return compileCollectionCondition(condition);
    case "empty":
      return compileEmptyCondition(condition);
    case "logical":
      return compileLogicalCondition(condition, parentPrecedence);
    default:
      throw new QueryValidationError("Unsupported condition node.");
  }
};

const validateLimit = (value: number): void => {
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new QueryValidationError("limit must be an integer between 1 and 500.");
  }
};

const validateOffset = (value: number): void => {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new QueryValidationError("offset must be an integer between 0 and 10000.");
  }
};

export const compileOrderBy = (clauses: readonly OrderClause[]): string => {
  if (clauses.length === 0) {
    throw new QueryValidationError("orderBy requires at least one clause.");
  }

  return clauses.map((clause) => `${clause.field.code} ${clause.direction}`).join(", ");
};

export const compileCondition = (condition: Condition): string =>
  compileConditionInternal(condition, 0);

export const compileQuery = (input: CompileQueryInput): string => {
  const parts: string[] = [];

  if (input.condition !== undefined) {
    parts.push(compileCondition(input.condition));
  }

  if (input.orderBy !== undefined && input.orderBy.length > 0) {
    parts.push(`order by ${compileOrderBy(input.orderBy)}`);
  }

  if (input.limit !== undefined) {
    validateLimit(input.limit);
    parts.push(`limit ${input.limit}`);
  }

  if (input.offset !== undefined) {
    validateOffset(input.offset);
    parts.push(`offset ${input.offset}`);
  }

  return parts.join(" ");
};
