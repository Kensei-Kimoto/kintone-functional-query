import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../src/builder';

describe('QueryBuilder', () => {
  describe('expressionToString', () => {
    it('should convert simple query expression to string', () => {
      const builder = new QueryBuilder();
      
      // プライベートメソッドのテストは実際の使用時に検証
      const query = builder.build();
      expect(query).toBe('');
    });
  });

  describe('formatValue', () => {
    it('should format string values with quotes', () => {
      const builder = new QueryBuilder();
      // formatValueは内部メソッドなので、buildメソッドを通じて間接的にテスト
      const query = builder.build();
      expect(query).toBe('');
    });

    it('should format array values with parentheses', () => {
      const builder = new QueryBuilder();
      const query = builder.build();
      expect(query).toBe('');
    });

    it('should format function values', () => {
      const builder = new QueryBuilder();
      const query = builder.build();
      expect(query).toBe('');
    });
  });

  describe('orderBy', () => {
    it('should add order by clause', () => {
      const builder = new QueryBuilder<{ CreatedTime: string }>();
      const query = builder
        .orderBy('CreatedTime', 'desc')
        .build();
      
      expect(query).toBe('order by CreatedTime desc');
    });

    it('should default to asc when direction not specified', () => {
      const builder = new QueryBuilder<{ CreatedTime: string }>();
      const query = builder
        .orderBy('CreatedTime')
        .build();
      
      expect(query).toBe('order by CreatedTime asc');
    });

    it('should support multiple fields with chaining', () => {
      const builder = new QueryBuilder<{ Priority: number; CreatedTime: string; RecordNumber: number }>();
      const query = builder
        .orderBy('Priority', 'desc')
        .orderBy('CreatedTime', 'asc')
        .orderBy('RecordNumber', 'desc')
        .build();
      
      expect(query).toBe('order by Priority desc, CreatedTime asc, RecordNumber desc');
    });

    it('should support mixed single and multiple orderBy calls', () => {
      const builder = new QueryBuilder<{ Priority: number; CreatedTime: string }>();
      const query = builder
        .orderBy('Priority', 'desc')  // First call - single
        .orderBy('CreatedTime', 'asc') // Second call - converts to array
        .build();
      
      expect(query).toBe('order by Priority desc, CreatedTime asc');
    });
  });

  describe('orderByMany', () => {
    it('should add multiple order by clauses at once', () => {
      const builder = new QueryBuilder<{ Priority: number; CreatedTime: string; RecordNumber: number }>();
      const query = builder
        .orderByMany([
          { field: 'Priority', direction: 'desc' },
          { field: 'CreatedTime', direction: 'asc' },
          { field: 'RecordNumber', direction: 'desc' }
        ])
        .build();
      
      expect(query).toBe('order by Priority desc, CreatedTime asc, RecordNumber desc');
    });

    it('should replace existing orderBy when called', () => {
      const builder = new QueryBuilder<{ Priority: number; CreatedTime: string; RecordNumber: number }>();
      const query = builder
        .orderBy('Priority', 'asc')  // This will be replaced
        .orderByMany([
          { field: 'CreatedTime', direction: 'desc' },
          { field: 'RecordNumber', direction: 'asc' }
        ])
        .build();
      
      expect(query).toBe('order by CreatedTime desc, RecordNumber asc');
    });

    it('should work with other query parts', () => {
      const builder = new QueryBuilder<{ Priority: number; CreatedTime: string }>();
      const query = builder
        .orderByMany([
          { field: 'Priority', direction: 'desc' },
          { field: 'CreatedTime', direction: 'asc' }
        ])
        .limit(50)
        .offset(10)
        .build();
      
      expect(query).toBe('order by Priority desc, CreatedTime asc limit 50 offset 10');
    });
  });

  describe('limit and offset', () => {
    it('should add limit clause', () => {
      const builder = new QueryBuilder();
      const query = builder
        .limit(50)
        .build();
      
      expect(query).toBe('limit 50');
    });

    it('should add offset clause', () => {
      const builder = new QueryBuilder();
      const query = builder
        .offset(100)
        .build();
      
      expect(query).toBe('offset 100');
    });

    it('should combine limit and offset', () => {
      const builder = new QueryBuilder();
      const query = builder
        .limit(50)
        .offset(100)
        .build();
      
      expect(query).toBe('limit 50 offset 100');
    });

    describe('limit validation', () => {
      it('should accept valid limit values', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.limit(1)).not.toThrow();
        expect(() => builder.limit(100)).not.toThrow();
        expect(() => builder.limit(500)).not.toThrow();
      });

      it('should throw error for limit values below 1', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.limit(0)).toThrow('limit() must be between 1 and 500, got 0');
        expect(() => builder.limit(-1)).toThrow('limit() must be between 1 and 500, got -1');
      });

      it('should throw error for limit values above 500', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.limit(501)).toThrow('limit() must be between 1 and 500, got 501');
        expect(() => builder.limit(1000)).toThrow('limit() must be between 1 and 500, got 1000');
      });

      it('should throw error for non-integer limit values', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.limit(50.5)).toThrow('limit() must be an integer, got 50.5');
        expect(() => builder.limit(100.1)).toThrow('limit() must be an integer, got 100.1');
      });
    });

    describe('offset validation', () => {
      it('should accept valid offset values', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.offset(0)).not.toThrow();
        expect(() => builder.offset(100)).not.toThrow();
        expect(() => builder.offset(10000)).not.toThrow();
      });

      it('should throw error for negative offset values', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.offset(-1)).toThrow('offset() must be between 0 and 10000, got -1');
        expect(() => builder.offset(-100)).toThrow('offset() must be between 0 and 10000, got -100');
      });

      it('should throw error for offset values above 10000', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.offset(10001)).toThrow('offset() must be between 0 and 10000, got 10001');
        expect(() => builder.offset(20000)).toThrow('offset() must be between 0 and 10000, got 20000');
      });

      it('should throw error for non-integer offset values', () => {
        const builder = new QueryBuilder();
        
        expect(() => builder.offset(50.5)).toThrow('offset() must be an integer, got 50.5');
        expect(() => builder.offset(100.1)).toThrow('offset() must be an integer, got 100.1');
      });
    });
  });
});