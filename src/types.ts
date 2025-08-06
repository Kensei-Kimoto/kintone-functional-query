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
// Complete AST Schemas (Phase 3)
// ============================================

export const OrderByClauseSchema = S.Struct({
  field: S.String,
  direction: S.Literal('asc', 'desc')
});

export const CompleteQueryASTSchema = S.Struct({
  where: S.optional(ExpressionSchema),
  orderBy: S.optional(S.Array(OrderByClauseSchema)),
  limit: S.optional(
    S.Number.pipe(
      S.int(),
      S.greaterThanOrEqualTo(1),
      S.lessThanOrEqualTo(500),
      S.annotations({
        description: "kintone API limit constraint: must be between 1 and 500"
      })
    )
  ),
  offset: S.optional(
    S.Number.pipe(
      S.int(),
      S.greaterThanOrEqualTo(0),
      S.lessThanOrEqualTo(10000),
      S.annotations({
        description: "kintone API offset constraint: must be between 0 and 10000"
      })
    )
  )
});

export const ParseResultSchema = S.Struct({
  ast: CompleteQueryASTSchema,
  originalQuery: S.String
});

// ============================================
// Utility types (not schema-derived)
// ============================================

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  orderBy?: OrderByClause | OrderByClause[];
  limit?: number;
  offset?: number;
}

// ============================================
// Complete AST Types (Phase 3)
// ============================================

/**
 * Complete Query AST - represents the full structure of a kintone query
 * including WHERE clause, ORDER BY, LIMIT, and OFFSET
 */
export interface CompleteQueryAST {
  where?: Expression;
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

/**
 * Parse result containing both the AST and original query string
 */
export interface ParseResult {
  ast: CompleteQueryAST;
  originalQuery: string;
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