# 動的クエリビルダー実装ガイド

## はじめに

このガイドは、汎用プラグイン開発で動的な検索UIを実装する場合の参考資料です。

### 📌 このガイドが対象とするケース

- ✅ kintoneアプリストアで配布する汎用プラグイン
- ✅ 複数のアプリで使い回す社内ツール
- ✅ フィールド構成が異なる複数アプリに対応する必要がある場合

### ⚠️ このガイドが対象としないケース

- ❌ 特定アプリ専用のカスタマイズ → [README.md](README.md#a-特定アプリのカスタマイズ開発推奨) を参照
- ❌ フィールド構成が事前にわかっている場合 → CLIでスキーマを生成して型安全に開発

## 前提条件

- kintone JavaScript カスタマイズの基本知識
- npm/yarn を使ったパッケージ管理
- webpack などのバンドラーの使用

## インストール

```bash
npm install kintone-functional-query
```

## 実装例：動的検索フォーム

### 1. 基本構造

```typescript
import { 
  kintoneQuery, 
  FormFieldsResponse, 
  S, 
  FieldTypes,
  subTable 
} from 'kintone-functional-query';

class KintoneSearchForm {
  private formFields: FormFieldsResponse;
  private searchContainer: HTMLElement;
  
  constructor(containerId: string) {
    this.searchContainer = document.getElementById(containerId);
  }
  
  async initialize() {
    try {
      // フィールド情報を取得・検証
      const fieldsData = await kintone.app.getFormFields();
      this.formFields = S.decodeUnknownSync(FormFieldsResponse)(fieldsData);
      
      // 検索UIを構築
      this.buildSearchInterface();
    } catch (error) {
      console.error('初期化エラー:', error);
      this.showError('検索フォームの初期化に失敗しました');
    }
  }
  
  private buildSearchInterface() {
    // 検索可能なフィールドのみ表示
    const searchableFields = this.getSearchableFields();
    
    searchableFields.forEach(([code, field]) => {
      const inputGroup = this.createInputGroup(code, field);
      this.searchContainer.appendChild(inputGroup);
    });
    
    // 検索ボタン
    const searchButton = this.createSearchButton();
    this.searchContainer.appendChild(searchButton);
  }
  
  private getSearchableFields() {
    const searchableTypes = [
      FieldTypes.SINGLE_LINE_TEXT,
      FieldTypes.MULTI_LINE_TEXT,
      FieldTypes.NUMBER,
      FieldTypes.CALC,
      FieldTypes.DATE,
      FieldTypes.DROP_DOWN,
      FieldTypes.CHECK_BOX,
      FieldTypes.RADIO_BUTTON,
      FieldTypes.MULTI_SELECT
    ];
    
    return Object.entries(this.formFields.properties)
      .filter(([_, field]) => searchableTypes.includes(field.type as any));
  }
}
```

### 2. フィールドタイプ別のUI生成

```typescript
private createInputGroup(code: string, field: any): HTMLElement {
  const group = document.createElement('div');
  group.className = 'search-input-group';
  
  const label = document.createElement('label');
  label.textContent = field.label;
  group.appendChild(label);
  
  switch (field.type) {
    case FieldTypes.SINGLE_LINE_TEXT:
    case FieldTypes.MULTI_LINE_TEXT:
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.dataset.field = code;
      textInput.dataset.fieldType = 'text';
      textInput.placeholder = `${field.label}を検索`;
      group.appendChild(textInput);
      break;
    
    case FieldTypes.NUMBER:
    case FieldTypes.CALC:
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.dataset.field = code;
      minInput.dataset.fieldType = 'number-min';
      minInput.placeholder = '最小値';
      
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.dataset.field = code;
      maxInput.dataset.fieldType = 'number-max';
      maxInput.placeholder = '最大値';
      
      group.appendChild(minInput);
      group.appendChild(document.createTextNode(' 〜 '));
      group.appendChild(maxInput);
      break;
    
    case FieldTypes.DROP_DOWN:
    case FieldTypes.RADIO_BUTTON:
      const select = document.createElement('select');
      select.dataset.field = code;
      select.dataset.fieldType = 'select';
      
      // 空のオプション
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '-- 選択してください --';
      select.appendChild(emptyOption);
      
      // フィールドのオプションを追加
      if (field.options) {
        Object.entries(field.options).forEach(([value, option]: [string, any]) => {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = option.label;
          select.appendChild(opt);
        });
      }
      
      group.appendChild(select);
      break;
    
    case FieldTypes.CHECK_BOX:
    case FieldTypes.MULTI_SELECT:
      const checkboxGroup = document.createElement('div');
      checkboxGroup.dataset.field = code;
      checkboxGroup.dataset.fieldType = 'checkbox-group';
      
      if (field.options) {
        Object.entries(field.options).forEach(([value, option]: [string, any]) => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = value;
          checkbox.name = code;
          
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(option.label));
          checkboxGroup.appendChild(label);
        });
      }
      
      group.appendChild(checkboxGroup);
      break;
  }
  
  return group;
}
```

### 3. クエリの動的構築

```typescript
private buildDynamicQuery(): string {
  const searchParams = this.collectSearchParameters();
  
  return kintoneQuery(r => {
    const conditions = [];
    
    // テキストフィールド
    Object.entries(searchParams.text || {}).forEach(([field, value]) => {
      if (value) {
        conditions.push(r[field].like(`%${value}%`));
      }
    });
    
    // 数値範囲
    Object.entries(searchParams.numberRange || {}).forEach(([field, range]) => {
      if (range.min !== undefined) {
        conditions.push(r[field].greaterThanOrEqual(range.min));
      }
      if (range.max !== undefined) {
        conditions.push(r[field].lessThanOrEqual(range.max));
      }
    });
    
    // 選択フィールド
    Object.entries(searchParams.select || {}).forEach(([field, value]) => {
      if (value) {
        conditions.push(r[field].equals(value));
      }
    });
    
    // 複数選択
    Object.entries(searchParams.multiSelect || {}).forEach(([field, values]) => {
      if (values && values.length > 0) {
        conditions.push(r[field].in(values));
      }
    });
    
    // すべての条件をANDで結合
    if (conditions.length === 0) {
      return true; // 条件なし = すべて取得
    }
    
    return conditions.reduce((prev, curr) => prev && curr);
  }).build();
}

private collectSearchParameters() {
  const params = {
    text: {},
    numberRange: {},
    select: {},
    multiSelect: {}
  };
  
  // テキスト入力
  this.searchContainer.querySelectorAll('input[data-field-type="text"]').forEach(input => {
    const field = input.dataset.field;
    const value = input.value.trim();
    if (value) {
      params.text[field] = value;
    }
  });
  
  // 数値範囲
  const numberFields = new Set();
  this.searchContainer.querySelectorAll('input[data-field-type^="number-"]').forEach(input => {
    const field = input.dataset.field;
    numberFields.add(field);
  });
  
  numberFields.forEach(field => {
    const minInput = this.searchContainer.querySelector(`input[data-field="${field}"][data-field-type="number-min"]`);
    const maxInput = this.searchContainer.querySelector(`input[data-field="${field}"][data-field-type="number-max"]`);
    
    const range = {};
    if (minInput?.value) range.min = Number(minInput.value);
    if (maxInput?.value) range.max = Number(maxInput.value);
    
    if (Object.keys(range).length > 0) {
      params.numberRange[field] = range;
    }
  });
  
  // 選択フィールド
  this.searchContainer.querySelectorAll('select[data-field-type="select"]').forEach(select => {
    const field = select.dataset.field;
    const value = select.value;
    if (value) {
      params.select[field] = value;
    }
  });
  
  // チェックボックス
  const checkboxGroups = new Map();
  this.searchContainer.querySelectorAll('div[data-field-type="checkbox-group"]').forEach(group => {
    const field = group.dataset.field;
    const checkedValues = Array.from(group.querySelectorAll('input:checked'))
      .map(cb => cb.value);
    
    if (checkedValues.length > 0) {
      params.multiSelect[field] = checkedValues;
    }
  });
  
  return params;
}
```

### 4. サブテーブルの検索

```typescript
// サブテーブルを含む検索の実装例
class AdvancedSearchForm extends KintoneSearchForm {
  private subtables: Record<string, ReturnType<typeof subTable>> = {};
  
  protected buildSearchInterface() {
    super.buildSearchInterface();
    
    // サブテーブルフィールドを検出
    Object.entries(this.formFields.properties).forEach(([code, field]) => {
      if (field.type === FieldTypes.SUBTABLE) {
        this.subtables[code] = subTable(code);
        this.createSubtableSearchUI(code, field);
      }
    });
  }
  
  private createSubtableSearchUI(tableName: string, tableField: any) {
    const group = document.createElement('div');
    group.className = 'subtable-search-group';
    
    const heading = document.createElement('h4');
    heading.textContent = `${tableField.label} 内の検索`;
    group.appendChild(heading);
    
    // サブテーブル内のフィールド
    if (tableField.fields) {
      Object.entries(tableField.fields).forEach(([subCode, subField]: [string, any]) => {
        // IN演算子のみサポート（kintoneの制限）
        if ([FieldTypes.SINGLE_LINE_TEXT, FieldTypes.DROP_DOWN].includes(subField.type)) {
          const input = document.createElement('input');
          input.type = 'text';
          input.dataset.subtable = tableName;
          input.dataset.subfield = subCode;
          input.placeholder = `${subField.label} (カンマ区切りで複数指定)`;
          
          const label = document.createElement('label');
          label.textContent = subField.label;
          
          group.appendChild(label);
          group.appendChild(input);
        }
      });
    }
    
    this.searchContainer.appendChild(group);
  }
  
  protected buildDynamicQuery(): string {
    const baseQuery = super.buildDynamicQuery();
    const subtableConditions = this.buildSubtableConditions();
    
    if (subtableConditions.length === 0) {
      return baseQuery;
    }
    
    // メインクエリとサブテーブル条件を結合
    return kintoneQuery(() => {
      const mainCondition = baseQuery ? baseQuery : true;
      const subConditions = subtableConditions.reduce((prev, curr) => prev && curr);
      
      return mainCondition && subConditions;
    }).build();
  }
  
  private buildSubtableConditions() {
    const conditions = [];
    
    this.searchContainer.querySelectorAll('input[data-subtable]').forEach(input => {
      const tableName = input.dataset.subtable;
      const fieldName = input.dataset.subfield;
      const value = input.value.trim();
      
      if (value && this.subtables[tableName]) {
        const values = value.split(',').map(v => v.trim()).filter(v => v);
        if (values.length > 0) {
          conditions.push(
            this.subtables[tableName][fieldName].in(values)
          );
        }
      }
    });
    
    return conditions;
  }
}
```

### 5. 実際の使用例

```javascript
(function() {
  'use strict';
  
  kintone.events.on('app.record.index.show', async function(event) {
    // 検索フォーム用のコンテナを作成
    const headerSpace = kintone.app.getHeaderMenuSpaceElement();
    const container = document.createElement('div');
    container.id = 'custom-search-form';
    container.style.padding = '10px';
    headerSpace.appendChild(container);
    
    // 検索フォームを初期化
    const searchForm = new AdvancedSearchForm('custom-search-form');
    await searchForm.initialize();
    
    // 検索実行
    searchForm.onSearch = async (query) => {
      try {
        const resp = await kintone.app.getRecords({
          app: kintone.app.getId(),
          query: query,
          fields: event.records.map(r => Object.keys(r)).flat()
        });
        
        // 検索結果でビューを更新
        event.records = resp.records;
        
        // 件数を表示
        alert(`${resp.records.length}件のレコードが見つかりました`);
      } catch (error) {
        console.error('検索エラー:', error);
        alert('検索中にエラーが発生しました');
      }
    };
    
    return event;
  });
})();
```

## エラーハンドリング

```typescript
import { Effect as E, pipe } from 'kintone-functional-query';

// フィールド情報の取得を安全に行う
const safeGetFormFields = () => 
  pipe(
    E.tryPromise(() => kintone.app.getFormFields()),
    E.flatMap(S.decodeUnknown(FormFieldsResponse)),
    E.tapError(error => 
      E.sync(() => console.error('フィールド情報取得エラー:', error))
    ),
    E.catchAll(() => 
      // エラー時はデフォルト値を返す
      E.succeed({
        properties: {},
        revision: '0'
      })
    )
  );

// 使用例
const formFields = await E.runPromise(safeGetFormFields());
```

## パフォーマンスの考慮事項

1. **フィールド情報のキャッシュ**
   ```typescript
   class CachedFormFieldsService {
     private static cache: FormFieldsResponse | null = null;
     private static cacheExpiry: number = 0;
     private static CACHE_DURATION = 30 * 60 * 1000; // 30分
     
     static async getFormFields(): Promise<FormFieldsResponse> {
       const now = Date.now();
       
       if (this.cache && this.cacheExpiry > now) {
         return this.cache;
       }
       
       const fields = await kintone.app.getFormFields();
       this.cache = S.decodeUnknownSync(FormFieldsResponse)(fields);
       this.cacheExpiry = now + this.CACHE_DURATION;
       
       return this.cache;
     }
   }
   ```

2. **検索のデバウンス**
   ```typescript
   private debounce(func: Function, wait: number) {
     let timeout: number;
     return (...args: any[]) => {
       clearTimeout(timeout);
       timeout = setTimeout(() => func.apply(this, args), wait);
     };
   }
   
   // 使用例
   const debouncedSearch = this.debounce(this.executeSearch, 500);
   searchInput.addEventListener('input', debouncedSearch);
   ```

## まとめ

このガイドでは、kintone-functional-query を使用して動的な検索UIを実装する方法を説明しました。

重要なポイント：
- 事前に決まったクエリはCLIでスキーマ生成を推奨
- 動的クエリビルダーはユーザー入力に基づく検索に使用
- フィールドタイプに応じた適切なUIの生成
- エラーハンドリングとパフォーマンスの考慮

より詳細な情報は、[README.md](README.md) を参照してください。