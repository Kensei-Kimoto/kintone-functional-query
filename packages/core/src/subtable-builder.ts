import { Expression } from './types';

export interface SubTableFieldMethods {
  in(values: unknown[]): Expression;
  notIn(values: unknown[]): Expression;
  greaterThan(value: unknown): Expression;
  lessThan(value: unknown): Expression;
  greaterThanOrEqual(value: unknown): Expression;
  lessThanOrEqual(value: unknown): Expression;
  like(pattern: string): Expression;
  notLike(pattern: string): Expression;
  isEmpty(): Expression;
  isNotEmpty(): Expression;
  equals(value: unknown): never;
  notEquals(value: unknown): never;
}

function createSubTableFieldMethods(tableName: string, fieldName: string): SubTableFieldMethods {
  const fullFieldName = `${tableName}.${fieldName}`;
  
  return {
    in: (values: unknown[]): Expression => ({
      field: fullFieldName,
      operator: 'in',
      value: values,
    }),
    
    notIn: (values: unknown[]): Expression => ({
      field: fullFieldName,
      operator: 'not in',
      value: values,
    }),
    
    greaterThan: (value: unknown): Expression => {
      console.warn(`警告: サブテーブルのフィールド "${fieldName}" での比較演算子の使用は制限される場合があります`);
      return {
        field: fullFieldName,
        operator: '>',
        value,
      };
    },
    
    lessThan: (value: unknown): Expression => {
      console.warn(`警告: サブテーブルのフィールド "${fieldName}" での比較演算子の使用は制限される場合があります`);
      return {
        field: fullFieldName,
        operator: '<',
        value,
      };
    },
    
    greaterThanOrEqual: (value: unknown): Expression => {
      console.warn(`警告: サブテーブルのフィールド "${fieldName}" での比較演算子の使用は制限される場合があります`);
      return {
        field: fullFieldName,
        operator: '>=',
        value,
      };
    },
    
    lessThanOrEqual: (value: unknown): Expression => {
      console.warn(`警告: サブテーブルのフィールド "${fieldName}" での比較演算子の使用は制限される場合があります`);
      return {
        field: fullFieldName,
        operator: '<=',
        value,
      };
    },
    
    like: (pattern: string): Expression => ({
      field: fullFieldName,
      operator: 'like',
      value: pattern,
    }),
    
    notLike: (pattern: string): Expression => ({
      field: fullFieldName,
      operator: 'not like',
      value: pattern,
    }),
    
    isEmpty: (): Expression => ({
      field: fullFieldName,
      operator: 'is empty',
      value: null,
    }),
    
    isNotEmpty: (): Expression => ({
      field: fullFieldName,
      operator: 'is not empty',
      value: null,
    }),
    
    equals: (): never => {
      throw new Error('equals (=) 演算子は使用できません');
    },
    
    notEquals: (): never => {
      throw new Error('notEquals (!=) 演算子は使用できません');
    },
  };
}

export type SubTableProxy<T> = {
  [K in keyof T]: SubTableFieldMethods;
};

export function subTable<T>(tableName: string): SubTableProxy<T> {
  return new Proxy({} as SubTableProxy<T>, {
    get(_target, fieldName) {
      if (typeof fieldName === 'string') {
        return createSubTableFieldMethods(tableName, fieldName);
      }
      return undefined;
    },
  });
}