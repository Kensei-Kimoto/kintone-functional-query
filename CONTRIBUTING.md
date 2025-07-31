# Contributing to kintone-functional-query

## 開発環境のセットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/kimotokensei/kintone-functional-query.git
cd kintone-functional-query
```

2. 依存関係をインストール
```bash
pnpm install
```

3. ビルド
```bash
pnpm build
```

## 開発フロー

### ブランチ戦略
- `main`: プロダクションブランチ
- `feature/*`: 新機能開発
- `fix/*`: バグ修正
- `docs/*`: ドキュメント更新

### コミットメッセージ
[Conventional Commits](https://www.conventionalcommits.org/) に従ってください。

例:
- `feat: サブテーブルのサポートを追加`
- `fix: 日本語フィールド名のパースエラーを修正`
- `docs: READMEにサンプルコードを追加`

### テスト
新しい機能を追加する際は、必ずテストを書いてください。

```bash
# テストの実行
pnpm test

# ウォッチモード
pnpm test:watch

# カバレッジレポート
pnpm test:coverage
```

### リリース

1. 変更内容に応じてchangesetを作成
```bash
pnpm changeset
```

2. PRを作成してmainブランチにマージ
3. GitHub Actionsが自動的にリリースPRを作成
4. リリースPRをマージすると自動的にnpmに公開

## コーディング規約

- TypeScriptを使用
- ESLintルールに従う
- Prettierでフォーマット

```bash
# Lint
pnpm lint

# フォーマット
pnpm format
```

## 質問・提案

Issueを作成してください: https://github.com/kimotokensei/kintone-functional-query/issues