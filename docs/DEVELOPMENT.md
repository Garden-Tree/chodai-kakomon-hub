# 開発者向けガイド (Development Guide)

本ドキュメントでは、このプロジェクトのディレクトリ構造、および採用している主要ライブラリ・技術とその目的について解説します。

## ディレクトリ構造

本プロジェクトは Next.js (App Router) ベースで構成されています。

```text
src/
├── app/                  # Next.js App Routerのルーティングディレクトリ
│   ├── (auth)/           # 認証機能に関連するページ（ログインしているかどうかなど）
│   ├── (public)/         # 未ログインでもアクセス可能な公開ページ群
│   ├── actions/          # Server Actions（サーバー側で実行されるデータ処理処理）
│   ├── api/              # API Routes
│   ├── auth/             # 認証用のエンドポイント処理（コールバック処理など）
│   ├── login-common/     # ログイン画面などの共通ページ
│   ├── favicon.ico
│   ├── globals.css       # グローバルなCSS設定（Tailwindのエントリー含む）
│   └── layout.tsx        # アプリケーション全体のレイアウト
├── components/           # UIコンポーネント用ディレクトリ
│   └── ui/               # shadcn/uiで提供される汎用UIコンポーネント群群
├── lib/                  # 汎用的なユーティリティや各サービスのクライアント初期化設定
│   ├── supabase/         # Supabaseのクライアント関連（SSRやクライアントなど各種環境向け）
│   ├── prisma.ts         # Prismaのグローバルクライアントのインスタンス化
│   ├── supabase.ts       # Supabaseの共通関数・設定
│   └── utils.ts          # Tailwindのクラスマージなど、汎用的なヘルパー関数
└── middleware.ts         # Next.jsのEdge Middleware（セッション管理や動的なルート保護を担当）
```

*(その他ルートディレクトリに関する重要項目)*
- `prisma/`: データベースのスキーマ定義(`schema.prisma`)やマイグレーションファイル、シード用SQL(`seed.sql`)などが配置されます。
- `docs/`: 本ドキュメントをはじめとする、開発者向けの情報を取りまとめます。

---

## 主要ライブラリとその導入目的

本プロジェクトでは型安全性、開発の生産性、および保守性を重視して以下の技術スタックを採用しています。

### 1. フレームワーク・UI関連
- **Next.js (v16)**:
  App Router を活用してルーティング、API、およびServer Actionsを統合的に管理します。React Server Components(RSC)を利用しパフォーマンスやSEOを最適化します。
- **React (v19)**:
  最新バージョンのReact機能を使用しています。
- **Tailwind CSS (v4)**:
  ユーティリティファーストのCSSフレームワークで、迅速かつ一貫性のあるスタイリングを提供するために使用しています。
- **shadcn/ui (関連: `lucide-react`, `clsx`, `tailwind-merge`, `@base-ui/react`)**:
  npmパッケージとしてインストールするUIライブラリではなく、直接ソースコードとしてプロジェクトにコンポーネントを取り込む形式（headlessベース）のUIコンポーネント集です。ブラックボックス化を防ぎつつデザインを細かくカスタマイズするために導入しています。

### 2. データベースアクセス (ORM)
- **Prisma (`@prisma/client`, `@prisma/adapter-pg`)**:
  TypeScriptとの親和性が非常に高く、型安全にデータベースへアクセスするためのORM(Object Relational Mapper)です。データベースのマイグレーション管理も担います。
- **pg**:
  PostgreSQLに直接接続するためのNode.js用ネイティブドライバーです。`@prisma/adapter-pg` と併用し、Next.js環境で安定してPostgreSQLへアクセスするために利用しています。

### 3. 認証・バックエンド系サービス (BaaS)
- **Supabase (`@supabase/supabase-js`, `@supabase/ssr`)**:
  認証系(Auth機能)を安全かつ容易に組み込む目的で導入しています。`@supabase/ssr` を使うことで、Next.jsのServer Components側でもセッション判定を確実に行い、よりセキュアな設計にしています。

### 4. フォーム処理・バリデーション
- **React Hook Form (`react-hook-form`)**:
  ログインフォームや投稿フォームなど、複雑なフォームの状態管理を少ないレンダリングで高速に行うために導入しています。
- **Zod (`zod`, `@hookform/resolvers`)**:
  型安全なスキーマベースのバリデーションライブラリです。React Hook Formと連携し、ユーザー入力のバリデーションルールを宣言的に定義して不正な値の混入を防ぐ目的で導入しています。

---

## 環境変数の説明

プロジェクトルートに `.env.local` を作成し、以下の変数を設定してください。

| 環境変数名 | 説明 |
|---|---|
| `DATABASE_URL` | PrismaがDB接続に使うURL。Supabaseを使う場合はTransaction Pooler (port 6543) のURLを使用 |
| `DIRECT_URL` | マイグレーション時など直接DBへ接続するURL。Supabaseを使う場合はSession Pooler (port 5432) のURLを使用 |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトのURL（公開可） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseの匿名キー（公開可、RLSで保護） |

> [!CAUTION]
> `.env.local` は `.gitignore` によって除外されており、絶対にコミットしないでください。

---

## 開発用コマンド

```bash
# 開発サーバーの起動 (http://localhost:3000)
npm run dev

# 本番ビルド
npm run build

# 本番サーバーの起動 (ビルド後)
npm run start

# Lintの実行
npm run lint

# DBスキーマをデータベースへ反映（開発時向け・マイグレーション記録なし）
npx prisma db push

# マイグレーションを作成して適用
npx prisma migrate dev --name <マイグレーション名>

# Prismaクライアントの手動生成
npx prisma generate

# Prisma Studioの起動（DBのGUI）
npx prisma studio
```

---

## アーキテクチャの設計方針

### 認証フロー

本プロジェクトでは Supabase Auth を採用し、Next.js の App Router (Server Components) と安全に統合するために `@supabase/ssr` を利用しています。

```
ブラウザ → [middleware.ts] → Server Component / API Route
                (セッション確認)             (Supabaseからセッション取得)
```

1. `middleware.ts` が全リクエストを受け取り、Supabaseのセッションクッキーを更新します。
2. 各ページやServer Actionはサーバー側でセッションを確認し、未認証の場合はリダイレクトします。
3. クライアントサイドのみの認証判断を行わないため、セキュアな設計を実現しています。

### データベース構成 (Prisma + pg)

Supabase の場合、接続には**コネクションプーラー (Transaction Pooler)** 経由と**直接接続 (Session Pooler)** の2種類が存在します。

| 用途 | 接続方法 | 環境変数 |
|---|---|---|
| アプリケーションからのクエリ | Transaction Pooler (port 6543) | `DATABASE_URL` |
| DBマイグレーション実行時 | 直接接続 (port 5432) | `DIRECT_URL` |

Prisma の `@prisma/adapter-pg` を利用することで Node.js の `pg` ドライバーを通じて接続し、サーバーレス環境（Vercel等）でのコネクション管理問題を回避しています。
