import { describe, it, expect } from 'vitest';
import { ASTToQueryBuilder, astToQuery, parseKintoneQueryComplete } from '../src/index';
import { CompleteQueryAST } from '../src/types';

describe('AST to Query Builder (Phase 3)', () => {
  describe('ASTToQueryBuilder.generate', () => {
    it('WHERE句のみのASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        where: {
          field: 'Status',
          operator: '=',
          value: 'Open'
        }
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('Status = "Open"');
    });

    it('ORDER BY句のみのASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        orderBy: [
          { field: 'Priority', direction: 'desc' },
          { field: 'DueDate', direction: 'asc' }
        ]
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('order by Priority desc, DueDate asc');
    });

    it('LIMIT句のみのASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        limit: 100
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('limit 100');
    });

    it('OFFSET句のみのASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        offset: 50
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('offset 50');
    });

    it('完全なASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
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
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('(Status = "Open" and Priority > 3) order by Priority desc, DueDate asc limit 50 offset 10');
    });

    it('複雑なWHERE句を含むASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        where: {
          type: 'or',
          left: {
            type: 'and',
            left: {
              field: 'Status',
              operator: '=',
              value: 'Open'
            },
            right: {
              field: 'Priority',
              operator: '>=',
              value: 5
            }
          },
          right: {
            field: 'AssignedTo',
            operator: 'in',
            value: ['user1', 'user2', 'user3']
          }
        }
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('((Status = "Open" and Priority >= 5) or AssignedTo in ("user1", "user2", "user3"))');
    });

    it('IS EMPTY演算子を含むASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        where: {
          field: 'Description',
          operator: 'is empty',
          value: undefined
        }
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('Description is empty');
    });

    it('関数を含むASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        where: {
          field: 'DueDate',
          operator: '<=',
          value: {
            type: 'function',
            name: 'FROM_TODAY',
            args: [7, 'DAYS']
          }
        }
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('DueDate <= FROM_TODAY(7, DAYS)');
    });

    it('サブテーブルフィールドを含むASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        where: {
          field: 'OrderItems.Quantity',
          operator: '>',
          value: 10
        },
        orderBy: [
          { field: 'OrderItems.ProductCode', direction: 'asc' }
        ]
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('OrderItems.Quantity > 10 order by OrderItems.ProductCode asc');
    });

    it('日本語フィールド名を含むASTをクエリに変換できる', () => {
      const ast: CompleteQueryAST = {
        where: {
          field: '担当者',
          operator: '=',
          value: '山田太郎'
        },
        orderBy: [
          { field: '優先度', direction: 'desc' },
          { field: '期限', direction: 'asc' }
        ]
      };

      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('担当者 = "山田太郎" order by 優先度 desc, 期限 asc');
    });

    it('空のASTから空文字列を生成する', () => {
      const ast: CompleteQueryAST = {};
      const result = ASTToQueryBuilder.generate(ast);
      expect(result).toBe('');
    });
  });

  describe('astToQuery convenience function', () => {
    it('便利関数が正しく動作する', () => {
      const ast: CompleteQueryAST = {
        where: {
          field: 'Status',
          operator: '=',
          value: 'Active'
        },
        limit: 25
      };

      const result = astToQuery(ast);
      expect(result).toBe('Status = "Active" limit 25');
    });
  });

  describe('Round-trip conversion (parse ↔ generate)', () => {
    it('シンプルなクエリの往復変換ができる', () => {
      const originalQuery = 'Status = "Open" order by Priority desc limit 50';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // Should be equivalent (though formatting might differ slightly)
      expect(regeneratedQuery).toBe(originalQuery);
    });

    it('複雑なクエリの往復変換ができる', () => {
      const originalQuery = '(Status = "Open" and Priority > 3) or AssignedTo in ("user1", "user2") order by Priority desc, DueDate asc limit 100 offset 20';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // The generated query might have extra parentheses for clarity, which is correct
      const expectedQuery = '((Status = "Open" and Priority > 3) or AssignedTo in ("user1", "user2")) order by Priority desc, DueDate asc limit 100 offset 20';
      expect(regeneratedQuery).toBe(expectedQuery);
    });

    it('関数を含むクエリの往復変換ができる', () => {
      const originalQuery = 'DueDate <= FROM_TODAY(7, "DAYS") and Status != "Completed" order by Priority desc limit 25';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // The generated query might have extra parentheses for clarity, and constants don't need quotes
      const expectedQuery = '(DueDate <= FROM_TODAY(7, DAYS) and Status != "Completed") order by Priority desc limit 25';
      expect(regeneratedQuery).toBe(expectedQuery);
    });

    it('日本語を含むクエリの往復変換ができる', () => {
      const originalQuery = '担当者 = "山田太郎" and 優先度 >= 3 order by 優先度 desc, 期限 asc limit 30';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // The generated query might have extra parentheses for clarity, which is correct
      const expectedQuery = '(担当者 = "山田太郎" and 優先度 >= 3) order by 優先度 desc, 期限 asc limit 30';
      expect(regeneratedQuery).toBe(expectedQuery);
    });

    it('IS EMPTY を含むクエリの往復変換ができる', () => {
      const originalQuery = 'Description is empty and Status = "Open"';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // The generated query might have extra parentheses for clarity, which is correct
      const expectedQuery = '(Description is empty and Status = "Open")';
      expect(regeneratedQuery).toBe(expectedQuery);
    });

    it('部分的なクエリ（ORDER BYのみ）の往復変換ができる', () => {
      const originalQuery = 'order by Priority desc, CreatedDate asc';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // Should be equivalent
      expect(regeneratedQuery).toBe(originalQuery);
    });

    it('部分的なクエリ（LIMITとOFFSETのみ）の往復変換ができる', () => {
      const originalQuery = 'limit 100 offset 50';
      
      // Parse to AST
      const ast = parseKintoneQueryComplete(originalQuery);
      expect(ast).not.toBeNull();

      // Generate back to query
      const regeneratedQuery = astToQuery(ast!);
      
      // Should be equivalent
      expect(regeneratedQuery).toBe(originalQuery);
    });
  });
});