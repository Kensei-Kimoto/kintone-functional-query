import { Expression, RecordProxy, QueryExpressionSchema } from './types';
import { Schema as S } from 'effect';
import { logValidationWarning } from './utils/logger';

/**
 * Represents a reference to a field in a kintone record.
 * Provides methods to create query expressions with type-safe validation.
 * 
 * @example
 * ```typescript
 * const fieldRef = new FieldReference('Status');
 * const expr = fieldRef.equals('Active');
 * ```
 */
export class FieldReference {
  /**
   * Creates a new FieldReference instance.
   * 
   * @param {string} fieldName - The name of the field to reference
   */
  constructor(public readonly fieldName: string) {}

  private createValidatedExpression(operator: string, value: unknown): Expression {
    const expr = {
      field: this.fieldName,
      operator,
      value,
    };

    try {
      // Validate using QueryExpressionSchema
      return S.decodeUnknownSync(QueryExpressionSchema)(expr);
    } catch (error) {
      // Log warning but return expression for backward compatibility
      logValidationWarning('Expression validation failed', error, {
        module: 'proxy',
        function: 'createValidatedExpression',
        field: this.fieldName,
        operator
      });
      return expr as Expression;
    }
  }

  /**
   * Creates an 'in' expression to check if field value is in the given array.
   * 
   * @param {unknown[]} values - Array of values to check against
   * @returns {Expression} Query expression for 'in' operator
   * 
   * @example
   * ```typescript
   * fieldRef.in(['Active', 'Pending', 'Complete'])
   * ```
   */
  in(values: unknown[]): Expression {
    return this.createValidatedExpression('in', values);
  }

  /**
   * Creates a 'not in' expression to check if field value is not in the given array.
   * 
   * @param {unknown[]} values - Array of values to exclude
   * @returns {Expression} Query expression for 'not in' operator
   * 
   * @example
   * ```typescript
   * fieldRef.notIn(['Cancelled', 'Deleted'])
   * ```
   */
  notIn(values: unknown[]): Expression {
    return this.createValidatedExpression('not in', values);
  }

  /**
   * Creates a 'like' expression for partial string matching.
   * 
   * @param {string} pattern - Pattern to match (supports wildcards)
   * @returns {Expression} Query expression for 'like' operator
   * 
   * @example
   * ```typescript
   * fieldRef.like('*test*') // Contains 'test'
   * fieldRef.like('test*')  // Starts with 'test'
   * fieldRef.like('*test')  // Ends with 'test'
   * ```
   */
  like(pattern: string): Expression {
    return this.createValidatedExpression('like', pattern);
  }

  /**
   * Creates a 'not like' expression for excluding partial matches.
   * 
   * @param {string} pattern - Pattern to exclude (supports wildcards)
   * @returns {Expression} Query expression for 'not like' operator
   * 
   * @example
   * ```typescript
   * fieldRef.notLike('*temp*') // Does not contain 'temp'
   * ```
   */
  notLike(pattern: string): Expression {
    return this.createValidatedExpression('not like', pattern);
  }

  /**
   * Creates an equality expression.
   * 
   * @param {unknown} value - Value to compare against
   * @returns {Expression} Query expression for '=' operator
   * 
   * @example
   * ```typescript
   * fieldRef.equals('Active')
   * fieldRef.equals(TODAY())
   * fieldRef.equals(42)
   * ```
   */
  equals(value: unknown): Expression {
    return this.createValidatedExpression('=', value);
  }

  /**
   * Creates a not-equal expression.
   * 
   * @param {unknown} value - Value to compare against
   * @returns {Expression} Query expression for '!=' operator
   * 
   * @example
   * ```typescript
   * fieldRef.notEquals('Deleted')
   * ```
   */
  notEquals(value: unknown): Expression {
    return this.createValidatedExpression('!=', value);
  }

  /**
   * Creates a greater-than expression.
   * 
   * @param {unknown} value - Value to compare against
   * @returns {Expression} Query expression for '>' operator
   * 
   * @example
   * ```typescript
   * fieldRef.greaterThan(100)
   * fieldRef.greaterThan(YESTERDAY())
   * ```
   */
  greaterThan(value: unknown): Expression {
    return this.createValidatedExpression('>', value);
  }

  /**
   * Creates a less-than expression.
   * 
   * @param {unknown} value - Value to compare against
   * @returns {Expression} Query expression for '<' operator
   * 
   * @example
   * ```typescript
   * fieldRef.lessThan(100)
   * fieldRef.lessThan(TOMORROW())
   * ```
   */
  lessThan(value: unknown): Expression {
    return this.createValidatedExpression('<', value);
  }

  /**
   * Creates a greater-than-or-equal expression.
   * 
   * @param {unknown} value - Value to compare against
   * @returns {Expression} Query expression for '>=' operator
   * 
   * @example
   * ```typescript
   * fieldRef.greaterThanOrEqual(0)
   * fieldRef.greaterThanOrEqual(TODAY())
   * ```
   */
  greaterThanOrEqual(value: unknown): Expression {
    return this.createValidatedExpression('>=', value);
  }

  /**
   * Creates a less-than-or-equal expression.
   * 
   * @param {unknown} value - Value to compare against
   * @returns {Expression} Query expression for '<=' operator
   * 
   * @example
   * ```typescript
   * fieldRef.lessThanOrEqual(100)
   * fieldRef.lessThanOrEqual(TODAY())
   * ```
   */
  lessThanOrEqual(value: unknown): Expression {
    return this.createValidatedExpression('<=', value);
  }

  /**
   * Creates an 'is empty' expression to check for empty fields.
   * 
   * @returns {Expression} Query expression for 'is empty' operator
   * 
   * @example
   * ```typescript
   * fieldRef.isEmpty() // Field has no value
   * ```
   */
  isEmpty(): Expression {
    return this.createValidatedExpression('is empty', null);
  }

  /**
   * Creates an 'is not empty' expression to check for non-empty fields.
   * 
   * @returns {Expression} Query expression for 'is not empty' operator
   * 
   * @example
   * ```typescript
   * fieldRef.isNotEmpty() // Field has a value
   * ```
   */
  isNotEmpty(): Expression {
    return this.createValidatedExpression('is not empty', null);
  }
}

/**
 * Creates a type-safe proxy for accessing record fields in queries.
 * Returns a proxy object that provides field access with query methods.
 * 
 * @template Schema - The type schema for the kintone application
 * @returns {RecordProxy<Schema>} A proxy object with type-safe field access
 * 
 * @example
 * ```typescript
 * interface MySchema {
 *   Status: string;
 *   Priority: number;
 *   CreatedDate: Date;
 * }
 * 
 * const record = createRecordProxy<MySchema>();
 * const expr = record.Status.equals('Active');
 * const numExpr = record.Priority.greaterThan(5);
 * ```
 */
export function createRecordProxy<Schema>(): RecordProxy<Schema> {
  return new Proxy({} as RecordProxy<Schema>, {
    get(_target, property) {
      if (typeof property === 'string') {
        const fieldRef = new FieldReference(property);
        
        // メソッドを持つオブジェクトを返す
        return {
          equals: (value: unknown) => fieldRef.equals(value),
          notEquals: (value: unknown) => fieldRef.notEquals(value),
          greaterThan: (value: unknown) => fieldRef.greaterThan(value),
          lessThan: (value: unknown) => fieldRef.lessThan(value),
          greaterThanOrEqual: (value: unknown) => fieldRef.greaterThanOrEqual(value),
          lessThanOrEqual: (value: unknown) => fieldRef.lessThanOrEqual(value),
          in: (values: unknown[]) => fieldRef.in(values),
          notIn: (values: unknown[]) => fieldRef.notIn(values),
          like: (pattern: string) => fieldRef.like(pattern),
          notLike: (pattern: string) => fieldRef.notLike(pattern),
          isEmpty: () => fieldRef.isEmpty(),
          isNotEmpty: () => fieldRef.isNotEmpty(),
        };
      }
      return undefined;
    },
  });
}