export const positionLabels={Pitcher:'投手',Catcher:'捕手',InFielder:'内野手',OutFielder:'外野手'};
export const roleForPosition=position=>position==='Pitcher'?'pitching':positionLabels[position]?'batting':null;
export const columnsForPosition=position=>{
  const shared=[['games','試合']];
  if(roleForPosition(position)==='pitching')return [...shared,...[['wins','勝'],['losses','敗'],['outs','投球回'],['hits','被安打'],['hr','被本塁打'],['bb','与四球'],['hbp','与死球'],['so','奪三振'],['er','自責点'],['ERA','防御率'],['WHIP','WHIP'],['K/9','K/9'],['BB/9','BB/9'],['K/BB','K/BB'],['HR/9','HR/9']]];
  if(roleForPosition(position)==='batting')return [...shared,...[['pa','打席'],['ab','打数'],['hits','安打'],['doubles','二塁打'],['triples','三塁打'],['hr','本塁打'],['rbi','打点'],['so','三振'],['bb','四球'],['hbp','死球'],['sac','犠打'],['sf','犠飛'],['sb','盗塁'],['AVG','打率'],['OBP','出塁率'],['SLG','長打率'],['OPS','OPS'],['BB/K','BB/K'],['ISO','ISO'],['IsoD','IsoD']]];
  return [];
};
