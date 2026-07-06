# SaaS 新規法人オンボード手順書（再開用ランブック）

最終更新: 2026-07-06
前提: Phase2 でSaaS基盤（新Supabase `qbouzngjtrwnufctfknv` / go-group-saas）構築済み。
本書は「新しい法人（顧客）をSaaS版に載せる」または「SaaSアプリ本格稼働を再開する」ための手順。

GO GROUP本番（`jjouwtsjykxnmvuaqhbc`）とは別環境。**本番には触れない**。

---

## 0. 現状の到達点（再開時にまず思い出すこと）
- 新DBに org_id 分離の基盤（59テーブル・117 RLSポリシー・4バケット・org照合署名URL API）が構築済み。
- org_1（GOデモ）/ org_2（テスト法人）で法人間分離は実測検証済み。
- アプリは env 切替対応（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）。未設定なら GO GROUP に繋がる。
- 接続情報は `go-group-app/.saas-env`（gitignore）。keyローテした場合はここを更新。

---

## STEP 1. SaaS用フロントのデプロイ（Vercel）
1. Vercel で **新規プロジェクト**を作成し、GitHub `go-group-app` の **`saas-phase1` ブランチ**を指定
   （または既存プロジェクトを複製し、Production Branch を saas-phase1 に）
2. 環境変数を設定:
   ```
   VITE_SUPABASE_URL       = https://qbouzngjtrwnufctfknv.supabase.co
   VITE_SUPABASE_ANON_KEY  = （go-group-saas の anon key）
   SUPABASE_URL            = https://qbouzngjtrwnufctfknv.supabase.co
   SUPABASE_SERVICE_KEY    = （go-group-saas の service_role key）
   ANTHROPIC_API_KEY       = （AI機能用）
   ```
3. デプロイ → SaaS版フロントが新DBに接続される（GO GROUP本番とは別URL）

## STEP 2. 新しい法人（顧客）の初期セットアップ ★推奨: オンボードスクリプト
**`saas_onboard_org.mjs`** で「法人→施設→初期管理者(Auth連携)」を一括作成できる（UI不要）。
```bash
cp onboard.example.json onboard.json   # 編集: 法人ID・施設・管理者ID/パスワード
node saas_onboard_org.mjs onboard.json           # 確認(dry-run)
node saas_onboard_org.mjs onboard.json --apply   # 実行
```
→ organizations / facilities / 初期管理者の Supabase Auth(app_metadataにorg_id/role/facility_id) / staff_data を作成。
初期管理者は onboard.json の loginId / password でログイン可能。以降の職員追加はアプリの「スタッフ管理」から（`api/create-staff` が Auth を自動作成）。

## STEP 3. 追加職員のアカウント作成
アプリの スタッフ管理 で職員を登録/編集すると `api/create-staff` が Supabase Auth を自動作成（app_metadataにrole/facility_id/org_id）。パスワードはAuthのみ保存（DB平文なし）。
手動で作る場合は org_1 の Auth に `app_metadata = { org_id, role, facility_id, display_name }` を付与。

## STEP 4. Storage（ファイル）を org 分離で使う
- 保存パス規約: **`{org_id}/{facility_id}/ファイル名`**
- アップロード: `api/upload.js`（service_role）でこの規約のパスに保存するよう配線
- 取得: フロントは **`POST /api/file-url`**（要ログイン）で署名URLを取得
  - `api/file-url.js` が「JWTのorg_id == パス先頭org_id」を照合し、一致時のみ署名URL発行（他法人403）
- ⚠️ 現状アプリの写真表示は getPublicUrl 前提。SaaS本格稼働時はここを file-url 経由へ差し替える（残作業）

## STEP 5. 分離の再検証（顧客追加のたびに推奨）
```
cd go-group-app && node saas_isolation_test.mjs      # 法人間 read/write 分離
# Storage は service_role で {org}/ にファイルを置き、別org・匿名から取得不可を確認
```

---

## 参考: DB戦略・設計判断
- **案B（採用）**: 販売用は新規Supabase。自社GO GROUPは現DB維持。RLSバグ時も本番と隔離。
- 分離の要は **RLS × JWT app_metadata.org_id**。フロントのフィルタは二重防御に過ぎない。
- 順序原則（もし現DBに org_id を後入れする場合）: 列追加+backfill → コードが org_id 書込 → 最後にRLS厳格化。RLS先行はロックアウト事故。

## 参考: キーのローテーション
`.saas-env` の DBパスワード / anon / service_role はチャット履歴に露出済み。
本番運用前に Supabase（Settings → API / Database）でローテーション推奨。ローテ後は `.saas-env` を更新。

---

## GO GROUP本番の扱い（重要）
- GO GROUP本番（main / jjouwtsjykxnmvuaqhbc）は Phase1 セキュリティ済みで**現行運用継続**。
- SaaS作業は saas-phase1 ブランチ + 新DBのみ。**main へマージしない限り GO GROUP本番は不変**。
