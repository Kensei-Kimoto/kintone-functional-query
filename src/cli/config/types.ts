import { Schema as S } from 'effect';

// ============================================
// Auth Configuration Types
// ============================================

export const PasswordAuthSchema = S.Struct({
  baseUrl: S.String.pipe(S.startsWith('https://')),
  username: S.String.pipe(S.minLength(1)),
  password: S.String.pipe(S.minLength(1))
});

export const ApiTokenAuthSchema = S.Struct({
  baseUrl: S.String.pipe(S.startsWith('https://')),
  apiToken: S.String.pipe(S.minLength(1))
});

export const AuthConfigSchema = S.Union(PasswordAuthSchema, ApiTokenAuthSchema);

// ============================================
// Environment Configuration  
// ============================================

export const EnvironmentConfigSchema = S.Struct({
  auth: AuthConfigSchema
});

// ============================================
// App Definition Schema
// ============================================

export const AppDefinitionSchema = S.Struct({
  appId: S.String.pipe(S.minLength(1)),
  name: S.String.pipe(S.minLength(1)),
  outputPath: S.optional(S.String),
  schemaName: S.optional(S.String)
});

// ============================================
// Main Configuration Schema
// ============================================

export const ConfigSchema = S.Struct({
  default: S.String.pipe(S.minLength(1)),
  environments: S.Record({ key: S.String, value: EnvironmentConfigSchema }),
  apps: S.optional(S.Array(AppDefinitionSchema)),
  output: S.optional(S.Struct({
    baseDir: S.String,
    indexFile: S.optional(S.Boolean),
    format: S.optional(S.Literal('typescript', 'javascript'))
  }))
});

// ============================================
// Type Exports (Schema-derived)
// ============================================

export type PasswordAuth = S.Schema.Type<typeof PasswordAuthSchema>;
export type ApiTokenAuth = S.Schema.Type<typeof ApiTokenAuthSchema>;
export type AuthConfig = S.Schema.Type<typeof AuthConfigSchema>;
export type EnvironmentConfig = S.Schema.Type<typeof EnvironmentConfigSchema>;
export type AppDefinition = S.Schema.Type<typeof AppDefinitionSchema>;
export type Config = S.Schema.Type<typeof ConfigSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Helper function to get app ID from environment variable
 * @param envVarName Environment variable name
 * @returns App ID string
 */
export function getAppId(envVarName: string): string {
  const appId = process.env[envVarName];
  if (!appId) {
    throw new Error(`Environment variable ${envVarName} is not set`);
  }
  return appId;
}

/**
 * Type guard to check if auth config uses API token
 */
export function isApiTokenAuth(auth: AuthConfig): auth is ApiTokenAuth {
  return 'apiToken' in auth;
}

/**
 * Type guard to check if auth config uses password
 */
export function isPasswordAuth(auth: AuthConfig): auth is PasswordAuth {
  return 'username' in auth && 'password' in auth;
}