import {monthDates,fetchMonth as publicFetchMonth,STATIONS,retainObserved} from './weather.mjs';
const origins=new Set(['https://uli20000.github.io','http://127.0.0.1:8996','http://localhost:8996']);
export function createWeatherHandler({createClient,env,now=()=>new Date(),fetchMonth=publicFetchMonth}){
 return async req=>{
  const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://uli20000.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'},reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return reply({error:'請先登入'},401);
   const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY');if(url!=='https://sumcbwhaksuktsplenxy.supabase.co')return reply({error:'T996 project mismatch'},503);
   const user=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await user.auth.getUser(authorization.slice(7));if(auth.error||!auth.data?.user)return reply({error:'登入已過期'},401);
   const admin=await user.rpc('is_admin');if(admin.error||admin.data!==true)return reply({error:'限管理員查詢'},403);
   const {month,force}=await req.json();monthDates(month);const current=now(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(current);
   if(month<'2013-07-01'||month>today.slice(0,7)+'-01')return reply({error:'可查詢2013/07起至本月的觀測資料'},400);
   const service=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}}),cachedResult=await service.from('t996_operations_weather_months').select('payload,fetched_at').eq('month',month).maybeSingle(),cached=cachedResult.data;
   const valid=Array.isArray(cached?.payload)&&STATIONS.every(station=>cached.payload.some(r=>r.city===station.city&&r.station_id===station.id)),recent=month.slice(0,7)===today.slice(0,7),hasFailure=cached?.payload?.some(r=>['missing','unavailable'].includes(r.status)||r.stale),ttl=hasFailure?60000:recent?600000:7*86400000;
   const needsRollover=cached?.payload?.some(r=>r.date<today&&['pending','future'].includes(r.status));
   if(valid&&!needsRollover&&force!==true&&current.getTime()-Date.parse(cached.fetched_at)<ttl)return reply({rows:cached.payload,fetched_at:cached.fetched_at,source:'中央氣象署 CODiS'});
   const fresh=await fetchMonth(month,today),rows=retainObserved(fresh,valid?cached.payload:[],cached?.fetched_at),fetched_at=current.toISOString();
   let warning=cachedResult.error?'快取讀取失敗，已改讀氣象署來源':'';
   // Never replace useful cached observations with an all-unavailable result.
   if(rows.some(r=>['observed','partial'].includes(r.status))){const saved=await service.from('t996_operations_weather_months').upsert({month,payload:rows,fetched_at});if(saved.error)warning='觀測已讀取，快取寫入失敗';}
   return reply({rows,fetched_at,source:'中央氣象署 CODiS',...(warning?{cache_warning:warning}:{})});
  }catch{return reply({error:'天氣查詢失敗，請核對月份或稍後再試'},400);}
 };
}
