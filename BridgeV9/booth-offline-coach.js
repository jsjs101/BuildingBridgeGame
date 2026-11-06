'use strict';

function answerBoothOffline(question,{stage,summary,geometry,analysis,test},level){
  const nameById=new Map(geometry.members.map(member=>[member[0],member[7]]));
  const lastFailure=test.failureEvents.at(-1);
  const worst=analysis.memberResults[0];
  const notes=[];
  if(/예산|비용|가격|돈/.test(question)&&Number.isFinite(stage.budget)&&Number.isFinite(stage.cost)){
    const remaining=stage.budget-stage.cost;
    notes.push(`기본 예산 대비 **${Math.abs(remaining).toLocaleString('ko-KR')}원 ${remaining<0?'초과':'남음'}**입니다. 힘이 집중된 부재를 확인하고, 보강할 위치를 정한 뒤 다시 시험하세요.`);
  }
  if(/케이블|인장|압축|강철/.test(question)){
    notes.push('케이블은 당기는 힘을 받고, 강철 기둥은 누르는 힘을 받을 수 있습니다. 하부 케이블 교량에서는 중앙 기둥 아래쪽을 양쪽 지지점과 케이블로 이으면 하중을 양쪽으로 전달할 수 있습니다.');
  }else if(/삼각|트러스/.test(question)){
    notes.push('삼각형은 세 변의 길이가 유지되면 모양이 잘 바뀌지 않습니다. 도로 관절과 지지점 사이에 대각 부재를 이어 하중이 전달될 길을 만들어 보세요.');
  }
  if(!summary.completeRoadPath){
    notes.push('**양쪽 지지점 사이에 이어진 도로가 없습니다.** 왼쪽에서부터 도로를 따라가며 연결이 끊긴 관절을 찾아 이어 보세요.');
  }
  if(lastFailure||summary.brokenMemberIds.length){
    const name=nameById.get(lastFailure?.id??summary.brokenMemberIds.at(-1))||'시험 중 파단된 부재';
    notes.push(`최근 시험에서 **${name}**에 파단 기록이 있습니다. 주변 부재에 하중을 나눌 수 있도록 연결을 보강하고 재시험하세요.`);
  }else if(worst&&Number.isFinite(worst[2])){
    const name=nameById.get(worst[0])||'가장 부담이 큰 부재';
    const percent=Math.round(worst[2]*100);
    const force=level==='technical'&&Number.isFinite(worst[1])?` 축력은 ${worst[1].toLocaleString('ko-KR')} N입니다.`:'';
    notes.push(`현재 해석에서 **${name}**의 이용률이 **${percent}%**로 가장 높습니다.${force} 차량을 다시 통과시켜 다른 하중 위치도 확인하세요.`);
  }else if(summary.completeRoadPath){
    notes.push('도로는 연결되어 있습니다. **차량 시험**을 실행하면 처짐이나 파단이 먼저 나타나는 부분을 확인할 수 있습니다.');
  }
  if(test.failureReason==='vessel-collision')notes.unshift('선박이 부재와 충돌했습니다. 항로 표시 안에 들어오는 도로와 부재의 높이를 확인하세요.');
  if(test.failureReason==='vehicle-collision')notes.unshift('차량이 부재에 걸렸습니다. 차량이 지나가는 도로 주변의 부재 배치를 확인하세요.');
  const limit=level==='easy'?2:4;
  return '**오프라인 구조 코치**\n\n'+notes.slice(0,limit).join('\n\n');
}
