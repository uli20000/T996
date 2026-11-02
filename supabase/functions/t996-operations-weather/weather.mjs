// Central Weather Administration CODiS daily observations, Taiwan local calendar dates.
export const SOURCE='https://codis.cwa.gov.tw/StationData';
export function monthDates(month){
  if(!/^\d{4}-\d{2}-01$/.test(month)||!Number.isFinite(Date.parse(month+'T00:00:00Z'))||new Date(month+'T00:00:00Z').toISOString().slice(0,10)!==month)throw new Error('月份格式錯誤');
  const next=new Date(month+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
  const last=new Date(next.getTime()-86400000).toISOString().slice(0,10),days=[];
  for(let i=1;i<=Number(last.slice(-2));i++)days.push(month.slice(0,8)+String(i).padStart(2,'0'));
  return days;
}
export const STATIONS=[
  {city:'台中',id:'467490',name:'臺中',type:'cwb'},
  {city:'苗栗',id:'C0E750',name:'苗栗',type:'auto_C0'},
  {city:'南投',id:'C0I460',name:'南投',type:'auto_C0'},
  {city:'彰化',id:'467270',name:'田中',type:'cwb'}
];
export function stationsFor(){return STATIONS;}
function validNumber(value,flag,min,max){
  if(value===null||value===undefined||String(value).trim()===''||(flag!==undefined&&flag!==null&&String(flag).trim()!=='0'))return null;
  const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
export function observation(row,station){
  const rain=row?.Precipitation,temperature=row?.AirTemperature;
  const trace=Number(rain?.Accumulation)===-9.8&&(rain?.Accumulationf==null||String(rain.Accumulationf).trim()==='0');
  const amount=validNumber(rain?.Accumulation,rain?.Accumulationf,0,3000);
  const mean=validNumber(temperature?.Mean,temperature?.Meanf,-50,60);
  return {date:String(row?.DataDate||'').slice(0,10),city:station.city,station_id:station.id,station_name:station.name,temperature:mean,precipitation:trace?null:amount,trace,status:mean!==null&&(amount!==null||trace)?'observed':'partial',source_url:SOURCE};
}
export async function fetchMonth(month,today,fetcher=fetch){
  const dates=monthDates(month),stations=stationsFor(month);
  if(month>today.slice(0,7)+'-01')return dates.flatMap(date=>stations.map(station=>({date,city:station.city,station_id:station.id,station_name:station.name,temperature:null,precipitation:null,trace:false,status:'future',source_url:SOURCE})));
  const results=await Promise.all(stations.map(async station=>{
    try{
      const body=new URLSearchParams({type:'chart_month',stn_type:station.type,stn_ID:station.id,start:month+'T00:00:00',end:dates.at(-1)+'T23:59:59',more:''});
      const response=await fetcher('https://codis.cwa.gov.tw/api/station',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('CWA HTTP '+response.status);
      const json=await response.json();if(json.code!==200)throw new Error('CWA response '+json.code);
      const rows=json.data?.find(s=>s.StationID===station.id)?.dts;if(!Array.isArray(rows))throw new Error('CWA missing station');
      return {station,rows:rows.filter(r=>dates.includes(String(r.DataDate).slice(0,10))).map(r=>observation(r,station)),failed:false};
    }catch{return {station,rows:[],failed:true};}
  }));
  return dates.flatMap(date=>STATIONS.map(station=>{
    const result=results.find(r=>r.station.id===station.id);
    if(date<today){const row=result?.rows.find(r=>r.date===date);if(row)return row;}
    return {date,city:station.city,station_id:station.id,station_name:station.name,temperature:null,precipitation:null,trace:false,status:date>today?'future':date===today?'pending':result?.failed?'unavailable':'missing',source_url:SOURCE};
  }));
}
export function retainObserved(rows,previous=[],fetchedAt=''){
 const map=new Map(previous.map(r=>[r.date+'|'+r.city,r]));
 return rows.map(row=>{const old=map.get(row.date+'|'+row.city);return ['missing','unavailable'].includes(row.status)&&old&&['observed','partial'].includes(old.status)?{...old,stale:true,retained_from:old.retained_from||fetchedAt}:row;});
}
