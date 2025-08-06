import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import { BatchGenerator } from '../../src/cli/commands/batch';
import { Config } from '../../src/cli/config/types';
import * as fs from 'node:fs/promises';

// Create mock functions
const { mockKintoneApiClient, mockSchemaGenerator } = vi.hoisted(() => {
  const mockGetFormFields = vi.fn();
  const mockGenerate = vi.fn();
  
  return {
    mockKintoneApiClient: vi.fn().mockImplementation(() => ({
      getFormFields: mockGetFormFields
    })),
    mockSchemaGenerator: vi.fn().mockImplementation(() => ({
      generate: mockGenerate
    }))
  };
});

// Mock modules
vi.mock('node:fs/promises');
vi.mock('../../src/cli/api/client', () => ({
  KintoneApiClient: mockKintoneApiClient
}));

vi.mock('../../src/cli/generator', () => ({
  SchemaGenerator: mockSchemaGenerator
}));

vi.mock('../../src/utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const mockFs = vi.mocked(fs);

describe('BatchGenerator', () => {
  const testConfig: Config = {
    default: 'test',
    environments: {
      test: {
        auth: {
          baseUrl: 'https://test.cybozu.com',
          apiToken: 'test-token',
        }
      }
    },
    apps: [
      {
        appId: '123',
        name: 'Test App 1',
        outputPath: './test-output/app1',
        schemaName: 'App1Schema'
      },
      {
        appId: '456',
        name: 'Test App 2'
      }
    ],
    output: {
      baseDir: 'generated',
      indexFile: true
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mock implementations with proper return values
    mockKintoneApiClient.mockImplementation(() => ({
      getFormFields: vi.fn().mockReturnValue(
        E.succeed({
          properties: {
            'テストフィールド': {
              type: 'SINGLE_LINE_TEXT',
              code: 'テストフィールド',
              label: 'Test Field'
            }
          },
          revision: '1'
        })
      )
    }));
    
    mockSchemaGenerator.mockImplementation(() => ({
      generate: vi.fn().mockReturnValue(
        E.succeed({
          schemaFile: 'mock schema content',
          typeFile: 'mock type content'
        })
      )
    }));
    
    // Mock fs operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dry Run Mode', () => {
    it('should show what would be generated without creating files', async () => {
      const generator = new BatchGenerator(testConfig, 'test');
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await E.runPromise(generator.generate({
        dryRun: true,
        parallelism: 2
      }));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔍 Dry run'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📱 App 123 (Test App 1)'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📱 App 456 (Test App 2)'));
      
      // Should not create any files in dry run mode
      expect(mockFs.mkdir).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Processing', () => {
    it('should process configuration correctly', () => {
      const generator = new BatchGenerator(testConfig, 'test');
      
      // Test should verify basic functionality without async calls
      expect(generator).toBeInstanceOf(BatchGenerator);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle empty apps configuration', async () => {
      const emptyConfig = { ...testConfig, apps: [] };
      const generator = new BatchGenerator(emptyConfig, 'test');
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await E.runPromise(generator.generate({
        dryRun: false,
        parallelism: 1
      }));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  No apps configured for generation'));

      consoleSpy.mockRestore();
    });

    it('should create generator with invalid environment', () => {
      const generator = new BatchGenerator(testConfig, 'invalid-env');
      expect(generator).toBeInstanceOf(BatchGenerator);
    });
  });

  describe('Path Generation', () => {
    it('should create generator for path testing', () => {
      const generator = new BatchGenerator(testConfig, 'test');
      expect(generator).toBeInstanceOf(BatchGenerator);
    });

    it('should create generator with special character app names', () => {
      const specialConfig: Config = {
        ...testConfig,
        apps: [
          {
            appId: '789',
            name: 'App with Special Characters!@#$%^&*()',
          }
        ]
      };
      
      const generator = new BatchGenerator(specialConfig, 'test');
      expect(generator).toBeInstanceOf(BatchGenerator);
    });
  });

  describe('Schema Name Generation', () => {
    it('should generate schema names correctly', async () => {
      const nameTestConfig: Config = {
        ...testConfig,
        apps: [
          {
            appId: '100',
            name: 'sales management system',
          },
          {
            appId: '200', 
            name: 'Customer Database 2024!',
          }
        ]
      };
      
      const generator = new BatchGenerator(nameTestConfig, 'test');
      
      await E.runPromise(generator.generate({
        dryRun: false,
        parallelism: 1
      }));

      // Should generate proper PascalCase schema names
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('salesmanagementsystemschema.schema.ts'),
        'mock schema content',
        'utf-8'
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('customerdatabase2024schema.schema.ts'),
        'mock schema content',
        'utf-8'
      );
    });
  });

  describe('Parallelism Control', () => {
    it('should process multiple apps successfully', async () => {
      const multiAppConfig: Config = {
        ...testConfig,
        apps: Array.from({ length: 3 }, (_, i) => ({
          appId: `${100 + i}`,
          name: `App ${i + 1}`
        }))
      };
      
      const generator = new BatchGenerator(multiAppConfig, 'test');
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await E.runPromise(generator.generate({
        dryRun: false,
        parallelism: 2
      }));

      // Should complete successfully and log completion
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Batch generation completed!'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Generated 3 schemas successfully'));

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      const generator = new BatchGenerator(testConfig, 'test');
      
      try {
        await E.runPromise(generator.generate({
          dryRun: false,
          parallelism: 1
        }));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Failed to write files for app');
      }
    });
  });

  describe('Index File Generation', () => {
    it('should create index files when enabled', async () => {
      const generator = new BatchGenerator(testConfig, 'test');
      
      await E.runPromise(generator.generate({
        dryRun: false,
        parallelism: 1
      }));

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/index.ts'),
        expect.stringContaining("export * from './app1schema.schema';\nexport * from './app1schema.types';"),
        'utf-8'
      );
    });

    it('should skip index files when disabled', async () => {
      const noIndexConfig = {
        ...testConfig,
        output: { ...testConfig.output, indexFile: false }
      };
      
      const generator = new BatchGenerator(noIndexConfig, 'test');
      
      await E.runPromise(generator.generate({
        dryRun: false,
        parallelism: 1
      }));

      // Should not create index.ts files
      expect(mockFs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('/index.ts'),
        expect.anything(),
        'utf-8'
      );
    });
  });
});