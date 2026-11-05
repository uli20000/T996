(function(root){
  'use strict';
  const config=typeof module!=='undefined'&&module.exports?require('./center-config.js'):root.T996Config;
  const AREAS=config.areas;
  const AC_ASSIGNMENTS=[...new Set(config.restaurants.map(x=>x.ac_name))].map(name=>({name,stores:config.restaurants.filter(x=>x.ac_name===name).map(x=>x.store_code)}));
  const NON_DELIVERY_STORES=new Set(config.nonDeliveryStores||[]);
  const F=typeof module!=='undefined'&&module.exports?require('./operations-forecast.js'):root.OpsForecast;
  const GROWTH=F.SETTINGS.growth,FORECAST_TPLH=F.SETTINGS.tplh;
  const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const ratio=(a,b)=>a!==null&&b!==null&&b>0?a/b:null;
  const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').trim();
  const isoDate=d=>new Date(d).toISOString().slice(0,10);
  const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return isoDate(d);};
  function duration(v){
    if(v===null||v===undefined||String(v).trim()===''||v==='-')return null;
    if(typeof v==='number')return v>=0&&v<1?v*86400:null;
    const m=String(v).trim().match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    return m&&+m[2]<60&&+m[3]<60?(+m[1]*3600+ +m[2]*60+ +m[3]):null;
  }
  function range(date,period){
    const first=date.slice(0,7)+'-01',next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
    const last=addDays(isoDate(next),-1);
    if(period==='month')return {start:first,end:last};
    if(period==='week'){const day=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;return {start:[first,addDays(date,-day)].sort().at(-1),end:[last,addDays(date,6-day)].sort()[0]};}
    return {start:date,end:date};
  }
  function dates(start,end){const out=[];for(let d=start;d<=end;d=addDays(d,1))out.push(d);return out;}
  function weeks(date){const r=range(date,'month'),out=[];for(let d=r.start;d<=r.end;){const w=range(d,'week');out.push(w);d=addDays(w.end,1);}return out;}
  function latestBatches(rows){const map=new Map();for(const b of [...rows].sort((a,b)=>String(b.imported_at).localeCompare(String(a.imported_at)))){const key=b.report_date+'|'+b.report_type;if(!map.has(key))map.set(key,b);}return [...map.values()];}
  function areaFor(row,mapping,catalog){
    const p=row.payload||{},name=clean(row.restaurant_name),code=String(row.store_code||'');
    const canonical=catalog.get(code);const confirmed=config.restaurants.find(x=>x.store_code===code);if(confirmed)return confirmed.area_code;const mapped=mapping.get(name)||mapping.get(clean(canonical?.restaurant_name));
    if(mapped)return mapped;
    const ac=String(p.AC||'').match(/996[-\s]?([A-I])$/i);return ac?ac[1].toUpperCase():'?';
  }
  function empty(){return {tc:0,fa:0,d7Y:0,d7N:0,d25Y:0,d25N:0,qtSum:0,qtN:0,d7Seconds:0,d7TimeN:0,d25Seconds:0,d25TimeN:0,prior:0,priorN:0};}
  function add(target,source){for(const k of Object.keys(empty()))target[k]+=source[k]||0;return target;}
  function derived(x){const nonfa=x.tc-x.fa,forecast=null;return {...x,nonfa,forecast,forecastHours:forecast===null?null:forecast/FORECAST_TPLH,faShare:ratio(x.fa,x.tc),sstg:x.priorN&&x.prior>0?x.tc/x.prior-1:null,sstgExFA:x.priorN&&x.prior>0?nonfa/x.prior-1:null,tcAchievement:ratio(x.tc,forecast),d7:ratio(x.d7Y,x.d7Y+x.d7N),d25:ratio(x.d25Y,x.d25Y+x.d25N),qt:ratio(x.qtSum,x.qtN),d7Avg:ratio(x.d7Seconds,x.d7TimeN),d25Avg:ratio(x.d25Seconds,x.d25TimeN)};}
  function buildOrders({rows,batches,history,mapping,catalog,reports,start,end,powerbiData}){
    const days=new Map(dates(start,end).map(date=>[date,{date,areas:new Map(AREAS.map(([a])=>[a,empty()])),types:new Set(),orders:[],raw:[],report:reports.find(x=>x.record_date===date)||null}]));
    const byBatch=new Map(batches.map(b=>[b.id,b]));
    const seen=new Set();
    for(const row of rows){const b=byBatch.get(row.batch_id);if(!b||!days.has(b.report_date))continue;const day=days.get(b.report_date);day.types.add(b.report_type);const key=b.report_date+'|'+b.report_type+'|'+row.store_code+'|'+(row.order_number||row.row_number);if(seen.has(key))continue;seen.add(key);const code=areaFor(row,mapping,catalog);if(!day.areas.has(code))day.areas.set(code,empty());const a=day.areas.get(code),p=row.payload||{};day.raw.push({...row,report_date:b.report_date,report_type:b.report_type,area_code:code});
      if(b.report_type==='ByOrder'){
        a.tc++;const fa=String(p['自動/手動']||'').trim()==='第三方';if(fa)a.fa++;
        else{const f7=String(p.D7||'').toUpperCase(),f25=String(p.D25||'').toUpperCase();if(f7==='Y')a.d7Y++;if(f7==='N')a.d7N++;if(f25==='Y')a.d25Y++;if(f25==='N')a.d25N++;}
        day.orders.push({...row,area_code:code,fa});
      }else{
        const qt=number(p.QT),t7=duration(p['留店時間']),t25=duration(p['外送達成時間（D30)']);
        if(qt!==null&&qt>=0){a.qtSum+=qt;a.qtN++;}if(t7!==null){a.d7Seconds+=t7;a.d7TimeN++;}if(t25!==null){a.d25Seconds+=t25;a.d25TimeN++;}
      }
    }
    const priorSource=F.prepare({history:powerbiData?.history||history,catalog,reports});
    for(const day of days.values()){
      const covered=new Set(),eligible=priorSource.eligible(day.date);day.baselineDate=F.comparisonDate(day.date);day.baselineMissingAreas=new Set();
      for(const store of eligible){const a=day.areas.get(store.area),value=priorSource.priorYear(store.name,day.date);if(!a)continue;if(value===null){day.baselineMissingAreas.add(store.area);continue;}a.prior+=value;a.priorN++;covered.add(store.name);}
      day.baselineCount=covered.size;day.baselineComplete=eligible.length>0&&covered.size===eligible.length;
    }
    const areas=new Map(AREAS.map(([a])=>[a,empty()]));if([...days.values()].some(d=>d.areas.has('?')))areas.set('?',empty());
    const total=empty(),hourTotals=new Map(AREAS.map(([a])=>[a,{hours:0,count:0}]));let totalHours=0,transferOut=0,transferIn=0,completeHours=true,hasHours=false;
    const missingPairs=[],missingHourDays=[],missingBaselineDays=[],hoursWithoutScores=[],invalidHourDays=[];
    for(const day of days.values()){
      day.scoreExcluded=!!day.report?.score_excluded;const active=day.types.has('ByOrder')&&!day.scoreExcluded;if(day.types.size&&day.types.size<2&&!day.scoreExcluded)missingPairs.push(day.date);
      day.metrics=empty();for(const [code,x] of day.areas){if(!day.scoreExcluded&&(active||start===end)){add(total,x);add(day.metrics,x);if(!areas.has(code))areas.set(code,empty());add(areas.get(code),x);}}
      day.metrics=derived(day.metrics);if(!day.baselineComplete){day.metrics.prior=null;day.metrics.sstg=null;day.metrics.sstgExFA=null;}day.hours=null;day.actualHours=null;
      const saved=day.report?.area_hours||{};let sum=0,entered=0,missing=0;
      for(const [a] of AREAS){const n=number(saved[a]);if(n!==null){sum+=n;entered++;if(!day.scoreExcluded){const x=hourTotals.get(a);x.hours+=n;x.count++;}}else if((day.areas.get(a)?.tc||0)>0)missing++;}
      if((day.areas.get('?')?.tc||0)>0)missing++;
      if(entered){day.hours=sum;if(!day.scoreExcluded){hasHours=true;totalHours+=sum;}}
      if(entered&&!active&&!day.scoreExcluded)hoursWithoutScores.push(day.date);
      const out=number(day.report?.transfer_out_hours)??0,inside=number(day.report?.transfer_in_hours)??0;if(!day.scoreExcluded){transferOut+=out;transferIn+=inside;}
      if(active&&(!entered||missing)){completeHours=false;missingHourDays.push(day.date);}
      if(entered&&!missing){day.actualHours=sum-out+inside;if(day.actualHours<0){day.actualHours=null;completeHours=false;invalidHourDays.push(day.date);}}
      if((active||start===end)&&!day.scoreExcluded&&!day.baselineComplete)missingBaselineDays.push(day.date);
      day.missingAreas=missing;
    }
    const summary=derived(total),actualHours=hasHours&&completeHours?totalHours-transferOut+transferIn:null;
    if(missingBaselineDays.length){summary.forecast=null;summary.forecastHours=null;summary.prior=null;summary.sstg=null;summary.sstgExFA=null;summary.tcAchievement=null;}
    return {priorSource,days,areas:new Map([...areas].map(([a,x])=>{const value=derived(x);if([...days.values()].some(d=>!d.scoreExcluded&&(d.types.has('ByOrder')||start===end)&&d.baselineMissingAreas.has(a))){value.prior=null;value.sstg=null;value.sstgExFA=null;}return [a,value];})),summary:{...summary,totalHours:hasHours?totalHours:null,transferOut,transferIn,actualHours,tplh:hoursWithoutScores.length?null:ratio(summary.nonfa,actualHours),hoursAchievement:hoursWithoutScores.length?null:ratio(actualHours,summary.forecastHours)},hourTotals,missingPairs,missingHourDays,missingBaselineDays,hoursWithoutScores,invalidHourDays};
  }
  function build(args){
    const v=buildOrders(args),details=[],sum=xs=>xs.length&&xs.every(x=>x.totalTc!==null)?xs.reduce((n,x)=>n+x.totalTc,0):null;
    const decorate=(value,forecasts)=>{const forecast=sum(forecasts);return {...value,forecast,forecastHours:forecast===null?null:forecast/FORECAST_TPLH,tcAchievement:ratio(value.tc,forecast)};};
    for(const day of v.days.values()){
      const forecasts=v.priorSource.forecast(day.date);details.push(...forecasts);
      day.metrics=decorate(day.metrics,forecasts);day.metrics.hoursAchievement=ratio(day.actualHours,day.metrics.forecastHours);
      for(const [area,base] of day.areas){const value=derived(base);if(day.baselineMissingAreas.has(area)){value.prior=null;value.sstg=null;value.sstgExFA=null;}day.areas.set(area,decorate(value,forecasts.filter(x=>x.area===area)));}
    }
    const included=details.filter(x=>!x.excluded);v.summary=decorate(v.summary,included);v.summary.hoursAchievement=v.hoursWithoutScores.length?null:ratio(v.summary.actualHours,v.summary.forecastHours);
    for(const [area,base] of v.areas)v.areas.set(area,decorate(base,included.filter(x=>x.area===area)));
    v.forecastDetails=details;v.forecastWarnings=[];
    const missing=included.filter(x=>x.totalTc===null);if(missing.length)v.forecastWarnings.push('去年對應日TC缺漏或衝突：'+missing.length+'組區域／日期無法預估');
    return v;
  }
  const api={AREAS,AC_ASSIGNMENTS,NON_DELIVERY_STORES,GROWTH,FORECAST_TPLH,number,ratio,clean,duration,addDays,range,dates,weeks,latestBatches,areaFor,build};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OpsMetrics=api;
})(typeof window!=='undefined'?window:globalThis);
