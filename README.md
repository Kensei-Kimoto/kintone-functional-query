# kintone-functional-query

[![CI](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml/badge.svg)](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/kintone-functional-query.svg)](https://badge.fury.io/js/kintone-functional-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Type-safe functional query builder for kintone

[日本語版 README はこちら](README.ja.md)

## Features

- **Query Builder**: Build type-safe kintone queries with lambda expressions
- **CLI Tool**: Auto-generate Effect Schema from kintone API
- **Full Type Support**: Leverage TypeScript's type system to its fullest
- **All Operators**: Support for all kintone query operators

## Overview

kintone-functional-query is a TypeScript library that allows you to write type-safe kintone queries using lambda expressions. Take advantage of IDE auto-completion to build queries intuitively.

## Features

- 🔒 **Type-safe**: Type-safe query construction using TypeScript's type system
- ✨ **Intuitive**: Natural syntax with lambda expressions
- 🚀 **Auto-completion**: Comfortable development experience with IDE auto-completion
- 🔧 **Flexible**: Support for operators, functions, order by, limit, and offset

## Installation

```bash
npm install kintone-functional-query
```

## Usage

### 1. Generate Schema with CLI

```bash
npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/generated
```

#### Generated File Example

```typescript
// ./src/generated/schema.ts
import { Schema as S } from 'effect';
import {
  SingleLineTextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  DropDownFieldSchema,
  UserSelectFieldSchema,
  SubtableFieldSchema,
} from 'kintone-effect-schema';

export const AppSchema = S.Struct({
  CustomerName: SingleLineTextFieldSchema,
  SalesRep: UserSelectFieldSchema,
  Amount: NumberFieldSchema,
  ContractDate: DateFieldSchema,
  Status: DropDownFieldSchema,
  OrderDetails: SubtableFieldSchema(
    S.Struct({
      ProductCode: SingleLineTextFieldSchema,
      ProductName: SingleLineTextFieldSchema,
      Quantity: NumberFieldSchema,
      UnitPrice: NumberFieldSchema,
    })
  ),
});

// Type is automatically exported too!
export type App = S.Schema.Type<typeof AppSchema>;
```

### 2. Build Queries with Generated Types

```typescript
import { kintoneQuery, TODAY, FROM_TODAY, subTable } from 'kintone-functional-query';
import { App } from './generated/schema';

// Simple query
const query1 = kintoneQuery<App>(r =>
  r.CustomerName.equals("Cybozu Inc.")
).build();
// => 'CustomerName = "Cybozu Inc."'

// Multiple conditions
const query2 = kintoneQuery<App>(r =>
  r.CustomerName.equals("Cybozu Inc.") &&
  r.ContractDate.lessThan(TODAY()) &&
  r.Status.notIn(["Completed", "Cancelled"])
).build();
// => '((CustomerName = "Cybozu Inc." and ContractDate < TODAY()) and Status not in ("Completed", "Cancelled"))'

// Full example with orderBy, limit, offset
const query3 = kintoneQuery<App>(r =>
  r.Amount.greaterThan(1000000) &&
  r.ContractDate.greaterThanOrEqual(FROM_TODAY(-30, 'DAYS')) &&
  r.Status.in(["Negotiating", "Ordered"])
)
  .orderBy('Amount', 'desc')
  .limit(100)
  .offset(20)
  .build();
// => '((Amount > 1000000 and ContractDate >= FROM_TODAY(-30, "DAYS")) and Status in ("Negotiating", "Ordered")) order by Amount desc limit 100 offset 20'

// Query with subtable
const OrderDetails = subTable('OrderDetails');
const query4 = kintoneQuery<App>(r =>
  r.CustomerName.like("Corp%") &&
  OrderDetails.ProductCode.in(['P001', 'P002', 'P003']) &&
  OrderDetails.Quantity.greaterThan(100)
)
  .orderBy('ContractDate', 'desc')
  .limit(50)
  .build();
// => '((CustomerName like "Corp%" and OrderDetails.ProductCode in ("P001", "P002", "P003")) and OrderDetails.Quantity > 100) order by ContractDate desc limit 50'
```

### 3. Use in Customization

You can develop type-safely in customizations using CLI-generated types:

```typescript
// customize.ts
import { kintoneQuery, TODAY, FROM_TODAY } from 'kintone-functional-query';
import { App } from './generated/schema';

kintone.events.on('app.record.index.show', (event) => {
  const button = document.createElement('button');
  button.textContent = 'Search Important Deals';
  button.onclick = async () => {
    // Type-safe! Field names are auto-completed
    const query = kintoneQuery<App>(r =>
      r.Priority.equals("High") &&
      r.DueDate.lessThanOrEqual(FROM_TODAY(7, 'DAYS')) &&
      r.Status.notIn(["Completed", "Cancelled"])
    )
      .orderBy('DueDate', 'asc')
      .limit(50)
      .build();
    
    const resp = await kintone.app.getRecords({
      app: kintone.app.getId(),
      query: query
    });
    
    console.log(`Found ${resp.records.length} important deals`);
  };
  
  kintone.app.getHeaderMenuSpaceElement().appendChild(button);
  return event;
});
```

Bundle with webpack or similar tools for use.

## Supported Methods

### Comparison Methods
- `equals(value)`: Equal (`=`)
- `notEquals(value)`: Not equal (`!=`)
- `greaterThan(value)`: Greater than (`>`)
- `lessThan(value)`: Less than (`<`)
- `greaterThanOrEqual(value)`: Greater than or equal (`>=`)
- `lessThanOrEqual(value)`: Less than or equal (`<=`)

### Array Methods
- `in(values)`: In (`in`)
- `notIn(values)`: Not in (`not in`)

### String Methods
- `like(pattern)`: Pattern match (`like`)
- `notLike(pattern)`: Pattern not match (`not like`)

### Null Check Methods
- `isEmpty()`: Is empty (`is empty`)
- `isNotEmpty()`: Is not empty (`is not empty`)

### Logical Operators
- `&&`: AND condition
- `||`: OR condition

## Supported Functions

### Date/Time Functions
- `TODAY()`: Today's date
- `NOW()`: Current datetime
- `YESTERDAY()`: Yesterday
- `TOMORROW()`: Tomorrow
- `FROM_TODAY(days, unit?)`: Relative date from today
- `THIS_WEEK()`: This week
- `LAST_WEEK()`: Last week
- `NEXT_WEEK()`: Next week
- `THIS_MONTH()`: This month
- `LAST_MONTH()`: Last month
- `NEXT_MONTH()`: Next month
- `THIS_YEAR()`: This year

### User/Organization Functions
- `LOGINUSER()`: Login user
- `PRIMARY_ORGANIZATION()`: Primary organization

## Subtable Support

```typescript
import { kintoneQuery, subTable } from 'kintone-functional-query';

// Define subtable
const OrderDetails = subTable('OrderDetails');

// Query with subtable
const query = kintoneQuery(() => 
  OrderDetails.ProductCode.in(['P001', 'P002'])
).build();
// => 'OrderDetails.ProductCode in ("P001", "P002")'

// Combine with main table
const query = kintoneQuery(r =>
  r.CustomerName.like("Corp%") &&
  OrderDetails.Quantity.greaterThan(100)
).build();
// => '(CustomerName like "Corp%" and OrderDetails.Quantity > 100)'
```

**Note**: Due to kintone specifications, `equals` and `notEquals` cannot be used with subtables.

## Complex Condition Combinations

### Basic Precedence
```typescript
// (A && B) || C pattern
const query1 = kintoneQuery<App>(r =>
  (r.Status.equals("Negotiating") && r.Probability.greaterThan(70)) ||
  r.SalesRep.in([LOGINUSER()])
).build();
// => '((Status = "Negotiating" and Probability > 70) or SalesRep in (LOGINUSER()))'

// A && (B || C) pattern
const query2 = kintoneQuery<App>(r =>
  r.Amount.greaterThan(1000000) &&
  (r.Priority.equals("High") || r.DueDate.lessThan(TODAY()))
).build();
// => '(Amount > 1000000 and (Priority = "High" or DueDate < TODAY()))'
```

### Nested Conditions
```typescript
// ((A || B) && C) || (D && E) pattern
const query3 = kintoneQuery<App>(r =>
  ((r.Status.equals("Negotiating") || r.Status.equals("Quote Sent")) &&
   r.Amount.greaterThan(1000000)) ||
  (r.Priority.equals("High") && r.DueDate.lessThan(TODAY()))
).build();
// => '(((Status = "Negotiating" or Status = "Quote Sent") and Amount > 1000000) or (Priority = "High" and DueDate < TODAY()))'
```

### Practical Complex Query
```typescript
// Sales opportunity priority determination
const complexQuery = kintoneQuery<App>(r =>
  // High priority conditions
  (
    (r.Probability.greaterThanOrEqual(80) && r.Amount.greaterThan(5000000)) ||
    (r.DueDate.lessThanOrEqual(FROM_TODAY(7, 'DAYS')) && r.Status.notEquals("Lost"))
  ) &&
  // Common conditions
  r.SalesRep.in([LOGINUSER()]) &&
  // Exclusion conditions
  r.CustomerCategory.notIn(["Dormant", "Blacklist"])
)
  .orderBy('Amount', 'desc')
  .limit(20)
  .build();
// => '((((Probability >= 80 and Amount > 5000000) or (DueDate <= FROM_TODAY(7, "DAYS") and Status != "Lost")) and SalesRep in (LOGINUSER())) and CustomerCategory not in ("Dormant", "Blacklist")) order by Amount desc limit 20'
```

### Complex Conditions with Subtables
```typescript
const ProductDetails = subTable('ProductDetails');

const advancedQuery = kintoneQuery<App>(r =>
  (
    // Customer conditions
    (r.CustomerName.like("%Corp%") || r.CustomerName.like("%Ltd%")) &&
    r.ContractDate.greaterThanOrEqual(THIS_MONTH())
  ) &&
  (
    // Subtable conditions (high-value products or bulk purchases)
    ProductDetails.ProductCategory.in(["A", "B"]) ||
    (ProductDetails.UnitPrice.greaterThan(10000) && ProductDetails.Quantity.greaterThan(10))
  ) &&
  // Status conditions
  (
    r.Status.equals("Ordered") ||
    (r.Status.equals("Negotiating") && r.Probability.greaterThanOrEqual(70))
  )
).build();
// => '((((CustomerName like "%Corp%" or CustomerName like "%Ltd%") and ContractDate >= THIS_MONTH()) and (ProductDetails.ProductCategory in ("A", "B") or (ProductDetails.UnitPrice > 10000 and ProductDetails.Quantity > 10))) and (Status = "Ordered" or (Status = "Negotiating" and Probability >= 70)))'
```

### About Logical Operation Precedence
- Follows JavaScript operator precedence (`&&` has higher precedence than `||`)
- Use parentheses explicitly to ensure intended precedence
- Generated queries will have all logical operations properly parenthesized

## Query Parser

Parse existing kintone query strings into AST (Abstract Syntax Tree) for analysis and manipulation.

### Basic Usage

```typescript
import { parseKintoneQuery } from 'kintone-functional-query';

// Parse a query string
const query = 'Status = "Open" and Priority > 5';
const ast = parseKintoneQuery(query);

console.log(ast);
// {
//   type: "and",
//   left: { field: "Status", operator: "=", value: "Open" },
//   right: { field: "Priority", operator: ">", value: 5 }
// }
```

### Advanced Examples

```typescript
// Parse complex queries with functions
const complexQuery = '(Status = "Open" or Status = "Pending") and DueDate <= FROM_TODAY(7, "DAYS")';
const ast = parseKintoneQuery(complexQuery);

// Extract field names from AST
function extractFields(expr) {
  const fields = [];
  function traverse(node) {
    if ('field' in node) {
      fields.push(node.field);
    } else if (node.type === 'and' || node.type === 'or') {
      traverse(node.left);
      traverse(node.right);
    }
  }
  traverse(expr);
  return [...new Set(fields)];
}

console.log(extractFields(ast)); // ["Status", "DueDate"]

// Modify conditions in AST
function modifyFieldValue(expr, targetField, newValue) {
  if ('field' in expr && expr.field === targetField) {
    return { ...expr, value: newValue };
  } else if (expr.type === 'and' || expr.type === 'or') {
    return {
      ...expr,
      left: modifyFieldValue(expr.left, targetField, newValue),
      right: modifyFieldValue(expr.right, targetField, newValue)
    };
  }
  return expr;
}

const modifiedAst = modifyFieldValue(ast, 'Status', 'Closed');
```

### Supported Query Syntax

The parser supports all kintone query syntax including:
- All comparison operators (`=`, `!=`, `>`, `<`, `>=`, `<=`)
- Array operators (`in`, `not in`)
- String operators (`like`, `not like`)
- Empty checks (`is empty`, `is not empty`)
- Logical operators (`and`, `or`)
- Functions (e.g., `TODAY()`, `LOGINUSER()`, `FROM_TODAY()`)
- Subtable fields (e.g., `Table.Field`)

## Frontend Usage

For frontend usage (kintone customizations/plugins), there are two approaches depending on what you're developing.

### A. Specific App Customization Development (Recommended)

**Target**: When developing customizations for a specific kintone app
**Feature**: Type-safe development since field configuration is known in advance

📖 **For detailed guide, see [CUSTOMIZATION_GUIDE.md](CUSTOMIZATION_GUIDE.md)**

#### 1. Preparation (Generate Schema with CLI)

```bash
# Generate schema for Sales Management App (ID: 123)
npx kintone-query-gen generate \
  --domain your-domain.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/schemas
```

#### 2. Type-safe Customization Development

```typescript
// sales-customize.ts
import { kintoneQuery, TODAY, LOGINUSER } from 'kintone-functional-query';
import { SalesApp } from './schemas/sales-app-schema';  // CLI-generated type

kintone.events.on('app.record.index.show', (event) => {
  // Type-safe! IDE auto-completes field names
  const myUrgentDeals = kintoneQuery<SalesApp>(r =>
    r.SalesRep.in([LOGINUSER()]) &&
    r.Probability.greaterThanOrEqual(70) &&
    r.NextActionDate.lessThanOrEqual(TODAY()) &&
    r.Status.notEquals("Lost")
  )
    .orderBy('ExpectedAmount', 'desc')
    .limit(10)
    .build();
  
  // Add button
  const button = createButton('Action Required Deals', async () => {
    const records = await kintone.app.getRecords({
      app: kintone.app.getId(),
      query: myUrgentDeals
    });
    showModal(`${records.length} deals require action`);
  });
  
  kintone.app.getHeaderSpaceElement().appendChild(button);
  return event;
});
```

**Benefits**:
- 🔒 Compile-time error detection (field name typos, etc.)
- 📝 IDE auto-completion for field names and types
- 🚀 Safe refactoring (trackable when field names change)
- 📖 Readable and maintainable code

### B. Universal Plugin Development

**Target**: When developing universal plugins that work across multiple apps
**Feature**: Need to dynamically process based on runtime field information

#### 1. Dynamic Field Information Retrieval and Validation

```typescript
import { kintoneQuery, FormFieldsResponse, S, FieldTypes } from 'kintone-functional-query';

// Universal search plugin implementation example
class UniversalSearchPlugin {
  private formFields: FormFieldsResponse;
  
  async initialize() {
    try {
      // Get field information at runtime to work with any app
      const fieldsData = await kintone.app.getFormFields();
      this.formFields = S.decodeUnknownSync(FormFieldsResponse)(fieldsData);
      
      // Dynamically generate search UI based on app
      this.renderSearchInterface();
    } catch (error) {
      console.error('Plugin initialization error:', error);
      this.showError('Cannot use plugin with this app');
    }
  }
  
  // Generate appropriate search UI based on field type
  private renderSearchInterface() {
    const searchableFields = this.getSearchableFields();
    const container = this.createSearchContainer();
    
    searchableFields.forEach(([fieldCode, fieldInfo]) => {
      // Generate input UI based on field type
      const inputElement = this.createSearchInput(fieldCode, fieldInfo);
      container.appendChild(inputElement);
    });
  }
  
  // Build query dynamically (field names determined at runtime)
  buildDynamicQuery(searchParams: Record<string, any>): string {
    return kintoneQuery(r => {
      const conditions = [];
      
      Object.entries(searchParams).forEach(([fieldCode, value]) => {
        const fieldInfo = this.formFields.properties[fieldCode];
        if (!fieldInfo || !value) return;
        
        // Generate conditions based on field type
        switch (fieldInfo.type) {
          case FieldTypes.SINGLE_LINE_TEXT:
          case FieldTypes.MULTI_LINE_TEXT:
            conditions.push(r[fieldCode].like(`%${value}%`));
            break;
            
          case FieldTypes.NUMBER:
          case FieldTypes.CALC:
            if (value.min !== undefined) {
              conditions.push(r[fieldCode].greaterThanOrEqual(value.min));
            }
            if (value.max !== undefined) {
              conditions.push(r[fieldCode].lessThanOrEqual(value.max));
            }
            break;
            
          case FieldTypes.DROP_DOWN:
          case FieldTypes.RADIO_BUTTON:
            conditions.push(r[fieldCode].equals(value));
            break;
            
          case FieldTypes.CHECK_BOX:
          case FieldTypes.MULTI_SELECT:
            if (Array.isArray(value) && value.length > 0) {
              conditions.push(r[fieldCode].in(value));
            }
            break;
        }
      });
      
      return conditions.length > 0 
        ? conditions.reduce((a, b) => a && b)
        : true;  // No conditions = all records
    }).build();
  }
}

// Plugin usage example
kintone.events.on(['app.record.index.show'], async (event) => {
  const plugin = new UniversalSearchPlugin();
  await plugin.initialize();
  
  // Search execution button
  document.getElementById('plugin-search-btn').onclick = async () => {
    const searchParams = plugin.collectSearchParams();
    const query = plugin.buildDynamicQuery(searchParams);
    
    const records = await kintone.app.getRecords({
      app: kintone.app.getId(),
      query: query
    });
    
    plugin.displayResults(records);
  };
  
  return event;
});
```

#### 2. Error Handling and Fallback

```typescript
import { Effect as E, pipe } from 'kintone-functional-query';

// Safe field information retrieval in universal plugins
class SafeFieldManager {
  static async getFields() {
    return pipe(
      E.tryPromise(() => kintone.app.getFormFields()),
      E.flatMap(S.decodeUnknown(FormFieldsResponse)),
      E.tap(fields => 
        E.sync(() => console.log(`Detected ${Object.keys(fields.properties).length} fields`))
      ),
      E.catchAll(error => {
        console.error('Failed to get field information:', error);
        // Continue operation with minimal functionality
        return E.succeed({
          properties: {},
          revision: '0'
        });
      })
    );
  }
  
  // Safe field type determination
  static isSearchable(field: any): boolean {
    const searchableTypes = [
      FieldTypes.SINGLE_LINE_TEXT,
      FieldTypes.NUMBER,
      FieldTypes.DATE,
      FieldTypes.DROP_DOWN
    ];
    
    return field?.type && searchableTypes.includes(field.type);
  }
}
```

**Benefits**:
- 🌍 Universal functionality across any app
- 🔧 Flexible runtime handling
- 🛡️ Can handle unknown field types
- 📦 Create once, reuse across multiple apps

**Drawbacks**:
- ⚠️ Errors not known until runtime
- 🔍 No IDE auto-completion
- 🐛 Harder to debug
- 📚 Code tends to be complex

### Usage Guidelines

| Case | Recommended Approach | Reason |
|------|---------------------|--------|
| Company-specific app customization | A. Type-safe development | Field configuration known in advance |
| Customer-delivered customization | A. Type-safe development | Quality assurance is important |
| kintone App Store plugin | B. Universal development | Must work with unspecified apps |
| Internal tool for multiple departments | B. Universal development | Different app configurations per department |

For detailed implementation examples, see [Dynamic Query Builder Guide](FRONTEND_GUIDE.md).

## Development

```bash
# Install dependencies
npm install

# Test
npm test

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT