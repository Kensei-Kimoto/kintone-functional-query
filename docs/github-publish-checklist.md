# GitHub Publish Checklist

作成日: 2026-04-23
対象: `kintone-functional-query` v2 を GitHub に先行公開する
前提: npm 公開はまだ行わない

## 1. 先に決めること

- GitHub 上の見せ方を `v2 reboot` として出すか
- 旧 npm package の扱いはひとまず保留にするか
- この workspace をそのまま GitHub repo にするか、別 repo に移すか

## 2. GitHub 公開前の必須タスク

- Git リポジトリ化する
  - 今の workspace はまだ `.git` がない
  - `git init` するか、新しい GitHub repo を作って紐づける

- 公開しないファイルを決める
  - `.env` はそのまま ignore
  - `scratch/live.bundle.json` は実テナント由来なので commit しない
  - `scratch/live.fields.ts` は実アプリ schema なので commit しない
  - `scratch/live-client-smoke.ts` はそのままだと実フィールド名前提なので、commit するなら generic 化する

- `.gitignore` を GitHub 公開向けに見直す
  - `node_modules`
  - `dist`
  - `.env`
  - `scratch/live.bundle.json`
  - `scratch/live.fields.ts`
  - 必要なら `scratch/live-client-smoke.ts`

- README を GitHub のトップページ前提に最終化する
  - 何を解決するライブラリか
  - 何が今できるか
  - Live Fetch / Snapshot / Generate / Check Schema の流れ
  - `condition` / `orderBy` / `query` の使い分け
  - まだ rough な点

- LICENSE を入れる
  - OSS として見せるなら必須
  - まだ迷っているなら公開前にライセンス方針を決める

## 3. 公開前にやっておきたいタスク

- `private: true` をどうするか決める
  - GitHub だけなら必須ではない
  - npm 未公開でも、将来 publish する前提なら外すタイミングを決めておく

- package metadata を整理する
  - `description`
  - `license`
  - `repository`
  - `homepage`
  - `bugs`
  - `keywords`

- build 出力の扱いを決める
  - GitHub repo に `dist` を commit しない前提でよいか
  - publish 前に clean build できる状態にする

- `clean` script を追加する
  - 過去 build の残骸で `dist/src/*` が残る問題を避ける

- public API に最低限の TSDoc/JSDoc を足す
  - `compileCondition`
  - `compileOrderBy`
  - `compileQuery`
  - `generateFieldModule`
  - `loadSchemaFromSnapshot`
  - `loadSchemaFromLiveKintone`
  - `createSnapshotBundleFromLiveKintone`

## 4. あると良いタスク

- `CHANGELOG.md` を作る
  - `v2 reboot` の意図が伝わりやすい

- `CONTRIBUTING.md` を作る
  - まだ早ければ後回しでよい

- issue / PR template を入れる
  - GitHub 先行公開なら後回しでもよい

- GitHub repo description 用の短文を決める
  - 例: `Schema-aware Kintone query compiler for TypeScript`

## 5. 公開前の確認

- `npm run check`
- `npm test`
- `npm run build`
- snapshot mode の smoke
- live fetch mode の smoke
- `@kintone/rest-api-client` での `condition` / `query` 実動確認

## 6. 今の時点でのおすすめ順

1. 実テナント由来ファイルを commit 対象から外す
2. `.gitignore` を GitHub 公開向けに整える
3. LICENSE を決めて追加する
4. README を GitHub 用に磨く
5. `clean` script と package metadata を整える
6. GitHub repo を作って push する

## 7. npm はまだやらない

- GitHub 先行で十分
- npm の deprecated 復帰や `2.0.0-alpha` 公開は、その後でよい
- まずは GitHub 上で `v2 reboot` の文脈を整える
