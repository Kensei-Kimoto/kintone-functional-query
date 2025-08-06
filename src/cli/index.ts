#!/usr/bin/env node

import { Command, Options } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Effect as E, Console, Option } from 'effect';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { KintoneApiClient } from './api/client';
import { SchemaGenerator } from './generator';
import { batchCommand } from './commands/batch';

// CLIオプション
const domain = Options.text('domain').pipe(
  Options.withAlias('d'),
  Options.withDescription('Kintone domain (e.g., example.cybozu.com)')
);

const appId = Options.text('app-id').pipe(
  Options.withAlias('a'),
  Options.withDescription('Kintone app ID')
);

const apiToken = Options.text('api-token').pipe(
  Options.withAlias('t'),
  Options.withDescription('Kintone API token')
);

const output = Options.text('output').pipe(
  Options.withAlias('o'),
  Options.withDescription('Output directory'),
  Options.withDefault('./generated')
);

const schemaName = Options.text('schema-name').pipe(
  Options.withAlias('n'),
  Options.withDescription('Schema name'),
  Options.withDefault('AppSchema')
);

// メインコマンド
const generate = Command.make(
  'generate',
  {
    domain,
    appId,
    apiToken: Options.optional(apiToken),
    output,
    schemaName,
  },
  (args) => {
    return E.gen(function* () {
      yield* Console.log('🚀 Generating kintone schema...');
      
      // APIクライアントを初期化
      const client = new KintoneApiClient({
        domain: args.domain,
        appId: args.appId,
        apiToken: Option.getOrUndefined(args.apiToken),
      });
      
      // フォーム情報を取得
      yield* Console.log(`📡 Fetching form fields from app ${args.appId}...`);
      const formFields = yield* client.getFormFields();
      
      // コードを生成
      yield* Console.log('✨ Generating TypeScript code...');
      const generator = new SchemaGenerator({
        outputDir: args.output,
        schemaName: args.schemaName,
      });
      
      const { schemaFile, typeFile } = yield* generator.generate(formFields);
      
      // ファイルを書き込む
      yield* Console.log(`📝 Writing files to ${args.output}...`);
      yield* E.tryPromise({
        try: async () => {
          // ディレクトリを作成
          await fs.mkdir(args.output, { recursive: true });
          
          // スキーマファイルを書き込む
          await fs.writeFile(
            path.join(args.output, `${args.schemaName.toLowerCase()}.schema.ts`),
            schemaFile,
            'utf-8'
          );
          
          // 型定義ファイルを書き込む
          await fs.writeFile(
            path.join(args.output, `${args.schemaName.toLowerCase()}.types.ts`),
            typeFile,
            'utf-8'
          );
          
          // インデックスファイルを生成
          const indexContent = `
export * from './${args.schemaName.toLowerCase()}.schema';
export * from './${args.schemaName.toLowerCase()}.types';
`;
          await fs.writeFile(
            path.join(args.output, 'index.ts'),
            indexContent,
            'utf-8'
          );
        },
        catch: (error) => new Error(`Failed to write files: ${error}`),
      });
      
      yield* Console.log('✅ Schema generation completed!');
      yield* Console.log(`📁 Files written to: ${args.output}`);
    }).pipe(
      E.catchAll((error) => 
        Console.error(`❌ Error: ${error}`).pipe(E.zipRight(E.fail(error)))
      )
    );
  }
);

// メインCLIコマンド（サブコマンドを統合）
const mainCommand = Command.make('kintone-query-gen').pipe(
  Command.withSubcommands([
    generate.pipe(Command.withDescription('Generate schema from a single kintone app')),
    batchCommand.pipe(Command.withDescription('Generate schemas for multiple apps using config file'))
  ])
);

// CLIアプリケーション
const cli = Command.run(mainCommand, {
  name: 'kintone-query-gen',
  version: '0.3.0',
});

// 実行
const program = cli(process.argv).pipe(
  E.provide(NodeContext.layer),
  E.scoped
);

NodeRuntime.runMain(program);