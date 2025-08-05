import { Effect as E, pipe } from 'effect';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Schema as S } from 'effect';
import prettier from 'prettier';
import { FormFieldsResponse, FieldDefinitionInterface } from '../../schemas';
import { fieldTypeMapping, effectSchemaMapping, GeneratorConfig } from './types';
import { Logger } from '../../utils/logger';

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
          Logger.warn('Unknown field type encountered', {
            module: 'schema-generator',
            function: 'generateSchema',
            fieldCode: code,
            fieldType: field.type,
            fieldLabel: field.label
          });
          return `  // ${code}: ${field.type} - Not supported yet`;
        }
        
        if (field.type === 'SUBTABLE') {
          // サブテーブルはkintone-effect-schemaのSubtableFieldSchemaを直接使用
          return `  ${code}: ${schemaType},`;
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
        
        const optional = field.required ? '' : '?';
        
        if (field.type === 'SUBTABLE') {
          // サブテーブルは標準的な型定義を使用
          return `  ${code}${optional}: Array<Record<string, unknown>>;`;
        }
        
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
    });
    
    const schemaImports = Array.from(usedSchemas).join(',\n  ');
    
    return `
import { Schema as S } from 'effect';
import {
  ${schemaImports}
} from 'kintone-effect-schema';
`;
  }

  private generateSubtableTypes(_fields: Array<[string, FieldDefinitionInterface]>): string {
    // サブテーブルの型定義は不要（kintone-effect-schemaに委譲）
    return '';
  }
}