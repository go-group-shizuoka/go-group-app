# Phase1 セキュリティ強化 実行ランブック（go-group-app）

本番稼働中システムの認証・RLS移行手順。**順序厳守**。各ゲートで検証してから次へ。
すべて `saas-phase1` ブランチで実装済み。`main`・本番へは未反映。

## 変更ファイル一覧（実装済み・未デプロイ）

| ファイル | 種別 | 内容 |
|---|---|---|
| `migration_phase1_auth.mjs` | 新規 | 11アカウントを Supabase Auth へ移行（app_metadataにrole/facility_id/staff_id） |
| `go-group-app.jsx` | 改修 | ①sbラッパーをユーザーJWT化 ②ログインをSupabase Auth化 ③平文パスワード削除 ④/api/*にJWT自動付与 ⑤45分ごとトークン更新 |
| `api/_auth.js` | 新規 | サーバーレスAPI共通のJWT検証ヘルパー |
| `api/*.js`（11本） | 改修 | 認証必須ガード追加（ocr/isp-ai/activity-ai/summarize/classify/staff-doc-ai/staff-doc-summary/merge-pages/upload/audit/line-push） |
| `rls_phase1_complete.sql` | 新規 | 全25テーブルのRLS完全版（開放ポリシー廃止・施設分離） |

**除外**: `api/auth.js`（旧ログインEP・移行後は不使用）、`api/line-webhook.js`（LINE署名検証が本来のガード）。

---

## ⚠️ 実行順序（これを守らないと全員ログイン不能になる）

```
STEP1  段階1 Auth移行を先に本番実行  ← ここで auth.users が作られる
         （この時点では旧デプロイのまま。旧コードは影響を受けない）
STEP2  検証: dry-runで全11件 ↻更新/＋作成 済みを確認
STEP3  段階2+3 コードを本番デプロイ    ← ログインがSupabase Auth・APIガード有効
STEP4  検証: 実アカウントでログイン / AI7機能 / スマホ表示
STEP5  段階4 RLS を最後に本番実行       ← ここでテナント分離が有効化
STEP6  検証: 他施設データが見えないこと・自施設が正常なこと
```

> なぜこの順序か: 現状フロントはSupabase Auth未使用。コード(STEP3)を先に出すと、
> auth.usersが無い状態で平文フォールバックも消えているため**誰もログインできない**。
> RLS(STEP5)を先に締めると、JWTを持たない旧コードのリクエストが全拒否され**全画面空表示**。

---

## STEP1: Auth移行（本番書き込み・追加のみ）

```bash
cd ~/Desktop/go-group-app
set -a; . ./.env.local; set +a
export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
node migration_phase1_auth.mjs            # まず dry-run（確認）
node migration_phase1_auth.mjs --apply    # 本番適用
```
- べき等（再実行安全）。ロールバックは `--rollback`。
- 既存パスワードのまま移行するため、職員は**従来のID/パスワードでそのままログイン可能**。

## STEP3: コードデプロイ

```bash
git add -A && git commit -m "feat(security): Phase1 Supabase Auth移行・API認証ガード・RLS準備"
git push origin saas-phase1
```
- Vercel で `saas-phase1` をプレビュー確認 → 問題なければ本番昇格（main マージ or Production指定）。
- Vercel 環境変数に `SUPABASE_SERVICE_KEY`（または `SUPABASE_SERVICE_ROLE_KEY`）と `ANTHROPIC_API_KEY` が設定済みであること（既存APIが使用中なので通常はOK）。

## STEP5: RLS適用

- Supabase Dashboard → SQL Editor に `rls_phase1_complete.sql` を貼り付けて実行（1トランザクションで実行され、失敗時は自動ロールバック）。
- 実行後、ファイル末尾セクションEの検証クエリで `anon_all` が0件・全テーブル `rowsecurity=true` を確認。

---

## 検証チェックリスト（STEP4 / STEP6）

- [ ] admin / homemgr / homestaff / parent1 / viewer でログイン成功
- [ ] homestaff（f1）で他施設(f2-f4)の利用者が**見えない**
- [ ] admin で全施設が見える
- [ ] 出欠・検温・利用記録の保存が成功する（RLS書き込みOK）
- [ ] AI7機能（OCR/ISP生成/活動記録生成/要約/分類/職員書類×2）が動作
- [ ] 未ログインで `/api/ocr` を叩くと 401
- [ ] スマホ幅で表示崩れなし
- [ ] 60分アイドルで自動ログアウト、稼働中は45分更新でセッション維持

## 緊急ロールバック

| 症状 | 対応 |
|---|---|
| ログイン不能 | コードを前デプロイに戻す（Vercel Rollback）。auth.usersは残してよい |
| 全画面空表示 | `rls_phase1_complete.sql` 末尾セクションF（ロールバック）を実行 |
| Auth移行やり直し | `node migration_phase1_auth.mjs --rollback` |

## Phase2 以降の残課題（今回スコープ外）

- 保護者(parent)を施設単位ではなく**自分の子のみ**に厳格化（child_id単位RLS）
- 移行済みアカウントのパスワード強制ローテーション
- Storageバケット（写真・書類）のRLS/署名URL化
- 法人(org_id)層の追加＝複数法人SaaS（案B: 販売用は別Supabaseプロジェクト）
- `api/auth.js`（旧ログインEP）の撤去
