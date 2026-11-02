/* Shared presentation of representative CWA station observations. No KPI arithmetic. */
(function(root){
 'use strict';
 const cities=['台中','苗栗','南投','彰化'];
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const taipeiTime=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date):'時間未提供';};
 const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 function condition(row){
  if(!row)return '尚無天氣資料';
  if(row.status==='future')return '未來日期';if(row.status==='pending')return '當日尚未完整';if(row.status==='unavailable')return '來源暫時無法讀取';if(row.status==='missing')return '缺測';
  if(!['observed','partial'].includes(row.status))return '資料不足';
  if(row.trace)return '微量降雨';const rain=number(row.precipitation);return rain===null?'雨量資料不足':rain>0?'有降雨':'未測得降雨';
 }
 function values(row){
  if(!row||!['observed','partial'].includes(row.status))return '';
  const temp=number(row.temperature),rain=number(row.precipitation),out=[];
  if(temp!==null)out.push('日均溫 '+temp.toFixed(1)+' °C');if(row.trace)out.push('日雨量 微量');else if(rain!==null)out.push('日雨量 '+rain.toFixed(1)+' mm');
  if(row.status==='partial')out.push('部分資料');if(row.stale)out.push('來源更新失敗，保留舊觀測');return out.join(' ／ ');
 }
 function render({rows=[],start,end,period='day',errors=[],fetched=[]}){
  const find=(date,city)=>rows.find(x=>x.date===date&&x.city===city),station=row=>row?escape(row.station_name)+'站 '+escape(row.station_id):'測站資料未取得';let body;
  if(period==='day')body='<div class="ops-weather-grid">'+cities.map(city=>{const row=find(start,city);return '<article class="ops-weather-card"><h4>'+city+'｜'+escape(start)+'</h4><strong>'+condition(row)+'</strong><div>'+values(row)+'</div><small>'+station(row)+(row?.stale&&row.retained_from?'<br>保留來源時間 '+escape(taipeiTime(row.retained_from)):'')+'</small></article>';}).join('')+'</div>';
  else{const dates=[...new Set(rows.filter(x=>x.date>=start&&x.date<=end).map(x=>x.date))].sort();body='<div class="ops-weather-scroll"><table class="ops-weather-observations"><thead><tr><th>日期</th>'+cities.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+dates.map(date=>'<tr><th>'+escape(date)+'</th>'+cities.map(city=>{const row=find(date,city);return '<td>'+condition(row)+'<br>'+values(row)+'<br><small>'+station(row)+'</small></td>';}).join('')+'</tr>').join('')+'</tbody></table></div>';if(!dates.length)body='<div class="notice">尚無天氣觀測資料</div>';}
  const latest=fetched.filter(Boolean).sort().at(-1);
  return body+(errors.length?'<div class="notice">'+escape([...new Set(errors)].join('；'))+'</div>':'')+'<div class="ops-weather-source">縣市代表測站，非全縣市每間餐廳的實際天氣。日均溫／日雨量於當日結束後才列為完整觀測。<br><a href="https://codis.cwa.gov.tw/StationData" target="_blank" rel="noopener">中央氣象署 CODiS</a>'+(latest?'｜讀取時間 '+escape(taipeiTime(latest)):'')+'</div>';
 }
 const api={cities,condition,values,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OpsWeather=api;
})(typeof window!=='undefined'?window:globalThis);
