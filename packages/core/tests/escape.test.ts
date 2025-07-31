import { describe, it, expect } from 'vitest';
import { escapeValue, escapeIfString } from '../src/escape';
import { kintoneQuery } from '../src';

describe('エスケープ処理', () => {
  describe('escapeValue', () => {
    it('ダブルクォートをエスケープする', () => {
      expect(escapeValue('サイボウズ"株式会社"')).toBe('サイボウズ\\"株式会社\\"');
    });

    it('バックスラッシュをエスケープする', () => {
      expect(escapeValue('C:\\Users\\Desktop')).toBe('C:\\\\Users\\\\Desktop');
    });

    it('両方の特殊文字をエスケープする', () => {
      expect(escapeValue('Path: "C:\\Program Files\\App"')).toBe('Path: \\"C:\\\\Program Files\\\\App\\"');
    });

    it('特殊文字がない場合はそのまま', () => {
      expect(escapeValue('普通のテキスト')).toBe('普通のテキスト');
    });
  });

  describe('escapeIfString', () => {
    it('文字列の場合はエスケープする', () => {
      expect(escapeIfString('test"value"')).toBe('test\\"value\\"');
    });

    it('数値の場合はそのまま', () => {
      expect(escapeIfString(123)).toBe(123);
    });

    it('配列の場合はそのまま', () => {
      const arr = ['a', 'b'];
      expect(escapeIfString(arr)).toBe(arr);
    });
  });

  describe('クエリビルダーでのエスケープ', () => {
    it('equals メソッドでエスケープされる', () => {
      const query = kintoneQuery<{ Name: string }>(r => 
        r.Name.equals('サイボウズ"株式会社"')
      ).build();
      
      expect(query).toBe('Name = "サイボウズ\\"株式会社\\""');
    });

    it('in メソッドでもエスケープされる', () => {
      const query = kintoneQuery<{ Path: string }>(r => 
        r.Path.in(['C:\\Temp', 'D:\\Data'])
      ).build();
      
      expect(query).toBe('Path in ("C:\\\\\\\\Temp", "D:\\\\\\\\Data")');
    });

    it('複雑なエスケープケース', () => {
      const query = kintoneQuery<{ Description: string }>(r => 
        r.Description.like('%検索文字列 "特殊\\文字" を含む%')
      ).build();
      
      expect(query).toBe('Description like "%検索文字列 \\"特殊\\\\\\\\文字\\" を含む%"');
    });
  });
});