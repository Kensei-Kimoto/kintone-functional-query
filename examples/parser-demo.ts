import { parseKintoneQuery, kintoneQuery } from '../src';
import type { Expression } from '../src/types';

// kintoneクエリ文字列をパースする例
console.log('=== kintoneクエリパーサーのデモ ===\n');

// 1. 基本的なクエリのパース
const query1 = 'Status = "Open" and Priority > 5';
console.log('クエリ:', query1);
const ast1 = parseKintoneQuery(query1);
console.log('パース結果:', JSON.stringify(ast1, null, 2));
console.log();

// 2. 複雑なクエリのパース
const query2 = '(Status = "Open" or Status = "Pending") and Assignee in (LOGINUSER()) and DueDate <= FROM_TODAY(7, "DAYS")';
console.log('クエリ:', query2);
const ast2 = parseKintoneQuery(query2);
console.log('パース結果:', JSON.stringify(ast2, null, 2));
console.log();

// 3. ASTを解析する例
function extractFields(expr: Expression | null): string[] {
  if (!expr) return [];
  
  const fields: string[] = [];
  
  function traverse(node: Expression) {
    if ('field' in node) {
      // QueryExpression
      fields.push(node.field);
    } else if ('type' in node && (node.type === 'and' || node.type === 'or')) {
      // LogicalExpression
      traverse(node.left);
      traverse(node.right);
    }
  }
  
  traverse(expr);
  return [...new Set(fields)]; // 重複を除去
}

console.log('抽出されたフィールド:', extractFields(ast2));
console.log();

// 4. ASTから条件を変更する例
function modifyFieldValue(expr: Expression, targetField: string, newValue: unknown): Expression {
  if ('field' in expr && expr.field === targetField) {
    return { ...expr, value: newValue };
  } else if ('type' in expr && (expr.type === 'and' || expr.type === 'or')) {
    return {
      ...expr,
      left: modifyFieldValue(expr.left, targetField, newValue),
      right: modifyFieldValue(expr.right, targetField, newValue)
    };
  }
  return expr;
}

// Statusの値を変更
const modifiedAst = modifyFieldValue(ast2!, 'Status', 'Closed');
console.log('Statusを"Closed"に変更後:', JSON.stringify(modifiedAst, null, 2));
console.log();

// 5. ASTからクエリを再構築（QueryBuilderを使用）
// 注意: 現在の実装では、ASTから直接クエリ文字列を生成する機能はないため、
// 手動で同等のクエリを構築する必要があります

console.log('=== パースと再構築の往復 ===');
const originalQuery = 'CustomerName like "%株式会社%" and Amount > 1000000';
console.log('元のクエリ:', originalQuery);

const parsedAst = parseKintoneQuery(originalQuery);
console.log('パースされたAST:', JSON.stringify(parsedAst, null, 2));

// 同等のクエリをラムダ式で構築
interface TestSchema {
  CustomerName: string;
  Amount: number;
}

const rebuiltQuery = kintoneQuery<TestSchema>(r => 
  r.CustomerName.like('%株式会社%') && r.Amount.greaterThan(1000000)
).build();

console.log('再構築されたクエリ:', rebuiltQuery);