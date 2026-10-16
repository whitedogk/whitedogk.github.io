import {columnsForPosition} from './role-columns.js';
export const rankingColumns=kind=>columnsForPosition(kind==='pitching'?'Pitcher':'InFielder');
const observed=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const ratio=(numerator,denominator)=>observed(numerator)&&observed(denominator)&&denominator>0?numerator/denominator:null;

export function rankingScore(kind,stats,key){
  const s=stats||{};
  if(kind==='pitching'){
    const derived={ERA:()=>ratio(s.er*27,s.outs),WHIP:()=>ratio((s.hits+s.bb)*3,s.outs),'K/9':()=>ratio(s.so*27,s.outs),'BB/9':()=>ratio(s.bb*27,s.outs),'K/BB':()=>ratio(s.so,s.bb),'HR/9':()=>ratio(s.hr*27,s.outs)};
    if(key in derived)return derived[key]();
  }else{
    const avg=()=>ratio(s.hits,s.ab),obp=()=>ratio(s.hits+s.bb+s.hbp,s.ab+s.bb+s.hbp+s.sf),slg=()=>ratio(s.tb,s.ab);
    const difference=(a,b)=>a===null||b===null?null:a-b;
    const derived={AVG:avg,OBP:obp,SLG:slg,OPS:()=>obp()===null||slg()===null?null:obp()+slg(),'BB/K':()=>ratio(s.bb,s.so),ISO:()=>difference(slg(),avg()),IsoD:()=>difference(obp(),avg())};
    if(key in derived)return derived[key]();
  }
  const value=s[key];
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))return Number(value);
  return null;
}

export function sortRankingRows(rows,kind,key=kind==='pitching'?'so':'hits',direction='desc'){
  if(!rankingColumns(kind).some(([column])=>column===key))throw Error('unsupported ranking metric');
  if(!['asc','desc'].includes(direction))throw Error('unsupported ranking direction');
  let previous=null,rank=0;
  return [...rows].map(p=>({...p,score:rankingScore(kind,p.stats,key)}))
    .sort((a,b)=>{
      if(a.score===null)return b.score===null?tie(a,b):1;
      if(b.score===null)return -1;
      return (a.score-b.score)*(direction==='asc'?1:-1)||tie(a,b);
    })
    .map((p,i)=>{
      if(p.score!==null&&p.score!==previous)rank=i+1;
      previous=p.score;
      const {score,...rest}=p;
      return {...rest,rank:score===null?null:rank};
    });
}

function tie(a,b){
  return String(a.name).localeCompare(String(b.name),'ja')||String(a.school).localeCompare(String(b.school),'ja')||String(a.teamId).localeCompare(String(b.teamId))||String(a.playerId).localeCompare(String(b.playerId));
}
