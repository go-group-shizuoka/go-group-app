# go-group-app SaaS化 設計ドキュメント（Phase0）

放課後等デイサービス業務管理アプリ `go-group-app` を、他社へサブスク提供する
マルチテナントSaaSにするための設計。**Phase0＝設計のみ。実装は未着手。**

最終更新: 2026-06-28

---

## 全体ロードマップ

| Phase | 内容 | 状態 |
|-------|------|------|
| **Phase0** | 設計（テーブル一覧／org_id設計／変更ファイル一覧／影響範囲確認） | ← 本ドキュメント |
| Phase1 | 認証基盤（organizationsテーブル・org_id追加・RLS変更・JWT設計） | 未着手 |
| Phase2 | 法人管理（法人登録・施設追加・職員招待） | 未着手 |
| Phase3 | 販売機能（Stripe・契約管理・プラン管理） | 未着手 |

**前提**：①請求の処遇改善加算は行政書士待ちで保留。②新機能より先にPhase0→Phase1の基盤を固める（飛ばすとデータ移行・セキュリティで詰む）。

---

## 1. テーブル一覧

SQL定義34・コード参照で計**60以上**。全テナントデータテーブルが `org_id` 付与対象。

- SQL定義済み（`*.sql`）: organizations(なし) / users_data / staff_data / records / kokuho_data /
  att_data / messages / isps / isp_records / isp_drafts / shifts / daily_reports /
  assessments / monitorings / facesheets / child_documents / jukyusha_docs / qual_docs /
  staff_accounts / audit_checks / ocr_analysis_logs / ocr_correction_logs / dev_records /
  visit_records / visit_dests / parent_support_records / monitoring_notes / paid_leave_reqs /
  soudan_genans / manual_review_queue / document_page_groups / page_merge_history / schedules / transport_data ほか
- コードのみ参照（SQL未定義・**Supabase UIで直接作成された可能性大**）: service_records / billing_audit_log /
  support_plans / monthly_locks / facility_events / claim_history / billing_items / addition_items /
  announcements / announcement_reads / surveys / survey_responses / photo_albums / parent_contacts /
  staff_documents / staff_doc_* / staff_attendance / kintai_corrections / absence_reports /
  planned_visits / billing_check_results / activity_records / transport_logs ほか

> ⚠️ **未確定（Phase1着手前に必須）**：本番Supabase（`jjouwtsjykxnmvuaqhbc`）の `information_schema` で
> 全テーブルの実在とカラムを棚卸ししてからマイグレーションを書く。リポジトリSQLは不完全。

**グローバルマスタ**（地域単価 `SHIZUOKA_TANKA`・加算マスタ）は現状コード内定数 → org_id不要。
将来DB化する時のみ別扱い（静岡固定の全国化はPhase2以降）。

---

## 2. org_id 設計

### データ階層
```
organizations（法人＝テナント・新規テーブル）
  └ facilities（施設・現状 f1-f4 ハードコード → DB化）
       └ 60+の業務テーブル（児童・職員・請求・記録…全部）
```

### 方針
- 全テナントデータテーブルに `org_id TEXT NOT NULL` を追加。
- 既存の `facility_id` は残す（org配下の施設スコープとして併用）。
- 既存データは単一テナント `org_1`(GO GROUP) でバックフィル → NOT NULL化。
- **本当の分離はRLS（JWTのorg_id）で担保**。フロントのJSフィルタは二重防御に過ぎない。

---

## 3. 変更ファイル一覧

### A. SQL（新規マイグレーション）
| ファイル | 内容 |
|---------|------|
| `migration_org_id.sql`（新規） | ①`organizations`作成 ②全テナントテーブルに`org_id`列追加 ③既存を`org_1`でバックフィル ④NOT NULL化 |
| `rls_org_policies.sql`（新規／`rls_facility_policies.sql`改修） | RLSを `org_id = JWTのorg_id` で全テーブル再定義 |

### B. フロント `go-group-app.jsx`（1ファイル・要所4箇所）
| 箇所 | 変更 |
|------|------|
| `sbSave`（:93付近） | 保存時 `data.org_id = currentOrg` を自動付与（96呼び出しを一括カバー） |
| `sbLoad`（:165付近） | `.eq("org_id", currentOrg)` 追加（53呼び出しを一括カバー・RLSとの二重防御） |
| `schedules` 直fetch（:3446 / :3455） | **中枢を迂回している唯一の箇所** → 個別に org_id 付与 |
| ハードコードアカウント `a1〜a11`（:356付近）／ログイン状態 | 各アカウントに `orgId`、`currentOrg` をグローバル状態へ |

### C. API `api/`
| ファイル | 変更 |
|---------|------|
| `auth.js` | ログイン応答に `org_id` を含める。`staff_accounts` に `org_id` 列追加 |
| `upload.js` | DB書込時に `org_id` を引き回す |
| `ocr.js` `activity-ai.js` `isp-ai.js` 等 | 書込時 `org_id` 引き回し（AI/OCRコストのテナント計測にも将来必要） |

---

## 4. 影響範囲確認（2026-06-28 静的解析）

- **中枢に集約**：`sbSave`×96 / `sbLoad`×53 / `sbDelete`×16 が全テーブルの入出力を担う
  → org_id注入は実質3関数で完結。フロント60箇所の個別改修は不要。
- **迂回は1箇所のみ**：`schedules` を `:3446/:3455` で直fetch。ここだけ手当てが必要。
- **API直アクセス**：`api/auth.js`・`api/upload.js` がDB直アクセス（サーバー側・別途org_id）。
- **セキュリティ**：フロントのキーは `anon` キー（service_roleではない✓）。
  ＝**RLSが唯一の防御壁**。Phase1のRLS再設計が最重要。

---

## Phase1 着手前のブロッカー（潰してから実装）

1. **本番Supabaseの全テーブル棚卸し**（SQL未定義テーブルの実在・カラム確認）。
2. **JWTにorg_idを載せる方式の決定**：現状は独自認証（PBKDF2＋コード直書きアカウント）。
   RLSで`org_id`を効かせるには **Supabase Auth移行 or カスタムJWTクレーム** が必要。Phase1最重量の設計判断。
3. バックフィルの`org_1`割り当て妥当性（GO GROUP単一テナントなので基本OK）。

## 既知の技術的負債（並行対応推奨）
- 本体が単一ファイル `go-group-app.jsx` 約30,000行 → マルチテナント複雑化前に分割したい。

---

## 5. データ移行設計（既存データを失わない安全移行）

現状は**単一テナント（GO GROUP）**。よって移行＝テーブル再構築ではなく
「`org_id`列の追加とバックフィル」が中心。**既存テーブルを作り直す必要はない**＝最大の安心材料。

### 移行7原則
1. **加算的変更のみ（Additive-only）**：`ADD COLUMN` だけ。DROP/RENAME/型変更はしない。
   旧コードは新カラムを無視できるので無停止。
2. **バックフィル→NOT NULLの順**：①`org_id TEXT`をnull許容で追加 → ②全行を`org_1`で更新 → ③後から`NOT NULL`化。
3. **冪等**：`ADD COLUMN IF NOT EXISTS` / `UPDATE ... WHERE org_id IS NULL`。何度流しても安全。
4. **バックアップ先行**：本番適用前にSupabase自動バックアップ確認＋pg_dump。可能ならコピーDBで予行演習。
5. **デプロイ順序（ロックアウト防止＝最重要）**
   - **Step A** DBに`org_id`追加＋`org_1`バックフィル（NOT NULLはまだ／RLSは現状のまま）← 旧コードのまま無停止
   - **Step B** コードが`org_id`を書込む版をデプロイ（`sbSave`/`sbLoad`/`auth`）＋JWTに`org_id`搭載
   - **Step C** 全行に`org_id`が乗り、コードがJWTを送っていることを確認後、**最後に**RLSをorg_id厳格化＋NOT NULL化
   - ⚠️ 順序を誤りRLSを先に締めると、`org_id`を持たない旧コードが全データから締め出され
     **「ログインできるのに何も見えない」**事故になる。マルチテナント移行最大の地雷。
6. **ロールバック**：Step C前なら常に`v1.0-stable`のコードへ戻せる（org_id列が増えただけ＝前方互換）。
   Step C後の緊急時はRLSをanonベースに戻す手順を用意。
7. **本番DBとSaaS DBの分離（Phase1の設計判断）**
   - 案A：同一Supabaseに他社テナント相乗り（org_idで分離）。安いがRLSバグ＝即情報漏洩、自社本番と同居。
   - 案B（**推奨**）：自社GO GROUPは現プロジェクト維持、販売用SaaSは**新規Supabaseプロジェクト**（コード共通・env切替）。
     自社運用の安定を販売リスクから物理分離でき、SaaS版は空から開始＝**移行リスク最小**。

---

## バージョン管理体系

| バージョン | 内容 | 状態 |
|-----------|------|------|
| **v1.0** | 自社運用版（現在・タグ `v1.0-stable`） | リリース済 |
| v1.1 | 法改正対応（請求の処遇改善加算ほか・行政書士待ち） | 保留 |
| v2.0 | SaaS対応（マルチテナント） | 設計中（本ドキュメント） |
| v2.1 | Stripe・契約管理・プラン管理 | 未着手 |
| v3.0 | AI強化・地域単価の全国対応 | 未着手 |

### Git運用
- `main` … 本番運用（不可侵・Vercelデプロイ元）
- `v1.0-stable` … 最初の正式リリースタグ（ロールバック基点）
- `saas-phase1` … SaaS化開発ブランチ（v2.0系の作業はここ）
