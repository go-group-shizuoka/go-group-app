# GO GROUP APP セキュリティ強化 & SaaS化 実施サマリ（Phase1〜Phase2）

最終更新: 2026-07-06

本ドキュメントは、GO GROUP APP に対して実施した Phase1（セキュリティ強化）と
Phase2（マルチテナントSaaS基盤）の内容・成果・構成を記録したもの。
新規法人導入（SaaS顧客オンボード）を再開する際の起点。

---

## 0. 全体像

| 項目 | 内容 |
|---|---|
| 現行アプリ | `go-group-app`（Vite+React・単一ファイル go-group-app.jsx 約3万行） |
| 本番URL | https://go-group-app.vercel.app/ |
| GitHub | go-group-shizuoka/go-group-app（本番=main / 開発=saas-phase1） |
| GO GROUP本番DB | Supabase `jjouwtsjykxnmvuaqhbc`（自社4施設・現行運用） |
| SaaS販売用DB | Supabase `qbouzngjtrwnufctfknv`（go-group-saas・新規法人用・**別プロジェクト=案B**） |
| SaaS戦略 | **A案**: GO GROUP=現DBで運用継続（デモ兼モデル法人）／新規顧客=SaaSプロジェクト |

---

## 1. Phase1: セキュリティ強化（GO GROUP本番・完了・本番反映済）

監査で発見した「匿名で児童個人情報が閲覧可能」等の重大脆弱性を修正。

| # | 対応 | 実装/検証 |
|---|---|---|
| 認証移行 | 平文PWを廃止し Supabase Auth へ。11アカウント移行 | `migration_phase1_auth.mjs` |
| API保護 | AI/OCR/LINE等13本のserverless関数にJWT検証ガード | `api/_auth.js` + 各route |
| RLS施設分離 | 全57テーブルに施設単位RLS（コア25 `rls_phase1_complete.sql` + gap32 `rls_phase1_fix.sql`/`rls_phase1_gap.sql`） | 匿名read=0・施設分離実測 |
| パスワード強化 | 全11アカウントを14文字強力PWへ | `migration_phase1_passwords.mjs` |
| Git衛生 | 漏洩PAT失効・新トークン・keychain整理 | 完了 |

**検証結果**: 匿名で機微テーブル全0件 / 施設長・職員は自施設のみ / 未認証API 401 / AI7機能維持。
デプロイ: main（本番）反映済み。実行手順は `docs/phase1-security-runbook.md`。

---

## 2. Phase2: マルチテナントSaaS基盤（新プロジェクト・完了・GO GROUP本番に影響なし）

他法人へ販売するため、**新Supabaseプロジェクトに org_id 分離のSaaS基盤を構築**（案B）。
GO GROUP本番DBには一切触れていない。

### 2-1. 階層設計
```
organizations（法人＝テナント）
   └ facilities（施設）
        └ staff_data（職員） / users_data（児童）
             └ 各種記録・書類・写真（全テーブル org_id 保持）
```

### 2-2. 実施内容（新DB qbouzngjtrwnufctfknv）
| 項目 | 内容 | スクリプト |
|---|---|---|
| ヘルパー関数 | `auth_org_id()` `auth_role()` `auth_facility_id()` `auth_child_id()`（JWTクレーム読取） | saas_bootstrap.mjs |
| マスタ | organizations(org_1=GOデモ / org_2=テスト法人) + facilities(f1-4,g1) | 同上 |
| 全テーブル | 現DBの57テーブルを `org_id NOT NULL` + `id PRIMARY KEY` 付きで再現（計59） | 同上 |
| 法人RLS | 全テーブル `org_id=auth_org_id()` 必須（施設分離と併用）・117ポリシー | saas_rls.mjs |
| Storage | 4バケット全private + storage.objects default-deny + org照合署名URL発行API | saas_storage.mjs / `api/file-url.js` |
| env切替 | Supabase接続先を `VITE_SUPABASE_URL/ANON_KEY` 化（未設定=GO GROUP） | go-group-app.jsx |

### 2-3. 検証結果（実測）
- **法人分離**: org_1↔org_2 で 児童・職員・書類・写真すべて相互0件・越境書込403・自法人書込OK（`saas_isolation_test.mjs`）
- **Storage漏洩テスト**: 実PDFを配置しても匿名は全拒否（DL/署名/一覧=[]）・別法人403・正規ゲートウェイのみ取得成功
- **env切替**: env無=GO GROUP / env有=SaaS をビルド実測。main（GO GROUP本番）は 340c48e のまま無傷

---

## 3. ファイル一覧（saas-phase1 ブランチ）

| ファイル | 用途 |
|---|---|
| `migration_phase1_auth.mjs` / `migration_phase1_passwords.mjs` | Phase1 認証移行・PW強化 |
| `rls_phase1_complete.sql` / `rls_phase1_fix.sql` / `rls_phase1_gap.sql` | Phase1 施設RLS（GO GROUP本番適用済） |
| `api/_auth.js` / `api/file-url.js` | API認証ガード / org分離署名URL |
| `saas_bootstrap.mjs` | SaaS基盤: 関数・マスタ・全テーブル作成 |
| `saas_rls.mjs` | SaaS 法人単位RLS |
| `saas_storage.mjs` | SaaS Storageバケット・分離 |
| `saas_isolation_test.mjs` | 法人間分離の実測テスト |
| `phase2_schema_map.json` | 現DBスキーマ抽出結果（gitignore） |
| `.saas-env` | 新プロジェクト接続情報（gitignore・機密） |
| `docs/saas-onboarding-runbook.md` | 新規法人導入手順（再開用） |

---

## 4. 未完（新規法人オンボード時に実施）
- SaaSアプリ本格ポート: ファイルupload/表示を `{org_id}/{facility_id}/` パス + `api/file-url.js` 経由へ配線
- 新プロジェクトの Supabase Auth ユーザー作成（org_id を app_metadata に付与）
- SaaS用Vercelプロジェクト作成 + 環境変数設定
- （任意）GO GROUPデータを org_1 として新DBへ移行（スキーマ一致済で可能）

詳細は `docs/saas-onboarding-runbook.md`。
