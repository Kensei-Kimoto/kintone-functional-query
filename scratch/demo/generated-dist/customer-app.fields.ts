// kintone-functional-query metadata: {"appId":"42","revision":"17","generatedAt":"2026-04-23T07:07:34.442Z"}
import { attachment, calculated, category, checkBox, createdTime, creator, date, dateTime, dropDown, groupSelect, link, multiSelect, numberField, organizationSelect, radioButton, recordId, recordNumber, relatedRecords, richText, status, statusAssignee, subtable, text, textArea, time, unknownField, updatedTime, userSelect } from "kintone-functional-query";

export const appMetadata = {
  "appId": "42",
  "revision": "17",
  "generatedAt": "2026-04-23T07:07:34.442Z"
} as const;

export const systemFields = {
  $id: recordId("$id"),
} as const;

export const fields = {
    CustomerName: text("CustomerName"),
    ContractDate: date("ContractDate"),
    Status: dropDown("Status", ["Qualified", "Won"] as const),
    Company_DB: relatedRecords("Company_DB", {
      company_name: text("Company_DB.company_name", { scope: "RELATED_RECORDS" }),
      created_on: date("Company_DB.created_on", { scope: "RELATED_RECORDS" }),
    }),
  } as const;
