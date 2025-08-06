# kintone-functional-query

[![CI](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml/badge.svg)](https://github.com/kimotokensei/kintone-functional-query/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/kintone-functional-query.svg)](https://badge.fury.io/js/kintone-functional-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Type-safe functional query builder for kintone

[日本語版 README はこちら](README.ja.md)

## Overview

kintone-functional-query is a TypeScript library that allows you to write type-safe kintone queries using lambda expressions. Take advantage of IDE auto-completion to build queries intuitively.

## Features

- 🔒 **Type-safe**: Type-safe query construction using TypeScript's type system
- ✨ **Intuitive**: Natural syntax with lambda expressions  
- 🚀 **Auto-completion**: Comfortable development experience with IDE auto-completion
- 🔧 **Flexible**: Support for operators, functions, multiple sorting, and pagination
- 🛡️ **Runtime Validation**: Effect-TS powered schema validation for enhanced safety
- 📊 **Advanced Logging**: Structured logging with contextual information for debugging
- 🏭 **Batch Generation**: Generate schemas for multiple apps with configuration files
- ⚡ **API Validation**: Built-in kintone API limits validation (500 records, 10k offset)
- 🌐 **kintone-as-code Integration**: Compatible with existing kintone-as-code workflows

## Installation

```bash
npm install kintone-functional-query
```

## Usage

### 1. Generate Schema with CLI

#### Single App Generation

```bash
npx kintone-query-gen generate \
  --domain example.cybozu.com \
  --app-id 123 \
  --api-token YOUR_API_TOKEN \
  --output ./src/generated
```

#### Batch Generation with Configuration File

```bash
# Generate schemas for multiple apps
npx kintone-query-gen batch --config ./kintone.config.js

# Use different environment
npx kintone-query-gen batch --env development

# Dry run to see what would be generated
npx kintone-query-gen batch --dry-run

# Control parallel processing
npx kintone-query-gen batch --parallel 5
```

#### Configuration File (kintone-functional-query.config.js)

```javascript
export default {
  default: 'production',
  environments: {
    production: {
      auth: {
        baseUrl: 'https://your-domain.cybozu.com',
        apiToken: process.env.KINTONE_API_TOKEN,
      }
    },
    development: {
      auth: {
        baseUrl: 'https://dev-domain.cybozu.com',
        apiToken: process.env.KINTONE_DEV_TOKEN,
      }
    }
  },
  apps: [
    {
      appId: '123',
      name: 'Sales Management',
      outputPath: './schemas/sales',
      schemaName: 'SalesSchema'
    },
    {
      appId: '456', 
      name: 'Customer Database',
      outputPath: './schemas/customer'
    }
  ],
  output: {
    baseDir: 'generated',
    indexFile: true
  }
};
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

// Multiple sorting and API validation
const query3 = kintoneQuery<App>(r =>
  r.Amount.greaterThan(1000000) &&
  r.ContractDate.greaterThanOrEqual(FROM_TODAY(-30, 'DAYS')) &&
  r.Status.in(["Negotiating", "Ordered"])
)
  .orderBy('Priority', 'desc')     // Primary sort
  .orderBy('Amount', 'desc')       // Secondary sort
  .orderBy('ContractDate', 'asc')  // Tertiary sort
  .limit(100)                      // ✅ Validated: 1-500 only
  .offset(50)                      // ✅ Validated: 0-10000 only
  .build();
// => '((Amount > 1000000 and ContractDate >= FROM_TODAY(-30, "DAYS")) and Status in ("Negotiating", "Ordered")) order by Priority desc, Amount desc, ContractDate asc limit 100 offset 50'

// Bulk sorting with orderByMany
const query3b = kintoneQuery<App>(r =>
  r.Status.equals("Active")
)
  .orderByMany([
    { field: 'Priority', direction: 'desc' },
    { field: 'DueDate', direction: 'asc' },
    { field: 'Amount', direction: 'desc' }
  ])
  .limit(500)  // Maximum allowed by kintone API
  .build();
// => 'Status = "Active" order by Priority desc, DueDate asc, Amount desc limit 500'

// Query with subtable and API validation
const OrderDetails = subTable('OrderDetails');
const query4 = kintoneQuery<App>(r =>
  r.CustomerName.like("Corp%") &&
  OrderDetails.ProductCode.in(['P001', 'P002', 'P003']) &&
  OrderDetails.Quantity.greaterThan(100)
)
  .orderBy('ContractDate', 'desc')
  .limit(50)   // ✅ Within API limits
  .build();
// => '((CustomerName like "Corp%" and OrderDetails.ProductCode in ("P001", "P002", "P003")) and OrderDetails.Quantity > 100) order by ContractDate desc limit 50'

// ❌ These would throw validation errors:
// .limit(501)    // Error: limit() must be between 1 and 500
// .offset(10001) // Error: offset() must be between 0 and 10000
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

## Batch Generation

Generate schemas for multiple kintone apps efficiently using configuration files.

### Configuration File Compatibility

This library is compatible with `kintone-as-code` configuration format, allowing seamless integration:

```javascript
// kintone-functional-query.config.js (or kintone-as-code.config.js)
export default {
  default: 'production',
  environments: {
    production: {
      auth: {
        baseUrl: 'https://your-company.cybozu.com',
        apiToken: process.env.KINTONE_API_TOKEN,
      }
    },
    development: {
      auth: {
        baseUrl: 'https://dev.cybozu.com', 
        username: process.env.KINTONE_USERNAME,
        password: process.env.KINTONE_PASSWORD,
      }
    }
  },
  apps: [
    {
      appId: process.env.SALES_APP_ID || '123',
      name: 'Sales Management',
      outputPath: './schemas/sales',
      schemaName: 'SalesAppSchema'
    },
    {
      appId: process.env.CUSTOMER_APP_ID || '456',
      name: 'Customer Database', 
      outputPath: './schemas/customer'
    }
  ],
  output: {
    baseDir: 'generated',
    indexFile: true,
    format: 'typescript'
  }
};
```

### Batch Commands

```bash
# Generate all configured apps
kintone-query-gen batch

# Use specific config file
kintone-query-gen batch --config ./custom-config.js

# Use different environment
kintone-query-gen batch --env development

# Preview what will be generated
kintone-query-gen batch --dry-run

# Control parallelism (default: 3)
kintone-query-gen batch --parallel 5

# Generate specific environment with custom parallelism
kintone-query-gen batch --env production --parallel 8
```

### Workflow Integration

```bash
# Typical development workflow
kintone-as-code export --app-id 123 --name sales-app
kintone-query-gen batch --config kintone-as-code.config.js

# CI/CD pipeline
kintone-query-gen batch --env production --dry-run  # Verify
kintone-query-gen batch --env production            # Execute
```

## Multiple Sorting & API Validation

### Multiple Sort Fields

Chain `.orderBy()` calls or use `.orderByMany()` for complex sorting:

```typescript
// Method chaining approach
const query1 = kintoneQuery<App>(r => r.Status.equals('Active'))
  .orderBy('Priority', 'desc')      // Primary sort
  .orderBy('DueDate', 'asc')        // Secondary sort  
  .orderBy('Amount', 'desc')        // Tertiary sort
  .build();

// Bulk approach
const query2 = kintoneQuery<App>(r => r.Status.equals('Active'))
  .orderByMany([
    { field: 'Priority', direction: 'desc' },
    { field: 'DueDate', direction: 'asc' },
    { field: 'Amount', direction: 'desc' }
  ])
  .build();

// Both generate: 'Status = "Active" order by Priority desc, DueDate asc, Amount desc'
```

### API Limits Validation

Built-in validation prevents kintone API limit violations:

```typescript
// ✅ Valid - within kintone API limits
const validQuery = kintoneQuery<App>(r => r.Status.equals('Active'))
  .limit(500)    // Maximum allowed by kintone
  .offset(10000) // Maximum allowed by kintone
  .build();

// ❌ These throw validation errors immediately:
try {
  kintoneQuery<App>(r => r.Status.equals('Active'))
    .limit(501)    // Error: limit() must be between 1 and 500, got 501
    .build();
} catch (error) {
  console.error(error.message);
}

try {
  kintoneQuery<App>(r => r.Status.equals('Active'))
    .offset(10001) // Error: offset() must be between 0 and 10000, got 10001
    .build();
} catch (error) {
  console.error(error.message);
}

// ❌ Non-integer values also trigger errors
builder.limit(50.5);  // Error: limit() must be an integer, got 50.5
```

### Benefits of API Validation

- **Fail Fast**: Catch limit violations at build time, not runtime
- **Clear Error Messages**: Understand exactly what went wrong and why
- **Development Efficiency**: No need to remember kintone API constraints
- **Production Safety**: Prevent failed API calls in production environments

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

## Complete Query AST & Advanced Manipulation (Phase 3)

**New in v0.3.0**: Advanced AST-based query manipulation with full kintone query support including ORDER BY, LIMIT, and OFFSET clauses.

### Complete Query Parsing

Parse complete kintone queries (not just WHERE clauses) into structured AST:

```typescript
import { parseKintoneQueryComplete } from 'kintone-functional-query';

// Parse complete query with ORDER BY, LIMIT, OFFSET
const complexQuery = 'Status = "Open" and Priority >= 3 order by Priority desc, DueDate asc limit 50 offset 10';
const ast = parseKintoneQueryComplete(complexQuery);

console.log(ast);
// {
//   where: {
//     type: "and",
//     left: { field: "Status", operator: "=", value: "Open" },
//     right: { field: "Priority", operator: ">=", value: 3 }
//   },
//   orderBy: [
//     { field: "Priority", direction: "desc" },
//     { field: "DueDate", direction: "asc" }
//   ],
//   limit: 50,
//   offset: 10
// }
```

### Bidirectional Query Conversion

Convert between query strings and AST seamlessly:

```typescript
import { queryConverter, astToQuery } from 'kintone-functional-query';

// Create converter from query string
const converter = queryConverter('Status = "Open" limit 25');

// Access and modify AST
console.log(converter.ast.limit); // 25

// Modify query programmatically
const modified = converter
  .setLimit(100)
  .setOrderBy([{ field: 'Priority', direction: 'desc' }])
  .setOffset(20);

console.log(modified.toQuery()); 
// "Status = "Open" order by Priority desc limit 100 offset 20"
```

### Advanced Query Transformation

Transform queries using callback functions:

```typescript
import { transformQuery, combineQueries } from 'kintone-functional-query';

// Add pagination to any query
const addPagination = (query: string, page: number, pageSize: number) =>
  transformQuery(query, ast => {
    ast.limit = pageSize;
    ast.offset = (page - 1) * pageSize;
  });

const paginatedQuery = addPagination('Status = "Open"', 2, 25);
// "Status = "Open" limit 25 offset 25"

// Combine multiple filters with AND logic
const combinedFilters = combineQueries([
  'Status = "Open"',
  'Priority >= 3',
  'AssignedTo = LOGINUSER()'
]);
// "((Status = "Open" and Priority >= 3) and AssignedTo = LOGINUSER())"
```

### Query Component Extraction

Extract and analyze specific parts of queries:

```typescript
import { extractQueryComponents } from 'kintone-functional-query';

const components = extractQueryComponents(
  'Status = "Open" and Priority > 3 order by Priority desc limit 50 offset 10'
);

console.log({
  whereQuery: components.whereQuery,     // "(Status = "Open" and Priority > 3)"
  orderBy: components.orderBy,           // [{ field: "Priority", direction: "desc" }]
  limit: components.limit,               // 50
  offset: components.offset,             // 10
  hasWhere: components.hasWhere,         // true
  hasOrderBy: components.hasOrderBy,     // true
  sortFieldCount: components.sortFieldCount // 1
});
```

### GUI Query Builder Foundation

The complete AST support provides the foundation for building visual query builders:

```typescript
// Perfect for GUI applications that need to:
// 1. Parse existing queries into editable components
// 2. Validate query structure and API limits
// 3. Generate queries from visual components
// 4. Support undo/redo operations
// 5. Template and snippet management

const queryEditor = {
  load: (queryString: string) => queryConverter(queryString),
  
  save: (converter: any) => converter.toQuery(),
  
  addFilter: (converter: any, field: string, op: string, value: any) =>
    converter.modify(ast => {
      const newCondition = { field, operator: op, value };
      ast.where = ast.where ? {
        type: 'and',
        left: ast.where,
        right: newCondition
      } : newCondition;
    }),
    
  setSort: (converter: any, sorts: Array<{field: string, direction: 'asc'|'desc'}>) =>
    converter.setOrderBy(sorts)
};
```

### API Validation & Safety

All AST operations include built-in kintone API validation:

```typescript
// ✅ Valid operations
queryConverter('Status = "Open"').setLimit(500);    // Max allowed
queryConverter('Status = "Open"').setOffset(10000); // Max allowed

// ❌ These throw validation errors
queryConverter('Status = "Open"').setLimit(501);    // Over API limit
queryConverter('Status = "Open"').setOffset(10001); // Over API limit
queryConverter('Status = "Open"').setLimit(50.5);   // Non-integer
```

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

## Advanced Features

### Runtime Validation with Effect-TS

The library provides runtime validation for query expressions:

```typescript
import { kintoneQuery, Logger } from 'kintone-functional-query';

// Enable debug logging
process.env.DEBUG = 'true';

const query = kintoneQuery<App>(r => 
  r.Status.equals('Active') &&
  r.Priority.greaterThan('invalid-number') // This will log validation warning
).build();

// Validation warnings are logged with structured context:
// [kintone-query:WARN] Expression validation failed: Expected number, actual "invalid-number" 
// (module=proxy function=createValidatedExpression field=Priority operator=>)
```

### Advanced Logging

```typescript
import { Logger } from 'kintone-functional-query';

// Custom logging with context
Logger.warn('Custom validation failed', {
  module: 'my-module',
  function: 'validateInput',
  field: 'customerName',
  value: userInput
});

// Structured logs automatically include module, function, and field information
```

### Function Argument Validation

Date functions now have strict argument validation:

```typescript
import { FROM_TODAY } from 'kintone-functional-query';

// Valid usage
FROM_TODAY(7, 'DAYS');    // ✅ Valid
FROM_TODAY(-30);          // ✅ Valid

// Invalid usage (throws validation errors)
FROM_TODAY(500);          // ❌ Out of range (-365 to 365)
FROM_TODAY(5, 'HOURS');   // ❌ Invalid unit (must be DAYS/WEEKS/MONTHS/YEARS)
FROM_TODAY('not-number'); // ❌ Invalid type (must be number)
```

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