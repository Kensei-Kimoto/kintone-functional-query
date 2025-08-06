import { Command, Options } from '@effect/cli';
import { Effect as E, Console, pipe, Option } from 'effect';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadConfig } from '../config/simple-loader';
import { Config, isApiTokenAuth, isPasswordAuth } from '../config/types';
import { KintoneApiClient } from '../api/client';
import { SchemaGenerator } from '../generator';
import { Logger } from '../../utils/logger';

// ============================================
// CLI Options
// ============================================

const configPath = Options.text('config').pipe(
  Options.withAlias('c'),
  Options.withDescription('Path to configuration file (optional)')
);

const environment = Options.text('env').pipe(
  Options.withAlias('e'),
  Options.withDescription('Environment name (overrides config default)'),
);

const dryRun = Options.boolean('dry-run').pipe(
  Options.withDescription('Show what would be generated without actually creating files'),
  Options.withDefault(false)
);

const parallel = Options.integer('parallel').pipe(
  Options.withAlias('p'),
  Options.withDescription('Number of apps to process in parallel'),
  Options.withDefault(3)
);

// ============================================
// Batch Generation Engine
// ============================================

export class BatchGenerator {
  constructor(
    private readonly config: Config,
    private readonly environment: string
  ) {}

  /**
   * Generate schemas for all configured apps
   */
  generate(options: {
    dryRun: boolean;
    parallelism: number;
  }): E.Effect<void, Error> {
    const apps = this.config.apps ?? [];
    
    if (apps.length === 0) {
      return Console.log('⚠️  No apps configured for generation');
    }

    return pipe(
      Console.log(`🚀 Starting batch generation for ${apps.length} app(s)...`),
      E.zipRight(
        options.dryRun ? 
          this.dryRunGeneration(apps) :
          this.executeGeneration(apps, options.parallelism)
      ),
      E.tap(() => Console.log('✅ Batch generation completed!'))
    );
  }

  /**
   * Dry run - show what would be generated
   */
  private dryRunGeneration(apps: Config['apps']): E.Effect<void, never> {
    return pipe(
      Console.log('🔍 Dry run - showing what would be generated:'),
      E.zipRight(
        E.forEach(apps!, app => 
          Console.log(`  📱 App ${app.appId} (${app.name}) → ${this.getOutputPath(app)}`)
        )
      ),
      E.asVoid
    );
  }

  /**
   * Execute actual schema generation
   */
  private executeGeneration(
    apps: NonNullable<Config['apps']>,
    parallelism: number
  ): E.Effect<void, Error> {
    return pipe(
      E.forEach(
        apps,
        (app) => this.generateSingleApp(app),
        { concurrency: parallelism }
      ),
      E.tap(results => 
        Console.log(`📊 Generated ${results.length} schemas successfully`)
      ),
      E.asVoid
    );
  }

  /**
   * Generate schema for a single app
   */
  private generateSingleApp = (app: NonNullable<Config['apps']>[number]): E.Effect<string, Error> => {
    return pipe(
      Console.log(`📱 Processing app ${app.appId} (${app.name})...`),
      E.zipRight(
        E.scoped(
          E.gen((function* (this: BatchGenerator) {
            // Create API client
            const envConfig = this.config.environments[this.environment];
            if (!envConfig) {
              throw new Error(`Environment "${this.environment}" not found in config`);
            }

            const client = new KintoneApiClient({
              domain: this.extractDomain(envConfig.auth.baseUrl),
              appId: app.appId,
              apiToken: isApiTokenAuth(envConfig.auth) ? envConfig.auth.apiToken : undefined,
              username: isPasswordAuth(envConfig.auth) ? envConfig.auth.username : undefined,
              password: isPasswordAuth(envConfig.auth) ? envConfig.auth.password : undefined,
            });

            // Fetch form fields
            const formFields = yield* client.getFormFields();

            // Generate schema
            const outputPath = this.getOutputPath(app);
            const schemaName = app.schemaName ?? this.generateSchemaName(app.name);

            const generator = new SchemaGenerator({
              outputDir: outputPath,
              schemaName,
            });

            const { schemaFile, typeFile } = yield* generator.generate(formFields);

            // Write files
            yield* E.tryPromise({
              try: async () => {
                await fs.mkdir(outputPath, { recursive: true });

                const schemaFileName = `${schemaName.toLowerCase()}.schema.ts`;
                const typeFileName = `${schemaName.toLowerCase()}.types.ts`;

                await fs.writeFile(
                  path.join(outputPath, schemaFileName),
                  schemaFile,
                  'utf-8'
                );

                await fs.writeFile(
                  path.join(outputPath, typeFileName),
                  typeFile,
                  'utf-8'
                );

                // Create index file if enabled
                if (this.config.output?.indexFile !== false) {
                  const indexContent = `export * from './${schemaName.toLowerCase()}.schema';
export * from './${schemaName.toLowerCase()}.types';
`;
                  await fs.writeFile(
                    path.join(outputPath, 'index.ts'),
                    indexContent,
                    'utf-8'
                  );
                }
              },
              catch: (error) => new Error(`Failed to write files for app ${app.appId}: ${error}`)
            });

            Logger.info('Generated schema successfully', {
              module: 'batch-generator',
              function: 'generateSingleApp',
              appId: app.appId,
              appName: app.name,
              outputPath
            });

            return `${app.name} (${app.appId})`;
          }).bind(this))
        )
      )
    );
  };

  /**
   * Get output path for an app
   */
  private getOutputPath(app: NonNullable<Config['apps']>[number]): string {
    if (app.outputPath) {
      return path.resolve(app.outputPath);
    }

    const baseDir = this.config.output?.baseDir ?? 'generated';
    return path.resolve(baseDir, this.sanitizeFileName(app.name));
  }

  /**
   * Generate schema name from app name
   */
  private generateSchemaName(appName: string): string {
    return appName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/^./, str => str.toUpperCase()) + 'Schema';
  }

  /**
   * Sanitize file name
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  /**
   * Extract domain from base URL
   */
  private extractDomain(baseUrl: string): string {
    const url = new URL(baseUrl);
    return url.hostname;
  }
}

// ============================================
// Batch Command Definition
// ============================================

export const batchCommand = Command.make(
  'batch',
  {
    config: Options.optional(configPath),
    env: Options.optional(environment),
    dryRun,
    parallel,
  },
  (args) => {
    return E.gen(function* () {
      // Load configuration
      yield* Console.log('📋 Loading configuration...');
      const config = yield* loadConfig(Option.getOrUndefined(args.config));

      // Determine environment
      const selectedEnv = Option.getOrElse(args.env, () => config.default);
      if (!config.environments[selectedEnv]) {
        throw new Error(`Environment "${selectedEnv}" not found in configuration`);
      }

      yield* Console.log(`🌍 Using environment: ${selectedEnv}`);

      // Create batch generator
      const batchGenerator = new BatchGenerator(config, selectedEnv);

      // Execute batch generation
      yield* batchGenerator.generate({
        dryRun: args.dryRun,
        parallelism: args.parallel
      });

    }).pipe(
      E.catchAll((error) =>
        Console.error(`❌ Batch generation failed: ${error}`).pipe(
          E.zipRight(E.fail(error))
        )
      )
    );
  }
);