export type KintoneOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'in'
  | 'not in'
  | 'like'
  | 'not like'
  | 'is empty'
  | 'is not empty';

export type KintoneFunction = 
  | 'TODAY' 
  | 'NOW' 
  | 'YESTERDAY'
  | 'TOMORROW'
  | 'FROM_TODAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'NEXT_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'NEXT_MONTH'
  | 'THIS_YEAR'
  | 'LOGINUSER' 
  | 'PRIMARY_ORGANIZATION';

export interface QueryExpression {
  field: string;
  operator: KintoneOperator;
  value: unknown;
}

export interface LogicalExpression {
  type: 'and' | 'or';
  left: Expression;
  right: Expression;
}

export interface NotExpression {
  type: 'not';
  expression: Expression;
}

export interface FunctionCall {
  type: 'function';
  name: KintoneFunction;
  args?: unknown[];
}

export type Expression = QueryExpression | LogicalExpression | NotExpression | FunctionCall;

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