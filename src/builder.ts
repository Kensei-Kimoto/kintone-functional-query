import { Expression, QueryOptions, FunctionCall, OrderByClause } from './types';
import { QueryParser } from './parser';
import * as functions from './functions';
import { escapeValue } from './escape';
import { Logger } from './utils/logger';

/**
 * Type-safe query builder for kintone applications.
 * Provides fluent interface for building complex queries with compile-time type checking.
 * 
 * @template Schema - The type schema for the kintone application
 * 
 * @example
 * ```typescript
 * import { QueryBuilder } from 'kintone-functional-query';
 * 
 * const builder = new QueryBuilder<MySchema>()
 *   .where(schema => schema.Status.equals('Active'))
 *   .orderBy('CreatedDate', 'desc')
 *   .limit(100);
 * 
 * const queryString = builder.build();
 * ```
 */
export class QueryBuilder<Schema> {
  private expression: Expression | null = null;
  private options: QueryOptions = {};

  /**
   * Creates a new QueryBuilder instance.
   * 
   * @param {Function} [lambda] - Optional lambda function for initial query condition
   */
  constructor(lambda?: ((record: Schema, funcs: typeof functions) => unknown) | (() => unknown)) {
    if (lambda) {
      // ラムダ関数を文字列として解析
      try {
        const parser = new QueryParser(lambda as (...args: unknown[]) => unknown);
        this.expression = parser.parse();
      } catch (error) {
        Logger.error('Failed to parse lambda expression', {
          module: 'builder',
          function: 'constructor',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Sets the ordering for query results.
   * Can be chained multiple times for multi-field sorting.
   * 
   * @param {keyof Schema} field - The field to order by
   * @param {'asc' | 'desc'} [direction='asc'] - Sort direction
   * @returns {this} The QueryBuilder instance for method chaining
   * 
   * @example
   * ```typescript
   * // Single field sort
   * builder.orderBy('CreatedDate', 'desc')
   * 
   * // Multiple field sort (chaining)
   * builder
   *   .orderBy('Priority', 'desc')
   *   .orderBy('CreatedDate', 'asc')
   * ```
   */
  orderBy(field: keyof Schema, direction: 'asc' | 'desc' = 'asc'): this {
    const newClause: OrderByClause = {
      field: String(field),
      direction,
    };
    
    if (!this.options.orderBy) {
      this.options.orderBy = newClause;
    } else if (Array.isArray(this.options.orderBy)) {
      this.options.orderBy.push(newClause);
    } else {
      // Convert single clause to array and add new clause
      this.options.orderBy = [this.options.orderBy, newClause];
    }
    
    return this;
  }

  /**
   * Sets multiple ordering clauses at once.
   * 
   * @param {OrderByClause[]} clauses - Array of order by clauses
   * @returns {this} The QueryBuilder instance for method chaining
   * 
   * @example
   * ```typescript
   * builder.orderByMany([
   *   { field: 'Priority', direction: 'desc' },
   *   { field: 'CreatedDate', direction: 'asc' },
   *   { field: 'RecordNumber', direction: 'desc' }
   * ])
   * ```
   */
  orderByMany(clauses: Array<{ field: keyof Schema; direction: 'asc' | 'desc' }>): this {
    const orderByClauses: OrderByClause[] = clauses.map(clause => ({
      field: String(clause.field),
      direction: clause.direction,
    }));
    
    this.options.orderBy = orderByClauses;
    return this;
  }

  /**
   * Sets the maximum number of records to return.
   * 
   * @param {number} count - Maximum number of records (1-500)
   * @returns {this} The QueryBuilder instance for method chaining
   * 
   * @example
   * ```typescript
   * builder.limit(100)
   * ```
   * 
   * @throws {Error} When count is outside the valid range (1-500)
   */
  limit(count: number): this {
    // Validate kintone API limits
    if (count < 1 || count > 500) {
      throw new Error(`limit() must be between 1 and 500, got ${count}. kintone API allows maximum 500 records per request.`);
    }
    
    if (!Number.isInteger(count)) {
      throw new Error(`limit() must be an integer, got ${count}.`);
    }
    
    this.options.limit = count;
    return this;
  }

  /**
   * Sets the number of records to skip.
   * 
   * @param {number} count - Number of records to skip (0-10000)
   * @returns {this} The QueryBuilder instance for method chaining
   * 
   * @example
   * ```typescript
   * builder.offset(50).limit(100) // Skip first 50, return next 100
   * ```
   * 
   * @throws {Error} When count is outside the valid range (0-10000)
   */
  offset(count: number): this {
    // Validate kintone API limits
    if (count < 0 || count > 10000) {
      throw new Error(`offset() must be between 0 and 10000, got ${count}. kintone API allows maximum offset of 10000 records.`);
    }
    
    if (!Number.isInteger(count)) {
      throw new Error(`offset() must be an integer, got ${count}.`);
    }
    
    this.options.offset = count;
    return this;
  }

  /**
   * Builds the final kintone query string.
   * 
   * @returns {string} The complete kintone query string
   * 
   * @example
   * ```typescript
   * const query = builder
   *   .where(schema => schema.Status.equals('Active'))
   *   .orderBy('CreatedDate', 'desc')
   *   .limit(100)
   *   .build();
   * // Returns: 'Status = "Active" order by CreatedDate desc limit 100'
   * ```
   */
  build(): string {
    const queryParts: string[] = [];
    
    // メインクエリ
    if (this.expression) {
      const mainQuery = this.expressionToString(this.expression);
      if (mainQuery) {
        queryParts.push(mainQuery);
      }
    }

    // ORDER BY
    if (this.options.orderBy) {
      if (Array.isArray(this.options.orderBy)) {
        const orderByClauses = this.options.orderBy
          .map(clause => `${clause.field} ${clause.direction}`)
          .join(', ');
        queryParts.push(`order by ${orderByClauses}`);
      } else {
        queryParts.push(`order by ${this.options.orderBy.field} ${this.options.orderBy.direction}`);
      }
    }

    // LIMIT
    if (this.options.limit !== undefined) {
      queryParts.push(`limit ${this.options.limit}`);
    }

    // OFFSET
    if (this.options.offset !== undefined) {
      queryParts.push(`offset ${this.options.offset}`);
    }

    return queryParts.join(' ');
  }

  private expressionToString(expr: Expression): string {
    if ('field' in expr && 'operator' in expr && 'value' in expr) {
      // QueryExpression
      // r.プレフィックスを除去
      const field = expr.field.startsWith('r.') ? expr.field.substring(2) : expr.field;
      
      if (expr.operator === 'is empty' || expr.operator === 'is not empty') {
        // is empty / is not empty は値を持たない
        return `${field} ${expr.operator}`;
      }
      const value = this.formatValue(expr.value);
      return `${field} ${expr.operator} ${value}`;
    }

    if ('type' in expr) {
      switch (expr.type) {
        case 'and':
          return `(${this.expressionToString(expr.left)} and ${this.expressionToString(expr.right)})`;
        
        case 'or':
          return `(${this.expressionToString(expr.left)} or ${this.expressionToString(expr.right)})`;
        
        case 'not':
          return `not ${this.expressionToString(expr.expression)}`;
        
        case 'function':
          if (expr.args && expr.args.length > 0) {
            const args = expr.args.map((arg: unknown) => String(arg)).join(', ');
            return `${expr.name}(${args})`;
          }
          return `${expr.name}()`;
      }
    }

    return '';
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      return `"${escapeValue(value)}"`;
    }

    if (Array.isArray(value)) {
      const items = value.map(v => this.formatValue(v));
      return `(${items.join(', ')})`;
    }

    if (this.isFunctionCall(value)) {
      if (value.args && value.args.length > 0) {
        const args = value.args.map((arg) => {
          if (typeof arg === 'string') {
            return `"${arg}"`;
          }
          return String(arg);
        }).join(', ');
        return `${value.name}(${args})`;
      }
      return `${value.name}()`;
    }

    return String(value);
  }

  private isFunctionCall(value: unknown): value is FunctionCall {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'function' &&
      'name' in value &&
      typeof value.name === 'string'
    );
  }
}