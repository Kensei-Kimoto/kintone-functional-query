# kintone-functional-query v2 設計メモ

作成日: 2026-04-23
ステータス: draft

## 1. 背景

`kintone-functional-query` の v1 系は、kintone のクエリ文字列を TypeScript 上で安全に組み立てるという問題設定自体は良かった。

一方で、以下のズレがあった。

- 「lambda expression で自然に書ける」という前提が API 形状と噛み合わなかった
- query builder の核に対して、runtime validation、logging、batch、frontend guide など周辺責務を載せすぎた
- README 上の約束が大きすぎ、ライブラリの本体が何なのか伝わりにくかった

そのため v2 では、名前を残す可能性は維持しつつ、中身は 0 ベースで再設計する。

## 2. v2 の基本方針

v2 では `functional` を「ラムダ式っぽい構文」ではなく、以下の意味で再定義する。

- query を文字列連結ではなく値として扱う
- query を immutable な AST として組み立てる
- 条件を関数合成で構築する
- 最後に compiler が kintone query string に落とす

つまり v2 は「lambda query builder」ではなく「schema-aware functional query compiler」である。

この再定義が取れないなら改名を検討すべきだが、この意味なら `kintone-functional-query` という名前と自然に整合する。

## 3. 目標

v2 の目標は 3 つに絞る。

1. kintone のフィールド定義に基づいて、使える演算子を TypeScript 上で制限する
2. query を文字列ではなく AST として組み立て、最後に安全に文字列化する
3. 実運用で必要な escape hatch を明示的に残しつつ、普段は unsafe string に触れなくて済むようにする

### 3.1 対象環境

v2 の主対象は「ビルド工程がある TypeScript プロジェクト」とする。

理由:

- このライブラリの価値の中心は TypeScript の型制約にある
- codegen を前提にした方が API 品質が高くなる
- 生の JavaScript + CDN まで同時に成立させようとすると、unsafe API を広く公開する必要があり、設計がぶれる

したがって、v2.0.0 では「ビルドなしでも使えること」は目標にしない。

## 4. 非目標

v2.0.0 では以下をやらない。

- lambda 式ベースの DSL を主軸にしない
- Effect 依存の大きな runtime abstraction を持ち込まない
- 構造化 logging を本体責務にしない
- 任意アプリで動く汎用プラグイン向け runtime dynamic query builder を主軸にしない
- parser を必須機能にしない
- kintone 全 API の抽象化を目指さない
- 生の JavaScript + CDN 利用を第一級サポートしない

## 5. ユーザーに提供する価値

ユーザーが欲しいのは「kintone query string を暗記している人だけが安全に書ける」状態から抜けることだ。

v2 が提供する価値は以下。

- field code の typo をコンパイル時に潰せる
- field type と operator の不一致をコンパイル時に潰せる
- `order by / limit / offset` の組み立てを生文字列で書かなくてよい
- subtables / related records / functions を AST として表現できる
- どうしても足りない場合だけ `rawCondition()` などの escape hatch に落ちればよい

## 6. コンセプト

v2 のコアは以下の 3 層で構成する。

1. Schema layer
2. Query AST layer
3. Compiler layer

### 6.1 Schema layer

kintone の `Get Form Fields` を元に、型付き field descriptor を生成する。

生成物のイメージ:

```ts
// generated/customer-app.ts
export const fields = {
  CustomerName: text("CustomerName"),
  Amount: numberField("Amount"),
  ContractDate: date("ContractDate"),
  Status: dropDown("Status", ["検討中", "受注", "失注"] as const),
  OrderDetails: subtable("OrderDetails", {
    ProductCode: text("OrderDetails.ProductCode"),
    Quantity: numberField("OrderDetails.Quantity"),
  }),
} as const;
```

重要なのは、生成物が「schema type」だけでなく「そのまま query に使える descriptor」であること。

v1 のように「型はあるが、毎回ラムダの中で魔法的に解釈する」方向ではなく、v2 は field descriptor を第一級の値として扱う。

### 6.2 Query AST layer

query はすべて plain object の AST として表現する。

```ts
type Expr =
  | { kind: "eq"; field: FieldDescriptor; value: ScalarValue }
  | { kind: "lt"; field: FieldDescriptor; value: ScalarValue }
  | { kind: "in"; field: FieldDescriptor; value: readonly ScalarValue[] }
  | { kind: "and"; items: readonly Expr[] }
  | { kind: "or"; items: readonly Expr[] }
  | { kind: "isEmpty"; field: FieldDescriptor };
```

この AST は immutable に保つ。

### 6.3 Compiler layer

最後に AST を kintone query string へ変換する。

compiler の責務:

- kintone query syntax への変換
- quote / backslash の escape
- `order by -> limit -> offset` の順序保証
- `limit <= 500`, `offset <= 10000` など最低限の runtime guard
- subtable path の正しい出力

## 7. 推奨 API 方向

v2 の主 API は、ラムダではなく combinator ベースとする。

また、public API 名は短縮形より説明的な名前を優先する。

```ts
import {
  and,
  compileCondition,
  compileQuery,
  descending,
  equals,
  greaterThanOrEqual,
  isIn,
  today,
} from "kintone-functional-query";
import { fields } from "./generated/customer-app";

const condition = and(
  equals(fields.CustomerName, "サイボウズ株式会社"),
  greaterThanOrEqual(fields.ContractDate, today()),
  isIn(fields.Status, ["検討中", "受注"]),
);

const conditionString = compileCondition(condition);

const queryString = compileQuery({
  condition,
  orderBy: [descending(fields.Amount)],
  limit: 100,
  offset: 0,
});
```

この形の利点:

- `functional-query` という名前に合う
- AST を直接組み立てていることが明確
- JavaScript の真偽値演算子ハックに依存しない
- ラムダの「評価されないはずの式をどう読むか」という違和感がない
- IDE 補完の主体が field descriptor になる
- `@kintone/rest-api-client` の `condition` と `query` の両方に自然につなげられる

### 7.1 condition と query を分ける

kintone の公式 client には、`getRecords()` の `query` と、`getAllRecords()` / `getAllRecordsWithId()` などの `condition` がある。

`condition` では `order by` / `limit` / `offset` を含められない。
そのため v2 でも public API を以下の 2 つに分ける。

- `compileCondition(expr)`:
  - 条件式だけを文字列化する
  - `getAllRecordsWithId()` など向け
- `compileQuery({ condition, orderBy, limit, offset })`:
  - 完全な query string を組み立てる
  - `getRecords()` や cursor 系向け

内部的にはどちらも同じ AST / compiler を使い、`query` は `condition` の上に query options を載せる。

### 7.2 public API は意味がわかる名前を優先する

短い `eq`, `gte`, `inArray` は内部 alias としてはあり得るが、README と推奨 API では説明的な名前を優先する。

また、kintone の query grammar には一般的な unary `not` はない。
否定は `not in`, `not like`, `is not` のように operator ごとに表現する。

例:

- `equals`
- `notEquals`
- `greaterThan`
- `greaterThanOrEqual`
- `lessThan`
- `lessThanOrEqual`
- `contains`
- `doesNotContain`
- `isIn`
- `isNotIn`
- `isEmpty`
- `isNotEmpty`
- `ascending`
- `descending`
- `today`
- `now`

## 8. API 設計原則

### 8.1 文字列ではなく descriptor を渡す

原則として public API は field code の生文字列を受け取らない。

良い:

```ts
equals(fields.Amount, 1000)
```

悪い:

```ts
equals("Amount", 1000)
```

理由:

- typo を防げる
- field type を引き回せる
- subtable path を自然に扱える

### 8.2 operator 制約は型で表現する

例:

- `contains()` は text 系にだけ生やす
- `greaterThan()` は number/date/datetime/time にだけ許可する
- `isEmpty()` は empty 判定可能な field にだけ許可する
- subtable field の `=` / `!=` 不可のような kintone 特有制約を型で可能な範囲まで表現する

### 8.3 raw escape hatch は残す

kintone の仕様差分や未対応ケースは必ず出るため、明示的な escape hatch を用意する。

```ts
const condition = rawCondition('Company_DB.company_name in ("kintone")');
```

ただし `rawCondition()` は unsafe API として名前で明示する。

### 8.4 静的制約と runtime guard を分ける

v2 は型安全を重視するが、kintone のすべての制約を TypeScript の型だけで完全表現できるとは限らない。

そのため以下を分離する。

- TypeScript が止められるもの:
  - field code typo
  - field type と operator の不一致
  - option 値の union
- runtime guard で止めるもの:
  - `limit` / `offset` の上限
  - 関数引数の一部制約
  - 仕様上の細かな禁止事項で、型では過剰に複雑になるもの

## 9. 生成器の方針

v2 の codegen は Schema layer の中心機能であり、happy path では必須にする。

ここで言う `codegen` とは、「kintone の field 定義から query 用の型付き descriptor ファイルを生成すること」を指す。

つまりユーザーは開発中に以下を行う。

1. アプリの field 定義を取得する
2. そこから `generated/*.ts` を生成する
3. アプリ設定が変わったら再生成する

### 9.0 なぜ codegen を必須にするのか

codegen を optional にすると、結局は生文字列ベースの unsafe API を大きく残す必要がある。

v2 はそこを避けるため、happy path は以下で固定する。

- schema を生成する
- generated schema を import する
- descriptor ベースで query を組み立てる

manual / raw な書き方は escape hatch としてだけ残す。

### 9.1 入力

- live fetch
- JSON snapshot

#### live fetch

CLI が kintone へ接続し、`Get Form Fields` を呼んでそのまま descriptor を生成する。

これは CLI 利用時の標準フローにする。

実装は `@kintone/rest-api-client` を使ってよい。
つまり認証処理や REST 呼び出しの基礎は既存 client に委ね、v2 自身はその結果を query 向け schema に変換することへ集中する。

#### JSON snapshot

すでに取得済みの field 定義 JSON をローカルファイルから読み込み、descriptor を生成する。

これは以下のために持つ。

- CI で credential なしに再生成したい
- schema を review 可能な形で固定したい
- サンプルやテストでネットワークなしに動かしたい
- アプリ実体が今見えない環境でも開発したい

### 9.2 出力

- query 用 field descriptor
- 必要なら軽い TypeScript type alias
- app metadata
  - app id
  - app revision
  - generated at

出力先の例:

```ts
// generated/customer-app.fields.ts
export const appMetadata = {
  appId: "42",
  revision: "17",
  generatedAt: "2026-04-23T12:34:56Z",
} as const;
```

### 9.3 やらないこと

- Effect Schema の大量出力
- バッチ生成の複雑な abstraction
- multi-environment orchestration

### 9.4 generated schema は Git 管理前提とする

generated schema は repo に commit してよいし、むしろそれを推奨する。

理由:

- PR 上で schema 変更が見える
- CI で再現しやすい
- runtime で毎回 fetch しなくてよい
- schema drift を差分として把握できる

### 9.5 schema drift 対策

schema drift は主要リスクなので、初期設計から対策を持つ。

最低限入れるもの:

- generated schema に app revision を埋め込む
- `check-schema` コマンドを用意する
- `generate` 実行時に差分を検出しやすい出力にする

`check-schema` の役割:

- live app の field revision と generated schema の revision を比較する
- 一致しなければ再生成を促す

## 10. repo / package 構成

推奨は「公開面は 1 つ、内部実装はレイヤ分割」。

- npm package 名: `kintone-functional-query`
- GitHub repo 名: `kintone-functional-query`
- 内部ディレクトリ:
  - `src/core`
  - `src/compiler`
  - `src/codegen`
  - `src/cli`

最初から複数 package に分けるのではなく、内部モジュール境界を綺麗に保つ。
本当に必要になった時だけ split する。

## 11. v2.0.0 のスコープ

この案では、v2.0.0 から kintone 公式 query 仕様の full coverage を目指す。

つまり対応対象は以下。

- field descriptor model
- 全 official field type に対する operator 制約
- 全 official query function
- `condition` compiler
- `query` compiler
- `orderBy`, `limit`, `offset`
- single-app codegen CLI
- `generate` / `check-schema`
- full conformance tests

v2.0.0 に入れないもの:

- parser
- universal plugin mode の高度支援
- runtime schema validation framework
- logging
- performance tuning機構
- batch config

実装順は段階化してよいが、仕様上のゴールは最初から「kintone 公式 query grammar の full coverage」とする。

## 12. parser の扱い

parser は欲しいが、初版の中心ではない。

理由:

- v2 の本題は safe construction であり safe parsing ではない
- parser を入れると grammar 保守コストが跳ねる
- compiler と codegen をまず固める方が価値が高い

方針:

- v2.0.0 では未搭載か experimental
- 必要なら v2.1 以降で別モジュールとして追加

## 13. migration / release 方針

### 13.1 パッケージの扱い

`kintone-functional-query` の名前は維持可能。

ただし v2 は互換ではなく再起動なので、SemVer 上は明確に major bump とする。

- old line: `0.x`
- reboot line: `2.x`

### 13.2 deprecation の扱い

方針としては以下が自然。

- `0.x` は deprecated のまま残す
- `2.x` の公開時点で package 全体の deprecated 状態は解除する
- 必要なら deprecated 対象を `<=0.2.x` のような旧レンジへ限定する

### 13.3 README の語り口

README では正直に以下を書く。

- v1 は experimental な試行だった
- v2 は API を全面刷新した reboot
- lambda syntax は捨てた
- functional の意味は immutable AST composition である

## 14. 命名ガイド

v2 では public API 名も「関数合成で組み立てる」世界観に揃える。

推奨:

- `equals`
- `notEquals`
- `greaterThan`
- `greaterThanOrEqual`
- `lessThan`
- `lessThanOrEqual`
- `contains`
- `doesNotContain`
- `isIn`
- `isNotIn`
- `isEmpty`
- `isNotEmpty`
- `and`
- `or`
- `compileCondition`
- `compileQuery`

避けたい:

- `kintoneQuery((r) => ...)` のような旧世界観を強く引きずる主 API
- 過度に OO な builder chain
- DSL 的すぎる略記

## 15. 成功条件

v2 が成功と言える条件は以下。

- README の最初の 30 秒で「何をするライブラリか」が伝わる
- query を知らない人でも IDE 補完で普通の条件を書ける
- unsafe string を直書きする機会が大幅に減る
- ライブラリ本体の責務が query construction に留まっている

## 16. 最初に作るべきもの

実装順は以下を推奨する。

1. field descriptor model
2. primitive expr AST
3. `compileCondition`
4. `compileQuery`
5. single-app codegen
6. `generate` / `check-schema`
7. README 用の最小サンプル
8. raw escape hatch

parser は後回しでよい。

## 17. 現時点の懸念点

設計として前向きだが、現時点で意識しておくべき懸念点はある。

### 17.1 TypeScript の型複雑性

field type ごとの operator 制約を厳密に表すほど、型定義は複雑になる。

対策:

- field descriptor を中心にして型計算を局所化する
- public API は説明的で単純に見せる
- 無理な箇所は runtime guard に逃がす

### 17.2 static safety と spec fidelity の両立

kintone 仕様を 100% 型だけで表そうとすると、利用者に見えるエラーがかえって読みにくくなる可能性がある。

対策:

- 型で気持ちよく止められるものは型で止める
- それ以外は runtime error message を丁寧にする

### 17.3 schema drift

型が正しくても schema が古ければ意味がない。

対策:

- generated schema を Git 管理する
- app revision を埋め込む
- `check-schema` を入れる

### 17.4 認証と導入 DX

live fetch 前提だけだと、認証設定が面倒で導入障壁になりやすい。

対策:

- `@kintone/rest-api-client` を活用する
- snapshot 入力も用意する
- CLI 設定を最小にする

## 18. このメモ時点の結論

`kintone-functional-query` という名前は、ラムダ式ライブラリとしては苦しい。
しかし「schema-aware functional query compiler」として作り直すなら十分に救える。

したがって v2 の設計判断は以下で固定する。

- 名前は維持候補
- 中身は 0 ベースで再設計
- lambda 路線は捨てる
- combinator + AST compiler 路線へ寄せる
- 主対象はビルド工程のある TypeScript プロジェクト
- happy path では schema codegen を必須にする
- generated schema は Git 管理前提とする
- スコープは query construction に絞る
