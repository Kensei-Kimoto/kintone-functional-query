import { Effect as E, pipe } from 'effect';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Schema as S } from 'effect';
import prettier from 'prettier';
import { FormFieldsResponse, FieldDefinitionInterface } from '@kintone-functional-query/core';
import { fieldTypeMapping, effectSchemaMapping, GeneratorConfig } from './types';

export class SchemaGenerator {
  constructor(private readonly config: GeneratorConfig) {}

  generate(formFields: FormFieldsResponse): E.Effect<{
    schemaFile: string;
    typeFile: string;
  }, Error> {
    const schemaName = this.config.schemaName || 'AppSchema';
    
    return pipe(
      E.all({
        schemaFile: this.generateEffectSchema(formFields, schemaName),
        typeFile: this.generateTypeDefinitions(formFields, schemaName)
      }),
      E.map(({ schemaFile, typeFile }) => ({ schemaFile, typeFile }))
    );
  }

  private generateEffectSchema(
    formFields: FormFieldsResponse,
    schemaName: string
  ): E.Effect<string, Error> {
    return E.tryPromise({
      try: async () => {
      const fields = Object.entries(formFields.properties) as Array<[string, FieldDefinitionInterface]>;
      
      // インポート文を生成
      const imports = this.generateImports(fields);
      
      // 各フィールドのスキーマ定義
      const fieldSchemas = fields.map(([code, field]) => {
        const schemaType = effectSchemaMapping[field.type];
        if (!schemaType) {
          console.warn(`Unknown field type: ${field.type} for field: ${code}`);
          return `  // ${code}: ${field.type} - Not supported yet`;
        }
        
        if (field.type === 'SUBTABLE' && field.fields) {
          // サブテーブルの処理
          const subFields = Object.entries(field.fields).map(([subCode, subField]) => {
            if (typeof subField === 'object' && subField !== null && 'type' in subField && typeof subField.type === 'string') {
              const subSchemaType = effectSchemaMapping[subField.type];
              return `    ${subCode}: ${subSchemaType || 'S.Unknown'},`;
            }
            return `    ${subCode}: S.Unknown,`;
          }).join('\n');
          
          return `  ${code}: SubtableFieldSchema(S.Struct({\n${subFields}\n  })),`;
        }
        
        return `  ${code}: ${schemaType},`;
      });
      
      // スキーマ定義
      const schemaDefinition = `
${imports}

export const ${schemaName}Schema = S.Struct({
${fieldSchemas.join('\n')}
});

export type ${schemaName} = S.Schema.Type<typeof ${schemaName}Schema>;
`;
      
      // Prettierでフォーマット
      return await prettier.format(schemaDefinition, {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
      });
      },
      catch: (error) => new Error(String(error))
    });
  }

  private generateTypeDefinitions(
    formFields: FormFieldsResponse,
    schemaName: string
  ): E.Effect<string, Error> {
    return E.tryPromise({
      try: async () => {
      const fields = Object.entries(formFields.properties) as Array<[string, FieldDefinitionInterface]>;
      
      // 型定義
      const fieldTypes = fields.map(([code, field]) => {
        const tsType = fieldTypeMapping[field.type];
        if (!tsType) {
          return `  // ${code}: ${field.type} - Not supported yet`;
        }
        
        if (field.type === 'SUBTABLE' && field.fields) {
          // サブテーブルの型定義
          const subFields = Object.entries(field.fields).map(([subCode, subField]) => {
            if (typeof subField === 'object' && subField !== null && 'type' in subField && typeof subField.type === 'string') {
              const subTsType = fieldTypeMapping[subField.type] || 'unknown';
              return `    ${subCode}: ${subTsType};`;
            }
            return `    ${subCode}: unknown;`;
          }).join('\n');
          
          return `  ${code}: Array<{\n${subFields}\n  }>;`;
        }
        
        const optional = field.required ? '' : '?';
        return `  ${code}${optional}: ${tsType};`;
      });
      
      const typeDefinition = `
// Query builder用の型定義
export interface ${schemaName} {
${fieldTypes.join('\n')}
}

// サブテーブル用の型定義
${this.generateSubtableTypes(fields)}
`;
      
      return await prettier.format(typeDefinition, {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
      });
      },
      catch: (error) => new Error(String(error))
    });
  }

  private generateImports(fields: Array<[string, FieldDefinitionInterface]>): string {
    const usedSchemas = new Set<string>();
    
    fields.forEach(([_, field]) => {
      const schemaType = effectSchemaMapping[field.type];
      if (schemaType && schemaType !== 'S.Unknown') {
        usedSchemas.add(schemaType);
      }
      
      // サブテーブル内のフィールドも確認
      if (field.type === 'SUBTABLE' && field.fields) {
        Object.values(field.fields).forEach((subField) => {
          if (typeof subField === 'object' && subField !== null && 'type' in subField) {
            const subSchemaType = effectSchemaMapping[subField.type];
            if (subSchemaType && subSchemaType !== 'S.Unknown') {
              usedSchemas.add(subSchemaType);
            }
          }
        });
      }
    });
    
    const schemaImports = Array.from(usedSchemas).join(',\n  ');
    
    return `
import { Schema as S } from 'effect';
import {
  ${schemaImports}
} from 'kintone-effect-schema';
`;
  }

  private generateSubtableTypes(fields: Array<[string, FieldDefinitionInterface]>): string {
    const subtables = fields.filter(([_, field]) => field.type === 'SUBTABLE');
    
    return subtables.map(([code, field]) => {
      if (!field.fields) return '';
      
      const subFields = Object.entries(field.fields).map(([subCode, subField]) => {
        if (typeof subField === 'object' && subField !== null && 'type' in subField) {
          const tsType = fieldTypeMapping[subField.type] || 'unknown';
          return `  ${subCode}: ${tsType};`;
        }
        return `  ${subCode}: unknown;`;
      }).join('\n');
      
      return `export interface ${code}Row {\n${subFields}\n}`;
    }).join('\n\n');
  }
}