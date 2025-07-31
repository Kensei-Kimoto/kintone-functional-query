import { Expression, RecordProxy } from './types';

export class FieldReference {
  constructor(public readonly fieldName: string) {}

  in(values: unknown[]): Expression {
    return {
      field: this.fieldName,
      operator: 'in',
      value: values,
    };
  }

  notIn(values: unknown[]): Expression {
    return {
      field: this.fieldName,
      operator: 'not in',
      value: values,
    };
  }

  like(pattern: string): Expression {
    return {
      field: this.fieldName,
      operator: 'like',
      value: pattern,
    };
  }

  notLike(pattern: string): Expression {
    return {
      field: this.fieldName,
      operator: 'not like',
      value: pattern,
    };
  }

  equals(value: unknown): Expression {
    return {
      field: this.fieldName,
      operator: '=',
      value,
    };
  }

  notEquals(value: unknown): Expression {
    return {
      field: this.fieldName,
      operator: '!=',
      value,
    };
  }

  greaterThan(value: unknown): Expression {
    return {
      field: this.fieldName,
      operator: '>',
      value,
    };
  }

  lessThan(value: unknown): Expression {
    return {
      field: this.fieldName,
      operator: '<',
      value,
    };
  }

  greaterThanOrEqual(value: unknown): Expression {
    return {
      field: this.fieldName,
      operator: '>=',
      value,
    };
  }

  lessThanOrEqual(value: unknown): Expression {
    return {
      field: this.fieldName,
      operator: '<=',
      value,
    };
  }

  isEmpty(): Expression {
    return {
      field: this.fieldName,
      operator: 'is empty',
      value: null,
    };
  }

  isNotEmpty(): Expression {
    return {
      field: this.fieldName,
      operator: 'is not empty',
      value: null,
    };
  }
}

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