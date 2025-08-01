export { QueryBuilder } from './builder';
export * from './types';
export * from './functions';
export { subTable } from './subtable-builder';
export * from './schemas';
export { Schema as S } from 'effect';
export { KintoneQueryParser } from './query-parser';

import { QueryBuilder } from './builder';
import * as functions from './functions';
import { KintoneQueryParser } from './query-parser';

export function kintoneQuery<Schema = Record<string, unknown>>(
  lambda?: ((record: Schema, funcs: typeof functions) => unknown) | (() => unknown)
): QueryBuilder<Schema> {
  return new QueryBuilder<Schema>(lambda);
}

/**
 * kintoneクエリ文字列をASTにパース
 * @param query kintoneクエリ文字列
 * @returns パースされたAST（Expression）またはnull
 */
export function parseKintoneQuery(query: string) {
  const parser = new KintoneQueryParser();
  return parser.parse(query);
}