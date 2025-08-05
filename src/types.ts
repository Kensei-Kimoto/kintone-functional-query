import { Schema as S } from 'effect';

// ============================================
// Effect-TS Schemas (Single Source of Truth)
// ============================================
export const KintoneOperatorSchema = S.Literal(
  '=', '!=', '>', '<', '>=', '<=',
  'in', 'not in', 'like', 'not like',
  'is empty', 'is not empty'
);

export const KintoneFunctionSchema = S.Literal(
  'TODAY', 'NOW', 'YESTERDAY', 'TOMORROW', 'FROM_TODAY',
  'THIS_WEEK', 'LAST_WEEK', 'NEXT_WEEK',
  'THIS_MONTH', 'LAST_MONTH', 'NEXT_MONTH', 'THIS_YEAR',
  'LOGINUSER', 'PRIMARY_ORGANIZATION'
);

export const FunctionCallSchema = S.Struct({
  type: S.Literal('function'),
  name: KintoneFunctionSchema,
  args: S.optional(S.Array(S.Unknown))
});


export const QueryExpressionSchema = S.transform(
  S.Struct({
    field: S.String,
    operator: KintoneOperatorSchema,
    value: S.Unknown
  }),
  S.Struct({
    field: S.String,
    operator: KintoneOperatorSchema,
    value: S.Unknown
  }),
  {
    decode: (input) => {
      // 演算子に応じた値の検証
      const { operator, value } = input;
      
      if (operator === 'in' || operator === 'not in') {
        // 配列またはFunctionCallが必要
        if (!Array.isArray(value) && (typeof value !== 'object' || value === null || !('type' in value) || value.type !== 'function')) {
          throw new Error(`Operator "${operator}" requires an array or FunctionCall, got ${typeof value}`);
        }
      } else if (operator === 'is empty' || operator === 'is not empty') {
        // nullまたはundefinedが必要
        if (value !== null && value !== undefined) {
          throw new Error(`Operator "${operator}" requires null or undefined value, got ${typeof value}`);
        }
      } else if (operator === 'like' || operator === 'not like') {
        // 文字列が必要
        if (typeof value !== 'string') {
          throw new Error(`Operator "${operator}" requires string value, got ${typeof value}`);
        }
      }
      
      return input;
    },
    encode: (output) => output
  }
);

// ============================================
// Manual Type Definitions (Circular Reference Support)
// ============================================

export interface LogicalExpression {
  type: 'and' | 'or';
  left: Expression;
  right: Expression;
}

export interface NotExpression {
  type: 'not';
  expression: Expression;
}

export type Expression = QueryExpression | LogicalExpression | NotExpression | FunctionCall;

// ============================================
// Schemas (Circular Reference Resolution)
// ============================================

/**
 * LogicalExpression schema with minimal type assertion.
 * 
 * Note: Type assertion is necessary due to TypeScript's circular reference limitations.
 * The manual LogicalExpression interface above ensures type safety at compile time,
 * while this schema provides runtime validation. Both are manually verified to match.
 */
export const LogicalExpressionSchema: S.Schema<LogicalExpression> = S.Struct({
  type: S.Literal('and', 'or'),
  left: S.suspend((): S.Schema<Expression> => ExpressionSchema as S.Schema<Expression>),
  right: S.suspend((): S.Schema<Expression> => ExpressionSchema as S.Schema<Expression>)
}) as S.Schema<LogicalExpression>;

/**
 * NotExpression schema with minimal type assertion.
 * 
 * Note: Type assertion is necessary due to TypeScript's circular reference limitations.
 * The manual NotExpression interface above ensures type safety at compile time,
 * while this schema provides runtime validation. Both are manually verified to match.
 */
export const NotExpressionSchema: S.Schema<NotExpression> = S.Struct({
  type: S.Literal('not'),
  expression: S.suspend((): S.Schema<Expression> => ExpressionSchema as S.Schema<Expression>)
}) as S.Schema<NotExpression>;

/**
 * Expression schema (union of all expression types).
 * 
 * Note: Type assertion is necessary due to TypeScript's circular reference limitations.
 * The manual Expression type above ensures type safety at compile time,
 * while this schema provides runtime validation. Both are manually verified to match.
 */
export const ExpressionSchema: S.Schema<Expression> = S.Union(
  QueryExpressionSchema,
  LogicalExpressionSchema,
  NotExpressionSchema,
  FunctionCallSchema
) as S.Schema<Expression>;

// ============================================
// Schema-derived Types (Non-circular)
// ============================================

export type KintoneOperator = S.Schema.Type<typeof KintoneOperatorSchema>;
export type KintoneFunction = S.Schema.Type<typeof KintoneFunctionSchema>;
export type FunctionCall = S.Schema.Type<typeof FunctionCallSchema>;
export type QueryExpression = S.Schema.Type<typeof QueryExpressionSchema>;

// ============================================
// Utility types (not schema-derived)
// ============================================

export interface QueryOptions {
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  offset?: number;
}

export interface FieldMethods<T> {
  equals(value: T): boolean;
  notEquals(value: T): boolean;
  greaterThan(value: T): boolean;
  lessThan(value: T): boolean;
  greaterThanOrEqual(value: T): boolean;
  lessThanOrEqual(value: T): boolean;
  in(values: T[]): boolean;
  notIn(values: T[]): boolean;
  isEmpty(): boolean;
  isNotEmpty(): boolean;
}

export interface StringFieldMethods extends FieldMethods<string> {
  like(pattern: string): boolean;
  notLike(pattern: string): boolean;
}

export type FieldProxy<T> = T extends string 
  ? StringFieldMethods
  : T extends number 
  ? FieldMethods<T>
  : FieldMethods<T>;

export type RecordProxy<Schema> = {
  [K in keyof Schema]: Schema[K] extends Record<string, unknown> 
    ? SubTableProxy<Schema[K]>
    : FieldProxy<Schema[K]>;
};

export type SubTableProxy<Fields> = {
  [K in keyof Fields]: SubTableFieldMethods<Fields[K]>;
};

export interface SubTableFieldMethods<T> {
  in(values: T[]): boolean;
  notIn(values: T[]): boolean;
  greaterThan(value: T): boolean;
  lessThan(value: T): boolean;
  greaterThanOrEqual(value: T): boolean;
  lessThanOrEqual(value: T): boolean;
  isEmpty(): boolean;
  isNotEmpty(): boolean;
}

export interface SubTableStringFieldMethods extends SubTableFieldMethods<string> {
  like(pattern: string): boolean;
  notLike(pattern: string): boolean;
}