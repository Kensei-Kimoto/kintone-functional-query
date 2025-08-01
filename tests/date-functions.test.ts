import { describe, it, expect } from 'vitest';
import { 
  TODAY, 
  YESTERDAY, 
  TOMORROW, 
  FROM_TODAY,
  THIS_WEEK,
  LAST_MONTH,
  THIS_YEAR
} from '../src';

describe('日付関数', () => {
  describe('基本的な日付関数', () => {
    it('TODAY関数', () => {
      const func = TODAY();
      expect(func).toEqual({
        type: 'function',
        name: 'TODAY',
      });
    });

    it('YESTERDAY関数', () => {
      const func = YESTERDAY();
      expect(func).toEqual({
        type: 'function',
        name: 'YESTERDAY',
      });
    });

    it('TOMORROW関数', () => {
      const func = TOMORROW();
      expect(func).toEqual({
        type: 'function',
        name: 'TOMORROW',
      });
    });
  });

  describe('引数付き関数', () => {
    it('FROM_TODAY関数（正の数）', () => {
      const func = FROM_TODAY(7);
      expect(func).toEqual({
        type: 'function',
        name: 'FROM_TODAY',
        args: [7],
      });
    });

    it('FROM_TODAY関数（負の数）', () => {
      const func = FROM_TODAY(-3);
      expect(func).toEqual({
        type: 'function',
        name: 'FROM_TODAY',
        args: [-3],
      });
    });
  });

  describe('期間関数', () => {
    it('THIS_WEEK関数', () => {
      const func = THIS_WEEK();
      expect(func).toEqual({
        type: 'function',
        name: 'THIS_WEEK',
      });
    });

    it('LAST_MONTH関数', () => {
      const func = LAST_MONTH();
      expect(func).toEqual({
        type: 'function',
        name: 'LAST_MONTH',
      });
    });

    it('THIS_YEAR関数', () => {
      const func = THIS_YEAR();
      expect(func).toEqual({
        type: 'function',
        name: 'THIS_YEAR',
      });
    });
  });

  describe('クエリビルダーでの使用', () => {
    it('関数の出力形式（引数なし）', () => {
      // QueryBuilderのexpressionToStringメソッドが正しく動作することは
      // 実際のクエリ構築で確認する
      const func = TODAY();
      expect(func.type).toBe('function');
      expect(func.name).toBe('TODAY');
    });

    it('関数の出力形式（引数あり）', () => {
      const func = FROM_TODAY(5);
      expect(func.type).toBe('function');
      expect(func.name).toBe('FROM_TODAY');
      expect(func.args).toEqual([5]);
    });
  });
});