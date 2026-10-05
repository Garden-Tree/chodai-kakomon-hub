# Chodai Kakomon Hub

大学の過去問・資料を共有するためのプラットフォームです。学生同士で過去問をオンライン共有することで、学習効率の向上を目的としています。

## 使用技術 (Tech Stack)

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Prisma ORM)
- **Authentication**: Supabase Auth (SSR)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Form/Validation**: React Hook Form + Zod

## セットアップ手順 (Getting Started)

### 前提条件
- Node.js (v20以上推奨)
- npm (または pnpm / yarn)
- PostgreSQLデータベース (Supabase等で用意するか、ローカル環境)
- Supabaseプロジェクト (Auth機能等を利用するため)

### インストール方法

1. リポジトリをクローンします。
   ```bash
   git clone <repository_url>
   cd chodai-kakomon-hub
   ```

2. 依存パッケージをインストールします。
   ```bash
   npm install
   ```

3. 環境変数の設定を行います。  
   プロジェクトルートに `.env` または `.env.local` ファイルを作成し、データベースURLおよびSupabaseの設定値を記述してください。
   ```env
   # PostgreSQLのコネクションプール用のURL(Prisma用)
   DATABASE_URL="postgres://postgres:password@localhost:5432/postgres"
   # DBマイグレーションで直結接続が必要な場合用
   DIRECT_URL="postgres://postgres:password@localhost:5432/postgres"

   # Supabaseキー情報
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   # サービスロールキー（サーバー専用・必須。絶対に公開しないこと）
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

   # サイト閲覧用の学内共通パスワード（必須）
   # 未設定、またはプレースホルダー値 your_common_password_here のままだとエラーになります
   SITE_COMMON_PASSWORD="change-me-to-a-strong-password"

   # 管理者のメールアドレス（任意・カンマ区切り）。通報の確認や過去問の非公開化/削除ができます
   ADMIN_EMAILS="admin1@example.ac.jp,admin2@example.ac.jp"
   ```

4. データベースの初期設定・マイグレーションを実行します。
   ```bash
   npx prisma db push
   # または npx prisma migrate dev
   ```

5. 開発サーバーを起動します。
   ```bash
   npm run dev
   ```
   ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスして動作を確認します。

---

## 開発用ドキュメント

プロジェクトの詳しいディレクトリ構造や各ライブラリの導入目的については、[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) を参照してください。

---

## コントリビューションについて

バグ報告や機能追加提案は Issue にてお知らせください。プルリクエストも歓迎しています。

1. このリポジトリをフォークします
2. 機能ブランチを作成します (`git checkout -b feature/your-feature`)
3. 変更をコミットします (`git commit -m 'feat: Add some feature'`)
4. ブランチをプッシュします (`git push origin feature/your-feature`)
5. Pull Request を作成します

## ライセンス

[MIT](./LICENSE)
