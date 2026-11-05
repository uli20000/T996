const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),M=require('../operations-metrics.js');
const html=fs.readFileSync('admin.html','utf8'),a=html.indexOf('function t995SampleAverage('),b=html.indexOf('function t996IsExcludedForecastStore(',a),ctx={t995DateAdd:M.addDays};vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);
const map=new Map([['A|2026-10-23',{totalTc:0,stores:new Set(['040'])}],['A|2026-10-16',{totalTc:100,stores:new Set(['040'])}],['A|2026-10-09',{totalTc:200,stores:new Set(['040'])}]]);
const sample=excluded=>ctx.t995SampleAverage(map,'A','2026-10-26',4,8,1,26,new Set(excluded));
assert.equal(sample([]).average,100);assert.equal(sample(['2026-10-23']).average,150);assert.equal(sample(['2026-10-23']).sampleWeeks,2);assert.equal(sample(['2026-10-23','2026-10-16','2026-10-09']).average,null);assert.equal(ctx.t995ForecastTcFromAverage(101.1),122);assert.equal(ctx.t995ForecastTcFromAverage(null),null);
console.log('PASS checked excluded days skipped, genuine unexcluded zero retained, fewer samples disclosed, no samples missing, forecast ceiling unchanged.');
