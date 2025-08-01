import { describe, it, expect, vi } from 'vitest';
import { kintoneQuery, subTable } from '../src';

// サブテーブルのスキーマ定義
interface OrderItemsTable {
  ItemCode: string;
  ItemName: string;
  Quantity: number;
  UnitPrice: number;
}

interface MainSchema {
  OrderNumber: string;
  CustomerName: string;
  OrderDate: Date;
  // OrderItems: OrderItemsTable[]; // 実際のスキーマではサブテーブルはこのように定義される
}

describe('サブテーブルサポート', () => {
  // サブテーブル定義
  const OrderItems = subTable<OrderItemsTable>('OrderItems');

  describe('基本的な使用', () => {
    it('in演算子が使える', () => {
      const query = kintoneQuery<MainSchema>(() => 
        OrderItems.ItemCode.in(['A001', 'B002', 'C003'])
      ).build();
      
      expect(query).toBe('OrderItems.ItemCode in ("A001", "B002", "C003")');
    });

    it('notIn演算子が使える', () => {
      const query = kintoneQuery<MainSchema>(() => 
        OrderItems.ItemCode.notIn(['X999'])
      ).build();
      
      expect(query).toBe('OrderItems.ItemCode not in ("X999")');
    });

    it('数値フィールドでの比較', () => {
      const query = kintoneQuery<MainSchema>(() => 
        OrderItems.Quantity.greaterThan(10)
      ).build();
      
      expect(query).toBe('OrderItems.Quantity > 10');
    });

    it('複数のサブテーブル条件', () => {
      const query = kintoneQuery<MainSchema>(() => 
        OrderItems.ItemCode.in(['A001', 'B002']) &&
        OrderItems.Quantity.greaterThanOrEqual(5)
      ).build();
      
      expect(query).toBe('(OrderItems.ItemCode in ("A001", "B002") and OrderItems.Quantity >= 5)');
    });
  });

  describe('メインテーブルとの組み合わせ', () => {
    it('メインテーブルとサブテーブルの条件を組み合わせ', () => {
      const query = kintoneQuery<MainSchema>(r => 
        r.CustomerName.equals('株式会社サンプル') &&
        OrderItems.ItemCode.in(['A001', 'B002'])
      ).build();
      
      expect(query).toBe('(CustomerName = "株式会社サンプル" and OrderItems.ItemCode in ("A001", "B002"))');
    });

    it('複雑な条件の組み合わせ', () => {
      const query = kintoneQuery<MainSchema>(r => 
        r.CustomerName.like('株式会社%') &&
        (OrderItems.ItemCode.in(['A001']) || OrderItems.Quantity.greaterThan(100))
      )
        .orderBy('OrderDate', 'desc')
        .limit(50)
        .build();
      
      expect(query).toBe('(CustomerName like "株式会社%" and (OrderItems.ItemCode in ("A001") or OrderItems.Quantity > 100)) order by OrderDate desc limit 50');
    });
  });

  describe('エラーケース', () => {
    it('equals演算子を使うとエラーになる', () => {
      expect(() => {
        OrderItems.ItemCode.equals('A001');
      }).toThrow('equals (=) 演算子は使用できません');
    });

    it('notEquals演算子を使うとエラーになる', () => {
      expect(() => {
        OrderItems.ItemCode.notEquals('X999');
      }).toThrow('notEquals (!=) 演算子は使用できません');
    });
  });

  describe('警告が出る演算子', () => {
    it('比較演算子を使うと警告が出る', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const query = kintoneQuery<MainSchema>(() => 
        OrderItems.UnitPrice.greaterThan(1000)
      ).build();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('警告: サブテーブルのフィールド "UnitPrice" での比較演算子の使用は制限される場合があります')
      );
      
      expect(query).toBe('OrderItems.UnitPrice > 1000');
      
      consoleSpy.mockRestore();
    });
  });

  describe('複数のサブテーブル', () => {
    // 別のサブテーブル定義
    interface PaymentTable {
      PaymentMethod: string;
      Amount: number;
      PaymentDate: Date;
    }
    
    const Payments = subTable<PaymentTable>('Payments');

    it('複数のサブテーブルを使用', () => {
      const query = kintoneQuery<MainSchema>(() => 
        OrderItems.ItemCode.in(['A001']) &&
        Payments.PaymentMethod.in(['クレジットカード', '銀行振込'])
      ).build();
      
      expect(query).toBe('(OrderItems.ItemCode in ("A001") and Payments.PaymentMethod in ("クレジットカード", "銀行振込"))');
    });
  });
});