import { Effect as E, Console, pipe } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse, FetchHttpClient } from '@effect/platform';
import { Schema as S } from 'effect';
import { FormFieldsResponse } from 'kintone-functional-query';

// エラー型
export class KintoneApiError extends S.TaggedError<KintoneApiError>()(
  'KintoneApiError',
  {
    message: S.String,
    statusCode: S.optional(S.Number),
  }
) {}

// 設定
export interface KintoneConfig {
  domain: string;
  appId: string;
  apiToken?: string;
  username?: string;
  password?: string;
}

// FormFieldsResponse は kintone-functional-query からインポート済み

// APIクライアント
export class KintoneApiClient {
  constructor(private readonly config: KintoneConfig) {}

  private get baseUrl() {
    return `https://${this.config.domain}/k/v1`;
  }

  private createHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiToken) {
      headers['X-Cybozu-API-Token'] = this.config.apiToken;
    } else if (this.config.username && this.config.password) {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  getFormFields() {
    return pipe(
      // Create the request
      HttpClientRequest.get(`${this.baseUrl}/app/form/fields.json`),
      HttpClientRequest.setHeaders(this.createHeaders()),
      HttpClientRequest.appendUrlParam('app', this.config.appId),
      // Execute the request
      HttpClient.execute,
      // Filter for successful responses
      E.flatMap(HttpClientResponse.filterStatusOk),
      // Parse JSON response
      E.flatMap((response) => response.json),
      // Decode the response
      E.flatMap(S.decodeUnknown(FormFieldsResponse)),
      // Error handling
      E.mapError(error => {
        if (error instanceof KintoneApiError) {
          return error;
        }
        if ('_tag' in error && error._tag === 'ResponseError') {
          return new KintoneApiError({
            message: `API request failed`,
            statusCode: (error as { response?: { status?: number } }).response?.status,
          });
        }
        return new KintoneApiError({
          message: `Failed to decode response: ${String(error)}`,
        });
      }),
      E.tap(() => Console.log('Successfully fetched form fields')),
      // Provide the FetchHttpClient layer
      E.provide(FetchHttpClient.layer)
    );
  }
}