-- go-group-saas プロジェクトの SQL Editor で実行
-- storage.objects を法人単位でアクセス制御（パス先頭フォルダ = org_id）
-- {org_id}/{facility_id}/ファイル名 という形で保存する前提。全4バケット共通に効く。
alter table storage.objects enable row level security;
drop policy if exists obj_org_read on storage.objects;
drop policy if exists obj_org_write on storage.objects;
create policy obj_org_read on storage.objects for select to authenticated
  using ((storage.foldername(name))[1] = public.auth_org_id());
create policy obj_org_write on storage.objects for all to authenticated
  using ((storage.foldername(name))[1] = public.auth_org_id())
  with check ((storage.foldername(name))[1] = public.auth_org_id());
