import { Expression, QueryExpression, LogicalExpression, FunctionCall, KintoneOperator, KintoneFunction, QueryExpressionSchema } from './types';
import { Schema as S } from 'effect';
import { logValidationWarning } from './utils/logger';

/**
 * kintoneクエリ文字列をASTに変換するパーサー
 */
export class KintoneQueryParser {
  private pos = 0;
  private input = '';
  
  private validateQueryExpression(expr: Omit<QueryExpression, 'operator'> & { operator: string }): QueryExpression {
    try {
      // Effect-TSスキーマでの検証
      const decoded = S.decodeUnknownSync(QueryExpressionSchema)(expr);
      return decoded;
    } catch (error) {
      // 検証エラーの場合は警告を出して元の値を返す（後方互換性のため）
      logValidationWarning('Query expression validation failed', error, {
        module: 'query-parser',
        function: 'validateQueryExpression',
        field: expr.field,
        operator: expr.operator
      });
      return expr as QueryExpression;
    }
  }
  
  /**
   * kintoneクエリ文字列をパースしてASTを生成
   */
  parse(query: string): Expression | null {
    this.input = query.trim();
    this.pos = 0;
    
    if (!this.input) return null;
    
    const expr = this.parseOr();
    
    // 全体をパースできたかチェック
    this.skipWhitespace();
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected characters at position ${this.pos}: "${this.input.slice(this.pos)}"`);
    }
    
    return expr;
  }
  
  /**
   * OR式のパース（最も優先度が低い）
   */
  private parseOr(): Expression {
    let left = this.parseAnd();
    
    while (this.consumeKeyword('or')) {
      const right = this.parseAnd();
      left = {
        type: 'or',
        left,
        right
      } as LogicalExpression;
    }
    
    return left;
  }
  
  /**
   * AND式のパース
   */
  private parseAnd(): Expression {
    let left = this.parsePrimary();
    
    while (this.consumeKeyword('and')) {
      const right = this.parsePrimary();
      left = {
        type: 'and',
        left,
        right
      } as LogicalExpression;
    }
    
    return left;
  }
  
  /**
   * プライマリ式のパース（括弧、フィールド条件）
   */
  private parsePrimary(): Expression {
    this.skipWhitespace();
    
    // 括弧で囲まれた式
    if (this.peek() === '(') {
      this.consume('(');
      const expr = this.parseOr();
      this.expect(')');
      return expr;
    }
    
    // フィールド条件
    return this.parseFieldCondition();
  }
  
  /**
   * フィールド条件のパース
   */
  private parseFieldCondition(): QueryExpression {
    const field = this.parseFieldName();
    const operator = this.parseOperator();
    
    // IS EMPTY / IS NOT EMPTY の場合は値が不要
    let value: unknown;
    if (operator !== 'is empty' && operator !== 'is not empty') {
      value = this.parseValue();
    }
    
    return this.validateQueryExpression({
      field,
      operator,
      value
    });
  }
  
  /**
   * フィールド名のパース（サブテーブル対応）
   */
  private parseFieldName(): string {
    this.skipWhitespace();
    const start = this.pos;
    
    // フィールド名は英数字、日本語、アンダースコア、ピリオドを含む
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (/[a-zA-Z0-9_.\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]/.test(char)) {
        this.pos++;
      } else {
        break;
      }
    }
    
    if (start === this.pos) {
      throw new Error(`Expected field name at position ${this.pos}`);
    }
    
    return this.input.slice(start, this.pos);
  }
  
  /**
   * 演算子のパース
   */
  private parseOperator(): KintoneOperator {
    this.skipWhitespace();
    
    // 複数単語の演算子を先にチェック
    const twoWordOps: Array<[string, KintoneOperator]> = [
      ['is not empty', 'is not empty'],
      ['is empty', 'is empty'],
      ['not like', 'not like'],
      ['not in', 'not in']
    ];
    
    for (const [keyword, op] of twoWordOps) {
      if (this.consumeKeyword(keyword)) {
        return op;
      }
    }
    
    // 単一の演算子
    const singleOps: Array<[string, KintoneOperator]> = [
      ['>=', '>='],
      ['<=', '<='],
      ['!=', '!='],
      ['=', '='],
      ['>', '>'],
      ['<', '<'],
      ['like', 'like'],
      ['in', 'in']
    ];
    
    for (const [symbol, op] of singleOps) {
      if (symbol.match(/[a-z]/)) {
        if (this.consumeKeyword(symbol)) {
          return op;
        }
      } else {
        if (this.consume(symbol)) {
          return op;
        }
      }
    }
    
    throw new Error(`Expected operator at position ${this.pos}`);
  }
  
  /**
   * 値のパース
   */
  private parseValue(): unknown {
    this.skipWhitespace();
    
    // 括弧で囲まれた配列（IN演算子用）
    if (this.peek() === '(') {
      return this.parseArray();
    }
    
    // 文字列
    if (this.peek() === '"') {
      return this.parseString();
    }
    
    // 関数呼び出し
    if (this.isFunction()) {
      return this.parseFunction();
    }
    
    // 数値
    if (this.isNumber()) {
      return this.parseNumber();
    }
    
    throw new Error(`Expected value at position ${this.pos}`);
  }
  
  /**
   * 配列のパース
   */
  private parseArray(): unknown[] {
    this.expect('(');
    const values: unknown[] = [];
    
    while (this.peek() !== ')') {
      values.push(this.parseSingleValue());
      
      if (this.peek() === ',') {
        this.consume(',');
        this.skipWhitespace();
      } else if (this.peek() !== ')') {
        throw new Error(`Expected ',' or ')' at position ${this.pos}`);
      }
    }
    
    this.expect(')');
    return values;
  }
  
  /**
   * 単一値のパース（配列内で使用）
   */
  private parseSingleValue(): unknown {
    this.skipWhitespace();
    
    if (this.peek() === '"') {
      return this.parseString();
    }
    
    if (this.isFunction()) {
      return this.parseFunction();
    }
    
    if (this.isNumber()) {
      return this.parseNumber();
    }
    
    throw new Error(`Expected value at position ${this.pos}`);
  }
  
  /**
   * 文字列のパース
   */
  private parseString(): string {
    this.expect('"');
    const start = this.pos;
    
    while (this.pos < this.input.length && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.pos += 2; // エスケープ文字をスキップ
      } else {
        this.pos++;
      }
    }
    
    const value = this.input.slice(start, this.pos);
    this.expect('"');
    
    // エスケープ文字を処理
    return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  
  /**
   * 数値のパース
   */
  private parseNumber(): number {
    const start = this.pos;
    
    if (this.peek() === '-') {
      this.pos++;
    }
    
    while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
      this.pos++;
    }
    
    const numStr = this.input.slice(start, this.pos);
    const num = parseFloat(numStr);
    
    if (isNaN(num)) {
      throw new Error(`Invalid number at position ${start}`);
    }
    
    return num;
  }
  
  /**
   * 関数のパース
   */
  private parseFunction(): FunctionCall {
    const name = this.parseFunctionName();
    this.expect('(');
    
    const args: unknown[] = [];
    
    while (this.peek() !== ')') {
      args.push(this.parseSingleValue());
      
      if (this.peek() === ',') {
        this.consume(',');
        this.skipWhitespace();
      } else if (this.peek() !== ')') {
        throw new Error(`Expected ',' or ')' at position ${this.pos}`);
      }
    }
    
    this.expect(')');
    
    return {
      type: 'function',
      name: name as KintoneFunction,
      args: args.length > 0 ? args : undefined
    };
  }
  
  /**
   * 関数名のパース
   */
  private parseFunctionName(): string {
    const start = this.pos;
    
    while (this.pos < this.input.length && /[A-Z_]/.test(this.peek())) {
      this.pos++;
    }
    
    return this.input.slice(start, this.pos);
  }
  
  /**
   * 関数かどうかチェック
   */
  private isFunction(): boolean {
    const saved = this.pos;
    
    // 大文字で始まるかチェック
    if (!/[A-Z]/.test(this.peek())) {
      return false;
    }
    
    // 関数名をスキップ
    while (this.pos < this.input.length && /[A-Z_]/.test(this.peek())) {
      this.pos++;
    }
    
    // 次が開き括弧かチェック
    this.skipWhitespace();
    const isFunc = this.peek() === '(';
    
    // 位置を戻す
    this.pos = saved;
    return isFunc;
  }
  
  /**
   * 数値かどうかチェック
   */
  private isNumber(): boolean {
    const char = this.peek();
    return char === '-' || /[0-9]/.test(char);
  }
  
  /**
   * 現在位置の文字を取得
   */
  private peek(): string {
    return this.input[this.pos] || '';
  }
  
  /**
   * 指定した文字列を消費
   */
  private consume(expected: string): boolean {
    if (this.input.slice(this.pos, this.pos + expected.length) === expected) {
      this.pos += expected.length;
      return true;
    }
    return false;
  }
  
  /**
   * 指定した文字列を期待（エラーを投げる）
   */
  private expect(expected: string): void {
    if (!this.consume(expected)) {
      throw new Error(`Expected "${expected}" at position ${this.pos}`);
    }
  }
  
  /**
   * キーワードを消費（前後に空白が必要）
   */
  private consumeKeyword(keyword: string): boolean {
    this.skipWhitespace();
    const saved = this.pos;
    
    if (this.consume(keyword)) {
      // キーワードの後が単語境界かチェック
      if (this.pos >= this.input.length || /\s|[()=!<>,]/.test(this.peek())) {
        return true;
      }
    }
    
    this.pos = saved;
    return false;
  }
  
  /**
   * 空白をスキップ
   */
  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.peek())) {
      this.pos++;
    }
  }
}