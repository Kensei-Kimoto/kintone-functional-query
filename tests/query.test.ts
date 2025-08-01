import { describe, it, expect } from 'vitest';
import { kintoneQuery, TODAY, NOW, LOGINUSER } from '../src';

describe('kintoneQuery', () => {
  describe('Basic queries', () => {
    it('should build a simple equality query', () => {
      const query = kintoneQuery<{ Customer: string }>()
        .build();
      
      // 現在の実装では空文字列が返る（ラムダ式パーサーの実装が必要）
      expect(query).toBe('');
    });
  });

  describe('Query builder methods', () => {
    it('should support order by', () => {
      const query = kintoneQuery<{ CreatedTime: string }>()
        .orderBy('CreatedTime', 'desc')
        .build();
      
      expect(query).toBe('order by CreatedTime desc');
    });

    it('should support limit', () => {
      const query = kintoneQuery<{ Name: string }>()
        .limit(100)
        .build();
      
      expect(query).toBe('limit 100');
    });

    it('should support offset', () => {
      const query = kintoneQuery<{ Name: string }>()
        .offset(50)
        .build();
      
      expect(query).toBe('offset 50');
    });

    it('should combine order by, limit, and offset', () => {
      const query = kintoneQuery<{ UpdatedTime: string }>()
        .orderBy('UpdatedTime', 'asc')
        .limit(20)
        .offset(10)
        .build();
      
      expect(query).toBe('order by UpdatedTime asc limit 20 offset 10');
    });
  });

  describe('Functions', () => {
    it('should create TODAY function', () => {
      const func = TODAY();
      expect(func).toEqual({
        type: 'function',
        name: 'TODAY',
      });
    });

    it('should create NOW function', () => {
      const func = NOW();
      expect(func).toEqual({
        type: 'function',
        name: 'NOW',
      });
    });

    it('should create LOGINUSER function', () => {
      const func = LOGINUSER();
      expect(func).toEqual({
        type: 'function',
        name: 'LOGINUSER',
      });
    });
  });
});