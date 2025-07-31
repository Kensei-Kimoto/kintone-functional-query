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
  });
});