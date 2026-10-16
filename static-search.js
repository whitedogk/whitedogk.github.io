const normalize=value=>String(value??'').normalize('NFKC').replace(/[\s\u3000]+/gu,'').toLocaleLowerCase('ja');

export function searchStaticCohort(players,{name='',school='',page=1,pageSize=50}={}){
  const nameTerm=normalize(name),schoolTerm=normalize(school);
  const matches=players.filter(p=>normalize(p.name).includes(nameTerm)&&
    (normalize(p.school).includes(schoolTerm)||normalize(p.rosterTeamName).includes(schoolTerm)));
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));
  const current=Math.min(Math.max(1,page),pages),start=(current-1)*pageSize;
  return {total:matches.length,page:current,pages,pageSize,from:matches.length?start+1:0,to:Math.min(start+pageSize,matches.length),results:matches.slice(start,start+pageSize)};
}
