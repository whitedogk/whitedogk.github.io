import {roleForPosition} from './role-columns.js';
import {sumObservedStats} from './stat-display.js';

export const compareKey=p=>`${p.teamId}:${p.playerId}`;
export const compareTerm=t=>`${t.year}:${t.season}`;

export function availableTerms(tables,players){
  const keys=new Set(players.map(compareKey));
  return [...new Map(tables.filter(t=>t.competition==='league'&&t.participants.some(p=>keys.has(compareKey(p))))
    .map(t=>[compareTerm(t),{key:compareTerm(t),year:t.year,season:t.season}])).values()]
    .sort((a,b)=>b.year-a.year||(a.season==='autumn'?-1:1));
}

export function leagueComparison(tables,player,term='all'){
  const kind=roleForPosition(player.defensePosition);
  if(!kind)return {kind:null,stats:{},rows:[]};
  const seen=new Set(),rows=[];
  for(const t of tables){
    if(t.competition!=='league'||t.kind!==kind||(term!=='all'&&compareTerm(t)!==term))continue;
    const participant=t.participants.find(p=>compareKey(p)===compareKey(player));
    if(!participant||seen.has(t.cupId))continue;
    seen.add(t.cupId);
    rows.push({year:t.year,season:t.season,title:t.title,cupId:t.cupId,stats:participant.stats});
  }
  return {kind,stats:sumObservedStats(rows.map(r=>r.stats)),rows};
}
