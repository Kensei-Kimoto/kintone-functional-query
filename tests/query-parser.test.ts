import { describe, it, expect } from 'vitest';
import { KintoneQueryParser } from '../src/query-parser';
import { QueryExpression, LogicalExpression, FunctionCall } from '../src/types';

describe('KintoneQueryParser', () => {
  const parser = new KintoneQueryParser();

  describe('基本的な条件のパース', () => {
    it('単純な等価条件をパースできる', () => {
      const result = parser.parse('Status = "Open"');
      expect(result).toEqual({
        field: 'Status',
        operator: '=',
        value: 'Open'
      });
    });

    it('数値の比較条件をパースできる', () => {
      const result = parser.parse('Priority > 5');
      expect(result).toEqual({
        field: 'Priority',
        operator: '>',
        value: 5
      });
    });

    it('日本語フィールド名をパースできる', () => {
      const result = parser.parse('担当者 = "山田太郎"');
      expect(result).toEqual({
        field: '担当者',
        operator: '=',
        value: '山田太郎'
      });
    });

    it('IN演算子をパースできる', () => {
      const result = parser.parse('Status in ("Open", "In Progress", "Pending")');
      expect(result).toEqual({
        field: 'Status',
        operator: 'in',
        value: ['Open', 'In Progress', 'Pending']
      });
    });

    it('LIKE演算子をパースできる', () => {
      const result = parser.parse('Title like "%重要%"');
      expect(result).toEqual({
        field: 'Title',
        operator: 'like',
        value: '%重要%'
      });
    });

    it('IS EMPTY演算子をパースできる', () => {
      const result = parser.parse('Description is empty');
      expect(result).toEqual({
        field: 'Description',
        operator: 'is empty',
        value: undefined
      });
    });
  });

  describe('論理演算のパース', () => {
    it('AND条件をパースできる', () => {
      const result = parser.parse('Status = "Open" and Priority > 5') as LogicalExpression;
      expect(result.type).toBe('and');
      expect(result.left).toEqual({
        field: 'Status',
        operator: '=',
        value: 'Open'
      });
      expect(result.right).toEqual({
        field: 'Priority',
        operator: '>',
        value: 5
      });
    });

    it('OR条件をパースできる', () => {
      const result = parser.parse('Status = "Open" or Status = "Pending"') as LogicalExpression;
      expect(result.type).toBe('or');
      expect(result.left).toEqual({
        field: 'Status',
        operator: '=',
        value: 'Open'
      });
      expect(result.right).toEqual({
        field: 'Status',
        operator: '=',
        value: 'Pending'
      });
    });

    it('複雑な論理演算をパースできる', () => {
      const result = parser.parse('(Status = "Open" and Priority > 5) or Assignee = "Me"') as LogicalExpression;
      expect(result.type).toBe('or');
      
      const left = result.left as LogicalExpression;
      expect(left.type).toBe('and');
      expect((left.left as QueryExpression).field).toBe('Status');
      expect((left.right as QueryExpression).field).toBe('Priority');
      
      expect((result.right as QueryExpression).field).toBe('Assignee');
    });

    it('AND/ORの優先順位を正しく処理できる', () => {
      // ANDがORより優先される
      const result = parser.parse('A = 1 or B = 2 and C = 3') as LogicalExpression;
      expect(result.type).toBe('or');
      expect((result.left as QueryExpression).field).toBe('A');
      
      const right = result.right as LogicalExpression;
      expect(right.type).toBe('and');
      expect((right.left as QueryExpression).field).toBe('B');
      expect((right.right as QueryExpression).field).toBe('C');
    });
  });

  describe('関数のパース', () => {
    it('引数なしの関数をパースできる', () => {
      const result = parser.parse('CreatedDate = TODAY()');
      expect(result).toEqual({
        field: 'CreatedDate',
        operator: '=',
        value: {
          type: 'function',
          name: 'TODAY',
          args: undefined
        }
      });
    });

    it('引数ありの関数をパースできる', () => {
      const result = parser.parse('DueDate >= FROM_TODAY(-7, "DAYS")');
      expect(result).toEqual({
        field: 'DueDate',
        operator: '>=',
        value: {
          type: 'function',
          name: 'FROM_TODAY',
          args: [-7, 'DAYS']
        }
      });
    });

    it('IN演算子内の関数をパースできる', () => {
      const result = parser.parse('Assignee in (LOGINUSER())');
      const expected = {
        field: 'Assignee',
        operator: 'in',
        value: [{
          type: 'function',
          name: 'LOGINUSER',
          args: undefined
        }]
      };
      expect(result).toEqual(expected);
    });
  });

  describe('サブテーブルのパース', () => {
    it('サブテーブルフィールドをパースできる', () => {
      const result = parser.parse('OrderItems.Quantity > 10');
      expect(result).toEqual({
        field: 'OrderItems.Quantity',
        operator: '>',
        value: 10
      });
    });

    it('日本語サブテーブルフィールドをパースできる', () => {
      const result = parser.parse('注文明細.数量 > 10');
      expect(result).toEqual({
        field: '注文明細.数量',
        operator: '>',
        value: 10
      });
    });
  });

  describe('エスケープとエッジケース', () => {
    it('ダブルクォート内のエスケープ文字を処理できる', () => {
      const result = parser.parse('Title = "He said \\"Hello\\""');
      expect(result).toEqual({
        field: 'Title',
        operator: '=',
        value: 'He said "Hello"'
      });
    });

    it('負の数値をパースできる', () => {
      const result = parser.parse('Balance < -100.5');
      expect(result).toEqual({
        field: 'Balance',
        operator: '<',
        value: -100.5
      });
    });

    it('空白を含むクエリを正しくパースできる', () => {
      const result = parser.parse('  Status   =   "Open"  ');
      expect(result).toEqual({
        field: 'Status',
        operator: '=',
        value: 'Open'
      });
    });
  });

  describe('エラーケース', () => {
    it('不正な演算子でエラーを投げる', () => {
      expect(() => parser.parse('Status == "Open"')).toThrow();
    });

    it('閉じられていない括弧でエラーを投げる', () => {
      expect(() => parser.parse('(Status = "Open"')).toThrow();
    });

    it('不正な文字列でエラーを投げる', () => {
      expect(() => parser.parse('Status = "Open')).toThrow();
    });

    it('空のクエリでnullを返す', () => {
      expect(parser.parse('')).toBeNull();
      expect(parser.parse('   ')).toBeNull();
    });
  });

  describe('実際のkintoneクエリ例', () => {
    it('複雑な実用的クエリをパースできる', () => {
      const query = '((Status = "Open" or Status = "Pending") and Priority >= 3) and DueDate <= FROM_TODAY(7, "DAYS")';
      const result = parser.parse(query) as LogicalExpression;
      
      expect(result.type).toBe('and');
      
      // 左側は ((Status = "Open" or Status = "Pending") and Priority >= 3)
      const left = result.left as LogicalExpression;
      expect(left.type).toBe('and');
      
      // 右側は DueDate <= FROM_TODAY(7, "DAYS")
      const right = result.right as QueryExpression;
      expect(right.field).toBe('DueDate');
      expect(right.operator).toBe('<=');
      expect((right.value as FunctionCall).name).toBe('FROM_TODAY');
    });
  });
});