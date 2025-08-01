import { describe, it, expect } from 'vitest';
import { kintoneQuery } from '../src';

describe('isEmpty/isNotEmpty メソッド', () => {
  describe('基本的な使用', () => {
    it('isEmpty メソッドが動作する', () => {
      const query = kintoneQuery<{ Description: string }>(r => 
        r.Description.isEmpty()
      ).build();
      
      expect(query).toBe('Description is empty');
    });

    it('isNotEmpty メソッドが動作する', () => {
      const query = kintoneQuery<{ Notes: string }>(r => 
        r.Notes.isNotEmpty()
      ).build();
      
      expect(query).toBe('Notes is not empty');
    });
  });

  describe('他の条件との組み合わせ', () => {
    it('AND条件と組み合わせられる', () => {
      const query = kintoneQuery<{ Status: string; Description: string }>(r => 
        r.Status.equals("進行中") && r.Description.isNotEmpty()
      ).build();
      
      expect(query).toBe('(Status = "進行中" and Description is not empty)');
    });

    it('OR条件と組み合わせられる', () => {
      const query = kintoneQuery<{ Title: string; Description: string }>(r => 
        r.Title.isEmpty() || r.Description.isEmpty()
      ).build();
      
      expect(query).toBe('(Title is empty or Description is empty)');
    });

    it('複雑な条件での使用', () => {
      const query = kintoneQuery<{ 
        Status: string; 
        Description: string; 
        Priority: string 
      }>(r => 
        r.Status.notEquals("完了") && 
        r.Description.isNotEmpty() &&
        r.Priority.in(["高", "中"])
      ).build();
      
      expect(query).toBe('((Status != "完了" and Description is not empty) and Priority in ("高", "中"))');
    });
  });

  describe('実用的なケース', () => {
    it('未入力項目の検索', () => {
      const query = kintoneQuery<{ 
        CustomerName: string; 
        ContactEmail: string 
      }>(r => 
        r.CustomerName.isNotEmpty() && r.ContactEmail.isEmpty()
      ).build();
      
      expect(query).toBe('(CustomerName is not empty and ContactEmail is empty)');
    });

    it('必須項目チェック', () => {
      const query = kintoneQuery<{ 
        Title: string; 
        Status: string;
        Description: string;
      }>(r => 
        r.Title.isNotEmpty() && 
        r.Status.notEquals("下書き") && 
        r.Description.isEmpty()
      )
        .orderBy('CreatedTime', 'desc')
        .build();
      
      expect(query).toBe('((Title is not empty and Status != "下書き") and Description is empty) order by CreatedTime desc');
    });
  });
});