export { QueryBuilder } from './builder';
export * from './types';
export * from './functions';
export * from './schemas';
export { Schema as S } from 'effect';
export { KintoneQueryParser } from './query-parser';
export { Logger, type LogContext, type LogLevel } from './utils/logger';
export { FieldReference, createRecordProxy } from './proxy';
export { ASTToQueryBuilder, astToQuery } from './ast-builder';
export { queryConverter, transformQuery, combineQueries, extractQueryComponents } from './bidirectional';

import { QueryBuilder } from './builder';
import * as functions from './functions';
import { KintoneQueryParser } from './query-parser';

export function kintoneQuery<Schema = Record<string, unknown>>(
  lambda?: ((record: Schema, funcs: typeof functions) => unknown) | (() => unknown)
): QueryBuilder<Schema> {
  return new QueryBuilder<Schema>(lambda);
}

/**
 * kintoneクエリ文字列をWHERE句にパース (レガシー互換性維持)
 * @param query kintoneクエリ文字列
 * @returns パースされたWHERE式（Expression）またはnull
 */
export function parseKintoneQuery(query: string) {
  const parser = new KintoneQueryParser();
  return parser.parse(query);
}

/**
 * kintoneクエリ文字列を完全なASTにパース (Phase 3: Complete Query Support)
 * @param query kintoneクエリ文字列
 * @returns パースされた完全なAST（CompleteQueryAST）またはnull
 */
export function parseKintoneQueryComplete(query: string) {
  const parser = new KintoneQueryParser();
  return parser.parseComplete(query);
}

/**
 * kintoneクエリ文字列をパースして詳細な結果を取得
 * @param query kintoneクエリ文字列
 * @returns パース結果とメタデータ
 */
export function parseKintoneQueryDetailed(query: string) {
  const parser = new KintoneQueryParser();
  const ast = parser.parseComplete(query);
  
  if (!ast) return null;
  
  return {
    ast,
    originalQuery: query,
    hasWhere: !!ast.where,
    hasOrderBy: !!ast.orderBy && ast.orderBy.length > 0,
    hasLimit: typeof ast.limit === 'number',
    hasOffset: typeof ast.offset === 'number',
    sortFieldCount: ast.orderBy?.length ?? 0
  };
}