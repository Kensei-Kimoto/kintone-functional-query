import { Schema as S } from 'effect';

// フィールド定義の型（再帰的な構造をサポート）
interface FieldDefinitionInterface {
  type: string;
  code: string;
  label: string;
  noLabel?: boolean;
  required?: boolean;
  unique?: boolean;
  maxLength?: number;
  minLength?: number;
  defaultValue?: unknown;
  fields?: Record<string, FieldDefinitionInterface>;
  options?: Record<string, { label: string; index: string }>;
}

// Effectスキーマ定義（suspendを使用して再帰的な型を定義）
export const FieldDefinition: S.Schema<FieldDefinitionInterface> = S.suspend(() =>
  S.Struct({
    type: S.String,
    code: S.String,
    label: S.String,
    noLabel: S.optional(S.Boolean),
    required: S.optional(S.Boolean),
    unique: S.optional(S.Boolean),
    maxLength: S.optional(S.Number),
    minLength: S.optional(S.Number),
    defaultValue: S.optional(S.Unknown),
    // サブテーブルの場合（再帰的な定義）
    fields: S.optional(S.Record({ key: S.String, value: FieldDefinition })),
    // ドロップダウン・ラジオボタンなどの選択肢
    options: S.optional(S.Record({ 
      key: S.String, 
      value: S.Struct({
        label: S.String,
        index: S.String,
      })
    })),
  })
);

// フォームフィールドAPIのレスポンス型
export const FormFieldsResponse = S.Struct({
  properties: S.Record({
    key: S.String,
    value: FieldDefinition
  }),
  revision: S.String,
});

export type FormFieldsResponse = S.Schema.Type<typeof FormFieldsResponse>;
export type FieldDefinition = S.Schema.Type<typeof FieldDefinition>;
export type { FieldDefinitionInterface };

// フィールドタイプの定義
export const FieldTypes = {
  SINGLE_LINE_TEXT: 'SINGLE_LINE_TEXT',
  MULTI_LINE_TEXT: 'MULTI_LINE_TEXT',
  RICH_TEXT: 'RICH_TEXT',
  NUMBER: 'NUMBER',
  CALC: 'CALC',
  DROP_DOWN: 'DROP_DOWN',
  CHECK_BOX: 'CHECK_BOX',
  RADIO_BUTTON: 'RADIO_BUTTON',
  MULTI_SELECT: 'MULTI_SELECT',
  FILE: 'FILE',
  LINK: 'LINK',
  DATE: 'DATE',
  TIME: 'TIME',
  DATETIME: 'DATETIME',
  USER_SELECT: 'USER_SELECT',
  ORGANIZATION_SELECT: 'ORGANIZATION_SELECT',
  GROUP_SELECT: 'GROUP_SELECT',
  REFERENCE_TABLE: 'REFERENCE_TABLE',
  SUBTABLE: 'SUBTABLE',
  // システムフィールド
  RECORD_NUMBER: 'RECORD_NUMBER',
  CREATOR: 'CREATOR',
  CREATED_TIME: 'CREATED_TIME',
  MODIFIER: 'MODIFIER',
  UPDATED_TIME: 'UPDATED_TIME',
  STATUS: 'STATUS',
  STATUS_ASSIGNEE: 'STATUS_ASSIGNEE',
  CATEGORY: 'CATEGORY',
} as const;

export type FieldType = typeof FieldTypes[keyof typeof FieldTypes];