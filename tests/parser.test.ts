import { describe, it, expect } from 'vitest';
import { QueryParser } from '../src/parser';

describe('QueryParser', () => {
  describe('parseExpression', () => {
    it('should parse simple equality expression', () => {
      const lambda = (r: { Customer: string }) => r.Customer === "サイボウズ株式会社";
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'Customer',
        operator: '=',
        value: 'サイボウズ株式会社',
      });
    });

    it('should parse inequality expression', () => {
      const lambda = (r: { Status: string }) => r.Status !== "完了";
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'Status',
        operator: '!=',
        value: '完了',
      });
    });

    it('should parse greater than expression', () => {
      const lambda = (r: { Amount: number }) => r.Amount > 1000;
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'Amount',
        operator: '>',
        value: 1000,
      });
    });

    it('should parse AND expression', () => {
      const lambda = (r: { Status: string; Priority: string }) => r.Status === "進行中" && r.Priority === "高";
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        type: 'and',
        left: {
          field: 'Status',
          operator: '=',
          value: '進行中',
        },
        right: {
          field: 'Priority',
          operator: '=',
          value: '高',
        },
      });
    });

    it('should parse OR expression', () => {
      const lambda = (r: { Status: string }) => r.Status === "完了" || r.Status === "キャンセル";
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        type: 'or',
        left: {
          field: 'Status',
          operator: '=',
          value: '完了',
        },
        right: {
          field: 'Status',
          operator: '=',
          value: 'キャンセル',
        },
      });
    });

    it('should parse NOT expression', () => {
      const lambda = (r: { Status: { in: (values: string[]) => boolean } }) => !r.Status.in(["完了"]);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        type: 'not',
        expression: {
          field: 'r.Status',
          operator: 'in',
          value: ['完了'],
        },
      });
    });

    it('should parse IN expression', () => {
      const lambda = (r: { Category: { in: (values: string[]) => boolean } }) => r.Category.in(["A", "B", "C"]);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Category',
        operator: 'in',
        value: ['A', 'B', 'C'],
      });
    });

    it('should parse LIKE expression', () => {
      const lambda = (r: { Name: { like: (pattern: string) => boolean } }) => r.Name.like("田中%");
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Name',
        operator: 'like',
        value: '田中%',
      });
    });
  });
});