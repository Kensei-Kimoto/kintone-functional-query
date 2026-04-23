import {
  and,
  ascending,
  compileCondition,
  compileOrderBy,
  compileQuery,
  contains,
  greaterThanOrEqual,
  isIn,
  today,
} from "kintone-functional-query";
import { fields, systemFields } from "./generated/customer-app.fields.ts";

const condition = and(
  contains(fields.CustomerName, "Cybozu"),
  greaterThanOrEqual(fields.ContractDate, today()),
  isIn(fields.Status, ["Qualified", "Won"]),
  isIn(fields.Company_DB.fields.company_name, ["OpenAI", "Cybozu"]),
  isIn(fields.Company_DB.fields.created_on, today()),
);

const conditionString = compileCondition(condition);
const orderByString = compileOrderBy([ascending(systemFields.$id)]);
const queryString = compileQuery({
  condition,
  orderBy: [ascending(systemFields.$id)],
  limit: 100,
  offset: 0,
});

console.log(
  JSON.stringify(
    {
      conditionString,
      orderByString,
      queryString,
    },
    null,
    2,
  ),
);
