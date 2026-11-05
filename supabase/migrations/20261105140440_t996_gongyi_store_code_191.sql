-- User confirmed source-report store 191 for 台中公益, 2026-11-05.
-- Keep legacy 186 and every historical row recoverable; only 43 enabled stores.
do $$
declare old_store public.t996_restaurants%rowtype;
begin
 select * into strict old_store from public.t996_restaurants where store_code='186' for update;
 if old_store.restaurant_name not in ('台中公益','台中公益（舊設定186）') then raise exception 'Unexpected store 186; correction aborted';end if;
 if exists(select 1 from public.t996_restaurants where store_code='191' and restaurant_name<>'台中公益') then raise exception 'Store 191 conflicts';end if;
 update public.t996_restaurants set restaurant_name='台中公益（舊設定186）',enabled=false where store_code='186';
 insert into public.t996_restaurants(store_code,restaurant_name,area_code,ac_name,enabled)
 values('191','台中公益',old_store.area_code,old_store.ac_name,true)
 on conflict(store_code) do nothing;
end $$;
