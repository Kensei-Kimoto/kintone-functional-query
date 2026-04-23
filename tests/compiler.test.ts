import assert from "node:assert/strict";
import test from "node:test";

import {
  attachment,
  and,
  ascending,
  compileCondition,
  compileOrderBy,
  compileQuery,
  contains,
  date,
  dropDown,
  equals,
  fromToday,
  greaterThanOrEqual,
  isEmpty,
  isIn,
  loginUser,
  numberField,
  or,
  organizationSelect,
  primaryOrganization,
  rawCondition,
  recordId,
  richText,
  status,
  text,
  today,
  userSelect,
} from "../src/index.ts";

test("compileCondition composes descriptive builders into a Kintone condition string", () => {
  const fields = {
    customerName: text("CustomerName"),
    amount: numberField("Amount"),
    contractDate: date("ContractDate"),
  } as const;

  const condition = and(
    contains(fields.customerName, "Acme"),
    isIn(fields.customerName, ["Acme", "Cybozu"]),
    rawCondition("Amount >= 1000"),
  );

  assert.equal(
    compileCondition(condition),
    'CustomerName like "Acme" and CustomerName in ("Acme", "Cybozu") and Amount >= 1000',
  );
});

test("compileCondition preserves logical precedence for nested groups", () => {
  const fields = {
    customerName: text("CustomerName"),
    contractDate: date("ContractDate"),
    status: status("Status"),
  } as const;

  const condition = or(
    and(
      equals(fields.status, "Qualified"),
      greaterThanOrEqual(fields.contractDate, today()),
    ),
    and(
      equals(fields.status, "Won"),
      contains(fields.customerName, "Cybozu"),
    ),
  );

  assert.equal(
    compileCondition(condition),
    'Status = "Qualified" and ContractDate >= TODAY() or Status = "Won" and CustomerName like "Cybozu"',
  );
});

test("compileCondition adds parentheses when lower-precedence groups are nested", () => {
  const fields = {
    customerName: text("CustomerName"),
    contractDate: date("ContractDate"),
    status: status("Status"),
  } as const;

  const condition = and(
    equals(fields.status, "Qualified"),
    or(
      greaterThanOrEqual(fields.contractDate, today()),
      contains(fields.customerName, "Cybozu"),
    ),
  );

  assert.equal(
    compileCondition(condition),
    'Status = "Qualified" and (ContractDate >= TODAY() or CustomerName like "Cybozu")',
  );
});

test("compileQuery emits condition plus ordered query options", () => {
  const query = compileQuery({
    condition: and(
      isIn(text("Status"), ["Qualified", "Won"]),
      rawCondition("ContractDate >= TODAY()"),
    ),
    orderBy: [ascending(recordId("$id"))],
    limit: 100,
    offset: 0,
  });

  assert.equal(
    query,
    'Status in ("Qualified", "Won") and ContractDate >= TODAY() order by $id asc limit 100 offset 0',
  );
});

test("compileOrderBy emits order clauses for condition-based client APIs", () => {
  const orderBy = compileOrderBy([
    ascending(recordId("$id")),
    {
      field: numberField("Amount"),
      direction: "desc",
    },
  ]);

  assert.equal(orderBy, "$id asc, Amount desc");
});

test("compileQuery escapes strings and query functions correctly", () => {
  const condition = and(
    contains(text("Title"), 'A "quoted" value'),
    rawCondition(`Created_at >= ${compileCondition(rawCondition(`Created_at >= ${'FROM_TODAY(3, "DAYS")'}`)).replace("Created_at >= ", "")}`),
  );

  assert.equal(
    compileCondition(condition),
    'Title like "A \\"quoted\\" value" and Created_at >= FROM_TODAY(3, "DAYS")',
  );
});

test("fromToday works as a comparison value", () => {
  const condition = compileCondition({
    kind: "comparison",
    operator: ">=",
    field: date("Created_at"),
    value: fromToday(3, "DAYS"),
  });

  assert.equal(condition, 'Created_at >= FROM_TODAY(3, "DAYS")');
});

test("field-specific query functions compile for compatible fields", () => {
  assert.equal(
    compileCondition(equals(date("DueDate"), today())),
    "DueDate = TODAY()",
  );

  assert.equal(
    compileCondition(isIn(userSelect("Assignee"), loginUser())),
    "Assignee in (LOGINUSER())",
  );

  assert.equal(
    compileCondition(isIn(organizationSelect("Department"), primaryOrganization())),
    "Department in (PRIMARY_ORGANIZATION())",
  );
});

test("compileQuery rejects invalid limit and offset values", () => {
  assert.throws(
    () =>
      compileQuery({
        condition: rawCondition("$id > 0"),
        limit: 501,
      }),
    /limit must be an integer between 1 and 500/u,
  );

  assert.throws(
    () =>
      compileQuery({
        condition: rawCondition("$id > 0"),
        offset: 10001,
      }),
    /offset must be an integer between 0 and 10000/u,
  );
});

test("rawCondition requires a non-empty string", () => {
  assert.throws(() => rawCondition("   "), /rawCondition/u);
});

test("runtime operator guards reject unsupported root-field combinations", () => {
  assert.throws(
    () => compileCondition(isIn(date("ContractDate"), ["2026-04-23"])),
    /does not support the "in" operator/u,
  );

  assert.throws(
    () =>
      compileCondition({
        kind: "comparison",
        operator: "=",
        field: dropDown("Status", ["Qualified", "Won"] as const),
        value: "Qualified",
      } as never),
    /does not support the "=" operator/u,
  );

  assert.throws(
    () =>
      compileCondition({
        kind: "empty",
        operator: "is",
        field: richText("Body"),
      } as never),
    /does not support the "is" operator/u,
  );
});

test("runtime function guards reject unsupported field-function combinations", () => {
  assert.throws(
    () => equals(text("Title"), today() as never),
    /does not support the "TODAY\(\)" query function/u,
  );

  assert.throws(
    () => isIn(organizationSelect("Department"), loginUser() as never),
    /does not support the "LOGINUSER\(\)" query function/u,
  );

  assert.throws(
    () =>
      compileCondition({
        kind: "comparison",
        operator: "=",
        field: text("Title"),
        value: today(),
      } as never),
    /does not support the "TODAY\(\)" query function/u,
  );
});

test("collection operators reject arrays that contain query functions", () => {
  assert.throws(
    () =>
      compileCondition({
        kind: "collection",
        operator: "in",
        field: userSelect("Assignee"),
        value: [loginUser()],
      } as never),
    /Collection operators accept either an array of literal values or a single query function/u,
  );
});

test("scoped fields replace equality operators with membership operators", () => {
  const subtableDate = date("OrderLines.ShipDate", { scope: "SUBTABLE" });
  const relatedText = text("Company_DB.company_name", { scope: "RELATED_RECORDS" });
  const relatedDate = date("Company_DB.created_on", { scope: "RELATED_RECORDS" });

  assert.equal(
    compileCondition(isIn(subtableDate, ["2026-04-23", "2026-04-24"])),
    'OrderLines.ShipDate in ("2026-04-23", "2026-04-24")',
  );

  assert.equal(
    compileCondition(isIn(relatedText, ["kintone"])),
    'Company_DB.company_name in ("kintone")',
  );

  assert.equal(
    compileCondition(isIn(relatedDate, today())),
    "Company_DB.created_on in (TODAY())",
  );

  assert.throws(
    () =>
      compileCondition({
        kind: "comparison",
        operator: "=",
        field: subtableDate,
        value: "2026-04-23",
      } as never),
    /does not support the "=" operator/u,
  );
});

test("attachment fields can use empty checks", () => {
  const condition = compileCondition(isEmpty(attachment("Files")));

  assert.equal(condition, "Files is empty");
});
