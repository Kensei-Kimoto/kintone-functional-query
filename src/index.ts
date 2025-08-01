export { QueryBuilder } from './builder';
export * from './types';
export * from './functions';
export { subTable } from './subtable-builder';
export * from './schemas';
export { Schema as S } from 'effect';

import { QueryBuilder } from './builder';
import * as functions from './functions';

export function kintoneQuery<Schema = Record<string, unknown>>(
  lambda?: ((record: Schema, funcs: typeof functions) => unknown) | (() => unknown)
): QueryBuilder<Schema> {
  return new QueryBuilder<Schema>(lambda);
}