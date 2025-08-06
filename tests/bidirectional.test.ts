import { describe, it, expect } from 'vitest';
import { 
  queryConverter, 
  transformQuery, 
  combineQueries, 
  extractQueryComponents 
} from '../src/bidirectional';

describe('Bidirectional Query Conversion (Phase 3)', () => {
  describe('queryConverter', () => {
    it('基本的なクエリを変換できる', () => {
      const converter = queryConverter('Status = "Open" order by Priority desc limit 50');
      
      expect(converter).not.toBeNull();
      expect(converter!.ast.where).toEqual({
        field: 'Status',
        operator: '=',
        value: 'Open'
      });
      expect(converter!.ast.orderBy).toEqual([
        { field: 'Priority', direction: 'desc' }
      ]);
      expect(converter!.ast.limit).toBe(50);
      expect(converter!.originalQuery).toBe('Status = "Open" order by Priority desc limit 50');
    });

    it('toQuery()でクエリ文字列に戻せる', () => {
      const converter = queryConverter('Status = "Open" limit 25');
      const query = converter!.toQuery();
      expect(query).toBe('Status = "Open" limit 25');
    });

    it('modify()でASTを変更できる', () => {
      const converter = queryConverter('Status = "Open" limit 25');
      const modified = converter!.modify(ast => {
        ast.limit = 50;
        ast.offset = 10;
      });
      
      expect(modified!.toQuery()).toBe('Status = "Open" limit 50 offset 10');
    });

    it('setWhere()でWHERE句を変更できる', () => {
      const converter = queryConverter('Status = "Open" limit 25');
      const modified = converter!.setWhere({
        field: 'Priority',
        operator: '>',
        value: 3
      });
      
      expect(modified!.toQuery()).toBe('Priority > 3 limit 25');
    });

    it('setOrderBy()でORDER BY句を変更できる', () => {
      const converter = queryConverter('Status = "Open"');
      const modified = converter!.setOrderBy([
        { field: 'Priority', direction: 'desc' },
        { field: 'DueDate', direction: 'asc' }
      ]);
      
      expect(modified!.toQuery()).toBe('Status = "Open" order by Priority desc, DueDate asc');
    });

    it('setLimit()でLIMIT値を変更できる', () => {
      const converter = queryConverter('Status = "Open"');
      const modified = converter!.setLimit(100);
      
      expect(modified!.toQuery()).toBe('Status = "Open" limit 100');
    });

    it('setOffset()でOFFSET値を変更できる', () => {
      const converter = queryConverter('Status = "Open"');
      const modified = converter!.setOffset(50);
      
      expect(modified!.toQuery()).toBe('Status = "Open" offset 50');
    });

    it('setLimit()でAPI制限チェックを行う', () => {
      const converter = queryConverter('Status = "Open"');
      
      expect(() => converter!.setLimit(0)).toThrow('LIMIT must be an integer between 1 and 500');
      expect(() => converter!.setLimit(501)).toThrow('LIMIT must be an integer between 1 and 500');
      expect(() => converter!.setLimit(50.5)).toThrow('LIMIT must be an integer between 1 and 500');
    });

    it('setOffset()でAPI制限チェックを行う', () => {
      const converter = queryConverter('Status = "Open"');
      
      expect(() => converter!.setOffset(-1)).toThrow('OFFSET must be an integer between 0 and 10000');
      expect(() => converter!.setOffset(10001)).toThrow('OFFSET must be an integer between 0 and 10000');
      expect(() => converter!.setOffset(100.5)).toThrow('OFFSET must be an integer between 0 and 10000');
    });

    it('getMetadata()で詳細情報を取得できる', () => {
      const converter = queryConverter('Status = "Open" and Priority > 3 order by Priority desc limit 50');
      const metadata = converter!.getMetadata();
      
      expect(metadata).not.toBeNull();
      expect(metadata!.hasWhere).toBe(true);
      expect(metadata!.hasOrderBy).toBe(true);
      expect(metadata!.hasLimit).toBe(true);
      expect(metadata!.hasOffset).toBe(false);
      expect(metadata!.sortFieldCount).toBe(1);
    });

    it('無効なクエリに対してnullを返す', () => {
      const converter = queryConverter('invalid query syntax');
      expect(converter).toBeNull();
    });
  });

  describe('transformQuery', () => {
    it('クエリにLIMITを追加できる', () => {
      const result = transformQuery('Status = "Open"', ast => {
        ast.limit = 25;
      });
      
      expect(result).toBe('Status = "Open" limit 25');
    });

    it('ORDER BYの方向を変更できる', () => {
      const result = transformQuery('Status = "Open" order by CreatedDate asc', ast => {
        if (ast.orderBy && ast.orderBy.length > 0) {
          ast.orderBy[0].direction = 'desc';
        }
      });
      
      expect(result).toBe('Status = "Open" order by CreatedDate desc');
    });

    it('複数の変更を同時に行える', () => {
      const result = transformQuery('Status = "Open"', ast => {
        ast.orderBy = [{ field: 'Priority', direction: 'desc' }];
        ast.limit = 100;
        ast.offset = 20;
      });
      
      expect(result).toBe('Status = "Open" order by Priority desc limit 100 offset 20');
    });

    it('無効なクエリに対してnullを返す', () => {
      const result = transformQuery('invalid syntax', ast => {
        ast.limit = 25;
      });
      
      expect(result).toBeNull();
    });
  });

  describe('combineQueries', () => {
    it('複数のクエリをANDで結合できる', () => {
      const result = combineQueries([
        'Status = "Open"',
        'Priority >= 3',
        'AssignedTo = LOGINUSER()'
      ]);
      
      expect(result).toBe('((Status = "Open" and Priority >= 3) and AssignedTo = LOGINUSER())');
    });

    it('単一のクエリをそのまま返す', () => {
      const result = combineQueries(['Status = "Open"']);
      expect(result).toBe('Status = "Open"');
    });

    it('空配列に対して空文字列を返す', () => {
      const result = combineQueries([]);
      expect(result).toBe('');
    });

    it('2つのクエリを結合できる', () => {
      const result = combineQueries([
        'Status = "Open"',
        'Priority > 3'
      ]);
      
      expect(result).toBe('(Status = "Open" and Priority > 3)');
    });

    it('WHERE句がないクエリは無視される', () => {
      const result = combineQueries([
        'Status = "Open"',
        'limit 50',  // WHERE clause がない
        'Priority > 3'
      ]);
      
      expect(result).toBe('(Status = "Open" and Priority > 3)');
    });

    it('すべてのクエリにWHERE句がない場合は空文字列を返す', () => {
      const result = combineQueries([
        'limit 50',
        'order by Priority desc'
      ]);
      
      expect(result).toBe('');
    });

    it('無効なクエリが含まれている場合nullを返す', () => {
      const result = combineQueries([
        'Status = "Open"',
        'invalid syntax',
        'Priority > 3'
      ]);
      
      expect(result).toBeNull();
    });

    it('日本語フィールド名のクエリも結合できる', () => {
      const result = combineQueries([
        '担当者 = "山田太郎"',
        '優先度 >= 3'
      ]);
      
      expect(result).toBe('(担当者 = "山田太郎" and 優先度 >= 3)');
    });
  });

  describe('extractQueryComponents', () => {
    it('完全なクエリの各コンポーネントを抽出できる', () => {
      const components = extractQueryComponents(
        'Status = "Open" and Priority > 3 order by Priority desc, DueDate asc limit 50 offset 10'
      );
      
      expect(components).not.toBeNull();
      expect(components!.whereQuery).toBe('(Status = "Open" and Priority > 3)');
      expect(components!.orderBy).toEqual([
        { field: 'Priority', direction: 'desc' },
        { field: 'DueDate', direction: 'asc' }
      ]);
      expect(components!.limit).toBe(50);
      expect(components!.offset).toBe(10);
      expect(components!.hasWhere).toBe(true);
      expect(components!.hasOrderBy).toBe(true);
      expect(components!.hasLimit).toBe(true);
      expect(components!.hasOffset).toBe(true);
      expect(components!.sortFieldCount).toBe(2);
    });

    it('WHERE句のみのクエリを処理できる', () => {
      const components = extractQueryComponents('Status = "Open"');
      
      expect(components).not.toBeNull();
      expect(components!.whereQuery).toBe('Status = "Open"');
      expect(components!.orderBy).toBeNull();
      expect(components!.limit).toBeNull();
      expect(components!.offset).toBeNull();
      expect(components!.hasWhere).toBe(true);
      expect(components!.hasOrderBy).toBe(false);
      expect(components!.hasLimit).toBe(false);
      expect(components!.hasOffset).toBe(false);
      expect(components!.sortFieldCount).toBe(0);
    });

    it('ORDER BYのみのクエリを処理できる', () => {
      const components = extractQueryComponents('order by Priority desc, DueDate asc');
      
      expect(components).not.toBeNull();
      expect(components!.whereQuery).toBeNull();
      expect(components!.orderBy).toEqual([
        { field: 'Priority', direction: 'desc' },
        { field: 'DueDate', direction: 'asc' }
      ]);
      expect(components!.limit).toBeNull();
      expect(components!.offset).toBeNull();
      expect(components!.hasWhere).toBe(false);
      expect(components!.hasOrderBy).toBe(true);
      expect(components!.hasLimit).toBe(false);
      expect(components!.hasOffset).toBe(false);
      expect(components!.sortFieldCount).toBe(2);
    });

    it('LIMITとOFFSETのみのクエリを処理できる', () => {
      const components = extractQueryComponents('limit 100 offset 50');
      
      expect(components).not.toBeNull();
      expect(components!.whereQuery).toBeNull();
      expect(components!.orderBy).toBeNull();
      expect(components!.limit).toBe(100);
      expect(components!.offset).toBe(50);
      expect(components!.hasWhere).toBe(false);
      expect(components!.hasOrderBy).toBe(false);
      expect(components!.hasLimit).toBe(true);
      expect(components!.hasOffset).toBe(true);
      expect(components!.sortFieldCount).toBe(0);
    });

    it('無効なクエリに対してnullを返す', () => {
      const components = extractQueryComponents('invalid syntax');
      expect(components).toBeNull();
    });

    it('空のクエリに対して空の結果を返す', () => {
      const components = extractQueryComponents('');
      expect(components).toBeNull();
    });
  });

  describe('実用的な使用例', () => {
    it('ページネーションを追加する', () => {
      const baseQuery = 'Status = "Open" and Priority >= 3';
      const page = 2;
      const pageSize = 25;
      
      const paginatedQuery = transformQuery(baseQuery, ast => {
        ast.limit = pageSize;
        ast.offset = (page - 1) * pageSize;
      });
      
      expect(paginatedQuery).toBe('(Status = "Open" and Priority >= 3) limit 25 offset 25');
    });

    it('ソート順序を動的に変更する', () => {
      const originalQuery = 'Status = "Open" order by CreatedDate asc limit 50';
      
      const reverseSorted = transformQuery(originalQuery, ast => {
        if (ast.orderBy) {
          ast.orderBy.forEach(clause => {
            clause.direction = clause.direction === 'asc' ? 'desc' : 'asc';
          });
        }
      });
      
      expect(reverseSorted).toBe('Status = "Open" order by CreatedDate desc limit 50');
    });

    it('フィルターを追加する', () => {
      const baseQuery = 'Status = "Open"';
      const userFilter = 'AssignedTo = LOGINUSER()';
      
      const filtered = combineQueries([baseQuery, userFilter]);
      expect(filtered).toBe('(Status = "Open" and AssignedTo = LOGINUSER())');
    });

    it('クエリコンポーネントを分析する', () => {
      const complexQuery = 'Status in ("Open", "Pending") and Priority >= 3 and AssignedTo = LOGINUSER() order by Priority desc, DueDate asc limit 100 offset 50';
      
      const components = extractQueryComponents(complexQuery);
      expect(components).not.toBeNull();
      expect(components!.hasWhere).toBe(true);
      expect(components!.hasOrderBy).toBe(true);
      expect(components!.hasLimit).toBe(true);
      expect(components!.hasOffset).toBe(true);
      expect(components!.sortFieldCount).toBe(2);
      
      // WHERE句だけを別途使用
      const whereOnly = components!.whereQuery;
      expect(whereOnly).toBe('((Status in ("Open", "Pending") and Priority >= 3) and AssignedTo = LOGINUSER())');
    });

    it('クエリテンプレート機能', () => {
      // テンプレートクエリ
      const template = queryConverter('Status = "Open" order by Priority desc');
      
      // 各ユーザー用にカスタマイズ
      const userQuery1 = template!.modify(ast => {
        ast.where = {
          type: 'and',
          left: ast.where!,
          right: {
            field: 'AssignedTo',
            operator: '=',
            value: 'user1'
          }
        };
        ast.limit = 25;
      });
      
      const userQuery2 = template!.modify(ast => {
        ast.where = {
          type: 'and',
          left: ast.where!,
          right: {
            field: 'AssignedTo',
            operator: '=',
            value: 'user2'
          }
        };
        ast.limit = 50;
      });
      
      expect(userQuery1!.toQuery()).toBe('(Status = "Open" and AssignedTo = "user1") order by Priority desc limit 25');
      expect(userQuery2!.toQuery()).toBe('(Status = "Open" and AssignedTo = "user2") order by Priority desc limit 50');
    });
  });
});