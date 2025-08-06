import { CompleteQueryAST, Expression, FunctionCall } from './types';
import { escapeValue } from './escape';

/**
 * AST to Query String Generator (Phase 3: Complete Query Support)
 * 
 * Converts a CompleteQueryAST back to a kintone query string.
 * This enables bidirectional conversion between AST and query strings.
 */
export class ASTToQueryBuilder {
  /**
   * Convert CompleteQueryAST to kintone query string
   * @param ast Complete Query AST
   * @returns Generated kintone query string
   */
  static generate(ast: CompleteQueryAST): string {
    const queryParts: string[] = [];

    // WHERE clause
    if (ast.where) {
      const whereClause = this.expressionToString(ast.where);
      if (whereClause) {
        queryParts.push(whereClause);
      }
    }

    // ORDER BY clause
    if (ast.orderBy && ast.orderBy.length > 0) {
      const orderByClauses = ast.orderBy
        .map(clause => `${clause.field} ${clause.direction}`)
        .join(', ');
      queryParts.push(`order by ${orderByClauses}`);
    }

    // LIMIT clause
    if (ast.limit !== undefined) {
      queryParts.push(`limit ${ast.limit}`);
    }

    // OFFSET clause
    if (ast.offset !== undefined) {
      queryParts.push(`offset ${ast.offset}`);
    }

    return queryParts.join(' ');
  }

  /**
   * Convert Expression to string representation
   * @param expr Expression AST node
   * @returns String representation of the expression
   */
  private static expressionToString(expr: Expression): string {
    if ('field' in expr && 'operator' in expr && 'value' in expr) {
      // QueryExpression
      const field = expr.field.startsWith('r.') ? expr.field.substring(2) : expr.field;
      
      if (expr.operator === 'is empty' || expr.operator === 'is not empty') {
        // is empty / is not empty don't have values
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
            const args = expr.args.map((arg: unknown) => {
              if (typeof arg === 'string' && /^[A-Z_]+$/.test(arg)) {
                return arg; // Constants like 'DAYS' don't need quotes
              } else if (typeof arg === 'string') {
                return `"${arg}"`;
              }
              return String(arg);
            }).join(', ');
            return `${expr.name}(${args})`;
          }
          return `${expr.name}()`;
      }
    }

    return '';
  }

  /**
   * Format values for query string generation
   * @param value Value to format
   * @returns Formatted value string
   */
  private static formatValue(value: unknown): string {
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
          // Special handling for function arguments:
          // - Strings that look like constants (all caps) don't get quoted
          // - Other strings get quoted
          if (typeof arg === 'string' && /^[A-Z_]+$/.test(arg)) {
            return arg; // Constants like 'DAYS' don't need quotes
          } else if (typeof arg === 'string') {
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

  /**
   * Type guard for FunctionCall
   * @param value Value to check
   * @returns Whether value is a FunctionCall
   */
  private static isFunctionCall(value: unknown): value is FunctionCall {
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

/**
 * Convert CompleteQueryAST to kintone query string
 * @param ast Complete Query AST  
 * @returns Generated kintone query string
 * 
 * @example
 * ```typescript
 * const ast = {
 *   where: { field: 'Status', operator: '=', value: 'Open' },
 *   orderBy: [{ field: 'Priority', direction: 'desc' }],
 *   limit: 50,
 *   offset: 10
 * };
 * 
 * const query = astToQuery(ast);
 * // Returns: 'Status = "Open" order by Priority desc limit 50 offset 10'
 * ```
 */
export function astToQuery(ast: CompleteQueryAST): string {
  return ASTToQueryBuilder.generate(ast);
}