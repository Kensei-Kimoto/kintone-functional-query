import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERATED_METADATA_PREFIX,
  generateFieldModule,
  readGeneratedMetadata,
  type KintoneFormFieldsSchema,
} from "../src/index.ts";
import { QueryValidationError } from "../src/errors.ts";

test("generateFieldModule emits metadata, system fields, and typed field descriptors", () => {
  const schema: KintoneFormFieldsSchema = {
    revision: "17",
    properties: {
      CustomerName: {
        type: "SINGLE_LINE_TEXT",
        code: "CustomerName",
      },
      UpdatedBy: {
        type: "MODIFIER",
        code: "UpdatedBy",
      },
      Status: {
        type: "DROP_DOWN",
        code: "Status",
        options: {
          Qualified: { index: 0 },
          Won: { index: 1 },
        },
      },
      OrderDetails: {
        type: "SUBTABLE",
        code: "OrderDetails",
        fields: {
          ProductCode: {
            type: "SINGLE_LINE_TEXT",
            code: "OrderDetails.ProductCode",
          },
        },
      },
      Company_DB: {
        type: "REFERENCE_TABLE",
        code: "Company_DB",
        referenceTable: {
          displayFields: ["company_name", "created_on"],
        },
        fields: {
          company_name: {
            type: "SINGLE_LINE_TEXT",
            code: "Company_DB.company_name",
          },
          created_on: {
            type: "DATE",
            code: "Company_DB.created_on",
          },
        },
      },
    },
  };

  const source = generateFieldModule({
    appId: "42",
    schema,
    generatedAt: "2026-04-23T00:00:00.000Z",
  });

  assert.match(source, /export const appMetadata/u);
  assert.match(source, /export const systemFields/u);
  assert.match(source, /import \{[^}]*modifier[^}]*\} from "kintone-functional-query";/u);
  assert.match(source, /CustomerName: text\("CustomerName"\)/u);
  assert.match(source, /UpdatedBy: modifier\("UpdatedBy"\)/u);
  assert.match(source, /Status: dropDown\("Status", \["Qualified", "Won"\] as const\)/u);
  assert.match(source, /OrderDetails: subtable/u);
  assert.match(source, /Company_DB: relatedRecords\("Company_DB"/u);
  assert.match(
    source,
    /company_name: text\("Company_DB\.company_name", \{ scope: "RELATED_RECORDS" \}\)/u,
  );
  assert.match(
    source,
    /created_on: date\("Company_DB\.created_on", \{ scope: "RELATED_RECORDS" \}\)/u,
  );
  assert.match(source, /\$id: recordId\("\$id"\)/u);

  assert.deepEqual(readGeneratedMetadata(source), {
    appId: "42",
    revision: "17",
    generatedAt: "2026-04-23T00:00:00.000Z",
  });
});

test("generateFieldModule falls back to unknown related-record fields when nested types are unavailable", () => {
  const schema: KintoneFormFieldsSchema = {
    revision: "18",
    properties: {
      Company_DB: {
        type: "REFERENCE_TABLE",
        code: "Company_DB",
        referenceTable: {
          displayFields: ["company_name"],
        },
      },
    },
  };

  const source = generateFieldModule({
    appId: "42",
    schema,
    generatedAt: "2026-04-23T00:00:00.000Z",
  });

  assert.match(source, /Company_DB: relatedRecords\("Company_DB"/u);
  assert.match(
    source,
    /company_name: unknownField\("Company_DB\.company_name", "UNKNOWN", \{ scope: "RELATED_RECORDS" \}\)/u,
  );
});

test("readGeneratedMetadata throws a typed error for malformed metadata", () => {
  assert.throws(
    () =>
      readGeneratedMetadata(
        `${GENERATED_METADATA_PREFIX}{"appId":"42","revision":"17","generatedAt":}\nexport const fields = {};`,
      ),
    (error: unknown) => {
      assert.ok(error instanceof QueryValidationError);
      assert.match(error.message, /Failed to parse generated module metadata/u);
      return true;
    },
  );
});
