import {positionLabels,roleForPosition,columnsForPosition} from './role-columns.js';
import {displayStats,formatInnings,sumObservedStats} from './stat-display.js';
import {rankingColumns,sortRankingRows} from './ranking-sort.js';
import {availableTerms,compareKey,leagueComparison} from './compare-model.js';
import {searchStaticCohort} from './static-search.js';
const $=s=>document.querySelector(s);
const staticMode=document.documentElement.dataset.staticSite==='true';
const data=await fetch(staticMode?'/public-data.json':'/api/data').then(r=>r.json());
const refresh=data.omyu.refresh;
const lastRefresh=refresh.lastSuccessfulRetrieval?new Date(refresh.lastSuccessfulRetrieval).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' JST':'なし';
$('#refresh-status').textContent=`最終取得 ${lastRefresh} · 更新は手動`;
$('#refresh-detail').textContent=`取得済み ${refresh.refreshedTables}/${refresh.potentialTables} 表。選手ページ ${data.omyu.profiles.profiles} 件から ${data.omyu.profiles.added} 行を補完。リーグ戦は保存済みの部分記録です。更新時はプロジェクトで npm run update:manual を実行してください。`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positions=positionLabels;
const role=p=>roleForPosition(p?.defensePosition);
const groups=[['Pitcher','投手'],['field','野手'],['review','守備位置要確認']];
const group=p=>p.defensePosition==='Pitcher'?'Pitcher':positions[p.defensePosition]?'field':'review';
const roster=data.roster2026.players;
const teamNames=new Map(roster.map(p=>[p.teamId,p.school]));
const filteredTables=teamId=>data.omyu.tables.flatMap(t=>t.participants.filter(p=>p.teamId===teamId).map(participant=>({...t,participant})));
let view={type:'home'},tab='league',sortKey='label',reverse=false,filters={name:'',school:''},request=0;
const viewTrail=[];
const setView=(next,{remember=true}={})=>{
  if(remember)viewTrail.push({view,tab,sortKey,reverse,filters:{...filters}});
  view=next;sortKey='label';reverse=false;render();
};
function viewHash(v){
  if(v.type==='cohort')return '#cohort';
  if(v.type==='compare')return '#compare';
  if(v.type==='teams')return '#omyu';
  if(v.type==='federation')return `#federation/${encodeURIComponent(v.id)}`;
  if(v.type==='university')return `#university/${encodeURIComponent(v.id)}`;
  if(v.type==='team')return `#team/${encodeURIComponent(v.id)}`;
  if(v.type==='player')return `#omyu-player/${encodeURIComponent(v.teamId)}/${encodeURIComponent(v.playerId)}`;
  if(v.type==='samurai')return `#samurai/${encodeURIComponent(v.event)}/${encodeURIComponent(v.id)}`;
  return '';
}
function goBack(){
  const previous=viewTrail.pop();
  if(previous)({view,tab,sortKey,reverse,filters}=previous);
  else {view={type:'home'};tab='league';sortKey='label';reverse=false;}
  window.history.replaceState(null,'',location.pathname+location.search+viewHash(view));
  render();
}
const link=p=>`<a href="#omyu-player/${encodeURIComponent(p.teamId)}/${encodeURIComponent(p.playerId)}">${esc(p.name)}</a>`;
function playerList(players){
  if(!players.length)return '<p class="muted">対象選手のデータは未収録です。</p>';
  return groups.map(([kind,label])=>{
    const rows=players.filter(p=>group(p)===kind);
    if(!rows.length)return '';
    return `<h3 class="position-group">${label}（${rows.length}名）</h3><div class="scroll"><table class="search-table"><thead><tr><th>選手</th><th>守備位置</th><th>大学</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${link(p)}</td><td>${esc(positions[p.defensePosition]||'要確認')}</td><td>${esc(p.school)}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
}
async function cohort(page=1){
  const current=++request;
  try{
    let result;
    if(staticMode)result=searchStaticCohort(roster,{name:filters.name,school:filters.school,page});
    else{
      const params=new URLSearchParams({cohort:'2026-fourth',q:filters.name,school:filters.school,page:String(page)});
      const response=await fetch('/api/players?'+params);
      if(!response.ok)throw Error('search');
      result=await response.json();
    }
    if(current===request)setView({type:'cohort',result});
  }catch{if(current===request)$('#summary').textContent='検索できませんでした。再度お試しください。';}
}
function table(title,status,rows,position){
  const kind=role({defensePosition:position});
  const caption=`<p class="hint">${esc(title)}${status?' · '+esc(status):''}</p>`;
  if(!kind)return caption+'<p class="muted">守備位置要確認のため、投打の成績区分は保留しています。</p>';
  const cols=columnsForPosition(position);
  const enriched=rows.map(r=>({...displayStats(kind,r.stats||{}),label:r.label,games:r.games??r.stats?.games,sourceUrl:r.sourceUrl}));
  const sorted=[...enriched].sort((a,b)=>{const x=a[sortKey],y=b[sortKey];return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'ja'))*(reverse?-1:1);});
  return caption+`${!rows.length?'<p class="muted">成績データなし</p>':`<div class="scroll"><table><thead><tr>${[['label','年・区分'],...cols].map(([k,n])=>`<th><button type="button" data-sort="${k}">${n}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(r=>`<tr>${[['label'],...cols].map(([k])=>`<td>${k==='label'&&r.sourceUrl?`<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}</a>`:esc(k==='outs'?formatInnings(r[k]):r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}`;
}
function itemRows(items){
  const byCup=new Map();
  for(const t of items){if(!byCup.has(t.cupId))byCup.set(t.cupId,{});byCup.get(t.cupId)[t.kind]=t;}
  return [...byCup.values()].map(pair=>{const t=pair.batting||pair.pitching,person=t.participant;
    return {label:`${t.year} ${t.competition==='national'?(t.event==='meiji'?'明治神宮（大学）':'全日本大学'):t.season==='spring'?'春':'秋'} · ${t.title}${t.coverage==='profile-aggregate'?'（個人ページ補完）':t.coverage==='secondary-qualified'?'（外部集計・掲載項目のみ）':''}`,stats:person.stats,games:person.games,sourceUrl:t.sourceUrl};});
}
function playerPanel(p){
  const items=filteredTables(p.teamId).filter(t=>t.participant.playerId===p.playerId);
  const evidence=(data.omyu.appearances||[]).filter(a=>a.teamId===p.teamId&&a.playerId===p.playerId&&a.kind===role(p));
  const appearanceNotes=evidence.map(a=>`<p class="muted">${esc(a.year)} ${a.season==='spring'?'春':'秋'}：${esc(a.status)}（${a.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.note)}</a>`).join('・')}）</p>`).join('');
  const tabs=[['league','年度・リーグ'],['tournament','全国大会'],['opponent','対戦相手別'],['national','大学日本代表'],['career','リーグ収録分']];
  $('#tabs').innerHTML=tabs.map(([key,name])=>`<button data-tab="${key}" class="${tab===key?'selected':''}">${name}</button>`).join('');
  document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{tab=el.dataset.tab;render();});
  const selected=items.filter(t=>t.competition===(tab==='tournament'?'national':'league')&&t.kind===role(p));
  let rows=itemRows(selected),title=tab==='tournament'?'全国大会':'年度・リーグ戦',status='収録分のみ';
  if(tab==='career'){
    const entries=selected.map(t=>t.participant.stats);
    rows=entries.length?[{label:'リーグ戦 · 収録分合計',stats:sumObservedStats(entries)}]:[];
    title='リーグ収録分合計';status='';
  }
  if(tab==='opponent'){
    const entry=data.omyuGamePilot.players.find(x=>x.teamId===p.teamId&&x.playerId===p.playerId);
    const splits=(entry?.splits||[]).filter(s=>s.kind===role(p));
    rows=splits.map(s=>({label:s.opponentName,stats:s.stats,games:s.games.length}));title='対戦相手別';status='検証済み試合のみ';
    $('#results').innerHTML=table(title,status,rows,p.defensePosition)+splits.map(s=>`<p>${esc(s.opponentName)}：${s.games.map(g=>`<a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${esc(g.date)}</a>`).join(' ・ ')}</p>`).join('');attachSort();return;
  }
  if(tab==='national'){
    const href=`#omyu-player/${encodeURIComponent(p.teamId)}/${encodeURIComponent(p.playerId)}`;
    const links=data.samurai.reviewed.filter(x=>x.href===href).flatMap(x=>x.samurai);
    rows=links.flatMap(l=>{const series=data.samurai.series.find(s=>(s.event||String(s.year))===(l.event||String(l.year)));
      const person=series?.[role(p)]?.find(x=>x.playerId===l.playerId);
      return person?[{label:`${l.year} ${series.label}`,stats:person.stats,games:person.games}]:[];});
    title='大学日本代表';status='確認済みリンクのみ／リーグ通算から除外';
    $('#results').innerHTML=table(title,status,rows,p.defensePosition)+links.map(l=>`<p><a href="${esc(l.href)}">${esc(l.year)} ${esc(l.label)} · 公式プロフィールと試合原本</a></p>`).join('');attachSort();return;
  }
  $('#results').innerHTML=(tab==='league'?appearanceNotes:'')+table(title,status,rows,p.defensePosition);attachSort();
}
function attachSort(){document.querySelectorAll('[data-sort]').forEach(el=>el.onclick=()=>{reverse=sortKey===el.dataset.sort?!reverse:false;sortKey=el.dataset.sort;render();});}
let rankingOptions=[],ranking=null,rankingBusy=false,rankingError='',rankingRequest=0;
let staticRankingOptions=null;
const rankingSort={batting:{key:'hits',direction:'desc'},pitching:{key:'so',direction:'desc'}};
async function fetchRanking(cupId){
  const current=++rankingRequest;rankingBusy=true;rankingError='';renderRanking();
  try{
    let result;
    if(staticMode){
      if(!staticRankingOptions){const response=await fetch('/ranking-options.json');if(!response.ok)throw Error('options');staticRankingOptions=await response.json();}
      const selectedId=cupId||staticRankingOptions[0]?.cupId;
      if(!staticRankingOptions.some(o=>o.cupId===selectedId))throw Error('cup');
      const response=await fetch(`/rankings/${encodeURIComponent(selectedId)}.json`);
      if(!response.ok)throw Error('ranking');
      result={options:staticRankingOptions,selected:await response.json()};
    }else{
      const response=await fetch('/api/rankings'+(cupId?'?cupId='+encodeURIComponent(cupId):''));
      if(!response.ok)throw Error('ranking');
      result=await response.json();
    }
    if(current!==rankingRequest)return;
    rankingOptions=result.options;ranking=result.selected;rankingBusy=false;renderRanking();
  }catch{if(current===rankingRequest){rankingBusy=false;rankingError='ランキングを読み込めませんでした。';renderRanking();}}
}
function rankingTable(label,rows,kind){
  const batting=kind==='batting';
  const all=rankingColumns(kind),state=rankingSort[kind];
  const primary=batting?['hits','ab','AVG','hr','rbi','OPS']:['so','outs','ERA','K/9','BB/9'];
  const visible=new Set([...primary,state.key]);
  const cols=all.filter(([key])=>visible.has(key));
  const sorted=sortRankingRows(rows,kind,state.key,state.direction);
  const selector=`<label class="ranking-metric">並べ替え指標<select data-rank-metric="${kind}">${all.map(([key,name])=>`<option value="${esc(key)}" ${key===state.key?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
  return `<div class="ranking-table"><div class="ranking-heading"><h4>${esc(label)}</h4>${selector}</div><p class="muted">${esc(all.find(([key])=>key===state.key)?.[1])} ${state.direction==='asc'?'昇順':'降順'} · ${sorted.length}人</p>${!sorted.length?'<p class="muted">保存済み成績なし</p>':`<div class="scroll"><table><thead><tr><th>順</th><th>選手</th><th>大学</th>${cols.map(([key,name])=>`<th><button type="button" data-rank-sort="${kind}:${esc(key)}" aria-label="${esc(name)}で並べ替え">${esc(name)}${key===state.key?(state.direction==='asc'?' ↑':' ↓'):''}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(p=>{const stats=displayStats(kind,p.stats);return `<tr><td>${p.rank??'—'}</td><td>${p.href?`<a href="${esc(p.href)}">${esc(p.name)}</a>`:esc(p.name)}</td><td>${esc(p.school)}</td>${cols.map(([key])=>`<td>${esc(key==='outs'?formatInnings(stats[key]):stats[key]??'—')}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div>`}</div>`;
}
function renderRanking(){
  const root=$('#league-rankings');if(!root)return;
  if(rankingBusy&&!ranking){root.innerHTML='<p class="muted">ランキングを読み込み中…</p>';return;}
  if(rankingError){root.innerHTML=`<p class="muted">${esc(rankingError)}</p><button id="ranking-retry" type="button">再試行</button>`;$('#ranking-retry').onclick=()=>fetchRanking(ranking?.option.cupId);return;}
  if(!ranking){root.innerHTML='<p class="muted">ランキングを読み込み中…</p>';return;}
  const selected=ranking.option;
  const leagues=[...new Map(rankingOptions.map(o=>[o.leagueId,o.leagueName]))];
  const byLeague=rankingOptions.filter(o=>o.leagueId===selected.leagueId);
  const years=[...new Set(byLeague.map(o=>o.year))];
  const byYear=byLeague.filter(o=>o.year===selected.year);
  const seasons=[...new Set(byYear.map(o=>o.season))];
  const bySeason=byYear.filter(o=>o.season===selected.season);
  const select=(name,values,current)=>`<label>${name}<select data-rank-select="${name}">${values.map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`;
  root.innerHTML=`<h3>リーグの投打ランキング</h3><div class="ranking-controls">${select('リーグ',leagues,selected.leagueId)}${select('年度',years.map(y=>[y,`${y}年`]),selected.year)}${select('季',seasons.map(s=>[s,s==='spring'?'春':'秋']),selected.season)}${select('区分・大会',bySeason.map(o=>[o.cupId,o.division?`${o.division} · ${o.title}`:o.title]),selected.cupId)}</div><p class="hint">${esc(selected.title)}</p><div class="ranking-grid">${rankingTable('打撃',ranking.batting,'batting')}${rankingTable('投手',ranking.pitching,'pitching')}</div>`;
  root.querySelectorAll('[data-rank-metric]').forEach(el=>el.onchange=()=>{const state=rankingSort[el.dataset.rankMetric];state.key=el.value;state.direction=['ERA','WHIP','BB/9','HR/9'].includes(el.value)?'asc':'desc';renderRanking();});
  root.querySelectorAll('[data-rank-sort]').forEach(el=>el.onclick=()=>{const [kind,key]=el.dataset.rankSort.split(':');const state=rankingSort[kind];state.direction=state.key===key?(state.direction==='asc'?'desc':'asc'):['ERA','WHIP','BB/9','HR/9'].includes(key)?'asc':'desc';state.key=key;renderRanking();});
  root.querySelectorAll('[data-rank-select]').forEach(el=>el.onchange=()=>{
    const value=el.value;let next;
    if(el.dataset.rankSelect==='リーグ')next=rankingOptions.find(o=>o.leagueId===value);
    else if(el.dataset.rankSelect==='年度')next=byLeague.find(o=>String(o.year)===value);
    else if(el.dataset.rankSelect==='季')next=byYear.find(o=>o.season===value);
    else next=rankingOptions.find(o=>o.cupId===value);
    if(next&&next.cupId!==selected.cupId)fetchRanking(next.cupId);
  });
}
const compareSelected=[];
let compareFilters={name:'',school:''},compareSeason='all';
const normalized=x=>String(x||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
function renderCompare(){
  const selected=compareSelected.map(key=>roster.find(p=>compareKey(p)===key)).filter(Boolean);
  const queryName=normalized(compareFilters.name),querySchool=normalized(compareFilters.school);
  const candidates=queryName||querySchool?roster.filter(p=>!compareSelected.includes(compareKey(p))&&(!queryName||normalized(p.name).includes(queryName))&&(!querySchool||normalized(p.school).includes(querySchool))):[];
  const schools=[...new Set(roster.map(p=>p.school))].sort((a,b)=>a.localeCompare(b,'ja'));
  const terms=availableTerms(data.omyu.tables,selected);
  if(compareSeason!=='all'&&!terms.some(t=>t.key===compareSeason))compareSeason='all';
  const termLabel=t=>`${t.year}年 ${t.season==='spring'?'春':'秋'}`;
  const chooser=`<form id="compare-search" class="compare-search"><label>氏名<input name="name" value="${esc(compareFilters.name)}" placeholder="氏名の一部"></label><label>大学<input name="school" value="${esc(compareFilters.school)}" list="compare-schools" placeholder="大学名の一部"></label><datalist id="compare-schools">${schools.map(name=>`<option value="${esc(name)}">`).join('')}</datalist><button type="submit">候補を探す</button></form>`;
  const chosen=`<div class="compare-selected">${selected.map(p=>`<span class="compare-chip">${esc(p.name)} · ${esc(p.school)} <button type="button" data-compare-remove="${esc(compareKey(p))}" aria-label="${esc(p.name)}を外す">×</button></span>`).join('')}</div>`;
  const candidateList=queryName||querySchool?`<h3>候補（${candidates.length}人）</h3><div class="compare-candidates">${candidates.slice(0,40).map(p=>`<button type="button" data-compare-add="${esc(compareKey(p))}" ${selected.length>=4?'disabled':''}>${esc(p.name)} · ${esc(p.school)} · ${esc(positions[p.defensePosition]||'守備位置要確認')}</button>`).join('')||'<p class="muted">該当する候補がありません。</p>'}</div>${candidates.length>40?'<p class="muted">先頭40人を表示。氏名や大学で絞り込んでください。</p>':''}`:'<p class="muted">氏名か大学名を入力して候補を探してください。</p>';
  let comparison='';
  if(selected.length>=2){
    const seasonSelect=`<label class="compare-season">比較する期間<select id="compare-season"><option value="all">リーグ収録分合計</option>${terms.map(t=>`<option value="${esc(t.key)}" ${t.key===compareSeason?'selected':''}>${esc(termLabel(t))}</option>`).join('')}</select></label>`;
    const sections=[['pitching','投手','Pitcher'],['batting','野手','InFielder']].map(([kind,label,position])=>{
      const members=selected.filter(p=>role(p)===kind);
      if(!members.length)return '';
      const records=members.map(p=>leagueComparison(data.omyu.tables,p,compareSeason));
      const cols=columnsForPosition(position);
      return `<section class="compare-section"><h3>${label}</h3><div class="scroll"><table><thead><tr><th>指標</th>${members.map(p=>`<th>${link(p)}<small>${esc(p.school)}</small></th>`).join('')}</tr></thead><tbody>${cols.map(([key,name])=>`<tr><th scope="row">${esc(name)}</th>${records.map(record=>{const stats=displayStats(kind,record.stats);return `<td>${esc(key==='outs'?formatInnings(stats[key]):stats[key]??'—')}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
    }).join('');
    const unresolved=selected.filter(p=>!role(p));
    comparison=seasonSelect+sections+(unresolved.length?`<p class="muted">守備位置要確認：${unresolved.map(p=>esc(p.name)).join('、')}</p>`:'');
  }else comparison='<p class="hint">比較する選手を2～4人選んでください。</p>';
  $('#results').innerHTML=chooser+chosen+candidateList+comparison;
  $('#compare-search').onsubmit=e=>{e.preventDefault();const form=new FormData(e.currentTarget);compareFilters={name:String(form.get('name')).trim(),school:String(form.get('school')).trim()};renderCompare();};
  document.querySelectorAll('[data-compare-add]').forEach(el=>el.onclick=()=>{if(compareSelected.length<4&&!compareSelected.includes(el.dataset.compareAdd))compareSelected.push(el.dataset.compareAdd);renderCompare();});
  document.querySelectorAll('[data-compare-remove]').forEach(el=>el.onclick=()=>{const i=compareSelected.indexOf(el.dataset.compareRemove);if(i>=0)compareSelected.splice(i,1);renderCompare();});
  const season=$('#compare-season');if(season)season.onchange=()=>{compareSeason=season.value;renderCompare();};
}
function render(){
  $('#back').disabled=viewTrail.length===0&&view.type==='home';
  $('#back').onclick=goBack;
  $('#federations').innerHTML=data.catalog.federations.map(f=>`<button data-f="${esc(f.id)}">${esc(f.name)}</button>`).join('');
  document.querySelectorAll('[data-f]').forEach(el=>el.onclick=()=>setView({type:'federation',id:el.dataset.f}));
  $('#tabs').innerHTML='';
  $('#crumb').innerHTML='<button id="root">トップ</button> / '+esc(view.type==='compare'?'選手比較':view.type==='cohort'?'4年生':view.type==='out'?'対象外':view.type==='player'?'選手':view.type==='team'?'大学':'4年生');
  $('#root').onclick=()=>{if(location.hash)window.location.hash='';else if(view.type!=='home')setView({type:'home'});};
  $('#title').textContent='4年生の選手';
  $('#summary').textContent='';
  if(view.type==='out'){$('#title').textContent='対象外';$('#results').innerHTML='<p>対象の4年生の記録ではありません。</p>';return;}
  if(view.type==='home'){$('#results').innerHTML=`<div class="home-links"><a class="feature-link" href="#cohort">4年生 ${data.roster2026.league.unionConfirmed}件を見る</a><a class="feature-link" href="#omyu">大学から探す</a><a class="feature-link" href="#compare">選手を比較する</a></div><p class="hint">1・2部と部区分のないリーグの対象選手。成績は取得済みの範囲です。</p><section id="league-rankings" aria-label="リーグの投打ランキング"></section>`;renderRanking();if(!ranking&&!rankingBusy&&!rankingError)fetchRanking();return;}
  if(view.type==='compare'){$('#title').textContent='選手比較';renderCompare();return;}
  if(view.type==='cohort'){
    const r=view.result;
    $('#summary').textContent=`${r.total}件 · ${r.from}～${r.to}件目 · ${r.page}/${r.pages}ページ`;
    const pager=`<nav class="pager"><button data-page="${r.page-1}" ${r.page===1?'disabled':''}>前へ</button><span>${r.page}/${r.pages} ページ</span><button data-page="${r.page+1}" ${r.page===r.pages?'disabled':''}>次へ</button></nav>`;
    $('#results').innerHTML=`<form id="cohort-filter" class="cohort-filter"><label>選手名<input name="name" value="${esc(filters.name)}"></label><label>大学<input name="school" value="${esc(filters.school)}"></label><button>絞り込む</button></form>${pager}${playerList(r.results)}${pager}`;
    $('#cohort-filter').onsubmit=e=>{e.preventDefault();const form=new FormData(e.currentTarget);filters={name:String(form.get('name')).trim(),school:String(form.get('school')).trim()};cohort();};
    document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>cohort(Number(el.dataset.page)));return;
  }
  if(view.type==='federation'){
    const f=data.catalog.federations.find(x=>x.id===view.id);$('#title').textContent=f.name;
    const universities=data.catalog.universities.filter(u=>u.federationId===f.id);
    $('#results').innerHTML='<div class="pick">'+universities.map(u=>`<button data-u="${esc(u.id)}">${esc(u.name)}</button>`).join('')+'</div>';
    document.querySelectorAll('[data-u]').forEach(el=>el.onclick=()=>setView({type:'university',id:el.dataset.u}));return;
  }
  if(view.type==='university'){
    const u=data.catalog.universities.find(x=>x.id===view.id);$('#title').textContent=u.name;
    const teams=new Set(data.omyu.mappings.filter(m=>m.universityId===u.id).map(m=>m.teamId));
    $('#results').innerHTML=playerList(roster.filter(p=>teams.has(p.teamId)||p.school===u.name));return;
  }
  if(view.type==='teams'){
    $('#title').textContent='大学から探す';
    $('#results').innerHTML='<div class="pick">'+[...teamNames].sort((a,b)=>a[1].localeCompare(b[1],'ja')).map(([id,name])=>`<button data-team="${esc(id)}">${esc(name)}</button>`).join('')+'</div>';
    document.querySelectorAll('[data-team]').forEach(el=>el.onclick=()=>setView({type:'team',id:el.dataset.team}));return;
  }
  if(view.type==='team'){$('#title').textContent=teamNames.get(view.id);$('#results').innerHTML=playerList(roster.filter(p=>p.teamId===view.id));return;}
  if(view.type==='player'){
    const p=roster.find(x=>x.teamId===view.teamId&&x.playerId===view.playerId);
    if(!p){setView({type:'out'});return;}
    $('#title').textContent=p.name;
    $('#summary').innerHTML=`${esc(p.school)} · ${esc(positions[p.defensePosition]||'守備位置要確認')} · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">名簿出典</a>${p.rosterConflict?` · ${esc(p.rosterConflict)}`:''}`;
    playerPanel(p);return;
  }
  if(view.type==='samurai'){
    const r=data.samurai.rosters.find(x=>(x.event||String(x.year))===view.event),p=r?.players.find(x=>x.id===view.id);
    if(!p){setView({type:'out'});return;}
    const match=roster.find(x=>data.samurai.reviewed.some(y=>y.samurai.some(z=>z.playerId===p.id&&(z.event||String(z.year))===view.event)&&y.href===`#omyu-player/${encodeURIComponent(x.teamId)}/${encodeURIComponent(x.playerId)}`));
    if(!match){setView({type:'out'});return;}
    $('#title').textContent=p.name;$('#summary').textContent=`${r.year} ${r.label} · 確認済み代表記録`;
    const s=data.samurai.series.find(x=>(x.event||String(x.year))===view.event),record=s?.[role(match)]?.find(x=>x.playerId===p.id);
    $('#results').innerHTML=table('大学日本代表','リーグ戦から除外',record?[{label:r.label,stats:record.stats,games:record.games}]:[],match.defensePosition)+`<p><a href="${esc(p.profileUrl)}" target="_blank" rel="noopener noreferrer">公式選手プロフィール</a></p>`+data.samurai.games.filter(g=>(g.event||String(g.year))===view.event&&g[role(match)]?.some(x=>x.playerId===p.id)).map(g=>`<p><a href="${esc(g.tableUrl)}" target="_blank" rel="noopener noreferrer">${esc(g.date)} ${esc(g.opponent)}戦</a></p>`).join('');attachSort();
  }
}
$('#player-search').onsubmit=e=>{e.preventDefault();filters={name:$('#search').value.trim(),school:''};if(filters.name)cohort();};
function openHash(initial=false){
  const [type,a,b]=location.hash.slice(1).split('/').map(decodeURIComponent);
  if(type==='cohort'){cohort();return;}
  if(type==='compare'){setView({type:'compare'},{remember:initial!==true});return;}
  const nav={remember:initial!==true};
  if(type==='omyu-player'&&a&&b){setView(roster.some(p=>p.teamId===a&&p.playerId===b)?{type:'player',teamId:a,playerId:b}:{type:'out'},nav);return;}
  if(type==='samurai'){setView({type:'samurai',event:a,id:b},nav);return;}
  if(type==='omyu'){setView({type:'teams'},nav);return;}
  if(type==='federation'&&a){setView({type:'federation',id:a},nav);return;}
  if(type==='university'&&a){setView({type:'university',id:a},nav);return;}
  if(type==='team'&&a){setView({type:'team',id:a},nav);return;}
  if(type==='big6'){setView({type:'out'},nav);return;}
  setView({type:'home'},nav);
}
window.addEventListener('hashchange',openHash);
openHash(true);
