import { describe, it, expect } from 'vitest';
import { parseKintoneQueryComplete, parseKintoneQueryDetailed } from '../src/index';

describe('Complete Query Parser (Phase 3)', () => {
  describe('parseKintoneQueryComplete', () => {
    it('WHERE句のみのクエリをパースできる', () => {
      const result = parseKintoneQueryComplete('Status = "Open"');
      
      expect(result).toEqual({
        where: {
          field: 'Status',
          operator: '=',
          value: 'Open'
        }
      });
    });

    it('ORDER BY句のみのクエリをパースできる', () => {
      const result = parseKintoneQueryComplete('order by Priority desc');
      
      expect(result).toEqual({
        orderBy: [
          { field: 'Priority', direction: 'desc' }
        ]
      });
    });

    it('LIMIT句のみのクエリをパースできる', () => {
      const result = parseKintoneQueryComplete('limit 50');
      
      expect(result).toEqual({
        limit: 50
      });
    });

    it('OFFSET句のみのクエリをパースできる', () => {
      const result = parseKintoneQueryComplete('offset 100');
      
      expect(result).toEqual({
        offset: 100
      });
    });

    it('複数のORDER BY句をパースできる', () => {
      const result = parseKintoneQueryComplete('order by Priority desc, DueDate asc, Amount desc');
      
      expect(result).toEqual({
        orderBy: [
          { field: 'Priority', direction: 'desc' },
          { field: 'DueDate', direction: 'asc' },
          { field: 'Amount', direction: 'desc' }
        ]
      });
    });

    it('完全なクエリをパースできる', () => {
      const query = 'Status = "Open" and Priority > 3 order by Priority desc, DueDate asc limit 50 offset 10';
      const result = parseKintoneQueryComplete(query);
      
      expect(result).toEqual({
        where: {
          type: 'and',
          left: {
            field: 'Status',
            operator: '=',
            value: 'Open'
          },
          right: {
            field: 'Priority',
            operator: '>',
            value: 3
          }
        },
        orderBy: [
          { field: 'Priority', direction: 'desc' },
          { field: 'DueDate', direction: 'asc' }
        ],
        limit: 50,
        offset: 10
      });
    });

    it('日本語フィールド名とORDER BYをパースできる', () => {
      const query = '担当者 = "山田太郎" order by 優先度 desc, 期限 asc';
      const result = parseKintoneQueryComplete(query);
      
      expect(result).toEqual({
        where: {
          field: '担当者',
          operator: '=',
          value: '山田太郎'
        },
        orderBy: [
          { field: '優先度', direction: 'desc' },
          { field: '期限', direction: 'asc' }
        ]
      });
    });

    it('ORDER BY（デフォルトASC）をパースできる', () => {
      const result = parseKintoneQueryComplete('order by Priority, DueDate desc');
      
      expect(result).toEqual({
        orderBy: [
          { field: 'Priority', direction: 'asc' },
          { field: 'DueDate', direction: 'desc' }
        ]
      });
    });
  });

  describe('API制限検証', () => {
    it('LIMIT値が範囲外の場合エラーを投げる', () => {
      expect(() => parseKintoneQueryComplete('limit 0')).toThrow(
        'LIMIT must be an integer between 1 and 500, got 0'
      );
      expect(() => parseKintoneQueryComplete('limit 501')).toThrow(
        'LIMIT must be an integer between 1 and 500, got 501'
      );
      expect(() => parseKintoneQueryComplete('limit 50.5')).toThrow(
        'LIMIT must be an integer between 1 and 500, got 50.5'
      );
    });

    it('OFFSET値が範囲外の場合エラーを投げる', () => {
      expect(() => parseKintoneQueryComplete('offset -1')).toThrow(
        'OFFSET must be an integer between 0 and 10000, got -1'
      );
      expect(() => parseKintoneQueryComplete('offset 10001')).toThrow(
        'OFFSET must be an integer between 0 and 10000, got 10001'
      );
      expect(() => parseKintoneQueryComplete('offset 100.5')).toThrow(
        'OFFSET must be an integer between 0 and 10000, got 100.5'
      );
    });

    it('有効なLIMIT値を受け入れる', () => {
      const result1 = parseKintoneQueryComplete('limit 1');
      expect(result1?.limit).toBe(1);

      const result2 = parseKintoneQueryComplete('limit 500');
      expect(result2?.limit).toBe(500);
    });

    it('有効なOFFSET値を受け入れる', () => {
      const result1 = parseKintoneQueryComplete('offset 0');
      expect(result1?.offset).toBe(0);

      const result2 = parseKintoneQueryComplete('offset 10000');
      expect(result2?.offset).toBe(10000);
    });
  });

  describe('parseKintoneQueryDetailed', () => {
    it('詳細なメタデータを返す', () => {
      const query = 'Status = "Open" and Priority > 3 order by Priority desc, DueDate asc limit 50 offset 10';
      const result = parseKintoneQueryDetailed(query);
      
      expect(result).toEqual({
        ast: {
          where: {
            type: 'and',
            left: {
              field: 'Status',
              operator: '=',
              value: 'Open'
            },
            right: {
              field: 'Priority',
              operator: '>',
              value: 3
            }
          },
          orderBy: [
            { field: 'Priority', direction: 'desc' },
            { field: 'DueDate', direction: 'asc' }
          ],
          limit: 50,
          offset: 10
        },
        originalQuery: query,
        hasWhere: true,
        hasOrderBy: true,
        hasLimit: true,
        hasOffset: true,
        sortFieldCount: 2
      });
    });

    it('部分的なクエリのメタデータを正しく返す', () => {
      const query = 'Status = "Open" limit 25';
      const result = parseKintoneQueryDetailed(query);
      
      expect(result).toEqual({
        ast: {
          where: {
            field: 'Status',
            operator: '=',
            value: 'Open'
          },
          limit: 25
        },
        originalQuery: query,
        hasWhere: true,
        hasOrderBy: false,
        hasLimit: true,
        hasOffset: false,
        sortFieldCount: 0
      });
    });

    it('ORDER BYのみのクエリメタデータを正しく返す', () => {
      const query = 'order by Priority desc, DueDate asc, Amount desc';
      const result = parseKintoneQueryDetailed(query);
      
      expect(result).toEqual({
        ast: {
          orderBy: [
            { field: 'Priority', direction: 'desc' },
            { field: 'DueDate', direction: 'asc' },
            { field: 'Amount', direction: 'desc' }
          ]
        },
        originalQuery: query,
        hasWhere: false,
        hasOrderBy: true,
        hasLimit: false,
        hasOffset: false,
        sortFieldCount: 3
      });
    });

    it('空のクエリに対してnullを返す', () => {
      const result = parseKintoneQueryDetailed('');
      expect(result).toBeNull();
    });
  });

  describe('エラーハンドリング', () => {
    it('無効な構文でエラーを投げる', () => {
      expect(() => parseKintoneQueryComplete('Status = "Open" invalid token')).toThrow(
        'Unexpected characters at position'
      );
    });

    it('ORDER BYが不完全な場合エラーを投げる', () => {
      expect(() => parseKintoneQueryComplete('order')).toThrow(
        'Expected keyword "by"'
      );
    });

    it('LIMIT値が数値でない場合エラーを投げる', () => {
      expect(() => parseKintoneQueryComplete('limit abc')).toThrow(
        'Expected number for LIMIT'
      );
    });

    it('OFFSET値が数値でない場合エラーを投げる', () => {
      expect(() => parseKintoneQueryComplete('offset xyz')).toThrow(
        'Expected number for OFFSET'
      );
    });
  });
});