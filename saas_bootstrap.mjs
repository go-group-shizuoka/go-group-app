/**
 * saas_bootstrap.mjs  — 新Supabase(SaaS)プロジェクトのマルチテナント基盤を構築。
 * ・ヘルパー関数（JWTクレーム: org_id/role/facility_id/child_id）
 * ・organizations / facilities マスタ（法人→施設の階層）＋ org_1(GOデモ)/org_2(テスト法人) seed
 * ・現DBから抽出した全57テーブルを org_id TEXT NOT NULL + id PRIMARY KEY 付きで作成
 * node-pg で直接実行（コピペ不要）。
 */
import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const client = new pg.Client({
  host: env.SAAS_HOST, port: +env.SAAS_PORT, user: env.SAAS_USER,
  database: env.SAAS_DB, password: env.SAAS_PASSWORD, ssl:{rejectUnauthorized:false},
});

const schema = JSON.parse(fs.readFileSync("phase2_schema_map.json","utf8"));

// id/org_id/created_at/updated_at は標準化。それ以外はマップの型をそのまま。
function buildCreate(table, cols) {
  const defs = [];
  defs.push(`id text PRIMARY KEY`);
  defs.push(`org_id text NOT NULL`);
  for (const [name, type] of Object.entries(cols)) {
    if (["id","org_id"].includes(name)) continue;
    let def = `${JSON.stringify(name).replace(/"/g,'"')} ${type}`;
    if (name === "created_at") def = `created_at timestamptz DEFAULT now()`;
    else if (name === "updated_at") def = `updated_at timestamptz DEFAULT now()`;
    else def = `"${name}" ${type}`;
    defs.push(def);
  }
  // created_at 保証
  if (!cols.created_at) defs.push(`created_at timestamptz DEFAULT now()`);
  return `CREATE TABLE IF NOT EXISTS public."${table}" (\n  ${defs.join(",\n  ")}\n);`;
}

const run = async () => {
  await client.connect();
  console.log("接続OK。基盤構築を開始します。\n");

  // ① ヘルパー関数
  await client.query(`
    CREATE OR REPLACE FUNCTION public.auth_org_id() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'org_id'), '') $$;
    CREATE OR REPLACE FUNCTION public.auth_role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), auth.role()) $$;
    CREATE OR REPLACE FUNCTION public.auth_facility_id() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'facility_id'), '') $$;
    CREATE OR REPLACE FUNCTION public.auth_child_id() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'child_id'), '') $$;
  `);
  console.log("✅ ① ヘルパー関数 作成");

  // ② organizations / facilities マスタ
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.organizations (
      id text PRIMARY KEY, name text NOT NULL, plan text DEFAULT 'standard',
      active boolean DEFAULT true, created_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.facilities (
      id text PRIMARY KEY, org_id text NOT NULL, name text NOT NULL,
      active boolean DEFAULT true, created_at timestamptz DEFAULT now());
    INSERT INTO public.organizations (id,name,plan) VALUES
      ('org_1','GO GROUP（デモ）','standard'),
      ('org_2','テスト法人ABC','standard')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.facilities (id,org_id,name) VALUES
      ('f1','org_1','GO HOME'),('f2','org_1','GO ROOM'),
      ('f3','org_1','GO TOWN 1ST'),('f4','org_1','GO TOWN 2ND'),
      ('g1','org_2','ABC センター')
      ON CONFLICT (id) DO NOTHING;
  `);
  console.log("✅ ② organizations(org_1,org_2)/facilities(f1-f4,g1) 作成・seed");

  // ③ 全57テーブル作成
  let ok=0, ng=0;
  for (const [table, info] of Object.entries(schema)) {
    const ddl = buildCreate(table, info.cols || {id:"text"});
    try { await client.query(ddl); ok++; }
    catch(e){ ng++; console.log(`  ⚠️ ${table}: ${e.message.slice(0,90)}`); }
  }
  console.log(`✅ ③ テナントテーブル作成: 成功${ok} / 失敗${ng}`);

  // 確認
  const r = await client.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);
  console.log(`\npublicスキーマのテーブル総数: ${r.rows[0].count}`);
  await client.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
