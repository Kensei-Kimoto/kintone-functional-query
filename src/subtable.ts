import { Expression } from './types';
import { FieldReference } from './proxy';

/**
 * サブテーブル用のフィールドリファレンス
 * kintoneのサブテーブルでは = や != は使えず、in/not inのみ使用可能
 */
export class SubTableFieldReference extends FieldReference {
  constructor(
    public readonly tableName: string,
    public readonly fieldName: string
  ) {
    // サブテーブルのフィールドは "テーブル名.フィールド名" の形式
    super(`${tableName}.${fieldName}`);
  }

  // サブテーブルでは = や != は使えないのでオーバーライド
  equals(_value: unknown): never {
    throw new Error(
      `サブテーブルのフィールド "${this.fieldName}" では equals (=) 演算子は使用できません。in() を使用してください。`
    );
  }

  notEquals(_value: unknown): never {
    throw new Error(
      `サブテーブルのフィールド "${this.fieldName}" では notEquals (!=) 演算子は使用できません。notIn() を使用してください。`
    );
  }

  // 比較演算子もサブテーブルでは使えない場合があるので注意喚起
  greaterThan(value: unknown): Expression {
    console.warn(
      `警告: サブテーブルのフィールド "${this.fieldName}" での比較演算子の使用は制限される場合があります。`
    );
    return super.greaterThan(value);
  }

  lessThan(value: unknown): Expression {
    console.warn(
      `警告: サブテーブルのフィールド "${this.fieldName}" での比較演算子の使用は制限される場合があります。`
    );
    return super.lessThan(value);
  }

  greaterThanOrEqual(value: unknown): Expression {
    console.warn(
      `警告: サブテーブルのフィールド "${this.fieldName}" での比較演算子の使用は制限される場合があります。`
    );
    return super.greaterThanOrEqual(value);
  }

  lessThanOrEqual(value: unknown): Expression {
    console.warn(
      `警告: サブテーブルのフィールド "${this.fieldName}" での比較演算子の使用は制限される場合があります。`
    );
    return super.lessThanOrEqual(value);
  }
}

/**
 * サブテーブル用のプロキシ
 */
export function createSubTableProxy<Fields>(tableName: string) {
  return new Proxy({} as { [K in keyof Fields]: SubTableFieldReference }, {
    get(_target, property) {
      if (typeof property === 'string') {
        const fieldRef = new SubTableFieldReference(tableName, property);
        
        return {
          in: (values: unknown[]) => fieldRef.in(values),
          notIn: (values: unknown[]) => fieldRef.notIn(values),
          like: (pattern: string) => fieldRef.like(pattern),
          notLike: (pattern: string) => fieldRef.notLike(pattern),
          isEmpty: () => fieldRef.isEmpty(),
          isNotEmpty: () => fieldRef.isNotEmpty(),
          // 以下は警告付きで使用可能
          greaterThan: (value: unknown) => fieldRef.greaterThan(value),
          lessThan: (value: unknown) => fieldRef.lessThan(value),
          greaterThanOrEqual: (value: unknown) => fieldRef.greaterThanOrEqual(value),
          lessThanOrEqual: (value: unknown) => fieldRef.lessThanOrEqual(value),
          // エラーになるメソッド
          equals: (value: unknown) => fieldRef.equals(value),
          notEquals: (value: unknown) => fieldRef.notEquals(value),
        };
      }
      return undefined;
    },
  });
}