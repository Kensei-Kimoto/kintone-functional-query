import { Effect as E } from 'effect';
import { Schema as S } from 'effect';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Config, ConfigSchema } from './types';
import { Logger } from '../../utils/logger';

// ============================================
// Simple Configuration Loader
// ============================================

const DEFAULT_CONFIG_NAMES = [
  'kintone-functional-query.config.js',
  'kintone-functional-query.config.mjs',
  'kintone-as-code.config.js',
  'kintone-as-code.config.mjs'
];

export class SimpleConfigError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SimpleConfigError';
  }
}

/**
 * Load configuration with simplified error handling
 */
export function loadConfig(configPath?: string): E.Effect<Config, SimpleConfigError> {
  return E.tryPromise({
    try: async (): Promise<Config> => {
      let configData: unknown;
      let resolvedPath: string;

      if (configPath) {
        // Load specific file
        resolvedPath = path.resolve(configPath);
        try {
          await fs.access(resolvedPath);
          const configUrl = pathToFileURL(resolvedPath).href;
          const module = await import(configUrl);
          configData = module.default || module;
        } catch (error) {
          throw new SimpleConfigError(
            `Failed to load configuration file: ${configPath}`,
            error
          );
        }
      } else {
        // Search for default config files
        let found = false;
        
        for (const configName of DEFAULT_CONFIG_NAMES) {
          resolvedPath = path.resolve(configName);
          try {
            await fs.access(resolvedPath);
            const configUrl = pathToFileURL(resolvedPath).href;
            const module = await import(configUrl);
            configData = module.default || module;
            found = true;
            break;
          } catch {
            // Continue to next file
            continue;
          }
        }

        if (!found) {
          throw new SimpleConfigError(
            `No configuration file found. Searched for: ${DEFAULT_CONFIG_NAMES.join(', ')}`
          );
        }
      }

      // Validate configuration
      try {
        const config = S.decodeUnknownSync(ConfigSchema)(configData);
        
        // Additional validation
        if (!config.environments[config.default]) {
          throw new SimpleConfigError(
            `Default environment "${config.default}" is not defined in environments`
          );
        }

        Logger.info('Configuration loaded successfully', {
          module: 'simple-config-loader',
          function: 'loadConfig',
          environment: config.default,
          appsCount: config.apps?.length ?? 0
        });

        return config;
      } catch (error) {
        throw new SimpleConfigError(
          `Invalid configuration: ${String(error)}`,
          error
        );
      }
    },
    catch: (error) => {
      if (error instanceof SimpleConfigError) {
        return error;
      }
      return new SimpleConfigError(`Failed to load configuration: ${String(error)}`, error);
    }
  });
}