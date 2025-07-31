import { describe, it, expect } from 'vitest';
import { QueryParser } from '../src/parser';
import { RecordProxy } from '../src/types';

// Test schema type
interface TestSchema {
  Customer: string;
  Status: string;
  Age: number;
  Price: number;
  Tags: string[];
  Name: string;
  Code: string;
}

describe('QueryParser with method-based approach', () => {
  describe('comparison methods', () => {
    it('should parse equals method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Customer.equals("サイボウズ株式会社");
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Customer',
        operator: '=',
        value: 'サイボウズ株式会社',
      });
    });

    it('should parse notEquals method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Status.notEquals("完了");
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Status',
        operator: '!=',
        value: '完了',
      });
    });

    it('should parse greaterThan method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Amount.greaterThan(1000);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Amount',
        operator: '>',
        value: 1000,
      });
    });

    it('should parse lessThan method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Amount.lessThan(5000);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Amount',
        operator: '<',
        value: 5000,
      });
    });
  });

  describe('in/notIn methods', () => {
    it('should parse in method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Category.in(["営業", "開発", "サポート"]);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Category',
        operator: 'in',
        value: ['営業', '開発', 'サポート'],
      });
    });

    it('should parse notIn method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Status.notIn(["完了", "キャンセル"]);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Status',
        operator: 'not in',
        value: ['完了', 'キャンセル'],
      });
    });
  });

  describe('like/notLike methods', () => {
    it('should parse like method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Name.like("田中%");
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Name',
        operator: 'like',
        value: '田中%',
      });
    });

    it('should parse notLike method', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Name.notLike("%test%");
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        field: 'r.Name',
        operator: 'not like',
        value: '%test%',
      });
    });
  });

  describe('complex expressions with methods', () => {
    it('should parse AND with method calls', () => {
      const lambda = (r: RecordProxy<TestSchema>) => r.Status.equals("進行中") && r.Priority.equals("高");
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        type: 'and',
        left: {
          field: 'r.Status',
          operator: '=',
          value: '進行中',
        },
        right: {
          field: 'r.Priority',
          operator: '=',
          value: '高',
        },
      });
    });

    it('should parse complex expression with notIn', () => {
      const lambda = (r: RecordProxy<TestSchema>) => 
        r.Customer.equals("サイボウズ株式会社") && 
        r.Status.notIn(["完了", "キャンセル"]);
      const parser = new QueryParser(lambda);
      const result = parser.parse();
      
      expect(result).toEqual({
        type: 'and',
        left: {
          field: 'r.Customer',
          operator: '=',
          value: 'サイボウズ株式会社',
        },
        right: {
          field: 'r.Status',
          operator: 'not in',
          value: ['完了', 'キャンセル'],
        },
      });
    });
  });
});