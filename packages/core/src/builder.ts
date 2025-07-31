import { Expression, QueryOptions, FunctionCall } from './types';
import { QueryParser } from './parser';
import * as functions from './functions';
import { escapeValue } from './escape';

export class QueryBuilder<Schema> {
  private expression: Expression | null = null;
  private options: QueryOptions = {};

  constructor(lambda?: ((record: Schema, funcs: typeof functions) => unknown) | (() => unknown)) {
    if (lambda) {
      // ラムダ関数を文字列として解析
      try {
        const parser = new QueryParser(lambda as (...args: unknown[]) => unknown);
        this.expression = parser.parse();
      } catch (error) {
        console.error('Failed to parse lambda expression:', error);
      }
    }
  }

  orderBy(field: keyof Schema, direction: 'asc' | 'desc' = 'asc'): this {
    this.options.orderBy = {
      field: String(field),
      direction,
    };
    return this;
  }

  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  offset(count: number): this {
    this.options.offset = count;
    return this;
  }

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
      queryParts.push(`order by ${this.options.orderBy.field} ${this.options.orderBy.direction}`);
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
            const args = expr.args.map(arg => String(arg)).join(', ');
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