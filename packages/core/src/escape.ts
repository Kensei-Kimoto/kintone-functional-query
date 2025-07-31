/**
 * kintoneクエリの値をエスケープする
 * ダブルクォート(")とバックスラッシュ(\)をエスケープ
 */
export function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')  // バックスラッシュを先にエスケープ
    .replace(/"/g, '\\"');   // ダブルクォートをエスケープ
}

/**
 * 値が文字列の場合のみエスケープを適用
 */
export function escapeIfString(value: unknown): unknown {
  if (typeof value === 'string') {
    return escapeValue(value);
  }
  return value;
}