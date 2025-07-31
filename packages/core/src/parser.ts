import { Expression, LogicalExpression, NotExpression, QueryExpression } from './types';

export class QueryParser {
  private readonly funcBody: string;

  constructor(private readonly lambdaFunc: (...args: unknown[]) => unknown) {
    this.funcBody = lambdaFunc.toString();
  }

  parse(): Expression | null {
    // ラムダ式の本体を抽出
    const match = this.funcBody.match(/=>\s*(.+)$/s);
    if (!match) return null;

    const body = match[1].trim();

    // 簡単なパーサーの実装（実際の実装ではより堅牢なAST解析が必要）
    // ここでは概念実証として簡易的な実装を行う
    return this.parseExpression(body);
  }

  private parseExpression(expr: string): Expression | null {
    expr = expr.trim();

    // 括弧で囲まれた式の処理
    if (expr.startsWith('(') && expr.endsWith(')')) {
      // 括弧の対応をチェック
      let depth = 0;
      let allMatched = true;
      for (let i = 0; i < expr.length - 1; i++) {
        if (expr[i] === '(') depth++;
        if (expr[i] === ')') depth--;
        if (depth === 0) {
          allMatched = false;
          break;
        }
      }
      if (allMatched) {
        return this.parseExpression(expr.slice(1, -1));
      }
    }

    // 論理演算子のチェック（&&が||より優先度が高い）
    if (expr.includes('||')) {
      const parts = this.splitByOperator(expr, '||');
      if (parts.length >= 2) {
        // 複数のOR演算子がある場合は左から順に処理
        let result = this.parseExpression(parts[0]);
        for (let i = 1; i < parts.length; i++) {
          const right = this.parseExpression(parts[i]);
          if (result && right) {
            result = {
              type: 'or',
              left: result,
              right,
            } as LogicalExpression;
          }
        }
        return result;
      }
    }

    if (expr.includes('&&')) {
      const parts = this.splitByOperator(expr, '&&');
      if (parts.length >= 2) {
        // 複数のAND演算子がある場合は左から順に処理
        let result = this.parseExpression(parts[0]);
        for (let i = 1; i < parts.length; i++) {
          const right = this.parseExpression(parts[i]);
          if (result && right) {
            result = {
              type: 'and',
              left: result,
              right,
            } as LogicalExpression;
          }
        }
        return result;
      }
    }

    // NOT演算子のチェック
    if (expr.startsWith('!')) {
      const innerExpr = expr.substring(1).trim();
      const inner = this.parseExpression(innerExpr);
      if (inner) {
        return {
          type: 'not',
          expression: inner,
        } as NotExpression;
      }
    }

    // サブテーブルの引数なしメソッドのチェック（isEmpty, isNotEmpty）
    const subTableEmptyMethodMatch = expr.match(
      /^([^.]+)\.([^.]+)\.(isEmpty|isNotEmpty)\(\)$/
    );
    if (subTableEmptyMethodMatch) {
      const [, tableName, fieldName, method] = subTableEmptyMethodMatch;
      return {
        field: `${tableName}.${fieldName}`,
        operator: this.convertMethod(method),
        value: null,
      } as QueryExpression;
    }
    
    // 引数なしメソッドのチェック（isEmpty, isNotEmpty）
    const emptyMethodMatch = expr.match(
      /^r\.([^.]+)\.(isEmpty|isNotEmpty)\(\)$/
    );
    if (emptyMethodMatch) {
      const [, field, method] = emptyMethodMatch;
      return {
        field,
        operator: this.convertMethod(method),
        value: null,
      } as QueryExpression;
    }

    // サブテーブルのメソッド呼び出しのチェック
    const subTableMethodMatch = expr.match(
      /^([^.]+)\.([^.]+)\.(equals|notEquals|greaterThan|lessThan|greaterThanOrEqual|lessThanOrEqual|in|notIn|like|notLike)\((.+)\)$/
    );
    if (subTableMethodMatch) {
      const [, tableName, fieldName, method, args] = subTableMethodMatch;
      
      // サブテーブルで比較演算子を使用する場合は警告を出す
      if (['greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'].includes(method)) {
        console.warn(`警告: サブテーブルのフィールド "${fieldName}" での比較演算子の使用は制限される場合があります`);
      }
      
      return {
        field: `${tableName}.${fieldName}`,
        operator: this.convertMethod(method),
        value: this.parseMethodArgs(method, args),
      } as QueryExpression;
    }
    
    // メソッド呼び出しのチェック（equals, notEquals, greaterThan等）
    const methodMatch = expr.match(
      /^r\.([^.]+)\.(equals|notEquals|greaterThan|lessThan|greaterThanOrEqual|lessThanOrEqual|in|notIn|like|notLike)\((.+)\)$/
    );
    if (methodMatch) {
      const [, field, method, args] = methodMatch;
      return {
        field: field,
        operator: this.convertMethod(method),
        value: this.parseMethodArgs(method, args),
      } as QueryExpression;
    }

    // 比較演算子のチェック（後方互換性のため）
    const comparisonMatch = expr.match(/^r\.([^\s]+)\s*(===|!==|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      const [, field, operator, value] = comparisonMatch;
      return {
        field,
        operator: this.convertOperator(operator),
        value: this.parseValue(value),
      } as QueryExpression;
    }

    return null;
  }

  private splitByOperator(expr: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      
      // 文字列リテラルの処理
      if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
      
      // 括弧の深さを追跡
      if (!inString) {
        if (char === '(' || char === '[') depth++;
        if (char === ')' || char === ']') depth--;
      }
      
      // 演算子のチェック
      if (!inString && depth === 0 && expr.substring(i, i + operator.length) === operator) {
        parts.push(current.trim());
        current = '';
        i += operator.length - 1;
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      parts.push(current.trim());
    }
    
    return parts.length > 0 ? parts : [expr];
  }

  private convertOperator(operator: string): string {
    const mapping: Record<string, string> = {
      '===': '=',
      '!==': '!=',
      '>': '>',
      '<': '<',
      '>=': '>=',
      '<=': '<=',
    };
    return mapping[operator] || operator;
  }

  private convertMethod(method: string): string {
    const mapping: Record<string, string> = {
      equals: '=',
      notEquals: '!=',
      greaterThan: '>',
      lessThan: '<',
      greaterThanOrEqual: '>=',
      lessThanOrEqual: '<=',
      in: 'in',
      notIn: 'not in',
      like: 'like',
      notLike: 'not like',
      isEmpty: 'is empty',
      isNotEmpty: 'is not empty',
    };
    return mapping[method] || method;
  }

  private parseValue(value: string): unknown {
    value = value.trim();

    // 文字列リテラル
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // 数値
    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }

    // 関数呼び出し（TODAY()、FROM_TODAY(-7, 'DAYS')など）
    const funcMatch = value.match(/^([A-Z_]+)\((.*)\)$/);
    if (funcMatch) {
      const [, funcName, argsStr] = funcMatch;
      if (!argsStr) {
        return { type: 'function', name: funcName };
      }
      
      // 引数をパース
      const args = argsStr.split(',').map(arg => {
        const trimmed = arg.trim();
        // 文字列リテラル
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          return trimmed.slice(1, -1);
        }
        // 数値
        const num = Number(trimmed);
        if (!isNaN(num)) {
          return num;
        }
        return trimmed;
      });
      
      return { type: 'function', name: funcName, args };
    }

    return value;
  }

  private parseMethodArgs(method: string, args: string): unknown {
    args = args.trim();

    if (method === 'in' || method === 'notIn') {
      // 配列のパース
      if (args.startsWith('[') && args.endsWith(']')) {
        const items = args.slice(1, -1).split(',');
        return items.map((item) => this.parseValue(item.trim()));
      }
    }

    return this.parseValue(args);
  }
}
