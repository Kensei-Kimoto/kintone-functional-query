import assert from "node:assert/strict";
import test from "node:test";

import { isQueryFunctionCall, today } from "../src/query-functions.ts";

test("isQueryFunctionCall accepts valid query function objects", () => {
  assert.equal(isQueryFunctionCall(today()), true);
});

test("isQueryFunctionCall rejects malformed query function objects", () => {
  assert.equal(isQueryFunctionCall({ kind: "function" }), false);
  assert.equal(isQueryFunctionCall({ kind: "function", name: "TODAY" }), false);
  assert.equal(isQueryFunctionCall({ kind: "function", name: "TODAY", args: "bad" }), false);
  assert.equal(isQueryFunctionCall({ kind: "function", name: "BOGUS", args: [] }), false);
  assert.equal(
    isQueryFunctionCall({ kind: "function", name: "TODAY", args: [{ kind: "keyword" }] }),
    false,
  );
});
