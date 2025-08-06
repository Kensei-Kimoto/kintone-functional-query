import { CompleteQueryAST } from './types';
import { parseKintoneQueryComplete, parseKintoneQueryDetailed } from './index';
import { astToQuery } from './ast-builder';

/**
 * Bidirectional Query Conversion Utilities (Phase 3)
 * 
 * Provides convenient functions for converting between kintone query strings and AST
 * representations, enabling advanced query manipulation and transformation.
 */

/**
 * Parse a kintone query string and provide conversion utilities
 * @param query kintone query string
 * @returns Conversion utility object or null if parsing fails
 * 
 * @example
 * ```typescript
 * const converter = queryConverter('Status = "Open" order by Priority desc limit 50');
 * 
 * // Access the AST
 * console.log(converter.ast.where.field); // "Status"
 * console.log(converter.ast.orderBy[0].direction); // "desc"
 * 
 * // Modify and regenerate
 * converter.ast.limit = 100;
 * const newQuery = converter.toQuery(); // "Status = "Open" order by Priority desc limit 100"
 * ```
 */
export function queryConverter(query: string) {
  let ast;
  try {
    ast = parseKintoneQueryComplete(query);
    if (!ast) return null;
  } catch (error) {
    return null; // Invalid query syntax
  }

  return {
    ast,
    originalQuery: query,

    /**
     * Convert the current AST back to a query string
     */
    toQuery(): string {
      return astToQuery(this.ast);
    },

    /**
     * Create a copy of this converter with modified AST
     * @param modifier Function to modify the AST
     */
    modify(modifier: (ast: CompleteQueryAST) => void) {
      const newAst = JSON.parse(JSON.stringify(this.ast)) as CompleteQueryAST;
      modifier(newAst);
      return queryConverter(astToQuery(newAst));
    },

    /**
     * Add or modify WHERE conditions
     * @param newWhere New WHERE clause AST
     */
    setWhere(newWhere: CompleteQueryAST['where']) {
      return this.modify(ast => {
        ast.where = newWhere;
      });
    },

    /**
     * Add or modify ORDER BY clauses
     * @param orderBy New ORDER BY clauses
     */
    setOrderBy(orderBy: CompleteQueryAST['orderBy']) {
      return this.modify(ast => {
        ast.orderBy = orderBy;
      });
    },

    /**
     * Set LIMIT value
     * @param limit New limit value (1-500)
     */
    setLimit(limit: number) {
      if (limit < 1 || limit > 500 || !Number.isInteger(limit)) {
        throw new Error(`LIMIT must be an integer between 1 and 500, got ${limit}`);
      }
      return this.modify(ast => {
        ast.limit = limit;
      });
    },

    /**
     * Set OFFSET value
     * @param offset New offset value (0-10000)
     */
    setOffset(offset: number) {
      if (offset < 0 || offset > 10000 || !Number.isInteger(offset)) {
        throw new Error(`OFFSET must be an integer between 0 and 10000, got ${offset}`);
      }
      return this.modify(ast => {
        ast.offset = offset;
      });
    },

    /**
     * Get detailed metadata about the query
     */
    getMetadata() {
      return parseKintoneQueryDetailed(this.toQuery());
    }
  };
}

/**
 * Transform a kintone query using a callback function
 * @param query Original kintone query string
 * @param transformer Function to transform the AST
 * @returns Transformed query string or null if parsing fails
 * 
 * @example
 * ```typescript
 * // Add a limit to any query
 * const newQuery = transformQuery('Status = "Open"', ast => {
 *   ast.limit = 25;
 * });
 * // Returns: 'Status = "Open" limit 25'
 * 
 * // Change sort order
 * const sortedQuery = transformQuery(
 *   'Status = "Open" order by CreatedDate asc',
 *   ast => {
 *     if (ast.orderBy) {
 *       ast.orderBy[0].direction = 'desc';
 *     }
 *   }
 * );
 * // Returns: 'Status = "Open" order by CreatedDate desc'
 * ```
 */
export function transformQuery(
  query: string, 
  transformer: (ast: CompleteQueryAST) => void
): string | null {
  try {
    const converter = queryConverter(query);
    if (!converter) return null;
    
    const modified = converter.modify(transformer);
    return modified?.toQuery() || null;
  } catch (error) {
    return null; // Invalid query syntax or transformation error
  }
}

/**
 * Combine multiple queries with AND logic
 * @param queries Array of kintone query strings
 * @returns Combined query string or null if any parsing fails
 * 
 * @example
 * ```typescript
 * const combined = combineQueries([
 *   'Status = "Open"',
 *   'Priority >= 3',
 *   'AssignedTo = LOGINUSER()'
 * ]);
 * // Returns: '((Status = "Open" and Priority >= 3) and AssignedTo = LOGINUSER())'
 * ```
 */
export function combineQueries(queries: string[]): string | null {
  if (queries.length === 0) return '';
  if (queries.length === 1) return queries[0];

  try {
    // Parse all queries first
    const asts = queries.map(q => parseKintoneQueryComplete(q));
    if (asts.some(ast => ast === null)) return null;

    // Extract WHERE clauses
    const whereExprs = asts
      .filter(ast => ast && ast.where)
      .map(ast => ast!.where!);

    if (whereExprs.length === 0) return '';

    // Combine with AND logic
    let combinedWhere = whereExprs[0];
    for (let i = 1; i < whereExprs.length; i++) {
      combinedWhere = {
        type: 'and' as const,
        left: combinedWhere,
        right: whereExprs[i]
      };
    }

    // Create new AST with combined WHERE clause
    const resultAst: CompleteQueryAST = {
      where: combinedWhere
    };

    return astToQuery(resultAst);
  } catch (error) {
    return null; // Invalid query syntax
  }
}

/**
 * Extract specific query components
 * @param query kintone query string
 * @returns Object with separated query components
 * 
 * @example
 * ```typescript
 * const components = extractQueryComponents(
 *   'Status = "Open" and Priority > 3 order by Priority desc limit 50 offset 10'
 * );
 * 
 * console.log(components.whereQuery);  // 'Status = "Open" and Priority > 3'
 * console.log(components.orderBy);     // [{ field: 'Priority', direction: 'desc' }]
 * console.log(components.limit);       // 50
 * console.log(components.offset);      // 10
 * ```
 */
export function extractQueryComponents(query: string) {
  let ast;
  try {
    ast = parseKintoneQueryComplete(query);
    if (!ast) return null;
  } catch (error) {
    return null; // Invalid query syntax
  }

  return {
    whereQuery: ast.where ? astToQuery({ where: ast.where }) : null,
    orderBy: ast.orderBy || null,
    limit: ast.limit || null,
    offset: ast.offset || null,
    
    // Convenience methods
    hasWhere: !!ast.where,
    hasOrderBy: !!(ast.orderBy && ast.orderBy.length > 0),
    hasLimit: typeof ast.limit === 'number',
    hasOffset: typeof ast.offset === 'number',
    sortFieldCount: ast.orderBy?.length || 0
  };
}