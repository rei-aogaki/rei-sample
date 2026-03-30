# REI SAMPLE — Photo Gallery

芸術的な没入型フォトギャラリー + CMS管理画面

## アーキテクチャ

- **ホスティング**: Cloudflare Pages
- **バックエンド**: Hono (TypeScript) on Cloudflare Workers (Pages Functions)
- **画像ストレージ**: Cloudflare R2 (`gallery-photos` バケット)
- **メタデータDB**: Cloudflare D1 (`photos` テーブル)
- **認証**: 環境変数ベースのパスワード + JWT トークン

## 3つのデザインモード

| モード | コンセプト |
|---|---|
| 🎀 POP | パステルカラー、丸みフォント、浮遊ハート/星パーティクル |
| ⚡ CYBER | ダークテーマ、ネオンシアン、光粒子、マグネティックチルト |
| △ INORGANIC | 白背景、等幅フォント、幾何学ワイヤーフレーム、グリッド |

---

## セットアップ手順

### 前提条件

- Node.js 18+
- Cloudflare アカウント
- Wrangler CLI (`npm install -g wrangler`)

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. Cloudflare にログイン

```bash
wrangler login
```

### 3. D1 データベース作成

```bash
wrangler d1 create rei-sample-db
```

出力される `database_id` を `wrangler.toml` に貼り付け：

```toml
[[d1_databases]]
binding = "DB"
database_name = "rei-sample-db"
database_id = "ここに貼る"
```

### 4. テーブル作成

```bash
# 本番
npm run db:init

# ローカル開発用
npm run db:init:local
```

### 5. R2 バケット作成

```bash
wrangler r2 bucket create gallery-photos
```

### 6. 環境変数の設定

#### ローカル開発（`.dev.vars` ファイルを作成）：

```
ADMIN_PASSWORD=your-strong-password
JWT_SECRET=your-random-secret-key-at-least-32-chars
```

#### 本番（Cloudflare ダッシュボード）：

1. Workers & Pages → rei-sample → Settings → Environment variables
2. 以下を追加：
   - `ADMIN_PASSWORD` = 任意の強力なパスワード
   - `JWT_SECRET` = ランダムな秘密鍵（32文字以上推奨）

### 7. ローカル開発

```bash
npm run dev
```

→ `http://localhost:8788` で確認

### 8. デプロイ

```bash
npm run deploy
```

---

## GitHub + 自動デプロイ

### GitHub リポジトリ作成 & push

```bash
git init
git add .
git commit -m "Initial commit: REI SAMPLE gallery"
git remote add origin https://github.com/YOUR_USER/rei-sample.git
git branch -M main
git push -u origin main
```

### Cloudflare Pages で GitHub 連携

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages
2. Create → Pages → Connect to Git
3. リポジトリ: `rei-sample` を選択
4. ビルド設定:
   - **Framework preset**: None
   - **Build command**: （空欄）
   - **Build output directory**: `public`
5. Save and Deploy

以降、`git push` するたびに自動デプロイ。

---

## API エンドポイント

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/photos` | 不要 | 写真一覧 |
| `GET` | `/api/photos/:id/image` | 不要 | 画像バイナリ配信 (R2) |
| `POST` | `/api/auth/login` | — | ログイン → JWT |
| `POST` | `/api/photos` | Bearer | 画像アップロード |
| `DELETE` | `/api/photos/:id` | Bearer | 写真削除 |
| `PATCH` | `/api/photos/:id` | Bearer | タイトル/並び順更新 |

---

## ファイル構成

```
rei-sample/
├── public/                   ← Cloudflare Pages 配信
│   ├── index.html            ← ギャラリー (モード選択 + 写真表示)
│   ├── admin.html            ← CMS 管理画面
│   ├── css/
│   │   ├── gallery.css       ← 3テーマ対応スタイル
│   │   └── admin.css         ← 管理画面スタイル
│   └── js/
│       ├── gallery.js        ← ギャラリーロジック
│       └── admin.js          ← CMS ロジック
├── functions/api/
│   └── [[route]].ts          ← Hono catch-all (Pages Functions)
├── src/
│   ├── index.ts              ← Hono アプリ定義
│   ├── types.ts              ← TypeScript 型定義
│   ├── routes/
│   │   ├── photos.ts         ← 写真 CRUD API
│   │   └── auth.ts           ← 認証 API
│   └── middleware/
│       └── auth.ts           ← JWT 検証ミドルウェア
├── schema.sql                ← D1 テーブル定義
├── wrangler.toml             ← Cloudflare 設定
├── tsconfig.json
├── package.json
└── .gitignore
```
