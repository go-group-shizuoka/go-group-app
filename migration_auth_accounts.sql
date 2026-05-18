-- =============================================================
-- migration_auth_accounts.sql
-- スタッフ認証アカウントテーブル（PBKDF2ハッシュ）
-- フロントコードの平文パスワードを廃止するための移行テーブル
-- Supabase SQL Editor に貼り付けて Run してください
-- =============================================================

-- ─── テーブル作成 ───
CREATE TABLE IF NOT EXISTS public.staff_accounts (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  username            TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'staff',
  staff_id            TEXT,
  facility_id         TEXT,
  selected_facility_id TEXT,
  display_name        TEXT,
  child_id            TEXT,
  child_name          TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS（service_role のみ参照可・anonからは一切見えない）───
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON public.staff_accounts;
CREATE POLICY "service_role_only" ON public.staff_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- ※ anon / authenticated には GRANT しない（service_role専用）

-- ─── インデックス ───
CREATE INDEX IF NOT EXISTS idx_staff_accounts_username ON public.staff_accounts(username);

-- ─── 初期アカウントデータ投入（PBKDF2-SHA256 ハッシュ済み）───
-- AUTH_SALT = gogroup2026SecureS@lt!  で生成
-- パスワード変更は Supabase SQL Editor か api/auth.js 経由で行うこと
INSERT INTO public.staff_accounts
  (username, password_hash, role, staff_id, facility_id, selected_facility_id, display_name)
VALUES
  ('homestaff', 'd84088909936dfe67128e6ec2b3456379ae87589dd8a59d35ba3a073e047fde3', 'staff',   's1',  'f1',  'f1',  'GO HOME スタッフ'),
  ('roomstaff', 'd84088909936dfe67128e6ec2b3456379ae87589dd8a59d35ba3a073e047fde3', 'staff',   's4',  'f2',  'f2',  'GO ROOM スタッフ'),
  ('town1staff','d84088909936dfe67128e6ec2b3456379ae87589dd8a59d35ba3a073e047fde3', 'staff',   's7',  'f3',  'f3',  'TOWN 1ST スタッフ'),
  ('town2staff','d84088909936dfe67128e6ec2b3456379ae87589dd8a59d35ba3a073e047fde3', 'staff',   's10', 'f4',  'f4',  'TOWN 2ND スタッフ'),
  ('homemgr',   '067ea072ebe4d7722d582d05b02a6f070fdf93163f17eb734d7418f0158243ee', 'manager', 's3',  'f1',  'f1',  'GO HOME 施設長'),
  ('roommgr',   'adcd31917fd4d54a1b54e75bd271f21dd3ca2d6d2daca77dde4f0a3e9235eb81', 'manager', 's6',  'f2',  'f2',  'GO ROOM 施設長'),
  ('town1mgr',  '703573c10d26651df3d2d0e1d18d5d7e8ca1a6a56c03a7584c0d2ccc3a299563', 'manager', 's9',  'f3',  'f3',  'TOWN 1ST 施設長'),
  ('town2mgr',  'fd523604e7a70ab322a2deea3eb87045f6f8bb6e0e6f0ab9d08bebb4a717841e', 'manager', 's12', 'f4',  'f4',  'TOWN 2ND 施設長'),
  ('admin',     '5cc1c54b5906da3864607abfb0fed4182172363c6724ba1fb25e29385ef93cda', 'admin',   '',    '',    'f1',  '本部管理者'),
  ('parent1',   '0f2575dffebd7b99875a542b86412a419a06b0afd99661006e5d353391d1813f', 'parent',  '',    'f1',  'f1',  '保護者')
ON CONFLICT (username) DO NOTHING;

-- ─── 確認クエリ ───
SELECT username, role, facility_id, display_name, is_active FROM public.staff_accounts ORDER BY role, username;
