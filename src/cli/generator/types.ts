export interface GeneratorConfig {
  outputDir: string;
  packageName?: string;
  schemaName?: string;
}

// フィールドタイプのマッピング
export const fieldTypeMapping: Record<string, string> = {
  // テキスト系
  SINGLE_LINE_TEXT: 'string',
  MULTI_LINE_TEXT: 'string',
  RICH_TEXT: 'string',
  
  // 数値系
  NUMBER: 'number',
  CALC: 'number',
  
  // 選択系
  RADIO_BUTTON: 'string',
  CHECK_BOX: 'string[]',
  MULTI_SELECT: 'string[]',
  DROP_DOWN: 'string',
  
  // 日付系
  DATE: 'string', // または Date
  TIME: 'string',
  DATETIME: 'string', // または Date
  
  // ユーザー系
  USER_SELECT: 'Array<{ code: string; name: string }>',
  ORGANIZATION_SELECT: 'Array<{ code: string; name: string }>',
  GROUP_SELECT: 'Array<{ code: string; name: string }>',
  
  // ファイル
  FILE: 'Array<{ contentType: string; fileKey: string; name: string; size: string }>',
  
  // その他
  LINK: 'string',
  STATUS: 'string',
  STATUS_ASSIGNEE: 'Array<{ code: string; name: string }>',
  CATEGORY: 'string[]',
  
  // システムフィールド
  RECORD_NUMBER: 'string',
  CREATOR: '{ code: string; name: string }',
  CREATED_TIME: 'string',
  MODIFIER: '{ code: string; name: string }',
  UPDATED_TIME: 'string',
  
  // 追加されたフィールドタイプ
  LOOKUP: 'string',
  __ID__: 'string',
  __REVISION__: 'string',
};

// Effect Schema用のマッピング
export const effectSchemaMapping: Record<string, string> = {
  SINGLE_LINE_TEXT: 'SingleLineTextFieldSchema',
  MULTI_LINE_TEXT: 'MultiLineTextFieldSchema',
  RICH_TEXT: 'RichTextFieldSchema',
  NUMBER: 'NumberFieldSchema',
  CALC: 'CalcFieldSchema',
  RADIO_BUTTON: 'RadioButtonFieldSchema',
  CHECK_BOX: 'CheckBoxFieldSchema',
  MULTI_SELECT: 'MultiSelectFieldSchema',
  DROP_DOWN: 'DropDownFieldSchema',
  DATE: 'DateFieldSchema',
  TIME: 'TimeFieldSchema',
  DATETIME: 'DateTimeFieldSchema',
  USER_SELECT: 'UserSelectFieldSchema',
  ORGANIZATION_SELECT: 'OrganizationSelectFieldSchema',
  GROUP_SELECT: 'GroupSelectFieldSchema',
  FILE: 'FileFieldSchema',
  LINK: 'LinkFieldSchema',
  STATUS: 'StatusFieldSchema',
  STATUS_ASSIGNEE: 'StatusAssigneeFieldSchema',
  CATEGORY: 'CategoryFieldSchema',
  RECORD_NUMBER: 'RecordNumberFieldSchema',
  CREATOR: 'CreatorFieldSchema',
  CREATED_TIME: 'CreatedTimeFieldSchema',
  MODIFIER: 'ModifierFieldSchema',
  UPDATED_TIME: 'UpdatedTimeFieldSchema',
  SUBTABLE: 'SubtableFieldSchema',
  // 追加されたフィールドタイプ
  LOOKUP: 'LookupFieldSchema',
  __ID__: 'RecordIdFieldSchema',
  __REVISION__: 'RevisionFieldSchema',
};