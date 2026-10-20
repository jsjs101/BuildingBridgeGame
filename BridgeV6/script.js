
(async () => {
'use strict';
let projectContent,projectSettings;
try{
  [projectContent,projectSettings]=await Promise.all(['campaign-content.json','project-settings.json'].map(async file=>{
    const response=await fetch(file,{cache:'no-store'}).catch(error=>{throw new Error(`${file}: 불러오지 못했습니다. HTTP 서버로 실행 중인지 확인하세요. (${error.message})`)});
    if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);
    try{return JSON.parse(await response.text())}catch(error){throw new Error(`${file}: JSON 문법 오류 · ${error.message}`)}
  }));
}catch(error){showProjectConfigError(error);return}
function showProjectConfigError(error){
  console.error('[TRUSS LAB] 프로젝트 JSON 설정 오류',error);
  const screen=document.createElement('div'),panel=document.createElement('section'),title=document.createElement('h1'),message=document.createElement('p'),retry=document.createElement('button');
  screen.className='gameFlowScreen';screen.id='projectConfigError';screen.setAttribute('role','alert');
  panel.className='flowShell projectConfigError';title.textContent='JSON 설정을 확인해 주세요';message.textContent=error.message;
  retry.className='flowBtn primary';retry.textContent='파일 수정 후 다시 불러오기';retry.onclick=()=>location.reload();
  panel.append(title,message,retry);screen.append(panel);document.body.replaceChildren(screen);
}
function configObject(value,path){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${path}: JSON 객체가 필요합니다.`);
  return value;
}
function configKeys(value,allowed,path){
  configObject(value,path);
  for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`${path}.${key}: 지원하지 않는 항목입니다.`);
}
function configNumber(value,min,max,path,integer=false){
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`${path}: ${min}~${max} 범위의 ${integer?'정수':'숫자'}가 필요합니다.`);
}
function applyProjectContent(){
  configKeys(projectContent,['version','_guide','sets','briefings'],'campaign-content.json');
  if(projectContent.version!==1)throw new Error('campaign-content.json.version: 1만 지원합니다.');
  for(const [group,source,fields] of [['sets',SET_DEFINITIONS,['title','description','environment']],['briefings',LEVEL_LIBRARY,['title','subtitle','concept','objective']]]){
    const entries=configObject(projectContent[group]===undefined?{}:projectContent[group],`campaign-content.json.${group}`);
    for(const [id,entry] of Object.entries(entries)){
      const target=source.find(record=>record.id===id);
      if(!target)throw new Error(`campaign-content.json.${group}.${id}: 존재하지 않는 ID입니다.`);
      configKeys(entry,fields,`campaign-content.json.${group}.${id}`);
      for(const [key,text] of Object.entries(entry)){
        if(typeof text!=='string'||!text.trim()||text.length>2000||/[<>]/.test(text))throw new Error(`campaign-content.json.${group}.${id}.${key}: 1~2000자의 일반 텍스트를 입력하세요. HTML 태그는 사용할 수 없습니다.`);
        target[key]=text.trim();
      }
    }
  }
}
function applyProjectSettings(){
  const path='project-settings.json';
  configKeys(projectSettings,['version','_guide','difficultyDefault','uiDefaults','developer'],path);
  if(projectSettings.version!==1)throw new Error(`${path}.version: 1만 지원합니다.`);
  if(projectSettings.difficultyDefault!==undefined&&!['easy','hard'].includes(projectSettings.difficultyDefault))throw new Error(`${path}.difficultyDefault: easy 또는 hard를 입력하세요.`);
  const preferences=configObject(projectSettings.uiDefaults===undefined?{}:projectSettings.uiDefaults,`${path}.uiDefaults`);
  const choices={mode:['basic','advanced'],scale:['90','100','110','120'],'inspector-mode':['basic','detail'],speed:[.5,1,1.5,2]};
  const booleans=['large-text','reduced-motion','high-contrast','colorblind-stress','sfx','grid','snap'];
  configKeys(preferences,[...Object.keys(choices),...booleans],`${path}.uiDefaults`);
  for(const [key,value] of Object.entries(preferences)){
    if(choices[key]? !choices[key].includes(value):typeof value!=='boolean')throw new Error(`${path}.uiDefaults.${key}: 자료형 또는 선택 가능한 값을 확인하세요.`);
  }
  const settings=configObject(projectSettings.developer===undefined?{}:projectSettings.developer,`${path}.developer`);
  configKeys(settings,['enabled','physics','vehicleSpeeds','materialOverrides','levelOverrides','sandbox'],`${path}.developer`);
  for(const group of ['physics','vehicleSpeeds','materialOverrides','levelOverrides','sandbox'])if(settings[group]!==undefined)configObject(settings[group],`${path}.developer.${group}`);
  if(settings.enabled!==undefined&&typeof settings.enabled!=='boolean')throw new Error(`${path}.developer.enabled: true 또는 false를 입력하세요.`);
  const groups=[
    ['physics',settings.physics||{},DEV_PHYSICS_TUNING,DEV_PHYSICS_LIMITS,['substeps','constraintIterations','cableSegmentLength']],
    ['vehicleSpeeds',settings.vehicleSpeeds||{},DEV_VEHICLE_PROFILES,null,[]]
  ];
  for(const [group,entries,known,limits,integers] of groups){
    configKeys(entries,Object.keys(known),`${path}.developer.${group}`);
    for(const [key,value] of Object.entries(entries)){
      const [min,max]=limits?limits[key]:[20,160];configNumber(value,min,max,`${path}.developer.${group}.${key}`,integers.includes(key));
      if(settings.enabled){if(group==='physics')known[key]=value;else known[key].speed=value}
    }
  }
  const overrides=[
    ['materialOverrides',settings.materialOverrides||{},id=>MAT[id],{cost:[0,1000],maxLen:[1,10000],tension:[1,1e9],compression:[1,1e9]}],
    ['levelOverrides',settings.levelOverrides||{},id=>getGameLevel(id),{budget:[100,1e7],load:[1,1e6],serviceDeflection:[1,1000],wind:[-100000,100000],maxMemberCount:[1,500],maxCableCount:[0,500]}]
  ];
  for(const [group,entries,find,limits] of overrides){
    configObject(entries,`${path}.developer.${group}`);
    for(const [id,entry] of Object.entries(entries)){
      const target=find(id);
      if(!target||(group==='materialOverrides'&&!Object.prototype.hasOwnProperty.call(MAT,id)))throw new Error(`${path}.developer.${group}.${id}: 존재하지 않는 ID입니다.`);
      configKeys(entry,Object.keys(limits),`${path}.developer.${group}.${id}`);
      for(const [key,value] of Object.entries(entry)){configNumber(value,...limits[key],`${path}.developer.${group}.${id}.${key}`,['maxMemberCount','maxCableCount'].includes(key));if(settings.enabled)target[key]=value}
    }
  }
  const sandbox=settings.sandbox||{},limits={load:[6000,100000],wind:[-50000,50000],vehicleSpeed:[20,160]};
  configKeys(sandbox,[...Object.keys(limits),'memberFailure'],`${path}.developer.sandbox`);
  for(const [key,value] of Object.entries(sandbox)){
    if(key==='memberFailure'){if(typeof value!=='boolean')throw new Error(`${path}.developer.sandbox.memberFailure: true 또는 false를 입력하세요.`)}
    else configNumber(value,...limits[key],`${path}.developer.sandbox.${key}`);
    if(settings.enabled)stages[4][key]=value;
  }
}
const {renderEducationModule}=await createTrussEducation({clamp,runLoadingSequence,onBack:leaveEducationToLab,onComplete:completeEducationCourse,getContext:()=>pendingEducationContext});
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ui = {
  stageName:$('#stageName'), stageTimerText:$('#stageTimerText'), stageClockMetric:$('#stageClockMetric'), loadText:$('#loadText'), budgetText:$('#budgetText'), 
  coach:$('#coachBody'),
  toast:$('#toast'), test:$('#testBtn'), result:$('#resultModal'), resultCard:$('#resultCard'), intro:$('#introModal'), library:$('#libraryModal'), sandbox:$('#sandboxModal'), modeBadge:$('#modeBadge'), inspector:$('#hoverInspector'), budgetRail:$('#budgetRail'), budgetRailFill:$('#budgetRailFill')
};

const MAT = {
  // E, I, K are game-calibrated relative values used by the Euler buckling model.
  // They are intentionally not real-world units; the products E·I are tuned to
  // preserve roughly the previous stage balance while making Pcr ∝ 1/L² explicit.
  // beamScale is a separate gameplay calibration used only by the simplified
  // translational road-bending approximation below; reinforced road still has
  // a much larger effective E·I even with its own tuned scale.
  wood:{name:'목재', color:'#d9a15b', EA:650000, E:650, I:184742, K:1.0, tension:26000, compression:23000, cost:2.7, maxLen:270},
  steel:{name:'강철', color:'#cbd1da', EA:900000, E:900, I:232305, K:1.0, tension:36000, compression:31000, cost:5.0, maxLen:350},
  cable:{name:'케이블', color:'#f1d874', EA:520000, E:520, I:6331, K:1.0, tension:43000, compression:900, cost:3.7, maxLen:Infinity},
  road:{name:'일반 도로', color:'#66524a', EA:1080000, E:1080, I:302613, K:1.0, beamScale:3.4, tension:56000, compression:56000, cost:2.2, maxLen:180, roadWidth:16},
  roadHeavy:{name:'강화 도로', color:'#53606a', EA:1700000, E:1700, I:461143, K:1.0, beamScale:2.8, tension:92000, compression:92000, cost:4.4, maxLen:220, roadWidth:22}
};

function eulerBucklingLimit(matKey,L,KOverride=null){
  const mat=MAT[matKey];
  if(!mat||!Number.isFinite(L)||L<=0)return Infinity;
  const E=mat.E??1,I=mat.I??1,K=KOverride??mat.K??1;
  return Math.PI*Math.PI*E*I/Math.pow(Math.max(.001,K*L),2);
}
function compressionCapacity(matKey,L,KOverride=null){
  const mat=MAT[matKey];
  if(!mat)return {capacity:0,euler:0,material:0,governing:'material'};
  const euler=eulerBucklingLimit(matKey,L,KOverride);
  const material=mat.compression;
  const capacity=Math.min(material,euler);
  return {capacity,euler,material,governing:euler<material?'buckling':'material'};
}
function slendernessWarning(matKey,L){
  const info=compressionCapacity(matKey,L);
  const ratio=info.material>0?info.euler/info.material:1;
  if(ratio<.55)return {level:'HIGH',className:'danger',text:'높음 · 오일러 좌굴이 지배'};
  if(ratio<.85)return {level:'MODERATE',className:'warn',text:'보통 · 길이에 민감'};
  return {level:'LOW',className:'ok',text:'낮음 · 재료 허용력이 지배'};
}

const stages = [
  {name:'STAGE 01', type:'TRUSS', title:'트러스교 · 삼각형의 힘', goal:'기본 도로도 제공되지 않습니다. 일반 도로 또는 강화 도로로 먼저 차가 달릴 길을 만들고, 그 아래·위에 삼각형 트러스를 연결하세요.', tutorial:'① 도로 도구로 왼쪽 지지점부터 오른쪽 지지점까지 도로를 직접 연결하세요. ② 목재·강철로 자유 관절과 대각재를 추가해 삼각형을 만드세요. ③ 시험에서 도로 처짐과 부재의 인장·압축을 관찰하세요.', budget:9000, load:13000, maxDefl:48,
   deck:[[170,390],[310,390],[450,390],[590,390],[730,390],[870,390],[1010,390]], forbidden:[], vehicle:'CAR', bg:'valley'},
  {name:'STAGE 02', type:'TRUSS', title:'트러스교 · 하중 분산', goal:'도로를 직접 놓은 뒤 더 무거운 버스를 위해 연속 삼각형을 구성하세요. 중앙부는 필요하면 강화 도로로 보강할 수 있습니다.', tutorial:'① 버스는 1단계보다 무겁습니다. ② 긴 압축재 하나에 의존하지 말고 여러 개의 짧은 삼각형으로 힘을 나누세요. ③ 위험한 압축재는 길이를 줄이거나 강철로 바꿔 비교해 보세요.', budget:12000, load:23000, maxDefl:52,
   deck:[[150,340],[290,365],[430,390],[570,415],[710,440],[850,465],[990,490]], forbidden:[], vehicle:'BUS', bg:'slope'},
  {name:'STAGE 03', type:'TRUSS', title:'트러스교 · 항로 확보', goal:'항로 통과 여유 영역 전체를 비워 둔 채 도로와 구조재를 건설하고, 대형 화물차와 통항 선박을 모두 안전하게 통과시키세요.', tutorial:'① 황색 해치 영역은 선박 한 척의 실루엣이 아니라 항로에 필요한 전체 통항 여유 공간입니다. 어떤 관절이나 부재도 이 영역 안에 들어갈 수 없습니다. ② 도로와 트러스는 통과 여유 영역 위쪽으로 지나가게 하세요. ③ 시험 중에는 변형된 교량과 선박의 이동 전체 범위를 계속 검사하며, 충돌하면 즉시 실패합니다.', budget:15000, load:32000, maxDefl:58,
   deck:[[145,405],[280,380],[415,350],[550,315],[685,280],[820,305],[955,335],[1085,365]], forbidden:[{x:460,y:370,w:280,h:240,kind:'navigation'}], navigationClearance:{centerX:600,minWidth:280,minHeight:240,waterY:610,sweepTop:370,sweepBottom:610}, vehicle:'TRUCK', ship:{y:530,length:230,height:90,label:''}, bg:'obstacle'},
  {name:'STAGE 04', type:'CABLE', title:'케이블교 · 인장의 힘', goal:'긴 도로를 직접 연결한 뒤 강철 주탑과 케이블을 조합해 바닥판을 지지하세요. 케이블은 인장에만 효과적입니다.', tutorial:'① 강철로 주탑처럼 압축을 받는 골격을 세워보세요. ② 케이블은 길이 제한이 없고 인장에 강하므로 도로의 여러 지점을 주탑 쪽으로 연결하세요. ③ 케이블이 압축 상태가 되면 거의 역할을 못 한다는 점을 확인하세요.', budget:18000, load:28000, maxDefl:62,
   deck:[[130,390],[285,390],[440,390],[595,390],[750,390],[905,390],[1060,390]], forbidden:[], vehicle:'BUS', bg:'wide'},
  {name:'SANDBOX', type:'LAB', title:'자유 구조 실험실', goal:'예산 제한 없이 하중과 구조를 바꾸며 인장·압축·변형을 비교하세요.', tutorial:'하중 슬라이더와 예시 구조를 이용해 같은 형태에서 재료·높이·삼각형 수를 바꾸고 결과를 비교하세요. 부재 파단을 켜면 과부하 파단과 대체 하중 경로를, 끄면 순수한 하중 분포와 이용률을 관찰할 수 있습니다.', budget:999999, load:18000, maxDefl:95, sandbox:true, memberFailure:false,
   deck:[[130,390],[285,390],[440,390],[595,390],[750,390],[905,390],[1060,390]], forbidden:[], vehicle:'CAR', vehicleSkin:'#53aee6', bg:'wide'}
];

const TUTORIAL_STAGE = {
  name:'TUTORIAL', type:'TRAINING', title:'단계별 설계 훈련',
  goal:'화면 조작부터 도로·트러스 건설, 관절 이동, TEST까지 직접 수행하며 조작을 익히는 전용 훈련 스테이지입니다.',
  tutorial:'정답 행동을 직접 수행하면 다음 지시가 자동으로 열립니다.',
  budget:99999, load:8000, maxDefl:90, collapseDeflLimit:198,
  deck:[[280,390],[440,390],[600,390],[760,390],[920,390]], forbidden:[], vehicle:'CAR', bg:'valley', tutorialStage:true
};



const GAME_SCREEN = Object.freeze({
  BOOT:'boot', TITLE:'title', WELCOME:'welcome', CREDIT:'credit', MAIN_MENU:'main-menu', SET_SELECT:'set-select',
  LEVEL_SELECT:'level-select', BRIEFING:'briefing', GAME:'game', RESULT:'result', EDUCATION:'education',
  SANDBOX_SETUP:'sandbox-setup', SETTINGS:'settings', RECORDS:'records', TRAINING_COMPLETE:'training-complete', PROGRAM_COMPLETE:'program-complete',
  DEV_AUTH:'dev-auth', DEV_CONSOLE:'dev-console', DEV_PREVIEW:'dev-preview'
});

// Campaign metadata intentionally references the existing stage objects instead of duplicating solver geometry.
// Adding another level only requires another data entry with a stageIndex (or a future stage data object).
const CAMPAIGNS = [{"id":"campaign_01","number":1,"title":"기초 구조","sets":["set01","set02"]},{"id":"campaign_02","number":2,"title":"실전 횡단","sets":["set03","set04"]},{"id":"campaign_03","number":3,"title":"고급 구조공학","sets":["set05","set06"]}];
const SET_DEFINITIONS = [{"id":"set01","number":1,"campaignId":"campaign_01","title":"트러스 기초","description":"기본 교량 건설, 삼각형 안정성, 인장·압축, 구조 깊이와 효율을 익힙니다.","environment":"훈련 계곡"},{"id":"set02","number":2,"campaignId":"campaign_01","title":"하중 경로","description":"이동 하중, 지점반력, 오일러 좌굴, 재료 선택과 대체 하중 경로를 분석합니다.","environment":"구조 시험장"},{"id":"set03","number":3,"campaignId":"campaign_02","title":"지형과 통과 여유","description":"강, 비대칭 지형, 높이 제한, 통항 구역과 선박 통과 여유를 다룹니다.","environment":"하천 구역"},{"id":"set04","number":4,"campaignId":"campaign_02","title":"중량 운송","description":"버스·대형 화물차·강화 도로와 다중 차축 하중에서 바닥판 성능을 비교합니다.","environment":"산업 화물 구역"},{"id":"set05","number":5,"campaignId":"campaign_03","title":"케이블 구조","description":"긴 경간에서 케이블 인장, 주탑 압축, 케이블 배치와 효율을 실험합니다.","environment":"해안 장경간 구역"},{"id":"set06","number":6,"campaignId":"campaign_03","title":"구조 설계 종합","description":"횡풍, 구조적 여유도, 제한 지형, 복합 하중을 결합하는 최종 구조 설계 과정입니다.","environment":"고급 구조 시험장"}];
const LEVEL_LIBRARY = [{"id":"set01_level01","type":"main","campaignId":"campaign_01","setId":"set01","levelNumber":1,"globalNumber":1,"title":"첫 연결","subtitle":"짧은 계곡 // 첫 번째 계약","concept":"기본 건설","site":{"kind":"flat","leftX":220,"rightX":980,"leftY":400,"rightY":400,"segments":5,"curve":0},"vehicle":"CAR","load":8000,"budget":9000,"serviceDeflection":72,"materials":["road","wood"],"conditionCodes":["ROAD_REQUIRED"],"objective":"두 지지점을 직접 만든 도로로 연결하고 승용차를 안전하게 통과시키세요.","secondaryObjectives":["UNDER BUDGET","ZERO FAILURE"],"unlockRequirement":"tutorial-complete","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"coachHint":"먼저 연속적인 도로 경로를 만들고, 필요하면 목재로 하중 경로를 추가하세요.","constraints":["연속 도로 경로 필요"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set01_level02","type":"main","campaignId":"campaign_01","setId":"set01","levelNumber":2,"globalNumber":2,"title":"삼각형","subtitle":"도로만 놓은 바닥판에서 처짐이 시작됩니다","concept":"삼각형 안정성","site":{"legacyStage":0},"vehicle":"CAR","load":11500,"budget":9200,"serviceDeflection":50,"materials":["road","wood"],"conditionCodes":["TRUSS_SUPPORT"],"objective":"도로만으로 발생하는 처짐을 삼각형 구조의 축력 작용으로 줄이세요.","secondaryObjectives":["SERVICEABILITY PASS","ZERO FAILURE"],"unlockRequirement":"set01_level01","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"constraints":["도로 휨을 구조 부재로 지지"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","SERVICEABILITY PASS"]},{"id":"set01_level03","type":"main","campaignId":"campaign_01","setId":"set01","levelNumber":3,"globalNumber":3,"title":"인장 / 압축","subtitle":"응력 보기 기능을 익힙니다","concept":"인장과 압축","site":{"kind":"flat","leftX":170,"rightX":1030,"leftY":390,"rightY":390,"segments":6,"curve":6},"vehicle":"CAR","load":13500,"budget":9700,"serviceDeflection":48,"materials":["road","wood"],"conditionCodes":["STRESS_VIEW"],"objective":"인장과 압축 부재를 구분하고 중앙 하중을 지지하는 트러스를 설계하세요.","secondaryObjectives":["PEAK UTILIZATION < 85%","UNDER BUDGET"],"unlockRequirement":"set01_level02","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"constraints":["응력 / 이용률 분석 권장"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","PEAK UTILIZATION < 85%"]},{"id":"set01_level04","type":"main","campaignId":"campaign_01","setId":"set01","levelNumber":4,"globalNumber":4,"title":"넓은 간격","subtitle":"더 긴 목재 경간","concept":"트러스 높이와 강성","site":{"kind":"crown","leftX":130,"rightX":1070,"leftY":405,"rightY":405,"segments":7,"curve":-10},"vehicle":"CAR","load":14500,"budget":10800,"serviceDeflection":50,"materials":["road","wood"],"conditionCodes":["LONG_SPAN"],"objective":"낮은 트러스의 큰 처짐을 관찰하고 충분한 구조 깊이를 확보하세요.","secondaryObjectives":["DECK DEFLECTION LOW","ZERO FAILURE"],"unlockRequirement":"set01_level03","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"constraints":["긴 경간"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","DECK DEFLECTION LOW"]},{"id":"set01_level05","type":"main","campaignId":"campaign_01","setId":"set01","levelNumber":5,"globalNumber":5,"title":"적을수록 효율적","subtitle":"빠듯한 재료 예산에서 효율을 높이세요","concept":"구조 효율","site":{"kind":"flat","leftX":150,"rightX":1050,"leftY":385,"rightY":385,"segments":6,"curve":0},"vehicle":"CAR","load":14000,"budget":7800,"serviceDeflection":52,"materials":["road","wood"],"conditionCodes":["MAX_MEMBER_COUNT"],"objective":"필요 이상의 가새를 줄이면서 차량 통과와 사용성 기준을 함께 만족하세요.","secondaryObjectives":["UNDER BUDGET","MEMBERS ≤ 18"],"unlockRequirement":"set01_level04","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"maxMemberCount":18,"constraints":["부재 수 제한"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set01_level06","type":"main","campaignId":"campaign_01","setId":"set01","levelNumber":6,"globalNumber":6,"title":"최종 // 첫 번째 엔지니어","subtitle":"세트 01 종합","concept":"기초 개념 종합","site":{"kind":"sag","leftX":135,"rightX":1065,"leftY":395,"rightY":395,"segments":7,"curve":18},"vehicle":"BUS","load":17500,"budget":11200,"serviceDeflection":48,"materials":["road","wood","steel"],"conditionCodes":["SET_FINAL"],"objective":"중간 경간에서 강도·처짐·예산을 동시에 만족하는 기본 트러스를 완성하세요.","secondaryObjectives":["ZERO FAILURE","PEAK UTILIZATION < 90%"],"unlockRequirement":"set01_level05","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["세트 종합 계약"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set01_bonus01","type":"bonus","campaignId":"campaign_01","setId":"set01","levelNumber":1,"bonusNumber":1,"title":"목재만 사용","subtitle":"재료 제한이 있는 장경간","concept":"재료 제한","site":{"kind":"flat","leftX":120,"rightX":1080,"leftY":405,"rightY":405,"segments":7,"curve":0},"vehicle":"CAR","load":15000,"budget":8800,"serviceDeflection":52,"materials":["road","wood"],"conditionCodes":["WOOD_ONLY"],"objective":"목재와 일반 도로만으로 긴 경간을 효율적으로 지지하세요.","secondaryObjectives":["TARGET COST ≤ 8,000","UTILIZATION < 90%"],"unlockRequirement":"set01_level03","badge":"TIMBER SPECIALIST","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"constraints":["목재 + 일반 도로만 사용"],"thumbnail":{"type":"truss-flat"}},{"id":"set01_bonus02","type":"bonus","campaignId":"campaign_01","setId":"set01","levelNumber":2,"bonusNumber":2,"title":"상부 트러스 금지","subtitle":"높이 제한 실험","concept":"형상 제약","site":{"kind":"flat","leftX":165,"rightX":1035,"leftY":405,"rightY":405,"segments":6,"curve":0,"heightLimitY":320},"vehicle":"CAR","load":15000,"budget":9300,"serviceDeflection":54,"materials":["road","wood"],"conditionCodes":["MAX_HEIGHT"],"objective":"높은 상부 트러스를 사용할 수 없는 조건에서 대체 하중 경로를 찾아보세요.","secondaryObjectives":["ZERO FAILURE","UNDER BUDGET"],"unlockRequirement":"set01_level06","badge":"LOW-PROFILE DESIGNER","stageIndex":0,"weather":"clear","wind":0,"axles":[[-18,0.5],[18,0.5]],"constraints":["상부 높이 제한"],"thumbnail":{"type":"truss-flat"}},{"id":"set02_level01","type":"main","campaignId":"campaign_01","setId":"set02","levelNumber":1,"globalNumber":7,"title":"이동 하중","subtitle":"차량이 이동하면 부재력이 달라집니다","concept":"이동 하중","site":{"kind":"slope","leftX":150,"rightX":1050,"leftY":360,"rightY":430,"segments":7,"curve":0},"vehicle":"BUS","load":19000,"budget":12200,"serviceDeflection":54,"materials":["road","wood","steel"],"conditionCodes":["MOVING_LOAD"],"objective":"차량 위치에 따라 부재력이 달라지는 구조를 관찰하며 연속적인 하중 경로를 설계하세요.","secondaryObjectives":["ZERO FAILURE","PEAK UTILIZATION < 90%"],"unlockRequirement":"set01_level06","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["이동하중"],"thumbnail":{"type":"truss-slope"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set02_level02","type":"main","campaignId":"campaign_01","setId":"set02","levelNumber":2,"globalNumber":8,"title":"중앙 하중","subtitle":"중앙부 집중 하중","concept":"하중 분산","site":{"legacyStage":1},"vehicle":"BUS","load":22500,"budget":12600,"serviceDeflection":50,"materials":["road","wood","steel"],"conditionCodes":["CENTER_LOAD"],"objective":"중앙부에 집중되는 하중을 여러 부재와 지지점으로 분산시키세요.","secondaryObjectives":["DECK DEFLECTION LOW","UNDER BUDGET"],"unlockRequirement":"set02_level01","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["중앙 집중하중"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","DECK DEFLECTION LOW"]},{"id":"set02_level03","type":"main","campaignId":"campaign_01","setId":"set02","levelNumber":3,"globalNumber":9,"title":"긴 압축재","subtitle":"오일러 좌굴이 핵심이 됩니다","concept":"좌굴","site":{"kind":"flat","leftX":145,"rightX":1055,"leftY":390,"rightY":390,"segments":6,"curve":0},"vehicle":"BUS","load":23500,"budget":13200,"serviceDeflection":52,"materials":["road","wood","steel"],"conditionCodes":["BUCKLING"],"objective":"긴 압축재의 Euler 좌굴 한계를 고려해 구조를 설계하세요.","secondaryObjectives":["NO BUCKLING FAILURE","UTILIZATION < 90%"],"unlockRequirement":"set02_level02","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["오일러 좌굴 고려"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","NO BUCKLING FAILURE"]},{"id":"set02_level04","type":"main","campaignId":"campaign_01","setId":"set02","levelNumber":4,"globalNumber":10,"title":"강철 도입","subtitle":"강성·비용·허용력을 비교하세요","concept":"재료 선택의 절충","site":{"kind":"crown","leftX":135,"rightX":1065,"leftY":400,"rightY":400,"segments":7,"curve":-14},"vehicle":"BUS","load":25500,"budget":14500,"serviceDeflection":50,"materials":["road","wood","steel"],"conditionCodes":["STEEL_INTRO"],"objective":"목재와 강철의 비용·강성·허용력 차이를 비교해 적절히 배치하세요.","secondaryObjectives":["UNDER BUDGET","ZERO FAILURE"],"unlockRequirement":"set02_level03","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["강철 정식 사용"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set02_level05","type":"main","campaignId":"campaign_01","setId":"set02","levelNumber":5,"globalNumber":11,"title":"편심 하중","subtitle":"비대칭 이동 하중과 지점반력","concept":"지점반력","site":{"kind":"asym","leftX":160,"rightX":1040,"leftY":420,"rightY":350,"segments":7,"curve":22},"vehicle":"BUS","load":24500,"budget":14200,"serviceDeflection":54,"materials":["road","wood","steel"],"conditionCodes":["REACTIONS"],"objective":"비대칭 지형과 하중에서 좌우 지점반력이 어떻게 달라지는지 확인하세요.","secondaryObjectives":["REACTION BALANCE OBSERVED","SERVICEABILITY PASS"],"unlockRequirement":"set02_level04","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["지점반력 분석"],"thumbnail":{"type":"truss-slope"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","REACTION BALANCE OBSERVED"]},{"id":"set02_level06","type":"main","campaignId":"campaign_01","setId":"set02","levelNumber":6,"globalNumber":12,"title":"최종 // 하중 설계자","subtitle":"장경간 하중 경로 종합","concept":"하중 경로 종합","site":{"kind":"sag","leftX":125,"rightX":1075,"leftY":390,"rightY":390,"segments":8,"curve":24},"vehicle":"TRUCK","load":31000,"budget":15800,"serviceDeflection":48,"materials":["road","wood","steel"],"conditionCodes":["SET_FINAL","MOVING_LOAD","BUCKLING"],"objective":"긴 경간에서 이동하중, 좌굴, 처짐과 비용을 함께 관리하세요.","secondaryObjectives":["ZERO FAILURE","PEAK UTILIZATION < 88%"],"unlockRequirement":"set02_level05","stageIndex":1,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["세트 종합 계약","이동하중","오일러 좌굴 고려"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set02_bonus01","type":"bonus","campaignId":"campaign_01","setId":"set02","levelNumber":1,"bonusNumber":3,"title":"중앙 집중","subtitle":"극단적인 중앙 집중 하중","concept":"하중 집중","site":{"kind":"flat","leftX":180,"rightX":1020,"leftY":390,"rightY":390,"segments":6,"curve":0},"vehicle":"TRUCK","load":38000,"budget":15800,"serviceDeflection":48,"materials":["road","wood","steel"],"conditionCodes":["CENTER_LOAD","HIGH_LOAD"],"objective":"매우 큰 중앙 하중을 효율적인 load path로 양 지지점에 전달하세요.","secondaryObjectives":["NO MEMBER > 80% UTILIZATION","UNDER BUDGET"],"unlockRequirement":"set02_level03","badge":"LOAD PATH ANALYST","stageIndex":1,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["중앙 집중하중","고하중"],"thumbnail":{"type":"truss-flat"}},{"id":"set02_bonus02","type":"bonus","campaignId":"campaign_01","setId":"set02","levelNumber":2,"bonusNumber":4,"title":"하나의 약한 고리","subtitle":"시험 중 주요 부재 하나가 제거됩니다","concept":"구조적 여유도","site":{"kind":"flat","leftX":140,"rightX":1060,"leftY":395,"rightY":395,"segments":7,"curve":0},"vehicle":"BUS","load":24500,"budget":15500,"serviceDeflection":54,"materials":["road","wood","steel"],"conditionCodes":["MEMBER_FAILURE","REDUNDANCY"],"objective":"시험 중 주요 부재 하나가 제거되어도 차량 경로와 구조 안정성을 유지하세요.","secondaryObjectives":["ALTERNATE LOAD PATH","ZERO SECONDARY FRACTURE"],"unlockRequirement":"set02_level06","badge":"REDUNDANCY TESTED","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"forcedFailure":{"progress":0.52,"candidates":5},"constraints":["시험 중 실제 부재 제거","대체 하중 경로 평가"],"thumbnail":{"type":"truss-flat"}},{"id":"set03_level01","type":"main","campaignId":"campaign_02","setId":"set03","levelNumber":1,"globalNumber":13,"title":"강 건너기","subtitle":"수면 때문에 하부 건설 공간이 제한됩니다","concept":"수면 통과 여유","site":{"kind":"flat","leftX":150,"rightX":1050,"leftY":360,"rightY":360,"segments":6,"curve":0,"waterY":455},"vehicle":"CAR","load":15500,"budget":12400,"serviceDeflection":56,"materials":["road","wood","steel"],"conditionCodes":["WATER","NO_BUILD_WATER"],"objective":"수면 내부에 관절을 만들지 않고 강을 건너는 구조를 설계하세요.","secondaryObjectives":["UNDER BUDGET","ZERO FAILURE"],"unlockRequirement":"set02_level06","stageIndex":2,"weather":"overcast","wind":0,"axles":[[-18,0.5],[18,0.5]],"constraints":["수면 구역","수면 내부 관절 금지"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set03_level02","type":"main","campaignId":"campaign_02","setId":"set03","levelNumber":2,"globalNumber":14,"title":"높은 제방","subtitle":"서로 다른 높이의 지지점","concept":"비대칭 형상","site":{"kind":"slope","leftX":145,"rightX":1055,"leftY":325,"rightY":445,"segments":7,"curve":0,"waterY":485},"vehicle":"BUS","load":20500,"budget":14200,"serviceDeflection":56,"materials":["road","wood","steel"],"conditionCodes":["WATER","ASYMMETRIC_SITE"],"objective":"높이가 다른 양안 지지점 사이에서 연속적인 차량 경로와 하중 경로를 만드세요.","secondaryObjectives":["SERVICEABILITY PASS","ZERO FAILURE"],"unlockRequirement":"set03_level01","stageIndex":2,"weather":"overcast","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["수면 구역","비대칭 지형"],"thumbnail":{"type":"truss-slope"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","SERVICEABILITY PASS"]},{"id":"set03_level03","type":"main","campaignId":"campaign_02","setId":"set03","levelNumber":3,"globalNumber":15,"title":"낮은 형고","subtitle":"상부 건설 높이 제한","concept":"높이 제한","site":{"kind":"flat","leftX":140,"rightX":1060,"leftY":385,"rightY":385,"segments":7,"curve":0,"heightLimitY":300,"waterY":475},"vehicle":"BUS","load":21500,"budget":14800,"serviceDeflection":54,"materials":["road","wood","steel"],"conditionCodes":["MAX_HEIGHT","WATER"],"objective":"높은 상부 트러스를 사용할 수 없는 조건에서 제한된 공간을 활용하세요.","secondaryObjectives":["UNDER BUDGET","DECK DEFLECTION LOW"],"unlockRequirement":"set03_level02","stageIndex":2,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["상부 높이 제한","수면 구역"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set03_level04","type":"main","campaignId":"campaign_02","setId":"set03","levelNumber":4,"globalNumber":16,"title":"항로 구간","subtitle":"항로 통과 여유를 처음 다룹니다","concept":"항로 통과 여유","site":{"kind":"crown","leftX":135,"rightX":1065,"leftY":330,"rightY":330,"segments":7,"curve":-20,"waterY":610,"navigation":{"centerX":600,"minWidth":260,"minHeight":220,"waterY":610,"sweepTop":390}},"vehicle":"TRUCK","load":27500,"budget":15800,"serviceDeflection":58,"materials":["road","wood","steel"],"conditionCodes":["NAVIGATION_CLEARANCE"],"objective":"선박의 전체 navigation clearance envelope를 비워 둔 채 교량을 설계하세요.","secondaryObjectives":["VESSEL PASS","MIN CLEARANCE > 12 u"],"unlockRequirement":"set03_level03","stageIndex":2,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["항로 통과 여유 영역"],"thumbnail":{"type":"navigation"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","VESSEL PASS"]},{"id":"set03_level05","type":"main","campaignId":"campaign_02","setId":"set03","levelNumber":5,"globalNumber":17,"title":"선박 통행","subtitle":"화물차와 선박이 동시에 이동합니다","concept":"이동 통과 여유","site":{"legacyStage":2},"vehicle":"TRUCK","load":32000,"budget":16600,"serviceDeflection":58,"materials":["road","wood","steel","roadHeavy"],"conditionCodes":["NAVIGATION_CLEARANCE","VESSEL"],"objective":"차량과 선박이 동시에 움직여도 변형된 교량이 swept clearance를 침범하지 않게 하세요.","secondaryObjectives":["VESSEL COLLISION 0","SERVICEABILITY PASS"],"unlockRequirement":"set03_level04","stageIndex":2,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["항로 통과 여유 영역","선박 이동 전체 범위 검사"],"thumbnail":{"type":"navigation"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","VESSEL COLLISION 0"]},{"id":"set03_level06","type":"main","campaignId":"campaign_02","setId":"set03","levelNumber":6,"globalNumber":18,"title":"최종 // 항로 관리","subtitle":"넓은 강과 높이·통과 여유 제한","concept":"통과 여유 종합","site":{"kind":"sag","leftX":120,"rightX":1080,"leftY":330,"rightY":330,"segments":8,"curve":18,"heightLimitY":245,"waterY":620,"navigation":{"centerX":600,"minWidth":300,"minHeight":250,"waterY":620,"sweepTop":370}},"vehicle":"TRUCK","load":35000,"budget":18400,"serviceDeflection":56,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["NAVIGATION_CLEARANCE","MAX_HEIGHT","WATER"],"objective":"넓은 강에서 통항 높이, 상부 높이 제한, 무거운 차량과 예산을 동시에 만족하세요.","secondaryObjectives":["VESSEL PASS","ZERO FAILURE"],"unlockRequirement":"set03_level05","stageIndex":2,"weather":"overcast","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["항로 통과 여유 영역","상부 높이 제한","수면 구역"],"thumbnail":{"type":"navigation"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","VESSEL PASS"]},{"id":"set03_bonus01","type":"bonus","campaignId":"campaign_02","setId":"set03","levelNumber":1,"bonusNumber":5,"title":"빠듯한 통항 여유","subtitle":"사용 가능한 구조 공간이 매우 좁습니다","concept":"극단적 통과 여유","site":{"kind":"flat","leftX":120,"rightX":1080,"leftY":325,"rightY":325,"segments":8,"curve":0,"heightLimitY":235,"waterY":620,"navigation":{"centerX":600,"minWidth":340,"minHeight":270,"waterY":620,"sweepTop":350}},"vehicle":"TRUCK","load":33000,"budget":18800,"serviceDeflection":58,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["NAVIGATION_CLEARANCE","MAX_HEIGHT"],"objective":"넓은 항로와 낮은 상부 한계 사이의 좁은 영역에서 하중 경로를 구성하세요.","secondaryObjectives":["MIN CLEARANCE > 15 u","UNDER BUDGET"],"unlockRequirement":"set03_level03","badge":"CLEARANCE SPECIALIST","stageIndex":2,"weather":"overcast","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["항로 통과 여유 영역","상부 높이 제한"],"thumbnail":{"type":"navigation"}},{"id":"set03_bonus02","type":"bonus","campaignId":"campaign_02","setId":"set03","levelNumber":2,"bonusNumber":6,"title":"섬 지지점","subtitle":"선택형 중앙 지지점이 전략을 바꿉니다","concept":"지지점 선택","site":{"kind":"sag","leftX":115,"rightX":1085,"leftY":385,"rightY":385,"segments":8,"curve":20,"waterY":505,"optionalSupport":{"x":600,"y":455}},"vehicle":"BUS","load":27000,"budget":16500,"serviceDeflection":54,"materials":["road","wood","steel"],"conditionCodes":["WATER","OPTIONAL_SUPPORT"],"objective":"중앙의 작은 섬 지지점을 사용할지, 하나의 긴 경간으로 건널지 스스로 선택하세요.","secondaryObjectives":["ZERO FAILURE","UNDER BUDGET"],"unlockRequirement":"set03_level06","badge":"SITE STRATEGIST","stageIndex":2,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["수면 구역","선택형 중앙 지지점"],"thumbnail":{"type":"truss-flat"}},{"id":"set04_level01","type":"main","campaignId":"campaign_02","setId":"set04","levelNumber":1,"globalNumber":19,"title":"버스","subtitle":"다중 차축 승객 하중","concept":"다중 차축 하중","site":{"kind":"flat","leftX":155,"rightX":1045,"leftY":395,"rightY":395,"segments":7,"curve":0},"vehicle":"BUS","load":26000,"budget":15000,"serviceDeflection":52,"materials":["road","wood","steel"],"conditionCodes":["MULTI_AXLE"],"objective":"2~3개의 차축이 서로 다른 위치에 하중을 전달하는 상황을 견디세요.","secondaryObjectives":["ZERO FAILURE","SERVICEABILITY PASS"],"unlockRequirement":"set03_level06","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["다중 차축 하중"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set04_level02","type":"main","campaignId":"campaign_02","setId":"set04","levelNumber":2,"globalNumber":20,"title":"강화 바닥판","subtitle":"도로 휨 강성을 비교합니다","concept":"바닥판 휨","site":{"kind":"sag","leftX":145,"rightX":1055,"leftY":390,"rightY":390,"segments":7,"curve":14},"vehicle":"BUS","load":28500,"budget":16000,"serviceDeflection":50,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["REINFORCED_ROAD"],"objective":"일반 도로와 강화 도로의 휨강성·비용 차이를 비교해 Deck를 설계하세요.","secondaryObjectives":["DECK CURVATURE LOW","UNDER BUDGET"],"unlockRequirement":"set04_level01","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["강화 도로 사용 가능"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","DECK CURVATURE LOW"]},{"id":"set04_level03","type":"main","campaignId":"campaign_02","setId":"set04","levelNumber":3,"globalNumber":21,"title":"이중 하중","subtitle":"두 이동 하중이 동시에 작용합니다","concept":"다중 하중","site":{"kind":"flat","leftX":125,"rightX":1075,"leftY":390,"rightY":390,"segments":8,"curve":0},"vehicle":"TRUCK","load":42000,"budget":19000,"serviceDeflection":52,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["DOUBLE_VEHICLE"],"objective":"두 차량 하중이 동시에 교량에 존재하는 불리한 순간을 견디세요.","secondaryObjectives":["ZERO FAILURE","PEAK UTILIZATION < 90%"],"unlockRequirement":"set04_level02","stageIndex":1,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"doubleVehicle":{"spacing":190,"share":0.5},"constraints":["동시 차량 하중"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set04_level04","type":"main","campaignId":"campaign_02","setId":"set04","levelNumber":4,"globalNumber":22,"title":"대형 화물차","subtitle":"4축 화물 하중","concept":"대형 차축 하중","site":{"kind":"crown","leftX":125,"rightX":1075,"leftY":405,"rightY":405,"segments":8,"curve":-12},"vehicle":"TRUCK","load":44000,"budget":20500,"serviceDeflection":50,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["HEAVY_TRUCK","MULTI_AXLE"],"objective":"높은 차축 하중과 도로 휨을 동시에 고려해 화물차를 통과시키세요.","secondaryObjectives":["ZERO FAILURE","DECK DEFLECTION LOW"],"unlockRequirement":"set04_level03","stageIndex":1,"weather":"clear","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["대형 화물 하중","다중 차축 하중"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set04_level05","type":"main","campaignId":"campaign_02","setId":"set04","levelNumber":5,"globalNumber":23,"title":"화물 예산","subtitle":"엄격한 비용 제한 속 중량 하중","concept":"고하중 효율","site":{"kind":"slope","leftX":135,"rightX":1065,"leftY":375,"rightY":415,"segments":8,"curve":0},"vehicle":"TRUCK","load":43000,"budget":16600,"serviceDeflection":52,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["HEAVY_TRUCK","BUDGET"],"objective":"높은 하중을 제한된 비용 안에서 지지하는 효율적인 화물 교량을 설계하세요.","secondaryObjectives":["UNDER BASE BUDGET","ZERO FAILURE"],"unlockRequirement":"set04_level04","stageIndex":1,"weather":"clear","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["대형 화물 하중","엄격한 예산"],"thumbnail":{"type":"truss-slope"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BASE BUDGET"]},{"id":"set04_level06","type":"main","campaignId":"campaign_02","setId":"set04","levelNumber":6,"globalNumber":24,"title":"최종 // 화물 회랑","subtitle":"긴 산업 구간 횡단","concept":"중량 운송 종합","site":{"kind":"sag","leftX":105,"rightX":1095,"leftY":390,"rightY":390,"segments":9,"curve":18},"vehicle":"TRUCK","load":50000,"budget":22500,"serviceDeflection":48,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["HEAVY_TRUCK","REINFORCED_ROAD","LONG_SPAN"],"objective":"긴 산업 경간에서 강화 바닥판, 트러스, 예산과 변형 한계를 함께 관리하세요.","secondaryObjectives":["ZERO FAILURE","PEAK UTILIZATION < 88%"],"unlockRequirement":"set04_level05","stageIndex":1,"weather":"overcast","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["대형 화물 하중","강화 도로 사용 가능","긴 경간"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set04_bonus01","type":"bonus","campaignId":"campaign_02","setId":"set04","levelNumber":1,"bonusNumber":7,"title":"대형 화물차 2대","subtitle":"대형 화물차 두 대가 경간을 공유합니다","concept":"불리한 다중 하중","site":{"kind":"flat","leftX":105,"rightX":1095,"leftY":390,"rightY":390,"segments":9,"curve":0},"vehicle":"TRUCK","load":72000,"budget":24500,"serviceDeflection":50,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["DOUBLE_VEHICLE","HEAVY_TRUCK"],"objective":"두 대의 대형 화물차가 간격을 유지하며 동시에 올라오는 하중을 견디세요.","secondaryObjectives":["ZERO FRACTURE","SERVICEABILITY PASS"],"unlockRequirement":"set04_level03","badge":"HEAVY TRANSPORT","stageIndex":1,"weather":"clear","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"doubleVehicle":{"spacing":220,"share":0.5},"vehicleLabel":"DOUBLE TRUCK","constraints":["동시 차량 하중","대형 화물 하중"],"thumbnail":{"type":"truss-flat"}},{"id":"set04_bonus02","type":"bonus","campaignId":"campaign_02","setId":"set04","levelNumber":2,"bonusNumber":8,"title":"경량 화물교","subtitle":"구조재 길이를 크게 줄여야 합니다","concept":"극한 효율","site":{"kind":"crown","leftX":115,"rightX":1085,"leftY":400,"rightY":400,"segments":8,"curve":-10},"vehicle":"TRUCK","load":47000,"budget":15500,"serviceDeflection":52,"materials":["road","roadHeavy","wood","steel"],"conditionCodes":["HEAVY_TRUCK","TARGET_MATERIAL_LENGTH"],"objective":"대형 화물차를 통과시키되 구조재 총 길이를 크게 줄여 효율을 높이세요.","secondaryObjectives":["TARGET MATERIAL LENGTH ≤ 2,800 u","UNDER BUDGET"],"unlockRequirement":"set04_level06","badge":"FREIGHT OPTIMIZER","stageIndex":1,"weather":"clear","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"targetMaterialLength":2800,"vehicleLabel":"HEAVY TRUCK","constraints":["대형 화물 하중","총 구조재 길이 목표"],"thumbnail":{"type":"truss-flat"}},{"id":"set05_level01","type":"main","campaignId":"campaign_03","setId":"set05","levelNumber":1,"globalNumber":25,"title":"첫 케이블","subtitle":"케이블 인장 거동을 처음 익힙니다","concept":"케이블 인장","site":{"legacyStage":3},"vehicle":"BUS","load":23500,"budget":17600,"serviceDeflection":62,"materials":["road","steel","cable"],"conditionCodes":["CABLE_INTRO"],"objective":"케이블이 인장에서만 효과적으로 작용한다는 점을 이용해 도로를 지지하세요.","secondaryObjectives":["NO CABLE COMPRESSION","UNDER BUDGET"],"unlockRequirement":"set04_level06","stageIndex":3,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["케이블 인장 거동"],"thumbnail":{"type":"cable"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","NO CABLE COMPRESSION"]},{"id":"set05_level02","type":"main","campaignId":"campaign_03","setId":"set05","levelNumber":2,"globalNumber":26,"title":"주탑","subtitle":"주탑 압축과 케이블 인장","concept":"주탑 거동","site":{"kind":"flat","leftX":130,"rightX":1070,"leftY":400,"rightY":400,"segments":7,"curve":0},"vehicle":"BUS","load":26500,"budget":19200,"serviceDeflection":58,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","TOWER"],"objective":"주탑 압축과 케이블 인장이 함께 작용하는 하중 경로를 구성하세요.","secondaryObjectives":["TOWER UTILIZATION < 90%","ZERO FAILURE"],"unlockRequirement":"set05_level01","stageIndex":3,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["케이블 구조","주탑 압축 + 케이블 인장"],"thumbnail":{"type":"cable"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","TOWER UTILIZATION < 90%"]},{"id":"set05_level03","type":"main","campaignId":"campaign_03","setId":"set05","levelNumber":3,"globalNumber":27,"title":"부채형","subtitle":"부채형 케이블 배치에 유리한 형상","concept":"케이블 분산 배치","site":{"kind":"crown","leftX":115,"rightX":1085,"leftY":410,"rightY":410,"segments":8,"curve":-14},"vehicle":"BUS","load":28500,"budget":20500,"serviceDeflection":58,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","FAN_GEOMETRY"],"objective":"한 지점 근처에서 여러 케이블이 퍼지는 배치를 포함해 다양한 stay 분배를 실험하세요.","secondaryObjectives":["CABLE UTILIZATION BALANCED","UNDER BUDGET"],"unlockRequirement":"set05_level02","stageIndex":3,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["케이블 구조","부채형 배치 가능"],"thumbnail":{"type":"cable"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","CABLE UTILIZATION BALANCED"]},{"id":"set05_level04","type":"main","campaignId":"campaign_03","setId":"set05","levelNumber":4,"globalNumber":28,"title":"하프형","subtitle":"평행한 케이블 배치를 비교합니다","concept":"케이블 힘 분배","site":{"kind":"slope","leftX":120,"rightX":1080,"leftY":395,"rightY":405,"segments":8,"curve":0},"vehicle":"BUS","load":30000,"budget":21200,"serviceDeflection":58,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","HARP_GEOMETRY"],"objective":"여러 높이의 주탑 연결점을 사용해 케이블 힘 분포를 비교하세요.","secondaryObjectives":["ZERO FAILURE","DECK CURVATURE LOW"],"unlockRequirement":"set05_level03","stageIndex":3,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["케이블 구조","하프형 배치 가능"],"thumbnail":{"type":"cable"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set05_level05","type":"main","campaignId":"campaign_03","setId":"set05","levelNumber":5,"globalNumber":29,"title":"장경간","subtitle":"장경간에서 케이블 지지가 경제적입니다","concept":"장경간 케이블 구조","site":{"kind":"sag","leftX":85,"rightX":1115,"leftY":405,"rightY":405,"segments":9,"curve":20},"vehicle":"TRUCK","load":39000,"budget":23800,"serviceDeflection":60,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","LONG_SPAN"],"objective":"일반 트러스만으로는 비용과 처짐이 불리한 긴 경간을 케이블 지지와 함께 해결하세요.","secondaryObjectives":["UNDER BUDGET","SERVICEABILITY PASS"],"unlockRequirement":"set05_level04","stageIndex":3,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["케이블 구조","긴 경간"],"thumbnail":{"type":"cable"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set05_level06","type":"main","campaignId":"campaign_03","setId":"set05","levelNumber":6,"globalNumber":30,"title":"최종 // 스카이라인 횡단","subtitle":"높은 주탑과 장경간 화물 하중","concept":"케이블 구조 종합","site":{"kind":"crown","leftX":75,"rightX":1125,"leftY":410,"rightY":410,"segments":9,"curve":-18},"vehicle":"TRUCK","load":45500,"budget":27000,"serviceDeflection":56,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","TOWER","LONG_SPAN"],"objective":"높은 주탑, 긴 경간, 대형 차량을 케이블·강철·강화 도로로 통합 설계하세요.","secondaryObjectives":["CABLE UTILIZATION < 90%","ZERO FAILURE"],"unlockRequirement":"set05_level05","stageIndex":3,"weather":"windy","wind":5000,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["케이블 구조","주탑 압축 + 케이블 인장","긴 경간"],"thumbnail":{"type":"cable"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","CABLE UTILIZATION < 90%"]},{"id":"set05_bonus01","type":"bonus","campaignId":"campaign_03","setId":"set05","levelNumber":1,"bonusNumber":9,"title":"단일 주탑","subtitle":"주탑 구역을 한쪽만 사용할 수 있습니다","concept":"비대칭 사장교","site":{"kind":"slope","leftX":95,"rightX":1105,"leftY":380,"rightY":420,"segments":9,"curve":0,"noBuild":[{"x":650,"y":120,"w":470,"h":240}]},"vehicle":"TRUCK","load":38000,"budget":23000,"serviceDeflection":58,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","ONE_TOWER"],"objective":"한쪽에만 주탑을 세울 수 있는 비대칭 부지에서 케이블 구조를 설계하세요.","secondaryObjectives":["REACTION IMBALANCE CONTROLLED","ZERO FAILURE"],"unlockRequirement":"set05_level03","badge":"ASYMMETRIC ENGINEER","stageIndex":3,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["케이블 구조","한쪽 주탑 영역만 사용"],"thumbnail":{"type":"cable"}},{"id":"set05_bonus02","type":"bonus","campaignId":"campaign_03","setId":"set05","levelNumber":2,"bonusNumber":10,"title":"케이블 제한","subtitle":"케이블을 6개만 사용할 수 있습니다","concept":"케이블 효율","site":{"kind":"flat","leftX":95,"rightX":1105,"leftY":405,"rightY":405,"segments":9,"curve":0},"vehicle":"TRUCK","load":41000,"budget":24200,"serviceDeflection":58,"materials":["road","roadHeavy","steel","cable"],"conditionCodes":["CABLE","MAX_CABLE_COUNT"],"objective":"케이블을 최대 6개만 사용해 긴 경간의 힘을 효율적으로 분산하세요.","secondaryObjectives":["CABLE COUNT ≤ 6","UNDER BUDGET"],"unlockRequirement":"set05_level06","badge":"CABLE OPTIMIZER","stageIndex":3,"weather":"clear","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"maxCableCount":6,"constraints":["케이블 구조","케이블 개수 제한"],"thumbnail":{"type":"cable"}},{"id":"set06_level01","type":"main","campaignId":"campaign_03","setId":"set06","levelNumber":1,"globalNumber":31,"title":"횡풍","subtitle":"단순화된 횡풍 하중","concept":"풍하중","site":{"kind":"flat","leftX":160,"rightX":1040,"leftY":390,"rightY":390,"segments":7,"curve":0},"vehicle":"BUS","load":26000,"budget":18800,"serviceDeflection":56,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["WIND"],"objective":"횡풍에 의한 단순화된 수평 하중과 차량 하중을 함께 전달하세요.","secondaryObjectives":["ZERO FAILURE","LATERAL LOAD PATH VISIBLE"],"unlockRequirement":"set05_level06","stageIndex":1,"weather":"windy","wind":12000,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"constraints":["단순화된 횡풍 하중"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set06_level02","type":"main","campaignId":"campaign_03","setId":"set06","levelNumber":2,"globalNumber":32,"title":"구조적 여유도 시험","subtitle":"시험 중 구조 부재 하나가 제거됩니다","concept":"구조적 여유도","site":{"kind":"crown","leftX":135,"rightX":1065,"leftY":395,"rightY":395,"segments":8,"curve":-10},"vehicle":"BUS","load":30000,"budget":21500,"serviceDeflection":54,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["MEMBER_FAILURE","REDUNDANCY"],"objective":"시험 중 주요 부재가 제거되어도 대체 하중 경로로 차량 통과를 유지하세요.","secondaryObjectives":["ALTERNATE LOAD PATH","ZERO CASCADE FAILURE"],"unlockRequirement":"set06_level01","stageIndex":1,"weather":"clear","wind":0,"axles":[[-34,0.28],[0,0.34],[34,0.38]],"forcedFailure":{"progress":0.58,"candidates":5},"constraints":["시험 중 실제 부재 제거","대체 하중 경로 평가"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ALTERNATE LOAD PATH"]},{"id":"set06_level03","type":"main","campaignId":"campaign_03","setId":"set06","levelNumber":3,"globalNumber":33,"title":"제한 부지","subtitle":"여러 건설 금지 구역","concept":"비정형 부지 형상","site":{"kind":"asym","leftX":120,"rightX":1080,"leftY":420,"rightY":355,"segments":8,"curve":20,"noBuild":[{"x":310,"y":300,"w":150,"h":210},{"x":730,"y":260,"w":150,"h":230}]},"vehicle":"TRUCK","load":33000,"budget":22800,"serviceDeflection":56,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["NO_BUILD_ZONE"],"objective":"여러 건설 금지영역을 피해 비정형 하중 경로를 구성하세요.","secondaryObjectives":["UNDER BUDGET","ZERO FAILURE"],"unlockRequirement":"set06_level02","stageIndex":2,"weather":"overcast","wind":0,"axles":[[-42,0.24],[-5,0.34],[38,0.42]],"constraints":["복수 건설 금지영역"],"thumbnail":{"type":"truss-slope"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set06_level04","type":"main","campaignId":"campaign_03","setId":"set06","levelNumber":4,"globalNumber":34,"title":"폭풍 하중","subtitle":"차량과 강한 횡풍의 복합 하중","concept":"복합 하중","site":{"kind":"sag","leftX":115,"rightX":1085,"leftY":400,"rightY":400,"segments":9,"curve":18},"vehicle":"TRUCK","load":42000,"budget":24800,"serviceDeflection":56,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["WIND","COMBINED_LOAD"],"objective":"대형 차량과 강한 횡풍이 동시에 작용하는 복합하중을 견디세요.","secondaryObjectives":["ZERO FAILURE","SERVICEABILITY PASS"],"unlockRequirement":"set06_level03","stageIndex":1,"weather":"storm","wind":-19000,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["단순화된 횡풍 하중","복합하중"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set06_level05","type":"main","campaignId":"campaign_03","setId":"set06","levelNumber":5,"globalNumber":35,"title":"엔지니어의 선택","subtitle":"자유로운 혼합 구조 설계 도전","concept":"설계 절충","site":{"kind":"crown","leftX":95,"rightX":1105,"leftY":405,"rightY":405,"segments":9,"curve":-16},"vehicle":"TRUCK","load":44000,"budget":25500,"serviceDeflection":54,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["OPEN_CHOICE"],"objective":"트러스·강철 중심·케이블 보조·혼합 구조 중 스스로 전략을 선택해 목표를 만족하세요.","secondaryObjectives":["UNDER BUDGET","PEAK UTILIZATION < 88%"],"unlockRequirement":"set06_level04","stageIndex":3,"weather":"clear","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["설계 형식 자유"],"thumbnail":{"type":"truss-flat"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","UNDER BUDGET"]},{"id":"set06_level06","type":"main","campaignId":"campaign_03","setId":"set06","levelNumber":6,"globalNumber":36,"title":"최종 // 대횡단","subtitle":"구조공학 과정의 최종 종합 문제","concept":"전체 시스템 종합","site":{"kind":"sag","leftX":70,"rightX":1130,"leftY":335,"rightY":335,"segments":10,"curve":20,"heightLimitY":210,"waterY":625,"navigation":{"centerX":600,"minWidth":320,"minHeight":255,"waterY":625,"sweepTop":370}},"vehicle":"TRUCK","load":56000,"budget":31000,"serviceDeflection":54,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["NAVIGATION_CLEARANCE","WIND","HEAVY_TRUCK","COMBINED_LOAD","LONG_SPAN"],"objective":"매우 긴 강 횡단에서 차량·선박·횡풍·예산·강도·사용성 조건을 모두 만족하세요.","secondaryObjectives":["ZERO FAILURE","HIGH REDUNDANCY","TARGET COST ≤ 28,000"],"unlockRequirement":"set06_level05","stageIndex":3,"weather":"windy","wind":15000,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","constraints":["항로 통과 여유 영역","단순화된 횡풍 하중","대형 화물 하중","복합하중","긴 경간"],"thumbnail":{"type":"navigation"},"starConditions":["CONTRACT CLEAR","WITHIN BASE BUDGET","ZERO FAILURE"]},{"id":"set06_bonus01","type":"bonus","campaignId":"campaign_03","setId":"set06","levelNumber":1,"bonusNumber":11,"title":"폭풍 생존","subtitle":"부재 파단 전에 바람이 더 강해집니다","concept":"파단 후 생존성","site":{"kind":"flat","leftX":95,"rightX":1105,"leftY":395,"rightY":395,"segments":9,"curve":0},"vehicle":"TRUCK","load":52000,"budget":29000,"serviceDeflection":56,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["WIND","MEMBER_FAILURE","REDUNDANCY"],"objective":"대형 차량과 강풍 중 부재 하나가 제거되어도 구조와 차량 경로를 유지하세요.","secondaryObjectives":["PRIMARY STRUCTURE SURVIVES","VEHICLE EXITS"],"unlockRequirement":"set06_level03","badge":"STORM SURVIVOR","stageIndex":1,"weather":"storm","wind":22000,"windRamp":{"start":0.12,"full":0.55},"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","forcedFailure":{"progress":0.62,"candidates":5},"constraints":["단순화된 횡풍 하중","시험 중 실제 부재 제거","대체 하중 경로 평가"],"thumbnail":{"type":"truss-flat"}},{"id":"set06_bonus02","type":"bonus","campaignId":"campaign_03","setId":"set06","levelNumber":2,"bonusNumber":12,"title":"불가능에 가까운 예산","subtitle":"최종 구조 효율 도전","concept":"극한 효율","site":{"kind":"crown","leftX":115,"rightX":1085,"leftY":400,"rightY":400,"segments":9,"curve":-12},"vehicle":"TRUCK","load":48000,"budget":15800,"serviceDeflection":52,"materials":["road","roadHeavy","wood","steel","cable"],"conditionCodes":["BUDGET","TARGET_MATERIAL_LENGTH"],"objective":"모든 재료를 사용할 수 있지만 매우 제한된 비용 안에서 대형 차량을 통과시키세요.","secondaryObjectives":["UNDER TARGET COST","ZERO FAILURE"],"unlockRequirement":"set06_level06","badge":"EFFICIENCY EXPERT","stageIndex":1,"weather":"clear","wind":0,"axles":[[-54,0.18],[-18,0.24],[18,0.27],[54,0.31]],"vehicleLabel":"HEAVY TRUCK","targetMaterialLength":3000,"constraints":["엄격한 예산","총 구조재 길이 목표"],"thumbnail":{"type":"truss-flat"}}];

try{applyProjectContent()}catch(error){showProjectConfigError(error);return}

const KO_GAMEPLAY_LABELS=Object.freeze({
  'CONTRACT CLEAR':'계약 완료','WITHIN BASE BUDGET':'기본 예산 이내','UNDER BUDGET':'예산 이내','UNDER BASE BUDGET':'기본 예산 이내','UNDER TARGET COST':'목표 비용 이내',
  'ZERO FAILURE':'파단 없음','ZERO FRACTURE':'파단 없음','ZERO SECONDARY FRACTURE':'2차 파단 없음','ZERO CASCADE FAILURE':'연쇄 파단 없음',
  'SERVICEABILITY PASS':'사용성 기준 통과','DECK DEFLECTION LOW':'바닥판 처짐 낮음','DECK CURVATURE LOW':'바닥판 곡률 낮음','NO BUCKLING FAILURE':'좌굴 파괴 없음',
  'REACTION BALANCE OBSERVED':'지점반력 균형 확인','ALTERNATE LOAD PATH':'대체 하중 경로 확보','HIGH REDUNDANCY':'높은 구조적 여유도',
  'VESSEL PASS':'선박 통과','VESSEL COLLISION 0':'선박 충돌 없음','NO CABLE COMPRESSION':'케이블 압축 없음','CABLE UTILIZATION BALANCED':'케이블 이용률 균형',
  'LATERAL LOAD PATH VISIBLE':'횡하중 경로 확인','PRIMARY STRUCTURE SURVIVES':'주 구조 유지','VEHICLE EXITS':'차량 통과 완료',
  'CAR':'승용차','BUS':'버스','TRUCK':'화물차','HEAVY TRUCK':'대형 화물차','DOUBLE TRUCK':'대형 화물차 2대',
  'CLEAR':'맑음','OVERCAST':'흐림','STORM':'폭풍','WINDY':'강풍','NONE':'없음',
  'TIMBER SPECIALIST':'목재 구조 전문가','LOW-PROFILE DESIGNER':'저형고 설계자','LOAD PATH ANALYST':'하중 경로 분석가','REDUNDANCY TESTED':'구조적 여유도 분석가',
  'CLEARANCE SPECIALIST':'통항 여유 전문가','SITE STRATEGIST':'부지 전략가','HEAVY TRANSPORT':'중량 운송 전문가','FREIGHT OPTIMIZER':'화물교 최적화 전문가',
  'ASYMMETRIC ENGINEER':'비대칭 구조 설계자','CABLE OPTIMIZER':'케이블 최적화 전문가','STORM SURVIVOR':'폭풍 생존 전문가','EFFICIENCY EXPERT':'효율 설계 전문가'
});
function koGameplayLabel(value){
  const s=String(value??'');
  const u=s.toUpperCase();
  if(KO_GAMEPLAY_LABELS[u])return KO_GAMEPLAY_LABELS[u];
  let m=u.match(/^PEAK UTILIZATION < (\d+)%$/);if(m)return `최대 이용률 ${m[1]}% 미만`;
  m=u.match(/^UTILIZATION < (\d+)%$/);if(m)return `이용률 ${m[1]}% 미만`;
  m=u.match(/^NO MEMBER > (\d+)% UTILIZATION$/);if(m)return `모든 부재 이용률 ${m[1]}% 이하`;
  m=u.match(/^TOWER UTILIZATION < (\d+)%$/);if(m)return `주탑 이용률 ${m[1]}% 미만`;
  m=u.match(/^CABLE UTILIZATION < (\d+)%$/);if(m)return `케이블 이용률 ${m[1]}% 미만`;
  m=u.match(/^MEMBERS ≤ (\d+)$/);if(m)return `부재 ${m[1]}개 이하`;
  m=u.match(/^CABLE COUNT ≤ (\d+)$/);if(m)return `케이블 ${m[1]}개 이하`;
  m=u.match(/^TARGET COST ≤ ([\d,]+)$/);if(m)return `목표 비용 ${m[1]} 이하`;
  m=u.match(/^TARGET MATERIAL LENGTH ≤ ([\d,]+) U$/);if(m)return `목표 구조재 길이 ${m[1]} u 이하`;
  m=u.match(/^MIN CLEARANCE > ([\d.]+) U$/);if(m)return `최소 통항 여유 ${m[1]} u 초과`;
  return s;
}
function koVehicleLabel(value){return koGameplayLabel(value)}
function koWeatherLabel(value){return koGameplayLabel(String(value||'clear').toUpperCase())}
function koBadgeLabel(value){return koGameplayLabel(value)}
function koMaterialLabel(key){return ({wood:'목재',steel:'강철',cable:'케이블',road:'일반 도로',roadHeavy:'강화 도로'})[key]||String(key||'—')}


function displayContractId(level){
  return level?.type==='bonus'?`B${String(level.bonusNumber).padStart(2,'0')}`:`${String(level.globalNumber).padStart(2,'0')}`;
}
function getCampaign(id){return CAMPAIGNS.find(c=>c.id===id)||null}
function mainLevelsForSet(setId){return LEVEL_LIBRARY.filter(l=>l.setId===setId&&l.type==='main')}
function bonusLevelsForSet(setId){return LEVEL_LIBRARY.filter(l=>l.setId===setId&&l.type==='bonus')}
function makeDeckFromSite(site){
  if(site?.legacyStage!=null)return stages[site.legacyStage].deck.map(p=>[...p]);
  const n=Math.max(2,site?.segments||6),out=[];
  for(let i=0;i<=n;i++){
    const t=i/n,x=site.leftX+(site.rightX-site.leftX)*t;
    let y=site.leftY+(site.rightY-site.leftY)*t;
    const curve=site.curve||0;
    if(site.kind==='sag')y+=Math.sin(Math.PI*t)*curve;
    else if(site.kind==='crown')y+=Math.sin(Math.PI*t)*curve;
    else if(site.kind==='asym')y+=Math.sin(Math.PI*t)*(curve||16)*(t<.5?.55:1.0);
    out.push([Math.round(x*10)/10,Math.round(y*10)/10]);
  }
  return out;
}
function clonePlain(v){return JSON.parse(JSON.stringify(v))}
function runtimeStageForLevel(level,{difficulty=true}={}){
  const base=clonePlain(stages[level.stageIndex]||stages[0]);
  const d=difficulty?DIFFICULTY[difficultyMode]:{budgetMul:1,loadMul:1,deflMul:1};
  const deck=makeDeckFromSite(level.site||{}),site=level.site||{},forbidden=[];
  for(const r of (site.noBuild||[]))forbidden.push({...r,kind:r.kind||'site'});
  if(Number.isFinite(site.waterY))forbidden.push({x:deck[0][0]+12,y:site.waterY,w:Math.max(0,deck.at(-1)[0]-deck[0][0]-24),h:Math.max(200,H-site.waterY+400),kind:'water'});
  if(Number.isFinite(site.heightLimitY))forbidden.push({x:deck[0][0],y:-700,w:deck.at(-1)[0]-deck[0][0],h:site.heightLimitY+700,kind:'height-limit'});
  let ship=null,navigationClearance=null;
  if(site.navigation){
    navigationClearance={...site.navigation,sweepBottom:site.navigation.waterY};
    const top=site.navigation.sweepTop??(site.navigation.waterY-site.navigation.minHeight),w=site.navigation.minWidth;
    forbidden.push({x:site.navigation.centerX-w/2,y:top,w,h:site.navigation.waterY-top,kind:'navigation'});
    ship={y:(top+site.navigation.waterY)/2+35,length:230,height:90,label:''};
  } else if(site.legacyStage===2){
    const src=stages[2];forbidden.push(...clonePlain(src.forbidden));ship=clonePlain(src.ship);navigationClearance=clonePlain(src.navigationClearance);
  }
  const extraSupports=site.optionalSupport?[{x:site.optionalSupport.x,y:site.optionalSupport.y,type:'roller',optional:true}]:[];
  const vehicleKey=level.vehicleLabel||level.vehicle,devVehicle=devVehicleProfileFor(vehicleKey);
  const baseLoad=Number.isFinite(devVehicle?.loadOverride)?devVehicle.loadOverride:level.load;
  const vehicleAxles=devVehicle?.useAxleOverride&&Array.isArray(devVehicle.axles)&&devVehicle.axles.length?devVehicle.axles:(level.axles||[]);
  const serviceLimit=level.serviceDeflection*d.deflMul;
  const collapseBase=Number.isFinite(level.collapseDeflection)?level.collapseDeflection:level.serviceDeflection*2.2;
  return {...base,
    name:level.type==='bonus'?`BONUS B${String(level.bonusNumber).padStart(2,'0')}`:`계약 ${String(level.globalNumber).padStart(2,'0')}`,
    type:level.type==='bonus'?'EXPERIMENT':base.type,title:level.title,goal:level.objective,tutorial:level.coachHint||`CORE CONCEPT // ${level.concept}`,
    budget:Math.round(level.budget*d.budgetMul/10)*10,load:Math.round(baseLoad*d.loadMul),maxDefl:serviceLimit,
    collapseDeflLimit:collapseBase*d.deflMul,deck,forbidden,vehicle:devVehicle?.base||level.vehicle,vehicleLabel:vehicleKey,
    vehicleSpeed:devVehicle?.speed||82,vehicleRenderScale:devVehicle?.renderScale||1,vehicleLength:devVehicle?.length||null,
    materials:[...level.materials],conditionCodes:[...level.conditionCodes],levelId:level.id,levelType:level.type,campaignId:level.campaignId,setId:level.setId,
    wind:level.wind||0,windRamp:clonePlain(level.windRamp||null),weather:level.weather||'clear',environment:getGameSet(level.setId)?.environment||'',ship,navigationClearance,
    axles:clonePlain(vehicleAxles),doubleVehicle:clonePlain(level.doubleVehicle||null),forcedFailure:clonePlain(level.forcedFailure||null),
    maxMemberCount:level.maxMemberCount??null,maxCableCount:level.maxCableCount??null,targetMaterialLength:level.targetMaterialLength??null,
    extraSupports,sandbox:false,bg:site.navigation?'obstacle':base.bg
  };
}

const gameSets = SET_DEFINITIONS.map(set=>({
  ...set,
  unlockRequirement:set.number===1?'tutorial-complete':`set${String(set.number-1).padStart(2,'0')}_level06`,
  levels:LEVEL_LIBRARY.filter(level=>level.setId===set.id)
}));

const GAME_PHASE=Object.freeze({BUILD:'build',TEST:'test',RESULT:'result'});
let gamePhase=GAME_PHASE.BUILD;
function setGamePhase(phase){if(!Object.values(GAME_PHASE).includes(phase))return;gamePhase=phase;document.body.dataset.gamePhase=phase}

const PLAYER_PROGRESS_KEY='trusslab-player-progress-v3';
const LEGACY_PLAYER_PROGRESS_KEYS=['trusslab-player-progress-v1','trusslab-player-progress-v2'];
function defaultPlayerProgress(){
  const legacyTutorial=localStorage.getItem('trusslab-tutorial-complete')==='1';
  return {saveVersion:3,tutorialCompleted:legacyTutorial,lastPlayedSet:legacyTutorial?'set01':null,lastPlayedLevel:null,
    unlockedSets:legacyTutorial?['set01']:[],unlockedLevels:legacyTutorial?['set01_level01']:[],unlockedBonusLevels:[],completedLevels:[],
    totalStars:0,badges:[],levelProgress:{},stats:{testsPerformed:0,designIterations:0,zeroFractureClears:0,lowestCost:null,highestRedundancy:0}};
}
function migrateLegacyProgress(data){
  const out=defaultPlayerProgress();if(!data||typeof data!=='object')return out;
  out.tutorialCompleted=!!(data.tutorialCompleted||out.tutorialCompleted);
  const idMap={set1_level1:'set01_level01',set1_level2:'set01_level02',set1_level3:'set01_level03',set1_level4:'set01_level04'};
  for(const [oldId,v] of Object.entries(data.levelProgress||{})){
    const id=idMap[oldId]||oldId;if(getGameLevel(id))out.levelProgress[id]={...v};
  }
  for(const oldId of (data.completedLevels||[])){const id=idMap[oldId]||oldId;if(getGameLevel(id)&&!out.completedLevels.includes(id))out.completedLevels.push(id)}
  const last=idMap[data.lastPlayedLevel]||data.lastPlayedLevel;if(getGameLevel(last))out.lastPlayedLevel=last;
  if(out.lastPlayedLevel)out.lastPlayedSet=getGameLevel(out.lastPlayedLevel)?.setId||'set01';
  out.stats={...out.stats,...(data.stats||{})};
  return out;
}
function loadPlayerProgress(){
  try{
    const parsed=JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY)||'null');
    if(parsed&&typeof parsed==='object')return {...defaultPlayerProgress(),...parsed,saveVersion:3,
      unlockedSets:Array.isArray(parsed.unlockedSets)?parsed.unlockedSets:[],unlockedLevels:Array.isArray(parsed.unlockedLevels)?parsed.unlockedLevels:[],
      unlockedBonusLevels:Array.isArray(parsed.unlockedBonusLevels)?parsed.unlockedBonusLevels:[],completedLevels:Array.isArray(parsed.completedLevels)?parsed.completedLevels:[],
      badges:Array.isArray(parsed.badges)?parsed.badges:[],levelProgress:parsed.levelProgress&&typeof parsed.levelProgress==='object'?parsed.levelProgress:{},stats:{...defaultPlayerProgress().stats,...(parsed.stats||{})}};
  }catch(_){}
  for(const key of LEGACY_PLAYER_PROGRESS_KEYS){
    try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old){const migrated=migrateLegacyProgress(old);try{localStorage.setItem(PLAYER_PROGRESS_KEY,JSON.stringify(migrated))}catch(_){}return migrated}}catch(_){}
  }
  return defaultPlayerProgress();
}
let playerProgress=loadPlayerProgress();
function allGameLevels(){return LEVEL_LIBRARY}
function allMainLevels(){return LEVEL_LIBRARY.filter(l=>l.type==='main')}
function allBonusLevels(){return LEVEL_LIBRARY.filter(l=>l.type==='bonus')}

const CAMPAIGN_VALID_MATERIALS=new Set(['wood','steel','cable','road','roadHeavy']);
const CAMPAIGN_VALID_CONSTRAINTS=new Set(['ASYMMETRIC_SITE','BUCKLING','BUDGET','CABLE','CABLE_INTRO','CENTER_LOAD','COMBINED_LOAD','DOUBLE_VEHICLE','FAN_GEOMETRY','HARP_GEOMETRY','HEAVY_TRUCK','HIGH_LOAD','LONG_SPAN','MAX_CABLE_COUNT','MAX_HEIGHT','MAX_MEMBER_COUNT','MEMBER_FAILURE','MOVING_LOAD','MULTI_AXLE','NAVIGATION_CLEARANCE','NO_BUILD_WATER','NO_BUILD_ZONE','ONE_TOWER','OPEN_CHOICE','OPTIONAL_SUPPORT','REACTIONS','REDUNDANCY','REINFORCED_ROAD','ROAD_REQUIRED','SET_FINAL','STEEL_INTRO','STRESS_VIEW','TARGET_MATERIAL_LENGTH','TOWER','TRUSS_SUPPORT','VESSEL','WATER','WIND','WOOD_ONLY']);
function validateCampaignContent({log=true}={}){
  const errors=[],warnings=[],ids=new Set(),setIds=new Set(SET_DEFINITIONS.map(s=>s.id)),campaignIds=new Set(CAMPAIGNS.map(c=>c.id));
  const err=(id,msg)=>errors.push(`${id||'GLOBAL'} // ${msg}`),warn=(id,msg)=>warnings.push(`${id||'GLOBAL'} // ${msg}`);
  if(LEVEL_LIBRARY.length!==48)err(null,`EXPECTED 48 CONTRACTS, FOUND ${LEVEL_LIBRARY.length}`);
  if(allMainLevels().length!==36)err(null,`EXPECTED 36 MAIN, FOUND ${allMainLevels().length}`);
  if(allBonusLevels().length!==12)err(null,`EXPECTED 12 BONUS, FOUND ${allBonusLevels().length}`);
  for(const l of LEVEL_LIBRARY){
    if(ids.has(l.id))err(l.id,'DUPLICATE ID');ids.add(l.id);
    if(!setIds.has(l.setId))err(l.id,`INVALID SET ${l.setId}`);
    if(!campaignIds.has(l.campaignId))err(l.id,`INVALID CAMPAIGN ${l.campaignId}`);
    if(!l.title||!l.objective||!l.concept)err(l.id,'MISSING TITLE / OBJECTIVE / CORE CONCEPT');
    if(!l.site||typeof l.site!=='object')err(l.id,'MISSING SITE CONFIG');
    if(!(Number(l.budget)>0)||!(Number(l.load)>0))err(l.id,'INVALID BUDGET OR LOAD');
    if(!Array.isArray(l.materials)||!l.materials.length)err(l.id,'NO AVAILABLE MATERIALS');
    for(const m of l.materials||[])if(!CAMPAIGN_VALID_MATERIALS.has(m))err(l.id,`INVALID MATERIAL ${m}`);
    for(const c of l.conditionCodes||[])if(!CAMPAIGN_VALID_CONSTRAINTS.has(c))warn(l.id,`UNREGISTERED CONDITION ${c}`);
    const req=typeof l.unlockRequirement==='object'?(l.unlockRequirement.complete||l.unlockRequirement.level):l.unlockRequirement;
    if(req&&req!=='tutorial-complete'&&!LEVEL_LIBRARY.some(x=>x.id===req))err(l.id,`MISSING UNLOCK TARGET ${req}`);
    if(l.type==='main'&&!Number.isFinite(l.globalNumber))err(l.id,'MAIN CONTRACT HAS NO GLOBAL NUMBER');
    if(l.type==='bonus'&&!Number.isFinite(l.bonusNumber))err(l.id,'BONUS CONTRACT HAS NO BONUS NUMBER');
    if(l.type==='main'&&(!Array.isArray(l.starConditions)||l.starConditions.length!==3))warn(l.id,'MAIN CONTRACT SHOULD DEFINE 3 STAR CONDITIONS');
  }
  for(const set of SET_DEFINITIONS){const main=mainLevelsForSet(set.id),bonus=bonusLevelsForSet(set.id);if(main.length!==6)err(set.id,`EXPECTED 6 MAIN, FOUND ${main.length}`);if(bonus.length!==2)err(set.id,`EXPECTED 2 BONUS, FOUND ${bonus.length}`)}
  const mainNums=allMainLevels().map(l=>l.globalNumber).sort((a,b)=>a-b),bonusNums=allBonusLevels().map(l=>l.bonusNumber).sort((a,b)=>a-b);
  if(mainNums.some((n,i)=>n!==i+1))err(null,'MAIN NUMBERING IS NOT CONTIGUOUS 01–36');
  if(bonusNums.some((n,i)=>n!==i+1))err(null,'BONUS NUMBERING IS NOT CONTIGUOUS B01–B12');
  // Reachability is checked from Tutorial -> main chain. Bonus contracts are optional branches.
  for(const set of SET_DEFINITIONS.slice(1)){const first=mainLevelsForSet(set.id)[0],prev=SET_DEFINITIONS[set.number-2],prevFinal=mainLevelsForSet(prev.id).at(-1);if(first?.unlockRequirement!==prevFinal?.id)err(first?.id,`SET ENTRY MUST FOLLOW ${prevFinal?.id}`)}
  const report={ok:errors.length===0,errors,warnings,counts:{campaigns:CAMPAIGNS.length,sets:SET_DEFINITIONS.length,main:allMainLevels().length,bonus:allBonusLevels().length,total:LEVEL_LIBRARY.length}};
  if(log){const method=report.ok?'info':'error';console[method]('[TRUSS LAB] CAMPAIGN VALIDATION',report);if(warnings.length)console.warn('[TRUSS LAB] CAMPAIGN WARNINGS',warnings)}
  return report;
}
function campaignBalanceSummary(levelId){
  const l=getGameLevel(levelId);if(!l)return null;const deck=makeDeckFromSite(l.site||{}),span=deck.at(-1)[0]-deck[0][0];return {id:l.id,type:l.type,set:l.setId,title:l.title,load_kN:l.load/1000,budget:l.budget,span_GU:Math.round(span),serviceLimit:l.serviceDeflection,materials:[...l.materials],conditions:[...l.conditionCodes],vehicle:l.vehicleLabel||l.vehicle,weather:l.weather,wind_kN:(l.wind||0)/1000};
}
// Secure developer API is installed by the DEV AUTH block below.

validateCampaignContent({log:true});
function getGameSet(id){return gameSets.find(set=>set.id===id)||null}
function getGameLevel(id){return LEVEL_LIBRARY.find(level=>level.id===id)||null}
function levelForStageIndex(index){return currentCampaignLevelId?getGameLevel(currentCampaignLevelId):LEVEL_LIBRARY.find(level=>level.stageIndex===index)||null}
function levelProgressFor(id){return playerProgress.levelProgress[id]||{completed:false,stars:0,attempts:0,bestTimeMs:null,bestScore:0,bestCost:null,bestDeflection:null,bestGrade:null}}
function progressRequirementMet(requirement){
  if(!requirement)return true;
  if(requirement==='tutorial-complete')return !!playerProgress.tutorialCompleted;
  if(typeof requirement==='string'&&getGameLevel(requirement))return !!levelProgressFor(requirement).completed;
  if(typeof requirement==='object'&&requirement.complete)return !!levelProgressFor(requirement.complete).completed;
  if(typeof requirement==='object'&&requirement.level)return !!levelProgressFor(requirement.level).completed;
  if(typeof requirement==='object'&&Number.isFinite(requirement.stars))return playerProgress.totalStars>=requirement.stars;
  return false;
}
function recomputeProgressUnlocks(){
  const completed=LEVEL_LIBRARY.filter(l=>levelProgressFor(l.id).completed).map(l=>l.id);playerProgress.completedLevels=[...new Set(completed)];
  playerProgress.totalStars=allMainLevels().reduce((sum,l)=>sum+(Number(levelProgressFor(l.id).stars)||0),0);
  playerProgress.badges=[...new Set(allBonusLevels().filter(l=>levelProgressFor(l.id).completed).map(l=>l.badge).filter(Boolean))];
  playerProgress.unlockedSets=[];playerProgress.unlockedLevels=[];playerProgress.unlockedBonusLevels=[];
  for(const set of gameSets){
    if(progressRequirementMet(set.unlockRequirement))playerProgress.unlockedSets.push(set.id);
    if(!playerProgress.unlockedSets.includes(set.id))continue;
    for(const level of set.levels){
      if(!progressRequirementMet(level.unlockRequirement))continue;
      if(level.type==='bonus')playerProgress.unlockedBonusLevels.push(level.id);else playerProgress.unlockedLevels.push(level.id);
    }
  }
  playerProgress.unlockedSets=[...new Set(playerProgress.unlockedSets)];playerProgress.unlockedLevels=[...new Set(playerProgress.unlockedLevels)];playerProgress.unlockedBonusLevels=[...new Set(playerProgress.unlockedBonusLevels)];
}
function savePlayerProgress(){recomputeProgressUnlocks();try{localStorage.setItem(PLAYER_PROGRESS_KEY,JSON.stringify(playerProgress))}catch(_){} }
function isSetUnlocked(id){if(window.__trussDevUnlockAll)return true;const set=getGameSet(id),cid=set?.campaignId;if((playerProgress.devLockedCampaigns||[]).includes(cid)||(playerProgress.devLockedSets||[]).includes(id))return false;if((playerProgress.devUnlockedCampaigns||[]).includes(cid)||(playerProgress.devUnlockedSets||[]).includes(id))return true;return playerProgress.unlockedSets.includes(id)}
function isLevelUnlocked(id){const l=getGameLevel(id);if(!l||l.enabled===false)return false;if(window.__trussDevUnlockAll)return true;if((playerProgress.devLockedCampaigns||[]).includes(l.campaignId)||(playerProgress.devLockedSets||[]).includes(l.setId)||(playerProgress.devLockedLevels||[]).includes(id))return false;if((playerProgress.devUnlockedCampaigns||[]).includes(l.campaignId)||(playerProgress.devUnlockedSets||[]).includes(l.setId)||(playerProgress.devUnlockedLevels||[]).includes(id))return true;return l.type==='bonus'?playerProgress.unlockedBonusLevels.includes(id):playerProgress.unlockedLevels.includes(id)}
function markTutorialComplete(){playerProgress.tutorialCompleted=true;playerProgress.lastPlayedSet=playerProgress.lastPlayedSet||'set01';savePlayerProgress();localStorage.setItem('trusslab-tutorial-complete','1')}
function setMainCompletion(setId){const main=mainLevelsForSet(setId);return {done:main.filter(l=>levelProgressFor(l.id).completed).length,total:main.length,stars:main.reduce((s,l)=>s+(levelProgressFor(l.id).stars||0),0),maxStars:main.length*3}}
function setBonusCompletion(setId){const bonus=bonusLevelsForSet(setId);return {done:bonus.filter(l=>levelProgressFor(l.id).completed).length,total:bonus.length,badges:bonus.filter(l=>levelProgressFor(l.id).completed).length}}
function campaignStats(campaignId){const sets=gameSets.filter(s=>s.campaignId===campaignId),main=sets.flatMap(s=>mainLevelsForSet(s.id)),bonus=sets.flatMap(s=>bonusLevelsForSet(s.id));return {mainDone:main.filter(l=>levelProgressFor(l.id).completed).length,mainTotal:main.length,bonusDone:bonus.filter(l=>levelProgressFor(l.id).completed).length,bonusTotal:bonus.length,stars:main.reduce((s,l)=>s+(levelProgressFor(l.id).stars||0),0),maxStars:main.length*3}}
function fullProgramComplete(){return allMainLevels().every(l=>levelProgressFor(l.id).completed)&&allBonusLevels().every(l=>levelProgressFor(l.id).completed)&&playerProgress.totalStars>=108}
recomputeProgressUnlocks();

let currentGameScreen=GAME_SCREEN.BOOT,previousGameScreen=null,selectedSetId=playerProgress.lastPlayedSet||'set01',selectedLevelId=playerProgress.lastPlayedLevel||null,currentCampaignLevelId=null;
let educationReturnScreen=GAME_SCREEN.MAIN_MENU,sandboxReturnScreen=GAME_SCREEN.MAIN_MENU;
const FLOW_SCREEN_IDS=['welcomeScreen','mainMenuScreen','setSelectScreen','levelSelectScreen','briefingScreen','trainingCompleteScreen','recordsScreen','flowSettingsScreen','programCompleteScreen','devAuthScreen','devConsoleScreen','devPreviewScreen'];
function gameplayInputEnabled(){return currentGameScreen===GAME_SCREEN.GAME&&$('#loadingScreen')?.hidden!==false&&$('#educationScreen')?.hidden!==false&&!ui.result?.classList.contains('show')}
function hideFlowScreens(){for(const id of FLOW_SCREEN_IDS){const el=$('#'+id);if(el)el.hidden=true}}
function changeGameScreen(screenName,{resumeClock=false}={}){
  if(!Object.values(GAME_SCREEN).includes(screenName))return;
  const from=currentGameScreen;previousGameScreen=from;currentGameScreen=screenName;document.body.dataset.gameScreen=screenName;
  if(from===GAME_SCREEN.GAME&&screenName!==GAME_SCREEN.GAME&&screenName!==GAME_SCREEN.RESULT&&screenName!==GAME_SCREEN.SANDBOX_SETUP&&stageClock?.running)pauseStageClock(false);
  hideFlowScreens();
  $('#titleScreen').hidden=true;$('#creditScreen').hidden=true;
  if(screenName!==GAME_SCREEN.EDUCATION)$('#educationScreen').hidden=true;
  if(screenName!==GAME_SCREEN.RESULT)ui.result?.classList.remove('show');
  if(screenName!==GAME_SCREEN.SANDBOX_SETUP)ui.sandbox?.classList.remove('show');
  const app=$('#app'),appVisible=[GAME_SCREEN.GAME,GAME_SCREEN.RESULT,GAME_SCREEN.SANDBOX_SETUP].includes(screenName);
  if(app)app.style.visibility=appVisible?'visible':'hidden';
  const show=id=>{const el=$(id);if(el)el.hidden=false};
  if(screenName===GAME_SCREEN.TITLE){show('#titleScreen');updateTitleForProgress()}
  else if(screenName===GAME_SCREEN.WELCOME)show('#welcomeScreen');
  else if(screenName===GAME_SCREEN.CREDIT)show('#creditScreen');
  else if(screenName===GAME_SCREEN.MAIN_MENU){renderMainMenu();show('#mainMenuScreen')}
  else if(screenName===GAME_SCREEN.SET_SELECT){renderSetSelect();show('#setSelectScreen')}
  else if(screenName===GAME_SCREEN.LEVEL_SELECT){renderLevelSelect(selectedSetId);show('#levelSelectScreen')}
  else if(screenName===GAME_SCREEN.BRIEFING){renderBriefing(selectedLevelId);show('#briefingScreen')}
  else if(screenName===GAME_SCREEN.TRAINING_COMPLETE){renderTrainingComplete();show('#trainingCompleteScreen')}
  else if(screenName===GAME_SCREEN.RECORDS){renderRecords();show('#recordsScreen')}
  else if(screenName===GAME_SCREEN.PROGRAM_COMPLETE){renderProgramCompletion();show('#programCompleteScreen')}
  else if(screenName===GAME_SCREEN.SETTINGS){renderFlowSettings();show('#flowSettingsScreen')}
  else if(screenName===GAME_SCREEN.DEV_AUTH){renderDevAuthScreen();show('#devAuthScreen')}
  else if(screenName===GAME_SCREEN.DEV_CONSOLE){if(!devSessionActive()){openDeveloperMode(from);return}renderDevConsole();show('#devConsoleScreen')}
  else if(screenName===GAME_SCREEN.DEV_PREVIEW){if(!devSessionActive()){openDeveloperMode(from);return}renderDevPreviewScreen();show('#devPreviewScreen')}
  else if(screenName===GAME_SCREEN.GAME){requestAnimationFrame(()=>{resize();if(resumeClock&&!tutorialMode&&!stage?.sandbox&&!sim&&stageClock.finalMs===null)resumeStageClock()})}
  updateDeveloperEntryUI();updateDevPresenceBadge();
  if(screenName!==GAME_SCREEN.GAME && screenName!==GAME_SCREEN.RESULT && screenName!==GAME_SCREEN.DEV_CONSOLE){
    requestAnimationFrame(()=>{
      const visibleFlow=[...document.querySelectorAll('.gameFlowScreen')].find(el=>!el.hidden);
      const root=visibleFlow || (screenName===GAME_SCREEN.TITLE?$('#titleScreen'):screenName===GAME_SCREEN.CREDIT?$('#creditScreen'):null);
      const target=root?.querySelector('[data-screen-autofocus], .flowBtn.primary, .primaryBtn, button:not([disabled])');
      target?.focus({preventScroll:true});
    });
  }
}
function updateTitleForProgress(){const b=$('#titleStartBtn');if(b)b.textContent=playerProgress.tutorialCompleted?'▶ TRUSS LAB 입장':'▶ 시뮬레이션 시작'}
function levelThumbSVG(level){
  const g='<path class="grid" d="M0 18H320M0 36H320M0 54H320M40 0V72M80 0V72M120 0V72M160 0V72M200 0V72M240 0V72M280 0V72"/>';
  if(level.thumbnail.type==='navigation')return `<svg viewBox="0 0 320 72">${g}<rect class="clearance" x="122" y="28" width="76" height="38"/><path class="deck" d="M12 25L90 20L130 13M190 13L230 20L308 25"/><path class="truss" d="M12 25L60 4L90 20L118 2M202 2L230 20L260 4L308 25"/></svg>`;
  if(level.thumbnail.type==='cable')return `<svg viewBox="0 0 320 72">${g}<path class="deck" d="M10 55H310"/><path class="truss" d="M95 60V8M225 60V8"/><path class="cable" d="M95 10L20 55M95 10L80 55M95 10L145 55M225 10L175 55M225 10L240 55M225 10L300 55"/></svg>`;
  if(level.thumbnail.type==='truss-slope')return `<svg viewBox="0 0 320 72">${g}<path class="deck" d="M10 25L310 57"/><path class="truss" d="M10 25L62 4L112 36L162 15L212 47L262 26L310 57M62 4L162 15L262 26"/></svg>`;
  return `<svg viewBox="0 0 320 72">${g}<path class="deck" d="M10 55H310"/><path class="truss" d="M10 55L60 12L110 55L160 12L210 55L260 12L310 55M60 12H160H260"/></svg>`;
}
function campaignCompletion(){const total=allMainLevels().length,done=allMainLevels().filter(l=>levelProgressFor(l.id).completed).length;return total?Math.round(done/total*100):0}
function renderMainMenu(){
  recomputeProgressUnlocks();const levels=allMainLevels(),completed=levels.filter(l=>levelProgressFor(l.id).completed).length;
  let cont=getGameLevel(playerProgress.lastPlayedLevel);if(!cont||!isLevelUnlocked(cont.id))cont=levels.find(l=>isLevelUnlocked(l.id))||levels[0];
  const campaign=getCampaign(cont.campaignId),set=getGameSet(cont.setId);
  $('#continueTitle').textContent=`이어하기 // ${cont.type==='bonus'?'보너스':'계약'} ${displayContractId(cont)}`;
  $('#continueLevel').textContent=`세트 ${String(set?.number||1).padStart(2,'0')} // ${cont.title}`;
  $('#continueStars').textContent=`${playerProgress.totalStars} ★`;$('#continueClears').textContent=`${completed} / 36`;
  const completion=campaignCompletion();$('#campaignPercent').innerHTML=`${completion}<span>%</span>`;$('#campaignProgress').value=completion;$('#campaignProgress').textContent=completion+'%';$('#campaignSets').textContent=String(playerProgress.unlockedSets.length);$('#campaignStars').textContent=`${playerProgress.totalStars} / 108`;$('#campaignTraining').textContent=playerProgress.tutorialCompleted?'완료':'필수';$('#mainMenuDifficulty').textContent=DIFFICULTY[difficultyMode].label;
  const profile=$('#mainMenuProfileLabel');if(profile)profile.textContent=`${campaign?.title||'기초 구조'} // 배지 ${playerProgress.badges.length}/12`;
  const edu=$('#menuEducationBtn');if(edu){edu.disabled=!educationUnlocked();edu.title=edu.disabled?'레벨을 하나 이상 클리어하면 열립니다':'';edu.querySelector('.menuCardDescription').textContent=edu.disabled?'계약을 하나 완료하면 학습 센터가 열립니다.':'트러스와 하중 전달의 원리를 배워보세요.'}
  $('#continueBtn').onclick=()=>openLevelBriefing(cont.id);
}
function renderSetSelect(){
  const main=allMainLevels(),completed=main.filter(level=>levelProgressFor(level.id).completed).length;
  $('#setSelectionProgress').textContent=`메인 ${completed} / ${main.length} 완료`;
  $('#setSelectionMeter').max=main.length;$('#setSelectionMeter').value=completed;
  $('#setSelectStars').textContent=`별 ${playerProgress.totalStars} / ${main.length*3} · 배지 ${playerProgress.badges.length} / ${allBonusLevels().length}`;
  const icon=path=>`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${path}"/></svg>`;
  const setIcons=[
    'M4 26h24L16 6 4 26Zm6-10h12M10 26l6-10 6 10',
    'M4 24h24M7 24V12m9 12V7m9 17V12M4 7l3 5 3-5m3-5 3 5 3-5m3 5 3 5 3-5',
    'M3 22h8l5-10 5 10h8M3 27h26M9 7h14m-14-3v6m14-6v6',
    'M3 22V10h16v12H3Zm16-8h6l4 5v3H19M7 22v3m18-3v3M7 10v8m5-8v8',
    'M3 25h26M10 25V6m12 19V6M3 25 10 9l6 16 6-16 7 16',
    'M4 26h24M4 22 10 8l6 14 6-14 6 14M10 8h12M16 4v4M4 12h4m16 0h4'
  ];
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  const tile=set=>{
    const unlocked=isSetUnlocked(set.id),m=setMainCompletion(set.id),b=setBonusCompletion(set.id),complete=m.done===m.total;
    const current=unlocked&&playerProgress.lastPlayedSet===set.id;
    const status=complete?'메인 완료':!unlocked?'잠김':m.done?'진행 중':'도전 가능';
    const statusPath=complete?'m5 12 4 4L19 6':unlocked?'m9 5 8 7-8 7V5Z':'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4';
    const prerequisite=getGameLevel(set.unlockRequirement);
    const hint=!unlocked?(prerequisite?`세트 ${String(getGameSet(prerequisite.setId).number).padStart(2,'0')} · 계약 ${displayContractId(prerequisite)} ‘${prerequisite.title}’ 완료 후 해금`:'기초 조작 훈련 완료 후 해금'):current?'마지막으로 선택한 세트입니다. 계약 지도로 이어가세요.':'계약 지도에서 목표와 조건을 확인하세요.';
    return `<article class="setTile ${unlocked?'available':'locked'} ${complete?'complete':''} ${current?'current':''}"><header class="setTileTop"><span class="setTileIcon">${icon(setIcons[set.number-1])}</span><div><span>SET ${String(set.number).padStart(2,'0')} / ${devEsc(set.environment)}</span><h3>${devEsc(set.title)}</h3></div><span class="setTileState"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${statusPath}"/></svg>${status}</span></header>
      <p class="setTileDescription">${devEsc(set.description)}</p>
      <div class="setTileProgress"><span>메인 계약</span><b>${m.done} / ${m.total} 완료</b><progress value="${m.done}" max="${m.total}" aria-label="${devEsc(set.title)} 메인 계약 완료 진행도"></progress></div>
      <dl class="setTileStats"><div><dt>보너스 실험</dt><dd>${b.done}<span> / ${b.total}</span></dd></div><div><dt>획득 별</dt><dd>${m.stars}<span> / ${m.maxStars}</span></dd></div><div><dt>획득 배지</dt><dd>${b.badges}<span> / ${b.total}</span></dd></div></dl>
      <div class="setTileBottom"><p>${current?'<span class="setRecent">최근 선택</span>':''}${devEsc(hint)}</p><button class="setTileOpen setOpenBtn" data-set-id="${set.id}" ${unlocked?'':'disabled'} aria-label="${devEsc(set.title)} ${unlocked?'계약 지도 열기':'잠긴 세트'}">${unlocked?'계약 지도 열기':'잠긴 세트'}${arrow}</button></div></article>`;
  };
  $('#setGrid').innerHTML=CAMPAIGNS.map(campaign=>{
    const sets=gameSets.filter(set=>set.campaignId===campaign.id),stats=campaignStats(campaign.id);
    return `<section class="setChapter" aria-labelledby="setChapterTitle${campaign.number}"><header class="setChapterHead"><span class="setChapterNumber" aria-hidden="true">${String(campaign.number).padStart(2,'0')}</span><div><span>CAMPAIGN ${String(campaign.number).padStart(2,'0')}</span><h2 id="setChapterTitle${campaign.number}">${campaign.title}</h2></div><b>메인 ${stats.mainDone} / ${stats.mainTotal} 완료</b></header><div class="setTiles">${sets.map(tile).join('')}</div></section>`;
  }).join('');
  $$('.setOpenBtn').forEach(button=>button.onclick=()=>openLevelSelect(button.dataset.setId));
}
function openLevelSelect(setId='set01'){if(!isSetUnlocked(setId)){toast('세트가 잠겨 있습니다');return}selectedSetId=setId;playerProgress.lastPlayedSet=setId;savePlayerProgress();changeGameScreen(GAME_SCREEN.LEVEL_SELECT)}
function renderLevelSelect(setId){
  const set=getGameSet(setId)||gameSets[0],campaign=getCampaign(set.campaignId);
  selectedSetId=set.id;
  $('#levelSetKicker').textContent=`캠페인 ${campaign?.number||1} · ${campaign?.title||''} / 세트 ${String(set.number).padStart(2,'0')}`;
  $('#contractBreadcrumbCurrent').textContent=`세트 ${String(set.number).padStart(2,'0')} · 계약 선택`;
  $('#levelSetTitle').textContent=set.title;
  $('#levelSetDescription').textContent=`${set.environment} · ${set.description}`;
  const main=mainLevelsForSet(set.id),bonus=bonusLevelsForSet(set.id),m=setMainCompletion(set.id),b=setBonusCompletion(set.id);
  $('#levelSetProgress').textContent=`메인 ${m.done} / ${m.total} 완료`;
  $('#levelSetMeter').max=m.total;$('#levelSetMeter').value=m.done;
  $('#levelSetStars').textContent=`별 ${m.stars} / ${m.maxStars} · 보너스 ${b.done} / ${b.total} 완료`;
  const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  const arrow=icon('M4 12h16m-6-6 6 6-6 6');
  const card=level=>{
    const unlocked=isLevelUnlocked(level.id),prog=levelProgressFor(level.id),isBonus=level.type==='bonus',runtime=runtimeStageForLevel(level,{difficulty:false});
    const current=unlocked&&!prog.completed&&playerProgress.lastPlayedLevel===level.id;
    const state=prog.completed?'complete':unlocked?'available':'locked';
    const status=prog.completed?(isBonus?'완료':prog.stars>=3?'완전 달성':'완료'):current?'진행 중':unlocked?'도전 가능':'잠김';
    const statusIcon=icon(prog.completed?'m5 12 4 4L19 6':unlocked?'m9 5 8 7-8 7V5Z':'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4');
    const requirement=level.unlockRequirement;
    const prerequisite=getGameLevel(typeof requirement==='string'?requirement:requirement?.complete||requirement?.level);
    const lockedHint=prerequisite?`${prerequisite.type==='bonus'?'보너스':'계약'} ${displayContractId(prerequisite)} ‘${prerequisite.title}’ 완료 후 해금`:requirement==='tutorial-complete'?'기초 조작 훈련 완료 후 해금':'세트 해금 조건을 완료하세요.';
    return `<article class="contractCard ${state} ${isBonus?'bonus':''} ${current?'current':''}">
      <header class="contractCardTop"><span>${isBonus?'보너스 B'+String(level.bonusNumber).padStart(2,'0'):'계약 '+String(level.globalNumber).padStart(2,'0')}</span><span class="contractState">${statusIcon}${status}</span></header>
      <h3>${devEsc(level.title)}</h3><p class="contractSubtitle">${devEsc(level.subtitle)}</p>
      <div class="contractPreview" aria-hidden="true">${levelThumbSVG(level)}</div>
      <dl class="contractSpecs"><div><dt>차량</dt><dd>${koVehicleLabel(runtime.vehicleLabel||runtime.vehicle)}</dd></div><div><dt>기본 예산</dt><dd>₩${level.budget.toLocaleString()}</dd></div><div><dt>핵심 개념</dt><dd>${devEsc(level.concept)}</dd></div><div><dt>${isBonus?'획득 배지':'획득 별'}</dt><dd>${isBonus?(prog.completed?'1 / 1':'0 / 1'):`${prog.stars||0} / 3`}</dd></div></dl>
      <div class="contractCardBottom">${unlocked?`<p>${prog.completed?'완료한 계약입니다. 설계를 더 개선해 보세요.':current?'마지막으로 선택한 계약입니다.':'목표와 조건을 확인하고 설계를 시작하세요.'}</p><button class="contractOpen levelOpenBtn" data-level-id="${level.id}" aria-label="${devEsc(level.title)} ${prog.completed?'다시 도전':'브리핑 보기'}">${prog.completed?'다시 도전':'브리핑 보기'}${arrow}</button>`:`<p class="contractUnlockHint">${devEsc(lockedHint)}</p><button class="contractOpen levelOpenBtn" data-level-id="${level.id}" disabled>${statusIcon}잠긴 계약</button>`}</div>
    </article>`;
  };
  $('#levelGrid').innerHTML=`<section class="contractSection" aria-labelledby="contractMainHeading"><header class="contractSectionHead"><div><span>01 / MAIN CONTRACTS</span><h2 id="contractMainHeading">메인 계약 <small>${main.length}개 필수</small></h2></div><b>${m.done} / ${m.total} 완료</b></header><div class="contractCards">${main.map(card).join('')}</div></section><section class="contractSection bonus" aria-labelledby="contractBonusHeading"><header class="contractSectionHead"><div><span>02 / OPTIONAL EXPERIMENTS</span><h2 id="contractBonusHeading">보너스 실험 <small>${bonus.length}개 선택</small></h2></div><b>${b.done} / ${b.total} 완료</b></header><div class="contractCards">${bonus.map(card).join('')}</div></section>`;
  $$('.levelOpenBtn').forEach(button=>button.onclick=()=>openLevelBriefing(button.dataset.levelId));
}
function openLevelBriefing(levelId){const level=getGameLevel(levelId);if(!level||!isLevelUnlocked(level.id)){toast(level?.type==='bonus'?'보너스 계약이 잠겨 있습니다':'계약이 잠겨 있습니다');return}selectedLevelId=level.id;selectedSetId=level.setId;playerProgress.lastPlayedSet=level.setId;playerProgress.lastPlayedLevel=level.id;savePlayerProgress();changeGameScreen(GAME_SCREEN.BRIEFING)}
function renderBriefing(levelId){
  const level=getGameLevel(levelId);if(!level)return;
  const set=getGameSet(level.setId),campaign=getCampaign(set.campaignId),runtime=runtimeStageForLevel(level),prog=levelProgressFor(level.id),bonus=level.type==='bonus';
  const contractLabel=`${bonus?'보너스':'계약'} ${displayContractId(level)}`;
  $('#briefingKicker').textContent=`캠페인 ${campaign?.number||1} · 세트 ${String(set.number).padStart(2,'0')} / ${contractLabel}`;
  $('#briefingContractsCrumb').textContent=set.title;
  $('#briefingCurrentCrumb').textContent=`${contractLabel} · 브리핑`;
  $('#briefingTitle').textContent=level.title;
  $('#briefingSubtitle').textContent=level.subtitle;
  $('#briefingStatus').textContent=prog.completed?'완료한 계약 · 다시 도전':bonus?'보너스 실험 준비':'미션 준비 완료';
  $('#briefingDifficulty').textContent=`${difficultyMode==='easy'?'쉬움':'어려움'} 난이도`;
  $('#briefingConcept').textContent=`핵심 개념 · ${level.concept}`;
  $('#briefingObjective').textContent=level.objective;
  const conditions=[['지형',set.environment],['사용 가능 재료',level.materials.map(material=>koMaterialLabel(material)).join(' · ')],...level.constraints.map(condition=>['설계 조건',condition])];
  $('#briefingConstraints').innerHTML=conditions.map(([label,description])=>`<li><b>${devEsc(label)}</b><span>${devEsc(description)}</span></li>`).join('');
  $('#briefingSecondary').innerHTML=level.secondaryObjectives.map(objective=>`<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>${koGameplayLabel(objective)}</li>`).join('');
  $('#briefingThumb').innerHTML=levelThumbSVG(level);
  const specs=[['유형',bonus?'보너스 실험':'메인 계약'],['차량',koVehicleLabel(runtime.vehicleLabel||runtime.vehicle)],['차량 하중',`${Math.round(runtime.load/1000)} kN`],['적용 예산',`₩${runtime.budget.toLocaleString()}`],['사용성 한계',`${runtime.maxDefl.toFixed(1)} u`],['날씨',koWeatherLabel(level.weather)],['바람',runtime.wind?`${Math.round(Math.abs(runtime.wind)/1000)} kN ${runtime.wind>0?'→':'←'}`:'없음'],['최고 기록',prog.completed?(bonus?koBadgeLabel(level.badge):`${prog.stars} / 3 별`):'아직 기록 없음']];
  $('#briefingSpec').innerHTML=specs.map(([label,description])=>`<div><dt>${devEsc(label)}</dt><dd>${devEsc(description)}</dd></div>`).join('');
}
let currentLevelStageOverride=null;
function startSelectedCampaignLevel(){
  const level=getGameLevel(selectedLevelId);if(!level)return;currentCampaignLevelId=level.id;playerProgress.lastPlayedLevel=level.id;playerProgress.lastPlayedSet=level.setId;savePlayerProgress();currentLevelStageOverride=runtimeStageForLevel(level);const runtime=currentLevelStageOverride;if($('#app'))$('#app').style.visibility='hidden';
  runLoadingSequence({title:`${level.type==='bonus'?'보너스':'계약'} ${displayContractId(level)} 불러오는 중`,statuses:['[01] 지형 구성','[02] 설계 조건','[03] 차량 / 차축 설정','[04] 해석 설정','[05] 설계 모드 준비'],duration:1050,hint:level.title},()=>{resetStage(level.stageIndex);resetCamera();changeGameScreen(GAME_SCREEN.GAME,{resumeClock:true});showStageFlash(`${runtime.name} // ${difficultyMode==='easy'?'쉬움':'어려움'}`,runtime.title)})
}
function currentCampaignLevel(){return getGameLevel(currentCampaignLevelId)||null}
function nextCampaignLevel(level=currentCampaignLevel()){
  if(!level||level.type==='bonus')return null;const mains=allMainLevels().slice().sort((a,b)=>a.globalNumber-b.globalNumber),i=mains.findIndex(l=>l.id===level.id);return i>=0?mains[i+1]||null:null;
}
function resultConditionMet(condition,s){
  const target=String(condition||'').toUpperCase();
  if(!target||target==='CONTRACT CLEAR')return true;
  if(target.includes('WITHIN BASE BUDGET')||target.includes('UNDER BUDGET')||target.includes('UNDER TARGET COST'))return totalCost<=stage.budget;
  if(target.includes('ZERO FAILURE')||target.includes('ZERO FRACTURE')||target.includes('ZERO CASCADE'))return (s.brokenCount||0)===0;
  if(target.includes('UTILIZATION')){const m=target.match(/(\d+)/);return (s.maxRatio||0)*100<Number(m?.[1]||90)}
  if(target.includes('DECK DEFLECTION'))return (s.maxDeckDefl||s.maxDefl||0)<=stage.maxDefl*.65;
  if(target.includes('SERVICEABILITY'))return (s.maxDefl||0)<=stage.maxDefl;
  if(target.includes('NO BUCKLING'))return !(s.failureEvents||[]).some(ev=>ev.governing==='buckling');
  if(target.includes('ALTERNATE LOAD PATH')||target.includes('HIGH REDUNDANCY')){const r=coachRedundancyDiagnostic(s.last||lastFullAnalysis);return !!r?.alternate&&(r.alternateMax??Infinity)<=1.15}
  if(target.includes('VESSEL'))return !!s.vesselPass&&!s.vesselCollision;
  if(target.includes('MEMBERS')){const m=target.match(/(\d+)/);return members.filter(x=>x.user).length<=Number(m?.[1]||Infinity)}
  return (s.maxDefl||0)<=stage.maxDefl*.75;
}
function evaluateLevelStars(level,s,success){
  if(!success||level?.type!=='main')return 0;
  const conditions=(level.starConditions?.length===3?level.starConditions:['CONTRACT CLEAR','WITHIN BASE BUDGET',level.secondaryObjectives?.[0]||'SERVICEABILITY PASS']);
  return conditions.reduce((count,condition,i)=>count+(i===0?1:(resultConditionMet(condition,s)?1:0)),0);
}
function recordCampaignResult(success,s,score,starCount,stageTimeMs){
  const level=currentCampaignLevel();if(!level||stage?.sandbox)return;const prev=levelProgressFor(level.id),attempts=(prev.attempts||0)+1,next={...prev,attempts,lastPlayedAt:Date.now()};
  playerProgress.stats.testsPerformed=(playerProgress.stats.testsPerformed||0)+1;
  playerProgress.stats.designIterations=(playerProgress.stats.designIterations||0)+1;
  if(success){
    next.completed=true;const awarded=level.type==='main'?evaluateLevelStars(level,s,true):0;next.stars=Math.max(prev.stars||0,awarded);next.bestScore=Math.max(prev.bestScore||0,score);next.bestGrade=score>=88?'S':score>=78?'A':score>=65?'B':'C';
    if(stageTimeMs!=null)next.bestTimeMs=!prev.bestTimeMs?Math.round(stageTimeMs):Math.min(prev.bestTimeMs,Math.round(stageTimeMs));next.bestCost=prev.bestCost==null?totalCost:Math.min(prev.bestCost,totalCost);next.bestDeflection=prev.bestDeflection==null?(s.maxDefl||0):Math.min(prev.bestDeflection,s.maxDefl||0);
    if((s.brokenCount||0)===0)playerProgress.stats.zeroFractureClears=(playerProgress.stats.zeroFractureClears||0)+1;playerProgress.stats.lowestCost=playerProgress.stats.lowestCost==null?totalCost:Math.min(playerProgress.stats.lowestCost,totalCost);
    const redundancy=coachRedundancyDiagnostic(s.last||lastFullAnalysis);if(redundancy?.alternate){const index=Math.round(clamp(100/Math.max(1,redundancy.amplification||1),0,100));playerProgress.stats.highestRedundancy=Math.max(playerProgress.stats.highestRedundancy||0,index)}
  }
  playerProgress.levelProgress[level.id]=next;playerProgress.lastPlayedLevel=level.id;playerProgress.lastPlayedSet=level.setId;savePlayerProgress();
}
function renderTrainingComplete(){markTutorialComplete();$('#trainingSetBtn').onclick=()=>openLevelSelect('set01')}
function renderRecords(){
  recomputeProgressUnlocks();$('#recordsStars').textContent=`${playerProgress.totalStars} / 108 ★ · 배지 ${playerProgress.badges.length} / 12`;
  const mainDone=allMainLevels().filter(l=>levelProgressFor(l.id).completed).length,bonusDone=allBonusLevels().filter(l=>levelProgressFor(l.id).completed).length;
  const rows=allGameLevels().map(level=>{const set=getGameSet(level.setId),p=levelProgressFor(level.id),bonus=level.type==='bonus';return `<tr><td>${bonus?'B'+String(level.bonusNumber).padStart(2,'0'):String(level.globalNumber).padStart(2,'0')}</td><td>SET ${String(set.number).padStart(2,'0')}</td><td>${devEsc(level.title)}</td><td>${p.completed?'클리어':'—'}</td><td class="recordStars">${bonus?(p.completed?'배지':'—'):`${p.stars||0} ★`}</td><td>${p.bestTimeMs?formatStageTime(p.bestTimeMs):'—'}</td><td>${p.bestCost!=null?'₩'+Math.round(p.bestCost).toLocaleString():'—'}</td><td>${p.attempts||0}</td></tr>`}).join('');
  $('#recordsBody').innerHTML=`<div class="recordSummary"><b>메인 ${mainDone}/36</b><b>보너스 ${bonusDone}/12</b><b>별 ${playerProgress.totalStars}/108</b><b>배지 ${playerProgress.badges.length}/12</b><b>시험 ${playerProgress.stats.testsPerformed||0}</b><b>설계 반복 ${playerProgress.stats.designIterations||0}</b><b>무파단 클리어 ${playerProgress.stats.zeroFractureClears||0}</b><b>최저 비용 ${playerProgress.stats.lowestCost==null?'—':'₩'+Math.round(playerProgress.stats.lowestCost).toLocaleString()}</b><b>여유도 지수 ${playerProgress.stats.highestRedundancy||0}</b></div><table class="recordTable"><thead><tr><th>식별자</th><th>세트</th><th>계약</th><th>상태</th><th>보상</th><th>최고 시간</th><th>최저 비용</th><th>시도</th></tr></thead><tbody>${rows}</tbody></table>`
}
function renderProgramCompletion(){
  recomputeProgressUnlocks();const full=fullProgramComplete(),mainDone=allMainLevels().filter(l=>levelProgressFor(l.id).completed).length,bonusDone=allBonusLevels().filter(l=>levelProgressFor(l.id).completed).length;
  $('#programCompleteTitle').textContent=full?'전체 과정 완료':'메인 캠페인 완료';
  $('#programCompleteSubtitle').textContent=full?'48 / 48 계약 · 모든 구조공학 도전 완료':`${mainDone} / 36 메인 계약 완료`;
  $('#programCompleteStamp').textContent=full?'전체 과정 인증':'메인 과정 인증';
  $('#programCertificateTitle').textContent=full?'구조 실험실 // 전체 과정 인증':'구조공학 과정';
  $('#programCertificateState').textContent=full?'48개 계약 완료':'36개 메인 계약 완료';
  $('#programCompleteStats').innerHTML=`<div><span>메인 계약</span><b>${mainDone} / 36</b></div><div><span>보너스 계약</span><b>${bonusDone} / 12</b></div><div><span>메인 별</span><b>${playerProgress.totalStars} / 108</b></div><div><span>설계 배지</span><b>${playerProgress.badges.length} / 12</b></div>`;
  $('#programBonusBtn').hidden=full;$('#programBonusBtn').textContent='보너스 계약 계속하기 →';
}

function renderFlowSettings(){
  $$('.flowDifficultyBtn').forEach(b=>{const selected=b.dataset.flowDifficulty===difficultyMode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});
  $$('.flowUIModeBtn').forEach(b=>{const selected=b.dataset.flowUi===uiMode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});
  applyAccessibilitySettings();
}
function openSandboxSetup(origin=currentGameScreen){sandboxReturnScreen=origin===GAME_SCREEN.SANDBOX_SETUP?GAME_SCREEN.MAIN_MENU:origin;currentGameScreen=GAME_SCREEN.SANDBOX_SETUP;document.body.dataset.gameScreen=GAME_SCREEN.SANDBOX_SETUP;hideFlowScreens();$('#titleScreen').hidden=true;if($('#app'))$('#app').style.visibility='visible';if(sim)stopSimulation();pauseStageClock(false);localAiSetOpen(false);syncSandboxSetup();ui.sandbox.classList.add('show');$('#sandboxModal .sandboxWorkspace').scrollTop=0}
function closeSandboxSetup(){ui.sandbox.classList.remove('show');changeGameScreen(sandboxReturnScreen||GAME_SCREEN.MAIN_MENU,{resumeClock:sandboxReturnScreen===GAME_SCREEN.GAME})}


/* ==========================================================================\n   DEV AUTH\n   Static-file note: this prevents casual/accidental access. It is not a\n   security boundary against a user who can inspect or modify client code.\n   ========================================================================== */
const DEV_AUTH_CONFIG=Object.freeze({
	version:1,
	algorithm:'PBKDF2-SHA256',
	iterations:120000,
	salt:'jZbNmcgmnvdK/P5dQRWBMw==',
	verifier:'6iB0A+p+H/ijcBOJ2WY4kAlnmMR3Q3UQuh5VBf3wN2c='
});
const DEV_SESSION_KEY='trusslab-dev-session-v1';
function devBase64Bytes(value){const raw=atob(value),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
function devConstantTimeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
async function verifyDeveloperCredential(secret){
	if(!window.crypto?.subtle)return false;
	const input=new TextEncoder().encode(secret);
	const baseKey=await crypto.subtle.importKey('raw',input,{name:'PBKDF2'},false,['deriveBits']);
	const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:devBase64Bytes(DEV_AUTH_CONFIG.salt),iterations:DEV_AUTH_CONFIG.iterations,hash:'SHA-256'},baseKey,256);
	return devConstantTimeEqual(new Uint8Array(bits),devBase64Bytes(DEV_AUTH_CONFIG.verifier));
}
function devReadSession(){try{return sessionStorage.getItem(DEV_SESSION_KEY)==='active:v1'}catch(_){return false}}
function devWriteSession(active){try{if(active)sessionStorage.setItem(DEV_SESSION_KEY,'active:v1');else sessionStorage.removeItem(DEV_SESSION_KEY)}catch(_){}}

/* ==========================================================================\n   DEV STATE\n   ========================================================================== */
const DEV_STATE={
	authenticated:devReadSession(),
	returnScreen:GAME_SCREEN.MAIN_MENU,
	activeSection:'overview',
	previewKind:'success',
	fps:0,
	fpsFrames:0,
	fpsSampleAt:performance.now(),
	debugOverlay:false,
	quickMenu:false,
	nextAuthAt:0,
	sessionStartedAt:null,
	levelSearch:'',levelFilter:'ALL',selectedLevelId:null,
	selectedMaterial:'wood',selectedVehicle:'CAR',
	geometryMode:false,geometryTool:'select',geometrySelection:null,geometryDrag:null,
	solverFlags:{nodeIds:false,memberIds:false,lengths:false,force:false,utilization:false,reactions:false,loadVector:false,original:false,deformed:false},
	nodeForces:new Map(),disabledMembers:new Set(),simPaused:false,simPauseStarted:0,vehicleFrozen:false
};

/* ==========================================================================
   DEV RUNTIME OVERRIDES // STEP 2
   Runtime editors mutate in-memory game data only. Source defaults are kept in
   immutable snapshots so every editor can reset safely. Material presets are
   the only developer editor data optionally written to localStorage.
   ========================================================================== */
const DEV_MATERIAL_PRESET_KEY='trusslab-dev-material-presets-v1';
function devDeepClone(v){
	if(Array.isArray(v))return v.map(devDeepClone);
	if(v&&typeof v==='object'){const out={};for(const [k,x] of Object.entries(v))out[k]=devDeepClone(x);return out}
	return v;
}
const DEV_PHYSICS_TUNING={
	gravity:760,airDrag:.996,substeps:5,constraintIterations:12,
	roadBendingNormal:.095,roadBendingHeavy:.22,cableSegmentLength:34,
	cableTensionLimit:.13,cableDamping:.045,collisionPush:.88
};
const DEV_PHYSICS_LIMITS={
	gravity:[100,1800],airDrag:[.90,1],substeps:[1,16],constraintIterations:[1,40],
	roadBendingNormal:[0,.6],roadBendingHeavy:[0,.9],cableSegmentLength:[12,80],
	cableTensionLimit:[.01,.4],cableDamping:[0,.25],collisionPush:[.2,1]
};
const DEV_VEHICLE_PROFILES={
	'CAR':{base:'CAR',loadOverride:null,speed:82,length:62,axles:[[-18,.5],[18,.5]],useAxleOverride:false,renderScale:1},
	'BUS':{base:'BUS',loadOverride:null,speed:82,length:76,axles:[[-34,.28],[0,.34],[34,.38]],useAxleOverride:false,renderScale:1},
	'TRUCK':{base:'TRUCK',loadOverride:null,speed:82,length:80,axles:[[-34,.28],[0,.34],[34,.38]],useAxleOverride:false,renderScale:1},
	'HEAVY TRUCK':{base:'TRUCK',loadOverride:null,speed:82,length:108,axles:[[-54,.18],[-18,.24],[18,.27],[54,.31]],useAxleOverride:false,renderScale:1},
	'DOUBLE TRUCK':{base:'TRUCK',loadOverride:null,speed:82,length:108,axles:[[-54,.18],[-18,.24],[18,.27],[54,.31]],useAxleOverride:false,renderScale:1}
};
try{applyProjectSettings()}catch(error){showProjectConfigError(error);return}
const DEV_DEFAULTS={levels:clonePlain(LEVEL_LIBRARY),materials:devDeepClone(MAT),physics:clonePlain(DEV_PHYSICS_TUNING),vehicles:clonePlain(DEV_VEHICLE_PROFILES),sandbox:clonePlain(stages[4])};
function devVehicleProfileFor(value){const key=String(value||'').toUpperCase();return DEV_VEHICLE_PROFILES[key]||DEV_VEHICLE_PROFILES.TRUCK}
function devVehicleProfileForStage(s){return devVehicleProfileFor(s?.vehicleLabel||s?.vehicle||'CAR')}
function devVehicleSpeed(s){return s?.sandbox&&Number.isFinite(s.vehicleSpeed)?s.vehicleSpeed:Number(devVehicleProfileForStage(s)?.speed)||82}
function devVehicleSpeedScale(s){return devVehicleSpeed(s)/82}
function devVehicleRenderScale(s){return Number(devVehicleProfileForStage(s)?.renderScale)||1}

function devSessionActive(){DEV_STATE.authenticated=devReadSession();return DEV_STATE.authenticated}
function devRequire(actionName='DEVELOPER ACTION'){
	if(devSessionActive())return true;
	DEV_STATE.returnScreen=Object.values(GAME_SCREEN).includes(currentGameScreen)?currentGameScreen:GAME_SCREEN.MAIN_MENU;
	changeGameScreen(GAME_SCREEN.DEV_AUTH);
	const status=$('#devAuthStatus');if(status){status.className='devAuthStatus error';status.textContent=`개발자 인증이 필요합니다. (${actionName})`}
	return false;
}
function devGuard(fn,actionName){return (...args)=>{if(!devRequire(actionName))return false;return fn(...args)}}
function openDeveloperMode(origin=currentGameScreen){
	if(![GAME_SCREEN.DEV_AUTH,GAME_SCREEN.DEV_CONSOLE,GAME_SCREEN.DEV_PREVIEW].includes(origin))DEV_STATE.returnScreen=origin||GAME_SCREEN.MAIN_MENU;
	changeGameScreen(devSessionActive()?GAME_SCREEN.DEV_CONSOLE:GAME_SCREEN.DEV_AUTH);
}
function lockDeveloperMode(){
	if(!devSessionActive())return false;
	devWriteSession(false);DEV_STATE.authenticated=false;DEV_STATE.debugOverlay=false;DEV_STATE.quickMenu=false;DEV_STATE.geometryMode=false;window.__trussDevUnlockAll=false;
	const q=$('#devQuickMenu'),d=$('#devDebugOverlay'),g=$('#devGeometryHud');if(q)q.hidden=true;if(d)d.hidden=true;if(g)g.hidden=true;
	updateDeveloperEntryUI();updateDevPresenceBadge();
	const target=![GAME_SCREEN.DEV_AUTH,GAME_SCREEN.DEV_CONSOLE,GAME_SCREEN.DEV_PREVIEW].includes(DEV_STATE.returnScreen)?DEV_STATE.returnScreen:GAME_SCREEN.MAIN_MENU;
	changeGameScreen(target||GAME_SCREEN.MAIN_MENU);
	return true;
}
function updateDeveloperEntryUI(){
	const active=devSessionActive();
	for(const id of ['menuDeveloperBtn','settingsDeveloperBtn']){const b=$('#'+id);if(!b)continue;b.textContent=active?'개발자 콘솔 · 세션 활성':'개발자 모드';b.classList.toggle('session',active)}
}
function updateDevPresenceBadge(){
	const b=$('#devModeBadge');if(!b)return;const devScreen=[GAME_SCREEN.DEV_AUTH,GAME_SCREEN.DEV_CONSOLE,GAME_SCREEN.DEV_PREVIEW].includes(currentGameScreen);b.hidden=!devSessionActive()||devScreen
}
function renderDevAuthScreen(){
	const form=$('#devAuthForm'),input=$('#devPasswordInput'),status=$('#devAuthStatus');if(!form||!input||!status)return;
	status.className='devAuthStatus';status.textContent='설정된 개발자 접근 코드를 입력하세요. 입력한 코드는 브라우저 저장소나 콘솔 기록에 남기지 않습니다.';input.value='';
	requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
async function submitDeveloperAuth(event){
	event?.preventDefault();const input=$('#devPasswordInput'),status=$('#devAuthStatus'),submit=$('#devAuthSubmit');if(!input||!status)return false;
	const now=performance.now();if(now<DEV_STATE.nextAuthAt)return false;
	const candidate=input.value;input.value='';submit&&(submit.disabled=true);status.className='devAuthStatus';status.textContent='접근 코드를 확인하고 있습니다.';
	let ok=false;try{ok=await verifyDeveloperCredential(candidate)}catch(_){ok=false}
	if(ok){devWriteSession(true);DEV_STATE.authenticated=true;DEV_STATE.sessionStartedAt=Date.now();status.className='devAuthStatus ok';status.textContent='인증되었습니다. 개발자 콘솔을 엽니다.';updateDeveloperEntryUI();setTimeout(()=>changeGameScreen(GAME_SCREEN.DEV_CONSOLE),120)}
	else{DEV_STATE.nextAuthAt=performance.now()+700;status.className='devAuthStatus error';status.textContent='접근 코드가 올바르지 않습니다. 다시 확인해 주세요.';setTimeout(()=>{submit&&(submit.disabled=false);input.focus({preventScroll:true})},700);return false}
	submit&&(submit.disabled=false);return true;
}

/* ==========================================================================\n   DEV CONSOLE\n   ========================================================================== */
function devLocalStorageBytes(){let text='';try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';text+=k+(localStorage.getItem(k)||'')}}catch(_){}return new TextEncoder().encode(text).byteLength}
function devSolverStatus(){if(sim)return sim.mode==='collapse'?'DYNAMIC PBD':'TEST / STATIC';if(lastFullAnalysis?.ok)return 'STATIC RESULT READY';if(currentAnalysis?.ok)return 'ANALYSIS READY';return 'IDLE'}
function devCurrentContext(){const level=currentCampaignLevel()||getGameLevel(selectedLevelId),set=level?getGameSet(level.setId):null,campaign=level?getCampaign(level.campaignId):null;return {level,set,campaign}}
const DEV_DISPLAY_LABELS={
  "ALL": "전체",
  "MAIN": "메인",
  "BONUS": "보너스",
  "LOCKED": "잠김",
  "AVAILABLE": "사용 가능",
  "COMPLETE": "완료",
  "MASTERED": "완전 완료",
  "ENABLED": "사용",
  "DISABLED": "사용 안 함",
  "PENDING": "미완료",
  "ACTIVE": "활성",
  "BROKEN": "파단",
  "IDLE": "대기 중",
  "STABLE": "안정",
  "SINGULAR / UNSTABLE": "불안정 · 해석 불가",
  "NO DATA": "해석 데이터 없음",
  "NO SOLVE DATA": "해석 데이터 없음",
  "VALID": "정상",
  "INVALID": "오류 있음",
  "BASIC": "기본",
  "ADVANCED": "고급",
  "DETAIL": "상세",
  "OFF": "꺼짐",
  "ON": "켜짐",
  "PIN": "고정 지점",
  "ROLLER": "이동 지점",
  "FREE": "자유 관절",
  "NONE": "없음",
  "MAIN-MENU": "메인 메뉴",
  "DEV-CONSOLE": "개발자 콘솔",
  "TITLE": "타이틀",
  "GAME": "게임",
  "BRIEFING": "미션 안내",
  "LEVEL-SELECT": "스테이지 선택",
  "SET-SELECT": "세트 선택",
  "RESULT": "결과 화면",
  "CAR": "승용차",
  "BUS": "버스",
  "TRUCK": "트럭",
  "HEAVY TRUCK": "대형 트럭",
  "DOUBLE TRUCK": "트럭 2대",
  "HEAVY": "대형",
  "DOUBLE": "복수",
  "WOOD": "목재",
  "STEEL": "강철",
  "CABLE": "케이블",
  "ROAD": "일반 도로",
  "ROADHEAVY": "강화 도로",
  "FLAT": "평지",
  "SLOPE": "경사",
  "SAG": "아래로 처진 형상",
  "CROWN": "위로 솟은 형상",
  "ASYMMETRIC": "비대칭",
  "LEGACY": "기존 부지",
  "WIDE": "넓은 계곡",
  "VALLEY": "계곡",
  "OBSTACLE": "장애물",
  "BLANK": "빈 구조",
  "WARREN": "워런 트러스",
  "PRATT": "프랫 트러스",
  "CABLE-STAYED": "사장교",
  "STRING": "문자열",
  "NUMBER": "숫자",
  "BOOLEAN": "참·거짓",
  "JSON": "JSON",
  "INFO": "정보",
  "WARNING": "주의",
  "ERROR": "오류",
  "SIMULATION": "시뮬레이션",
  "STORAGE": "저장소",
  "UNLOCK": "잠금 해제",
  "SOLVED": "해석 완료",
  "FAILED": "실패",
  "GRAVITY": "중력 (gravity)",
  "AIRDRAG": "공기 저항 (airDrag)",
  "SUBSTEPS": "세부 시간 단계 (substeps)",
  "CONSTRAINTITERATIONS": "제약 반복 횟수 (constraintIterations)",
  "ROADBENDINGNORMAL": "일반 도로 휨 계수",
  "ROADBENDINGHEAVY": "강화 도로 휨 계수",
  "CABLESEGMENTLENGTH": "케이블 분할 길이",
  "CABLETENSIONLIMIT": "케이블 인장 한계",
  "CABLEDAMPING": "케이블 감쇠",
  "COLLISIONPUSH": "충돌 보정 계수",
  "SHOW WORLD COORDINATES": "월드 좌표",
  "SHOW COLLISION BOUNDS": "충돌 영역",
  "SHOW NO BUILD ZONES": "건설 제한 영역",
  "SHOW CLEARANCE": "통과 여유 영역",
  "SHOW VEHICLE COLLIDER": "차량 충돌 영역",
  "SHOW VESSEL COLLIDER": "선박 충돌 영역",
  "SHOW SUPPORT CONSTRAINTS": "지지점 구속 조건",
  "SHOW NODE IDS": "관절 번호",
  "SHOW MEMBER IDS": "부재 번호",
  "SHOW LENGTHS": "부재 길이",
  "SHOW MEMBER FORCE": "부재력",
  "SHOW UTILIZATION": "부재 이용률",
  "SHOW REACTIONS": "지점 반력",
  "SHOW LOAD VECTOR": "하중 방향",
  "SHOW ORIGINAL SHAPE": "변형 전 형상",
  "SHOW DEFORMED SHAPE": "변형 후 형상",
  "LOAD LEVEL": "스테이지 불러오기",
  "UNLOCK LEVEL": "잠금 해제",
  "LOCK LEVEL": "잠그기",
  "COMPLETE LEVEL": "완료 처리",
  "INCOMPLETE LEVEL": "미완료 처리",
  "STAR 1": "별 1개",
  "STAR 2": "별 2개",
  "STAR 3": "별 3개",
  "RESET RECORD": "기록 초기화",
  "BEST TIME": "최단 시간 설정",
  "BEST COST": "최소 비용 설정",
  "BEST GRADE": "최고 등급 설정",
  "STORAGE EDIT": "저장 데이터 편집",
  "STORAGE IMPORT": "저장 데이터 가져오기",
  "CONFIG IMPORT": "개발 설정 가져오기",
  "HEAVY ": "대형"
};
function devLabel(value){return Object.hasOwn(DEV_DISPLAY_LABELS,value)?DEV_DISPLAY_LABELS[value]:value}
function devMetric(label,value,className=''){return `<div class="devMetric"><span>${label}</span><b class="${className}">${devLabel(value)}</b></div>`}
function devSectionHeader(title,copy,index='DEV'){return `<div class="devSectionHeader"><div><h1>${title}</h1><p>${copy}</p></div><div class="devSectionCode">${index}</div></div>`}
function devOverviewHTML(){
	const c=devCurrentContext(),size=(devLocalStorageBytes()/1024).toFixed(1)+' KB',level=c.level?(c.level.type==='bonus'?`B${String(c.level.bonusNumber).padStart(2,'0')}`:`${String(c.level.globalNumber).padStart(2,'0')}`):'—';
	return `${devSectionHeader('개발 현황','게임 상태와 캠페인 진행도를 확인합니다. 빠른 작업은 진행 상태에 반영되며, 화면 미리보기는 진행도를 저장하지 않습니다.','01 // 현황')}<div class="devMetricGrid" id="devOverviewMetrics">${devMetric('게임 버전','TRUSS-LAB_34')}${devMetric('저장 형식 버전',String(playerProgress.saveVersion||3))}${devMetric('현재 화면',String(currentGameScreen).toUpperCase())}${devMetric('현재 캠페인',c.campaign?`C${c.campaign.number} // ${c.campaign.title}`:'—')}${devMetric('현재 세트',c.set?`SET ${String(c.set.number).padStart(2,'0')}`:'—')}${devMetric('현재 스테이지',level)}${devMetric('전체 스테이지',String(LEVEL_LIBRARY.length))}${devMetric('관절 수',String(nodes?.length||0))}${devMetric('부재 수',String(members?.length||0))}${devMetric('현재 FPS',String(Math.round(DEV_STATE.fps)))}${devMetric('해석 상태',devSolverStatus(),sim?'warn':'')}${devMetric('브라우저 저장 용량',size)}</div><div class="devPanel"><div class="devPanelTitle"><span>빠른 작업</span><span>진행 상태에 반영되는 작업</span></div><div class="devActionGrid"><button class="flowBtn" data-dev-action="reload">스테이지 다시 불러오기</button><button class="flowBtn" data-dev-action="open-current">현재 스테이지 열기</button><button class="flowBtn amber" data-dev-action="pass">성공 처리</button><button class="flowBtn danger" data-dev-action="fail">실패 처리</button><button class="flowBtn" data-dev-action="reset">스테이지 초기화</button><button class="flowBtn" data-dev-action="result">결과 화면 미리보기</button><button class="flowBtn" data-dev-action="main-menu">메인 메뉴 열기</button><button class="flowBtn" data-dev-action="level-select">스테이지 선택 열기</button></div></div><div class="devPanel"><div class="devPanelTitle"><span>화면 바로가기</span><span>미리보기는 진행도를 변경하지 않습니다</span></div><div class="devActionGrid"><button class="flowBtn" data-dev-screen="title">타이틀</button><button class="flowBtn" data-dev-screen="main-menu">메인 메뉴</button><button class="flowBtn" data-dev-screen="set-select">세트 선택</button><button class="flowBtn" data-dev-screen="level-select">스테이지 선택</button><button class="flowBtn" data-dev-screen="briefing">미션 안내</button><button class="flowBtn" data-dev-screen="game">게임</button><button class="flowBtn" data-dev-screen="success">성공 결과</button><button class="flowBtn" data-dev-screen="failure">실패 결과</button><button class="flowBtn" data-dev-screen="set-complete">세트 완료</button><button class="flowBtn" data-dev-screen="campaign-complete">캠페인 완료</button><button class="flowBtn" data-dev-screen="sandbox">샌드박스</button><button class="flowBtn" data-dev-screen="education">학습 센터</button><button class="flowBtn" data-dev-screen="settings">설정</button><button class="flowBtn" data-dev-screen="records">기록</button></div></div><div class="devPanel"><div class="devPanelTitle"><span>테스트 화면</span><span>저장하지 않는 미리보기</span></div><div class="devActionGrid"><button class="flowBtn" data-dev-mock="success">성공 화면 보기</button><button class="flowBtn" data-dev-mock="failure">실패 화면 보기</button><button class="flowBtn" data-dev-mock="perfect">최고 성적 화면 보기</button><button class="flowBtn" data-dev-mock="set-complete">세트 완료 화면 보기</button><button class="flowBtn" data-dev-mock="campaign-complete">캠페인 완료 화면 보기</button></div></div>`;
}
/* ==========================================================================\n   DEV DATA EDITORS // STEP 2\n   ========================================================================== */
function devEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function devNum(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function devSetPath(obj,path,value){const parts=String(path).split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){const k=parts[i];if(!cur[k]||typeof cur[k]!=='object')cur[k]={};cur=cur[k]}cur[parts.at(-1)]=value}
function devGetPath(obj,path){return String(path).split('.').reduce((a,k)=>a?.[k],obj)}
function devField(label,path,value,{type='text',wide=false,step='',min='',max='',readonly=false,meta='현재 실행에 적용'}={}){
	const attrs=`data-dev-path="${devEsc(path)}" data-dev-type="${devEsc(type)}" ${step!==''?`step="${step}"`:''} ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''} ${readonly?'readonly':''}`;
	return `<div class="devField ${wide?'wide':''}"><label>${devEsc(label)}</label><input type="${type==='number'?'number':type==='color'?'color':'text'}" value="${devEsc(readonly?devLabel(value??''):value??'')}" ${attrs}><span class="devFieldMeta">${meta}</span></div>`
}
function devTextArea(label,path,value,{wide=true,meta='현재 실행에 적용'}={}){return `<div class="devField ${wide?'wide':''}"><label>${devEsc(label)}</label><textarea data-dev-path="${devEsc(path)}" data-dev-type="text">${devEsc(value??'')}</textarea><span class="devFieldMeta">${meta}</span></div>`}
function devSelect(label,path,value,options,{wide=false,meta='현재 실행에 적용'}={}){return `<div class="devField ${wide?'wide':''}"><label>${devEsc(label)}</label><select data-dev-path="${devEsc(path)}" data-dev-type="select">${options.map(([v,t])=>`<option value="${devEsc(v)}" ${String(v)===String(value)?'selected':''}>${devEsc(devLabel(t))}</option>`).join('')}</select><span class="devFieldMeta">${meta}</span></div>`}
function devLevelState(level){const p=levelProgressFor(level.id);if(level.enabled===false)return 'DISABLED';if(p.completed&&level.type==='main'&&(p.stars||0)>=3)return 'MASTERED';if(p.completed)return 'COMPLETE';return isLevelUnlocked(level.id)?'AVAILABLE':'잠김'}
function devFilteredLevels(){const q=DEV_STATE.levelSearch.trim().toLowerCase(),f=DEV_STATE.levelFilter;return LEVEL_LIBRARY.filter(l=>{const st=devLevelState(l);if(f!=='ALL'&&f!==String(l.type).toUpperCase()&&!(f==='COMPLETE'&&(st==='COMPLETE'||st==='MASTERED'))&&f!==st)return false;if(!q)return true;return [l.id,l.title,l.setId,l.campaignId,l.subtitle].some(x=>String(x||'').toLowerCase().includes(q))})}
function devSelectedLevel(){let l=getGameLevel(DEV_STATE.selectedLevelId);if(!l){l=devFilteredLevels()[0]||LEVEL_LIBRARY[0];DEV_STATE.selectedLevelId=l?.id||null}return l}
function devNextMainLevel(level){if(!level)return null;const mains=allMainLevels(),i=mains.findIndex(l=>l.id===level.id);return i>=0?mains[i+1]||null:null}
function devLevelEditorHTML(){
	const level=devSelectedLevel();if(!level)return devSectionHeader('스테이지 편집','No level data found.','03 // 스테이지');
	const list=devFilteredLevels().map(l=>`<button class="devLevelListBtn ${l.id===level.id?'active':''}" data-dev-level-select="${l.id}"><span class="id">${devEsc(displayContractId(l))}</span><b>${devEsc(l.title)}</b><small>${devEsc(devLabel(devLevelState(l)))}</small></button>`).join('');
	const site=level.site||{},next=devNextMainLevel(level),bonusTargets=bonusLevelsForSet(level.setId).filter(b=>b.unlockRequirement===level.id).map(b=>b.id).join(', ')||'—';
	const materialChecks=['wood','steel','cable','road','roadHeavy'].map(m=>`<label class="devCheck"><input type="checkbox" data-dev-material-toggle="${m}" ${level.materials?.includes(m)?'checked':''}>${devLabel(m.toUpperCase())}</label>`).join('');
	return `${devSectionHeader('스테이지 편집','48개 스테이지를 검색하고 설정을 편집합니다. 변경값은 현재 실행에 적용되며 새로고침하면 원본으로 돌아갑니다.','03 // 스테이지')}
	<div class="devEditorLayout"><aside class="devEditorList"><div class="devEditorToolbar"><input id="devLevelSearch" placeholder="번호·이름·세트·캠페인 검색" value="${devEsc(DEV_STATE.levelSearch)}"><div class="devFilterRow">${['ALL','MAIN','BONUS','LOCKED','AVAILABLE','COMPLETE','MASTERED'].map(x=>`<button class="devFilterChip ${DEV_STATE.levelFilter===x?'active':''}" data-dev-level-filter="${x}">${devLabel(x)}</button>`).join('')}</div></div><div class="devLevelList">${list||'<div class="devEmpty">검색 조건에 맞는 스테이지가 없습니다</div>'}</div></aside>
	<section class="devEditorPane"><div class="devEditorBanner"><span>현재 실행에만 적용 · 원본 기본값 유지</span><span>${devEsc(level.id)} // ${devEsc(devLabel(devLevelState(level)))}</span></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>일반</b><span>기본 정보·캠페인 연결</span></div><div class="devFormGrid cols3">
	${devField('식별자','id',level.id,{meta:'현재 실행에 적용 · 해금 연결도 갱신'})}${devSelect('유형','type',level.type,[['main','MAIN'],['bonus','BONUS']])}${devField('사용 여부','enabled',level.enabled===false?'false':'true',{meta:'현재 실행에 적용'})}${devField('타이틀','title',level.title,{wide:true})}${devField('설명','subtitle',level.subtitle||'',{wide:true})}${devSelect('세트','setId',level.setId,SET_DEFINITIONS.map(s=>[s.id,`SET ${String(s.number).padStart(2,'0')} // ${s.title}`]))}${devSelect('캠페인','campaignId',level.campaignId,CAMPAIGNS.map(c=>[c.id,`C${c.number} // ${c.title}`]))}
	</div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>부지·형상</b><span>지지점·수면·제한 영역</span></div><div class="devFormGrid cols3">
	${devSelect('부지 형태','site.kind',site.kind||'legacy',[['flat','FLAT'],['slope','SLOPE'],['sag','SAG'],['crown','CROWN'],['asym','ASYMMETRIC'],['legacy','LEGACY']])}${devField('왼쪽 지지점 X','site.leftX',site.leftX??makeDeckFromSite(site)[0][0],{type:'number'})}${devField('왼쪽 지지점 Y','site.leftY',site.leftY??makeDeckFromSite(site)[0][1],{type:'number'})}${devField('오른쪽 지지점 X','site.rightX',site.rightX??makeDeckFromSite(site).at(-1)[0],{type:'number'})}${devField('오른쪽 지지점 Y','site.rightY',site.rightY??makeDeckFromSite(site).at(-1)[1],{type:'number'})}${devField('도로 구간 수','site.segments',site.segments??6,{type:'number',min:2,max:16})}${devField('곡률','site.curve',site.curve??0,{type:'number'})}${devField('수면 높이 Y','site.waterY',site.waterY??'',{type:'number'})}${devField('높이 제한 Y','site.heightLimitY',site.heightLimitY??'',{type:'number'})}${devTextArea('건설 제한 영역 (JSON)','site.noBuildJSON',JSON.stringify(site.noBuild||[],null,2))}${devTextArea('항로·통과 여유 (JSON)','site.navigationJSON',JSON.stringify(site.navigation||null,null,2))}
	</div><div class="devActionBar"><button class="flowBtn primary" data-dev-action="geometry-mode">스테이지 형상 편집 열기</button><button class="flowBtn" data-dev-level-apply>현재 스테이지에 적용</button><button class="flowBtn" data-dev-level-reset>스테이지 변경값 초기화</button></div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>게임플레이</b><span>하중·제한 조건</span></div><div class="devFormGrid cols3">${devField('기본 예산','budget',level.budget,{type:'number',min:0})}${devField('차량 하중 (N)','load',level.load,{type:'number',min:0})}${devField('사용성 허용 변형','serviceDeflection',level.serviceDeflection,{type:'number',min:1})}${devField('붕괴 한계','collapseDeflection',level.collapseDeflection??level.serviceDeflection*2.2,{type:'number',min:1})}${devSelect('차량','vehicleLabel',level.vehicleLabel||level.vehicle,Object.keys(DEV_VEHICLE_PROFILES).map(v=>[v,v]))}${devField('바람 하중 (N)','wind',level.wind||0,{type:'number'})}</div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>재료</b><span>스테이지 사용 가능 여부</span></div><div class="devCheckGrid">${materialChecks}</div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>스테이지 목표</b><span>미션 안내·별 조건</span></div><div class="devFormGrid">${devTextArea('주요 목표','objective',level.objective||'')}${devTextArea('추가 목표','secondaryObjectivesText',(level.secondaryObjectives||[]).join('\n'))}${devTextArea('별 획득 조건','starConditionsText',(level.starConditions||[]).join('\n'))}</div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>해금 조건</b><span>진행도 연결</span></div><div class="devFormGrid cols3">${devField('이전 스테이지·해금 조건','unlockRequirement',level.unlockRequirement||'')}${devField('다음 스테이지','computedNext',next?.id||'—',{readonly:true,meta:'자동 계산'})}${devField('여기서 해금되는 보너스','computedBonus',bonusTargets,{readonly:true,meta:'자동 계산'})}${devSelect('해금할 보너스','devBonusUnlockTarget','',[['','— 없음 —'],...allBonusLevels().map(b=>[b.id,`${displayContractId(b)} // ${b.title}`])],{meta:'선택 대상의 해금 조건을 이 스테이지로 지정'})}${devSelect('해금할 세트','devSetUnlockTarget','',[['','— 없음 —'],...gameSets.map(g=>[g.id,`SET ${String(g.number).padStart(2,'0')} // ${g.title}`])],{meta:'선택 세트의 해금 조건을 이 스테이지로 지정'})}</div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>스테이지 빠른 작업</b><span>저장 데이터 변경</span></div><div class="devActionGrid">${['load-level','unlock-level','lock-level','complete-level','incomplete-level','star-1','star-2','star-3','reset-record','best-time','best-cost','best-grade'].map(a=>`<button class="flowBtn" data-dev-level-action="${a}">${devLabel(a.replaceAll('-',' ').toUpperCase())}</button>`).join('')}</div></div>
	</section></div>`
}
function devRenameLevel(oldId,newId){newId=String(newId||'').trim();if(!newId||newId===oldId||getGameLevel(newId))return oldId;const level=getGameLevel(oldId);if(!level)return oldId;level.id=newId;for(const l of LEVEL_LIBRARY)if(l.unlockRequirement===oldId)l.unlockRequirement=newId;for(const set of gameSets)if(set.unlockRequirement===oldId)set.unlockRequirement=newId;if(playerProgress.levelProgress[oldId]){playerProgress.levelProgress[newId]=playerProgress.levelProgress[oldId];delete playerProgress.levelProgress[oldId]}for(const k of ['unlockedLevels','unlockedBonusLevels','completedLevels'])playerProgress[k]=playerProgress[k].map(x=>x===oldId?newId:x);if(playerProgress.lastPlayedLevel===oldId)playerProgress.lastPlayedLevel=newId;if(selectedLevelId===oldId)selectedLevelId=newId;if(currentCampaignLevelId===oldId)currentCampaignLevelId=newId;DEV_STATE.selectedLevelId=newId;savePlayerProgress();return newId}
function devCommitLevelPath(el){if(!devRequire('LEVEL EDITOR'))return;let level=devSelectedLevel();if(!level)return;const path=el.dataset.devPath,type=el.dataset.devType||'text';if(!path||path==='computedNext'||path==='computedBonus')return;let v=el.value;if(type==='number')v=v===''?null:Number(v);if(path==='id'){devRenameLevel(level.id,v);renderDevConsole();return}if(path==='enabled')v=String(v).toLowerCase()!=='false';if(path==='site.noBuildJSON'){try{level.site=level.site||{};level.site.noBuild=JSON.parse(v||'[]')}catch(_){toast('건설 제한 영역의 JSON 형식이 올바르지 않습니다.');return}return}if(path==='site.navigationJSON'){try{level.site=level.site||{};level.site.navigation=JSON.parse(v||'null')}catch(_){toast('항로·통과 여유의 JSON 형식이 올바르지 않습니다.');return}return}if(path==='secondaryObjectivesText'){level.secondaryObjectives=v.split(/\n+/).map(x=>x.trim()).filter(Boolean);return}if(path==='starConditionsText'){level.starConditions=v.split(/\n+/).map(x=>x.trim()).filter(Boolean);return}if(path==='vehicleLabel'){level.vehicleLabel=v;level.vehicle=devVehicleProfileFor(v).base;return}if(path==='devBonusUnlockTarget'){const target=getGameLevel(v);if(target&&target.type==='bonus')target.unlockRequirement=level.id;return}if(path==='devSetUnlockTarget'){const target=getGameSet(v);if(target)target.unlockRequirement=level.id;return}if(path.startsWith('site.')){level.site=level.site||{};const k=path.slice(5);if(k!=='legacyStage')delete level.site.legacyStage;if(v===null||v==='')delete level.site[k];else level.site[k]=v;return}devSetPath(level,path,v)}
function devResetLevel(level){const base=DEV_DEFAULTS.levels.find(l=>l.id===level.id)||DEV_DEFAULTS.levels.find(l=>l.globalNumber===level.globalNumber&&l.type===level.type&&l.bonusNumber===level.bonusNumber);if(!base)return false;for(const k of Object.keys(level))delete level[k];Object.assign(level,clonePlain(base));DEV_STATE.selectedLevelId=level.id;return true}
function devApplySelectedLevel(){const level=devSelectedLevel();if(!level)return;if(currentCampaignLevelId===level.id||selectedLevelId===level.id){selectedLevelId=level.id;currentCampaignLevelId=level.id;currentLevelStageOverride=runtimeStageForLevel(level);resetStage(level.stageIndex)}toast('스테이지 변경값을 현재 실행에 적용했습니다.')}

function devMaterialEditorHTML(){const id=DEV_STATE.selectedMaterial,mat=MAT[id]||MAT.wood,presets=devLoadMaterialPresets();const fields=[['축 강성 EA','EA'],['탄성 계수 E','E'],['단면 2차 모멘트 I','I'],['유효 길이 계수 K','K'],['허용 인장력','tension'],['허용 압축력','compression'],['길이당 비용','cost'],['최대 길이','maxLen'],['도로 휨 계수','beamScale'],['도로 폭','roadWidth']].filter(([,k])=>k in mat);return `${devSectionHeader('재료 편집','강성·좌굴·도로 휨·비용 계산에 사용하는 재료 값을 편집합니다. 실제 해석에 사용되는 항목만 표시합니다.','04 // 재료')}<div class="devEditorLayout"><aside class="devEditorList"><div class="devEditorToolbar"><div class="devFilterRow">${Object.keys(MAT).map(k=>`<button class="devFilterChip ${k===id?'active':''}" data-dev-material-select="${k}">${devLabel(k.toUpperCase())}</button>`).join('')}</div><div class="devStatusLine">현재 실행에 적용 · 새로고침하면 원본 기본값으로 돌아갑니다.</div></div><div class="devLevelList">${Object.entries(MAT).map(([k,m])=>`<button class="devLevelListBtn ${k===id?'active':''}" data-dev-material-select="${k}"><span class="id">${devLabel(k.toUpperCase())}</span><b>${devEsc(m.name)}</b><small>${m.enabled===false?'사용 안 함':'사용'}</small></button>`).join('')}</div></aside><section class="devEditorPane"><div class="devEditorBanner"><span>구조 해석에 사용하는 재료 상수</span><span>${devLabel(id.toUpperCase())}</span></div><div class="devFormGrid cols3">${fields.map(([lab,k])=>devField(lab,k,Number.isFinite(mat[k])?mat[k]:(mat[k]===Infinity?'Infinity':''),{type:k==='maxLen'?'text':'number',meta:'즉시 반영 · 새로고침 시 복원'})).join('')}${devField('색상','color',mat.color,{type:'color',meta:'즉시 반영'})}${devSelect('사용 여부','enabled',mat.enabled===false?'false':'true',[['true','ENABLED'],['false','DISABLED']],{meta:'즉시 반영'})}</div><div class="devActionBar"><button class="flowBtn" data-dev-material-action="reset">선택 재료 초기화</button><button class="flowBtn" data-dev-material-action="reset-all">모든 재료 초기화</button><button class="flowBtn" data-dev-material-action="save-preset">프리셋 저장</button><select class="devInlineInput" id="devMaterialPresetSelect" style="width:190px">${Object.keys(presets).map(n=>`<option>${devEsc(n)}</option>`).join('')||'<option value="">저장된 프리셋 없음</option>'}</select><button class="flowBtn" data-dev-material-action="load-preset">프리셋 불러오기</button></div><div class="devStatusLine warn">차량 질량과 동적 파단 한계는 재료 항목이 아닙니다. 해당 값은 물리 설정에서 조정하세요.</div></section></div>`}
function devLoadMaterialPresets(){try{return JSON.parse(localStorage.getItem(DEV_MATERIAL_PRESET_KEY)||'{}',(_,v)=>v==='__TRUSS_INF__'?Infinity:v)||{}}catch(_){return {}}}
function devSaveMaterialPresets(v){try{localStorage.setItem(DEV_MATERIAL_PRESET_KEY,JSON.stringify(v,(_,x)=>x===Infinity?'__TRUSS_INF__':x));return true}catch(_){return false}}

function devVehicleEditorHTML(){const key=DEV_STATE.selectedVehicle,p=DEV_VEHICLE_PROFILES[key]||DEV_VEHICLE_PROFILES.CAR;return `${devSectionHeader('차량 편집','스테이지 생성과 차량 물리 연산에 사용하는 차량별 하중·속도·차축 설정을 편집합니다.','05 // 차량')}<div class="devEditorLayout"><aside class="devEditorList"><div class="devEditorToolbar"><div class="devStatusLine">현재 실행에 적용 · 스테이지를 불러올 때 해당 차량 설정을 사용합니다.</div></div><div class="devLevelList">${Object.keys(DEV_VEHICLE_PROFILES).map(k=>`<button class="devLevelListBtn ${k===key?'active':''}" data-dev-vehicle-select="${k}"><span class="id">${devLabel(k.slice(0,6))}</span><b>${devLabel(k)}</b><small>차축 ${DEV_VEHICLE_PROFILES[k].axles.length}개</small></button>`).join('')}</div></aside><section class="devEditorPane"><div class="devEditorBanner"><span>차량 설정</span><span>${devLabel(key)}</span></div><div class="devFormGrid cols3">${devField('하중 재설정 (N)','loadOverride',p.loadOverride??'',{type:'number',meta:'현재 실행에 적용 · 비우면 스테이지 하중 사용'})}${devField('속도 (GU/s)','speed',p.speed,{type:'number',min:10,max:240,meta:'다음 시험부터 반영'})}${devField('차량 길이 (GU)','length',p.length,{type:'number',min:20,max:180})}${devField('표시 배율','renderScale',p.renderScale,{type:'number',step:.05,min:.5,max:2,meta:'즉시 반영'})}${devField('차축 수','axleCount',p.axles.length,{type:'number',min:1,max:8,meta:'현재 실행에 적용 · 차축 목록 재계산'})}${devTextArea('차축 위치·하중 분배','axlesText',p.axles.map(a=>`${a[0]}, ${a[1]}`).join('\n'),{meta:'현재 실행에 적용 · 위치(GU), 하중 비율'})}</div><div class="devActionBar"><button class="flowBtn" data-dev-vehicle-action="spawn">차량 생성 ${key}</button><button class="flowBtn" data-dev-vehicle-action="remove">차량 제거</button><button class="flowBtn" data-dev-vehicle-action="freeze">차량 정지</button><button class="flowBtn" data-dev-vehicle-action="position">차량 위치 지정</button><button class="flowBtn" data-dev-vehicle-action="reset">차량 설정 초기화</button></div></section></div>`}

function devPhysicsEditorHTML(){const rows=Object.entries(DEV_PHYSICS_TUNING).map(([k,v])=>{const [min,max]=DEV_PHYSICS_LIMITS[k]||[-Infinity,Infinity],mode=['substeps','constraintIterations','collisionPush'].includes(k)?'즉시 반영':'다음 붕괴부터 적용';return `<div class="devRangeRow"><span>${devLabel(k.toUpperCase())}</span><input class="devInlineInput" type="number" step="${Math.abs(v)<1?.001:1}" min="${min}" max="${max}" value="${v}" data-dev-physics="${k}"><small>기본값 ${DEV_DEFAULTS.physics[k]}</small><small>${mode}</small></div>`}).join('');return `${devSectionHeader('물리 설정','붕괴 시뮬레이션에서 사용하는 물리 값을 조정합니다. 각 입력은 지정된 범위 안에서 적용됩니다.','06 // 물리')}<div class="devEditorBanner"><span>현재 실행에 적용 · 입력 범위 제한</span><span>${sim?.mode==='collapse'?'동적 물리 연산 중':'대기 · 정적 해석'}</span></div><div>${rows}</div><div class="devActionBar"><button class="flowBtn" data-dev-physics-action="reset">물리 설정 초기화</button></div><div class="devStatusLine warn">중력·공기 저항·케이블 분할은 다음 붕괴 시뮬레이션부터 적용됩니다. 세부 시간 단계·반복 횟수·충돌 보정은 즉시 반영됩니다.</div>`}

function devSolverProblems(){const out=[];const seen=new Set();for(const m of members){const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)continue;if(dist(a,b)<1)out.push(['bad',`길이가 0인 부재 #${m.id}`]);const k=memberKey(m.a,m.b);if(seen.has(k))out.push(['warn',`중복된 부재 ${k}`]);seen.add(k)}for(const n of nodes){if(n.support)continue;if(!members.some(m=>m.a===n.id||m.b===n.id))out.push(['warn',`다른 부재와 연결되지 않은 관절 #${n.id}`])}if(members.some(m=>m.road)&&!roadPathConnected())out.push(['warn','도로 경로가 끊겨 있습니다.']);if(currentAnalysis&&!currentAnalysis.ok)out.push(['bad','구조가 불안정하여 해석할 수 없습니다.']);if(!out.length)out.push(['ok','현재 구조에서 기본 연결·형상 오류가 발견되지 않았습니다.']);return out}
function devSolverEditorHTML(){const a=lastFullAnalysis?.ok?lastFullAnalysis:(sim?.last?.ok?sim.last:null),fixed=nodes.reduce((q,n)=>q+(n.support==='pin'?2:n.support==='roller'?1:0),0),flags=DEV_STATE.solverFlags;const toggleNames={nodeIds:'관절 번호',memberIds:'부재 번호',lengths:'부재 길이',force:'부재력',utilization:'부재 이용률',reactions:'지점 반력',loadVector:'하중 방향',original:'변형 전 형상',deformed:'변형 후 형상'};return `${devSectionHeader('구조 해석 진단','구조 해석의 자유도·행렬 크기·해석 결과를 확인하고 게임 화면에 진단 정보를 표시합니다.','07 // 구조 해석')}<div class="devMetricGrid">${devMetric('관절 수',nodes.length)}${devMetric('부재 수',members.length)}${devMetric('자유도',nodes.length*2)}${devMetric('구속 자유도',fixed)}${devMetric('해석 행렬 크기',`${Math.max(0,nodes.length*2-fixed)} × ${Math.max(0,nodes.length*2-fixed)}`)}${devMetric('해석 소요 시간',a?.solveTimeMs!=null?`${a.solveTimeMs.toFixed(2)} ms`:'—')}${devMetric('상태',a?.ok?'STABLE':currentAnalysis?'SINGULAR / UNSTABLE':'NO DATA',a?.ok?'ok':'warn')}${devMetric('최대 변형',a?.maxDefl!=null?`${a.maxDefl.toFixed(2)} u`:'—')}${devMetric('최대 이용률',a?.maxRatio!=null?`${Math.round(a.maxRatio*100)}%`:'—')}${devMetric('지점 반력 수',a?.reactions?.size??'—')}</div><div class="devEditorSection"><div class="devEditorSectionHead"><b>진단 정보 표시</b><span>게임 화면에 표시</span></div><div class="devCheckGrid">${Object.entries(toggleNames).map(([k,t])=>`<label class="devCheck"><input type="checkbox" data-dev-solver-flag="${k}" ${flags[k]?'checked':''}>${devLabel(t)}</label>`).join('')}</div></div><div class="devEditorSection"><div class="devEditorSectionHead"><b>문제 진단</b><span>구조 모델의 연결·형상 점검</span></div><div class="devProblemList">${devSolverProblems().map(([c,t])=>`<div class="devProblem ${c}">${devEsc(t)}</div>`).join('')}</div></div>${devMemberNodeDebugHTML()}`}
function devActiveAnalysis(){return lastFullAnalysis?.ok?lastFullAnalysis:(sim?.last?.ok?sim.last:(currentAnalysis?.ok?currentAnalysis:null))}
function devNodeDiagnostic(n){
  const a=devActiveAnalysis(),idx=a?.index?.get(n.id),f=DEV_STATE.nodeForces.get(Number(n.id))||{fx:0,fy:0};
  let dx=0,dy=0,rx=0,ry=0,vx=0,vy=0;
  if(idx!=null&&a?.U){dx=a.U[2*idx]||0;dy=a.U[2*idx+1]||0}
  const r=a?.reactions?.get?.(n.id);if(r){rx=r.rx||0;ry=r.ry||0}
  const p=sim?.mode==='collapse'?sim.physics?.particles?.get?.(n.id):null;
  if(p){dx=p.x-n.x;dy=p.y-n.y;vx=(p.x-p.px)*60;vy=(p.y-p.py)*60}
  return {dx,dy,rx,ry,vx,vy,fx:Number(f.fx)||0,fy:Number(f.fy)||0,connected:members.filter(m=>m.a===n.id||m.b===n.id).map(m=>m.id),dynamic:!!p,hasAnalysis:!!a||!!p}
}
function devMemberNodeDebugHTML(){
  const m=hoverMember,n=hoverNode;let body='<div class="devStatusLine">게임 화면에서 부재나 관절에 마우스를 올린 뒤 콘솔을 다시 열면 해당 대상을 확인·편집할 수 있습니다.</div>';
  if(m){
    const a=devActiveAnalysis(),fa=a?.forces?.get?.(m.id),L=dist(nodeById(m.a),nodeById(m.b));
    body=`<div class="devMetricGrid">${devMetric('부재',`#${m.id}`)}${devMetric('재료',m.mat.toUpperCase())}${devMetric('길이',L.toFixed(1)+' u')}${devMetric('힘',fa?`${Math.abs(fa.force/1000).toFixed(2)} kN ${fa.force>=0?'T':'C'}`:'—')}${devMetric('이용률',fa?`${Math.round(fa.ratio*100)}%`:'—')}${devMetric('상태',m.devDisabled?'DISABLED':lastBroken.has(m.id)?'BROKEN':'ACTIVE')}</div><div class="devActionBar"><button class="flowBtn danger" data-dev-member-action="break">파단 처리</button><button class="flowBtn danger" data-dev-member-action="remove">제거</button><button class="flowBtn" data-dev-member-action="disable">비활성화</button><button class="flowBtn" data-dev-member-action="restore">복원</button></div>`;
  }else if(n){
    const d=devNodeDiagnostic(n),disp=Math.hypot(d.dx,d.dy),reaction=Math.hypot(d.rx,d.ry),external=Math.hypot(d.fx,d.fy);
    body=`<div class="devMetricGrid">${devMetric('관절',`#${n.id}`)}${devMetric('위치',`${n.x.toFixed(1)}, ${n.y.toFixed(1)}`)}${devMetric('변위',d.hasAnalysis?`${disp.toFixed(3)} u // ${d.dx.toFixed(3)}, ${d.dy.toFixed(3)}`:'NO SOLVE DATA')}${devMetric('속도',d.dynamic?`${d.vx.toFixed(2)}, ${d.vy.toFixed(2)} u/s`:'0.00, 0.00 u/s')}${devMetric('외부 하중',`${external.toFixed(1)} N // ${d.fx.toFixed(1)}, ${d.fy.toFixed(1)}`)}${devMetric('반력',n.support&&d.hasAnalysis?`${reaction.toFixed(1)} N // ${d.rx.toFixed(1)}, ${d.ry.toFixed(1)}`:'—')}${devMetric('지지 조건',n.support||'FREE')}${devMetric('연결된 부재',d.connected.length?d.connected.map(id=>'#'+id).join(', '):'NONE')}</div><div class="devActionBar"><button class="flowBtn" data-dev-node-action="pin">고정 지점</button><button class="flowBtn" data-dev-node-action="roller">이동 지점</button><button class="flowBtn" data-dev-node-action="free">자유 관절</button><button class="flowBtn" data-dev-node-action="move">이동</button><button class="flowBtn danger" data-dev-node-action="delete">삭제</button></div><div class="devFormGrid"><div class="devField"><label>수평 힘 (N)</label><input type="number" id="devForceX" value="${d.fx}"><span class="devFieldMeta">현재 세션에만 적용</span></div><div class="devField"><label>수직 힘 (N)</label><input type="number" id="devForceY" value="${d.fy}"><span class="devFieldMeta">현재 세션에만 적용</span></div></div><div class="devActionBar"><button class="flowBtn" data-dev-node-action="force-apply">외력 적용</button><button class="flowBtn" data-dev-node-action="force-clear">외력 제거</button></div><div class="devStatusLine">속도는 동적 시뮬레이션의 현재 프레임에서 추정합니다. 정적 해석에서는 0으로 표시됩니다.</div>`;
  }
  return `<div class="devEditorSection"><div class="devEditorSectionHead"><b>부재·관절 진단</b><span>게임에서 가리킨 대상</span></div>${body}</div>`
}

function devProgressEditorHTML(){const main=allMainLevels().filter(l=>levelProgressFor(l.id).completed).length,bonus=allBonusLevels().filter(l=>levelProgressFor(l.id).completed).length,level=devSelectedLevel(),prog=level?levelProgressFor(level.id):null;return `${devSectionHeader('진행도 편집','캠페인 진행도를 편집하고 저장합니다. 잠금 해제와 완료 처리는 별도 작업입니다.','09 // 진행도')}<div class="devMetricGrid">${devMetric('튜토리얼',playerProgress.tutorialCompleted?'COMPLETE':'PENDING')}${devMetric('메인 스테이지',`${main} / 36`)}${devMetric('보너스',`${bonus} / 12`)}${devMetric('별',`${playerProgress.totalStars} / 108`)}${devMetric('배지',`${playerProgress.badges.length} / 12`)}</div><div class="devEditorSection"><div class="devEditorSectionHead"><b>선택한 스테이지</b><span>저장 데이터에 반영</span></div><div class="devFormGrid cols3">${devSelect('스테이지','progressLevel',level?.id||'',LEVEL_LIBRARY.map(l=>[l.id,`${displayContractId(l)} // ${l.title}`]),{meta:'편집 대상'})}${devField('상태','progressStatus',level?devLevelState(level):'—',{readonly:true,meta:'계산된 값'})}${devField('별','progressStars',prog?.stars??0,{readonly:true,meta:'계산된 값'})}</div><div class="devActionGrid" style="margin-top:10px"><button class="flowBtn" data-dev-progress="unlock-campaign">캠페인 잠금 해제</button><button class="flowBtn danger" data-dev-progress="lock-campaign">캠페인 잠그기</button><button class="flowBtn" data-dev-progress="unlock-set">세트 잠금 해제</button><button class="flowBtn danger" data-dev-progress="lock-set">세트 잠그기</button><button class="flowBtn" data-dev-progress="unlock-level">스테이지 잠금 해제</button><button class="flowBtn danger" data-dev-progress="lock-level">스테이지 잠그기</button><button class="flowBtn" data-dev-progress="complete-level">완료로 표시</button><button class="flowBtn" data-dev-progress="master-level">완전 완료 · 별 3개</button><button class="flowBtn" data-dev-progress="toggle-badge">개발자 배지 표시 전환</button><button class="flowBtn" data-dev-progress="tutorial-complete">튜토리얼 완료 처리</button><button class="flowBtn" data-dev-progress="education-complete">학습 완료 처리</button></div></div><div class="devEditorSection"><div class="devEditorSectionHead"><b>일괄 작업</b><span>저장 데이터에 반영</span></div><div class="devActionGrid"><button class="flowBtn" data-dev-progress="unlock-all-persistent">모든 콘텐츠 잠금 해제</button><button class="flowBtn amber" data-dev-progress="complete-all">모든 콘텐츠 완료 처리</button><button class="flowBtn" data-dev-progress="reset-campaign">현재 캠페인 초기화</button><button class="flowBtn" data-dev-progress="reset-tutorial">튜토리얼 초기화</button><button class="flowBtn" data-dev-progress="reset-education">학습 기록 초기화</button><button class="flowBtn" data-dev-progress="reset-records">기록 초기화</button><button class="flowBtn danger" data-dev-progress="reset-everything">모든 진행도 초기화</button></div></div><div class="devStatusLine warn">데이터 초기화는 실행 전에 확인합니다. 전체 진행도 초기화는 확인 문구 입력이 필요합니다.</div>`}


function devSandboxEditorHTML(){
  const sb=stages[4],allMats=['wood','steel','cable','road','roadHeavy'];
  const allowed=Array.isArray(sb.materials)?sb.materials:allMats;
  const materialChecks=allMats.map(m=>`<label class="devCheck"><input type="checkbox" data-dev-sandbox-material="${m}" ${allowed.includes(m)?'checked':''}>${devLabel(m.toUpperCase())}</label>`).join('');
  return `${devSectionHeader('샌드박스 설정','부지·차량·하중을 설정하고 현재 설정으로 샌드박스를 시작합니다.','08 // 샌드박스')}<div class="devEditorBanner"><span>현재 실행의 샌드박스 설정</span><span>${sb.memberFailure?'부재 파단 켜짐':'부재 파단 꺼짐'}</span></div><div class="devFormGrid cols3">${devField('경간 오른쪽 끝 X','deckRightX',sb.deck.at(-1)[0],{type:'number'})}${devSelect('지형','bg',sb.bg,[['wide','WIDE'],['valley','VALLEY'],['slope','SLOPE'],['obstacle','OBSTACLE']])}${devSelect('차량','vehicle',sb.vehicle,[['CAR','CAR'],['BUS','BUS'],['TRUCK','TRUCK'],['HEAVY TRUCK','HEAVY TRUCK']])}${devField('차량 하중 (N)','load',sb.load,{type:'number'})}${devField('바람 하중 (N)','wind',sb.wind||0,{type:'number'})}${devSelect('부재 파단','memberFailure',sb.memberFailure?'true':'false',[['true','ON'],['false','OFF']])}${devField('기본 예산','budget',sb.budget,{type:'number'})}${devField('허용 변형','maxDefl',sb.maxDefl,{type:'number'})}${devSelect('시작 구조','startingPreset',window.__sandboxPreset||'blank',[['blank','BLANK'],['warren','WARREN'],['pratt','PRATT'],['cable','CABLE-STAYED']])}</div><div class="devEditorSection"><div class="devEditorSectionHead"><b>사용 가능한 재료</b><span>현재 실행에 적용</span></div><div class="devCheckGrid">${materialChecks}</div></div><div class="devActionBar"><button class="flowBtn primary" data-dev-sandbox="open">현재 설정으로 샌드박스 시작</button><button class="flowBtn" data-dev-sandbox="reset">샌드박스 설정 초기화</button></div>`
}
function devSimulationControlHTML(){return `<div class="devEditorSection"><div class="devEditorSectionHead"><b>시뮬레이션 제어</b><span>개발자 세션</span></div><div class="devActionBar">${[.1,.25,.5,1,2,4,8].map(v=>`<button class="flowBtn ${simSpeed===v?'amber':''}" data-dev-sim-speed="${v}">${v}×</button>`).join('')}<button class="flowBtn" data-dev-sim="pause">${DEV_STATE.simPaused?'계속 진행':'일시 정지'}</button><button class="flowBtn" data-dev-sim="step-frame">한 프레임 진행</button><button class="flowBtn" data-dev-sim="step-physics">물리 연산 한 단계 진행</button></div></div>`}

function devReadOnlySectionHTML(section){
	const c=devCurrentContext();
	if(section==='campaigns'){const rows=CAMPAIGNS.map(x=>{const st=campaignStats(x.id);return `<tr><td>C${x.number}</td><td>${x.title}</td><td>${st.mainDone}/${st.mainTotal}</td><td>${st.bonusDone}/${st.bonusTotal}</td><td>${st.stars}/${st.maxStars}</td></tr>`}).join('');return `${devSectionHeader('캠페인','캠페인 구성과 완료 현황을 확인합니다. 개별 스테이지 설정은 스테이지 메뉴에서 편집하세요.','02 // 캠페인')}<table class="devDataTable"><thead><tr><th>식별자</th><th>캠페인</th><th>메인 스테이지</th><th>보너스</th><th>별</th></tr></thead><tbody>${rows}</tbody></table>`}
	if(section==='levels')return devLevelEditorHTML();
	if(section==='materials')return devMaterialEditorHTML();
	if(section==='vehicles')return devVehicleEditorHTML();
	if(section==='physics')return devPhysicsEditorHTML()+devSimulationControlHTML();
	if(section==='solver')return devSolverEditorHTML()+devSimulationControlHTML();
	if(section==='sandbox')return devSandboxEditorHTML();
	if(section==='progression')return devProgressEditorHTML();
	if(section==='storage'){let rows='';try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),v=localStorage.getItem(k)||'';rows+=`<tr><td>${devEsc(k)}</td><td>${new TextEncoder().encode(v).byteLength} B</td><td>브라우저 저장소</td></tr>`}}catch(_){}return `${devSectionHeader('저장 관리','Browser storage keys and byte counts. Developer runtime overrides stay in memory unless a preset/save action explicitly says otherwise.','10 // 저장 관리')}<table class="devDataTable"><thead><tr><th>저장 키</th><th>크기</th><th>적용 범위</th></tr></thead><tbody>${rows||'<tr><td colspan="3">저장된 데이터가 없습니다</td></tr>'}</tbody></table><div class="devStatusLine">SESSION AUTH KEY // ${DEV_SESSION_KEY}<br>MATERIAL PRESET KEY // ${DEV_MATERIAL_PRESET_KEY}</div>`}
	if(section==='ui')return `${devSectionHeader('화면·접근성','Current presentation state and developer session flags.','11 // 화면')}<div class="devMetricGrid">${devMetric('UI 모드',String(uiMode).toUpperCase())}${devMetric('마우스 검사 정보',String(inspectorMode||'basic').toUpperCase())}${devMetric('UI 크기',(Number(uiScale)||100)+'%')}${devMetric('화면',String(DEV_STATE.returnScreen||currentGameScreen).toUpperCase())}${devMetric('형상 편집 모드',DEV_STATE.geometryMode?'ACTIVE':'OFF')}${devMetric('진단 정보 표시',DEV_STATE.debugOverlay?'ON':'OFF')}</div>`;
	if(section==='debug')return `${devSectionHeader('디버깅','Validation, content traversal and developer overlays.','12 // 진단')}<div class="devActionGrid"><button class="flowBtn" data-dev-action="validate">캠페인 데이터 검사</button><button class="flowBtn" data-dev-action="debug">진단 표시 전환</button><button class="flowBtn" data-dev-action="unlock-all">현재 세션에서 모두 잠금 해제</button><button class="flowBtn" data-dev-action="lock-normal">정상 잠금 상태로 복원</button></div>${devSimulationControlHTML()}`;
	if(section==='session')return `${devSectionHeader('세션','개발자 인증은 현재 브라우저 세션에서만 유지됩니다.','13 // 세션')}<div class="devMetricGrid">${devMetric('인증 상태','ACTIVE','ok')}${devMetric('인증 방식',DEV_AUTH_CONFIG.algorithm)}${devMetric('반복 횟수',DEV_AUTH_CONFIG.iterations.toLocaleString())}${devMetric('세션 저장 키',DEV_SESSION_KEY)}</div><div class="devPanel"><div class="devActionGrid"><button class="flowBtn danger" data-dev-action="lock">개발자 모드 잠그기</button></div></div>`;
	return `${devSectionHeader(String(section).toUpperCase(),'No editor is mapped to this section.','DEV')}<div class="devEmpty">UNAVAILABLE</div>`;
}

function renderDevConsole(){
	if(!devSessionActive())return;const c=$('#devConsoleContent');if(!c)return;
	$$('.devNavBtn').forEach(b=>b.classList.toggle('active',b.dataset.devSection===DEV_STATE.activeSection));
	c.innerHTML=DEV_STATE.activeSection==='overview'?devOverviewHTML():devReadOnlySectionHTML(DEV_STATE.activeSection);bindDevConsoleDynamicActions();
}
function devRefreshLoadedLevel(){const l=currentCampaignLevel();if(!l)return;currentLevelStageOverride=runtimeStageForLevel(l);stage=currentLevelStageOverride;updateLevelToolAvailability();updateHUD();draw()}
function devRunLevelAction(action){if(!devRequire('LEVEL QUICK ACTION'))return false;const level=devSelectedLevel();if(!level)return false;const id=level.id,p=playerProgress.levelProgress[id]||{completed:false,stars:0,attempts:0,bestTimeMs:null,bestScore:0,bestCost:null,bestDeflection:null,bestGrade:null};playerProgress.devUnlockedLevels=playerProgress.devUnlockedLevels||[];playerProgress.devLockedLevels=playerProgress.devLockedLevels||[];
	if(action==='load-level'){selectedLevelId=id;selectedSetId=level.setId;currentCampaignLevelId=id;currentLevelStageOverride=runtimeStageForLevel(level);resetStage(level.stageIndex);DEV_STATE.returnScreen=GAME_SCREEN.GAME;changeGameScreen(GAME_SCREEN.GAME);return true}
	if(action==='unlock-level'){playerProgress.devLockedLevels=playerProgress.devLockedLevels.filter(x=>x!==id);if(!playerProgress.devUnlockedLevels.includes(id))playerProgress.devUnlockedLevels.push(id);playerProgress.devUnlockedSets=playerProgress.devUnlockedSets||[];playerProgress.devUnlockedCampaigns=playerProgress.devUnlockedCampaigns||[];if(!playerProgress.devUnlockedSets.includes(level.setId))playerProgress.devUnlockedSets.push(level.setId);if(!playerProgress.devUnlockedCampaigns.includes(level.campaignId))playerProgress.devUnlockedCampaigns.push(level.campaignId)}
	else if(action==='lock-level'){playerProgress.devUnlockedLevels=playerProgress.devUnlockedLevels.filter(x=>x!==id);if(!playerProgress.devLockedLevels.includes(id))playerProgress.devLockedLevels.push(id)}
	else if(action==='complete-level'){p.completed=true;p.stars=level.type==='main'?Math.max(1,p.stars||0):p.stars||0}
	else if(action==='incomplete-level'){p.completed=false;p.stars=0}
	else if(action.startsWith('star-')){p.completed=true;p.stars=clamp(Number(action.slice(-1)),0,3)}
	else if(action==='reset-record'){Object.assign(p,{bestTimeMs:null,bestScore:0,bestCost:null,bestDeflection:null,bestGrade:null})}
	else if(action==='best-time'){const v=Number(prompt('최단 시간 (초)','30'));if(Number.isFinite(v)&&v>=0)p.bestTimeMs=v*1000}
	else if(action==='best-cost'){const v=Number(prompt('최소 비용','10000'));if(Number.isFinite(v)&&v>=0)p.bestCost=v}
	else if(action==='best-grade'){const v=String(prompt('최고 등급 (S/A/B/C)','A')||'').toUpperCase();if(['S','A','B','C'].includes(v))p.bestGrade=v}
	playerProgress.levelProgress[id]=p;savePlayerProgress();renderDevConsole();return true
}
function devRunMaterialAction(action){if(!devRequire('MATERIAL EDITOR'))return;const id=DEV_STATE.selectedMaterial,mat=MAT[id];if(!mat)return;if(action==='reset'){const base=DEV_DEFAULTS.materials[id];for(const k of Object.keys(mat))delete mat[k];Object.assign(mat,devDeepClone(base))}else if(action==='reset-all'){for(const [k,base] of Object.entries(DEV_DEFAULTS.materials)){for(const x of Object.keys(MAT[k]))delete MAT[k][x];Object.assign(MAT[k],devDeepClone(base))}}else if(action==='save-preset'){const name=String(prompt('재료 프리셋 이름','LAB PRESET')||'').trim();if(!name)return;const ps=devLoadMaterialPresets();ps[name]=clonePlain(MAT);devSaveMaterialPresets(ps)}else if(action==='load-preset'){const name=$('#devMaterialPresetSelect')?.value,ps=devLoadMaterialPresets();if(!name||!ps[name])return;for(const [k,v] of Object.entries(ps[name]))if(MAT[k]){for(const x of Object.keys(MAT[k]))delete MAT[k][x];Object.assign(MAT[k],devDeepClone(v))}}currentAnalysis=null;lastFullAnalysis=null;if(stage)updateLevelToolAvailability();renderDevConsole();draw()}
function devRunVehicleAction(action){if(!devRequire('VEHICLE EDITOR'))return;const key=DEV_STATE.selectedVehicle,p=DEV_VEHICLE_PROFILES[key];if(!p)return;if(action==='reset'){Object.assign(p,clonePlain(DEV_DEFAULTS.vehicles[key]));renderDevConsole();return}if(!stage)return;if(action==='spawn'){stage.vehicle=p.base;stage.vehicleLabel=key;stage.vehicleHidden=false;stage.vehicleRenderScale=p.renderScale;stage.vehicleSpeed=p.speed;if(Number.isFinite(stage.devSavedLoad)){stage.load=stage.devSavedLoad;delete stage.devSavedLoad}if(Number.isFinite(p.loadOverride))stage.load=p.loadOverride;if(p.useAxleOverride)stage.axles=clonePlain(p.axles);stage.doubleVehicle=key==='DOUBLE TRUCK'?{spacing:180,share:.5}:null;sim=null;draw();toast(`DEV // SPAWN ${key}`)}else if(action==='remove'){if(!Number.isFinite(stage.devSavedLoad))stage.devSavedLoad=stage.load;stage.load=0;stage.vehicleHidden=true;sim=null;draw()}else if(action==='freeze'){DEV_STATE.vehicleFrozen=!DEV_STATE.vehicleFrozen;if(sim?.mode==='collapse')sim.physics.vehicle.vx=0;toast(`DEV // VEHICLE FREEZE ${DEV_STATE.vehicleFrozen?'ON':'OFF'}`)}else if(action==='position'){const q=clamp(Number(prompt('차량 진행 위치 (0~1)','0.5')),0,1);if(sim?.mode==='static'){sim.progress=q;sim.start=performance.now()-q*sim.duration}else if(sim?.mode==='collapse'){const span=stage.deck.at(-1)[0]-stage.deck[0][0];sim.physics.vehicle.x=stage.deck[0][0]+q*span;sim.physics.vehicle.px=sim.physics.vehicle.x}else{const span=stage.deck.at(-1)[0]-stage.deck[0][0];lastFullAnalysis=assemble(stage.deck[0][0]+q*span,new Set());draw()}}}
function devSetPhysicsValue(key,val){if(!devRequire('PHYSICS EDITOR'))return;if(!(key in DEV_PHYSICS_TUNING))return;const lim=DEV_PHYSICS_LIMITS[key]||[-Infinity,Infinity];let n=clamp(Number(val),lim[0],lim[1]);if(['substeps','constraintIterations','cableSegmentLength'].includes(key))n=Math.round(n);DEV_PHYSICS_TUNING[key]=n;if(sim?.mode==='collapse'&&['gravity','airDrag'].includes(key))sim.physics[key]=n}
function devRunProgressAction(action){if(!devRequire('PROGRESSION EDITOR'))return;const level=devSelectedLevel();playerProgress.devUnlockedCampaigns=playerProgress.devUnlockedCampaigns||[];playerProgress.devLockedCampaigns=playerProgress.devLockedCampaigns||[];playerProgress.devUnlockedSets=playerProgress.devUnlockedSets||[];playerProgress.devLockedSets=playerProgress.devLockedSets||[];playerProgress.devUnlockedLevels=playerProgress.devUnlockedLevels||[];playerProgress.devLockedLevels=playerProgress.devLockedLevels||[];const add=(arr,v)=>{if(v&&!arr.includes(v))arr.push(v)},del=(arr,v)=>{const i=arr.indexOf(v);if(i>=0)arr.splice(i,1)};
	if(action==='unlock-campaign'&&level){del(playerProgress.devLockedCampaigns,level.campaignId);add(playerProgress.devUnlockedCampaigns,level.campaignId)}
	else if(action==='lock-campaign'&&level){del(playerProgress.devUnlockedCampaigns,level.campaignId);add(playerProgress.devLockedCampaigns,level.campaignId)}
	else if(action==='unlock-set'&&level){del(playerProgress.devLockedSets,level.setId);add(playerProgress.devUnlockedSets,level.setId);add(playerProgress.devUnlockedCampaigns,level.campaignId)}
	else if(action==='lock-set'&&level){del(playerProgress.devUnlockedSets,level.setId);add(playerProgress.devLockedSets,level.setId)}
	else if(action==='unlock-level'&&level){del(playerProgress.devLockedLevels,level.id);add(playerProgress.devUnlockedLevels,level.id);add(playerProgress.devUnlockedSets,level.setId);add(playerProgress.devUnlockedCampaigns,level.campaignId)}
	else if(action==='lock-level'&&level){del(playerProgress.devUnlockedLevels,level.id);add(playerProgress.devLockedLevels,level.id)}
	else if(action==='complete-level'&&level){playerProgress.levelProgress[level.id]={...levelProgressFor(level.id),completed:true,stars:level.type==='main'?Math.max(1,levelProgressFor(level.id).stars||0):0}}
	else if(action==='master-level'&&level){playerProgress.levelProgress[level.id]={...levelProgressFor(level.id),completed:true,stars:level.type==='main'?3:0,bestGrade:'S'}}
	else if(action==='toggle-badge'&&level?.type==='bonus'){const p=playerProgress.levelProgress[level.id]||{};p.completed=!p.completed;playerProgress.levelProgress[level.id]=p}
	else if(action==='tutorial-complete'){playerProgress.tutorialCompleted=true;localStorage.setItem('trusslab-tutorial-complete','1')}
	else if(action==='education-complete'){localStorage.setItem('trusslab-education-complete','1')}
	else if(action==='unlock-all-persistent'){playerProgress.devUnlockedCampaigns=CAMPAIGNS.map(c=>c.id);playerProgress.devUnlockedSets=SET_DEFINITIONS.map(s=>s.id);playerProgress.devUnlockedLevels=LEVEL_LIBRARY.map(l=>l.id);playerProgress.devLockedCampaigns=[];playerProgress.devLockedSets=[];playerProgress.devLockedLevels=[];playerProgress.tutorialCompleted=true}
	else if(action==='complete-all'){playerProgress.tutorialCompleted=true;for(const l of LEVEL_LIBRARY)playerProgress.levelProgress[l.id]={...levelProgressFor(l.id),completed:true,stars:l.type==='main'?3:0,bestGrade:'S'};playerProgress.devUnlockedCampaigns=CAMPAIGNS.map(c=>c.id);playerProgress.devUnlockedSets=SET_DEFINITIONS.map(s=>s.id);playerProgress.devUnlockedLevels=LEVEL_LIBRARY.map(l=>l.id);playerProgress.devLockedCampaigns=[];playerProgress.devLockedSets=[];playerProgress.devLockedLevels=[]}
	else if(action==='reset-campaign'){const cid=level?.campaignId||'campaign_01';if(!confirm(`Reset progress for ${cid}?`))return;for(const l of LEVEL_LIBRARY.filter(x=>x.campaignId===cid))delete playerProgress.levelProgress[l.id]}
	else if(action==='reset-tutorial'){if(!confirm('튜토리얼 완료 상태를 초기화할까요?'))return;playerProgress.tutorialCompleted=false;localStorage.removeItem('trusslab-tutorial-complete')}
	else if(action==='reset-education'){if(!confirm('학습 센터의 진행 기록을 초기화할까요?'))return;['trusslab-education-complete','trusslab-education-last-module','trusslab-education-quiz'].forEach(k=>localStorage.removeItem(k));quizCorrect?.clear?.()}
	else if(action==='reset-records'){if(!confirm('완료 상태는 유지하고 모든 최고 기록을 초기화할까요?'))return;for(const l of LEVEL_LIBRARY){const p=playerProgress.levelProgress[l.id];if(p)Object.assign(p,{bestTimeMs:null,bestScore:0,bestCost:null,bestDeflection:null,bestGrade:null})}}
	else if(action==='reset-everything'){const phrase=prompt('캠페인 진행도와 학습 기록을 삭제하려면 RESET EVERYTHING을 입력하세요.','');if(phrase!=='RESET EVERYTHING')return;playerProgress=defaultPlayerProgress();['trusslab-education-complete','trusslab-education-last-module','trusslab-education-quiz','trusslab-tutorial-complete'].forEach(k=>localStorage.removeItem(k))}
	savePlayerProgress();renderDevConsole()}

function devRunSandboxAction(action){if(!devRequire('SANDBOX DEV'))return;if(action==='reset'){const base=DEV_DEFAULTS.sandbox;for(const k of Object.keys(stages[4]))delete stages[4][k];Object.assign(stages[4],clonePlain(base));renderDevConsole();return}if(action==='open'){currentCampaignLevelId=null;currentLevelStageOverride=null;stageIndex=4;resetStage(4);loadPreset(window.__sandboxPreset||'blank');DEV_STATE.returnScreen=GAME_SCREEN.GAME;changeGameScreen(GAME_SCREEN.GAME)}}
function devSetSimulationSpeed(v){if(!devRequire('SIMULATION CONTROL'))return;simSpeed=Number(v)||1;updateSpeedButton();renderDevConsole()}
function devPauseSimulation(toggle=true){if(!devRequire('SIMULATION CONTROL'))return;if(!sim)return;if(toggle){if(!DEV_STATE.simPaused){DEV_STATE.simPaused=true;DEV_STATE.simPauseStarted=performance.now()}else{const dt=performance.now()-DEV_STATE.simPauseStarted;DEV_STATE.simPaused=false;if(sim.start)sim.start+=dt;if(sim.collapseStart)sim.collapseStart+=dt;if(sim.lastTick)sim.lastTick+=dt;requestAnimationFrame(sim.mode==='collapse'?tickCollapse:tick)}}}
function devStepSimulation(kind){if(!devRequire('SIMULATION CONTROL'))return;if(!sim)return;DEV_STATE.simPaused=false;const now=(sim.lastTick||performance.now())+(kind==='step-physics'?8:16);if(sim.mode==='collapse')tickCollapse(now);else tick(now);DEV_STATE.simPaused=true;DEV_STATE.simPauseStarted=performance.now()}
function devRunMemberAction(action){if(!devRequire('MEMBER DEBUG'))return;const m=hoverMember;if(!m)return;if(action==='break'){lastBroken.add(m.id);if(sim?.broken)sim.broken.add(m.id)}else if(action==='remove'){members=members.filter(x=>x.id!==m.id);hoverMember=null}else if(action==='disable'){m.devDisabled=true;DEV_STATE.disabledMembers.add(m.id)}else if(action==='restore'){m.devDisabled=false;DEV_STATE.disabledMembers.delete(m.id);lastBroken.delete(m.id);sim?.broken?.delete(m.id)}currentAnalysis=null;lastFullAnalysis=null;draw();renderDevConsole()}
function devRunNodeAction(action){if(!devRequire('NODE DEBUG'))return;const n=hoverNode;if(!n)return;if(action==='pin')n.support='pin';else if(action==='roller')n.support='roller';else if(action==='free')n.support=null;else if(action==='move'){const x=Number(prompt('관절 X 좌표',n.x)),y=Number(prompt('관절 Y 좌표',n.y));if(Number.isFinite(x)&&Number.isFinite(y)){n.x=x;n.y=y}}else if(action==='delete'){if(!n.support){members=members.filter(m=>m.a!==n.id&&m.b!==n.id);nodes=nodes.filter(x=>x.id!==n.id);hoverNode=null}}else if(action==='force-apply'){DEV_STATE.nodeForces.set(Number(n.id),{fx:Number($('#devForceX')?.value)||0,fy:Number($('#devForceY')?.value)||0})}else if(action==='force-clear')DEV_STATE.nodeForces.delete(Number(n.id));currentAnalysis=null;lastFullAnalysis=null;draw();renderDevConsole()}

function bindDevConsoleDynamicActions(){
	const root=$('#devConsoleContent');if(!root)return;
	root.querySelectorAll('[data-dev-action]').forEach(b=>b.onclick=()=>devRunAction(b.dataset.devAction));root.querySelectorAll('[data-dev-screen]').forEach(b=>b.onclick=()=>devNavigateScreen(b.dataset.devScreen));root.querySelectorAll('[data-dev-mock]').forEach(b=>b.onclick=()=>devOpenMockPreview(b.dataset.devMock));
	root.querySelector('#devLevelSearch')?.addEventListener('input',e=>{DEV_STATE.levelSearch=e.target.value;renderDevConsole()});root.querySelectorAll('[data-dev-level-filter]').forEach(b=>b.onclick=()=>{DEV_STATE.levelFilter=b.dataset.devLevelFilter;renderDevConsole()});root.querySelectorAll('[data-dev-level-select]').forEach(b=>b.onclick=()=>{DEV_STATE.selectedLevelId=b.dataset.devLevelSelect;renderDevConsole()});
	if(DEV_STATE.activeSection==='levels')root.querySelectorAll('[data-dev-path]').forEach(el=>el.addEventListener('change',()=>devCommitLevelPath(el)));root.querySelectorAll('[data-dev-material-toggle]').forEach(el=>el.onchange=()=>{const l=devSelectedLevel(),m=el.dataset.devMaterialToggle;l.materials=l.materials||[];l.materials=el.checked?[...new Set([...l.materials,m])]:l.materials.filter(x=>x!==m)});root.querySelector('[data-dev-level-apply]')?.addEventListener('click',devApplySelectedLevel);root.querySelector('[data-dev-level-reset]')?.addEventListener('click',()=>{if(confirm('선택한 스테이지의 실행 중 변경값을 초기화할까요?')){devResetLevel(devSelectedLevel());renderDevConsole()}});root.querySelectorAll('[data-dev-level-action]').forEach(b=>b.onclick=()=>devRunLevelAction(b.dataset.devLevelAction));
	root.querySelectorAll('[data-dev-material-select]').forEach(b=>b.onclick=()=>{DEV_STATE.selectedMaterial=b.dataset.devMaterialSelect;renderDevConsole()});if(DEV_STATE.activeSection==='materials')root.querySelectorAll('[data-dev-path]').forEach(el=>{el.onchange=()=>{if(!devRequire('MATERIAL EDITOR'))return;const m=MAT[DEV_STATE.selectedMaterial],k=el.dataset.devPath;let v=el.value;if(k==='enabled')v=v==='true';else if(k==='color'){}else if(v==='Infinity')v=Infinity;else v=Number(v);m[k]=v;currentAnalysis=null;lastFullAnalysis=null;draw()}});root.querySelectorAll('[data-dev-material-action]').forEach(b=>b.onclick=()=>devRunMaterialAction(b.dataset.devMaterialAction));
	root.querySelectorAll('[data-dev-vehicle-select]').forEach(b=>b.onclick=()=>{DEV_STATE.selectedVehicle=b.dataset.devVehicleSelect;renderDevConsole()});if(DEV_STATE.activeSection==='vehicles')root.querySelectorAll('[data-dev-path]').forEach(el=>{el.onchange=()=>{if(!devRequire('VEHICLE EDITOR'))return;const p=DEV_VEHICLE_PROFILES[DEV_STATE.selectedVehicle],k=el.dataset.devPath;if(k==='axlesText'){const arr=el.value.split(/\n+/).map(r=>r.split(',').map(Number)).filter(a=>a.length>=2&&a.every(Number.isFinite));if(arr.length){p.axles=arr;p.useAxleOverride=true}}else if(k==='loadOverride')p[k]=el.value===''?null:Number(el.value);else if(k==='length'){const nv=Number(el.value),ratio=nv/Math.max(1,p.length||nv);p.length=nv;p.axles=p.axles.map(a=>[a[0]*ratio,a[1]]);p.useAxleOverride=true}else if(k==='axleCount'){const count=clamp(Math.round(Number(el.value)||1),1,8),len=Math.max(20,Number(p.length)||60),start=-len*.32,end=len*.32;p.axles=Array.from({length:count},(_,i)=>[count===1?0:start+(end-start)*(i/(count-1)),1/count]);p.useAxleOverride=true;renderDevConsole()}else p[k]=Number(el.value)}});root.querySelectorAll('[data-dev-vehicle-action]').forEach(b=>b.onclick=()=>devRunVehicleAction(b.dataset.devVehicleAction));
	root.querySelectorAll('[data-dev-physics]').forEach(el=>el.onchange=()=>{devSetPhysicsValue(el.dataset.devPhysics,el.value);renderDevConsole()});root.querySelector('[data-dev-physics-action="reset"]')?.addEventListener('click',()=>{Object.assign(DEV_PHYSICS_TUNING,clonePlain(DEV_DEFAULTS.physics));renderDevConsole()});root.querySelectorAll('[data-dev-solver-flag]').forEach(el=>el.onchange=()=>{DEV_STATE.solverFlags[el.dataset.devSolverFlag]=el.checked;draw()});root.querySelectorAll('[data-dev-member-action]').forEach(b=>b.onclick=()=>devRunMemberAction(b.dataset.devMemberAction));root.querySelectorAll('[data-dev-node-action]').forEach(b=>b.onclick=()=>devRunNodeAction(b.dataset.devNodeAction));
	root.querySelector('[data-dev-path="progressLevel"]')?.addEventListener('change',e=>{DEV_STATE.selectedLevelId=e.target.value;renderDevConsole()});root.querySelectorAll('[data-dev-progress]').forEach(b=>b.onclick=()=>devRunProgressAction(b.dataset.devProgress));root.querySelectorAll('[data-dev-sandbox]').forEach(b=>b.onclick=()=>devRunSandboxAction(b.dataset.devSandbox));if(DEV_STATE.activeSection==='sandbox')root.querySelectorAll('[data-dev-path]').forEach(el=>el.onchange=()=>{if(!devRequire('SANDBOX DEV'))return;const k=el.dataset.devPath;let v=el.value;if(k==='memberFailure')v=v==='true';else if(k==='bg'||k==='vehicle'||k==='startingPreset'){}else v=Number(v);if(k==='deckRightX'){const left=stages[4].deck[0][0],old=stages[4].deck.at(-1)[0],scale=(v-left)/Math.max(1,old-left);stages[4].deck=stages[4].deck.map(([x,y])=>[left+(x-left)*scale,y])}else if(k==='startingPreset')window.__sandboxPreset=v;else if(k==='vehicle'){const profile=DEV_VEHICLE_PROFILES[v];stages[4].vehicle=profile?.base||v;stages[4].vehicleLabel=v;if(profile){stages[4].vehicleSpeed=profile.speed;stages[4].vehicleRenderScale=profile.renderScale;if(profile.useAxleOverride)stages[4].axles=clonePlain(profile.axles)}}else stages[4][k]=v});
	root.querySelectorAll('[data-dev-sandbox-material]').forEach(el=>el.onchange=()=>{if(!devRequire('SANDBOX DEV'))return;const sb=stages[4],all=['wood','steel','cable','road','roadHeavy'],m=el.dataset.devSandboxMaterial;sb.materials=Array.isArray(sb.materials)?sb.materials.slice():all.slice();sb.materials=el.checked?[...new Set([...sb.materials,m])]:sb.materials.filter(x=>x!==m);updateLevelToolAvailability?.()});
	root.querySelectorAll('[data-dev-sim-speed]').forEach(b=>b.onclick=()=>devSetSimulationSpeed(b.dataset.devSimSpeed));root.querySelectorAll('[data-dev-sim]').forEach(b=>b.onclick=()=>{if(b.dataset.devSim==='pause')devPauseSimulation();else devStepSimulation(b.dataset.devSim);renderDevConsole()});
}

function devMaterializeLevelSite(level){if(!level)return null;const site=level.site=level.site||{};if(site.legacyStage!=null){const d=makeDeckFromSite(site);site.kind='flat';site.leftX=d[0][0];site.leftY=d[0][1];site.rightX=d.at(-1)[0];site.rightY=d.at(-1)[1];site.segments=Math.max(2,d.length-1);site.curve=0;delete site.legacyStage}return site}
function devEnterGeometryMode(){if(!devRequire('LEVEL GEOMETRY MODE'))return false;const level=devSelectedLevel()||devEnsureSelectedLevel();if(!level)return false;DEV_STATE.selectedLevelId=level.id;selectedLevelId=level.id;selectedSetId=level.setId;currentCampaignLevelId=level.id;devMaterializeLevelSite(level);currentLevelStageOverride=runtimeStageForLevel(level);resetStage(level.stageIndex);DEV_STATE.geometryMode=true;DEV_STATE.geometryTool='select';DEV_STATE.geometrySelection=null;DEV_STATE.returnScreen=GAME_SCREEN.DEV_CONSOLE;$('#devGeometryHud').hidden=false;changeGameScreen(GAME_SCREEN.GAME);draw();return true}
function devExitGeometryMode(back=true){DEV_STATE.geometryMode=false;DEV_STATE.geometryDrag=null;DEV_STATE.geometrySelection=null;const h=$('#devGeometryHud');if(h)h.hidden=true;draw();if(back)changeGameScreen(GAME_SCREEN.DEV_CONSOLE)}
function devGeometryLevel(){return getGameLevel(DEV_STATE.selectedLevelId)||currentCampaignLevel()}
function devGeometryRectForNav(nav){if(!nav)return null;const top=nav.sweepTop??((nav.waterY??610)-(nav.minHeight??240));return {x:(nav.centerX??600)-(nav.minWidth??280)/2,y:top,w:nav.minWidth??280,h:(nav.waterY??610)-top}}
function devGeometrySelectionLabel(){const s=DEV_STATE.geometrySelection;if(!s)return 'NONE';return s.kind+(Number.isFinite(s.index)?` #${s.index+1}`:'')}
function drawDevGeometryOverlay(){if(!DEV_STATE.geometryMode||!devSessionActive())return;const l=devGeometryLevel();if(!l)return;const site=devMaterializeLevelSite(l);ctx.save();ctx.setLineDash([8,5]);ctx.lineWidth=1.5;ctx.font='800 9px ui-monospace,monospace';ctx.textBaseline='bottom';
  const marker=(x,y,label,active=false)=>{ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,active?11:8,0,Math.PI*2);ctx.fillStyle=active?'rgba(210,168,76,.28)':'rgba(92,169,201,.18)';ctx.fill();ctx.strokeStyle=active?'#e3c45b':'#6fb8ff';ctx.stroke();ctx.fillStyle=active?'#f0d887':'#a9d9ed';ctx.fillText(label,x+12,y-8)};
  marker(site.leftX,site.leftY,'SUPPORT L',DEV_STATE.geometrySelection?.kind==='left-support');marker(site.rightX,site.rightY,'SUPPORT R',DEV_STATE.geometrySelection?.kind==='right-support');
  if(Number.isFinite(site.waterY)){ctx.setLineDash([10,6]);ctx.strokeStyle='#5ca9c9';line({x:40,y:site.waterY},{x:1160,y:site.waterY});ctx.fillStyle='#9ed3e6';ctx.fillText('WATER LEVEL',48,site.waterY-5)}
  if(Number.isFinite(site.heightLimitY)){ctx.strokeStyle='#d2a84c';ctx.setLineDash([6,5]);line({x:40,y:site.heightLimitY},{x:1160,y:site.heightLimitY});ctx.fillStyle='#e4c86f';ctx.fillText('HEIGHT LIMIT',48,site.heightLimitY-5)}
  (site.noBuild||[]).forEach((r,i)=>{const active=DEV_STATE.geometrySelection?.kind==='no-build'&&DEV_STATE.geometrySelection.index===i;ctx.fillStyle=active?'rgba(226,97,97,.18)':'rgba(226,97,97,.09)';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle=active?'#ef8b8b':'#a85c5c';ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#e69a9a';ctx.fillText(`NO BUILD ${i+1}`,r.x+5,r.y+14)});
  const nr=devGeometryRectForNav(site.navigation);if(nr){const active=DEV_STATE.geometrySelection?.kind==='clearance';ctx.fillStyle=active?'rgba(210,168,76,.18)':'rgba(210,168,76,.08)';ctx.fillRect(nr.x,nr.y,nr.w,nr.h);ctx.strokeStyle=active?'#f0d887':'#9c823b';ctx.strokeRect(nr.x,nr.y,nr.w,nr.h);ctx.fillStyle='#e4c86f';ctx.fillText('NAV CLEARANCE / VESSEL PATH',nr.x+5,nr.y+14)}
  ctx.restore();devSyncGeometryFields();const st=$('#devGeometryStatus');if(st)st.textContent=`RUNTIME OVERRIDE // TOOL ${DEV_STATE.geometryTool.toUpperCase()} // SELECT ${devGeometrySelectionLabel()}`}
function devGeometrySelectionValues(){const l=devGeometryLevel();if(!l)return {x:'',y:'',w:'',h:''};const s=devMaterializeLevelSite(l),sel=DEV_STATE.geometrySelection;if(!sel)return {x:'',y:'',w:'',h:''};if(sel.kind==='left-support')return {x:s.leftX,y:s.leftY,w:'',h:''};if(sel.kind==='right-support')return {x:s.rightX,y:s.rightY,w:'',h:''};if(sel.kind==='water')return {x:'',y:s.waterY,w:'',h:''};if(sel.kind==='height')return {x:'',y:s.heightLimitY,w:'',h:''};if(sel.kind==='no-build'){const r=s.noBuild?.[sel.index];return r?{x:r.x,y:r.y,w:r.w,h:r.h}:{x:'',y:'',w:'',h:''}}if(sel.kind==='clearance'){const r=devGeometryRectForNav(s.navigation);return r?{x:r.x,y:r.y,w:r.w,h:r.h}:{x:'',y:'',w:'',h:''}}return {x:'',y:'',w:'',h:''}}
function devSyncGeometryFields(){if(!DEV_STATE.geometryMode)return;const v=devGeometrySelectionValues();for(const [id,k] of [['devGeoX','x'],['devGeoY','y'],['devGeoW','w'],['devGeoH','h']]){const el=$('#'+id);if(el&&document.activeElement!==el)el.value=v[k]??''}}
function devGeometryFieldChange(){if(!devRequire('LEVEL GEOMETRY MODE'))return;const l=devGeometryLevel();if(!l)return;const s=devMaterializeLevelSite(l),sel=DEV_STATE.geometrySelection;if(!sel)return;const x=Number($('#devGeoX')?.value),y=Number($('#devGeoY')?.value),w=Number($('#devGeoW')?.value),h=Number($('#devGeoH')?.value);if(sel.kind==='left-support'){if(Number.isFinite(x))s.leftX=x;if(Number.isFinite(y))s.leftY=y}else if(sel.kind==='right-support'){if(Number.isFinite(x))s.rightX=x;if(Number.isFinite(y))s.rightY=y}else if(sel.kind==='water'){if(Number.isFinite(y))s.waterY=y}else if(sel.kind==='height'){if(Number.isFinite(y))s.heightLimitY=y}else if(sel.kind==='no-build'){const r=s.noBuild?.[sel.index];if(r){if(Number.isFinite(x))r.x=x;if(Number.isFinite(y))r.y=y;if(Number.isFinite(w)&&w>1)r.w=w;if(Number.isFinite(h)&&h>1)r.h=h}}else if(sel.kind==='clearance'&&s.navigation){const ww=Number.isFinite(w)&&w>1?w:s.navigation.minWidth,hh=Number.isFinite(h)&&h>1?h:s.navigation.minHeight;if(Number.isFinite(x))s.navigation.centerX=x+ww/2;if(Number.isFinite(y)){s.navigation.sweepTop=y;s.navigation.waterY=y+hh}s.navigation.minWidth=ww;s.navigation.minHeight=hh}draw()}
function devGeometryHit(p){const l=devGeometryLevel();if(!l)return null;const s=devMaterializeLevelSite(l),d=(x,y)=>Math.hypot(p.x-x,p.y-y);if(d(s.leftX,s.leftY)<18)return {kind:'left-support'};if(d(s.rightX,s.rightY)<18)return {kind:'right-support'};if(Number.isFinite(s.waterY)&&Math.abs(p.y-s.waterY)<10)return {kind:'water'};if(Number.isFinite(s.heightLimitY)&&Math.abs(p.y-s.heightLimitY)<10)return {kind:'height'};for(let i=(s.noBuild||[]).length-1;i>=0;i--){const r=s.noBuild[i];if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return {kind:'no-build',index:i}}const nr=devGeometryRectForNav(s.navigation);if(nr&&p.x>=nr.x&&p.x<=nr.x+nr.w&&p.y>=nr.y&&p.y<=nr.y+nr.h)return {kind:'clearance'};return null}
function devGeometryPointerDown(e){if(!DEV_STATE.geometryMode)return; e.preventDefault();e.stopImmediatePropagation();const p=screenToWorld(e.clientX,e.clientY),l=devGeometryLevel(),s=devMaterializeLevelSite(l);if(DEV_STATE.geometryTool==='add-no-build'){s.noBuild=s.noBuild||[];s.noBuild.push({x:Math.round(p.x-60),y:Math.round(p.y-40),w:120,h:80,kind:'site'});DEV_STATE.geometrySelection={kind:'no-build',index:s.noBuild.length-1};DEV_STATE.geometryTool='select';draw();return}if(DEV_STATE.geometryTool==='add-clearance'){s.navigation={centerX:Math.round(p.x),minWidth:260,minHeight:220,waterY:Math.round(p.y+110),sweepTop:Math.round(p.y-110)};DEV_STATE.geometrySelection={kind:'clearance'};DEV_STATE.geometryTool='select';draw();return}if(DEV_STATE.geometryTool==='add-water'){s.waterY=Math.round(p.y);DEV_STATE.geometrySelection={kind:'water'};DEV_STATE.geometryTool='select';draw();return}if(DEV_STATE.geometryTool==='add-height'){s.heightLimitY=Math.round(p.y);DEV_STATE.geometrySelection={kind:'height'};DEV_STATE.geometryTool='select';draw();return}const hit=devGeometryHit(p);DEV_STATE.geometrySelection=hit;if(hit)DEV_STATE.geometryDrag={...hit,start:p,site:clonePlain(s)};draw()}
function devGeometryPointerMove(e){if(!DEV_STATE.geometryMode||!DEV_STATE.geometryDrag)return;e.preventDefault();e.stopImmediatePropagation();const p=screenToWorld(e.clientX,e.clientY),l=devGeometryLevel(),s=devMaterializeLevelSite(l),g=DEV_STATE.geometryDrag,dx=p.x-g.start.x,dy=p.y-g.start.y,b=g.site;if(g.kind==='left-support'){s.leftX=Math.round((b.leftX+dx)*10)/10;s.leftY=Math.round((b.leftY+dy)*10)/10}else if(g.kind==='right-support'){s.rightX=Math.round((b.rightX+dx)*10)/10;s.rightY=Math.round((b.rightY+dy)*10)/10}else if(g.kind==='water')s.waterY=Math.round((b.waterY+dy)*10)/10;else if(g.kind==='height')s.heightLimitY=Math.round((b.heightLimitY+dy)*10)/10;else if(g.kind==='no-build'){s.noBuild[g.index].x=Math.round((b.noBuild[g.index].x+dx)*10)/10;s.noBuild[g.index].y=Math.round((b.noBuild[g.index].y+dy)*10)/10}else if(g.kind==='clearance'&&s.navigation){s.navigation.centerX=Math.round((b.navigation.centerX+dx)*10)/10;s.navigation.waterY=Math.round((b.navigation.waterY+dy)*10)/10;s.navigation.sweepTop=Math.round(((b.navigation.sweepTop??(b.navigation.waterY-b.navigation.minHeight))+dy)*10)/10}draw()}
function devGeometryPointerUp(e){if(!DEV_STATE.geometryMode)return;e.preventDefault();e.stopImmediatePropagation();DEV_STATE.geometryDrag=null;draw()}
function devGeometryToolAction(action){if(!devRequire('LEVEL GEOMETRY MODE'))return;const l=devGeometryLevel(),s=devMaterializeLevelSite(l),sel=DEV_STATE.geometrySelection;if(action==='duplicate'&&sel?.kind==='no-build'){s.noBuild.push({...s.noBuild[sel.index],x:s.noBuild[sel.index].x+20,y:s.noBuild[sel.index].y+20});DEV_STATE.geometrySelection={kind:'no-build',index:s.noBuild.length-1}}else if(action==='delete'&&sel){if(sel.kind==='no-build')s.noBuild.splice(sel.index,1);else if(sel.kind==='clearance')delete s.navigation;else if(sel.kind==='water')delete s.waterY;else if(sel.kind==='height')delete s.heightLimitY;DEV_STATE.geometrySelection=null}else if(action==='fit')resetCamera();else DEV_STATE.geometryTool=action;draw()}
function devApplyGeometryAndReload(){if(!devRequire('LEVEL GEOMETRY MODE'))return;const l=devGeometryLevel();if(!l)return;currentCampaignLevelId=l.id;selectedLevelId=l.id;currentLevelStageOverride=runtimeStageForLevel(l);resetStage(l.stageIndex);$('#devGeometryHud').hidden=false;draw();toast('스테이지 형상을 적용했습니다.')}

function drawDevSolverOverlay(analysis,physics){if(!devSessionActive())return;const f=DEV_STATE.solverFlags;if(!Object.values(f).some(Boolean))return;const a=analysis?.ok?analysis:(lastFullAnalysis?.ok?lastFullAnalysis:null);ctx.save();ctx.font='800 8px ui-monospace,monospace';ctx.textBaseline='middle';
  const pos=n=>{if(physics){const p=collapseParticle(physics,n.id);if(p)return {x:p.x,y:p.y}}if(a){const i=a.index.get(n.id);if(i!=null)return {x:n.x+a.U[2*i]*2.4,y:n.y+a.U[2*i+1]*2.4}}return {x:n.x,y:n.y}};
  if(f.original){ctx.strokeStyle='rgba(220,230,235,.28)';ctx.setLineDash([4,4]);ctx.lineWidth=1;for(const m of members){const x=nodeById(m.a),y=nodeById(m.b);if(x&&y)line(x,y)}ctx.setLineDash([])}
  if(f.deformed&&a){ctx.strokeStyle='rgba(92,169,201,.7)';ctx.lineWidth=1.4;for(const m of members){const x=pos(nodeById(m.a)),y=pos(nodeById(m.b));line(x,y)}}
  for(const m of members){const na=nodeById(m.a),nb=nodeById(m.b);if(!na||!nb)continue;const pa=pos(na),pb=pos(nb),mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2,info=a?.forces?.get(m.id);const bits=[];if(f.memberIds)bits.push(`M${m.id}`);if(f.lengths)bits.push(`L ${dist(na,nb).toFixed(1)}`);if(f.force&&info)bits.push(`${(info.force/1000).toFixed(1)}kN`);if(f.utilization&&info)bits.push(`${Math.round(info.ratio*100)}%`);if(bits.length){ctx.fillStyle='rgba(5,10,13,.82)';const t=bits.join(' · '),w=ctx.measureText(t).width+8;ctx.fillRect(mx-w/2,my-8,w,16);ctx.fillStyle='#d7e4e8';ctx.textAlign='center';ctx.fillText(t,mx,my)}}
  if(f.nodeIds)for(const n of nodes){const p=pos(n);ctx.fillStyle='#f0d887';ctx.textAlign='left';ctx.fillText(`N${n.id}`,p.x+9,p.y-9)}
  if(f.reactions&&a?.reactions)for(const n of nodes.filter(n=>n.support)){const r=a.reactions.get(n.id);if(!r)continue;const p=pos(n);ctx.fillStyle='#7ae7bf';ctx.textAlign='center';ctx.fillText(`R ${Math.round(r.rx/1000)},${Math.round(r.ry/1000)} kN`,p.x,p.y+24)}
  if(f.loadVector&&a){ctx.fillStyle='#ffe36a';ctx.textAlign='center';ctx.fillText(`LOAD ${Math.round(stage.load/1000)} kN`,a.loadX,deckYAt(a.loadX,a,2.4)-70)}ctx.restore()}

function devRefreshOverviewMetrics(){if(currentGameScreen===GAME_SCREEN.DEV_CONSOLE&&DEV_STATE.activeSection==='overview'){const grid=$('#devOverviewMetrics');if(grid){const c=devCurrentContext(),level=c.level?(c.level.type==='bonus'?`B${String(c.level.bonusNumber).padStart(2,'0')}`:`${String(c.level.globalNumber).padStart(2,'0')}`):'—';grid.innerHTML=`${devMetric('게임 버전','TRUSS-LAB_34')}${devMetric('저장 형식 버전',String(playerProgress.saveVersion||3))}${devMetric('복귀 화면',String(DEV_STATE.returnScreen||'—').toUpperCase())}${devMetric('현재 캠페인',c.campaign?`C${c.campaign.number} // ${c.campaign.title}`:'—')}${devMetric('현재 세트',c.set?`SET ${String(c.set.number).padStart(2,'0')}`:'—')}${devMetric('현재 스테이지',level)}${devMetric('전체 스테이지',String(LEVEL_LIBRARY.length))}${devMetric('관절 수',String(nodes?.length||0))}${devMetric('부재 수',String(members?.length||0))}${devMetric('현재 FPS',String(Math.round(DEV_STATE.fps)))}${devMetric('해석 상태',devSolverStatus(),sim?'warn':'')}${devMetric('브라우저 저장 용량',(devLocalStorageBytes()/1024).toFixed(1)+' KB')}`}}}

/* ==========================================================================\n   DEV SCREEN NAVIGATION\n   ========================================================================== */
function devEnsureSelectedLevel(){if(getGameLevel(selectedLevelId))return getGameLevel(selectedLevelId);const l=currentCampaignLevel()||allMainLevels()[0];selectedLevelId=l?.id||null;selectedSetId=l?.setId||'set01';return l}
function devNavigateScreen(target){
	if(!devRequire('SCREEN NAVIGATION'))return;
	if(['success','failure','set-complete','campaign-complete'].includes(target)){devOpenMockPreview(target);return}
	if(target==='sandbox'){openSandboxSetup(GAME_SCREEN.DEV_CONSOLE);return}
	if(target==='education'){openEducationCenter(0,null,false);return}
	if(target==='briefing')devEnsureSelectedLevel();
	if(target==='level-select'){devEnsureSelectedLevel();selectedSetId=getGameLevel(selectedLevelId)?.setId||selectedSetId}
	const map={'title':GAME_SCREEN.TITLE,'main-menu':GAME_SCREEN.MAIN_MENU,'set-select':GAME_SCREEN.SET_SELECT,'level-select':GAME_SCREEN.LEVEL_SELECT,'briefing':GAME_SCREEN.BRIEFING,'game':GAME_SCREEN.GAME,'settings':GAME_SCREEN.SETTINGS,'records':GAME_SCREEN.RECORDS};
	if(map[target]){DEV_STATE.returnScreen=map[target];changeGameScreen(map[target])}
}
function devOpenMockPreview(kind){if(!devRequire('MOCK UI'))return;DEV_STATE.previewKind=kind;changeGameScreen(GAME_SCREEN.DEV_PREVIEW)}
function renderDevPreviewScreen(){
	const kind=DEV_STATE.previewKind||'success',title=$('#devPreviewTitle'),subtitle=$('#devPreviewSubtitle'),body=$('#devPreviewBody');if(!title||!body)return;
	const level=devEnsureSelectedLevel(),set=level?getGameSet(level.setId):null;
	let cardClass='',kicker='PREVIEW',heading='UI PREVIEW',copy='No campaign progress is written by this preview.',stats=[['CONTRACT',level?displayContractId(level):'—'],['SET',set?String(set.number).padStart(2,'0'):'—'],['PROGRESS','UNCHANGED'],['SAVE','NO WRITE']];
	if(kind==='success'){cardClass='success';kicker='CAMPAIGN CONTRACT // COMPLETE';heading='CONTRACT COMPLETE';copy='Mock success result for visual QA. Player records, stars and unlocks remain unchanged.'}
	else if(kind==='perfect'){cardClass='success';kicker='ENGINEERING GRADE // PERFECT';heading='GRADE S';copy='Mock perfect result with all optional objectives satisfied.';stats=[['SAFETY','100'],['EFFICIENCY','96'],['STIFFNESS','98'],['STARS','★★★']]}
	else if(kind==='failure'){cardClass='failure';kicker='STRUCTURAL TEST // REVIEW REQUIRED';heading='BRIDGE FAILED';copy='Mock failure result for visual QA. No attempt is recorded.';stats=[['PRIMARY FAILURE','BUCKLING'],['UTILIZATION','108%'],['VEHICLE PASS','NO'],['SAVE','NO WRITE']]}
	else if(kind==='set-complete'){cardClass='success';kicker='PROGRAM PROGRESSION';heading='SET COMPLETE';copy=`Mock completion screen for ${set?.title||'CURRENT SET'}.`;stats=[['MAIN','6 / 6'],['BONUS','1 / 2'],['STARS','15 / 18'],['SAVE','NO WRITE']]}
	else if(kind==='campaign-complete'){cardClass='success';kicker='STRUCTURAL ENGINEERING PROGRAM';heading='CAMPAIGN COMPLETE';copy='Mock campaign-complete screen for flow and responsive testing.';stats=[['MAIN','12 / 12'],['BONUS','3 / 4'],['STARS','31 / 36'],['SAVE','NO WRITE']]}
	title.textContent=heading;subtitle.textContent='DEVELOPER PREVIEW // progress and records are isolated';body.innerHTML=`<div class="devPreviewCard ${cardClass}"><div class="devPreviewKicker">${kicker}</div><h2>${heading}</h2><p>${copy}</p><div class="devPreviewStats">${stats.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}</div></div>`;
}

/* ==========================================================================\n   DEV QUICK ACTIONS\n   ========================================================================== */
function devTargetLevel(){return currentCampaignLevel()||getGameLevel(selectedLevelId)||allMainLevels()[0]||null}
function devForceOutcome(success){
	if(!devRequire(success?'PASS LEVEL':'FAIL LEVEL'))return false;const level=devTargetLevel();if(!level)return false;
	const prev=levelProgressFor(level.id),next={...prev,attempts:(prev.attempts||0)+1,lastPlayedAt:Date.now()};
	if(success){next.completed=true;if(level.type==='main')next.stars=Math.max(prev.stars||0,1);next.bestGrade=prev.bestGrade||'C'}
	playerProgress.levelProgress[level.id]=next;playerProgress.lastPlayedLevel=level.id;playerProgress.lastPlayedSet=level.setId;savePlayerProgress();
	toast?.(`DEV // ${success?'PASS':'FAIL'} ${level.type==='bonus'?'B'+String(level.bonusNumber).padStart(2,'0'):String(level.globalNumber).padStart(2,'0')}`);renderDevConsole();return true;
}
function devReloadCurrentLevel(){if(!devRequire('RELOAD LEVEL'))return false;if(stageIndex===-1){startTutorialStage(true);return true}if(Number.isFinite(stageIndex)){resetStage(stageIndex);toast?.('DEV // LEVEL RELOADED');return true}return false}
function devOpenCurrentLevel(){if(!devRequire('OPEN CURRENT LEVEL'))return false;if(stageIndex===-1){changeGameScreen(GAME_SCREEN.GAME);return true}changeGameScreen(GAME_SCREEN.GAME,{resumeClock:false});DEV_STATE.returnScreen=GAME_SCREEN.GAME;return true}
function devBreakHoveredMember(){if(!devRequire('BREAK HOVERED MEMBER'))return false;if(!hoverMember?.user){toast?.('DEV // HOVER A USER MEMBER FIRST');return false}lastBroken.add(hoverMember.id);if(sim?.broken)sim.broken.add(hoverMember.id);currentAnalysis=null;lastFullAnalysis=null;draw();toast?.(`DEV // MEMBER #${hoverMember.id} MARKED BROKEN`);return true}
function devRunAction(action){
	if(!devRequire(String(action).toUpperCase()))return false;
	if(action==='reload'||action==='reset')return devReloadCurrentLevel();
	if(action==='open-current')return devOpenCurrentLevel();
	if(action==='pass')return devForceOutcome(true);
	if(action==='fail')return devForceOutcome(false);
	if(action==='result')return devOpenMockPreview('success');
	if(action==='main-menu'){DEV_STATE.returnScreen=GAME_SCREEN.MAIN_MENU;changeGameScreen(GAME_SCREEN.MAIN_MENU);return true}
	if(action==='level-select'){devEnsureSelectedLevel();DEV_STATE.returnScreen=GAME_SCREEN.LEVEL_SELECT;changeGameScreen(GAME_SCREEN.LEVEL_SELECT);return true}
	if(action==='validate'){validateCampaignContent({log:true});toast?.('DEV // CAMPAIGN VALIDATION COMPLETE');return true}
	if(action==='debug'){toggleDevDebugOverlay();return true}
	if(action==='geometry-mode'){devEnterGeometryMode();return true}
	if(action==='unlock-all'){window.__trussDevUnlockAll=true;toast?.('DEV // ALL CONTRACTS TEMPORARILY UNLOCKED');renderDevConsole();return true}
	if(action==='lock-normal'){window.__trussDevUnlockAll=false;toast?.('DEV // NORMAL UNLOCK RULES RESTORED');renderDevConsole();return true}
	if(action==='lock')return lockDeveloperMode();
	return false;
}
function toggleDevQuickMenu(force){if(!devSessionActive())return false;DEV_STATE.quickMenu=typeof force==='boolean'?force:!DEV_STATE.quickMenu;const q=$('#devQuickMenu');if(q)q.hidden=!DEV_STATE.quickMenu;return DEV_STATE.quickMenu}

/* ==========================================================================\n   DEV DEBUG\n   ========================================================================== */
function toggleDevDebugOverlay(force){if(!devRequire('DEBUG OVERLAY'))return false;DEV_STATE.debugOverlay=typeof force==='boolean'?force:!DEV_STATE.debugOverlay;const el=$('#devDebugOverlay');if(el)el.hidden=!DEV_STATE.debugOverlay;return DEV_STATE.debugOverlay}
function updateDevDebugOverlay(){const el=$('#devDebugOverlay');if(!el||!DEV_STATE.debugOverlay||!devSessionActive())return;const c=devCurrentContext();el.innerHTML=`<b>TRUSS LAB // DEV DEBUG</b><br>SCREEN ${String(currentGameScreen).toUpperCase()}<br>FPS ${Math.round(DEV_STATE.fps)}<br>NODES ${nodes?.length||0} / MEMBERS ${members?.length||0}<br>SOLVER ${devSolverStatus()}<br>LEVEL ${c.level?.id||'—'}<br>SIM ${sim?.mode||'IDLE'}`}
function devMonitorFrame(t){
	if(devSessionActive()){DEV_STATE.fpsFrames++;const elapsed=t-DEV_STATE.fpsSampleAt;if(elapsed>=500){DEV_STATE.fps=DEV_STATE.fpsFrames*1000/elapsed;DEV_STATE.fpsFrames=0;DEV_STATE.fpsSampleAt=t;devRefreshOverviewMetrics()}updateDevDebugOverlay()}
	requestAnimationFrame(devMonitorFrame);
}

function initDeveloperMode(){
	$('#devAuthForm')?.addEventListener('submit',submitDeveloperAuth);$('#devAuthCancel')?.addEventListener('click',()=>changeGameScreen(DEV_STATE.returnScreen||GAME_SCREEN.MAIN_MENU));
	$('#menuDeveloperBtn')?.addEventListener('click',()=>openDeveloperMode(GAME_SCREEN.MAIN_MENU));$('#settingsDeveloperBtn')?.addEventListener('click',()=>openDeveloperMode(GAME_SCREEN.SETTINGS));$('#devModeBadge')?.addEventListener('click',()=>openDeveloperMode(currentGameScreen));
	$('#devConsoleReturnBtn')?.addEventListener('click',()=>devRequestExitConsole());$('#devConsoleLockBtn')?.addEventListener('click',lockDeveloperMode);$('#devPreviewBackBtn')?.addEventListener('click',()=>changeGameScreen(GAME_SCREEN.DEV_CONSOLE));
	$$('.devNavBtn').forEach(b=>b.addEventListener('click',()=>devRequestSectionChange(b.dataset.devSection||'overview')));
	$('#devQuickClose')?.addEventListener('click',()=>toggleDevQuickMenu(false));$$('[data-dev-quick]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.devQuick;if(a==='reload')devReloadCurrentLevel();else if(a==='pass')devForceOutcome(true);else if(a==='fail')devForceOutcome(false);else if(a==='break')devBreakHoveredMember();else if(a==='debug')toggleDevDebugOverlay();else if(a==='console')openDeveloperMode(currentGameScreen);toggleDevQuickMenu(false)}));
	document.addEventListener('keydown',e=>{if(!devSessionActive())return;if(e.key==='F10'){e.preventDefault();toggleDevQuickMenu()}else if(e.key==='F9'){e.preventDefault();toggleDevDebugOverlay()}});
	canvas.addEventListener('pointerdown',devGeometryPointerDown,true);canvas.addEventListener('pointermove',devGeometryPointerMove,true);canvas.addEventListener('pointerup',devGeometryPointerUp,true);canvas.addEventListener('pointercancel',devGeometryPointerUp,true);
	$$('[data-geo-tool]').forEach(b=>b.addEventListener('click',()=>{$$('[data-geo-tool]').forEach(x=>x.classList.toggle('active',x===b));devGeometryToolAction(b.dataset.geoTool)}));$('#devGeometryApplyBtn')?.addEventListener('click',devApplyGeometryAndReload);$('#devGeometryExitBtn')?.addEventListener('click',()=>devExitGeometryMode(true));['devGeoX','devGeoY','devGeoW','devGeoH'].forEach(id=>$('#'+id)?.addEventListener('change',devGeometryFieldChange));
	updateDeveloperEntryUI();updateDevPresenceBadge();requestAnimationFrame(devMonitorFrame);
}

window.TRUSSLAB_DEV={
	open:()=>openDeveloperMode(currentGameScreen),
	lock:()=>devGuard(lockDeveloperMode,'LOCK DEVELOPER MODE')(),
	validate:()=>devGuard(()=>validateCampaignContent({log:true}),'CAMPAIGN VALIDATION')(),
	summary:(id)=>devGuard(()=>{const v=campaignBalanceSummary(id);console.table(v?[v]:[]);return v},'LEVEL SUMMARY')(),
	list:()=>devGuard(()=>{const rows=LEVEL_LIBRARY.map(l=>campaignBalanceSummary(l.id));console.table(rows);return rows},'LEVEL LIST')(),
	unlockAll:()=>devGuard(()=>{window.__trussDevUnlockAll=true;if(currentGameScreen===GAME_SCREEN.SET_SELECT)renderSetSelect();if(currentGameScreen===GAME_SCREEN.LEVEL_SELECT)renderLevelSelect(selectedSetId);return true},'UNLOCK ALL')(),
	lockNormally:()=>devGuard(()=>{window.__trussDevUnlockAll=false;return true},'RESTORE LOCKS')(),
	clearTestProgress:()=>devGuard(()=>{if(!confirm('캠페인 테스트 진행도를 초기화할까요?'))return false;playerProgress=defaultPlayerProgress();savePlayerProgress();return true},'CLEAR TEST PROGRESS')(),
	loadLevel:(id)=>devGuard(()=>{const l=getGameLevel(id);if(!l)throw new Error(`Unknown level: ${id}`);window.__trussDevUnlockAll=true;selectedLevelId=id;selectedSetId=l.setId;openLevelBriefing(id);return l},'LOAD LEVEL')(),
	toggleDebugOverlay:()=>devGuard(()=>toggleDevDebugOverlay(),'DEBUG OVERLAY')(),
	openQuickMenu:()=>devGuard(()=>toggleDevQuickMenu(true),'QUICK MENU')()
};


const STAGE_BASE = stages.map(s=>({budget:s.budget,load:s.load,maxDefl:s.maxDefl}));
const DIFFICULTY = {
  easy:{key:'easy',label:'초등학생용 // 쉬움',budgetMul:1.35,loadMul:.78,deflMul:1.18,summary:'기본 예산 +35% · 차량 하중 -22% · 허용 변형 +18%'},
  hard:{key:'hard',label:'중·고등학생용 // 어려움',budgetMul:1.00,loadMul:1.05,deflMul:1.00,summary:'기본 예산 ±0% · 차량 하중 +5% · 표준 허용 변형'}
};
let difficultyMode=localStorage.getItem('trusslab-difficulty')||projectSettings.difficultyDefault||'easy';
if(!DIFFICULTY[difficultyMode])difficultyMode='easy';
function applyDifficultyProfile(){
  const d=DIFFICULTY[difficultyMode];
  for(let i=0;i<4;i++){
    stages[i].budget=Math.round((STAGE_BASE[i].budget*d.budgetMul)/100)*100;
    stages[i].load=Math.round((STAGE_BASE[i].load*d.loadMul)/1000)*1000;
    stages[i].maxDefl=Math.round(STAGE_BASE[i].maxDefl*d.deflMul);
    stages[i].collapseDeflLimit=stages[i].maxDefl*2.2;
  }
  stages[4].collapseDeflLimit=stages[4].maxDefl*2.2;
}
function updateDifficultyUI(){
  const d=DIFFICULTY[difficultyMode];
  $$('.difficultyBtn').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficultyMode));
  const label=$('#difficultyLabel');if(label)label.textContent=d.label;
  const sum=$('#difficultySummary');if(sum)sum.innerHTML=`<strong>${difficultyMode==='easy'?'쉬움':'어려움'} //</strong> ${d.summary}`;
}
function setDifficulty(mode){
  if(!DIFFICULTY[mode])return;
  difficultyMode=mode;localStorage.setItem('trusslab-difficulty',mode);applyDifficultyProfile();updateDifficultyUI();
  if(currentGameScreen===GAME_SCREEN.GAME&&stageIndex>=0&&stageIndex<4)resetStage(stageIndex);
}
applyDifficultyProfile();

let W=1200,H=650,dpr=1, scaleX=1, scaleY=1;
let stageIndex=0, stage=stages[0], nodes=[], members=[], history=[], redoHistory=[];
const sessionClearedStages=new Set(playerProgress.completedLevels.map(id=>getGameLevel(id)?.stageIndex).filter(i=>Number.isInteger(i)&&i>=0&&i<4));
// Legacy clear flags are no longer authoritative; campaign progression is centralized in playerProgress.
for(let i=0;i<4;i++)localStorage.removeItem('trusslab-best-'+i);
localStorage.removeItem('trusslab-education-unlocked');
let tutorialMode=false,tutorialStep=0,tutorialTransitioning=false,tutorialFlags={camera:false,rightClick:false,moved:false},tutorialDragStart=null,tutorialMoveTarget=null,tutorialTestRunning=false;
let tool='road', selected=null, hoverNode=null, hoverMember=null, pointerWorld=null, stressMode=false, loadPathMode=false, measureMode=false, measureA=null, measureB=null, sim=null, anim=0, dragging=null;
let currentAnalysis=null, lastFullAnalysis=null, totalCost=0, lastBroken=new Set();
let buildFx=[],screenShake={power:0,until:0};
let stageClock={elapsed:0,startedAt:0,running:false,finalMs:null,raf:0,pausedForResult:false};
function formatStageTime(ms){
  ms=Math.max(0,Number(ms)||0);
  const totalCs=Math.floor(ms/10),cs=totalCs%100,totalSec=Math.floor(totalCs/100),sec=totalSec%60,min=Math.floor(totalSec/60);
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}
function getStageElapsed(){return stageClock.elapsed+(stageClock.running?(performance.now()-stageClock.startedAt):0)}
function paintStageClock(){
  if(!ui.stageTimerText||!ui.stageClockMetric)return;
  if(stage?.sandbox){ui.stageTimerText.textContent='--:--.--';ui.stageClockMetric.classList.remove('running','finished');ui.stageClockMetric.classList.add('paused');return}
  ui.stageTimerText.textContent=formatStageTime(stageClock.finalMs??getStageElapsed());
  ui.stageClockMetric.classList.toggle('running',stageClock.running);
  ui.stageClockMetric.classList.toggle('paused',!stageClock.running&&stageClock.finalMs===null);
  ui.stageClockMetric.classList.toggle('finished',stageClock.finalMs!==null);
}
function stageClockFrame(){paintStageClock();if(stageClock.running)stageClock.raf=requestAnimationFrame(stageClockFrame)}
function resetStageClock(autoStart=true){
  if(stageClock.raf)cancelAnimationFrame(stageClock.raf);
  stageClock={elapsed:0,startedAt:0,running:false,finalMs:null,raf:0,pausedForResult:false};
  paintStageClock();
  if(autoStart&&!stage?.sandbox)resumeStageClock();
}
function resumeStageClock(){
  if(stage?.sandbox||stageClock.running||stageClock.finalMs!==null)return;
  stageClock.startedAt=performance.now();stageClock.running=true;stageClock.pausedForResult=false;
  if(stageClock.raf)cancelAnimationFrame(stageClock.raf);stageClock.raf=requestAnimationFrame(stageClockFrame);paintStageClock();
}
function pauseStageClock(forResult=false){
  if(stageClock.running){stageClock.elapsed+=performance.now()-stageClock.startedAt;stageClock.running=false}
  if(stageClock.raf)cancelAnimationFrame(stageClock.raf);stageClock.raf=0;stageClock.pausedForResult=forResult;paintStageClock();
  return stageClock.elapsed;
}
function finalizeStageClock(){
  const ms=pauseStageClock(false);stageClock.finalMs=ms;paintStageClock();return ms;
}
function resumeClockAfterFailedResult(){if(stageClock.pausedForResult&&stageClock.finalMs===null&&!stage?.sandbox)resumeStageClock()}
let camera={x:W/2,y:H/2,zoom:1};
function readUIPref(key,fallback){
  const defaults=projectSettings.uiDefaults||{},defaultValue=Object.prototype.hasOwnProperty.call(defaults,key)?defaults[key]:fallback;
  try{const value=localStorage.getItem('trusslab-ui-'+key);return value===null?defaultValue:JSON.parse(value)}catch(_){return defaultValue}
}
function saveUIPref(key,value){try{localStorage.setItem('trusslab-ui-'+key,JSON.stringify(value))}catch(_){}}
let uiScale=String(readUIPref('scale','110'));
if(!['90','100','110','120'].includes(uiScale))uiScale='110';
let accessibilityPrefs={
  reducedMotion:!!readUIPref('reduced-motion',false),
  highContrast:!!readUIPref('high-contrast',false),
  colorblindStress:!!readUIPref('colorblind-stress',false),
  largeText:!!readUIPref('large-text',true)
};
function applyAccessibilitySettings(){
  document.body.dataset.uiScale=uiScale;
  document.body.classList.toggle('reduced-motion',accessibilityPrefs.reducedMotion);
  document.body.classList.toggle('high-contrast',accessibilityPrefs.highContrast);
  document.body.classList.toggle('colorblind-stress',accessibilityPrefs.colorblindStress);
  document.body.classList.toggle('large-text',accessibilityPrefs.largeText);
  $$('.uiScaleChoices [data-ui-scale]').forEach(b=>{const selected=b.dataset.uiScale===uiScale;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});
  $$('.settingToggleBtn').forEach(b=>{
    const key=b.dataset.accessibility,val=b.dataset.value==='on';
    let current=false;
    if(key==='reduced-motion')current=accessibilityPrefs.reducedMotion;
    else if(key==='high-contrast')current=accessibilityPrefs.highContrast;
    else if(key==='colorblind-stress')current=accessibilityPrefs.colorblindStress;
    else if(key==='large-text')current=accessibilityPrefs.largeText;
    else if(key==='sfx-setting')current=!!sfxEnabled;
    b.classList.toggle('active',current===val);
    b.setAttribute('aria-pressed',String(current===val));
  });
  requestAnimationFrame(()=>{resize?.();draw?.()});
}
function setUIScale(value){
  const next=String(value);if(!['90','100','110','120'].includes(next))return;
  uiScale=next;saveUIPref('scale',next);applyAccessibilitySettings();toast(`UI 크기 // ${next}%`);
}
function setAccessibilityPref(key,on,{silent=false}={}){
  const value=!!on;
  if(key==='reduced-motion'){accessibilityPrefs.reducedMotion=value;saveUIPref('reduced-motion',value)}
  else if(key==='high-contrast'){accessibilityPrefs.highContrast=value;saveUIPref('high-contrast',value)}
  else if(key==='colorblind-stress'){accessibilityPrefs.colorblindStress=value;saveUIPref('colorblind-stress',value)}
  else if(key==='large-text'){accessibilityPrefs.largeText=value;saveUIPref('large-text',value)}
  else if(key==='sfx-setting'){sfxEnabled=value;saveUIPref('sfx',value);updateSfxUI()}
  applyAccessibilitySettings();
  if(!silent)toast(`접근성 설정 변경 // ${value?'켜기':'끄기'}`);
}
let uiMode=readUIPref('mode','basic');
if(!['basic','advanced'].includes(uiMode))uiMode='basic';
let inspectorMode=readUIPref('inspector-mode','basic');
if(!['basic','detail'].includes(inspectorMode))inspectorMode='basic';
let tutorialPreviousUIMode=null;
function isAdvancedUI(){return uiMode==='advanced'}
function updateInspectorModeUI(){
  const chip=$('#inspectorModeMenuState');
  if(chip){chip.textContent=inspectorMode==='detail'?'상세':'기본';chip.classList.toggle('on',inspectorMode==='basic')}
  $$('.inspectorModeChoice').forEach(b=>b.classList.toggle('active',b.dataset.inspectorMode===inspectorMode));
}
function setInspectorMode(mode,{persist=true,silent=false}={}){
  if(!['basic','detail'].includes(mode))return;
  inspectorMode=mode;if(persist)saveUIPref('inspector-mode',mode);updateInspectorModeUI();
  if(pointerWorld&&ui.inspector?.classList.contains('show')){const r=canvas.getBoundingClientRect();updateInspector(r.left+(pointerWorld.x-camera.x)*camera.zoom+canvas.width/2,r.top+(pointerWorld.y-camera.y)*camera.zoom+canvas.height/2,pointerWorld)}
  if(!silent)toast(`마우스 검사 정보 // ${mode==='detail'?'상세':'기본'}`);
}
function updateUIModeUI(){
  document.body.classList.toggle('ui-basic',uiMode==='basic');
  document.body.classList.toggle('ui-advanced',uiMode==='advanced');
  const quick=$('#uiModeQuickBtn');
  if(quick){quick.setAttribute('aria-checked',String(uiMode==='advanced'));quick.classList.toggle('basic',uiMode==='basic');quick.classList.toggle('advanced',uiMode==='advanced');quick.title=uiMode==='basic'?'현재 기본 모드 · 클릭하여 고급 모드 열기':'현재 고급 모드 · 클릭하여 기본 모드로 단순화'}
  const chip=$('#uiModeMenuState');if(chip){chip.textContent=uiMode==='basic'?'기본':'고급';chip.classList.toggle('on',uiMode==='basic')}
  $$('.uiModeChoice').forEach(b=>b.classList.toggle('active',b.dataset.uiMode===uiMode));
  const state=$('#uiSettingsState'),desc=$('#uiSettingsDesc');
  if(state)state.textContent=uiMode==='basic'?'기본 모드 사용 중':'고급 모드 사용 중';
  if(desc)desc.textContent=uiMode==='basic'?'핵심 건설 도구와 하중 경로만 표시됩니다.':'스캔 · 응력 · 반력 · 실시간 계측 · 해석 정보가 모두 표시됩니다.';
  const hint=$('.rightTools .hint');if(hint)hint.textContent=uiMode==='basic'?'좌클릭: 연속 설치 · 우클릭: 종료 · 1–5: 재료/도로 · T: 시험 · L: 하중 경로':'좌클릭: 연속 설치 · 우클릭: 종료 · 1–7: 도구 · T: 시험 · S: 스캔 · R: 거리 측정 · 휠: 확대/축소';
}
function setUIMode(mode,{persist=true,silent=false}={}){
  if(!['basic','advanced'].includes(mode))return;
  uiMode=mode;
  if(mode==='basic'&&!tutorialMode){
    stressMode=false;measureMode=false;measureA=null;measureB=null;selected=null;
    $('#stressBtn')?.classList.remove('isOn');$('#measureBtn')?.classList.remove('isOn');updateMeasureTag?.();hideInspector?.();
    if(tool==='move'||tool==='delete'){
      tool='road';$$('.toolBtn').forEach(b=>{const on=b.dataset.tool===tool;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
    }
  }
  if(persist&&!tutorialMode)saveUIPref('mode',mode);
  updateUIModeUI();updateModeBadge?.();draw?.();
  if(!silent)toast(mode==='basic'?'UI 모드 // 기본 · 핵심 설계 정보만 표시':'UI 모드 // 고급 · 전체 구조해석 도구 표시');
}
let gridVisible=readUIPref('grid',true), snapEnabled=readUIPref('snap',true), simSpeed=readUIPref('speed',1);
if(![.5,1,1.5,2].includes(simSpeed))simSpeed=1;

let sfxEnabled=readUIPref('sfx',true),audioCtx=null;
function ensureAudio(){
  if(!sfxEnabled)return null;
  try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}catch(_){return null}
}
function playTone(freq=440,dur=.05,vol=.016,type='sine',delay=0,slide=0){
  const ac=ensureAudio();if(!ac)return;
  const t=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.02)
}
function playSfx(name){
  if(!sfxEnabled)return;
  if(name==='click'){playTone(530,.035,.008,'square');playTone(710,.025,.005,'sine',.018)}
  else if(name==='select'){playTone(390,.045,.009,'triangle');playTone(620,.045,.008,'triangle',.03)}
  else if(name==='node'){playTone(760,.05,.012,'sine');playTone(1040,.04,.008,'sine',.035)}
  else if(name==='place'){playTone(310,.07,.012,'triangle');playTone(540,.06,.011,'triangle',.045);playTone(820,.035,.006,'sine',.085)}
  else if(name==='test'){playTone(145,.11,.018,'triangle',0,85);playTone(290,.08,.009,'sine',.07)}
  else if(name==='break'){playTone(190,.095,.02,'sawtooth',0,-95);playTone(92,.12,.011,'triangle',.03)}
  else if(name==='success'){playTone(392,.10,.012,'triangle');playTone(523,.10,.012,'triangle',.09);playTone(659,.14,.012,'triangle',.18);playTone(784,.16,.009,'sine',.27)}
  else if(name==='fail'){playTone(260,.12,.012,'triangle');playTone(196,.15,.012,'triangle',.09);playTone(130,.18,.012,'triangle',.19)}
  else if(name==='stage'){playTone(440,.06,.009,'sine');playTone(660,.07,.009,'sine',.055)}
}
function updateSfxUI(){const b=$('#sfxBtn'),s=$('#sfxState');if(b)b.classList.toggle('isOn',sfxEnabled);if(s){s.textContent=sfxEnabled?'켜짐':'꺼짐';s.classList.toggle('on',sfxEnabled)}}
function showStageFlash(title,sub='WORKSPACE READY'){
  const el=$('#stageFlash');if(!el||tutorialMode||stage?.sandbox)return;
  el.querySelector('b').textContent=title;el.querySelector('span').textContent=sub;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(showStageFlash.t);showStageFlash.t=setTimeout(()=>el.classList.remove('show'),1300);if(audioCtx)playSfx('stage')
}

function resize(){
  const r=canvas.getBoundingClientRect(); dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  canvas.width=Math.round(r.width*dpr); canvas.height=Math.round(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  scaleX=r.width/W; scaleY=r.height/H;
  draw();
}
window.addEventListener('resize',resize);

function worldToScreen(p){const r=canvas.getBoundingClientRect(),sx=r.width/W,sy=r.height/H;return {x:(W/2+(p.x-camera.x)*camera.zoom)*sx,y:(H/2+(p.y-camera.y)*camera.zoom)*sy};}
function screenToWorld(x,y){const r=canvas.getBoundingClientRect(),sx=r.width/W,sy=r.height/H;const wx=(x-r.left)/Math.max(sx,1e-6),wy=(y-r.top)/Math.max(sy,1e-6);return {x:camera.x+(wx-W/2)/camera.zoom,y:camera.y+(wy-H/2)/camera.zoom};}
function applyCamera(){ctx.translate(W/2,H/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y)}
function updateZoomText(){const z=$('#zoomText');if(z)z.textContent=`${Math.round(camera.zoom*100)}%`}
function resetCamera(){camera={x:W/2,y:H/2,zoom:1};updateZoomText();draw()}
function panCamera(dx,dy){camera.x=clamp(camera.x+dx/camera.zoom,280,920);camera.y=clamp(camera.y+dy/camera.zoom,220,500);draw()}
function zoomCamera(factor,anchorScreen=null){const old=camera.zoom;const next=clamp(old*factor,.65,1.8);if(Math.abs(next-old)<1e-6)return;if(anchorScreen){const before=screenToWorld(anchorScreen.x,anchorScreen.y);camera.zoom=next;const after=screenToWorld(anchorScreen.x,anchorScreen.y);camera.x+=before.x-after.x;camera.y+=before.y-after.y;}else camera.zoom=next;camera.x=clamp(camera.x,280,920);camera.y=clamp(camera.y,220,500);updateZoomText();draw()}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function getCollapseDeflLimit(s=stage){return Number.isFinite(s?.collapseDeflLimit)?s.collapseDeflLimit:(s?.maxDefl||0)*2.2}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function snap(v,g=25){const step=snapEnabled?g:5;return Math.round(v/step)*step}
function toast(msg){ui.toast.textContent=msg;ui.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>ui.toast.classList.remove('show'),1600)}
function pointInRect(p,r){return p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h}
function pointInRectInclusive(p,r){return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h}
function orient(a,b,c){const v=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return Math.abs(v)<1e-8?0:(v>0?1:-1)}
function onSegment(a,b,p){return Math.min(a.x,b.x)-1e-8<=p.x&&p.x<=Math.max(a.x,b.x)+1e-8&&Math.min(a.y,b.y)-1e-8<=p.y&&p.y<=Math.max(a.y,b.y)+1e-8&&orient(a,b,p)===0}
function segmentsIntersect(a,b,c,d){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);if(o1!==o2&&o3!==o4)return true;if(o1===0&&onSegment(a,b,c))return true;if(o2===0&&onSegment(a,b,d))return true;if(o3===0&&onSegment(c,d,a))return true;if(o4===0&&onSegment(c,d,b))return true;return false}
function segmentIntersectsRect(a,b,r){
  if(pointInRectInclusive(a,r)||pointInRectInclusive(b,r))return true;
  const tl={x:r.x,y:r.y},tr={x:r.x+r.w,y:r.y},br={x:r.x+r.w,y:r.y+r.h},bl={x:r.x,y:r.y+r.h};
  return segmentsIntersect(a,b,tl,tr)||segmentsIntersect(a,b,tr,br)||segmentsIntersect(a,b,br,bl)||segmentsIntersect(a,b,bl,tl);
}
function expandedRect(r,pad=0){return {x:r.x-pad,y:r.y-pad,w:r.w+pad*2,h:r.h+pad*2}}
function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside;}return inside}
function pointSegmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;if(den<1e-9)return dist(p,a);const t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/den,0,1),q={x:a.x+t*vx,y:a.y+t*vy};return dist(p,q)}
function segmentSegmentDistance(a,b,c,d){if(segmentsIntersect(a,b,c,d))return 0;return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b))}
function segmentIntersectsPolygon(a,b,poly,pad=0){if(pointInPolygon(a,poly)||pointInPolygon(b,poly))return true;for(let i=0;i<poly.length;i++){const c=poly[i],d=poly[(i+1)%poly.length];if(segmentsIntersect(a,b,c,d))return true;if(pad>0&&segmentSegmentDistance(a,b,c,d)<=pad)return true;}return false}
function sampleCurve(points,t){
  if(t<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++){
    const [t1,v1]=points[i], [t0,v0]=points[i-1];
    if(t<=t1){const u=(t-t0)/((t1-t0)||1e-9);return v0+(v1-v0)*u}
  }
  return points.at(-1)[1];
}
function shipGeometry(ship){
  const Wv=(ship.length||230)*.9,Hv=(ship.height||90)*2.25;
  const widthKeys=[
    [-.99,.035],[-.94,.06],[-.88,.07],[-.80,.17],[-.72,.17],[-.68,.28],[-.58,.28],[-.53,.36],[-.34,.36],[-.30,.43],[-.05,.43],[.18,.38],[.29,.26],[.36,.02]
  ];
  const halfWidthAt=y=>Wv*sampleCurve(widthKeys,y/Hv);
  const virtualLength=Wv*1.9;
  const station01=s=>clamp(s/virtualLength,0,1);
  const beamAtStation=s=>{
    const u=station01(s);
    const bow=Math.pow(Math.sin(Math.PI*clamp(u,0,1)),.58);
    const stern=1-.18*Math.max(0,(u-.72)/.28);
    return Wv*(.10+.90*bow)*stern;
  };
  const depthAt=y=>{
    const yy=y/Hv;
    if(yy<-.82)return virtualLength*.38;
    if(yy<-.62)return virtualLength*.56;
    if(yy<-.34)return virtualLength*.72;
    if(yy<-.02)return virtualLength*.88;
    return virtualLength;
  };
  const silhouette=(samples=56)=>{
    const ys=[];for(let i=0;i<samples;i++)ys.push(-Hv*.99+(Hv*1.35)*(i/(samples-1)));
    const left=ys.map(y=>[-halfWidthAt(y),y]);
    const right=ys.slice().reverse().map(y=>[halfWidthAt(y),y]);
    return [...left,...right];
  };
  return {Wv,Hv,virtualLength,halfWidthAt,depthAt,beamAtStation,station01,silhouette};
}
function getNavigationEnvelope(r=null){
  const nav=stage?.navigationClearance;
  if(nav){
    const top=Number.isFinite(nav.sweepTop)?nav.sweepTop:(nav.waterY-nav.minHeight);
    const bottom=Number.isFinite(nav.sweepBottom)?nav.sweepBottom:nav.waterY;
    const width=nav.minWidth||r?.w||280;
    const centerX=nav.centerX??(r?r.x+r.w*.5:W*.5);
    return {x:centerX-width*.5,y:top,w:width,h:bottom-top,top,bottom,waterY:nav.waterY??bottom,minWidth:width,minHeight:nav.minHeight??(bottom-top)};
  }
  if(r)return {x:r.x,y:r.y,w:r.w,h:r.h,top:r.y,bottom:r.y+r.h,waterY:r.y+r.h,minWidth:r.w,minHeight:r.h};
  return null;
}
function memberClearancePad(matKey){
  const m=MAT[matKey];
  if(!m)return 3;
  if(matKey==='road'||matKey==='roadHeavy')return (m.roadWidth||16)*.5+2;
  if(matKey==='steel')return 5;
  if(matKey==='wood')return 4.5;
  if(matKey==='cable')return 2.2;
  return 3;
}
function pointRectDistance(p,r){
  const dx=Math.max(r.x-p.x,0,p.x-(r.x+r.w)),dy=Math.max(r.y-p.y,0,p.y-(r.y+r.h));
  return Math.hypot(dx,dy);
}
function segmentRectDistance(a,b,r){
  if(segmentIntersectsRect(a,b,r))return 0;
  const tl={x:r.x,y:r.y},tr={x:r.x+r.w,y:r.y},br={x:r.x+r.w,y:r.y+r.h},bl={x:r.x,y:r.y+r.h};
  return Math.min(segmentSegmentDistance(a,b,tl,tr),segmentSegmentDistance(a,b,tr,br),segmentSegmentDistance(a,b,br,bl),segmentSegmentDistance(a,b,bl,tl));
}
function pointBlockedByForbidden(p){
  return stage.forbidden.some(r=>r.kind==='navigation'?pointInRectInclusive(p,getNavigationEnvelope(r)):pointInRect(p,r));
}
function segmentBlockedByForbidden(a,b,pad=0){
  return stage.forbidden.some(r=>r.kind==='navigation'?segmentIntersectsRect(a,b,expandedRect(getNavigationEnvelope(r),pad)):segmentIntersectsRect(a,b,expandedRect(r,pad)));
}
function connectionBlocked(a,b,mat=tool){
  return segmentBlockedByForbidden(a,b,memberClearancePad(mat));
}
function vesselSweptSlice(progress){
  if(!stage.ship)return null;
  const r=stage.forbidden.find(x=>x.kind==='navigation');
  const env=getNavigationEnvelope(r);if(!env)return null;
  const bandH=clamp(env.h*.28,56,84),u=clamp(progress||0,0,1);
  const y=env.y+(env.h-bandH)*(1-u);
  return {x:env.x,y,w:env.w,h:bandH,envelope:env};
}
function vesselCollisionGeometry(analysis=null,physics=null){
  const segments=[],points=[],seen=new Set();
  const addPoint=(id,p)=>{if(!p||seen.has(id))return;seen.add(id);points.push({p,id,pad:5})};
  if(physics){
    for(const c of physics.constraints||[]){
      if(c.broken)continue;const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);if(!a||!b)continue;
      segments.push({a,b,pad:memberClearancePad(c.m.mat),member:c.m});addPoint(c.a,a);addPoint(c.b,b);
    }
    for(const rope of physics.ropeChains||[]){
      for(let i=0;i<rope.ids.length-1;i++){
        if(rope.broken&&i===rope.breakIndex)continue;
        const a=collapseParticle(physics,rope.ids[i]),b=collapseParticle(physics,rope.ids[i+1]);if(!a||!b)continue;
        segments.push({a,b,pad:memberClearancePad('cable'),member:rope.m});addPoint(rope.ids[i],a);addPoint(rope.ids[i+1],b);
      }
    }
    return {segments,points};
  }
  const broken=sim?.broken||lastBroken||new Set();
  const pos=n=>{
    let x=n.x,y=n.y;
    if(analysis?.ok){const i=analysis.index.get(n.id);if(i!=null){x+=analysis.U[2*i];y+=analysis.U[2*i+1]}}
    return {x,y};
  };
  for(const m of members){
    if(broken.has(m.id))continue;const na=nodeById(m.a),nb=nodeById(m.b);if(!na||!nb)continue;
    const a=pos(na),b=pos(nb);segments.push({a,b,pad:memberClearancePad(m.mat),member:m});addPoint(m.a,a);addPoint(m.b,b);
  }
  return {segments,points};
}
function evaluateVesselSweptClearance(progress,analysis=null,physics=null){
  const sweep=vesselSweptSlice(progress);if(!sweep)return {collision:false,clearance:Infinity,sweep:null};
  const geo=vesselCollisionGeometry(analysis,physics);let min=Infinity,collision=false;
  for(const seg of geo.segments){
    const expanded=expandedRect(sweep,seg.pad);
    if(segmentIntersectsRect(seg.a,seg.b,expanded)){collision=true;min=0;break}
    min=Math.min(min,Math.max(0,segmentRectDistance(seg.a,seg.b,sweep)-seg.pad));
  }
  if(!collision){for(const q of geo.points){const expanded=expandedRect(sweep,q.pad);if(pointInRectInclusive(q.p,expanded)){collision=true;min=0;break}min=Math.min(min,Math.max(0,pointRectDistance(q.p,sweep)-q.pad));}}
  return {collision,clearance:Number.isFinite(min)?min:Infinity,sweep};
}
function nodeMoveKeepsClear(n,q){
  return members.filter(m=>m.user&&(m.a===n.id||m.b===n.id)).every(m=>{
    const other=nodeById(m.a===n.id?m.b:m.a);
    return !connectionBlocked(q,other,m.mat);
  });
}
function nodeById(id){return nodes.find(n=>n.id===id)}
function memberKey(a,b){return a<b?`${a}-${b}`:`${b}-${a}`}
function isRoadTool(t=tool){return t==='road'||t==='roadHeavy'}
function isBuildTool(t=tool){return ['wood','steel','cable','road','roadHeavy'].includes(t)}
function leftSupportId(){return 0}
function rightSupportId(){return stage.deck.length-1}
function guideDeckYAt(x){
  const d=stage.deck;let j=0;while(j<d.length-2&&x>d[j+1][0])j++;
  const den=d[j+1][0]-d[j][0]||1,t=clamp((x-d[j][0])/den,0,1);
  return d[j][1]*(1-t)+d[j+1][1]*t;
}
function roadReachableNodeIds(broken=new Set()){
  const adj=new Map();
  for(const m of members){if(!m.road||broken.has(m.id))continue;if(!adj.has(m.a))adj.set(m.a,[]);if(!adj.has(m.b))adj.set(m.b,[]);adj.get(m.a).push(m.b);adj.get(m.b).push(m.a)}
  const seen=new Set([leftSupportId()]),q=[leftSupportId()];
  while(q.length){const id=q.shift();for(const v of adj.get(id)||[])if(!seen.has(v)){seen.add(v);q.push(v)}}
  return seen;
}
function hasCompleteRoadPath(broken=new Set()){return roadReachableNodeIds(broken).has(rightSupportId())}
function findRoadSegmentAtX(x,broken=new Set()){
  const reachable=roadReachableNodeIds(broken);let best=null,bestScore=Infinity;
  for(const m of members){
    if(!m.road||broken.has(m.id)||!reachable.has(m.a)||!reachable.has(m.b))continue;
    const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)continue;
    const minX=Math.min(a.x,b.x)-3,maxX=Math.max(a.x,b.x)+3,dx=b.x-a.x;
    if(x<minX||x>maxX||Math.abs(dx)<5)continue;
    const t=clamp((x-a.x)/dx,0,1),y=a.y+(b.y-a.y)*t;
    const score=Math.abs(y-guideDeckYAt(x)) + Math.abs((a.x+b.x)/2-x)*.015;
    if(score<bestScore){bestScore=score;best={m,a,b,t,y}}
  }
  return best;
}

// Reusable contract-constraint gate. It centralizes restrictions so future
// contracts add data instead of one-off Stage-specific if chains.
const CONTRACT_CONSTRAINT_HANDLERS={
  MATERIAL_AVAILABILITY:({mat})=>['move','delete'].includes(mat)||((MAT[mat]?.enabled!==false)&&(!stage?.materials||stage.materials.includes(mat))),
  MAX_MEMBER_COUNT:()=>!Number.isFinite(stage?.maxMemberCount)||members.filter(m=>m.user).length<stage.maxMemberCount,
  MAX_CABLE_COUNT:({mat})=>mat!=='cable'||!Number.isFinite(stage?.maxCableCount)||members.filter(m=>m.user&&m.mat==='cable').length<stage.maxCableCount,
  BUILD_ENVELOPE:({a,b,mat})=>!a||!b||!connectionBlocked(a,b,mat)
};
function evaluateContractConstraint(code,ctx={}){const fn=CONTRACT_CONSTRAINT_HANDLERS[code];return fn?!!fn(ctx):true}
function materialAllowed(mat){return evaluateContractConstraint('MATERIAL_AVAILABILITY',{mat})}
function updateLevelToolAvailability(){
  $$('.toolBtn[data-tool]').forEach(b=>{const mat=b.dataset.tool,allowed=materialAllowed(mat);b.disabled=!allowed;b.classList.toggle('materialLocked',!allowed);if(!allowed)b.title=`이 계약에서는 사용할 수 없음 // ${koMaterialLabel(mat)}`});
  if(!materialAllowed(tool)){tool=(stage.materials||[]).includes('road')?'road':(stage.materials||[])[0]||'road';selected=null;$$('.toolBtn').forEach(b=>{const on=b.dataset.tool===tool;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))})}
}
function resetStage(idx=stageIndex){
  setGamePhase(GAME_PHASE.BUILD);
  if(tutorialMode)leaveTutorialVisualMode();
  tutorialMode=false;
  stageIndex=idx;stage=(currentCampaignLevelId&&currentLevelStageOverride)?currentLevelStageOverride:stages[idx];document.body.dataset.campaignActive=currentCampaignLevelId?'1':'0';nodes=[];members=[];history=[];redoHistory=[];selected=null;sim=null;currentAnalysis=null;lastFullAnalysis=null;totalCost=0;stressMode=false;loadPathMode=false;measureMode=false;measureA=null;measureB=null;lastBroken=new Set();$('#stressBtn')?.classList.remove('isOn');$('#loadPathBtn')?.classList.remove('isOn');$('#measureBtn')?.classList.remove('isOn');updateMeasureTag?.();hideInspector();hoverNode=null;hoverMember=null;pointerWorld=null;
  stage.deck.forEach((p,i)=>nodes.push({id:i,x:p[0],y:p[1],deck:true,support:i===0?'pin':i===stage.deck.length-1?'roller':null,user:false,visible:i===0||i===stage.deck.length-1,activated:false}));
  let nextId=stage.deck.length;
  for(const sup of (stage.extraSupports||[]))nodes.push({id:nextId++,x:sup.x,y:sup.y,deck:false,support:sup.type||'roller',user:false,visible:true,activated:true,optionalSupport:!!sup.optional});
  updateLevelToolAvailability();updateHUD();setCoach('start');draw();
  $$('.stageBtn').forEach((b,i)=>b.classList.toggle('active',i===idx));
  resetStageClock(!stage.sandbox);
  if(!stage.sandbox)setTimeout(()=>showStageFlash(`${stage.name} // ${difficultyMode==='easy'?'EASY':'HARD'}`,stage.title.toUpperCase()),80);
}

function captureState(){
  return JSON.stringify({
    nodes:nodes.filter(n=>n.user).map(n=>({...n})),
    activeDeck:nodes.filter(n=>n.deck&&n.activated).map(n=>n.id),
    members:members.filter(m=>m.user).map(m=>({...m}))
  });
}
function snapshot(){
  lastFullAnalysis=null; currentAnalysis=null;
  history.push(captureState());
  if(history.length>60)history.shift();
  // 새 편집을 시작하면 기존 redo 분기는 더 이상 유효하지 않다.
  redoHistory=[];
}
function restoreSnapshot(s){
  const data=typeof s==='string'?JSON.parse(s):s;
  // resetStage()를 쓰지 않고 현재 스테이지의 기본 상태만 다시 구성한다.
  // 그래야 undo/redo 스택을 유지할 수 있다.
  nodes=[]; members=[]; selected=null; dragging=null; sim=null; currentAnalysis=null; lastFullAnalysis=null; lastBroken=new Set();
  stage.deck.forEach((p,i)=>nodes.push({id:i,x:p[0],y:p[1],deck:true,support:i===0?'pin':i===stage.deck.length-1?'roller':null,user:false,visible:i===0||i===stage.deck.length-1,activated:false}));
  let nextBaseId=stage.deck.length;for(const sup of (stage.extraSupports||[]))nodes.push({id:nextBaseId++,x:sup.x,y:sup.y,deck:false,support:sup.type||'roller',user:false,visible:true,activated:true,optionalSupport:!!sup.optional});
  (data.activeDeck||[]).forEach(id=>{const n=nodeById(id);if(n){n.visible=true;n.activated=true}});
  for(const n of (data.nodes||[]))nodes.push({...n});
  for(const m of (data.members||[]))members.push({...m});
  updateHUD(); draw();
}
function undoAction(){
  if(sim||!history.length)return false;
  redoHistory.push(captureState());
  if(redoHistory.length>60)redoHistory.shift();
  restoreSnapshot(history.pop());
  toast('되돌리기 · Ctrl + Y로 다시 실행');
  return true;
}
function redoAction(){
  if(sim||!redoHistory.length)return false;
  history.push(captureState());
  if(history.length>60)history.shift();
  restoreSnapshot(redoHistory.pop());
  toast('다시 실행 · Ctrl + Z로 되돌리기');
  return true;
}
function cryptoRandom(){return Math.random().toString(36).slice(2,9)}

function calcCost(){let c=0;for(const m of members){if(!m.user)continue;const a=nodeById(m.a),b=nodeById(m.b);c+=dist(a,b)*MAT[m.mat].cost;}return Math.round(c/10)*10}
function triangleCount(){
  const adj=new Map(nodes.map(n=>[n.id,new Set()]));members.filter(m=>m.user).forEach(m=>{adj.get(m.a)?.add(m.b);adj.get(m.b)?.add(m.a)});let count=0;const ids=nodes.filter(n=>n.visible||n.user).map(n=>n.id);
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)for(let k=j+1;k<ids.length;k++) if(adj.get(ids[i])?.has(ids[j])&&adj.get(ids[j])?.has(ids[k])&&adj.get(ids[k])?.has(ids[i])) count++;
  return count;
}
function updateStageButtons(){
  const buttons=$$('.stageBtn');
  // Legacy Stage 01–04 remain available outside Campaign mode. Campaign mode
  // uses the data-driven contract map instead of treating the four solver
  // templates as four pieces of progression content.
  if(!currentCampaignLevelId){
    buttons.forEach((b,i)=>{b.disabled=false;b.classList.toggle('active',i===stageIndex);b.classList.remove('locked','complete');b.title=`Legacy Stage ${i+1}`});
    return;
  }
  const level=currentCampaignLevel();
  buttons.forEach((b,i)=>{
    const active=i===stageIndex;b.disabled=!active;b.classList.toggle('active',active);b.classList.toggle('locked',!active);b.classList.toggle('complete',!!level&&levelProgressFor(level.id).completed);
    b.title=active?`${level?.type==='bonus'?'Bonus':'Contract'} ${displayContractId(level)} // solver template ${i+1}`:'Campaign contracts are selected from LEVEL SELECT';
  });
}
function animateBuildFx(){if(!buildFx.length)return;draw();requestAnimationFrame(animateBuildFx)}
function triggerBuildFx(a,b,mat){const wasEmpty=!buildFx.length;buildFx.push({a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},mat,start:performance.now(),life:360});if(buildFx.length>18)buildFx.splice(0,buildFx.length-18);if(wasEmpty)requestAnimationFrame(animateBuildFx)}
function triggerNodeFx(p){const wasEmpty=!buildFx.length;buildFx.push({node:{x:p.x,y:p.y},start:performance.now(),life:300});if(buildFx.length>18)buildFx.splice(0,buildFx.length-18);if(wasEmpty)requestAnimationFrame(animateBuildFx)}
function kickShake(power=5,ms=180){screenShake.power=Math.max(screenShake.power,power);screenShake.until=Math.max(screenShake.until,performance.now()+ms)}
function drawBuildFx(){
  const now=performance.now();buildFx=buildFx.filter(f=>now-f.start<f.life);
  for(const f of buildFx){const t=clamp((now-f.start)/f.life,0,1),fade=1-t;ctx.save();
    if(f.node){ctx.strokeStyle=`rgba(98,225,174,${fade*.9})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.node.x,f.node.y,8+24*t,0,Math.PI*2);ctx.stroke();ctx.fillStyle=`rgba(240,216,75,${fade*.35})`;ctx.beginPath();ctx.arc(f.node.x,f.node.y,5+8*t,0,Math.PI*2);ctx.fill()}
    else{const q=.12+.88*(1-Math.pow(1-t,3)),x=f.a.x+(f.b.x-f.a.x)*q,y=f.a.y+(f.b.y-f.a.y)*q;ctx.lineCap='round';ctx.lineWidth=f.mat==='cable'?4:(MAT[f.mat]?.roadWidth||9)+3;ctx.strokeStyle=`rgba(255,255,255,${fade*.32})`;ctx.beginPath();ctx.moveTo(f.a.x,f.a.y);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=`rgba(98,225,174,${fade*.9})`;ctx.beginPath();ctx.arc(x,y,3+3*fade,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }
}

function drawInteractionReticle(){
  if(!pointerWorld||sim||measureMode||tool==='delete')return;
  let target=null,kind='격자';
  const n=findNode(pointerWorld,19);
  if(n){target={x:n.x,y:n.y};kind=n.support?'지지점':(n.deck?'도로 관절':'관절')}
  else if(['wood','steel','cable','road','roadHeavy'].includes(tool)){
    const dn=nearestDeckJoint(pointerWorld);if(dn){target={x:dn.x,y:dn.y};kind='도로 가이드'}else target={x:snap(pointerWorld.x),y:snap(pointerWorld.y)};
  }else if(tool==='move'&&hoverNode){target={x:hoverNode.x,y:hoverNode.y};kind='관절 이동'}
  if(!target)return;
  let valid=canPlace(target)||!!n;
  if(selected&&['wood','steel','cable','road','roadHeavy'].includes(tool)&&dist(selected,target)>3)valid=valid&&!connectionBlocked(selected,target,tool);
  const pulse=.5+.5*Math.sin(anim*.13);
  ctx.save();
  ctx.strokeStyle=valid?`rgba(98,225,174,${.48+.22*pulse})`:'rgba(237,102,119,.7)';ctx.lineWidth=1.4;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(target.x,target.y,10+2*pulse,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(target.x-18,target.y);ctx.lineTo(target.x-7,target.y);ctx.moveTo(target.x+7,target.y);ctx.lineTo(target.x+18,target.y);ctx.moveTo(target.x,target.y-18);ctx.lineTo(target.x,target.y-7);ctx.moveTo(target.x,target.y+7);ctx.lineTo(target.x,target.y+18);ctx.stroke();
  const label=`${kind} // ${Math.round(target.x)}, ${Math.round(target.y)}`;ctx.font='800 8px ui-monospace,monospace';const w=ctx.measureText(label).width+12;ctx.fillStyle='rgba(7,12,15,.78)';ctx.fillRect(target.x+14,target.y-24,w,16);ctx.fillStyle=valid?'rgba(171,239,210,.88)':'rgba(247,153,166,.92)';ctx.fillText(label,target.x+20,target.y-13);ctx.restore();
}

function updateTestTelemetry(){
  const panel=$('#testTelemetry'),frame=$('#testDangerFrame');
  if(!panel||!frame)return;
  if(!sim||tutorialMode){panel.hidden=true;frame.style.opacity='0';frame.classList.remove('danger');return}
  panel.hidden=false;
  const dynamic=sim.mode==='collapse';
  const mode=$('#telemetryMode');if(mode){mode.textContent=dynamic?'동적 물리':'정적 해석';mode.classList.toggle('dynamic',dynamic)}
  let progress=clamp(sim.progress||0,0,1),ratio=sim.maxRatio||0,defl=sim.maxDefl||0,deckDefl=sim.maxDeckDefl||0,deckCurvature=sim.maxDeckCurvature||0,contact='도로 접촉';
  if(dynamic&&sim.physics){
    const v=sim.physics.vehicle;
    if(v){const x0=stage.deck[0][0],x1=stage.deck.at(-1)[0];progress=clamp((v.x-x0)/Math.max(1,x1-x0),0,1);contact=v.attached?'도로 접촉':'공중 이탈'}
    defl=Math.max(defl,sim.physics.maxDrop||0);
    const dm=collapseDeckMetrics(sim.physics);deckDefl=Math.max(deckDefl,dm.deckDeflection);deckCurvature=Math.max(deckCurvature,dm.deckCurvature);
  }else if(sim.last?.ok){ratio=Math.max(ratio,sim.last.maxRatio||0);defl=Math.max(defl,sim.last.maxDefl||0);deckDefl=sim.last.deckDeflection||deckDefl;deckCurvature=sim.last.deckCurvature||deckCurvature}
  const serviceLimit=Math.max(1,stage.maxDefl),collapseLimit=Math.max(serviceLimit,getCollapseDeflLimit(stage));
  const pPct=Math.round(progress*100),stressPct=Math.round(ratio*100),servicePct=defl/serviceLimit*100,collapsePct=defl/collapseLimit*100;
  const setText=(id,value,level='')=>{const el=$(id);if(!el)return;el.textContent=value;el.className=level};
  $('#telemetryProgressFill').style.width=`${pPct}%`;setText('#telemetryProgressText',`${pPct}%`);
  const stressLevel=stressPct>=100?'danger':stressPct>=80?'warn':'';setText('#telemetryStressText',`${stressPct}%`,stressLevel);
  const sb=$('#telemetryStressBar');sb.style.width=`${clamp(stressPct,0,100)}%`;sb.className=stressLevel;
  const deflLevel=collapsePct>=90?'danger':servicePct>=100?'caution':servicePct>=80?'warn':'';
  setText('#telemetryDeflText',defl.toFixed(1),deflLevel);
  setText('#telemetryServiceLimitText',serviceLimit.toFixed(1),servicePct>=100?'caution':servicePct>=80?'warn':'');
  setText('#telemetryCollapseLimitText',collapseLimit.toFixed(1),collapsePct>=90?'danger':'');
  const db=$('#telemetryDeflBar');db.style.width=`${clamp(collapsePct,0,100)}%`;db.className=deflLevel;
  const deckDeflLevel=deckDefl>serviceLimit?'caution':deckDefl>serviceLimit*.8?'warn':'';
  const deckCurveLevel=deckCurvature>2.4?'danger':deckCurvature>1.25?'warn':'';
  setText('#telemetryDeckDeflText',`${deckDefl.toFixed(1)} u`,deckDeflLevel);
  setText('#telemetryDeckCurvatureText',`${deckCurvature.toFixed(2)}°/100u`,deckCurveLevel);
  setText('#telemetryBrokenText',String(sim.brokenCount||sim.broken?.size||0),(sim.brokenCount||sim.broken?.size||0)?'danger':'');
  setText('#telemetryContact',contact,contact==='공중 이탈'?'danger':'');
  const vesselGroup=$('#telemetryVesselGroup');
  if(vesselGroup){
    vesselGroup.hidden=!stage.ship;
    if(stage.ship){
      const vp=Math.round(clamp(sim.shipProgress||0,0,1)*100),vc=sim.vesselClearance,vm=sim.minVesselClearance;
      const clearanceLevel=sim.vesselCollision?'danger':Number.isFinite(vc)&&vc<18?'warn':'';
      setText('#telemetryVesselClearanceText',sim.vesselCollision?'충돌':(Number.isFinite(vc)?`${vc.toFixed(1)} u`:'—'),clearanceLevel);
      setText('#telemetryVesselProgressText',`${vp}%`,sim.vesselCollision?'danger':'');
      setText('#telemetryVesselMinText',Number.isFinite(vm)?`${Math.max(0,vm).toFixed(1)} u`:'—',sim.vesselCollision?'danger':Number.isFinite(vm)&&vm<18?'warn':'');
    }
  }
  const serviceHazard=defl/Math.max(1,stage.maxDefl),collapseHazard=defl/Math.max(1,getCollapseDeflLimit(stage));
  const vesselHazard=stage.ship&&sim.vesselCollision?1.25:(stage.ship&&Number.isFinite(sim.vesselClearance)?clamp(1-sim.vesselClearance/45,0,.95):0);
  const hazard=Math.max(clamp(ratio,0,1.25),clamp(serviceHazard*.82,0,1.15),clamp(collapseHazard,0,1.25),vesselHazard,dynamic ? .92 : 0);
  frame.style.opacity=String(clamp((hazard-.66)*.72,0,.34));frame.classList.toggle('danger',collapseHazard>=.9||dynamic||!!sim.vesselCollision);
}

function resultAchievements(success,s){
  const underBudget=totalCost<=stage.budget, noFracture=(s.brokenCount||0)===0, stiff=(s.maxDefl||0)<=stage.maxDefl*.58;
  const earned=[underBudget,noFracture,stiff].filter(Boolean).length;
  const html=`<div class="achievementStrip">
    <div class="achievement ${underBudget?'earned':'missed'}"><b>예산 관리</b><span>${underBudget?'기본 예산 이내':'기본 예산 초과'}</span></div>
    <div class="achievement ${noFracture?'earned':'missed'}"><b>무파단</b><span>${noFracture?'부재 파단 없음':'부재 파단 발생'}</span></div>
    <div class="achievement ${stiff?'earned':'missed'}"><b>바닥판 강성</b><span>${stiff?'처짐 낮음':'처짐 큼'}</span></div>
  </div>`;
  return {html,earned};
}

function updateHUD(){
  totalCost=calcCost(); ui.stageName.textContent=tutorialMode?'튜토리얼 · 훈련':(stage.sandbox?stage.name:`${stage.name} · ${difficultyMode==='easy'?'쉬움':'어려움'}`);ui.loadText.textContent=`${Math.round(stage.load/1000)} kN`;
  const ctxSet=$('#topContextSet'),ctxTitle=$('#topContextTitle'),campaignLevel=currentCampaignLevel?.();
  if(ctxSet)ctxSet.textContent=tutorialMode?'훈련 // 단계별 안내':stage.sandbox?'샌드박스 // 자유 실험':campaignLevel?`세트 ${String(getGameSet(campaignLevel.setId)?.number||1).padStart(2,'0')} // ${campaignLevel.type==='bonus'?'보너스':'계약'} ${displayContractId(campaignLevel)}`:`${stage.name} // ${difficultyMode==='easy'?'쉬움':'어려움'}`;
  if(ctxTitle)ctxTitle.textContent=tutorialMode?'구조 설계 훈련':stage.sandbox?'구조 실험실':stage.title;
  ui.budgetText.textContent=stage.sandbox?`₩${totalCost.toLocaleString()} · 자유 설계`:`₩${totalCost.toLocaleString()} / ₩${stage.budget.toLocaleString()} (최대 ₩${(stage.budget*2).toLocaleString()})`; ui.budgetText.className=totalCost<=stage.budget?'good':totalCost<=stage.budget*2?'warn':'bad';
  if(ui.budgetRail&&ui.budgetRailFill){const cap=stage.sandbox?Math.max(totalCost,1):stage.budget*2;const pct=stage.sandbox?0:clamp(totalCost/cap*100,0,100);ui.budgetRailFill.style.width=`${pct}%`;ui.budgetRail.classList.toggle('warn',!stage.sandbox&&totalCost>stage.budget&&totalCost<=stage.budget*2);ui.budgetRail.classList.toggle('bad',!stage.sandbox&&totalCost>stage.budget*2);ui.budgetRail.style.opacity=stage.sandbox?'.25':'1'}
  updateStageButtons();
  ui.test?.classList.toggle('testReady',stage.sandbox||totalCost<=stage.budget*2);
  
}

function coachMemberNumber(m){
  const list=members.filter(x=>x.user),i=list.findIndex(x=>x.id===m?.id);
  return i>=0?i+1:'—';
}
function coachNodeNumber(n){const i=nodes.findIndex(x=>x.id===n?.id);return i>=0?i+1:'—'}
function coachMaterialCode(mat){return ({wood:'WOOD',steel:'STEEL',cable:'CABLE',road:'ROAD',roadHeavy:'REINFORCED ROAD'})[mat]||String(mat||'—').toUpperCase()}
function coachZoneAtX(x){
  const x0=stage.deck[0][0],x1=stage.deck.at(-1)[0],t=clamp((x-x0)/Math.max(1,x1-x0),0,1);
  return t<.34?'LEFT SPAN':t>.66?'RIGHT SPAN':'MIDSPAN';
}
function coachPeakDeflection(a){
  if(!a?.ok||!a.index||!a.U)return null;
  let best=null;
  for(const n of nodes){
    const i=a.index.get(n.id);if(i==null)continue;
    const ux=a.U[2*i]||0,uy=a.U[2*i+1]||0,mag=Math.hypot(ux,uy);
    if(!best||mag>best.mag)best={node:n,ux,uy,mag,zone:coachZoneAtX(n.x)};
  }
  return best;
}
function coachRoadGapDiagnostic(broken=new Set()){
  if(hasCompleteRoadPath(broken))return null;
  const road=members.filter(m=>m.road&&!broken.has(m.id));
  if(!road.length)return {gap:Infinity,a:nodeById(leftSupportId()),b:nodeById(rightSupportId()),detail:'NO ROAD MEMBERS'};
  const reachable=roadReachableNodeIds(broken),roadIds=new Set([leftSupportId(),rightSupportId()]);
  road.forEach(m=>{roadIds.add(m.a);roadIds.add(m.b)});
  const A=[...reachable].map(nodeById).filter(Boolean),B=[...roadIds].filter(id=>!reachable.has(id)).map(nodeById).filter(Boolean);
  let best=null;
  for(const a of A)for(const b of B){const d=dist(a,b);if(!best||d<best.gap)best={gap:d,a,b,detail:'OPEN ROAD PATH'}}
  return best||{gap:Infinity,a:nodeById(leftSupportId()),b:nodeById(rightSupportId()),detail:'DISCONNECTED ROAD GRAPH'};
}
function coachReactionDiagnostic(a){
  if(!a?.ok||!a.reactions)return null;
  const l=nodeById(leftSupportId()),r=nodeById(rightSupportId()),rl=a.reactions.get(l?.id),rr=a.reactions.get(r?.id);if(!rl||!rr)return null;
  const left=Math.max(0,rl.ry||0),right=Math.max(0,rr.ry||0),sum=left+right;if(sum<1)return null;
  const x0=stage.deck[0][0],x1=stage.deck.at(-1)[0],t=clamp(((a.loadX??((x0+x1)/2))-x0)/Math.max(1,x1-x0),0,1);
  const expectedLeft=1-t,actualLeft=left/sum,error=Math.abs(actualLeft-expectedLeft);
  return {left,right,sum,actualLeft,actualRight:right/sum,expectedLeft,expectedRight:t,error};
}
function coachRedundancyDiagnostic(a){
  if(!a?.ok||!a.forces)return null;
  let critical=null,criticalInfo=null;
  for(const m of members){
    if(!m.user||m.road)continue;const info=a.forces.get(m.id);if(!info)continue;
    if(!criticalInfo||info.ratio>criticalInfo.ratio){critical=m;criticalInfo=info}
  }
  if(!critical||!criticalInfo)return null;
  const baseBroken=new Set(sim?.broken||lastBroken||[]);baseBroken.add(critical.id);
  const alt=assemble(a.loadX,baseBroken);
  if(!alt.ok)return {level:'LOW',critical,criticalInfo,alternate:false,amplification:Infinity};
  const amplification=alt.maxRatio/Math.max(.01,a.maxRatio||criticalInfo.ratio||.01);
  return {level:(alt.maxRatio>1||amplification>1.55)?'LIMITED':'AVAILABLE',critical,criticalInfo,alternate:true,amplification,alternateMax:alt.maxRatio};
}
function coachNavigationDiagnostic(a,s=null){
  if(!stage.ship)return null;
  if(s&&Number.isFinite(s.minVesselClearance))return {clearance:s.minVesselClearance,collision:!!s.vesselCollision,source:'TEST'};
  if(!a?.ok)return null;
  let clearance=Infinity,collision=false;
  for(let i=0;i<=10;i++){const q=evaluateVesselSweptClearance(i/10,a,null);clearance=Math.min(clearance,q.clearance);collision=collision||q.collision}
  return {clearance,collision,source:'SCAN'};
}
function coachLooseNodeDiagnostic(){
  const degree=new Map();members.forEach(m=>{degree.set(m.a,(degree.get(m.a)||0)+1);degree.set(m.b,(degree.get(m.b)||0)+1)});
  const candidates=nodes.filter(n=>(n.user||n.visible)&&!n.support&&(degree.get(n.id)||0)<2);
  if(!candidates.length)return null;const n=candidates[0];return {node:n,degree:degree.get(n.id)||0};
}
function coachMetricHTML(metrics){return `<div class="coachMetricGrid">${metrics.map(([k,v])=>`<div class="coachMetric"><span>${devLabel(k)}</span><b>${v}</b></div>`).join('')}</div>`}
function coachReportHTML(issue,secondary=null,source='구조 해석'){
  const metrics=issue.metrics?.length?coachMetricHTML(issue.metrics):'';
  const advice=(issue.advice||[]).slice(0,2).join(' · ');
  const secondaryHTML=secondary?`<div class="coachSecondary"><strong>추가 점검 //</strong> ${secondary}</div>`:'';
  return `<div class="coachReport"><div class="coachKicker">${source} // ${issue.kicker||'STRUCTURAL REVIEW'}</div><div class="coachHeadline">${issue.headline}</div>${metrics}<div class="coachFinding">${issue.reason}</div>${advice?`<div class="coachAdvice"><b>설계 개선안 //</b> ${advice}</div>`:''}${secondaryHTML}<div class="coachMeta">교육용 구조 해석을 바탕으로 한 제안입니다. 여러 설계안을 비교하며 개선해 보세요.</div></div>`;
}
function coachAnalyzeStructure(a,{simState=null,source='구조 해석',forceKey=null,deepCheck=true}={}){
  const issues=[];
  const broken=new Set(simState?.broken||lastBroken||[]);
  const roadGap=coachRoadGapDiagnostic(broken);
  if(roadGap){
    const pair=Number.isFinite(roadGap.gap)?`Node #${coachNodeNumber(roadGap.a)} ↔ Node #${coachNodeNumber(roadGap.b)}`:'LEFT SUPPORT ↔ RIGHT SUPPORT';
    issues.push({key:'road-gap',score:130,kicker:'ROAD CONTINUITY',headline:'ROAD PATH DISCONNECTED',metrics:[['NEAREST OPEN GAP',Number.isFinite(roadGap.gap)?`${roadGap.gap.toFixed(1)} u`:'NO ROAD'],['LOCATION',pair]],reason:'차량 하중을 전달할 연속 도로 경로가 양쪽 지지점 사이에 형성되지 않았습니다. 구조 부재가 연결되어 있어도 차량은 road member 위에서만 주행합니다.',advice:['끊어진 도로 구간을 먼저 연결하는 방안을 검토하세요.','도로 연결 후 SCAN으로 하중 경로가 이어지는지 다시 확인할 수 있습니다.']});
  }
  if(!a?.ok){
    const loose=coachLooseNodeDiagnostic();
    issues.push({key:'load-path',score:125,kicker:'STABILITY / LOAD PATH',headline:loose?`Node #${coachNodeNumber(loose.node)} — LOW CONNECTIVITY`:'STIFFNESS MATRIX // UNSTABLE',metrics:[['TRIANGLES',String(triangleCount())],['LOOSE NODE',loose?`DEGREE ${loose.degree}`:'NOT ISOLATED']],reason:loose?'이 관절에 연결된 독립 부재 수가 부족해 핀 접합 구조에서 기구처럼 움직일 가능성이 큽니다.':'현재 연결 형상에서 정적 stiffness solver가 안정된 변위 해를 만들지 못했습니다. 닫힌 하중 경로가 부족하거나 기구 형태가 포함되었을 가능성이 있습니다.',advice:['하중점에서 두 지지점까지 닫힌 삼각형 경로가 이어지는지 확인해보세요.','자유 관절 주변에 서로 다른 방향의 연결을 추가하는 방안을 비교해볼 수 있습니다.']});
    return issues[0];
  }
  const peak=coachPeakDeflection(a),service=stage.maxDefl||1;
  if(peak&&peak.mag>service*.78){
    const pct=peak.mag/service*100;
    issues.push({key:'deflection',score:pct>100?108:82,kicker:'SERVICEABILITY',headline:`Node #${coachNodeNumber(peak.node)} — ${peak.zone}`,metrics:[['MAX DEFLECTION',`${peak.mag.toFixed(1)} u`],['SERVICE LIMIT',`${service.toFixed(1)} u`],['LIMIT USAGE',`${pct.toFixed(0)}%`],['DECK DEFLECTION',`${(a.deckDeflection||0).toFixed(1)} u`]],reason:`최대 변형이 ${peak.zone==='MIDSPAN'?'중앙 경간':'경간의 한쪽 영역'}에서 발생합니다. 강도 여유가 남아 있어도 사용성 한계를 넘으면 차량 통과 여부와 별개로 SERVICEABILITY FAIL이 될 수 있습니다.`,advice:['상현재와 하현재 사이 구조 높이를 늘려 축력 기반 트러스 작용을 강화하는 방안을 검토하세요.','변형이 집중되는 구간의 삼각형 분할 또는 도로 지지 간격을 비교해보세요.']});
  }
  if(a.worst){
    const m=a.worst,info=a.forces.get(m.id);if(info){
      const tension=info.force>=0,util=info.ratio*100,num=coachMemberNumber(m),mat=coachMaterialCode(m.mat);
      if(!tension&&info.governing==='buckling'&&info.ratio>.62){
        issues.push({key:'buckling',score:util>=100?116:util>=90?102:88,kicker:'COMPRESSION BUCKLING',headline:`Member #${num} — ${mat}`,metrics:[['AXIAL FORCE',`${Math.abs(info.force/1000).toFixed(1)} kN C`],['허용 압축력',`${(info.capacity/1000).toFixed(1)} kN`],['UTILIZATION',`${util.toFixed(0)}%`],['LENGTH',`${info.length.toFixed(1)} u`],['EULER LIMIT',`${(info.eulerLimit/1000).toFixed(1)} kN`],['GOVERNING','EULER BUCKLING']],reason:`이 부재는 압축 자체가 문제가 아니라, 현재 길이에서 Euler 좌굴 한계가 재료 압축강도보다 먼저 지배합니다. Pcr은 (KL)²에 반비례하므로 유효길이가 증가할수록 허용력이 빠르게 감소합니다.`,advice:['중간 node나 가새로 유효길이를 줄이는 방법을 검토해보세요.','트러스 높이 또는 하중 경로를 조정해 이 부재에 집중되는 압축력을 낮출 수 있는지 비교해보세요.']});
      }else if(tension&&info.ratio>.72){
        issues.push({key:'tension',score:util>=100?114:util>=90?100:78,kicker:'TENSION UTILIZATION',headline:`Member #${num} — ${mat}`,metrics:[['AXIAL FORCE',`${Math.abs(info.force/1000).toFixed(1)} kN T`],['허용 인장력',`${(info.capacity/1000).toFixed(1)} kN`],['UTILIZATION',`${util.toFixed(0)}%`],['LENGTH',`${info.length.toFixed(1)} u`]],reason:`이 부재가 현재 하중 위치에서 가장 큰 인장 이용률을 보입니다. 파란색은 인장이라는 힘의 종류를 뜻하며, 위험 여부는 capacity 대비 utilization으로 판단합니다.`,advice:['인장력이 다른 대각선이나 하현재로 분산될 수 있는 연결을 비교해보세요.','같은 하중 경로에서 재료 선택과 부재 배치를 함께 비교해볼 수 있습니다.']});
      }else if(!tension&&info.ratio>.72){
        issues.push({key:'compression',score:util>=100?113:util>=90?99:77,kicker:'COMPRESSION UTILIZATION',headline:`Member #${num} — ${mat}`,metrics:[['AXIAL FORCE',`${Math.abs(info.force/1000).toFixed(1)} kN C`],['허용 압축력',`${(info.capacity/1000).toFixed(1)} kN`],['UTILIZATION',`${util.toFixed(0)}%`],['LENGTH',`${info.length.toFixed(1)} u`]],reason:'이 부재는 압축력 전달에 정상적으로 참여하고 있지만 capacity 대비 이용률이 높습니다. 빨간색 자체가 문제라는 뜻은 아니며, 현재 부재가 압축 하중 경로에서 상대적으로 큰 몫을 담당하고 있다는 의미입니다.',advice:['주변 압축 경로를 여러 부재로 분산할 수 있는지 검토해보세요.','부재 길이와 트러스 높이를 함께 바꿨을 때 이용률이 어떻게 달라지는지 비교해보세요.']});
      }
    }
  }
  const nav=coachNavigationDiagnostic(a,simState);
  if(nav&&(nav.collision||nav.clearance<30)){
    issues.push({key:'navigation',score:nav.collision?120:nav.clearance<15?96:72,kicker:'NAVIGATION CLEARANCE',headline:nav.collision?'VESSEL SWEPT ENVELOPE // COLLISION':'VESSEL CLEARANCE // LOW MARGIN',metrics:[['MIN CLEARANCE',nav.collision?'0.0 u':`${Math.max(0,nav.clearance).toFixed(1)} u`],['CHECK SOURCE',nav.source],['ENVELOPE','SWEPT GEOMETRY']],reason:nav.collision?'변형된 구조가 선박의 이동 전체 범위를 나타내는 swept clearance geometry와 겹쳤습니다.':'현재 변형 형상은 금지영역 밖에 있지만 선박 통항 여유가 작습니다. 추가 처짐이 발생하면 swept envelope와 가까워질 수 있습니다.',advice:['항로 상부 구조 높이와 도로 처짐을 함께 확인해보세요.','MIN CLEARANCE가 작은 위치의 구조 깊이 또는 지지 배치를 비교해보세요.']});
  }
  const red=deepCheck?coachRedundancyDiagnostic(a):null;
  if(red&&red.level!=='AVAILABLE'){
    const n=coachMemberNumber(red.critical);
    issues.push({key:'redundancy',score:red.level==='LOW'?84:64,kicker:'REDUNDANCY CHECK',headline:`Member #${n} REMOVAL // ${red.level}`,metrics:[['ALTERNATE PATH',red.alternate?'YES':'NO'],['POST-REMOVAL PEAK',red.alternate?`${Math.round((red.alternateMax||0)*100)}%`:'UNSTABLE'],['UTIL. AMPLIFICATION',Number.isFinite(red.amplification)?`${red.amplification.toFixed(2)}×`:'—']],reason:red.alternate?'이 부재가 사라져도 해는 남지만 다른 부재의 이용률이 크게 증가합니다. 대체 하중 경로가 제한적인 상태로 볼 수 있습니다.':'현재 가장 중요한 비도로 부재 하나를 제거한 가상 재해석에서 안정된 하중 경로가 남지 않았습니다.',advice:['핵심 부재 하나에만 의존하지 않는 두 번째 하중 경로를 검토해보세요.','추가 부재 수보다 서로 다른 경로가 실제로 지점까지 이어지는지를 우선 비교해보세요.']});
  }
  const react=coachReactionDiagnostic(a);
  if(react&&react.error>.16){
    issues.push({key:'reaction',score:58,kicker:'REACTION DISTRIBUTION',headline:'SUPPORT REACTION // ASYMMETRIC RESPONSE',metrics:[['LEFT RY',`${(react.left/1000).toFixed(1)} kN`],['RIGHT RY',`${(react.right/1000).toFixed(1)} kN`],['LEFT SHARE',`${Math.round(react.actualLeft*100)}%`],['IDEALIZED SHARE',`${Math.round(react.expectedLeft*100)}%`]],reason:'현재 지점 반력 분담이 차량 위치만으로 예상한 단순보 분담과 비교해 차이가 큽니다. 비대칭 강성이나 하중 경로가 한쪽에 더 집중되어 있을 가능성을 확인할 수 있습니다.',advice:['좌우 트러스 높이와 대각선 연결의 비대칭 여부를 확인해보세요.','Load Path 표시에서 힘이 한쪽 지점으로 과도하게 집중되는지 비교해보세요.']});
  }
  if(!stage.sandbox&&totalCost>stage.budget){
    const pct=totalCost/stage.budget*100;
    issues.push({key:'budget',score:totalCost>stage.budget*2?118:48,kicker:'BUDGET EFFICIENCY',headline:totalCost>stage.budget*2?'TEST LIMIT EXCEEDED':'BASE BUDGET EXCEEDED',metrics:[['CURRENT COST',`₩${Math.round(totalCost).toLocaleString()}`],['BASE BUDGET',`₩${stage.budget.toLocaleString()}`],['BUDGET USAGE',`${pct.toFixed(0)}%`]],reason:totalCost>stage.budget*2?'현재 비용은 TEST가 허용되는 기본 예산 200% 상한을 초과합니다.':'구조 시험은 가능하지만 현재 설계는 기본 예산을 초과해 비용 효율이 낮아집니다.',advice:['이용률이 낮은 중복 부재가 있는지 응력 보기에서 확인해보세요.','하중 경로를 유지하면서 효과가 작은 부재를 하나씩 비교 제거해볼 수 있습니다.']});
  }
  if(forceKey){const forced=issues.find(x=>x.key===forceKey);if(forced)return forced}
  issues.sort((x,y)=>y.score-x.score);
  if(issues.length)return issues[0];
  const worst=a.worst,wi=worst?a.forces.get(worst.id):null,peak2=peak||coachPeakDeflection(a),react2=react||coachReactionDiagnostic(a);
  return {key:'status',score:0,kicker:'SYSTEM STATUS',headline:'NO DOMINANT WARNING IN CURRENT LOAD CASE',metrics:[['PEAK UTILIZATION',`${Math.round((a.maxRatio||0)*100)}%`],['MAX DEFLECTION',`${(a.maxDefl||0).toFixed(1)} u`],['CRITICAL MEMBER',worst?`#${coachMemberNumber(worst)} ${coachMaterialCode(worst.mat)}`:'—'],['LOAD POSITION',`${Math.round(a.loadX||0)} u`]],reason:`현재 해석에서는 특정 한계가 즉시 지배하지 않습니다.${peak2?` 최대 변형은 Node #${coachNodeNumber(peak2.node)} (${peak2.zone})에서 발생합니다.`:''}${react2?` 지점 수직반력은 좌 ${(react2.left/1000).toFixed(1)} kN / 우 ${(react2.right/1000).toFixed(1)} kN입니다.`:''}`,advice:['차량 위치를 바꾸어 TEST하면서 critical member가 이동하는지 관찰해보세요.','Stress View에서 색의 종류보다 utilization 변화에 초점을 맞춰 비교해보세요.']};
}
function coachSecondarySummary(a,primary){
  if(!a?.ok)return null;
  const peak=coachPeakDeflection(a),m=a.worst,info=m?a.forces.get(m.id):null;
  if(primary?.key!=='deflection'&&peak)return `MAX DEFLECTION ${peak.mag.toFixed(1)} u @ Node #${coachNodeNumber(peak.node)} / ${peak.zone}`;
  if(primary?.key!=='buckling'&&primary?.key!=='tension'&&primary?.key!=='compression'&&info)return `PEAK MEMBER #${coachMemberNumber(m)} / ${coachMaterialCode(m.mat)} / UTIL ${Math.round(info.ratio*100)}%`;
  return null;
}
function levelCoachStartIssue(level){
  if(!level)return null;const codes=new Set(level.conditionCodes||[]),metrics=[['핵심 개념',level.concept||'구조 설계'],['사용 가능한 재료',(level.materials||[]).map(key=>MAT[key].name).join(' · ')]];
  let reason='이 계약은 하나의 정답 구조를 요구하지 않습니다. 하중 경로, 강성, 허용 하중과 비용이 서로 어떤 영향을 주는지 살펴보세요.';
  let advice=['먼저 하중이 지지점까지 이어질 수 있는 연속 경로를 계획해보세요.','스캔 또는 시험 결과를 비교하면서 한 번에 한 가지 설계 변수만 바꿔보세요.'];
  if(codes.has('BUCKLING')){reason='긴 압축재에서는 Euler 좌굴 한계가 재료 압축강도보다 먼저 지배할 수 있습니다. 길이가 증가할수록 좌굴 한계는 약 1/L²로 빠르게 감소합니다.';advice=['압축력이 큰 부재의 유효길이와 utilization을 먼저 비교해보세요.','트러스 높이나 중간 연결점 변화가 압축력과 좌굴 여유에 어떤 영향을 주는지 시험해보세요.']}
  else if(codes.has('REDUNDANCY')||codes.has('MEMBER_FAILURE')){reason='이 계약은 한 부재가 사라진 뒤에도 하중이 다른 경로로 지점까지 전달되는지를 평가합니다. 단순히 부재 수가 많다고 redundancy가 높은 것은 아닙니다.';advice=['주요 부재 하나가 없어졌을 때 남는 연속 하중 경로를 생각해보세요.','응력 보기에서 파단 전후 인접 부재 이용률 증가를 비교해보세요.']}
  else if(codes.has('NAVIGATION_CLEARANCE')){reason='Navigation clearance는 선박 외곽선 한 순간이 아니라 최소 폭·높이와 이동 전체 범위를 확보하는 공간 제약입니다.';advice=['설계 모드의 통과 여유 영역을 먼저 피해서 주요 하중 경로를 계획해보세요.','시험에서 처짐이 최소 통항 여유를 얼마나 감소시키는지 확인해보세요.']}
  else if(codes.has('CABLE')||codes.has('CABLE_INTRO')){reason='케이블은 주로 인장으로 작동합니다. 케이블을 많이 쓰는 것보다 어떤 위치의 하중을 어느 주탑 또는 지지 경로로 전달하는지가 중요합니다.';advice=['케이블에 인장이 실제로 형성되는지 응력 보기에서 확인해보세요.','주탑 압축과 케이블 인장 사이의 하중 경로를 함께 비교해보세요.']}
  else if(codes.has('WIND')){reason='횡풍은 교육용으로 단순화된 수평하중입니다. 차량의 수직하중과 동시에 작용하므로 좌우 반력과 부재력 분포가 달라질 수 있습니다.';advice=['Load Path에서 수직하중과 횡하중이 지점으로 전달되는 방향을 함께 보세요.','한 방향 강성만 높이기보다 복합하중에서 가장 높은 utilization 위치를 비교해보세요.']}
  else if(codes.has('REINFORCED_ROAD')||codes.has('MULTI_AXLE')||codes.has('DOUBLE_VEHICLE')){reason='도로는 axial-only 트러스와 달리 simplified bending stiffness를 가지며, 여러 차축은 서로 다른 위치에 개별 point load를 전달합니다.';advice=['DECK DEFLECTION과 BENDING INDEX가 가장 커지는 차량 위치를 관찰해보세요.','강화 도로만 의존하기보다 트러스 지지가 도로 휨을 얼마나 줄이는지 비교해보세요.']}
  else if(codes.has('MAX_HEIGHT')||codes.has('NO_BUILD_ZONE')||codes.has('WATER')){reason='Site geometry가 구조 형식을 제한합니다. 공간 제약 안에서 하중이 끊기지 않고 지점까지 전달되는 경로를 찾아야 합니다.';advice=['먼저 사용할 수 없는 공간을 제외한 뒤 가능한 구조 깊이를 확인해보세요.','비대칭 geometry가 반력과 critical member 위치를 어떻게 바꾸는지 SCAN으로 비교해보세요.']}
  return {kicker:`계약 ${displayContractId(level)} · 설계 방향`,headline:level.title,metrics,reason,advice};
}

function setCoach(kind,data={}){
  const tri=triangleCount();
  if(kind==='analysis'){
    const a=data.analysis||lastFullAnalysis;const issue=coachAnalyzeStructure(a,{simState:data.sim||null,source:data.source||'구조 해석',forceKey:data.forceKey||null});
    ui.coach.innerHTML=coachReportHTML(issue,coachSecondarySummary(a,issue),data.source||'구조 해석');return;
  }
  if(kind==='memberFailure'){
    const ev=data.event,m=data.member||members.find(x=>x.id===ev?.id),a=data.analysis;
    if(ev&&m){
      const comp=ev.force<0,mat=coachMaterialCode(m.mat),num=coachMemberNumber(m),L=ev.length??dist(nodeById(m.a),nodeById(m.b)),cap=ev.capacity??(comp?compressionCapacity(m.mat,L).capacity:MAT[m.mat].tension),eul=ev.eulerLimit??compressionCapacity(m.mat,L).euler;
      const issue={kicker:comp&&ev.governing==='buckling'?'FRACTURE / BUCKLING':'FRACTURE EVENT',headline:`Member #${num} — ${mat}`,metrics:[['AXIAL FORCE',`${Math.abs(ev.force/1000).toFixed(1)} kN ${comp?'C':'T'}`],['CAPACITY',`${(cap/1000).toFixed(1)} kN`],['UTILIZATION',`${Math.round((ev.ratio||0)*100)}%`],['LENGTH',`${L.toFixed(1)} u`],...(comp?[['EULER LIMIT',`${(eul/1000).toFixed(1)} kN`]]:[])],reason:comp&&ev.governing==='buckling'?'이 부재는 재료 압축강도보다 Euler 좌굴 한계가 먼저 지배한 상태에서 과부하가 발생했습니다.':'이 부재의 축력 이용률이 현재 capacity를 초과해 파단 이벤트가 발생했습니다.',advice:comp?['유효길이를 줄이거나 압축력을 여러 경로로 분산하는 방안을 비교해보세요.','파단 전후 Stress View에서 인접 부재의 이용률 증가를 관찰해보세요.']:['인장력이 다른 대각선 또는 하현재로 우회할 수 있는지 검토해보세요.','파단 후 대체 하중 경로가 유지되는지 재해석 결과를 비교해보세요.']};
      ui.coach.innerHTML=coachReportHTML(issue,coachSecondarySummary(a,issue),'실시간 실패 분석');return;
    }
  }
  if(kind==='serviceability'){
    const a=data.analysis||data.sim?.last||lastFullAnalysis;const issue=coachAnalyzeStructure(a,{simState:data.sim,source:'TEST RESULT',forceKey:'deflection'});
    ui.coach.innerHTML=coachReportHTML(issue,coachSecondarySummary(a,issue),'TEST RESULT');return;
  }
  if(kind==='vesselCollision'){
    const a=data.analysis||data.sim?.last||lastFullAnalysis;let issue=coachAnalyzeStructure(a,{simState:data.sim,source:'VESSEL CHECK',forceKey:'navigation'});
    if(issue?.key!=='navigation')issue={kicker:'NAVIGATION CLEARANCE',headline:'VESSEL SWEPT ENVELOPE // COLLISION',metrics:[['MIN CLEARANCE','0.0 u'],['VESSEL PROGRESS',`${Math.round((data.sim?.shipProgress||0)*100)}%`],['RESULT','COLLISION']],reason:'변형된 교량 형상이 선박이 이동하면서 차지하는 swept clearance geometry와 겹쳤습니다.',advice:['충돌 위치에서 구조 높이와 처짐을 함께 확인해보세요.','항로 위 부재의 배치 또는 강성을 바꿨을 때 MIN CLEARANCE가 어떻게 변하는지 비교해보세요.']};
    ui.coach.innerHTML=coachReportHTML(issue,coachSecondarySummary(a,issue),'VESSEL CHECK');return;
  }
  if(kind==='collapse'){
    const s=data.sim||{},a=data.analysis||s.preCollapseAnalysis||null,ev=s.failureEvents?.at?.(-1);
    if(ev){setCoach('memberFailure',{event:ev,member:members.find(m=>m.id===ev.id),analysis:a});return}
    const issue=coachAnalyzeStructure(a,{simState:s,source:'COLLAPSE REVIEW'});
    ui.coach.innerHTML=coachReportHTML(issue,coachSecondarySummary(a,issue),'COLLAPSE REVIEW');return;
  }
  if(kind==='start'){
    const campaignLevel=currentCampaignLevel?.();
    if(campaignLevel){const issue=levelCoachStartIssue(campaignLevel);if(issue){ui.coach.innerHTML=coachReportHTML(issue,null,'시작 안내');return}}
    if(stage.ship){
      const env=getNavigationEnvelope(stage.forbidden.find(r=>r.kind==='navigation'));
      const issue={kicker:'DESIGN CONSTRAINT',headline:'NAVIGATION CLEARANCE ENVELOPE',metrics:[['MIN WIDTH',`${Math.round(env?.minWidth||0)} u`],['MIN HEIGHT',`${Math.round(env?.minHeight||0)} u`],['BUILD RULE','NO NODE / MEMBER']],reason:'황색 해치 영역은 선박 한 순간의 외곽선이 아니라 안전한 통항에 필요한 전체 clearance envelope입니다. TEST에서는 변형된 구조와 선박 swept geometry를 다시 검사합니다.',advice:['먼저 envelope 위쪽으로 연속 도로 경로를 계획해보세요.','설계 후 SCAN과 TEST에서 처짐 때문에 clearance가 줄어드는지도 비교할 수 있습니다.']};
      ui.coach.innerHTML=coachReportHTML(issue,null,'DESIGN REVIEW');
    }else{
      const issue={kicker:'DESIGN SETUP',headline:stage.type==='CABLE'?'ROAD + CABLE LOAD PATH':'ROAD + TRUSS LOAD PATH',metrics:[['ROAD MODEL','AXIAL + BENDING'],['TRUSS MODEL','AXIAL ONLY'],['TRIANGLES',String(tri)]],reason:stage.type==='CABLE'?'도로가 차량 하중을 받고, 케이블은 주로 인장으로 그 하중을 다른 구조 요소에 전달합니다.':'도로 자체에도 교육용 휨강성이 있지만 전체 경간을 도로만으로 버티도록 보정되어 있지 않습니다. 트러스는 주로 축력으로 하중을 지점까지 전달합니다.',advice:['먼저 양 지지점 사이의 연속 road path를 확보해보세요.','그 다음 삼각형 또는 케이블 하중 경로가 어디로 이어지는지 SCAN으로 확인할 수 있습니다.']};
      ui.coach.innerHTML=coachReportHTML(issue,null,'DESIGN REVIEW');
    }return;
  }
  if(kind==='budget'){
    const pct=stage.sandbox?0:totalCost/Math.max(1,stage.budget)*100,hard=totalCost>stage.budget*2;
    const issue={kicker:'BUDGET CHECK',headline:hard?'TEST LIMIT EXCEEDED':'BASE BUDGET EXCEEDED',metrics:[['CURRENT COST',`₩${Math.round(totalCost).toLocaleString()}`],['BASE BUDGET',`₩${stage.budget.toLocaleString()}`],['BUDGET USAGE',`${pct.toFixed(0)}%`],['TEST LIMIT','200%']],reason:hard?'현재 비용이 TEST 허용 상한을 넘어 구조 시험을 시작할 수 없습니다.':'TEST는 가능하지만 비용 효율 평가에서는 불리한 상태입니다.',advice:['Stress View에서 utilization이 매우 낮은 부재부터 효과를 비교해보세요.','하중 경로를 유지하는 범위에서 중복도가 실제로 필요한 부재인지 하나씩 검토할 수 있습니다.']};
    ui.coach.innerHTML=coachReportHTML(issue,null,'DESIGN REVIEW');return;
  }
  if(kind==='unstable'){
    const issue=coachAnalyzeStructure(null,{source:'STABILITY CHECK'});ui.coach.innerHTML=coachReportHTML(issue,null,'STABILITY CHECK');return;
  }
  if(kind==='success'){
    const a=data.analysis||data.last||lastFullAnalysis;
    if(a?.ok){const issue=coachAnalyzeStructure(a,{simState:data,source:'POST-TEST REVIEW'});ui.coach.innerHTML=coachReportHTML(issue,coachSecondarySummary(a,issue),'POST-TEST REVIEW');return}
    ui.coach.innerHTML=`성공! 최대 부재 하중률 <strong>${Math.round((data.maxRatio||0)*100)}%</strong>, 최대 변형 <strong>${(data.maxDefl||0).toFixed(1)}</strong>입니다.<div class="coachTip">파랑=인장, 빨강=압축은 힘의 종류를 뜻합니다. 중요한 값은 FORCE ÷ CAPACITY로 계산되는 UTILIZATION입니다.</div>`;
  }
}

function findNode(p,rad=18){let best=null,bd=rad;for(const n of nodes.filter(n=>n.visible||n.user)){ const d=dist(p,n);if(d<bd){bd=d;best=n}}return best}
function findMember(p){let best=null,bd=13;for(const m of members.filter(m=>m.user)){const a=nodeById(m.a),b=nodeById(m.b);const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y;const t=clamp((wx*vx+wy*vy)/(vx*vx+vy*vy),0,1);const q={x:a.x+t*vx,y:a.y+t*vy};const d=dist(p,q);if(d<bd){bd=d;best=m}}return best}
function nearestDeckJoint(p){let best=null,bd=24;for(const n of nodes.filter(n=>n.deck&&!n.support)){const d=dist(p,n);if(d<bd){bd=d;best=n}}return best}
function canPlace(p){if(p.x<90||p.x>1110||p.y<105||p.y>585)return false;return !pointBlockedByForbidden(p)}
function maxLengthForTool(){return MAT[tool]?.maxLen ?? 0}
function memberFailureEnabled(){return !stage?.sandbox || stage.memberFailure!==false}
function updateSandboxFailureUI(){
  const enabled=stages[4].memberFailure!==false;
  $$('.sandboxFailureBtn').forEach(b=>b.classList.toggle('active',(b.dataset.failure==='on')===enabled));
  const state=$('#sandboxFailureState');
  if(state){state.className=`sandboxFailureState ${enabled?'on':'off'}`;state.textContent=enabled?'파단 켜짐 // 과부하 파단 · 재해석 · 대체 하중 경로 추적':'파단 꺼짐 // 부재 파단 없음 · 이용률 관찰 모드'}
}
function updateModeBadge(){
  const snapText=snapEnabled?'스냅 ON':'스냅 OFF';let txt='';
  if(uiMode==='basic'&&!tutorialMode){
    if(tool==='cable')txt='재료 // 케이블 · 인장 전용';
    else if(isRoadTool())txt=`도로 // ${MAT[tool].name} · 최대 길이 ${MAT[tool].maxLen}`;
    else if(MAT[tool])txt=`재료 // ${MAT[tool].name} · 최대 길이 ${MAT[tool].maxLen}`;
    else txt='기본 설계 모드';
  }else if(measureMode)txt='거리 측정 · 두 관절 선택 · 우클릭 초기화';
  else if(tool==='move')txt=`이동 모드 · 자유 관절 드래그 · ${snapText}`;
  else if(tool==='delete')txt='삭제 모드 · 부재/관절 클릭';
  else if(tool==='cable')txt=`케이블 · 길이 제한 없음 · 인장 전용 · ${snapText}`;
  else if(isRoadTool())txt=`도로 건설 · ${MAT[tool].name} · 축력 + 휨 · 폭 ${MAT[tool].roadWidth}px · 한 부재 최대 ${MAT[tool].maxLen} · ${snapText}`;
  else txt=`${MAT[tool].name} · 최대 길이 ${MAT[tool].maxLen} · ${snapText}`;
  if(stage?.sandbox)txt+=` · 부재 파단 ${memberFailureEnabled()?'켜짐':'꺼짐'}`;
  ui.modeBadge.textContent=txt;
}

function getPreviewState(p){
  if(!selected||!isBuildTool()||!p)return null;
  let targetNode=findNode(p,18), targetType='node', targetPoint=null;
  if(targetNode){targetPoint={x:targetNode.x,y:targetNode.y};}
  else{
    const deckN=nearestDeckJoint(p);
    if(deckN){targetNode=deckN;targetType='deck';targetPoint={x:deckN.x,y:deckN.y};}
    else{targetType='new';targetPoint={x:snap(p.x),y:snap(p.y)};}
  }
  const L=dist(selected,targetPoint), limit=maxLengthForTool();
  const duplicate=!!(targetNode&&members.some(m=>memberKey(m.a,m.b)===memberKey(selected.id,targetNode.id)));
  const same=!!(targetNode&&targetNode.id===selected.id);
  const placeOK=targetType!=='new'||canPlace(targetPoint);
  const pathOK=!connectionBlocked(selected,targetPoint,tool);
  const lengthOK=!Number.isFinite(limit)||L<=limit;
  const valid=!same&&!duplicate&&placeOK&&pathOK&&lengthOK&&L>4;
  const addCost=Math.round((L*MAT[tool].cost)/10)*10;
  return {targetNode,targetType,targetPoint,L,limit,duplicate,same,placeOK,pathOK,lengthOK,valid,addCost};
}
function inspectorAnalysisData(){
  if(sim?.last?.ok)return sim.last;
  if(lastFullAnalysis?.ok)return lastFullAnalysis;
  return null;
}
function inspectorHeader(title,hasAnalysis){
  return `<div class="inspectorHeader"><b>${title}</b><span class="inspectorDataState ${hasAnalysis?'live':''}">${hasAnalysis?'ANALYSIS':'BUILD DATA'}</span><span class="inspectorModeChip">${inspectorMode.toUpperCase()}</span></div>`;
}
function inspectorRow(key,value,cls=''){
  return `<div class="inspectorRow"><span class="k">${devLabel(key)}</span><span class="v ${cls}">${value}</span></div>`;
}
function inspectorStatus(util,force,governing){
  if(!Number.isFinite(util))return {text:'NOT ANALYZED',cls:'dim'};
  if(util>1)return {text:force<0&&governing==='euler'?'BUCKLING RISK':'OVERLOAD',cls:'danger'};
  if(util>=.9)return {text:'HIGH UTILIZATION',cls:'danger'};
  if(util>=.7)return {text:'WATCH',cls:'warn'};
  return {text:'OK',cls:'ok'};
}
function nodeDisplacementInfo(a,n){
  if(!a?.ok||!a.index||!a.U)return null;
  const i=a.index.get(n.id);if(i==null)return null;
  const ux=a.U[2*i]||0,uy=a.U[2*i+1]||0;
  return {ux,uy,mag:Math.hypot(ux,uy)};
}
function roadInspectorMetrics(a,m){
  if(!a?.ok)return null;
  const na=nodeById(m.a),nb=nodeById(m.b),ia=a.index?.get(m.a),ib=a.index?.get(m.b);
  let localDefl=0;
  if(ia!=null)localDefl=Math.max(localDefl,Math.abs(a.U?.[2*ia+1]||0));
  if(ib!=null)localDefl=Math.max(localDefl,Math.abs(a.U?.[2*ib+1]||0));
  const rs=a.roadSeg;
  const direct=!!(rs&&((rs.a.id===m.a&&rs.b.id===m.b)||(rs.a.id===m.b&&rs.b.id===m.a)));
  const shareA=direct?stage.load*(1-rs.t):0,shareB=direct?stage.load*rs.t:0;
  return {localDefl,direct,connectedLoad:direct?stage.load:0,shareA,shareB,globalDefl:a.deckDeflection||0,span:dist(na,nb)};
}
function updateInspector(clientX,clientY,p){
  if(!ui.inspector)return;
  const main=document.querySelector('.main').getBoundingClientRect();
  let html='';
  const preview=getPreviewState(p);
  if(preview){
    const lenLimit=Number.isFinite(preview.limit)?` / ${preview.limit}`:' / ∞';
    const cls=preview.valid?'ok':'danger';
    let why='설치 가능';
    if(!preview.lengthOK)why='재료 최대 길이 초과';else if(preview.duplicate)why='이미 연결된 관절';else if(preview.same)why='같은 관절';else if(!preview.placeOK)why='설치 불가 영역';else if(!preview.pathOK)why='자재가 건설 불가 구간을 통과함';
    const projected=totalCost+preview.addCost;const budgetClass=stage.sandbox?'dim':projected>stage.budget*2?'danger':projected>stage.budget?'warn':'dim';
    html=`<div class="inspectorPreview"><b>${MAT[tool].name} 설치 미리보기</b><span class="mono">길이 ${Math.round(preview.L)}${lenLimit}</span><br><span class="dim">추가 비용 약 ₩${preview.addCost.toLocaleString()}</span>${stage.sandbox?'':`<br><span class="${budgetClass}">설치 후 ₩${projected.toLocaleString()}</span>`}<br><span class="${cls}">${why}</span></div>`;
  }else if(hoverMember?.road){
    const a=nodeById(hoverMember.a),b=nodeById(hoverMember.b),L=dist(a,b),analysis=inspectorAnalysisData();
    const metric=roadInspectorMetrics(analysis,hoverMember),mat=MAT[hoverMember.mat];
    let body='';
    body+=inspectorRow('ROAD TYPE',hoverMember.mat==='roadHeavy'?'REINFORCED ROAD':'NORMAL ROAD');
    body+=inspectorRow('SPAN',`${L.toFixed(1)} u`);
    if(analysis&&metric){
      body+=inspectorRow('DECK DEFLECTION',`${metric.localDefl.toFixed(2)} u`,metric.localDefl>stage.maxDefl?'danger':metric.localDefl>stage.maxDefl*.8?'warn':'ok');
      body+=inspectorRow('CONNECTED LOAD',metric.direct?`${(metric.connectedLoad/1000).toFixed(1)} kN`:'0.0 kN',metric.direct?'warn':'dim');
      if(inspectorMode==='detail'){
        const f=analysis.forces?.get(hoverMember.id),util=(f?.ratio||0)*100;
        body+=inspectorRow('MEMBER ID',`#${hoverMember.id}`);
        body+=inspectorRow('MATERIAL',mat.name.toUpperCase());
        body+=inspectorRow('BENDING INDEX',`${(analysis.deckCurvature||0).toFixed(2)}°/100u`);
        body+=inspectorRow('GLOBAL DECK MAX',`${metric.globalDefl.toFixed(2)} u`);
        body+=inspectorRow('LOAD SHARE',metric.direct?`${(metric.shareA/1000).toFixed(1)} / ${(metric.shareB/1000).toFixed(1)} kN`:'—','dim');
        if(f)body+=inspectorRow('AXIAL UTIL.',`${util.toFixed(1)}%`,util>100?'danger':util>=90?'danger':util>=70?'warn':'ok');
      }
    }else if(inspectorMode==='detail'){
      body+=inspectorRow('MEMBER ID',`#${hoverMember.id}`);
      body+=inspectorRow('MATERIAL',mat.name.toUpperCase());
      body+=inspectorRow('DECK DEFLECTION','RUN TEST / SCAN','dim');
      body+=inspectorRow('CONNECTED LOAD','RUN TEST / SCAN','dim');
    }
    html=`<div class="inspectorShell">${inspectorHeader('ROAD INSPECTOR',!!analysis)}<div class="inspectorBody">${body}<div class="inspectorFoot">ROAD // axial + simplified bending approximation</div></div></div>`;
  }else if(hoverMember){
    const a=nodeById(hoverMember.a),b=nodeById(hoverMember.b),L=dist(a,b),analysis=inspectorAnalysisData(),f=analysis?.forces?.get(hoverMember.id),mat=MAT[hoverMember.mat];
    let body='';
    body+=inspectorRow('MEMBER ID',`#${hoverMember.id}`);
    body+=inspectorRow('MATERIAL',mat.name.toUpperCase());
    body+=inspectorRow('LENGTH',`${L.toFixed(1)} u`);
    if(f){
      const type=f.force>=0?'TENSION':'COMPRESSION',util=f.ratio*100,status=inspectorStatus(f.ratio,f.force,f.governing);
      if(inspectorMode==='basic'){
        body+=inspectorRow('TYPE',type,f.force>=0?'':'warn');
        body+=inspectorRow('UTILIZATION',`${util.toFixed(1)}%`,util>100?'danger':util>=90?'danger':util>=70?'warn':'ok');
        body+=inspectorRow('STATUS',status.text,status.cls);
      }else{
        body+=inspectorRow('FORCE',`${(Math.abs(f.force)/1000).toFixed(1)} kN`);
        body+=inspectorRow('TYPE',type,f.force>=0?'':'warn');
        body+=inspectorRow('CAPACITY',`${(f.capacity/1000).toFixed(1)} kN`);
        body+=inspectorRow('UTILIZATION',`${util.toFixed(1)}%`,util>100?'danger':util>=90?'danger':util>=70?'warn':'ok');
        body+=inspectorRow('BUCKLING LIMIT',f.force<0&&Number.isFinite(f.eulerLimit)?`${(f.eulerLimit/1000).toFixed(1)} kN`:'N/A',f.force<0&&f.governing==='euler'?'warn':'dim');
        body+=inspectorRow('STATUS',status.text,status.cls);
      }
    }else{
      body+=inspectorRow('STATUS','PRE-ANALYSIS','dim');
      if(inspectorMode==='detail')body+=inspectorRow('SOLVER DATA','RUN TEST / SCAN','dim');
    }
    html=`<div class="inspectorShell">${inspectorHeader('MEMBER INSPECTOR',!!f)}<div class="inspectorBody">${body}<div class="inspectorFoot">TRUSS MEMBER // axial-force model</div></div></div>`;
  }else if(hoverNode){
    const analysis=inspectorAnalysisData(),disp=nodeDisplacementInfo(analysis,hoverNode),reaction=analysis?.reactions?.get(hoverNode.id),links=members.filter(m=>m.a===hoverNode.id||m.b===hoverNode.id),support=hoverNode.support==='pin'?'PIN':hoverNode.support==='roller'?'ROLLER':'FREE';
    let body='';
    body+=inspectorRow('NODE ID',`#${hoverNode.id}`);
    body+=inspectorRow('X / Y',`${hoverNode.x.toFixed(1)} / ${hoverNode.y.toFixed(1)}`);
    body+=inspectorRow('CONNECTED MEMBERS',`${links.length}`);
    body+=inspectorRow('SUPPORT TYPE',support,hoverNode.support?'ok':'dim');
    if(analysis&&disp){
      body+=inspectorRow('DISPLACEMENT',`${disp.mag.toFixed(3)} u`,disp.mag>stage.maxDefl?'danger':disp.mag>stage.maxDefl*.8?'warn':'ok');
      if(hoverNode.support)body+=inspectorRow('REACTION FORCE',reaction?`${(Math.hypot(reaction.rx,reaction.ry)/1000).toFixed(1)} kN`:'0.0 kN',reaction?'ok':'dim');
      else body+=inspectorRow('REACTION FORCE','N/A','dim');
      if(inspectorMode==='detail'){
        body+=inspectorRow('ΔX / ΔY',`${disp.ux.toFixed(3)} / ${disp.uy.toFixed(3)} u`);
        if(reaction)body+=inspectorRow('RX / RY',`${(reaction.rx/1000).toFixed(1)} / ${(reaction.ry/1000).toFixed(1)} kN`);
        const ids=links.slice(0,6).map(m=>`#${m.id}`).join(' · ')+(links.length>6?' …':'');
        body+=inspectorRow('MEMBER IDS',ids||'—','dim');
      }
    }else if(inspectorMode==='detail'){
      body+=inspectorRow('DISPLACEMENT','RUN TEST / SCAN','dim');
      body+=inspectorRow('REACTION FORCE','RUN TEST / SCAN','dim');
    }
    html=`<div class="inspectorShell">${inspectorHeader('NODE INSPECTOR',!!analysis)}<div class="inspectorBody">${body}<div class="inspectorFoot">NODE // coordinates are undeformed model positions</div></div></div>`;
  }
  if(!html){ui.inspector.classList.remove('show');return;}
  ui.inspector.innerHTML=html;
  const boxW=inspectorMode==='detail'?330:270,boxH=inspectorMode==='detail'?330:235;
  ui.inspector.style.left=`${clamp(clientX-main.left,8,main.width-boxW)}px`;
  ui.inspector.style.top=`${clamp(clientY-main.top,8,main.height-boxH)}px`;
  ui.inspector.classList.add('show');
}
function hideInspector(){ui.inspector?.classList.remove('show')}
function updateCanvasCursor(p=pointerWorld){
  canvas.classList.remove('cursor-build','cursor-move','cursor-drag','cursor-delete','cursor-measure','cursor-invalid');
  if(sim){canvas.style.cursor='default';return}
  canvas.style.cursor='';
  if(dragging){canvas.classList.add('cursor-drag');return}
  if(measureMode){canvas.classList.add('cursor-measure');return}
  if(tool==='move'){canvas.classList.add('cursor-move');return}
  if(tool==='delete'){canvas.classList.add('cursor-delete');return}
  if(isBuildTool()){
    const pr=selected&&p?getPreviewState(p):null;
    canvas.classList.add(pr&&!pr.valid?'cursor-invalid':'cursor-build');
  }
}
function drawPlacementGuide(){
  if(sim||measureMode||selected||!pointerWorld||!isBuildTool())return;
  let n=findNode(pointerWorld,18), p, kind='node', ok=true;
  if(n){p={x:n.x,y:n.y};}
  else{
    const deckN=nearestDeckJoint(pointerWorld);
    if(deckN){p={x:deckN.x,y:deckN.y};kind='deck'}
    else{p={x:snap(pointerWorld.x),y:snap(pointerWorld.y)};kind='new';ok=canPlace(p)}
  }
  ctx.save();
  ctx.lineWidth=1.5;ctx.strokeStyle=ok?'rgba(98,225,174,.76)':'rgba(238,100,114,.8)';
  ctx.setLineDash(kind==='new'?[4,4]:[]);
  ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(p.x-20,p.y);ctx.lineTo(p.x-7,p.y);ctx.moveTo(p.x+7,p.y);ctx.lineTo(p.x+20,p.y);ctx.moveTo(p.x,p.y-20);ctx.lineTo(p.x,p.y-7);ctx.moveTo(p.x,p.y+7);ctx.lineTo(p.x,p.y+20);ctx.stroke();
  if(kind==='new'){
    ctx.beginPath();ctx.arc(p.x,p.y,4.5,0,Math.PI*2);ctx.fillStyle=ok?'rgba(255,226,0,.72)':'rgba(238,100,114,.72)';ctx.fill();
  }
  ctx.restore();
}

function drawBuildPreview(){
  const pr=getPreviewState(pointerWorld);if(!pr)return;
  const a={x:selected.x,y:selected.y},b=pr.targetPoint;
  ctx.save();
  ctx.setLineDash([9,7]);ctx.lineCap='round';ctx.lineWidth=tool==='cable'?3:(isRoadTool()?MAT[tool].roadWidth:7);
  ctx.strokeStyle=pr.valid?`${MAT[tool].color}cc`:'rgba(255,92,111,.9)';line(a,b);ctx.setLineDash([]);
  if(pr.targetType==='new'){
    ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fillStyle=pr.valid?'rgba(255,226,0,.55)':'rgba(255,92,111,.55)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.stroke();
  }
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  ctx.font='800 10px ui-sans-serif,system-ui';const label=`${Math.round(pr.L)} · +₩${pr.addCost.toLocaleString()}`;const w=ctx.measureText(label).width+14;
  ctx.fillStyle=pr.valid?'rgba(8,14,17,.92)':'rgba(67,25,31,.94)';ctx.strokeStyle=pr.valid?'rgba(98,225,174,.42)':'rgba(237,102,119,.55)';ctx.lineWidth=1;ctx.fillRect(mx-w/2,my-26,w,20);ctx.strokeRect(mx-w/2,my-26,w,20);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,mx,my-16);ctx.restore();
}
function addConnection(target){
  if(sim)return;
  if(tool==='delete')return;
  if(!materialAllowed(tool)){toast('THIS MATERIAL IS NOT AVAILABLE IN THIS CONTRACT');return}
  if(!selected){selected=target;toast('첫 번째 관절 선택');draw();return}
  if(selected.id===target.id){selected=null;draw();return}
  const L=dist(selected,target), limit=maxLengthForTool(); if(Number.isFinite(limit)&&L>limit){toast(`${MAT[tool].name} 최대 길이는 ${limit}입니다`);return}
  if(!evaluateContractConstraint('BUILD_ENVELOPE',{a:selected,b:target,mat:tool})){toast(isRoadTool()?'도로 폭이 건설 불가 구간과 겹칩니다':'건설 불가 구간을 통과하는 자재는 설치할 수 없습니다');return}
  const key=memberKey(selected.id,target.id);if(members.some(m=>memberKey(m.a,m.b)===key)){toast('이미 연결된 관절입니다');selected=null;draw();return}
  if(tutorialMode&&tutorialCurrentStep()?.key==='roadComplete'&&!tutorialRoadGuideSegmentOK(selected,target)){
    toast('TUTORIAL // 도로는 표시된 기준점 사이를 순서대로 연결하세요');
    draw();
    return;
  }
  if(!evaluateContractConstraint('MAX_MEMBER_COUNT',{mat:tool})){toast(`MEMBER LIMIT // ${stage.maxMemberCount}`);return}
  if(!evaluateContractConstraint('MAX_CABLE_COUNT',{mat:tool})){toast(`CABLE LIMIT // ${stage.maxCableCount}`);return}
  snapshot();
  const buildingRoad=isRoadTool(tool);
  if(buildingRoad){selected.roadNode=true;target.roadNode=true;selected.visible=true;target.visible=true;}
  members.push({id:'u'+cryptoRandom(),a:selected.id,b:target.id,mat:tool,user:true,road:buildingRoad});
  triggerBuildFx(selected,target,tool);playSfx('place');
  // 연속 설치: 방금 연결한 관절을 다음 부재의 시작점으로 유지한다.
  selected=target;
  currentAnalysis=null;
  updateHUD();
  if(totalCost>stage.budget)setCoach('budget');
  toast(`${MAT[tool].name} 연결 · 계속 설치 중 (우클릭으로 종료)`);
  draw();
}

canvas.addEventListener('pointerdown',e=>{
  if(sim||e.button===2)return;
  if(tutorialMode&&!tutorialCanvasInputAllowed()){toast('현재 튜토리얼 단계에서는 건설 입력이 잠겨 있습니다');return;}
  const p=screenToWorld(e.clientX,e.clientY);
  if(measureMode){
    const n=findNode(p,24);
    if(!n){toast('측정할 관절을 선택하세요');return;}
    if(!measureA){measureA=n;measureB=null;toast('첫 번째 측정 관절 선택');}
    else if(n.id===measureA.id){measureA=null;measureB=null;toast('측정 선택 해제');}
    else{measureB=n;const L=dist(measureA,measureB);toast(`관절 간 거리 ${L.toFixed(1)}`);}
    updateMeasureTag();draw();return;
  }
  if(tool==='move'){const n=findNode(p,22);if(n&&n.user&&!n.deck&&!n.support){snapshot();dragging=n;canvas.setPointerCapture?.(e.pointerId);toast('관절을 드래그해 이동하세요');}else toast('이동 가능한 자유 관절을 선택하세요');return;}
  if(tool==='delete'){
    const m=findMember(p);if(m){snapshot();members=members.filter(x=>x!==m);nodes=nodes.filter(n=>!n.user||members.some(mm=>mm.a===n.id||mm.b===n.id));selected=null;currentAnalysis=null;updateHUD();draw();return}
    const n=findNode(p);if(n&&!n.support){deleteJoint(n);return} return;
  }
  let n=findNode(p);
  if(!n){
    const deckN=nearestDeckJoint(p);
    if(deckN){snapshot();deckN.visible=true;deckN.activated=true;n=deckN;toast('도로 관절을 활성화했습니다');}
    else {
      if(tutorialMode&&tutorialCurrentStep()?.key==='roadComplete'){toast('TUTORIAL // 점선 가이드의 도로 기준점만 클릭하세요');return}
      let q={x:snap(p.x),y:snap(p.y)};if(!canPlace(q)){toast('이 위치에는 관절을 놓을 수 없습니다');return} snapshot();n={id:Math.max(-1,...nodes.map(x=>x.id))+1,x:q.x,y:q.y,user:true,visible:true,deck:false,roadNode:isRoadTool(),support:null};nodes.push(n);history.pop();triggerNodeFx(n);playSfx('node');}
  }
  addConnection(n);
});
function deleteJoint(n){
  if(!n||n.support)return;
  snapshot();members=members.filter(m=>m.a!==n.id&&m.b!==n.id||!m.user);
  if(n.deck){n.visible=false;n.activated=false}else nodes=nodes.filter(x=>x.id!==n.id);
  selected=null;currentAnalysis=null;updateHUD();draw();toast('관절을 삭제했습니다');
}
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(sim)return;
  if(tutorialMode&&!['topChord','trussComplete','rightClick'].includes(tutorialCurrentStep()?.key))return;
  if(measureMode&&(measureA||measureB)){measureA=null;measureB=null;updateMeasureTag();toast('측정을 초기화했습니다');draw();return;}
  // 자재 연속 설치 중에는 우클릭이 '설치 종료/선택 해제'로 동작한다.
  if(selected && isBuildTool()){
    selected=null;
    toast('연속 설치를 종료했습니다');
    draw();
    return;
  }
  // 설치 중이 아닐 때는 기존처럼 관절 우클릭 삭제를 유지한다.
  const p=screenToWorld(e.clientX,e.clientY);
  const n=findNode(p,20);
  if(n&&!n.support)deleteJoint(n);
});
canvas.addEventListener('pointermove',e=>{
  const p=screenToWorld(e.clientX,e.clientY);pointerWorld=p;
  if(dragging){let q={x:snap(p.x),y:snap(p.y)};if(canPlace(q)&&nodeMoveKeepsClear(dragging,q)){dragging.x=q.x;dragging.y=q.y;currentAnalysis=null;updateHUD();}hoverNode=dragging;hoverMember=null;updateInspector(e.clientX,e.clientY,p);updateCanvasCursor(p);draw();return;}
  hoverNode=findNode(p);hoverMember=hoverNode?null:findMember(p);updateInspector(e.clientX,e.clientY,p);updateCanvasCursor(p);draw();
});
canvas.addEventListener('pointerup',e=>{if(dragging){dragging=null;canvas.releasePointerCapture?.(e.pointerId);updateHUD();updateCanvasCursor(pointerWorld);draw();toast('관절 위치를 변경했습니다')}});
canvas.addEventListener('pointercancel',()=>{dragging=null});
canvas.addEventListener('pointerleave',()=>{hoverNode=null;hoverMember=null;pointerWorld=null;hideInspector();canvas.style.cursor='';canvas.classList.remove('cursor-build','cursor-move','cursor-drag','cursor-delete','cursor-measure','cursor-invalid');draw()});

// ===== SIMPLIFIED ROAD BEAM APPROXIMATION =====
// Truss members remain axial-only. Road members additionally receive a weak
// translational bending penalty built from three consecutive deck joints.
// No rotational DOF is introduced: the change of slope between adjacent road
// panels is approximated from nodal translations and resisted by an EI/L-like
// rotational spring. This is deliberately an educational/game approximation,
// not a full frame/beam FEM element.
function roadBendingEI(matKey){
  const m=MAT[matKey];
  if(!m||(matKey!=='road'&&matKey!=='roadHeavy'))return 0;
  return Math.max(0,(m.E||0)*(m.I||0)*(m.beamScale||1));
}
function roadBendingTerms(broken=new Set()){
  const byNode=new Map();
  for(const m of members){
    if(!m.road||broken.has(m.id))continue;
    if(!byNode.has(m.a))byNode.set(m.a,[]);if(!byNode.has(m.b))byNode.set(m.b,[]);
    byNode.get(m.a).push(m);byNode.get(m.b).push(m);
  }
  const out=[];
  for(const [mid,links] of byNode){
    if(links.length<2)continue;
    const pm=nodeById(mid);if(!pm)continue;
    for(let i=0;i<links.length;i++)for(let j=i+1;j<links.length;j++){
      const m1=links[i],m2=links[j];
      const aid=m1.a===mid?m1.b:m1.a,cid=m2.a===mid?m2.b:m2.a;
      if(aid===cid)continue;
      const pa=nodeById(aid),pc=nodeById(cid);if(!pa||!pc)continue;
      const v1x=pa.x-pm.x,v1y=pa.y-pm.y,v2x=pc.x-pm.x,v2y=pc.y-pm.y;
      const L1=Math.hypot(v1x,v1y),L2=Math.hypot(v2x,v2y);if(L1<4||L2<4)continue;
      const cos=(v1x*v2x+v1y*v2y)/(L1*L2);
      // Near-collinear road panels behave as a continuous deck. A deliberate
      // sharp corner is allowed to act more like a hinge instead of becoming an
      // unrealistically rigid hidden beam connection.
      const continuity=clamp((-cos-.15)/.85,0,1);if(continuity<.08)continue;
      const bx=pc.x-pa.x,by=pc.y-pa.y,BL=Math.hypot(bx,by);if(BL<4)continue;
      const nx=-by/BL,ny=bx/BL;
      // Very tiny user-created panels are regularized to keep the global matrix
      // well conditioned. Normal stage panels are far above this floor.
      const Le1=Math.max(28,L1),Le2=Math.max(28,L2);
      const q=[
        {id:aid,qx:nx/Le1,qy:ny/Le1},
        {id:mid,qx:-nx*(1/Le1+1/Le2),qy:-ny*(1/Le1+1/Le2)},
        {id:cid,qx:nx/Le2,qy:ny/Le2}
      ];
      const ei1=roadBendingEI(m1.mat),ei2=roadBendingEI(m2.mat);
      const EI=ei1>0&&ei2>0?2*ei1*ei2/(ei1+ei2):Math.max(ei1,ei2);
      const kTheta=(2*EI/(Le1+Le2))*continuity*continuity;
      out.push({mid,a:aid,c:cid,m1,m2,L1,L2,continuity,EI,kTheta,nx,ny,q});
    }
  }
  return out;
}
function assembleRoadBendingStiffness(K,index,terms){
  for(const t of terms){
    const dofs=[];
    for(const e of t.q){
      const ii=index.get(e.id);if(ii==null)continue;
      dofs.push([2*ii,e.qx],[2*ii+1,e.qy]);
    }
    for(const [di,qi] of dofs)for(const [dj,qj] of dofs)K[di][dj]+=t.kTheta*qi*qj;
  }
}
function staticDeckMetrics(U,index,broken=new Set(),terms=null){
  const roadIds=new Set();
  for(const m of members){if(m.road&&!broken.has(m.id)){roadIds.add(m.a);roadIds.add(m.b)}}
  let deckDeflection=0;
  for(const id of roadIds){const ii=index.get(id);if(ii!=null)deckDeflection=Math.max(deckDeflection,Math.abs(U[2*ii+1]||0))}
  let deckCurvature=0;
  for(const t of (terms||roadBendingTerms(broken))){
    let dTheta=0;
    for(const e of t.q){const ii=index.get(e.id);if(ii!=null)dTheta+=(e.qx*U[2*ii]+e.qy*U[2*ii+1])}
    const Lav=.5*(t.L1+t.L2);
    const degPer100=Math.abs(dTheta)/Math.max(1,Lav)*(180/Math.PI)*100;
    deckCurvature=Math.max(deckCurvature,degPer100);
  }
  return {deckDeflection,deckCurvature};
}
function collapseDeckMetrics(physics){
  if(!physics)return {deckDeflection:0,deckCurvature:0};
  const roadIds=new Set();
  for(const c of physics.constraints){if(c.m.road&&!c.broken){roadIds.add(c.a);roadIds.add(c.b)}}
  let deckDeflection=0;
  for(const id of roadIds){const p=collapseParticle(physics,id);if(p)deckDeflection=Math.max(deckDeflection,Math.abs(p.y-p.oy))}
  let deckCurvature=0;
  for(const bend of physics.roadBends||[]){
    if(bend.c1.broken||bend.c2.broken)continue;
    const p=collapseParticle(physics,bend.mid),a=collapseParticle(physics,bend.a),c=collapseParticle(physics,bend.b);if(!p||!a||!c)continue;
    const angle=(aa,bb,cc)=>{const x1=aa.x-bb.x,y1=aa.y-bb.y,x2=cc.x-bb.x,y2=cc.y-bb.y,l1=Math.hypot(x1,y1)||1,l2=Math.hypot(x2,y2)||1;return Math.acos(clamp((x1*x2+y1*y2)/(l1*l2),-1,1))};
    const now=angle(a,p,c);
    const oa={x:a.ox,y:a.oy},op={x:p.ox,y:p.oy},oc={x:c.ox,y:c.oy};
    const rest=angle(oa,op,oc),Lav=.5*(Math.hypot(op.x-oa.x,op.y-oa.y)+Math.hypot(oc.x-op.x,oc.y-op.y));
    deckCurvature=Math.max(deckCurvature,Math.abs(now-rest)/Math.max(1,Lav)*(180/Math.PI)*100);
  }
  return {deckDeflection,deckCurvature};
}

function effectiveStageWind(loadX){
  const base=stage.wind||0,ramp=stage.windRamp;if(!ramp||Math.abs(base)<1)return base;
  const x0=stage.deck[0][0],x1=stage.deck.at(-1)[0],p=clamp((loadX-x0)/Math.max(1,x1-x0),0,1),start=ramp.start??.1,full=Math.max(start+.01,ramp.full??.55);
  const t=clamp((p-start)/(full-start),0,1),smooth=t*t*(3-2*t);
  return base*(.22+.78*smooth);
}
function assemble(loadX,broken=new Set()){
  broken=new Set([...broken,...DEV_STATE.disabledMembers]);
  const solveStarted=performance.now();
  const N=nodes.length, dof=2*N; const K=Array.from({length:dof},()=>new Float64Array(dof)); const F=new Float64Array(dof);
  const index=new Map(nodes.map((n,i)=>[n.id,i]));
  const activeIds=new Set();
  for(const m of members){
    if(broken.has(m.id))continue;
    activeIds.add(m.a);activeIds.add(m.b);
    const a=nodeById(m.a),b=nodeById(m.b), ia=index.get(a.id),ib=index.get(b.id);const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<1)continue;const c=dx/L,s=dy/L,k=MAT[m.mat].EA/L;
    const vals=[[c*c,c*s,-c*c,-c*s],[c*s,s*s,-c*s,-s*s],[-c*c,-c*s,c*c,c*s],[-c*s,-s*s,c*s,s*s]];const map=[2*ia,2*ia+1,2*ib,2*ib+1];
    for(let r=0;r<4;r++)for(let q=0;q<4;q++)K[map[r]][map[q]]+=k*vals[r][q];
  }
  const roadBending=roadBendingTerms(broken);
  assembleRoadBendingStiffness(K,index,roadBending);
  // EDUCATIONAL MULTI-AXLE LOAD MODEL
  // Each axle is treated as an individual moving point load. Axles that have not
  // entered the bridge yet do not load the deck. DOUBLE_VEHICLE contracts add a
  // second synchronized load group at a fixed spacing. This remains a simplified
  // 2D moving-load model rather than a full vehicle/suspension simulation.
  const axleProfile=(stage.axles?.length?stage.axles:[[0,1]]),sumAx=axleProfile.reduce((q,a)=>q+(Number(a[1])||0),0)||1;
  const groups=stage.doubleVehicle?[{offset:0,share:stage.doubleVehicle.share??.5},{offset:-(stage.doubleVehicle.spacing||180),share:1-(stage.doubleVehicle.share??.5)}]:[{offset:0,share:1}];
  const xMin=stage.deck[0][0],xMax=stage.deck.at(-1)[0],axleLoads=[];let roadSeg=null;
  for(const g of groups)for(const ax of axleProfile){
    const axX=loadX+g.offset+(Number(ax[0])||0);if(axX<xMin-3||axX>xMax+3)continue;
    const seg=findRoadSegmentAtX(axX,broken);if(!seg)return {ok:false,reason:'road-gap',loadX,axleX:axX};
    const P=stage.load*g.share*((Number(ax[1])||0)/sumAx);const ia=index.get(seg.a.id),ib=index.get(seg.b.id);
    F[2*ia+1]-=P*(1-seg.t);F[2*ib+1]-=P*seg.t;axleLoads.push({x:axX,load:P,seg});
    if(!roadSeg||Math.abs(axX-loadX)<Math.abs((roadSeg.x??loadX)-loadX))roadSeg={...seg,x:axX};
  }
  if(!roadSeg){roadSeg=findRoadSegmentAtX(clamp(loadX,xMin+1,xMax-1),broken);if(!roadSeg)return {ok:false,reason:'road-gap',loadX}}
  // Wind is distributed across currently built road joints as a simplified
  // lateral load model. It is intentionally not CFD or aeroelastic analysis.
  const wind=effectiveStageWind(loadX);
  if(Math.abs(wind)>1){
    const roadIds=[...new Set(members.filter(m=>m.road&&!broken.has(m.id)).flatMap(m=>[m.a,m.b]))];
    const targets=roadIds.length?roadIds:[leftSupportId(),rightSupportId()];
    const each=wind/targets.length;
    for(const id of targets){const ii=index.get(id);if(ii!=null)F[2*ii]+=each}
  }
  if(devSessionActive())for(const [id,f] of DEV_STATE.nodeForces){const ii=index.get(Number(id));if(ii!=null){F[2*ii]+=Number(f.fx)||0;F[2*ii+1]+=Number(f.fy)||0}}
  const fixed=new Set(); nodes.forEach((n,i)=>{if(n.support==='pin'){fixed.add(2*i);fixed.add(2*i+1)}if(n.support==='roller')fixed.add(2*i+1);if(!activeIds.has(n.id)){fixed.add(2*i);fixed.add(2*i+1)}});
  const free=[];for(let i=0;i<dof;i++)if(!fixed.has(i))free.push(i);
  const A=free.map(r=>Float64Array.from(free.map(c=>K[r][c]))); const b=Float64Array.from(free.map(r=>F[r])); const x=solve(A,b);if(!x)return {ok:false,reason:'solver-instability',loadX};
  const U=new Float64Array(dof);free.forEach((d,i)=>U[d]=x[i]);
  const forces=new Map();let maxRatio=0,worst=null,maxDefl=0;
  nodes.forEach((n,i)=>{maxDefl=Math.max(maxDefl,Math.hypot(U[2*i],U[2*i+1]))});
  for(const m of members){
    if(broken.has(m.id))continue;
    const a=nodeById(m.a),b2=nodeById(m.b),ia=index.get(a.id),ib=index.get(b2.id),dx=b2.x-a.x,dy=b2.y-a.y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L;
    const delta=(U[2*ib]-U[2*ia])*c+(U[2*ib+1]-U[2*ia+1])*s; const force=MAT[m.mat].EA/L*delta;
    let cap=MAT[m.mat].tension, eulerLimit=Infinity, materialCompression=MAT[m.mat].compression, governing='tension';
    if(force<0){
      const comp=compressionCapacity(m.mat,L);
      cap=comp.capacity;eulerLimit=comp.euler;materialCompression=comp.material;governing=comp.governing;
      // Cable remains effectively tension-only; its very small compression limit
      // is still subjected to the same Euler relationship for consistency.
      if(m.mat==='cable')cap=Math.min(cap,MAT.cable.compression);
    }
    const ratio=Math.abs(force)/Math.max(cap,1e-9);
    forces.set(m.id,{force,ratio,capacity:cap,eulerLimit,materialCompression,governing,length:L});
    if(m.user&&ratio>maxRatio){maxRatio=ratio;worst=m}
  }
  const reactions=new Map();
  for(const n of nodes.filter(n=>n.support)){
    const i=index.get(n.id); let rx=0,ry=0;
    for(let q=0;q<dof;q++){rx+=K[2*i][q]*U[q];ry+=K[2*i+1][q]*U[q];}
    rx-=F[2*i]; ry-=F[2*i+1];
    reactions.set(n.id,{rx,ry});
  }
  const deckMetrics=staticDeckMetrics(U,index,broken,roadBending);
  return {ok:true,U,forces,maxRatio,worst,maxDefl,index,reactions,loadX,roadSeg,axleLoads,wind,deckDeflection:deckMetrics.deckDeflection,deckCurvature:deckMetrics.deckCurvature,roadBendingCount:roadBending.length,solveTimeMs:performance.now()-solveStarted};
}
function solve(A,b){
  const n=b.length;if(!n)return null;
  for(let k=0;k<n;k++){
    let piv=k,max=Math.abs(A[k][k]);for(let i=k+1;i<n;i++){const v=Math.abs(A[i][k]);if(v>max){max=v;piv=i}}
    if(max<1e-7)return null;
    if(piv!==k){[A[k],A[piv]]=[A[piv],A[k]];const tb=b[k];b[k]=b[piv];b[piv]=tb}
    for(let i=k+1;i<n;i++){const f=A[i][k]/A[k][k];if(Math.abs(f)<1e-18)continue;A[i][k]=0;for(let j=k+1;j<n;j++)A[i][j]-=f*A[k][j];b[i]-=f*b[k]}
  }
  const x=new Float64Array(n);for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=A[i][j]*x[j];x[i]=s/A[i][i]}return x;
}


/* ===== REAL-TIME COLLAPSE PHYSICS =====
   Position Based Dynamics (PBD) approximation used only when the linear
   static model becomes unstable or the bridge loses its load path.
   It is intentionally educational/game-oriented rather than a design solver. */
function createCollapsePhysics(reason,analysis=null,progress=0,brokenSeed=new Set()){
  const particles=new Map();
  const activeIds=new Set([leftSupportId(),rightSupportId()]);
  members.forEach(m=>{if(!brokenSeed.has(m.id)){activeIds.add(m.a);activeIds.add(m.b)}});

  // Lump a small portion of each member's mass into its end nodes. This makes
  // long/heavy members carry more inertia instead of every joint behaving alike.
  const nodeMass=new Map(nodes.map(n=>[n.id,.55]));
  const density={wood:.010,steel:.017,cable:.0045,road:.030,roadHeavy:.047};
  for(const m of members){
    if(brokenSeed.has(m.id))continue;
    const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)continue;
    const mm=Math.max(.15,dist(a,b)*(density[m.mat]||.01));
    nodeMass.set(m.a,(nodeMass.get(m.a)||.55)+mm*.5);
    nodeMass.set(m.b,(nodeMass.get(m.b)||.55)+mm*.5);
  }

  for(const n of nodes){
    let x=n.x,y=n.y;
    if(analysis?.ok){
      const i=analysis.index.get(n.id);
      if(i!=null){x+=analysis.U[2*i]*2.4;y+=analysis.U[2*i+1]*2.4;}
    }else if(!n.support){
      // Tiny imperfection prevents a perfectly symmetric mechanism from
      // unrealistically balancing forever.
      y+=Math.sin((n.id+1)*1.713)*1.15;
      x+=Math.cos((n.id+2)*1.117)*.45;
    }
    const inactive=!activeIds.has(n.id),mass=Math.max(.35,nodeMass.get(n.id)||.55);
    // Both red bridge-end supports are absolute anchors in the dynamic model.
    // The right support is still described as a roller in the educational/static
    // solver, but visually it must never drift during the game physics.
    const locked=!!n.support||inactive;
    particles.set(n.id,{id:n.id,x,y,px:x,py:y,ox:n.x,oy:n.y,mass,
      lockX:locked,lockY:locked,invMass:locked?0:1/mass});
  }

  const constraints=[],ropeChains=[];
  for(const m of members){
    const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)continue;
    const rest=dist(a,b);
    const mat=m.mat;
    if(mat==='cable'){
      // A cable is represented as a chain of small, gravity-affected particles.
      // Each rope segment can pull when stretched but never pushes when slack,
      // so the cable can sag, whip and drape like a real thread during collapse.
      const pieces=clamp(Math.ceil(rest/DEV_PHYSICS_TUNING.cableSegmentLength),3,24),ids=[m.a];
      for(let i=1;i<pieces;i++){
        const t=i/pieces,id=`rope:${m.id}:${i}`;
        const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        const mass=Math.max(.08,rest*.0045/pieces);
        particles.set(id,{id,x,y,px:x,py:y,ox:x,oy:y,mass,lockX:false,lockY:false,invMass:1/mass,ropeVirtual:true,ropeMemberId:m.id});
        ids.push(id);
      }
      ids.push(m.b);
      ropeChains.push({id:m.id,m,ids,segRest:rest/pieces,totalRest:rest,broken:brokenSeed.has(m.id),breakIndex:-1,tensionLimit:DEV_PHYSICS_TUNING.cableTensionLimit,damping:DEV_PHYSICS_TUNING.cableDamping});
      continue;
    }
    constraints.push({id:m.id,m,a:m.a,b:m.b,rest,broken:brokenSeed.has(m.id),
      stiffness:m.road?(mat==='roadHeavy'?.998:.989):(mat==='steel'?.982:mat==='wood'?.952:.88),
      // Tension and compression are separated so slender compression members
      // can buckle earlier than they tear in tension.
      tensionLimit:m.road?(mat==='roadHeavy'?.105:.072):(mat==='steel'?.060:mat==='wood'?.082:.15),
      compressionLimit:m.road?(mat==='roadHeavy'?.075:.050):(mat==='steel'?.036:mat==='wood'?.050:.01),
      eulerCapacityRatio:clamp(compressionCapacity(mat,rest).capacity/Math.max(MAT[mat].compression,1),.18,1),
      damping:m.road?.12:(mat==='steel'?.07:mat==='wood'?.10:.035)});
  }

  // Two adjacent roadway pieces also get a weak 'bending' constraint between
  // their outer joints. This is not a hidden structural member: it only models
  // the rotational stiffness of the road deck during dynamic collapse.
  const roadBends=[];
  const byRoadNode=new Map();
  for(const c of constraints){
    if(!c.m.road||c.broken)continue;
    if(!byRoadNode.has(c.a))byRoadNode.set(c.a,[]);if(!byRoadNode.has(c.b))byRoadNode.set(c.b,[]);
    byRoadNode.get(c.a).push(c);byRoadNode.get(c.b).push(c);
  }
  for(const [mid,links] of byRoadNode){
    if(links.length!==2)continue;
    const c1=links[0],c2=links[1];
    const a=c1.a===mid?c1.b:c1.a,b=c2.a===mid?c2.b:c2.a;
    const pa=collapseParticle({particles},a),pb=collapseParticle({particles},b);
    if(!pa||!pb)continue;
    roadBends.push({mid,a,b,rest:Math.hypot(pb.x-pa.x,pb.y-pa.y),
      stiffness:(c1.m.mat==='roadHeavy'&&c2.m.mat==='roadHeavy')?DEV_PHYSICS_TUNING.roadBendingHeavy:DEV_PHYSICS_TUNING.roadBendingNormal,c1,c2});
  }

  const broken=new Set(brokenSeed);
  const span=stage.deck.at(-1)[0]-stage.deck[0][0];
  const x=stage.deck[0][0]+clamp(progress,0,1)*span;
  const vehicleScale=stage.vehicleRenderScale||devVehicleRenderScale(stage),bodyLift=(stage.vehicle==='TRUCK'?40:31)*vehicleScale;
  const y=deckYAt(clamp(x,stage.deck[0][0],stage.deck.at(-1)[0]),analysis,analysis?.ok?2.4:0)-bodyLift;
  const wheelR=(stage.vehicle==='TRUCK'?14:(stage.vehicle==='BUS'?10.5:9.5))*vehicleScale;
  const vehicleMass=Math.max(0.7,stage.load/13000);
  return {reason,particles,constraints,ropeChains,roadBends,broken,time:0,lastBreakTime:-9,dust:[],flashes:[],
    gravity:DEV_PHYSICS_TUNING.gravity,airDrag:DEV_PHYSICS_TUNING.airDrag,vehicle:{x,y,vx:devVehicleSpeed(stage)*simSpeed,vy:0,angle:0,angularVel:0,rot:0,wheelR,
      attached:true,segmentId:null,bodyLift,mass:vehicleMass,airborneTime:0,fallStartY:y,impactSpeed:0},maxDrop:0,roadBreaks:0,roadLoadDamage:new Map()};
}
function collapseParticle(physics,id){return physics.particles.get(id)}
function collapseConstraint(physics,id){return physics.constraints.find(c=>c.id===id)}
function breakCollapseRope(physics,rope,index){
  if(!rope||rope.broken)return;
  rope.broken=true;rope.breakIndex=clamp(index,0,rope.ids.length-2);physics.broken.add(rope.id);physics.lastBreakTime=physics.time;
  const a=collapseParticle(physics,rope.ids[rope.breakIndex]),b=collapseParticle(physics,rope.ids[rope.breakIndex+1]);
  if(a&&b){
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;physics.flashes.push({x:mx,y:my,life:.28,max:.28});
    for(let i=0;i<4;i++)physics.dust.push({x:mx,y:my,vx:(Math.random()-.5)*45,vy:-12-Math.random()*28,life:.45+Math.random()*.25,max:.7,r:.7+Math.random()*1.1});
  }
  lastBroken=new Set(physics.broken);if(sim)sim.broken=new Set(physics.broken);
}
function solveRopeChains(physics){
  for(const rope of physics.ropeChains||[]){
    for(let i=0;i<rope.ids.length-1;i++){
      if(rope.broken&&i===rope.breakIndex)continue;
      const a=collapseParticle(physics,rope.ids[i]),b=collapseParticle(physics,rope.ids[i+1]);if(!a||!b)continue;
      const L=Math.hypot(b.x-a.x,b.y-a.y);
      // Thread/rope has no compression stiffness: a slack segment simply folds.
      if(L>rope.segRest)solveDistancePair(a,b,rope.segRest,.965);
    }
  }
}
function dampRopeVelocity(physics){
  for(const rope of physics.ropeChains||[]){
    for(let i=0;i<rope.ids.length-1;i++){
      if(rope.broken&&i===rope.breakIndex)continue;
      const a=collapseParticle(physics,rope.ids[i]),b=collapseParticle(physics,rope.ids[i+1]);if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=dx/L,ny=dy/L;
      const rel=((b.x-b.px)-(a.x-a.px))*nx+((b.y-b.py)-(a.y-a.py))*ny;
      const wa=a.invMass,wb=b.invMass,ws=wa+wb;if(ws<=0)continue;
      const imp=rel*rope.damping;
      if(wa){a.px-=nx*imp*(wa/ws);a.py-=ny*imp*(wa/ws)}
      if(wb){b.px+=nx*imp*(wb/ws);b.py+=ny*imp*(wb/ws)}
    }
  }
}
function evaluateRopeBreaks(physics){
  for(const rope of physics.ropeChains||[]){
    if(rope.broken||physics.time<.10)continue;
    let worst=-1,worstStrain=0;
    for(let i=0;i<rope.ids.length-1;i++){
      const a=collapseParticle(physics,rope.ids[i]),b=collapseParticle(physics,rope.ids[i+1]);if(!a||!b)continue;
      const strain=(Math.hypot(b.x-a.x,b.y-a.y)-rope.segRest)/Math.max(rope.segRest,1);
      if(strain>worstStrain){worstStrain=strain;worst=i}
    }
    if(worstStrain>rope.tensionLimit)breakCollapseRope(physics,rope,worst);
  }
}

function breakCollapseConstraint(physics,c,kind='strain'){
  if(!c||c.broken)return;
  c.broken=true;physics.broken.add(c.id);physics.lastBreakTime=physics.time;
  if(c.m.road)physics.roadBreaks++;
  const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  physics.flashes.push({x:mx,y:my,life:.34,max:.34});
  for(let i=0;i<6;i++){
    const ang=-Math.PI*.9+(i/5)*Math.PI*.8,sp=28+Math.random()*48;
    physics.dust.push({x:mx,y:my,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-14,life:.65+Math.random()*.38,max:1.05,r:1.2+Math.random()*1.9});
  }
  lastBroken=new Set(physics.broken);if(sim)sim.broken=new Set(physics.broken);
}
function findCollapseRoadSegment(physics,x,contactY=null,preferredId=null){
  let best=null,bestScore=Infinity;
  const intactRoads=[];
  for(const c of physics.constraints){
    if(!c.m.road||c.broken)continue;
    const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);if(!a||!b)continue;
    intactRoads.push({c,a,b});
    const minX=Math.min(a.x,b.x)-12,maxX=Math.max(a.x,b.x)+12;if(x<minX||x>maxX)continue;
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(Math.abs(dx)<1e-5?.5:(x-a.x)/dx,0,1);
    const qx=a.x+dx*t,qy=a.y+dy*t;
    // Vehicle surface detection is road-only. Cables, wood and steel are never
    // treated as drivable surfaces, even if they cross between car and deck.
    let score=Math.abs(qx-x)*2;
    if(contactY!=null){
      const vertical=qy-contactY;
      if(vertical<-18||vertical>165)continue;
      score+=Math.abs(vertical);
    }else score+=Math.abs(qy-guideDeckYAt(x))*.10;
    if(c.id===preferredId)score-=18;
    if(score<bestScore){bestScore=score;best={c,a,b,t,x:qx,y:qy,angle:Math.atan2(dy,dx),virtualGap:false}}
  }
  if(best)return best;

  // SMALL ROAD GAP TOLERANCE
  // A real wheel can cross a narrow expansion gap even though the road meshes
  // are not topologically joined. When there is no direct segment below the car,
  // look for the nearest intact road end on each side and temporarily treat the
  // space between them as a wheel-contact span. This does NOT add structural
  // stiffness; it only prevents tiny visual gaps from making the vehicle fall.
  if(contactY==null||intactRoads.length<2)return null;
  const endpoints=[];
  for(const r of intactRoads){
    endpoints.push({p:r.a,c:r.c});
    endpoints.push({p:r.b,c:r.c});
  }
  let left=null,right=null;
  for(const e of endpoints){
    if(e.p.x<=x&&(!left||e.p.x>left.p.x))left=e;
    if(e.p.x>=x&&(!right||e.p.x<right.p.x))right=e;
  }
  if(!left||!right||left.p.id===right.p.id)return null;
  const gapX=right.p.x-left.p.x;
  const maxGap=clamp((physics.vehicle?.wheelR||10)*5.8,48,72);
  if(gapX<=0||gapX>maxGap)return null;
  const gapY=Math.abs(right.p.y-left.p.y);
  if(gapY>30)return null;
  const t=clamp((x-left.p.x)/Math.max(1,gapX),0,1);
  const baseY=left.p.y+(right.p.y-left.p.y)*t;
  const dip=Math.sin(Math.PI*t)*Math.min(4.5,gapX*.07);
  const qy=baseY+dip;
  const vertical=qy-contactY;
  if(vertical<-20||vertical>42)return null;
  return {
    c:{id:`road-gap:${left.p.id}:${right.p.id}`,m:{road:true,mat:'road'},virtualGap:true},
    a:left.p,b:right.p,t,x,
    y:qy,
    angle:Math.atan2(right.p.y-left.p.y,Math.max(1,gapX)),
    virtualGap:true,gap:gapX
  };
}

function structurallyBracedRoadNodes(physics){
  const adj=new Map();
  const add=(a,b)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b)};
  for(const c of physics.constraints){if(c.broken||c.m.road)continue;add(c.a,c.b);add(c.b,c.a)}
  for(const rope of physics.ropeChains||[]){if(rope.broken)continue;add(rope.m.a,rope.m.b);add(rope.m.b,rope.m.a)}
  const supports=new Set([leftSupportId(),rightSupportId()]);
  const braced=new Set(supports);
  // A road node counts as structurally supported only if a non-road path can
  // reach an actual bridge-end anchor. Dangling decorative members do not help.
  for(const n of nodes){
    if(!(n.roadNode||n.support))continue;
    const seen=new Set([n.id]),q=[n.id];let ok=supports.has(n.id);
    while(q.length&&!ok){const u=q.shift();for(const v of adj.get(u)||[]){if(seen.has(v))continue;seen.add(v);if(supports.has(v)){ok=true;break}q.push(v)}}
    if(ok)braced.add(n.id);
  }
  return braced;
}
function roadSupportSpanAtX(physics,x){
  const braced=structurallyBracedRoadNodes(physics);
  const roadIds=new Set();for(const c of physics.constraints){if(c.m.road&&!c.broken){roadIds.add(c.a);roadIds.add(c.b)}}
  const pts=[...roadIds].map(id=>collapseParticle(physics,id)).filter(Boolean).sort((a,b)=>a.x-b.x);
  const supports=pts.filter(p=>braced.has(p.id));
  let left=null,right=null;for(const p of supports){if(p.x<=x)left=p;if(p.x>=x){right=p;break}}
  if(!left)left=pts[0]||null;if(!right)right=pts.at(-1)||null;
  if(!left||!right||right.x-left.x<20)return null;
  return {left,right,L:Math.max(20,right.x-left.x),braced};
}
function applyRoadBendingDemand(physics,dt){
  const v=physics.vehicle;if(!v.attached)return;
  const span=roadSupportSpanAtX(physics,v.x);if(!span)return;
  const L=span.L,a=clamp(v.x-span.left.x,0,L),b=L-a;
  const P=stage.load/1000;
  const reactionL=P*b/L,reactionR=P*a/L;
  let worst=null,worstRatio=0;
  for(const bend of physics.roadBends){
    if(bend.c1.broken||bend.c2.broken)continue;
    const p=collapseParticle(physics,bend.mid);if(!p||p.x<span.left.x-4||p.x>span.right.x+4)continue;
    const z=clamp(p.x-span.left.x,0,L);
    // Bending-moment proxy for a simply-supported beam under the vehicle's
    // current point load. Demand therefore travels with the car instead of
    // magically peaking at midspan before the vehicle reaches it.
    const localMoment=z<=a?reactionL*z:reactionR*(L-z);
    const heavy=bend.c1.m.mat==='roadHeavy'&&bend.c2.m.mat==='roadHeavy';
    const cap=heavy?1750:950;
    const ratio=localMoment/cap;
    bend.momentDemand=ratio;
    const old=physics.roadLoadDamage.get(bend.mid)||0;
    const grow=ratio>0.62?(ratio-.62)*dt:-(.30*dt);
    const dmg=clamp(old+grow,0,2);physics.roadLoadDamage.set(bend.mid,dmg);
    // Visible elastic sag before fracture. It is small when the deck has short,
    // well-braced panels and much stronger on a long unsupported straight deck.
    if(p.invMass&&ratio>.35){
      const flex=Math.min(85,(ratio-.35)*48)*dt;
      p.y+=Math.max(0,flex);
    }
    if(dmg>worstRatio){worstRatio=dmg;worst=bend}
  }
  if(worst&&worstRatio>0.34&&physics.time-physics.lastBreakTime>.20){
    const mid=collapseParticle(physics,worst.mid);
    const c1=worst.c1,c2=worst.c2;
    const d1=Math.abs(((collapseParticle(physics,c1.a)?.x||0)+(collapseParticle(physics,c1.b)?.x||0))/2-v.x);
    const d2=Math.abs(((collapseParticle(physics,c2.a)?.x||0)+(collapseParticle(physics,c2.b)?.x||0))/2-v.x);
    breakCollapseConstraint(physics,d1<d2?c1:c2,'bending-load');
  }
}

function enforceCollapseLocks(physics){
  for(const p of physics.particles.values()){
    if(p.lockX){p.x=p.ox;p.px=p.ox}
    if(p.lockY){p.y=p.oy;p.py=p.oy}
  }
}
function solveDistancePair(a,b,rest,k){
  let dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<1e-6)return;
  const diff=(L-rest)/L,wa=a.invMass,wb=b.invMass,ws=wa+wb;if(ws<=0)return;
  const cx=dx*diff*k,cy=dy*diff*k;
  if(wa){a.x+=cx*(wa/ws);a.y+=cy*(wa/ws)}
  if(wb){b.x-=cx*(wb/ws);b.y-=cy*(wb/ws)}
}

function closestPointOnSegment(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den<1e-9?0:clamp(((px-ax)*dx+(py-ay)*dy)/den,0,1);
  return {x:ax+dx*t,y:ay+dy*t,t};
}
function collisionMemberRadius(mat){
  if(mat==='cable')return 2.2;
  if(mat==='steel')return 4.4;
  if(mat==='wood')return 4.8;
  return 4;
}
function resolveParticleRoadCollision(physics,p,roadC,extraRadius=4){
  if(!p||p.invMass<=0||roadC.broken)return false;
  if(p.id===roadC.a||p.id===roadC.b)return false;
  const a=collapseParticle(physics,roadC.a),b=collapseParticle(physics,roadC.b);if(!a||!b)return false;
  const q=closestPointOnSegment(p.x,p.y,a.x,a.y,b.x,b.y);
  let nx=p.x-q.x,ny=p.y-q.y,dist=Math.hypot(nx,ny);
  const roadRadius=(MAT[roadC.m.mat]?.roadWidth||16)*.5;
  const minDist=roadRadius+extraRadius;
  if(dist>=minDist)return false;
  if(dist<1e-5){
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
    nx=-dy/L;ny=dx/L;
    const oldSide=(p.py-(a.py+(b.py-a.py)*q.t))*ny+(p.px-(a.px+(b.px-a.px)*q.t))*nx;
    if(oldSide<0){nx=-nx;ny=-ny}
    dist=0;
  }else{nx/=dist;ny/=dist}
  const penetration=minDist-dist;
  const wa=p.invMass,wbA=a.invMass*(1-q.t),wbB=b.invMass*q.t,ws=wa+wbA+wbB;
  if(ws<=0)return false;
  const push=penetration*DEV_PHYSICS_TUNING.collisionPush;
  p.x+=nx*push*(wa/ws);p.y+=ny*push*(wa/ws);
  if(a.invMass){a.x-=nx*push*(wbA/ws);a.y-=ny*push*(wbA/ws)}
  if(b.invMass){b.x-=nx*push*(wbB/ws);b.y-=ny*push*(wbB/ws)}
  // Contact friction / impact damping by reducing normal and tangential motion.
  const pvx=p.x-p.px,pvy=p.y-p.py;
  const vn=pvx*nx+pvy*ny,tx=pvx-vn*nx,ty=pvy-vn*ny;
  if(vn<0){
    const bounce=.08,friction=.82;
    const nvx=tx*friction-vn*bounce*nx,nvy=ty*friction-vn*bounce*ny;
    p.px=p.x-nvx;p.py=p.y-nvy;
  }
  return true;
}
function solveMaterialRoadCollisions(physics){
  const roads=physics.constraints.filter(c=>c.m.road&&!c.broken);
  if(!roads.length)return;
  // Node-vs-deck collision catches falling joints and gives them friction.
  for(const p of physics.particles.values()){
    const n=nodeById(p.id);if((!n&&!p.ropeVirtual)||n?.support)continue;
    for(const r of roads)resolveParticleRoadCollision(physics,p,r,p.ropeVirtual?2.1:5.2);
  }
  // Body-vs-deck collision: sample along each non-road member so long members
  // cannot visually tunnel straight through the roadway between their joints.
  for(const c of physics.constraints){
    if(c.broken||c.m.road)continue;
    const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);if(!a||!b)continue;
    const rad=collisionMemberRadius(c.m.mat);
    for(const r of roads){
      if(r.a===c.a||r.a===c.b||r.b===c.a||r.b===c.b)continue;
      for(const t of [.2,.4,.6,.8]){
        const sx=a.x+(b.x-a.x)*t,sy=a.y+(b.y-a.y)*t;
        const proxy={id:-999999,x:sx,y:sy,px:a.px+(b.px-a.px)*t,py:a.py+(b.py-a.py)*t,invMass:a.invMass*(1-t)+b.invMass*t};
        const beforeX=proxy.x,beforeY=proxy.y;
        if(!resolveParticleRoadCollision(physics,proxy,r,rad))continue;
        const dx=proxy.x-beforeX,dy=proxy.y-beforeY;
        const wa=a.invMass*(1-t),wb=b.invMass*t,ws=wa+wb;
        if(ws>0){
          if(a.invMass){a.x+=dx*(wa/ws);a.y+=dy*(wa/ws);a.px+=dx*(wa/ws)*.35;a.py+=dy*(wa/ws)*.35}
          if(b.invMass){b.x+=dx*(wb/ws);b.y+=dy*(wb/ws);b.px+=dx*(wb/ws)*.35;b.py+=dy*(wb/ws)*.35}
        }
      }
    }
  }
}

function dampConstraintVelocity(c,physics){
  if(c.broken||!c.damping)return;
  const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);if(!a||!b)return;
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=dx/L,ny=dy/L;
  const avx=a.x-a.px,avy=a.y-a.py,bvx=b.x-b.px,bvy=b.y-b.py;
  const rel=(bvx-avx)*nx+(bvy-avy)*ny,imp=rel*c.damping;
  const wa=a.invMass,wb=b.invMass,ws=wa+wb;if(ws<=0)return;
  if(wa){a.px-=nx*imp*(wa/ws);a.py-=ny*imp*(wa/ws)}
  if(wb){b.px+=nx*imp*(wb/ws);b.py+=ny*imp*(wb/ws)}
}
function solveCollapseConstraints(physics){
  for(let iter=0;iter<DEV_PHYSICS_TUNING.constraintIterations;iter++){
    for(const c of physics.constraints){
      if(c.broken)continue;
      const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);if(!a||!b)continue;
      solveDistancePair(a,b,c.rest,c.stiffness);
    }
    solveRopeChains(physics);
    // Road bending stiffness is intentionally weak; it yields visibly before
    // the axial members fail, giving a beam-like rather than rope-like deck.
    for(const bend of physics.roadBends){
      if(bend.c1.broken||bend.c2.broken)continue;
      const a=collapseParticle(physics,bend.a),b=collapseParticle(physics,bend.b);if(!a||!b)continue;
      solveDistancePair(a,b,bend.rest,bend.stiffness);
    }
    enforceCollapseLocks(physics);
  }
  for(const c of physics.constraints)dampConstraintVelocity(c,physics);
  dampRopeVelocity(physics);
}
function evaluateCollapseBreaks(physics,dt=1/300){
  // Sandbox FAILURE OFF keeps every member intact, even if Dynamic Physics is entered for another reason.
  if(stage?.sandbox&&!memberFailureEnabled())return;
  evaluateRopeBreaks(physics);
  for(const c of physics.constraints){
    if(c.broken||physics.time<.12)continue;
    const a=collapseParticle(physics,c.a),b=collapseParticle(physics,c.b);if(!a||!b)continue;
    const L=Math.hypot(b.x-a.x,b.y-a.y),strain=(L-c.rest)/Math.max(c.rest,1);
    if(c.m.mat==='cable'){
      if(strain>c.tensionLimit)breakCollapseConstraint(physics,c,'tension');
      continue;
    }
    if(strain>c.tensionLimit){breakCollapseConstraint(physics,c,'tension');continue}
    if(strain<0){
      // Dynamic collapse uses the same Euler-derived relative capacity as the
      // static solver, mapped onto the PBD strain threshold. This keeps the
      // collapse animation compatible with the educational 1/L² buckling rule.
      const limit=c.compressionLimit*(c.eulerCapacityRatio??1);
      if(-strain>limit)breakCollapseConstraint(physics,c,'buckling');
    }
  }

  // Deck joint rotation failure. This complements axial strain and prevents a
  // road chain from behaving like infinitely flexible hinges.
  if(physics.time-physics.lastBreakTime>.28){
    let worst=null,worstScore=0;
    for(const bend of physics.roadBends){
      if(bend.c1.broken||bend.c2.broken)continue;
      const p=collapseParticle(physics,bend.mid),a=collapseParticle(physics,bend.a),b=collapseParticle(physics,bend.b);if(!p||!a||!b)continue;
      const v1x=a.x-p.x,v1y=a.y-p.y,v2x=b.x-p.x,v2y=b.y-p.y;
      const l1=Math.hypot(v1x,v1y)||1,l2=Math.hypot(v2x,v2y)||1;
      const ang=Math.acos(clamp((v1x*v2x+v1y*v2y)/(l1*l2),-1,1));
      const hinge=Math.abs(Math.PI-ang),drop=Math.max(0,p.y-p.oy);
      const heavy=bend.c1.m.mat==='roadHeavy'&&bend.c2.m.mat==='roadHeavy';
      const score=hinge/(heavy?.68:.50)+drop/(heavy?118:86);
      if(score>worstScore){worstScore=score;worst=bend}
    }
    if(worst&&worstScore>1.22){
      const c=(physics.roadBreaks%2)?worst.c1:worst.c2;breakCollapseConstraint(physics,c,'hinge');
    }
  }
}
function updateCollapseEffects(physics,dt){
  for(const d of physics.dust){d.vy+=physics.gravity*.30*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.life-=dt}
  physics.dust=physics.dust.filter(d=>d.life>0);
  for(const f of physics.flashes)f.life-=dt;physics.flashes=physics.flashes.filter(f=>f.life>0);
}
function stepCollapsePhysics(physics,dt){
  dt=clamp(dt,0,.030);
  const substeps=DEV_PHYSICS_TUNING.substeps,h=dt/substeps;
  for(let s=0;s<substeps;s++){
    physics.time+=h;
    const contactY=physics.vehicle.y+physics.vehicle.bodyLift;
    const seg=findCollapseRoadSegment(physics,physics.vehicle.x,contactY,physics.vehicle.segmentId);
    const windAcc=clamp((stage.wind||0)/1000,-20,20)*4.0;
    for(const p of physics.particles.values()){
      if(p.invMass<=0)continue;
      const vx=(p.x-p.px)*physics.airDrag,vy=(p.y-p.py)*physics.airDrag;
      p.px=p.x;p.py=p.y;
      let ax=windAcc,ay=physics.gravity;
      // Apply vehicle weight as force/mass and distribute it according to the
      // wheel contact position on the current roadway segment.
      if(seg){
        const contactForce=physics.vehicle.mass*260;
        if(p.id===seg.a.id)ay+=contactForce*(1-seg.t)/Math.max(.35,p.mass);
        if(p.id===seg.b.id)ay+=contactForce*seg.t/Math.max(.35,p.mass);
      }
      p.x+=vx+ax*h*h;p.y+=vy+ay*h*h;
    }
    enforceCollapseLocks(physics);solveCollapseConstraints(physics);
    // Physical contact pass after structural constraints: falling truss members
    // collide with the built road instead of ghosting through it.
    solveMaterialRoadCollisions(physics);enforceCollapseLocks(physics);applyRoadBendingDemand(physics,h);evaluateCollapseBreaks(physics,h);
  }

  const v=physics.vehicle;
  if(v.attached){
    const seg=findCollapseRoadSegment(physics,v.x,v.y+v.bodyLift,v.segmentId);
    if(seg&&Math.abs(seg.angle)<1.10){
      // While the tyres are in contact, gravity contributes an along-slope
      // component. This is still a compact game model, but the vehicle speed is
      // no longer detached from the current road inclination.
      const slopeAccel=physics.gravity*Math.sin(seg.angle)*.13;
      const target=82*simSpeed;
      v.vx+=slopeAccel*dt+(target-v.vx)*clamp(dt*1.7,0,1);
      v.vx=clamp(v.vx,30*simSpeed,145*simSpeed);
      if(DEV_STATE.vehicleFrozen)v.vx=0;
  v.x+=v.vx*dt;v.segmentId=seg.c.id;v.y=seg.y-v.bodyLift;
      v.angle+=(seg.angle-v.angle)*clamp(dt*10,0,1);v.rot+=(v.vx*dt)/v.wheelR;
      v.airborneTime=0;v.fallStartY=v.y;
      const originalY=guideDeckYAt(clamp(v.x,stage.deck[0][0],stage.deck.at(-1)[0]));
      const verticalSpeed=Math.abs((seg.a.y-seg.a.py)*(1-seg.t)+(seg.b.y-seg.b.py)*seg.t)/Math.max(dt,.001);
      if(seg.y-originalY>125||verticalSpeed>380){
        v.attached=false;v.vy=Math.max(55,verticalSpeed*.18);v.angularVel=seg.angle*1.3;v.fallStartY=v.y;
      }
    }else{
      // No drivable road remains under the vehicle. Preserve horizontal
      // momentum and hand motion over to a ballistic trajectory: y'' = g.
      v.attached=false;v.vy=Math.max(v.vy,28);v.angularVel+=(v.angle>=0?1:-1)*.85;v.fallStartY=v.y;v.airborneTime=0;
    }
  }else{
    // Airborne vehicle: semi-implicit Euler integration of gravity. Horizontal
    // momentum is retained with only mild air drag; no invisible road or guide
    // line holds the car up after it drives off an unfinished deck.
    v.airborneTime=(v.airborneTime||0)+dt;
    v.vy+=physics.gravity*dt;v.vx*=Math.pow(.996,dt*60);v.x+=v.vx*dt;v.y+=v.vy*dt;v.angle+=v.angularVel*dt;v.rot+=(v.vx*dt)/v.wheelR;
    const landing=findCollapseRoadSegment(physics,v.x,v.y+v.bodyLift,v.segmentId);
    if(landing&&Math.abs(landing.angle)<1.05){
      const gap=landing.y-(v.y+v.bodyLift);
      if(gap>=-7&&gap<=22&&v.vy>=-25){
        const impact=Math.max(0,v.vy);v.impactSpeed=impact;
        v.attached=true;v.segmentId=landing.c.id;v.y=landing.y-v.bodyLift;v.angle=landing.angle;v.vy=0;v.angularVel*=.18;v.airborneTime=0;
        // A hard landing is visible/audible but does not invent an extra failure
        // rule. Structural consequences still come from the road/member model.
        if(impact>145){kickShake(clamp(impact/65,2.2,6.5),140);playSfx('node')}
        v.vx=Math.max(v.vx,34*simSpeed);
      }
    }
  }

  let maxDrop=0;for(const p of physics.particles.values())maxDrop=Math.max(maxDrop,p.y-p.oy);
  physics.maxDrop=Math.max(physics.maxDrop,maxDrop);updateCollapseEffects(physics,dt);
}
function enterCollapseMode(s,reason,analysis,progress,now=performance.now()){
  s.mode='collapse';s.failReason='collapse';s.collapseReason=reason;s.failed=true;s.collapseStart=now;s.lastTick=now;
  s.preCollapseAnalysis=analysis?.ok?analysis:(s.preCollapseAnalysis||null);
  s.physics=createCollapsePhysics(reason,analysis,progress,s.broken||new Set());
  s.broken=s.physics.broken;s.last=null;s.maxDefl=Math.max(s.maxDefl||0,s.physics.maxDrop||0);
  if(analysis?.ok){s.maxDeckDefl=Math.max(s.maxDeckDefl||0,analysis.deckDeflection||0);s.maxDeckCurvature=Math.max(s.maxDeckCurvature||0,analysis.deckCurvature||0)}
  stressMode=false;loadPathMode=false;lastFullAnalysis=null;currentAnalysis={ok:false};
  setCoach('collapse',{sim:s,analysis:s.preCollapseAnalysis});
  toast(reason==='road-gap'?'OPEN DECK // 중력 기반 차량 물리 시뮬레이션':'DYNAMIC COLLAPSE // 중력 기반 물리 시뮬레이션');
}
function startUnstableCollapse(failureHint='missing-load-path'){
  setGamePhase(GAME_PHASE.TEST);
  const roadOpen=failureHint==='road-disconnected';
  const s={mode:'collapse',start:performance.now(),duration:0,progress:.02,shipProgress:stage.ship?0:null,maxRatio:0,maxDefl:0,worst:null,worstForce:0,failed:true,failReason:'collapse',last:null,broken:new Set(),brokenCount:0,serviceabilityFailed:false,vehiclePass:false,vesselPass:!stage.ship,vesselCollision:false,vesselClearance:Infinity,minVesselClearance:Infinity,maxDeckDefl:0,maxDeckCurvature:0,failureEvents:[],failureHint,roadPhysicsOnly:roadOpen};
  sim=s;enterCollapseMode(s,roadOpen?'road-gap':'unstable',null,.02,s.start);
  if(roadOpen)toast('OPEN ROAD // DYNAMIC VEHICLE PHYSICS');
  ui.test.textContent='■ STOP';ui.test.classList.add('stop');updateTestTelemetry();requestAnimationFrame(tick);
}
function tickCollapse(now){
  const s=sim;if(!s||s.mode!=='collapse')return;if(DEV_STATE.simPaused)return;
  const dt=(now-s.lastTick)/1000;s.lastTick=now;anim=now/16.67;
  stepCollapsePhysics(s.physics,dt);
  s.broken=s.physics.broken;s.brokenCount=s.broken.size;s.maxDefl=Math.max(s.maxDefl,s.physics.maxDrop);
  const deckMetrics=collapseDeckMetrics(s.physics);s.maxDeckDefl=Math.max(s.maxDeckDefl||0,deckMetrics.deckDeflection);s.maxDeckCurvature=Math.max(s.maxDeckCurvature||0,deckMetrics.deckCurvature);
  const elapsed=(now-s.collapseStart)/1000;
  if(stage.ship){
    s.shipProgress=clamp((now-s.start)/(4300/(simSpeed*Math.max(.1,devVehicleSpeedScale(stage)))),0,1);
    const vc=evaluateVesselSweptClearance(s.shipProgress,null,s.physics);
    s.vesselClearance=vc.clearance;s.minVesselClearance=Math.min(s.minVesselClearance,vc.clearance);
    if(vc.collision){s.vesselCollision=true;s.vesselPass=false;s.failReason='vessel-collision';draw();updateTestTelemetry();finishSimulation(false);return}
    if(s.shipProgress>=.999)s.vesselPass=true;
  }
  draw();updateTestTelemetry();
  const vehicleGone=s.physics.vehicle.y>H+150;
  const enoughTime=elapsed>3.15/Math.sqrt(simSpeed);
  if((vehicleGone&&elapsed>1.7)||elapsed>4.45/Math.sqrt(simSpeed)){
    finishSimulation(false);return;
  }
  requestAnimationFrame(tick);
}
function startSimulation(fromTutorial=false){
  if(tutorialMode&&!fromTutorial){tutorialHandleAction('test');return}
  if(sim){stopSimulation();return}
  if(!stage.sandbox && totalCost>stage.budget*2){const fs={mode:'static',failReason:'budget-overrun',maxRatio:0,maxDefl:0,maxDeckDefl:0,maxDeckCurvature:0,brokenCount:0,vehiclePass:false,vesselPass:!stage.ship,vesselCollision:false,minVesselClearance:Infinity,failureEvents:[]};toast('BUDGET OVERRUN // TEST BLOCKED');setCoach('budget');showResult(false,fs);return}
  setGamePhase(GAME_PHASE.TEST);
  selected=null;lastBroken=new Set();playSfx('test');
  const probe=assemble(stage.deck[0][0]+1,lastBroken);
  if(!probe.ok){startUnstableCollapse(roadPathConnected()?'missing-load-path':'road-disconnected');return}
  sim={mode:'static',start:performance.now(),duration:6200/(simSpeed*Math.max(.1,devVehicleSpeedScale(stage))),progress:0,shipProgress:stage.ship?0:null,maxRatio:0,maxDefl:0,worst:null,worstForce:0,failed:false,failReason:null,last:probe,broken:new Set(),brokenCount:0,serviceabilityFailed:false,vehiclePass:false,vesselPass:!stage.ship,vesselCollision:false,vesselClearance:Infinity,minVesselClearance:Infinity,maxDeckDefl:0,maxDeckCurvature:0,failureEvents:[],failureHint:null,collapseReason:null,coachLastUpdate:0,coachHoldUntil:0};
  ui.test.textContent='■ STOP';ui.test.classList.add('stop');stressMode=true;updateTestTelemetry();requestAnimationFrame(tick);
}
function stopSimulation(){setGamePhase(GAME_PHASE.BUILD);sim=null;ui.test.textContent='▶ 시험';ui.test.classList.remove('stop');updateTestTelemetry();draw()}
function deterministicContractHash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function applyScheduledMemberFailure(s,a,p,now){
  const evt=stage.forcedFailure;if(!evt||s.forcedFailureTriggered||p<(evt.progress??.55)||!a?.ok)return a;
  const candidates=members.filter(m=>m.user&&!m.road&&!s.broken.has(m.id)&&a.forces?.has(m.id)).sort((m1,m2)=>(a.forces.get(m2.id)?.ratio||0)-(a.forces.get(m1.id)?.ratio||0)).slice(0,Math.max(1,evt.candidates||5));
  if(!candidates.length){s.forcedFailureTriggered=true;return a}
  const level=currentCampaignLevel(),pick=candidates[deterministicContractHash(level?.id||stage.title)%candidates.length],info=a.forces.get(pick.id);s.forcedFailureTriggered=true;s.broken.add(pick.id);s.brokenCount=s.broken.size;lastBroken=new Set(s.broken);
  s.failureEvents=s.failureEvents||[];s.failureEvents.push({id:pick.id,mat:pick.mat,force:info?.force||0,governing:info?.governing||'event',ratio:info?.ratio||0,length:info?.length,capacity:info?.capacity,eulerLimit:info?.eulerLimit,forced:true});
  setCoach('memberFailure',{analysis:a,event:s.failureEvents.at(-1),member:pick});s.coachHoldUntil=now+1500;toast(`REDUNDANCY EVENT // MEMBER ${coachMemberNumber(pick)} REMOVED`);kickShake(4,160);playSfx('break');
  return assemble(stage.deck[0][0]+p*(stage.deck.at(-1)[0]-stage.deck[0][0]),s.broken);
}
function tick(now){
  if(!sim)return;if(DEV_STATE.simPaused)return;
  if(sim.mode==='collapse'){tickCollapse(now);return}
  const s=sim;anim=now/16.67;
  const raw=DEV_STATE.vehicleFrozen?clamp(s.progress||0,0,1):clamp((now-s.start)/s.duration,0,1);
  const p=raw<.12?(.5*(1-Math.cos(Math.PI*raw/.12))*.12):raw>.88?(.88+.5*(1-Math.cos(Math.PI*(raw-.88)/.12))*.12):raw;
  s.progress=p;
  if(stage.ship)s.shipProgress=clamp((raw-.03)/.92,0,1);
  const x=stage.deck[0][0]+p*(stage.deck.at(-1)[0]-stage.deck[0][0]);

  let a=assemble(x,s.broken);
  if(!a.ok){
    const roadGap=a.reason==='road-gap';
    if(roadGap){s.failureHint='road-disconnected';s.roadPhysicsOnly=true}
    enterCollapseMode(s,roadGap?'road-gap':'solver-instability',s.last?.ok?s.last:null,p,now);
    if(roadGap)toast('ROAD EDGE // VEHICLE NOW FOLLOWS GRAVITY');
    draw();requestAnimationFrame(tick);return
  }

  a=applyScheduledMemberFailure(s,a,p,now);
  if(!a.ok){enterCollapseMode(s,'post-fracture-instability',s.last?.ok?s.last:null,p,now);draw();requestAnimationFrame(tick);return}

  // Capacity failure removes the member, then the remaining structure is re-evaluated.
  let breakPass=0;
  while(memberFailureEnabled() && a.ok && a.worst && a.maxRatio>1.02 && breakPass<10){
    const brokenForce=a.forces.get(a.worst.id)?.force||0;
    s.maxRatio=Math.max(s.maxRatio,a.maxRatio);s.worst=a.worst;s.worstForce=brokenForce;
    s.broken.add(a.worst.id);s.brokenCount=s.broken.size;lastBroken=new Set(s.broken);
    const worstInfo=a.forces.get(a.worst.id);
    s.failureEvents=s.failureEvents||[];s.failureEvents.push({id:a.worst.id,mat:a.worst.mat,force:worstInfo?.force||0,governing:worstInfo?.governing||'material',ratio:worstInfo?.ratio||a.maxRatio,length:worstInfo?.length,capacity:worstInfo?.capacity,eulerLimit:worstInfo?.eulerLimit,materialCompression:worstInfo?.materialCompression});
    setCoach('memberFailure',{analysis:a,event:s.failureEvents.at(-1),member:a.worst});s.coachHoldUntil=now+1200;
    const failLabel=worstInfo?.force<0&&worstInfo?.governing==='buckling'?'EULER 좌굴':'부재 파단';
    toast(`${MAT[a.worst.mat].name} ${failLabel} // 남은 하중 경로 재해석`);kickShake(5.5,180);playSfx('break');
    const prior=a;
    a=assemble(x,s.broken);breakPass++;
    if(!a.ok){enterCollapseMode(s,'post-fracture-instability',prior,p,now);draw();requestAnimationFrame(tick);return}
  }

  s.last=a;lastFullAnalysis=a;
  if(a.maxRatio>s.maxRatio){s.maxRatio=a.maxRatio;s.worst=a.worst;s.worstForce=a.worst?a.forces.get(a.worst.id).force:0}
  s.maxDefl=Math.max(s.maxDefl,a.maxDefl);
  s.maxDeckDefl=Math.max(s.maxDeckDefl||0,a.deckDeflection||0);s.maxDeckCurvature=Math.max(s.maxDeckCurvature||0,a.deckCurvature||0);
  s.serviceabilityFailed=!stage.sandbox&&s.maxDefl>stage.maxDefl;

  if(stage.ship){
    const vc=evaluateVesselSweptClearance(s.shipProgress,a,null);
    s.vesselClearance=vc.clearance;s.minVesselClearance=Math.min(s.minVesselClearance,vc.clearance);
    if(vc.collision){
      s.vesselCollision=true;s.vesselPass=false;s.failReason='vessel-collision';
      currentAnalysis={ok:true,maxRatio:s.maxRatio,maxDefl:s.maxDefl,deckDeflection:s.maxDeckDefl||0,deckCurvature:s.maxDeckCurvature||0,brokenCount:s.brokenCount,serviceabilityFailed:s.serviceabilityFailed};
      updateTestTelemetry();draw();finishSimulation(false);return;
    }
    if(s.shipProgress>=.999)s.vesselPass=true;
  }

  // Serviceability and collapse are deliberately separate limits. Exceeding
  // stage.maxDefl is recorded for the final verdict but the static test keeps
  // running so students can observe the deformed structure. Only the larger
  // collapseDeflLimit hands the simulation over to Dynamic Physics.
  const collapseDeflLimit=getCollapseDeflLimit(stage);
  if(!stage.sandbox && a.maxDefl>collapseDeflLimit){enterCollapseMode(s,'excessive-deflection',a,p,now);draw();requestAnimationFrame(tick);return}

  currentAnalysis={ok:true,maxRatio:s.maxRatio,maxDefl:s.maxDefl,deckDeflection:s.maxDeckDefl||0,deckCurvature:s.maxDeckCurvature||0,brokenCount:s.brokenCount,serviceabilityFailed:s.serviceabilityFailed};
  
  if(now>=(s.coachHoldUntil||0)&&now-(s.coachLastUpdate||0)>900){
    const liveIssue=coachAnalyzeStructure(a,{simState:s,source:'실시간 해석',deepCheck:false});
    ui.coach.innerHTML=coachReportHTML(liveIssue,coachSecondarySummary(a,liveIssue),'실시간 해석');s.coachLastUpdate=now;
  }
  updateTestTelemetry();draw();
  if(raw>=1){lastBroken=new Set(s.broken);s.vehiclePass=true;finishSimulation(true);return}
  requestAnimationFrame(tick);
}
function finishSimulation(vehicleSuccess){
  const s=sim;if(!s)return;
  s.vehiclePass=!!vehicleSuccess;
  const vesselRequired=!!stage.ship,vesselPass=!vesselRequired||!!s.vesselPass;
  const serviceFail=!stage.sandbox&&s.mode!=='collapse'&&(s.maxDefl||0)>stage.maxDefl;
  s.serviceabilityFailed=serviceFail;
  if(s.vesselCollision)s.failReason='vessel-collision';
  else if(serviceFail&&vehicleSuccess&&vesselPass)s.failReason='serviceability';
  const clearSuccess=!!vehicleSuccess&&vesselPass&&!serviceFail&&!s.vesselCollision;
  const analysisValid=s.mode!=='collapse'&&!!s.last?.ok;
  currentAnalysis={ok:analysisValid,maxRatio:s.maxRatio||0,maxDefl:s.maxDefl||0,brokenCount:s.brokenCount||0,serviceabilityFailed:serviceFail};
  ui.test.textContent='▶ 시험';ui.test.classList.remove('stop');
  const telemetryPanel=$('#testTelemetry');if(telemetryPanel)telemetryPanel.hidden=true;const dangerFrame=$('#testDangerFrame');if(dangerFrame)dangerFrame.style.opacity='0';
  if(tutorialTestRunning){
    // Tutorial completion remains tied to the vehicle test so the guided flow is
    // not changed by the new normal-stage serviceability verdict.
    const wasSuccess=!!vehicleSuccess;
    tutorialTestRunning=false;
    sim=null;draw();
    if(wasSuccess){toast('훈련 시험 통과 // 차량 통과 확인');setTimeout(()=>finishTutorialStage(false),500)}
    else {tutorialTransitioning=false;const panel=$('#stageTutorial');if(panel){panel.hidden=false;panel.style.display='';}const badge=$('#tutorialStageBadge');if(badge)badge.style.opacity='1';toast('훈련 시험 실패 // 구조를 확인하세요');renderStageTutorialStep()}
    return;
  }
  if(s.vesselCollision){
    stressMode=true;if(s.last?.ok)lastFullAnalysis=s.last;
    setCoach('vesselCollision',{sim:s,analysis:s.last||lastFullAnalysis});
    toast('선박 충돌 // 시험 실패');showResult(false,s);
  }else if(serviceFail&&vehicleSuccess&&vesselPass){
    stressMode=true;if(s.last?.ok)lastFullAnalysis=s.last;
    setCoach('serviceability',{sim:s,analysis:s.last||lastFullAnalysis});
    toast('사용성 기준 실패 // 허용 변형 초과');showResult(false,s);
  }else if(clearSuccess){setCoach('success',{...s,analysis:s.last||lastFullAnalysis});showResult(true,s)}
  else if(s.failReason==='collapse'){
    setCoach('collapse',{sim:s,analysis:s.preCollapseAnalysis});
    showResult(false,s);
  }else setCoach('unstable');
  sim=null;draw();
}
/* ===== TRUSS EDUCATION CENTER LOGIC ===== */
let loadingSequenceToken=0;
let pendingEducationContext=null;
function clearedStageCount(){return Math.max(sessionClearedStages.size,playerProgress.completedLevels.length)}
function educationUnlocked(){return clearedStageCount()>0||localStorage.getItem('trusslab-education-complete')==='1'}
function updateEducationAccess(){const unlocked=educationUnlocked(),t=$('#titleEduBtn'),g=$('#eduTopBtn');if(t){t.hidden=!unlocked;t.textContent=localStorage.getItem('trusslab-education-complete')==='1'?'구조 학습 · 완료':'트러스 구조 배우기'}if(g)g.hidden=!unlocked}
function prepareLoadingTruss(){
  const loading=$('#loadingScreen');
  if(!loading)return [];
  const members=[...loading.querySelectorAll('.trussLoader .assembly-member')];
  members.forEach((m,i)=>{
    m.style.opacity='.06';
    m.removeAttribute('transform');
    if(!m.dataset.finalX1){
      m.dataset.finalX1=m.getAttribute('x1');m.dataset.finalY1=m.getAttribute('y1');m.dataset.finalX2=m.getAttribute('x2');m.dataset.finalY2=m.getAttribute('y2');
    }
    m.setAttribute('x1',m.dataset.finalX1);m.setAttribute('y1',m.dataset.finalY1);m.setAttribute('x2',m.dataset.finalX2);m.setAttribute('y2',m.dataset.finalY2);
    m.dataset.x1=m.dataset.finalX1;m.dataset.y1=m.dataset.finalY1;m.dataset.x2=m.dataset.finalX2;m.dataset.y2=m.dataset.finalY2;
  });
  loading.querySelectorAll('.support-part').forEach((s,i)=>{s.style.opacity='.08';s.setAttribute('transform',`translate(${i===0?-18:18} 28)`)});
  loading.querySelectorAll('.truss-node').forEach(n=>{n.style.opacity='.06';n.setAttribute('r','4')});
  loading.querySelectorAll('.loader-node-ring').forEach(r=>{r.style.opacity='0';r.setAttribute('r','9')});
  return members;
}
function easeOutBack(t){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)}
function easeOutCubic(t){return 1-Math.pow(1-t,3)}
function animateLoadingTruss(members,q){
  const loading=$('#loadingScreen');
  if(!loading||!members?.length)return;
  const supports=[...loading.querySelectorAll('.support-part')];
  const decks=[...loading.querySelectorAll('[data-kind="deck"]')];
  const webs=[...loading.querySelectorAll('[data-kind="web"]')];
  const tops=[...loading.querySelectorAll('[data-kind="top"]')];
  const nodes=[...loading.querySelectorAll('.truss-node')];
  let built=0;

  // 1) Supports seat into their bearings from opposite directions.
  supports.forEach((s,i)=>{
    const t=clamp((q-.01-i*.018)/.12,0,1),e=easeOutBack(t);
    const dx=(i===0?-18:18)*(1-e),dy=28*(1-e);
    s.setAttribute('transform',`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    s.style.opacity=String(.08+.92*t);
  });

  // 2) Deck modules drop into place CENTER-OUT, not left-to-right.
  const deckOrder=[3,4,2,5,1,6,0,7];
  deckOrder.forEach((idx,rank)=>{
    const m=decks[idx]; if(!m)return;
    const t=clamp((q-(.10+rank*.018))/.18,0,1),e=easeOutBack(t);
    const side=idx<4?-1:1;
    const dx=side*(14+Math.abs(3.5-idx)*3)*(1-e),dy=(-38-rank%2*8)*(1-e);
    m.setAttribute('transform',`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    m.style.opacity=String(.06+.94*t);
    if(t>.98)built++;
  });

  // 3) Web members hinge upward from the deck in SYMMETRIC PAIRS.
  const webPairs=[[3,4],[2,5],[1,6],[0,7]];
  webPairs.forEach((pair,rank)=>pair.forEach((idx,side)=>{
    const m=webs[idx]; if(!m)return;
    const t=clamp((q-(.30+rank*.055))/.18,0,1),e=easeOutCubic(t);
    const x1=Number(m.dataset.x1),y1=Number(m.dataset.y1),x2=Number(m.dataset.x2),y2=Number(m.dataset.y2);
    m.setAttribute('x2',String(x1+(x2-x1)*e));
    m.setAttribute('y2',String(y1+(y2-y1)*e));
    m.style.opacity=String(.05+.95*t);
    if(t>.98)built++;
  }));

  // 4) Top chord modules lock in from OUTSIDE-IN, with a small mechanical settle.
  const topOrder=[0,2,1];
  topOrder.forEach((idx,rank)=>{
    const m=tops[idx]; if(!m)return;
    const t=clamp((q-(.60+rank*.045))/.16,0,1),e=easeOutBack(t);
    const dir=idx===0?-1:idx===2?1:0;
    const dx=dir*28*(1-e),dy=-24*(1-e);
    m.setAttribute('transform',`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    m.style.opacity=String(.05+.95*t);
    if(t>.98)built++;
  });

  // 5) Nodes lock in by structural priority rather than geometric order.
  const nodeOrder=[4,10,11,3,5,2,6,9,12,1,7,0,8];
  let shown=0;
  nodeOrder.forEach((idx,rank)=>{
    const n=nodes[idx]; if(!n)return;
    const t=clamp((q-(.67+rank*.014))/.10,0,1);
    const pop=Math.sin(Math.PI*t);
    n.style.opacity=String(.06+.94*t);
    n.setAttribute('r',String(4+pop*1.7));
    if(t>.86)shown++;
  });

  // Fastener pulses happen at selected joints in a non-directional pattern.
  const rings=[...loading.querySelectorAll('.loader-node-ring')];
  const ringTimes=[.73,.77,.80,.84,.87];
  rings.forEach((r,i)=>{
    const t=clamp((q-ringTimes[i])/.12,0,1);
    r.style.opacity=String(t>0?(1-t)*.72:0);
    r.setAttribute('r',String(8+t*16));
  });

  const elem=$('#loaderElem'),nodeCount=$('#loaderNodeCount'),solver=$('#loaderSolver'),phase=$('#loaderPhaseText'),solverText=$('#loaderSolverText');
  const total=decks.length+webs.length+tops.length;
  if(elem)elem.textContent=`${String(Math.min(total,built)).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
  if(nodeCount)nodeCount.textContent=`${String(Math.min(nodes.length,shown)).padStart(2,'0')} / ${String(nodes.length).padStart(2,'0')}`;
  if(solver)solver.textContent=q<.13?'SEATING':q<.31?'DECKING':q<.60?'HINGING':q<.78?'LOCKING':q<.94?'TORQUE':'READY';
  if(phase)phase.textContent=q<.13?'FOUNDATION // SUPPORT SEATS':q<.31?'DECK // MODULE DROP-IN':q<.60?'WEB // SYMMETRIC HINGE-UP':q<.78?'TOP CHORD // LOCK-IN':q<.94?'JOINTS // FASTENER CHECK':'MODEL // ASSEMBLY VERIFIED';
  if(solverText){
    const locks=Math.min(13,Math.floor(clamp((q-.67)/.27,0,1)*13));
    solverText.textContent=q<.67?'FASTENER BANK // --':`FASTENER BANK // ${String(locks).padStart(2,'0')} / 13`;
  }
  loading.classList.toggle('loading-complete',q>.96);
}
function restartLoadingRail(){
  const loading=$('#loadingScreen'),rail=$('#loadingScreen .loadingRail i');
  loading?.classList.remove('loading-complete');
  if(rail){rail.style.animation='none';rail.style.width='0%';}
  if($('#loaderElem'))$('#loaderElem').textContent='00 / 19';
  if($('#loaderNodeCount'))$('#loaderNodeCount').textContent='00 / 13';
  if($('#loaderSolver'))$('#loaderSolver').textContent='IDLE';
  if($('#loaderPhaseText'))$('#loaderPhaseText').textContent='ASSEMBLY // WAITING';
  if($('#loaderSolverText'))$('#loaderSolverText').textContent='FASTENER BANK // --';
  return prepareLoadingTruss();
}
function runLoadingSequence({title='INITIALIZING STRUCTURAL MODEL',statuses=['[01] SUPPORT SEATS','[02] DECK MODULES','[03] WEB PANELS','[04] JOINT FASTENERS','[05] ASSEMBLY VERIFIED'],duration=1200,hint='PLEASE STAND BY'}={},done=()=>{}){
  const loading=$('#loadingScreen');
  if(!loading){done();return;}
  const token=++loadingSequenceToken,pct=$('#loadingPercent'),status=$('#loadingStatus'),titleEl=$('#loadingTitle'),standby=$('#loadingStandby'),rail=$('#loadingScreen .loadingRail i');
  if(titleEl)titleEl.textContent=title;
  if(standby)standby.textContent=hint;
  if(pct)pct.textContent='00%';
  if(status)status.textContent=statuses[0]||'LOADING';
  loading.removeAttribute('hidden');
  loading.style.display='grid';
  loading.setAttribute('aria-busy','true');
  const lines=restartLoadingRail();
  // Wait one painted frame with the loading screen visible before starting.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(token!==loadingSequenceToken)return;
    const t0=performance.now();
    function frame(now){
      if(token!==loadingSequenceToken)return;
      const q=clamp((now-t0)/Math.max(650,duration),0,1);
      if(pct)pct.textContent=String(Math.min(100,Math.floor(q*100))).padStart(2,'0')+'%';
      if(status)status.textContent=statuses[Math.min(statuses.length-1,Math.floor(q*statuses.length))]||statuses.at(-1);
      if(rail)rail.style.width=(q*100).toFixed(1)+'%';
      animateLoadingTruss(lines,q);
      if(q<1){requestAnimationFrame(frame);return;}
      // Leave the fully assembled truss on-screen briefly so completion is legible.
      setTimeout(()=>{
        if(token!==loadingSequenceToken)return;
        loading.setAttribute('hidden','');
        loading.removeAttribute('aria-busy');
        loading.style.display='';
        done();
      },260);
    }
    requestAnimationFrame(frame);
  }));
}
function openEducationCenter(startModule=0,contextKey=null,forceAccess=false){
  if(!forceAccess&&!educationUnlocked()){toast('스테이지를 하나 이상 클리어하면 교육 센터가 열립니다');return}
  educationReturnScreen=(currentGameScreen===GAME_SCREEN.RESULT||contextKey)?GAME_SCREEN.GAME:currentGameScreen;
  if(!Object.values(GAME_SCREEN).includes(educationReturnScreen))educationReturnScreen=GAME_SCREEN.MAIN_MENU;
  pendingEducationContext=contextKey||null;ui.result?.classList.remove('show');currentGameScreen=GAME_SCREEN.EDUCATION;document.body.dataset.gameScreen=GAME_SCREEN.EDUCATION;hideFlowScreens();$('#titleScreen').hidden=true;$('#endingScreen').hidden=true;$('#educationScreen').hidden=true;if($('#app'))$('#app').style.visibility='hidden';
  runLoadingSequence({title:'트러스 구조 학습실을 여는 중',statuses:['[01] 학습 순서 준비','[02] 실패 원인 확인','[03] 관련 원리 찾기','[04] 움직이는 그림 준비','[05] 학습 준비 완료'],duration:1450,hint:contextKey?'실패 원인 확인 → 이해 → 다시 설계':'학습 자료를 준비하고 있습니다'},()=>{$('#educationScreen').hidden=false;renderEducationModule(startModule)})
}
function leaveEducationToLab(){
  $('#educationScreen').hidden=true;$('#endingScreen').hidden=true;const hadContext=!!pendingEducationContext;pendingEducationContext=null;const target=hadContext?GAME_SCREEN.GAME:(educationReturnScreen||GAME_SCREEN.MAIN_MENU);
  runLoadingSequence({title:target===GAME_SCREEN.GAME?'다리 설계 화면으로 돌아가는 중':'메인 화면으로 돌아가는 중',statuses:['[01] 현재 설계 저장','[02] 화면 복원','[03] 조작 준비','[04] 진행 상황 확인','[05] 준비 완료'],duration:900,hint:hadContext?'수정한 뒤 다시 시험해 보세요':'이전 화면을 복원하고 있습니다'},()=>{changeGameScreen(target,{resumeClock:target===GAME_SCREEN.GAME});if(target===GAME_SCREEN.GAME){resetCamera?.();resize();toast(hadContext?'DESIGN RESTORED // 수정 후 다시 TEST하세요':'STRUCTURAL LAB READY')}})
}
function completeEducationCourse(){localStorage.setItem('trusslab-education-complete','1');updateEducationAccess();$('#educationScreen').hidden=true;runLoadingSequence({title:'학습을 마무리하는 중',statuses:['[01] 퀴즈 결과 확인','[02] 학습 기록 저장','[03] 핵심 내용 확인','[04] 완료 기록 만들기','[05] 학습 완료'],duration:1750,hint:'잘하셨습니다. 마지막 화면을 준비하고 있습니다'},()=>{const e=$('#endingScreen');e.hidden=false;$('#endingStageCount').textContent=String(Math.max(1,clearedStageCount()))})}


function animateResultCounters(){
  const els=[...ui.resultCard.querySelectorAll('[data-count]')];if(!els.length)return;
  const start=performance.now(),dur=620;els.forEach(e=>e.classList.add('counting'));
  const frame=now=>{const t=clamp((now-start)/dur,0,1),eased=1-Math.pow(1-t,3);els.forEach(el=>{const v=Number(el.dataset.count)||0;el.textContent=String(Math.round(v*eased))});if(t<1)requestAnimationFrame(frame);else els.forEach(e=>e.classList.remove('counting'))};requestAnimationFrame(frame)
}

function roadPathConnected(){
  const left=leftSupportId(),right=rightSupportId(),adj=new Map();
  const add=(a,b)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b)};
  members.filter(m=>m.road).forEach(m=>{add(m.a,m.b);add(m.b,m.a)});
  const seen=new Set([left]),q=[left];while(q.length){const u=q.shift();if(u===right)return true;for(const v of adj.get(u)||[]){if(!seen.has(v)){seen.add(v);q.push(v)}}}return false;
}
function failureLearningMap(key){return {
  'excess-deflection':{label:'다리가 너무 많이 휨',module:4,moduleName:'아치와 보'},
  'tension-failure':{label:'인장 한계 초과',module:5,moduleName:'고장에 강한 구조와 재료'},
  'compression-failure':{label:'압축 한계 초과',module:1,moduleName:'삼각형과 트러스'},
  'buckling':{label:'긴 압축 부재의 좌굴',module:1,moduleName:'삼각형과 트러스'},
  'missing-load-path':{label:'힘이 이어지는 길 없음',module:0,moduleName:'하중이 가는 길'},
  'road-disconnected':{label:'도로가 끊김',module:0,moduleName:'하중이 가는 길'},
  'insufficient-redundancy':{label:'다른 힘의 길이 부족함',module:5,moduleName:'고장에 강한 구조와 재료'},
  'navigation-collision':{label:'배 통과 공간 침범',module:0,moduleName:'하중이 가는 길'},
  'budget-overrun':{label:'예산 초과',module:5,moduleName:'고장에 강한 구조와 재료'},
  'cable-misuse':{label:'케이블 사용 방향 문제',module:3,moduleName:'사장교'}
}[key]||{label:key,module:0,moduleName:'하중이 가는 길'}}
function classifyFailureCauses(s,success=false){
  if(success||stage.sandbox)return [];
  const keys=[];const add=k=>{if(k&&!keys.includes(k))keys.push(k)};
  if(s.failReason==='serviceability'||s.collapseReason==='excessive-deflection'||(s.maxDefl||0)>stage.maxDefl)add('excess-deflection');
  if(s.failReason==='vessel-collision'||s.vesselCollision)add('navigation-collision');
  if(s.failReason==='budget-overrun'||totalCost>stage.budget)add('budget-overrun');
  if(s.failReason==='road-disconnected'||s.failureHint==='road-disconnected'||!roadPathConnected())add('road-disconnected');
  const events=s.failureEvents||[];
  for(const ev of events){
    if(ev.mat==='cable'&&ev.force<0)add('cable-misuse');
    if(ev.force<0&&ev.governing==='buckling')add('buckling');
    else if(ev.force<0)add('compression-failure');
    else if(ev.force>0)add('tension-failure');
  }
  if(s.collapseReason==='post-fracture-instability'||((s.brokenCount||0)>0&&s.mode==='collapse'))add('insufficient-redundancy');
  if((s.collapseReason==='unstable'||s.collapseReason==='solver-instability'||s.failureHint==='missing-load-path')&&!keys.includes('road-disconnected'))add('missing-load-path');
  if(!keys.length&&s.mode==='collapse')add('missing-load-path');
  return keys.map(k=>({key:k,...failureLearningMap(k)}));
}
function failureLearningHTML(causes){if(!causes.length)return '';return `<div class="failureLearnPanel"><div class="failureLearnTitle">FAILURE DIAGNOSIS // LEARN WHY</div>${causes.map((c,i)=>`<div class="failureCauseRow"><div class="failureCauseName">${c.label.toUpperCase()}</div><div class="failureCauseDetail">RELATED MODULE // ${c.moduleName}</div><button class="learnWhyBtn" data-learn-cause="${c.key}" data-learn-module="${c.module}">LEARN WHY →</button></div>`).join('')}</div>`}

function recommendedEducationModuleForLevel(level){
  if(!level)return 0;
  if(level.conditionCodes?.includes('CABLE')||level.setId==='set05')return 3;
  if(level.conditionCodes?.includes('BUCKLING'))return 1;
  if(level.conditionCodes?.includes('MEMBER_FAILURE')||level.conditionCodes?.includes('REDUNDANCY'))return 5;
  if(level.conditionCodes?.includes('NAVIGATION_CLEARANCE'))return 0;
  if(level.conditionCodes?.includes('HEAVY_TRUCK')||level.conditionCodes?.includes('REINFORCED_DECK'))return 4;
  return level.setId==='set01'?1:0;
}
function resultProgramNotice(level,success){
  if(!success||!level)return '';
  if(fullProgramComplete())return `<div class="programCompletion full"><b>FULL PROGRAM COMPLETE</b><strong>48 / 48 CONTRACTS · 108 / 108 STARS · 12 / 12 ENGINEERING BADGES</strong><span>ALL ENGINEERING CHALLENGES COMPLETE</span></div>`;
  if(level.type==='bonus'){
    const b=setBonusCompletion(level.setId);
    return `<div class="programCompletion bonus"><b>ENGINEERING BADGE EARNED</b><strong>${level.badge||'BONUS CONTRACT COMPLETE'}</strong><span>SET BONUS ${b.done} / ${b.total} · Campaign progression does not require bonus completion.</span></div>`;
  }
  if(level.globalNumber===36){
    const bonusDone=allBonusLevels().filter(l=>levelProgressFor(l.id).completed).length;
    return `<div class="programCompletion"><b>MAIN CAMPAIGN COMPLETE</b><strong>STRUCTURAL ENGINEERING PROGRAM // 36 MAIN CONTRACTS COMPLETE</strong><span>BONUS CONTRACTS ${bonusDone} / 12 · STARS ${playerProgress.totalStars} / 108</span></div>`;
  }
  if(level.levelNumber===6){
    const set=getGameSet(level.setId),m=setMainCompletion(level.setId),campaign=campaignStats(level.campaignId);
    return `<div class="programCompletion"><b>SET ${String(set?.number||1).padStart(2,'0')} COMPLETE</b><strong>${set?.title||''}</strong><span>MAIN ${m.done}/${m.total} · STARS ${m.stars}/${m.maxStars}${campaign.mainDone===campaign.mainTotal?' · CAMPAIGN COMPLETE':''}</span></div>`;
  }
  const newlyAvailable=bonusLevelsForSet(level.setId).filter(b=>isLevelUnlocked(b.id)&&!levelProgressFor(b.id).completed&&((b.unlockRequirement===level.id)||(b.unlockRequirement?.complete===level.id)));
  if(newlyAvailable.length)return `<div class="programCompletion bonus"><b>BONUS CONTRACT UNLOCKED</b><strong>${newlyAvailable.map(b=>`B${String(b.bonusNumber).padStart(2,'0')} // ${b.title}`).join(' · ')}</strong><span>Optional engineering experiment — not required for Main Campaign progression.</span></div>`;
  return '';
}

function showResult(success,s){
  setGamePhase(GAME_PHASE.RESULT);
  const level=currentCampaignLevel();
  const failureCauses=classifyFailureCauses(s,success);
  const failureLearn=failureLearningHTML(failureCauses);
  const serviceFail=!stage.sandbox&&s.failReason==='serviceability';
  const vesselCollision=!stage.sandbox&&s.failReason==='vessel-collision';
  const vehiclePass=!!s.vehiclePass,vesselPass=!stage.ship||!!s.vesselPass;
  const collapseLimit=getCollapseDeflLimit(stage);
  const collapsed=!success&&(s.failReason==='collapse'||s.mode==='collapse');
  const strengthPass=!collapsed&&(s.brokenCount||0)===0&&(s.maxRatio||0)<=1.02;
  const servicePass=!collapsed&&!serviceFail&&(s.maxDefl||0)<=stage.maxDefl;
  const stageTimeMs=stage.sandbox?null:(success?finalizeStageClock():pauseStageClock(true));
  const previousCampaignBest=level?levelProgressFor(level.id).bestTimeMs:null;

  const efficiency=clamp(Math.round(55+45*(1-totalCost/stage.budget)),0,100);
  const safety=collapsed?0:clamp(Math.round(100-(s.maxRatio||0)*45),0,100);
  const stiffness=collapsed?0:clamp(Math.round(100-(s.maxDefl||0)/stage.maxDefl*55),0,100);
  const tri=Math.min(100,triangleCount()*12+35);
  const score=Math.round(safety*.4+efficiency*.25+stiffness*.2+tri*.15);
  const scoreStarCount=score>=88?3:score>=72?2:1;
  const achievements=resultAchievements(success,s);
  const gradeScore=score+(achievements.earned*3);
  const grade=gradeScore>=96?'S':gradeScore>=86?'A':gradeScore>=72?'B':'C';

  if(level&&!stage.sandbox)recordCampaignResult(success,s,score,scoreStarCount,stageTimeMs);
  const progressAfter=level?levelProgressFor(level.id):null;
  const campaignStarCount=level?.type==='main'?(progressAfter?.stars||0):scoreStarCount;
  const stars=campaignStarCount>=3?'★★★':campaignStarCount===2?'★★☆':campaignStarCount===1?'★☆☆':'☆☆☆';

  let bestTimeMs=null,newBest=false;
  if(success&&!stage.sandbox){
    if(level){
      bestTimeMs=progressAfter?.bestTimeMs??stageTimeMs;
      newBest=previousCampaignBest==null||stageTimeMs<previousCampaignBest;
    }else if(stageIndex<4){
      const timeKey=`trusslab-best-time-${difficultyMode}-legacy-${stageIndex}`;
      const prev=Number(localStorage.getItem(timeKey)||0);
      if(!prev||stageTimeMs<prev){bestTimeMs=stageTimeMs;newBest=!!prev;localStorage.setItem(timeKey,String(Math.round(stageTimeMs)))}else bestTimeMs=prev;
    }
  }

  const stageClear=success&&!stage.sandbox;
  if(stageClear&&!level&&stageIndex<4)sessionClearedStages.add(stageIndex);
  if(stageClear){updateEducationAccess();updateStageButtons()}

  const eduButton=stageClear?'<button class="primaryBtn resultActionBtn" id="goEducationBtn">학습 센터</button>':'';
  const recommendedButton=stageClear&&level?'<button class="iconBtn resultActionBtn" id="recommendedLearningBtn">관련 학습</button>':'';
  const programButton=stageClear&&level&&(level.globalNumber===36||fullProgramComplete())?'<button class="primaryBtn resultActionBtn" id="programSummaryBtn">과정 요약</button>':'';
  const nextLevel=success?nextCampaignLevel(level):null;
  const continueButton=!stage.sandbox?`${nextLevel&&isLevelUnlocked(nextLevel.id)?'<button class="primaryBtn resultActionBtn" id="nextStage">다음 계약</button>':''}<button class="primaryBtn resultActionBtn" id="returnDesignBtn">설계로 돌아가기</button><button class="iconBtn resultActionBtn" id="retryLevelBtn" title="레벨 처음부터 다시 설계">처음부터 다시</button><button class="iconBtn resultActionBtn" id="resultLevelSelectBtn" title="레벨 선택">계약 지도</button>`:'<button class="primaryBtn" id="retryStage">설계 계속하기</button>';
  const contractLabel=level?(level.type==='bonus'?`보너스 ${displayContractId(level)}`:`계약 ${displayContractId(level)}`):`스테이지 ${String(stageIndex+1).padStart(2,'0')}`;
  const timePanel=success&&!stage.sandbox?`<div class="clearTimePanel"><div><span class="clearTimeLabel">클리어 시간 // ${contractLabel}</span><strong class="clearTimeValue">${formatStageTime(stageTimeMs)}</strong><span class="clearTimeTag">${newBest?'개인 최고 기록 // ':''}${difficultyMode==='easy'?'쉬움':'어려움'} 난이도</span></div><div><span class="clearTimeLabel">최고 기록</span><strong class="clearTimeBest">${formatStageTime(bestTimeMs)}</strong><span class="clearTimeTag">브라우저에 저장됨</span></div></div>`:'';
  const verdict=!stage.sandbox?`<div class="structuralVerdict${stage.ship?' withVessel':''}"><div class="verdictCell"><span>강도</span><b class="${strengthPass?'':'fail'}">${strengthPass?'통과':'실패'}</b></div><div class="verdictCell"><span>사용성</span><b class="${servicePass?'':'warn'}">${servicePass?'통과':'실패'}</b></div><div class="verdictCell"><span>차량 통과</span><b class="${vehiclePass?'':'fail'}">${vehiclePass?'예':'아니요'}</b></div>${stage.ship?`<div class="verdictCell"><span>선박 통과</span><b class="${vesselPass?'':'fail'}">${vesselPass?'예':'아니요'}</b></div>`:''}</div>`:'';
  const serviceNotice=serviceFail?`<div class="serviceabilityNotice"><strong>사용성 기준 실패 //</strong> 차량은 통과했지만 최대 변형 ${(s.maxDefl||0).toFixed(1)}이 사용성 한계 ${stage.maxDefl.toFixed(1)}을 초과했습니다. 동적 붕괴 한계 ${collapseLimit.toFixed(1)}에는 도달하지 않았으므로 구조를 유지해 변형 상태를 관찰할 수 있습니다.</div>`:'';
  const vesselNotice=vesselCollision?`<div class="serviceabilityNotice"><strong>선박 충돌 // 시험 실패 //</strong> 변형된 교량이 항로의 swept clearance geometry와 충돌했습니다. 최소 통항 여유는 <strong>${Number.isFinite(s.minVesselClearance)?Math.max(0,s.minVesselClearance).toFixed(1):'0.0'} u</strong>였습니다.</div>`:'';

  let title,summary;
  if(stage.sandbox){title=success?'실험 완료':'동적 붕괴';summary='샌드박스 실험이 끝났습니다. 응력 색과 변형을 비교한 뒤 하중이나 구조를 바꿔 다시 시험해 보세요.'}
  else if(vesselCollision){title='선박 충돌';summary='TEST FAILED // 최소 폭·높이와 선박 이동 범위를 포함한 navigation clearance envelope를 끝까지 확보해야 합니다.'}
  else if(serviceFail){title='사용성 기준 실패';summary='차량은 끝까지 통과했지만 허용 변형 기준을 만족하지 못했습니다. 결과창을 닫으면 변형된 구조를 그대로 관찰할 수 있습니다.'}
  else if(level?.type==='bonus'){title=success?'보너스 계약 완료':'실험 실패';summary=success?`선택 실험을 완료했습니다. <strong style="color:#e3c45b">${koBadgeLabel(level.badge||'ENGINEERING BADGE')}</strong>가 Engineering Record에 기록되었습니다.`:'보너스 실험 실패는 메인 캠페인 진행도에 영향을 주지 않습니다. 원인을 분석하고 같은 실험을 다시 시도할 수 있습니다.'}
  else if(success){title=level?'계약 완료':'미션 성공';summary=`${stage.ship?'차량과 선박이 모두 끝까지 통과했습니다.':'차량이 끝까지 통과했습니다.'} ${s.brokenCount?`중간에 <strong style="color:#fff">${s.brokenCount}개 부재</strong>가 끊어졌지만 남은 구조가 하중을 전달했습니다. `:''}${level?`<strong style="color:#fff">${stars}</strong>`:''}`}
  else {title='교량 시험 실패';summary='중력 기반 동적 시뮬레이션에서 교량이 안정성을 잃어 차량이 정상적으로 통과하지 못했습니다. 실패 진단과 구조 코치를 사용해 원인을 확인하세요.'}

  const programNotice=resultProgramNotice(level,success);
  const vesselStats=stage.ship?` · VESSEL MIN CLEARANCE <strong style="color:${vesselCollision?'#ef7c8c':'#e3c45b'}">${Number.isFinite(s.minVesselClearance)?Math.max(0,s.minVesselClearance).toFixed(1):'—'} u</strong>`:'';
  const kicker=level?(level.type==='bonus'?'보너스 실험':'캠페인 계약'):'구조 시험';
  const rewardLine=success&&!stage.sandbox&&level?.type==='main'?`<div class="campaignReward"><span>메인 별</span><b>${stars} // ${campaignStarCount}/3</b></div>`:'';
  ui.resultCard.classList.toggle('resultSuccess',!!success);ui.resultCard.classList.toggle('resultFailure',!success);
  ui.resultCard.innerHTML=`<button class="iconBtn resultCloseBtn" id="closeResult" title="결과 닫기">×</button><div class="resultKicker">${kicker} // ${success?'완료':'검토 필요'}</div><h1>${title}</h1>${success&&!stage.sandbox?`<div class="engineeringGrade"><span>설계 평가 // 추가 목표 ${achievements.earned}/3</span><strong class="${grade==='B'?'gradeB':grade==='C'?'gradeC':''}">${grade}</strong></div>`:''}${rewardLine}<div class="sub resultSummary">${summary}</div>${programNotice}${vesselNotice}${serviceNotice}${verdict}${failureLearn}${timePanel}${success&&!stage.sandbox?achievements.html:''}<div class="resultGrid"><div class="scoreBox"><b data-count="${safety}">0</b><span>안전성</span></div><div class="scoreBox"><b data-count="${efficiency}">0</b><span>효율</span></div><div class="scoreBox"><b data-count="${stiffness}">0</b><span>강성</span></div><div class="scoreBox"><b data-count="${triangleCount()}">0</b><span>삼각형</span></div></div><div class="sub resultSolverSummary">최대 이용률 <strong>${Math.round((s.maxRatio||0)*100)}%</strong> · 최대 변형 <strong>${(s.maxDefl||0).toFixed(1)} u</strong> · 바닥판 <strong>${(s.maxDeckDefl||0).toFixed(1)} u</strong> · 곡률 <strong>${(s.maxDeckCurvature||0).toFixed(2)}°/100u</strong> · 사용성 한계 <strong>${stage.maxDefl.toFixed(1)} u</strong> · 붕괴 한계 <strong>${collapseLimit.toFixed(1)} u</strong>${vesselStats} · 파단 수 <strong>${s.brokenCount||0}</strong> · 비용 <strong>₩${totalCost.toLocaleString()}</strong></div><div class="bigActions resultActions">${eduButton}${recommendedButton}${programButton}${continueButton}</div>`;
  previousGameScreen=GAME_SCREEN.GAME;currentGameScreen=GAME_SCREEN.RESULT;document.body.dataset.gameScreen=GAME_SCREEN.RESULT;ui.result.classList.add('show');animateResultCounters();playSfx(success?'success':'fail');
  const closeResult=()=>{setGamePhase(GAME_PHASE.BUILD);ui.result.classList.remove('show');currentGameScreen=GAME_SCREEN.GAME;document.body.dataset.gameScreen=GAME_SCREEN.GAME;if(!success)resumeClockAfterFailedResult();draw()};
  $('#closeResult').onclick=closeResult;$('#returnDesignBtn')?.addEventListener('click',closeResult);$('#retryStage')?.addEventListener('click',closeResult);
  $('#retryLevelBtn')?.addEventListener('click',()=>{setGamePhase(GAME_PHASE.BUILD);ui.result.classList.remove('show');currentGameScreen=GAME_SCREEN.GAME;document.body.dataset.gameScreen=GAME_SCREEN.GAME;resetStage(stageIndex)});
  $('#resultLevelSelectBtn')?.addEventListener('click',()=>{ui.result.classList.remove('show');openLevelSelect(level?.setId||'set01')});
  $('#nextStage')?.addEventListener('click',()=>{ui.result.classList.remove('show');if(nextLevel)openLevelBriefing(nextLevel.id)});
  $('#goEducationBtn')?.addEventListener('click',()=>openEducationCenter(0));
  $('#recommendedLearningBtn')?.addEventListener('click',()=>openEducationCenter(recommendedEducationModuleForLevel(level),null,true));
  $('#programSummaryBtn')?.addEventListener('click',()=>{ui.result.classList.remove('show');changeGameScreen(GAME_SCREEN.PROGRAM_COMPLETE)});
  $$('.learnWhyBtn').forEach(btn=>btn.addEventListener('click',()=>openEducationCenter(Number(btn.dataset.learnModule),btn.dataset.learnCause,true)));
}

function draw(){
  const r=canvas.getBoundingClientRect();scaleX=r.width/W;scaleY=r.height/H;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.save();ctx.scale(scaleX,scaleY);applyCamera();
  if(screenShake.until>performance.now()){const k=(screenShake.until-performance.now())/180;ctx.translate(Math.sin(anim*2.71)*screenShake.power*k,Math.cos(anim*3.17)*screenShake.power*k)}else screenShake.power=0;
  drawBackground();drawForbidden();drawStageVessel();drawRoadAlignmentGuide();
  const physics=sim?.mode==='collapse'?sim.physics:null;
  const analysis=physics?null:(sim?.last?.ok?sim.last:(((stressMode||loadPathMode)&&lastFullAnalysis?.ok)?lastFullAnalysis:null));
  const deformScale=analysis?2.4:0;
  drawSupports();
  drawTutorialBlueprint();
  if(loadPathMode&&analysis)drawLoadPath(analysis,deformScale);

  for(const m of members){
    if(physics&&m.mat==='cable'){
      const rope=physics.ropeChains?.find(r=>r.id===m.id);
      if(rope){drawCollapseRope(physics,rope);continue}
    }
    const a=nodeById(m.a),b=nodeById(m.b);let pa={x:a.x,y:a.y},pb={x:b.x,y:b.y};
    if(physics){const pA=collapseParticle(physics,a.id),pB=collapseParticle(physics,b.id);if(pA&&pB){pa={x:pA.x,y:pA.y};pb={x:pB.x,y:pB.y}}}
    else if(analysis){const ia=analysis.index.get(a.id),ib=analysis.index.get(b.id);pa={x:a.x+analysis.U[2*ia]*deformScale,y:a.y+analysis.U[2*ia+1]*deformScale};pb={x:b.x+analysis.U[2*ib]*deformScale,y:b.y+analysis.U[2*ib+1]*deformScale};}
    drawMemberVisual(m,pa,pb,analysis);
  }

  nodes.filter(n=>n.visible||n.user).forEach(n=>{
    let p={x:n.x,y:n.y};
    if(physics){const q=collapseParticle(physics,n.id);if(q)p={x:q.x,y:q.y}}
    else if(analysis){const i=analysis.index.get(n.id);p={x:n.x+analysis.U[2*i]*deformScale,y:n.y+analysis.U[2*i+1]*deformScale}}
    drawNodeVisual(n,p);
  });
  drawBuildFx();

  if(!physics){
    drawPlacementGuide();
    if(selected&&!sim){const p={x:selected.x,y:selected.y};ctx.save();ctx.setLineDash([7,8]);ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,25,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(p.x,p.y,31,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=6;ctx.stroke();ctx.restore();}
    drawInteractionReticle();
    if(selected&&!sim)drawBuildPreview();
    if(measureMode&&(measureA||measureB))drawMeasurement();
  }

  if(physics){drawCollapseEffects(physics);drawDynamicVehicle(physics.vehicle)}
  else if(sim&&analysis)drawVehicle(sim.progress,analysis,deformScale);
  else if(analysis&&lastFullAnalysis){const span=stage.deck.at(-1)[0]-stage.deck[0][0];const p=clamp((analysis.loadX-stage.deck[0][0])/span,0,1);drawVehicle(p,analysis,deformScale)}
  else drawVehicle(0,null,0);
  drawDevSolverOverlay(analysis,physics);drawDevGeometryOverlay();
  if(gridVisible)drawGridOverlay();ctx.restore();
}

function drawLoadPath(analysis,deformScale){
  if(!analysis?.reactions)return;
  const loadX=analysis.loadX;
  const y=deckYAt(loadX,analysis,deformScale);
  drawForceArrow({x:loadX,y:y-92},{x:loadX,y:y-24},'#ffe36a',`${Math.round(stage.load/1000)} kN`);
  // BASIC MODE keeps the load-path concept visible but suppresses detailed
  // support-reaction vectors. The reaction data itself is still solved and is
  // exposed again immediately in ADVANCED MODE.
  if(isAdvancedUI()){
    const supportNodes=nodes.filter(n=>n.support);
    for(const n of supportNodes){
      const r=analysis.reactions.get(n.id);if(!r)continue;
      let py=n.y;if(analysis){const i=analysis.index.get(n.id);py+=analysis.U[2*i+1]*deformScale;}
      const mag=Math.abs(r.ry);const len=34+clamp(mag/Math.max(stage.load,1),0,1.2)*38;
      if(mag>100)drawForceArrow({x:n.x,y:py+len+20},{x:n.x,y:py+20},'#a8ff78',`Rᵧ ${Math.round(mag/1000)} kN`);
      if(n.support==='pin'&&Math.abs(r.rx)>400){const dir=r.rx>=0?1:-1;drawForceArrow({x:n.x-dir*60,y:py+8},{x:n.x-dir*15,y:py+8},'#a8ff78',`Rₓ ${Math.round(Math.abs(r.rx)/1000)} kN`);}
    }
  }
  const wind=analysis.wind||0;
  if(Math.abs(wind)>100){
    const dir=wind>0?1:-1; const yWind=Math.min(...stage.deck.map(p=>p[1]))-52;
    drawForceArrow({x:600-dir*95,y:yWind},{x:600+dir*45,y:yWind},'#6fb8ff',`WIND ${Math.round(Math.abs(wind)/1000)} kN`);
  }
}
function drawForceArrow(from,to,color,label){
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;ctx.lineCap='round';line(from,to);
  const ang=Math.atan2(to.y-from.y,to.x-from.x),ah=10;
  ctx.beginPath();ctx.moveTo(to.x,to.y);ctx.lineTo(to.x-Math.cos(ang-.55)*ah,to.y-Math.sin(ang-.55)*ah);ctx.lineTo(to.x-Math.cos(ang+.55)*ah,to.y-Math.sin(ang+.55)*ah);ctx.closePath();ctx.fill();
  ctx.font='800 9px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';const mx=(from.x+to.x)/2,my=(from.y+to.y)/2;const w=ctx.measureText(label).width+12;ctx.fillStyle='rgba(8,13,16,.90)';ctx.strokeStyle='rgba(108,124,133,.58)';ctx.lineWidth=1;ctx.fillRect(mx-w/2,my-11,w,18);ctx.strokeRect(mx-w/2,my-11,w,18);ctx.fillStyle=color;ctx.fillText(label,mx,my-2);ctx.restore();
}

function stressUtilStyle(force,util){
  const u=Math.max(0,util||0), tension=force>=0;
  const stops=tension
    ?[['#526273','#647f9f'],['#5f87b5','#5da9ff'],['#4d91df','#73b9ff'],['#3f82ce','#4fa0ff'],['#d9eeff','#ffffff']]
    :[['#71545a','#8d6870'],['#a45b68','#df687a'],['#c45465','#f06a7c'],['#d7465c','#ff5a70'],['#ffe2e6','#ffffff']];
  let i=0,t=0;
  if(u<.4){i=0;t=u/.4}
  else if(u<.7){i=1;t=(u-.4)/.3}
  else if(u<.9){i=2;t=(u-.7)/.2}
  else if(u<=1){i=3;t=(u-.9)/.1}
  else{i=4;t=clamp((u-1)/.25,0,1)}
  const pair=stops[i];
  const color=mix(pair[0],pair[1],clamp(t,0,1));
  const edge=tension?mix('#283b50','#214f82',clamp(u,0,1)):mix('#4c3036','#8d2637',clamp(u,0,1));
  const hi=tension?mix('#9baaba','#dff2ff',clamp(u,0,1)):mix('#b79ca2','#ffe4e8',clamp(u,0,1));
  const boost=clamp(u,0,1.2)*2.2;
  const level=u>1?'OVERLOAD':u>=.9?'DANGER':u>=.7?'CAUTION':u>=.4?'NORMAL':'LOW';
  return {color,edge,hi,boost,level};
}

function drawMemberVisual(m,pa,pb,analysis){
  const broken=(sim?.broken||lastBroken)?.has(m.id);
  if(broken){drawBrokenMember(m,pa,pb);return;}
  const f=isAdvancedUI()&&(stressMode||sim)&&analysis&&m.user?analysis.forces.get(m.id):null;
  const util=f?Math.max(0,f.ratio):0;
  const sv=f?stressUtilStyle(f.force,util):null;
  const overloaded=!!(f&&util>1);
  if(m.road){
    drawRoadBeam(pa,pb,MAT[m.mat].roadWidth,m.mat==='roadHeavy');
    if(f){
      ctx.save();ctx.lineCap='round';ctx.globalAlpha=util<.4?.30:util<.7?.48:util<.9?.66:util<=1?.82:.96;
      ctx.strokeStyle=sv.color;ctx.lineWidth=2.4+sv.boost;line(pa,pb);ctx.restore();
    }
  }else if(m.mat==='wood'){
    const base=f?sv.color:'#dfa45b', edge=f?sv.edge:'#8b6335', hi=f?sv.hi:'#f3cc8d';
    drawBeam(pa,pb,7+(f?sv.boost:0),base,edge,hi,1.25,'wood');
  }else if(m.mat==='steel'){
    const base=f?sv.color:'#cbd1da', edge=f?sv.edge:'#677281', hi=f?sv.hi:'#eef3f9';
    drawBeam(pa,pb,8+(f?sv.boost:0),base,edge,hi,0.65,'steel');
  }else if(m.mat==='cable'){
    const base=f?sv.color:'#e4cf69', edge=f?sv.edge:'#98863a';
    drawCable(pa,pb,base,edge,2.7+(f?sv.boost*.55:0));
  }
  // Accessibility option: compression receives a dashed centerline so stress
  // meaning never depends on red/blue hue alone.
  if(f&&f.force<0&&document.body.classList.contains('colorblind-stress')){
    ctx.save();ctx.setLineDash([7,4]);ctx.lineCap='butt';ctx.strokeStyle='rgba(255,244,228,.82)';ctx.lineWidth=1.25;line(pa,pb);ctx.setLineDash([]);ctx.restore();
  }
  if(overloaded){
    const mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2;
    ctx.save();
    ctx.strokeStyle='#fff6f7'; ctx.lineWidth=2.1; ctx.lineCap='round';
    line({x:mx-8,y:my-7},{x:mx+8,y:my+7});
    line({x:mx+8,y:my-7},{x:mx-8,y:my+7});
    ctx.restore();
  }
}

function drawBrokenMember(m,pa,pb){
  const dx=pb.x-pa.x,dy=pb.y-pa.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const gap=Math.min(m.road?24:18,L*.18),mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2;
  const a2={x:mx-ux*gap,y:my-uy*gap},b2={x:mx+ux*gap,y:my+uy*gap};
  const col=MAT[m.mat].color,roadW=m.road?(MAT[m.mat]?.roadWidth||16):0,outer=m.road?roadW+5:(m.mat==='cable'?6:11),inner=m.road?roadW:(m.mat==='cable'?3:7);
  ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(44,37,44,.46)';ctx.lineWidth=outer;line(pa,a2);line(b2,pb);
  ctx.strokeStyle=col;ctx.lineWidth=inner;line(pa,a2);line(b2,pb);
  ctx.strokeStyle='#f4eee9';ctx.lineWidth=2;const nx=-uy,ny=ux;
  line({x:a2.x-nx*5,y:a2.y-ny*5},{x:a2.x+nx*5,y:a2.y+ny*5});line({x:b2.x-nx*5,y:b2.y-ny*5},{x:b2.x+nx*5,y:b2.y+ny*5});ctx.restore();
}
function drawCollapseEffects(physics){
  ctx.save();
  for(const d of physics.dust){const a=clamp(d.life/d.max,0,1);ctx.globalAlpha=a*.7;ctx.fillStyle='#d8cdbd';ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;
  for(const f of physics.flashes){const t=1-clamp(f.life/f.max,0,1);ctx.strokeStyle=`rgba(255,236,196,${(1-t)*.8})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,6+t*22,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function drawCollapseRope(physics,rope){
  const pts=rope.ids.map(id=>collapseParticle(physics,id)).filter(Boolean);if(pts.length<2)return;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(let pass=0;pass<3;pass++){
    ctx.beginPath();let started=false;
    for(let i=0;i<pts.length-1;i++){
      if(rope.broken&&i===rope.breakIndex){started=false;continue}
      const a=pts[i],b=pts[i+1];
      if(!started){ctx.moveTo(a.x,a.y);started=true}ctx.lineTo(b.x,b.y);
    }
    if(pass===0){ctx.strokeStyle='rgba(35,31,10,.16)';ctx.lineWidth=7}
    else if(pass===1){ctx.strokeStyle='#8d7a34';ctx.lineWidth=4}
    else{ctx.strokeStyle='#e4cf69';ctx.lineWidth=2.4}
    ctx.stroke();
  }
  // A fine highlight emphasizes curvature and makes slack cable read as thread.
  ctx.strokeStyle='rgba(255,250,215,.58)';ctx.lineWidth=.7;ctx.beginPath();
  let started=false;for(let i=0;i<pts.length-1;i++){if(rope.broken&&i===rope.breakIndex){started=false;continue}const a=pts[i],b=pts[i+1];if(!started){ctx.moveTo(a.x,a.y);started=true}ctx.lineTo(b.x,b.y)}ctx.stroke();ctx.restore();
}
function drawDynamicVehicle(v){if(stage?.vehicleHidden)return;drawVehicleBody(v.x,v.y,v.angle,v.rot)}

function texHash(a,b=0,c=0){
  const n=Math.sin(a*12.9898+b*78.233+c*37.719)*43758.5453123;
  return n-Math.floor(n);
}
function beamPoint(pa,pb,t,offset=0){
  const [nx,ny]=normal(pa,pb);return {x:pa.x+(pb.x-pa.x)*t+nx*offset,y:pa.y+(pb.y-pa.y)*t+ny*offset};
}
function drawRoadBeam(pa,pb,w,reinforced=false){
  strokeShadow(pa,pb,w+9,'rgba(24,22,28,.28)');
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  const L=dist(pa,pb),[nx,ny]=normal(pa,pb);
  const grad=ctx.createLinearGradient(pa.x,pa.y,pb.x,pb.y);
  if(reinforced){grad.addColorStop(0,'#3d4851');grad.addColorStop(.28,'#59656e');grad.addColorStop(.53,'#6b7780');grad.addColorStop(.76,'#56626b');grad.addColorStop(1,'#39454e');}
  else{grad.addColorStop(0,'#3b3532');grad.addColorStop(.26,'#504640');grad.addColorStop(.52,'#655750');grad.addColorStop(.76,'#4e443f');grad.addColorStop(1,'#39332f');}
  ctx.strokeStyle=reinforced?'#202a30':'#282321';ctx.lineWidth=w+5;line(pa,pb);
  ctx.strokeStyle=grad;ctx.lineWidth=w;line(pa,pb);

  // top wearing surface
  ctx.strokeStyle=reinforced?'rgba(224,232,235,.42)':'rgba(236,225,211,.34)';ctx.lineWidth=1.7;
  line(beamPoint(pa,pb,0, w*.27),beamPoint(pa,pb,1,w*.27));
  ctx.strokeStyle='rgba(0,0,0,.24)';ctx.lineWidth=1.5;
  line(beamPoint(pa,pb,0,-w*.31),beamPoint(pa,pb,1,-w*.31));

  // aggregate / wear texture, deterministic so it does not shimmer between frames
  const specks=Math.min(28,Math.max(5,Math.floor(L/9)));
  for(let i=0;i<specks;i++){
    const t=(i+.55)/specks, j=(texHash(pa.x+pb.x,i,pa.y)-.5)*w*.56;
    const q=beamPoint(pa,pb,t,j);
    const r=.45+texHash(pb.x,i,pa.x)*.8;
    ctx.fillStyle=texHash(i,pa.x,pb.y)>.5?(reinforced?'rgba(229,237,239,.18)':'rgba(232,215,197,.16)'):'rgba(15,17,19,.18)';
    ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();
  }

  if(reinforced){
    const count=Math.max(1,Math.floor(L/31));
    ctx.lineWidth=1.15;
    for(let i=1;i<count;i++){
      const t=i/count,q=beamPoint(pa,pb,t,0);
      ctx.strokeStyle=i%2?'rgba(218,229,233,.34)':'rgba(22,29,33,.38)';
      line({x:q.x-nx*w*.34,y:q.y-ny*w*.34},{x:q.x+nx*w*.34,y:q.y+ny*w*.34});
      ctx.fillStyle='rgba(230,235,237,.45)';ctx.beginPath();ctx.arc(q.x+nx*w*.22,q.y+ny*w*.22,1.1,0,Math.PI*2);ctx.fill();
    }
  }else if(L>54){
    // faint expansion-joint scuffs on ordinary deck
    const count=Math.max(1,Math.floor(L/72));ctx.strokeStyle='rgba(18,16,16,.26)';ctx.lineWidth=.8;
    for(let i=1;i<=count;i++){const q=beamPoint(pa,pb,i/(count+1),0);line({x:q.x-nx*w*.30,y:q.y-ny*w*.30},{x:q.x+nx*w*.30,y:q.y+ny*w*.30})}
  }
  ctx.restore();
}

function drawBeam(pa,pb,w,base,edge,highlight,textureScale=1,kind='steel'){
  strokeShadow(pa,pb,w+8,'rgba(22,20,26,.23)');
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=edge;ctx.lineWidth=w+3.8;line(pa,pb);
  const grad=ctx.createLinearGradient(pa.x,pa.y,pb.x,pb.y);
  grad.addColorStop(0,shade(base,-12));grad.addColorStop(.14,base);grad.addColorStop(.46,shade(base,8));grad.addColorStop(.72,shade(base,2));grad.addColorStop(1,shade(base,-10));
  ctx.strokeStyle=grad;ctx.lineWidth=w;line(pa,pb);
  const [nx,ny]=normal(pa,pb),L=dist(pa,pb);

  ctx.strokeStyle=highlight;ctx.lineWidth=Math.max(1.1,w*.16);
  line(beamPoint(pa,pb,0,w*.18),beamPoint(pa,pb,1,w*.18));
  ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=Math.max(.8,w*.11);
  line(beamPoint(pa,pb,0,-w*.23),beamPoint(pa,pb,1,-w*.23));

  if(kind==='wood'&&L>18){
    // longitudinal grain follows the member instead of looking like generic stripes
    const grains=3;
    for(let g=0;g<grains;g++){
      const off=(-.26+g*.26)*w;
      ctx.strokeStyle=g===1?'rgba(255,225,171,.16)':'rgba(91,54,24,.18)';ctx.lineWidth=.65;
      ctx.beginPath();
      for(let i=0;i<=8;i++){
        const t=i/8, wobble=(texHash(g,i,pa.x+pb.y)-.5)*1.2;
        const q=beamPoint(pa,pb,t,off+wobble);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);
      }
      ctx.stroke();
    }
    const knots=Math.min(2,Math.floor(L/92));
    for(let k=0;k<knots;k++){
      const t=.28+.42*texHash(pa.x,k,pb.y),q=beamPoint(pa,pb,t,(texHash(k,pb.x,pa.y)-.5)*w*.35);
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.atan2(pb.y-pa.y,pb.x-pa.x));ctx.strokeStyle='rgba(83,48,23,.32)';ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(0,0,3.4,1.5,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }else if(kind==='steel'&&L>20){
    // brushed steel catches light in short transverse scratches
    const count=Math.min(18,Math.max(3,Math.floor(L/13)));
    for(let i=1;i<count;i++){
      const t=i/count,q=beamPoint(pa,pb,t,0),len=w*(.23+.18*texHash(i,pa.x,pb.y));
      ctx.strokeStyle=i%3===0?'rgba(255,255,255,.20)':'rgba(25,31,36,.18)';ctx.lineWidth=.55;
      line({x:q.x-nx*len,y:q.y-ny*len},{x:q.x+nx*len,y:q.y+ny*len});
    }
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=.55;
    line(beamPoint(pa,pb,.06,0),beamPoint(pa,pb,.94,0));
  }
  drawMemberEndCap(pa,w*.58,edge,highlight,kind);
  drawMemberEndCap(pb,w*.58,edge,highlight,kind);
  ctx.restore();
}

function drawCable(pa,pb,base,edge,w){
  strokeShadow(pa,pb,w+5,'rgba(35,31,10,.15)');
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle=edge;ctx.lineWidth=w+1.8;line(pa,pb);
  ctx.strokeStyle=base;ctx.lineWidth=w;line(pa,pb);
  const [nx,ny]=normal(pa,pb),L=dist(pa,pb);
  ctx.strokeStyle='rgba(255,250,215,.72)';ctx.lineWidth=.75;line(beamPoint(pa,pb,0,.65),beamPoint(pa,pb,1,.65));
  // subtle twisted-strand texture; stays restrained when zoomed out
  if(L>28){
    const count=Math.min(24,Math.max(4,Math.floor(L/14)));
    for(let i=1;i<count;i++){
      const t=i/count,q=beamPoint(pa,pb,t,0),phase=(i%2?1:-1)*w*.42;
      ctx.strokeStyle=i%2?'rgba(255,244,191,.34)':'rgba(83,72,27,.28)';ctx.lineWidth=.55;
      line({x:q.x-nx*phase,y:q.y-ny*phase},{x:q.x+nx*phase,y:q.y+ny*phase});
    }
  }
  ctx.restore();
}

function drawMemberEndCap(p,r,edge,hi,kind='steel'){
  ctx.save();
  const g=ctx.createRadialGradient(p.x-r*.28,p.y-r*.32,.4,p.x,p.y,r);
  g.addColorStop(0,kind==='wood'?shade(hi,4):'#f6f8fa');g.addColorStop(.42,shade(hi,-6));g.addColorStop(1,edge);
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='rgba(20,20,24,.32)';ctx.lineWidth=.7;ctx.stroke();
  if(kind==='steel'){
    ctx.strokeStyle='rgba(48,54,60,.55)';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(p.x-r*.35,p.y);ctx.lineTo(p.x+r*.35,p.y);ctx.stroke();
  }else{
    ctx.strokeStyle='rgba(98,59,28,.35)';ctx.lineWidth=.65;ctx.beginPath();ctx.arc(p.x,p.y,r*.45,0,Math.PI*1.45);ctx.stroke();
  }
  ctx.restore();
}

function drawNodeVisual(n,p){
  const size=n.support?8.9:(n.deck?8.3:7.5);
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.24)';ctx.shadowBlur=5;ctx.shadowOffsetY=1.5;
  ctx.beginPath();ctx.arc(p.x,p.y,size+3.5,0,Math.PI*2);ctx.fillStyle='rgba(20,23,28,.52)';ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;

  // dark retaining washer
  const outer=ctx.createRadialGradient(p.x-2.5,p.y-3,1,p.x,p.y,size+2.1);
  outer.addColorStop(0,'#78808a');outer.addColorStop(.48,'#4e555d');outer.addColorStop(1,'#24292e');
  ctx.beginPath();ctx.arc(p.x,p.y,size+1.8,0,Math.PI*2);ctx.fillStyle=outer;ctx.fill();
  ctx.strokeStyle='rgba(12,15,18,.8)';ctx.lineWidth=1.2;ctx.stroke();

  const ring=ctx.createRadialGradient(p.x-size*.25,p.y-size*.3,.6,p.x,p.y,size);
  if(n.support){ring.addColorStop(0,'#ff9eaa');ring.addColorStop(.34,'#ff6576');ring.addColorStop(.72,'#d52e4a');ring.addColorStop(1,'#791e32');}
  else{ring.addColorStop(0,'#fff59a');ring.addColorStop(.3,'#ffe95d');ring.addColorStop(.68,'#e4be1c');ring.addColorStop(1,'#977514');}
  ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fillStyle=ring;ctx.fill();
  ctx.lineWidth=1.8;ctx.strokeStyle=selected?.id===n.id?'#ffffff':'rgba(51,46,50,.92)';ctx.stroke();

  // machined inner washer and bolt
  const inner=ctx.createRadialGradient(p.x-1.8,p.y-2.2,.4,p.x,p.y,size*.62);
  inner.addColorStop(0,'#fbfcfd');inner.addColorStop(.38,'#d6dbe0');inner.addColorStop(.72,'#9da3aa');inner.addColorStop(1,'#626970');
  ctx.beginPath();ctx.arc(p.x,p.y,size*.60,0,Math.PI*2);ctx.fillStyle=inner;ctx.fill();
  ctx.strokeStyle='rgba(45,49,54,.65)';ctx.lineWidth=.75;ctx.stroke();

  // hex bolt head
  ctx.beginPath();
  for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3,x=p.x+Math.cos(a)*size*.30,y=p.y+Math.sin(a)*size*.30;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();
  const bolt=ctx.createLinearGradient(p.x-size*.3,p.y-size*.3,p.x+size*.3,p.y+size*.3);bolt.addColorStop(0,'#b9bec4');bolt.addColorStop(.5,'#70767d');bolt.addColorStop(1,'#4b5158');
  ctx.fillStyle=bolt;ctx.fill();ctx.strokeStyle='rgba(30,34,38,.7)';ctx.lineWidth=.7;ctx.stroke();
  ctx.strokeStyle='rgba(226,230,234,.48)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p.x-size*.16,p.y-size*.08);ctx.lineTo(p.x+size*.16,p.y+size*.08);ctx.stroke();

  if(hoverNode?.id===n.id&&!sim){ctx.beginPath();ctx.arc(p.x,p.y,size+8,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=1.7;ctx.stroke();}
  if(dragging?.id===n.id){ctx.beginPath();ctx.arc(p.x,p.y,size+12,0,Math.PI*2);ctx.strokeStyle='rgba(155,228,58,.9)';ctx.lineWidth=2.5;ctx.stroke();}
  ctx.restore();
}

function strokeShadow(pa,pb,w,color){
  ctx.save();
  ctx.strokeStyle=color; ctx.lineWidth=w; ctx.lineCap='round';
  line({x:pa.x,y:pa.y+1.2},{x:pb.x,y:pb.y+1.2});
  ctx.restore();
}

function line(a,b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
function normal(a,b){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;return[-dy/L,dx/L]}
function mix(a,b,t){const A=hex(a),B=hex(b);return `rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`}
function hex(h){const v=parseInt(h.slice(1),16);return[(v>>16)&255,(v>>8)&255,v&255]}
function shade(h,amt){let rgb;if(h.startsWith('#'))rgb=hex(h);else{const m=h.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);rgb=m?[Number(m[1]),Number(m[2]),Number(m[3])]:[128,128,128];}const [r,g,b]=rgb;const adj=v=>Math.round(Math.max(0,Math.min(255,v+amt)));return `rgb(${adj(r)},${adj(g)},${adj(b)})`}
function poly(pts,fill,stroke=null){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath(); if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}

function drawBackground(){
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#d6d0f0');
  sky.addColorStop(.22,'#cbc4e8');
  sky.addColorStop(.56,'#b8b0d8');
  sky.addColorStop(.82,'#a49cc3');
  sky.addColorStop(1,'#8f88ad');
  ctx.fillStyle=sky;
  ctx.fillRect(-1600,-1000,W+3200,H+2200);

  const vignette=ctx.createRadialGradient(W*0.5,H*0.2,120,W*0.5,H*0.38,900);
  vignette.addColorStop(0,'rgba(255,255,255,.06)');
  vignette.addColorStop(.6,'rgba(255,255,255,.01)');
  vignette.addColorStop(1,'rgba(31,27,39,.18)');
  ctx.fillStyle=vignette;
  ctx.fillRect(-1600,-1000,W+3200,H+2200);

  const sun=ctx.createRadialGradient(885,98,12,885,98,215);
  sun.addColorStop(0,'rgba(255,255,255,.52)');
  sun.addColorStop(.26,'rgba(247,241,214,.28)');
  sun.addColorStop(.7,'rgba(255,255,255,.08)');
  sun.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sun;
  ctx.fillRect(650,-40,470,330);

  for(let i=0;i<6;i++) drawCloud(120+i*160, 32+(i%2)*16, 1.05+(i%3)*.12, .07);
  drawCloud(180,110,1.08,.17); drawCloud(430,148,.88,.12); drawCloud(980,146,1.18,.115); drawCloud(760,84,.82,.09);

  drawMountainBand(236,120,9,'#a39cbc','#938cb0');
  drawMountainBand(300,146,8,'#9089ab','#827a9f');
  drawMountainBand(372,120,7,'#7f7898','#726b8b');

  drawMistBand(238,32,'rgba(255,255,255,.09)');
  drawMistBand(332,26,'rgba(255,255,255,.055)');

  ctx.fillStyle='rgba(255,255,255,.06)';
  ctx.fillRect(-200,386,W+400,10);
  ctx.fillStyle='rgba(68,60,82,.2)';
  ctx.fillRect(-200,396,W+400,3);

  const leftLip=stage.deck[0], rightLip=stage.deck.at(-1);
  drawCliffSide('left',leftLip[0],leftLip[1]);
  drawCliffSide('right',rightLip[0],rightLip[1]);

  const voidTop=Math.min(...stage.deck.map(p=>p[1]))+98;
  const voidGrad=ctx.createLinearGradient(0,voidTop,0,H);
  voidGrad.addColorStop(0,'rgba(152,145,180,.18)');
  voidGrad.addColorStop(.36,'rgba(118,111,147,.24)');
  voidGrad.addColorStop(1,'rgba(78,74,101,.48)');
  ctx.fillStyle=voidGrad;
  ctx.fillRect(stage.deck[0][0],voidTop,stage.deck.at(-1)[0]-stage.deck[0][0],H-voidTop);

  const ravineGlow=ctx.createLinearGradient(0,voidTop+20,0,H);
  ravineGlow.addColorStop(0,'rgba(210,205,235,.08)');
  ravineGlow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ravineGlow;
  ctx.fillRect(stage.deck[0][0],voidTop+10,stage.deck.at(-1)[0]-stage.deck[0][0],110);

  ctx.fillStyle='rgba(255,255,255,.04)';
  poly([[stage.deck[0][0]+45,voidTop+36],[stage.deck[0][0]+140,voidTop+78],[stage.deck[0][0]+96,voidTop+128],[stage.deck[0][0]+30,voidTop+94]],'rgba(255,255,255,.04)');
  poly([[stage.deck.at(-1)[0]-44,voidTop+42],[stage.deck.at(-1)[0]-128,voidTop+90],[stage.deck.at(-1)[0]-92,voidTop+134],[stage.deck.at(-1)[0]-8,voidTop+84]],'rgba(255,255,255,.035)');

  [[40,420,.92],[118,390,.8],[1118,399,.96],[1048,414,.74],[284,264,.55],[988,268,.57],[101,448,.58],[1091,450,.56]].forEach(args=>drawPine(...args));
  drawSiteEnvironmentOverlay();
  drawAmbientTexture();
}

function drawSiteEnvironmentOverlay(){
  ctx.save();
  const waterRect=stage?.forbidden?.find(r=>r.kind==='water'),waterY=stage?.navigationClearance?.waterY??waterRect?.y;
  if(Number.isFinite(waterY)){
    const x0=stage.deck[0][0],x1=stage.deck.at(-1)[0],g=ctx.createLinearGradient(0,waterY,0,H);g.addColorStop(0,'rgba(78,122,156,.34)');g.addColorStop(.45,'rgba(55,86,122,.38)');g.addColorStop(1,'rgba(37,55,86,.52)');ctx.fillStyle=g;ctx.fillRect(x0,waterY,x1-x0,H-waterY+160);
    ctx.strokeStyle='rgba(199,228,239,.42)';ctx.lineWidth=1.2;for(let i=0;i<12;i++){const yy=waterY+8+i*10,phase=(anim*.18+i*17)%54;ctx.beginPath();for(let x=x0-40;x<x1+40;x+=54){ctx.moveTo(x+phase,yy);ctx.lineTo(x+phase+24,yy)}ctx.stroke()}
  }
  const weather=stage?.weather||'clear';
  if(weather==='overcast'||weather==='storm'){ctx.fillStyle=weather==='storm'?'rgba(19,25,34,.18)':'rgba(45,50,67,.10)';ctx.fillRect(-200,-200,W+400,H+400)}
  if(weather==='rain'||weather==='storm'){
    ctx.strokeStyle=weather==='storm'?'rgba(205,225,235,.22)':'rgba(205,225,235,.13)';ctx.lineWidth=1;const speed=weather==='storm'?13:8;
    for(let i=0;i<(weather==='storm'?54:34);i++){const x=(texHash(i,77,4)*W+anim*speed)%W,y=(texHash(i,91,7)*H+anim*(speed*.5))%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+18);ctx.stroke()}
  }
  if(weather==='windy'||weather==='storm'){
    ctx.strokeStyle='rgba(235,242,247,.10)';ctx.setLineDash([18,26]);for(let i=0;i<5;i++){const yy=118+i*58,shift=(anim*(stage.wind>=0?1.2:-1.2)+i*33)%90;ctx.beginPath();ctx.moveTo(-100+shift,yy);ctx.lineTo(W+100+shift,yy-14);ctx.stroke()}ctx.setLineDash([]);
  }
  if(stage?.environment){ctx.font='800 9px ui-monospace,monospace';ctx.fillStyle='rgba(32,39,49,.30)';ctx.textAlign='left';ctx.fillText(`SITE // ${stage.environment}`,22,H-24)}
  ctx.restore();
}

function drawAmbientTexture(){
  ctx.save();
  // fixed film-grain / atmospheric flecks: deterministic to avoid frame shimmer
  for(let i=0;i<54;i++){
    const x=texHash(i,17,3)*W,y=texHash(i,31,9)*H;
    const r=.35+texHash(i,44,6)*.75;
    ctx.globalAlpha=y<360?.032:.055;
    ctx.fillStyle=i%3===0?'#ffffff':'#554e67';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  // subtle horizontal atmospheric bands add depth without looking like a gradient-only backdrop
  ctx.globalAlpha=1;
  for(const y of [188,286,374]){
    const g=ctx.createLinearGradient(0,y,0,y+14);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.025)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,y,W,14);
  }
  ctx.restore();
}

function drawCloud(x,y,s,a){
  ctx.save();
  ctx.globalAlpha=a;
  const g=ctx.createLinearGradient(x-60*s,y-30*s,x+92*s,y+18*s);
  g.addColorStop(0,'#ffffff');
  g.addColorStop(1,'#ece7fa');
  ctx.fillStyle=g;
  [[0,0,34],[28,-8,28],[56,0,34],[80,7,24],[-28,8,24]].forEach(([dx,dy,r])=>{ctx.beginPath();ctx.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha*=.5;
  ctx.fillStyle='rgba(255,255,255,.6)';
  ctx.fillRect(x-28*s,y+8*s,86*s,16*s);
  ctx.restore();
}

function drawPine(x,y,s=1){
  ctx.save();
  ctx.fillStyle='#6e6885';
  ctx.fillRect(x-4.2*s,y-60*s,8.4*s,62*s);
  poly([[x,y-122*s],[x-24*s,y-79*s],[x-10*s,y-80*s],[x-31*s,y-46*s],[x-15*s,y-49*s],[x-35*s,y-12*s],[x+35*s,y-12*s],[x+15*s,y-49*s],[x+31*s,y-46*s],[x+10*s,y-80*s],[x+24*s,y-79*s]],'#f1ecff');
  poly([[x,y-122*s],[x-24*s,y-79*s],[x+24*s,y-79*s]],'rgba(83,78,100,.27)');
  poly([[x,y-79*s],[x-31*s,y-46*s],[x+31*s,y-46*s]],'rgba(83,78,100,.22)');
  poly([[x,y-46*s],[x-35*s,y-12*s],[x+35*s,y-12*s]],'rgba(83,78,100,.17)');
  ctx.fillStyle='rgba(255,255,255,.52)';
  ctx.fillRect(x-2.6*s,y-108*s,5.2*s,12*s);
  ctx.restore();
}

function drawMountainBand(baseY,amp,count,colorA,colorB){
  const step=(W+160)/(count-1);
  const pts=[[ -80, baseY+44 ]];
  for(let i=0;i<count;i++){
    const x=-80+i*step;
    const h=amp*(.65+((i%3)+1)*.42)+((i%2)?amp*.55:0);
    pts.push([x, baseY-h]);
    if(i<count-1) pts.push([x+step*.52, baseY+((i%2)?22:10)]);
  }
  pts.push([W+80,baseY+50]);
  poly(pts,colorA);
  for(let i=0;i<count-1;i++){
    const x=-80+i*step;
    const peak=[x, baseY-(amp*(.65+((i%3)+1)*.42)+((i%2)?amp*.55:0))];
    const right=[x+step*.52, baseY+((i%2)?22:10)];
    const nextPeak=[x+step, baseY-(amp*(.65+((((i+1)%3)+1))* .42)+(((i+1)%2)?amp*.55:0))];
    poly([peak,right,nextPeak], i%2?colorB:shade(colorB,8));
    poly([peak,[ (peak[0]+right[0])/2, (peak[1]+right[1])/2 + 2],[ (peak[0]+right[0])/2 + 26, (peak[1]+right[1])/2 - 8]], 'rgba(255,255,255,.06)');
  }
}

function drawMistBand(y,h,color){
  const g=ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,'rgba(255,255,255,0)');
  g.addColorStop(.45,color);
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;
  ctx.fillRect(-120,y,W+240,h);
}

function drawCliffSide(side,edgeX,edgeY){
  const left=side==='left';
  const dir=left?-1:1;
  const outer=left?0:W;
  const fillMain='#7f7898', fillDark='#6c6584', fillLight='rgba(255,255,255,.1)', facet='rgba(83,78,100,.35)';
  const topPts = left
    ? [[0,458],[118,408],[edgeX,edgeY+18],[edgeX,H],[0,H]]
    : [[W,448],[1085,410],[edgeX,edgeY+18],[edgeX,H],[W,H]];
  poly(topPts,fillMain);
  const rim = left
    ? [[0,455],[115,408],[edgeX,edgeY+18],[edgeX,edgeY+44],[98,445],[0,490]]
    : [[W,446],[1085,410],[edgeX,edgeY+18],[edgeX,edgeY+44],[1092,446],[W,488]];
  poly(rim,fillDark);
  const facets = left ? [
    [[18,440],[92,414],[126,464],[76,496],[22,470]],
    [[86,494],[176,468],[214,514],[118,570],[52,540]],
    [[0,512],[80,482],[126,522],[74,586],[0,560]],
    [[130,410],[194,422],[216,474],[160,498],[122,462]]
  ] : [
    [[1182,434],[1106,406],[1072,455],[1122,488],[1176,466]],
    [[1115,492],[1024,468],[987,516],[1084,575],[1150,538]],
    [[1200,506],[1124,480],[1079,520],[1128,585],[1200,558]],
    [[1070,410],[1008,422],[984,470],[1038,500],[1080,460]]
  ];
  facets.forEach((p,i)=>poly(p,i%2?facet:'rgba(255,255,255,.07)'));
  if(left){ poly([[5,430],[54,418],[90,438],[34,452]],'rgba(255,255,255,.11)'); }
  else { poly([[1194,430],[1146,416],[1110,437],[1168,451]],'rgba(255,255,255,.11)'); }

  ctx.fillStyle='rgba(58,52,71,.45)';
  ctx.fillRect(edgeX-3,edgeY+18,6,38);
  ctx.fillStyle='rgba(255,255,255,.08)';
  ctx.fillRect(edgeX-3,edgeY+18,2,38);

  const grassGrad=ctx.createLinearGradient(edgeX-80,edgeY+4,edgeX+80,edgeY+4);
  grassGrad.addColorStop(0,'#655d46');
  grassGrad.addColorStop(.5,'#887d5c');
  grassGrad.addColorStop(1,'#655d46');
  ctx.fillStyle=grassGrad;
  ctx.fillRect(left?0:edgeX, edgeY+8, left?edgeX:W-edgeX, 4);
}

function drawGridOverlay(){
  // CAD grid: minor density adapts to zoom while major lines stay at 100u.
  const zoom=camera?.zoom||1,minor=zoom<.72?50:zoom>1.55?12.5:25,major=100;
  ctx.save();
  for(let x=0;x<=W;x+=minor){
    const isMajor=Math.abs((x/major)-Math.round(x/major))<1e-6;
    ctx.strokeStyle=isMajor?'rgba(148,188,198,.105)':'rgba(186,213,219,.035)';ctx.lineWidth=isMajor?1.15:.7;
    ctx.beginPath();ctx.moveTo(x,74);ctx.lineTo(x,H-48);ctx.stroke();
  }
  for(let y=75;y<=H-48;y+=minor){
    const isMajor=Math.abs((y/major)-Math.round(y/major))<1e-6;
    ctx.strokeStyle=isMajor?'rgba(148,188,198,.105)':'rgba(186,213,219,.035)';ctx.lineWidth=isMajor?1.15:.7;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }
  if(zoom>=.82){
    ctx.fillStyle='rgba(153,176,184,.22)';ctx.font='700 7px ui-monospace,monospace';ctx.textAlign='left';ctx.textBaseline='top';
    for(let x=100;x<W;x+=200)ctx.fillText(String(x),x+4,82);
    for(let y=100;y<H-60;y+=200)ctx.fillText(String(y),6,y+4);
  }
  ctx.restore();
}
function drawForbidden(){
  for(const r of stage.forbidden){
    if(r.kind==='navigation'){drawNavigationChannel(r);continue}
    const water=r.kind==='water',height=r.kind==='height-limit';
    const fill=water?'rgba(72,143,188,.075)':height?'rgba(221,177,67,.07)':'rgba(255,83,109,.10)';
    const stroke=water?'rgba(90,164,209,.48)':height?'rgba(224,173,65,.58)':'rgba(255,83,109,.55)';
    const label=water?'WATER // NODE PLACEMENT PROHIBITED':height?'HEIGHT ENVELOPE // NO BUILD ABOVE':'NO BUILD ZONE // MEMBERS BLOCKED';
    ctx.save();ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.setLineDash(height?[5,6]:[8,7]);ctx.lineWidth=1.5;ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.setLineDash([]);
    ctx.fillStyle=water?'rgba(141,201,232,.88)':height?'rgba(231,196,102,.9)':'rgba(255,130,145,.9)';ctx.font='800 9px ui-monospace,monospace';ctx.fillText(label,r.x+12,Math.max(110,r.y+20));ctx.restore();
  }
}

function drawNavigationChannel(r){
  const env=getNavigationEnvelope(r);if(!env)return;
  ctx.save();
  if(!sim){
    ctx.fillStyle='rgba(215,185,77,.075)';ctx.fillRect(env.x,env.y,env.w,env.h);
    ctx.save();ctx.beginPath();ctx.rect(env.x,env.y,env.w,env.h);ctx.clip();
    ctx.strokeStyle='rgba(224,173,65,.24)';ctx.lineWidth=1;
    const step=16,span=env.w+env.h;
    for(let d=-env.h;d<env.w;d+=step){ctx.beginPath();ctx.moveTo(env.x+d,env.y+env.h);ctx.lineTo(env.x+d+env.h,env.y);ctx.stroke()}
    ctx.restore();
    ctx.strokeStyle='rgba(231,179,65,.78)';ctx.lineWidth=1.4;ctx.setLineDash([7,6]);ctx.strokeRect(env.x,env.y,env.w,env.h);ctx.setLineDash([]);
    ctx.fillStyle='rgba(9,13,16,.88)';ctx.fillRect(env.x+8,env.y+8,220,36);
    ctx.fillStyle='#e3c45b';ctx.font='900 9px ui-monospace,monospace';ctx.fillText('NAVIGATION CLEARANCE ENVELOPE',env.x+14,env.y+21);
    ctx.fillStyle='rgba(207,216,220,.78)';ctx.font='800 8px ui-monospace,monospace';ctx.fillText(`MIN W ${Math.round(env.minWidth)}u  //  MIN H ${Math.round(env.minHeight)}u  //  NO BUILD`,env.x+14,env.y+34);
    ctx.strokeStyle='rgba(224,173,65,.52)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(env.x,env.y-8);ctx.lineTo(env.x+env.w,env.y-8);ctx.stroke();
    ctx.beginPath();ctx.moveTo(env.x-8,env.y);ctx.lineTo(env.x-8,env.y+env.h);ctx.stroke();
  }else{
    ctx.strokeStyle='rgba(224,173,65,.30)';ctx.lineWidth=1;ctx.setLineDash([5,8]);ctx.strokeRect(env.x,env.y,env.w,env.h);ctx.setLineDash([]);
    const sweep=vesselSweptSlice(sim.shipProgress||0);
    if(sweep){ctx.fillStyle='rgba(237,102,119,.055)';ctx.fillRect(sweep.x,sweep.y,sweep.w,sweep.h);ctx.strokeStyle='rgba(237,102,119,.32)';ctx.strokeRect(sweep.x,sweep.y,sweep.w,sweep.h)}
  }
  ctx.restore();
}

function vesselTestProgress(){
  if(!stage.ship||!sim)return null;
  if(Number.isFinite(sim.shipProgress))return clamp(sim.shipProgress,0,1);
  return 0;
}

function smoothstep01(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function smootherstep01(t){t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10)}

function vesselMotionState(p,ship){
  const geom=shipGeometry(ship);
  // 0~0.46: 원근 접근, 0.46~1: 화면 평면을 통과하며 가상 종단면이 이동한다.
  const approach=smootherstep01(clamp(p/.46,0,1));
  const passage=smootherstep01(clamp((p-.46)/.54,0,1));
  const focal=610, zFar=980, zNear=250;
  const z=zFar+(zNear-zFar)*approach;
  const proj=focal/(focal+z);
  const nearProj=focal/(focal+zNear);
  const scale=.56+.46*(proj/nearProj);
  // 일정한 전진 속도처럼 보이되, 접근 종료 후에는 화면에서 위쪽으로 부드럽게 통과한다.
  const yApproach=(ship.y+64)+(ship.y+14-(ship.y+64))*approach;
  const travel=118*passage;
  const heave=2.2*Math.exp(-2.6*p)*Math.sin(2*Math.PI*(1.55*p)+.45);
  const y=yApproach-travel+heave;
  const station=geom.virtualLength*passage;
  return {approach,passage,z,scale,y,station,geom};
}

function drawStageVessel(){
  if(!stage.ship)return;
  const r=stage.forbidden.find(x=>x.kind==='navigation')||stage.forbidden[0];
  if(!r)return;
  const p=vesselTestProgress();
  const cx=r.x+r.w*.5;
  if(p===null){
    drawFrontVessel(cx,stage.ship.y+40,stage.ship,.99,0,null,1);
    return;
  }
  const st=vesselMotionState(p,stage.ship);
  drawFrontVessel(cx,st.y,stage.ship,st.scale,st.passage,st.station,1);
}

function shipHexWindow(cx,cy,r){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=Math.PI/6+i*Math.PI/3,px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;
    if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
  }
  ctx.closePath();
}

function drawShipFrontCore(geom,fade=1){
  const {Wv,Hv}=geom;
  ctx.save();ctx.globalAlpha*=fade;

  // 선체: 밝은 상부와 어두운 하부를 분리해 정면 볼륨을 만든다.
  const hull=ctx.createLinearGradient(0,-Hv*.03,0,Hv*.40);
  hull.addColorStop(0,'#f9f7fb');hull.addColorStop(.24,'#e7e3eb');hull.addColorStop(.70,'#c9c7d2');hull.addColorStop(1,'#9fa4b2');
  poly([[-Wv*.43,-Hv*.015],[Wv*.43,-Hv*.015],[Wv*.395,Hv*.14],[Wv*.30,Hv*.23],[Wv*.11,Hv*.31],[0,Hv*.37],[-Wv*.11,Hv*.31],[-Wv*.30,Hv*.23],[-Wv*.395,Hv*.14]],hull,'rgba(250,244,250,.9)');
  poly([[-Wv*.37,Hv*.13],[Wv*.37,Hv*.13],[Wv*.30,Hv*.25],[0,Hv*.38],[-Wv*.30,Hv*.25]],'#4e617a','rgba(43,52,67,.75)');
  ctx.fillStyle='rgba(71,151,223,.55)';ctx.fillRect(-Wv*.23,Hv*.265,Wv*.46,Hv*.095);

  // 선실의 뒤쪽 그림자.
  ctx.fillStyle='rgba(77,67,83,.18)';ctx.fillRect(-Wv*.205,-Hv*.54,Wv*.41,Hv*.55);

  // 3개의 데크/상부 구조물.
  const cabinG=ctx.createLinearGradient(-Wv*.28,-Hv*.78,Wv*.28,-Hv*.02);
  cabinG.addColorStop(0,'#fffafc');cabinG.addColorStop(.5,'#f1e9ee');cabinG.addColorStop(1,'#dacfd7');
  poly([[-Wv*.20,-Hv*.02],[Wv*.20,-Hv*.02],[Wv*.20,-Hv*.33],[Wv*.345,-Hv*.33],[Wv*.345,-Hv*.56],[-Wv*.345,-Hv*.56],[-Wv*.345,-Hv*.33],[-Wv*.20,-Hv*.33]],cabinG,'rgba(255,245,249,.94)');
  poly([[-Wv*.16,-Hv*.56],[Wv*.16,-Hv*.56],[Wv*.16,-Hv*.70],[-Wv*.16,-Hv*.70]],'#f7eef3','rgba(255,245,249,.94)');
  poly([[-Wv*.12,-Hv*.70],[Wv*.12,-Hv*.70],[Wv*.12,-Hv*.82],[-Wv*.12,-Hv*.82]],'#f2e8ef','rgba(255,245,249,.94)');

  // 조타실 유리.
  const glass=ctx.createLinearGradient(0,-Hv*.82,0,-Hv*.66);
  glass.addColorStop(0,'rgba(45,58,80,.96)');glass.addColorStop(1,'rgba(67,78,101,.88)');
  ctx.fillStyle=glass;ctx.fillRect(-Wv*.105,-Hv*.795,Wv*.21,Hv*.075);
  ctx.strokeStyle='rgba(227,241,255,.55)';ctx.lineWidth=1.2;
  for(let i=-2;i<=2;i++){const x=i*Wv*.035;ctx.beginPath();ctx.moveTo(x,-Hv*.792);ctx.lineTo(x,-Hv*.722);ctx.stroke()}

  // 두 개의 굴뚝과 금속 캡.
  for(const sx of [-1,1]){
    const x=sx*Wv*.105;
    const fg=ctx.createLinearGradient(x-12,-Hv*.96,x+12,-Hv*.83);
    fg.addColorStop(0,'#3b333d');fg.addColorStop(.45,'#75646b');fg.addColorStop(1,'#2d2932');
    ctx.fillStyle=fg;ctx.fillRect(x-9,-Hv*.955,18,Hv*.135);
    ctx.fillStyle='#ddd6dc';ctx.fillRect(x-11,-Hv*.955,22,5);
    ctx.fillStyle='rgba(255,255,255,.32)';ctx.fillRect(x-6,-Hv*.94,4,Hv*.09);
  }

  // 파란 난간과 기둥.
  const rail='#318fe7',railHi='#78c7ff',railDark='#1f5da8';
  const railRows=[{y:-Hv*.565,w:Wv*.64,h:22},{y:-Hv*.335,w:Wv*.66,h:22}];
  for(const row of railRows){
    ctx.fillStyle=railDark;ctx.fillRect(-row.w*.5,row.y,row.w,5);
    ctx.fillStyle=railHi;ctx.fillRect(-row.w*.5,row.y,row.w,2);
    const count=10,step=row.w/(count-1);
    for(let i=0;i<count;i++){
      const xx=-row.w*.5+i*step;
      const rg=ctx.createLinearGradient(xx-3,row.y,xx+3,row.y+row.h);
      rg.addColorStop(0,railHi);rg.addColorStop(.42,rail);rg.addColorStop(1,railDark);
      ctx.fillStyle=rg;ctx.fillRect(xx-3,row.y+4,6,row.h-4);
    }
  }

  // 팔각 창문 4개.
  for(const [wx,wy] of [[-Wv*.12,-Hv*.13],[Wv*.12,-Hv*.13],[-Wv*.12,Hv*.095],[Wv*.12,Hv*.095]]){
    ctx.fillStyle='rgba(59,57,72,.96)';shipHexWindow(wx,wy,15);ctx.fill();
    ctx.strokeStyle='rgba(253,238,244,.95)';ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle='rgba(120,168,212,.42)';ctx.lineWidth=1;shipHexWindow(wx-1.5,wy-1.5,10.5);ctx.stroke();
  }

  // 측면 구조물 / 조명.
  const sideBox=ctx.createLinearGradient(0,-Hv*.02,0,Hv*.17);
  sideBox.addColorStop(0,'#f8eef2');sideBox.addColorStop(1,'#d5c8cf');
  ctx.fillStyle=sideBox;ctx.fillRect(-Wv*.405,-Hv*.005,Wv*.12,Hv*.18);ctx.fillRect(Wv*.285,-Hv*.005,Wv*.12,Hv*.18);
  ctx.fillStyle='rgba(255,208,216,.55)';ctx.fillRect(-Wv*.39,Hv*.025,Wv*.08,Hv*.105);ctx.fillRect(Wv*.31,Hv*.025,Wv*.08,Hv*.105);

  // 중앙 용골선과 리벳 느낌.
  ctx.strokeStyle='rgba(79,68,79,.38)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-Hv*.54);ctx.lineTo(0,Hv*.33);ctx.stroke();
  for(let yy=-Hv*.49;yy<Hv*.27;yy+=Hv*.095){ctx.fillStyle='rgba(90,79,90,.3)';ctx.beginPath();ctx.arc(0,yy,1.4,0,Math.PI*2);ctx.fill()}

  // 갑판 하이라이트.
  ctx.fillStyle='rgba(255,255,255,.68)';ctx.fillRect(-Wv*.30,-Hv*.61,Wv*.60,6);ctx.fillRect(-Wv*.31,-Hv*.385,Wv*.62,6);
  ctx.restore();
}

function crossSectionHalfWidth(geom,y,station){
  const maxFront=geom.halfWidthAt(y);
  const beam=geom.beamAtStation(station)*.5;
  const localDepth=geom.depthAt(y);
  if(station>localDepth)return 0;
  // 상부 구조일수록 길이가 짧으므로 station이 뒤로 갈수록 더 빨리 사라진다.
  const remain=clamp(1-station/(localDepth||1),0,1);
  const taper=.28+.72*Math.pow(Math.sin(Math.PI*clamp(geom.station01(station),0,1)),.45);
  return Math.min(maxFront,beam)*(.72+.28*taper)*(.82+.18*remain);
}

function drawShipCrossSection(geom,station,progress){
  const {Hv}=geom;
  const yTop=-Hv*.96,yBot=Hv*.35,steps=44;
  const left=[],right=[];
  for(let i=0;i<=steps;i++){
    const y=yTop+(yBot-yTop)*(i/steps);
    const hw=crossSectionHalfWidth(geom,y,station);
    if(hw>1){left.push([-hw,y]);right.push([hw,y])}
  }
  if(left.length<2)return;
  const pts=[...left,...right.reverse()];
  const cut=ctx.createLinearGradient(0,yTop,0,yBot);
  cut.addColorStop(0,'#e4e3ec');cut.addColorStop(.42,'#c9cad6');cut.addColorStop(1,'#aeb4c2');
  poly(pts,cut,'rgba(245,244,250,.95)');

  // 실제 선박의 갑판 높이를 단면 내부에 그린다.
  const decks=[-.70,-.56,-.33,-.02,.18];
  for(const k of decks){
    const y=Hv*k,hw=crossSectionHalfWidth(geom,y,station);
    if(hw<5)continue;
    ctx.strokeStyle='rgba(76,82,100,.38)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-hw*.88,y);ctx.lineTo(hw*.88,y);ctx.stroke();
  }
  // 중앙 샤프트/복도.
  const midY=-Hv*.22,midHw=crossSectionHalfWidth(geom,midY,station);
  if(midHw>8){ctx.fillStyle='rgba(91,94,111,.16)';ctx.fillRect(-Math.min(9,midHw*.22),-Hv*.62,Math.min(18,midHw*.44),Hv*.73)}
  // 절단면 테두리 하이라이트.
  ctx.strokeStyle=`rgba(255,255,255,${.3+.5*progress})`;ctx.lineWidth=1.2;poly(pts,null,ctx.strokeStyle);
}

function drawFrontVessel(x,y,ship,scale=1,pass=0,station=null,alpha=1){
  const geom=shipGeometry(ship),{Wv,Hv}=geom;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=alpha;

  // 수면 그림자/파문. 전체 캔버스 변환에는 영향을 주지 않는다.
  ctx.save();ctx.globalAlpha=.14*(1-pass*.55);ctx.fillStyle='#283544';ctx.beginPath();ctx.ellipse(0,Hv*.39,Wv*.40,Wv*.08,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(209,229,244,.18)';ctx.lineWidth=1.4;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,Hv*.40+i*7,Wv*(.42+i*.06),Wv*(.07+i*.014),0,0,Math.PI*2);ctx.stroke()}
  ctx.restore();

  if(pass<=.001||station===null){
    drawShipFrontCore(geom,1);
    ctx.restore();return;
  }

  // 배가 화면 평면을 통과할수록 전면은 사라지고 같은 위치의 가상 종단면이 나타난다.
  const frontFade=clamp(1-pass*1.28,0,.95);
  if(frontFade>0.02)drawShipFrontCore(geom,frontFade);
  drawShipCrossSection(geom,station,pass);

  // 단면 뒤에 남아 있는 외곽을 얇은 유령선으로 남겨 이동 방향을 읽기 쉽게 한다.
  ctx.globalAlpha=.20*(1-pass);
  const sil=geom.silhouette(48);
  ctx.beginPath();sil.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();
  ctx.strokeStyle='rgba(230,239,248,.65)';ctx.lineWidth=1;ctx.stroke();
  ctx.restore();
}

function drawRoadAlignmentGuide(){
  if(sim||!isRoadTool())return;
  ctx.save();
  const roadW=MAT[tool].roadWidth;
  ctx.strokeStyle='rgba(98,225,174,.34)';
  ctx.lineWidth=1.5;ctx.setLineDash([5,9]);ctx.beginPath();
  stage.deck.forEach((p,i)=>{if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1])});ctx.stroke();ctx.setLineDash([]);
  for(let i=1;i<stage.deck.length-1;i++){
    const p=stage.deck[i],n=nodeById(i);if(n?.visible)continue;
    ctx.beginPath();ctx.arc(p[0],p[1],5.5,0,Math.PI*2);ctx.strokeStyle='rgba(240,226,130,.42)';ctx.lineWidth=1.2;ctx.stroke();
  }
  const y=guideDeckYAt(stage.deck[0][0])-27;
  ctx.font='800 9px ui-monospace,monospace';ctx.fillStyle='rgba(232,242,239,.58)';ctx.textAlign='left';
  ctx.fillText(`${MAT[tool].name.toUpperCase()} BUILD GUIDE // WIDTH ${roadW}px // SIMPLIFIED BEAM DECK`,stage.deck[0][0]+8,y);
  ctx.restore();
}
function drawSupports(){
  const ends=[{p:stage.deck[0],type:'pin'},{p:stage.deck.at(-1),type:'roller'}];
  for(const {p,type} of ends){
    const x=p[0],y=p[1];ctx.save();
    ctx.shadowColor='rgba(0,0,0,.24)';ctx.shadowBlur=9;ctx.shadowOffsetY=3;
    const cap=ctx.createLinearGradient(x-12,y-12,x+12,y+12);cap.addColorStop(0,'#ff7788');cap.addColorStop(.5,'#ef3557');cap.addColorStop(1,'#a8233c');
    ctx.fillStyle=cap;ctx.fillRect(x-11,y-11,22,22);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle='#671b2d';ctx.lineWidth=2.2;ctx.strokeRect(x-11,y-11,22,22);
    ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(x-9,y-9,18,3.5);
    ctx.fillStyle='rgba(72,18,31,.4)';ctx.fillRect(x-9,y+6,18,2.5);

    // bearing body
    const bearing=ctx.createLinearGradient(x,y+12,x,y+40);bearing.addColorStop(0,'#6f747d');bearing.addColorStop(.5,'#4d525a');bearing.addColorStop(1,'#2f343a');
    if(type==='pin')poly([[x-18,y+13],[x+18,y+13],[x,y+36]],bearing,'#24292f');
    else poly([[x-18,y+13],[x+18,y+13],[x,y+31]],bearing,'#24292f');

    // concrete/steel base plate with machined highlight
    const baseY=type==='pin'?y+36:y+31,baseW=type==='pin'?44:48;
    const plate=ctx.createLinearGradient(x-baseW/2,baseY,x+baseW/2,baseY+7);plate.addColorStop(0,'#555b64');plate.addColorStop(.48,'#858b93');plate.addColorStop(1,'#4e545c');
    ctx.fillStyle=plate;ctx.fillRect(x-baseW/2,baseY,baseW,7);ctx.strokeStyle='#30353a';ctx.lineWidth=1;ctx.strokeRect(x-baseW/2,baseY,baseW,7);
    for(const sx of [-1,1]){ctx.fillStyle='#30353a';ctx.beginPath();ctx.arc(x+sx*(baseW*.33),baseY+3.5,1.5,0,Math.PI*2);ctx.fill();}
    if(type==='roller'){
      for(const rx of [-10,10]){const rg=ctx.createRadialGradient(x+rx-1,y+39,1,x+rx,y+40,5);rg.addColorStop(0,'#ffffff');rg.addColorStop(.45,'#bfc5cb');rg.addColorStop(1,'#60676f');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(x+rx,y+40,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#3e444b';ctx.stroke();}
      ctx.fillStyle='rgba(40,45,50,.35)';ctx.fillRect(x-23,y+46,46,3);
    }
    ctx.restore();
  }
}
function deckYAt(x,analysis,deformScale){
  const broken=sim?.broken||lastBroken||new Set();const seg=findRoadSegmentAtX(x,broken);
  if(!seg)return guideDeckYAt(x);
  let ay=seg.a.y,by=seg.b.y;
  if(analysis?.ok){const ia=analysis.index.get(seg.a.id),ib=analysis.index.get(seg.b.id);if(ia!=null)ay+=analysis.U[2*ia+1]*deformScale;if(ib!=null)by+=analysis.U[2*ib+1]*deformScale}
  return ay*(1-seg.t)+by*seg.t;
}
function deckPoseAt(x,analysis,deformScale){const wheel=18;const yL=deckYAt(clamp(x-wheel,stage.deck[0][0],stage.deck.at(-1)[0]),analysis,deformScale),yR=deckYAt(clamp(x+wheel,stage.deck[0][0],stage.deck.at(-1)[0]),analysis,deformScale);return {y:(yL+yR)/2,angle:Math.atan2(yR-yL,wheel*2)}}

function drawVehicle(p,analysis,deformScale){if(stage?.vehicleHidden)return;
  const span=stage.deck.at(-1)[0]-stage.deck[0][0],travel=span+130;
  const drawAt=(worldX,alpha=1)=>{
    if(worldX<stage.deck[0][0]-80||worldX>stage.deck.at(-1)[0]+80)return;
    const px=clamp(worldX,stage.deck[0][0],stage.deck.at(-1)[0]),pose=deckPoseAt(px,analysis,deformScale),vehicleScale=stage.vehicleRenderScale||devVehicleRenderScale(stage),wheelR=(stage.vehicle==='TRUCK'?14:(stage.vehicle==='BUS'?10.5:9.5))*vehicleScale;
    const localP=(worldX-(stage.deck[0][0]-65))/travel,bounce=Math.sin(localP*travel/16)*1.2+(analysis?Math.sin(anim/10)*.15:0),y=pose.y-(stage.vehicle==='TRUCK'?40:31)*vehicleScale+bounce,rot=(localP*travel/wheelR)%(Math.PI*2);
    ctx.save();ctx.globalAlpha=alpha;drawVehicleBody(worldX,y,pose.angle*.78,rot);ctx.restore();
  };
  const x=stage.deck[0][0]-65+p*travel;drawAt(x,1);
  if(stage.doubleVehicle)drawAt(x-(stage.doubleVehicle.spacing||180),.96);
}
function drawVehicleBody(x,y,angle,rot){
  const bodyCol=stage.vehicleSkin||(stage.vehicle==='CAR'?'#53aee6':stage.vehicle==='BUS'?'#d85761':'#4ba45a');
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);const devScale=stage.vehicleRenderScale||devVehicleRenderScale(stage);ctx.scale(devScale,devScale);
  ctx.fillStyle='rgba(27,24,30,.18)';ctx.beginPath();ctx.ellipse(0,stage.vehicle==='TRUCK'?23:18,stage.vehicle==='TRUCK'?44:36,7,0,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=2.2;ctx.strokeStyle='#4a4453';
  const bodyGrad=ctx.createLinearGradient(-40,-18,40,14);bodyGrad.addColorStop(0,shade(bodyCol,20));bodyGrad.addColorStop(.5,bodyCol);bodyGrad.addColorStop(1,shade(bodyCol,-18));ctx.fillStyle=bodyGrad;
  if(stage.vehicle==='BUS')drawBusVehicle(rot);else if(stage.vehicle==='TRUCK')drawTruckVehicle(rot);else drawCarVehicle(rot);ctx.restore();
}

function drawCarVehicle(rot){
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-31,6);ctx.lineTo(-26,-10);ctx.quadraticCurveTo(-16,-20,2,-20);ctx.quadraticCurveTo(16,-20,25,-11);ctx.lineTo(31,-5);ctx.lineTo(31,6);ctx.closePath();ctx.fill();ctx.stroke();
  const glass=ctx.createLinearGradient(-12,-18,18,-6);glass.addColorStop(0,'#eef9fd');glass.addColorStop(.55,'#b9d9e5');glass.addColorStop(1,'#7da8b8');
  poly([[-16,-10],[-6,-18],[7,-18],[11,-10]],glass,'rgba(75,91,104,.35)');
  poly([[12,-10],[19,-14],[26,-10],[26,-6],[12,-6]],'#c6e1ea','rgba(75,91,104,.35)');
  ctx.fillStyle='rgba(255,255,255,.27)';ctx.fillRect(-24,-3,54,2.2);
  ctx.strokeStyle='rgba(58,61,70,.45)';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(1,-10);ctx.lineTo(2,5);ctx.moveTo(-15,-8);ctx.lineTo(-18,4);ctx.stroke();
  ctx.fillStyle='rgba(40,43,50,.55)';roundRect(-3,-1,6,2,1);ctx.fill();
  ctx.fillStyle='#e6c45d';ctx.fillRect(24,-2,5,3.5);ctx.fillStyle='#f5f5f4';ctx.fillRect(-30,-1,4,3.5);
  ctx.fillStyle='rgba(38,42,47,.72)';ctx.fillRect(27,3,4,2);ctx.fillRect(-31,3,4,2);
  drawWheel(-18,8,9.5,rot);drawWheel(18,8,9.5,rot);ctx.restore();
}

function drawBusVehicle(rot){
  ctx.save();roundRect(-38,-23,76,31,7);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ece9e9';ctx.fillRect(-38,-3,76,11);
  const glass=ctx.createLinearGradient(0,-19,0,-7);glass.addColorStop(0,'#e8f7fb');glass.addColorStop(1,'#8cb7c6');
  ctx.fillStyle=glass;
  for(let i=-28;i<24;i+=13){roundRect(i,-18,10,9,2);ctx.fill();ctx.strokeStyle='rgba(72,84,93,.28)';ctx.lineWidth=.6;ctx.stroke();}
  ctx.fillStyle='#bddce7';roundRect(23,-16,10,18,2);ctx.fill();ctx.strokeStyle='rgba(72,84,93,.34)';ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(-33,-6,62,2.5);
  ctx.strokeStyle='rgba(62,58,68,.46)';ctx.lineWidth=.8;for(let x=-31;x<=18;x+=13){ctx.beginPath();ctx.moveTo(x,-18);ctx.lineTo(x,-4);ctx.stroke();}
  ctx.strokeStyle='#6a6271';ctx.lineWidth=1.4;ctx.strokeRect(-18,-28,36,4);ctx.fillStyle='#ddb35d';ctx.fillRect(-10,-29,20,2.4);
  ctx.fillStyle='#f6d05e';ctx.fillRect(34,-1,3,4);ctx.fillStyle='#d55e62';ctx.fillRect(-38,-1,3,4);
  ctx.fillStyle='rgba(44,46,52,.55)';ctx.fillRect(-5,2,14,1.4);
  drawWheel(-22,9,10.5,rot);drawWheel(22,9,10.5,rot);ctx.restore();
}

function drawTruckVehicle(rot){
  ctx.save();roundRect(-31,-18,62,24,6);ctx.fill();ctx.stroke();roundRect(-8,-33,26,16,5);ctx.fill();ctx.stroke();
  const glass=ctx.createLinearGradient(-3,-29,12,-20);glass.addColorStop(0,'#edf9fc');glass.addColorStop(1,'#86b1c0');ctx.fillStyle=glass;roundRect(-3,-29,15,9,2);ctx.fill();ctx.strokeStyle='rgba(67,79,89,.32)';ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(-26,-7,49,2.5);
  ctx.fillStyle='#d6d8de';ctx.fillRect(-34,1,68,5);ctx.fillStyle='#717780';ctx.fillRect(-32,3,64,2);
  ctx.strokeStyle='rgba(45,49,55,.48)';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(-8,-15);ctx.lineTo(-8,4);ctx.moveTo(19,-15);ctx.lineTo(19,4);ctx.stroke();
  ctx.fillStyle='rgba(35,38,42,.72)';for(let x=-2;x<14;x+=4)ctx.fillRect(x,-15,2,4);
  ctx.fillStyle='#f4d05d';ctx.fillRect(27,-3,4,4);ctx.fillStyle='#e8ecef';ctx.fillRect(-31,-3,4,4);
  drawWheel(-20,9,14,rot);drawWheel(20,9,14,rot);ctx.restore();
}

function drawWheel(x,y,r,rot){
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  const tire=ctx.createRadialGradient(-r*.18,-r*.2,r*.12,0,0,r);tire.addColorStop(0,'#55545d');tire.addColorStop(.42,'#35343b');tire.addColorStop(1,'#1d1d22');
  ctx.fillStyle=tire;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  // tire sidewall + tread notches
  ctx.strokeStyle='rgba(8,8,10,.72)';ctx.lineWidth=1.15;ctx.beginPath();ctx.arc(0,0,r*.86,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<12;i++){const a=(Math.PI*2/12)*i,ri=r*.83,ro=r*.98;ctx.lineWidth=1.05;ctx.beginPath();ctx.moveTo(Math.cos(a-.06)*ri,Math.sin(a-.06)*ri);ctx.lineTo(Math.cos(a+.04)*ro,Math.sin(a+.04)*ro);ctx.stroke();}
  const rim=ctx.createRadialGradient(-r*.12,-r*.15,1,0,0,r*.7);rim.addColorStop(0,'#f3f5f6');rim.addColorStop(.4,'#c2c7cc');rim.addColorStop(1,'#666c73');
  ctx.fillStyle=rim;ctx.beginPath();ctx.arc(0,0,r*.66,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3f444a';ctx.beginPath();ctx.arc(0,0,r*.48,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#c6cbd0';ctx.lineWidth=1.2;
  for(let i=0;i<6;i++){const a=(Math.PI*2/6)*i;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.18,Math.sin(a)*r*.18);ctx.lineTo(Math.cos(a)*r*.46,Math.sin(a)*r*.46);ctx.stroke();}
  ctx.beginPath();ctx.arc(0,0,r*.14,0,Math.PI*2);ctx.fillStyle='#9aa0a6';ctx.fill();ctx.strokeStyle='#555b61';ctx.lineWidth=.7;ctx.stroke();
  ctx.restore();
}

function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}




function updateMeasureTag(){
  const el=$('#measureTag');if(!el)return;
  if(!measureMode){el.classList.remove('show');el.innerHTML='';return}
  if(!measureA){el.innerHTML='<b>MEASURE //</b> 첫 번째 관절 선택';el.classList.add('show');return}
  if(!measureB){el.innerHTML=`<b>MEASURE //</b> A (${Math.round(measureA.x)}, ${Math.round(measureA.y)}) → 두 번째 관절 선택`;el.classList.add('show');return}
  const L=dist(measureA,measureB),dx=measureB.x-measureA.x,dy=measureB.y-measureA.y;
  el.innerHTML=`<b>MEASURE //</b> L ${L.toFixed(1)} · Δx ${Math.round(dx)} · Δy ${Math.round(dy)}`;el.classList.add('show');
}
function drawMeasurement(){
  if(!measureA)return;
  const a=measureA,b=measureB||pointerWorld;if(!b)return;
  ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#62e1ae';ctx.lineWidth=1.6;line(a,b);ctx.setLineDash([]);
  for(const p of [a,b]){ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.strokeStyle='rgba(98,225,174,.72)';ctx.lineWidth=1.4;ctx.stroke()}
  const L=dist(a,b),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const label=`${L.toFixed(1)}`;ctx.font='700 10px ui-monospace,SFMono-Regular,monospace';const w=ctx.measureText(label).width+14;ctx.fillStyle='#091013';ctx.strokeStyle='#355448';ctx.lineWidth=1;ctx.fillRect(mx-w/2,my-26,w,18);ctx.strokeRect(mx-w/2,my-26,w,18);ctx.fillStyle='#78efc0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,mx,my-17);ctx.restore();
}
function toggleMeasure(){
  if(!isAdvancedUI()&&!tutorialMode){toast('MEASURE // ADVANCED MODE에서 사용할 수 있습니다');return}
  if(sim){toast('TEST 중에는 측정 모드를 바꿀 수 없습니다');return}
  measureMode=!measureMode;measureA=null;measureB=null;selected=null;$('#measureBtn').classList.toggle('isOn',measureMode);updateMeasureTag();updateModeBadge();draw();toast(measureMode?'MEASURE 모드 · 두 관절을 선택하세요':'MEASURE 모드 종료');
}
function scanStructure(){
  if(!isAdvancedUI()&&!tutorialMode){toast('SCAN // ADVANCED MODE에서 사용할 수 있습니다');return}
  if(sim){toast('TEST가 끝난 뒤 SCAN을 사용할 수 있습니다');return}
  if(!stage.sandbox&&totalCost>stage.budget*2){toast('기본 예산의 200%를 초과했습니다');return}
  selected=null;measureA=null;measureB=null;updateMeasureTag();
  const x=(stage.deck[0][0]+stage.deck.at(-1)[0])/2;
  const a=assemble(x,new Set());
  if(!a.ok){currentAnalysis={ok:false};lastFullAnalysis=null;setCoach('unstable');toast('SCAN // 구조 불안정');draw();return}
  lastFullAnalysis=a;currentAnalysis={ok:true,maxRatio:a.maxRatio,maxDefl:a.maxDefl};stressMode=true;loadPathMode=true;$('#stressBtn').classList.add('isOn');$('#loadPathBtn').classList.add('isOn');
  setCoach('analysis',{analysis:a,source:'SCAN // CENTER LOAD CASE'});
  toast('SCAN COMPLETE');draw();
}

function toggleGrid(){gridVisible=!gridVisible;saveUIPref('grid',gridVisible);$('#gridBtn').classList.toggle('toggled',gridVisible);draw();toast(gridVisible?'격자 표시 ON':'격자 표시 OFF')}
function toggleSnap(){snapEnabled=!snapEnabled;saveUIPref('snap',snapEnabled);$('#snapBtn').classList.toggle('toggled',snapEnabled);updateModeBadge();draw();toast(snapEnabled?'25 단위 격자 스냅 ON':'정밀 배치 모드 · 5 단위')}
function toggleLoadPath(){loadPathMode=!loadPathMode;$('#loadPathBtn').classList.toggle('isOn',loadPathMode);draw();toast(loadPathMode?(isAdvancedUI()?'하중·지점 반력 표시 ON':'하중 경로 표시 ON · 지점 반력은 Advanced Mode에서 표시'):'하중 경로 표시 OFF')}
function updateSpeedButton(){const b=$('#speedBtn');if(!b)return;const i=b.querySelector('i');if(i)i.textContent=`${simSpeed}×`;else b.textContent=`${simSpeed}×`}
function cycleSimSpeed(){if(sim){toast('TEST가 끝난 뒤 속도를 바꿀 수 있습니다');return}const speeds=[.5,1,1.5,2];let i=speeds.indexOf(simSpeed);simSpeed=speeds[(i+1)%speeds.length];saveUIPref('speed',simSpeed);updateSpeedButton();toast(`시험 속도 ${simSpeed}×`)}
async function toggleFullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){toast('이 브라우저에서는 전체 화면을 사용할 수 없습니다')}}
// 화면 이동/확대축소: 휠은 마우스 위치를 기준으로 줌, 버튼/키보드는 카메라 이동
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomCamera(e.deltaY<0?1.12:.89,{x:e.clientX,y:e.clientY})},{passive:false});
$('#panUp').onclick=()=>panCamera(0,-70); $('#panDown').onclick=()=>panCamera(0,70); $('#panLeft').onclick=()=>panCamera(-90,0); $('#panRight').onclick=()=>panCamera(90,0);
$('#zoomIn').onclick=()=>zoomCamera(1.15); $('#zoomOut').onclick=()=>zoomCamera(.87); $('#resetView').onclick=resetCamera; $('#gridBtn').onclick=toggleGrid; $('#snapBtn').onclick=toggleSnap; $('#speedBtn').onclick=cycleSimSpeed; $('#fullBtn').onclick=toggleFullscreen;
$('#sfxBtn').onclick=()=>{sfxEnabled=!sfxEnabled;saveUIPref('sfx',sfxEnabled);updateSfxUI();if(sfxEnabled){ensureAudio();playSfx('select')}toast(sfxEnabled?'INTERACTION SFX // ON':'INTERACTION SFX // OFF')};updateSfxUI(); $('#scanBtn').onclick=scanStructure; $('#measureBtn').onclick=toggleMeasure;
$('#coachCollapse').onclick=()=>{const p=$('#coachPanel');p.classList.toggle('collapsed');const c=p.classList.contains('collapsed');const button=$('#coachCollapse'),label=c?'구조 분석 펼치기':'구조 분석 접기';button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-expanded',String(!c))};
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select,[contenteditable=\"true\"]'))return;
  if(!gameplayInputEnabled())return;
  const k=e.key;
  if(k==='Escape'){
    if(ui.result?.classList.contains('show')){ui.result.classList.remove('show');resumeClockAfterFailedResult();return}
    if(ui.intro?.classList.contains('show')){ui.intro.classList.remove('show');return}
    if(ui.library?.classList.contains('show')){ui.library.classList.remove('show');return}
    if(ui.sandbox?.classList.contains('show')){ui.sandbox.classList.remove('show');return}
    if($('#uiSettingsModal')?.classList.contains('show')){$('#uiSettingsModal').classList.remove('show');return}
    if(selected||measureMode||measureA||measureB){selected=null;measureMode=false;measureA=null;measureB=null;$('#measureBtn')?.classList.remove('isOn');updateMeasureTag?.();updateModeBadge();updateCanvasCursor(pointerWorld);draw();toast('현재 작업을 취소했습니다');return}
  }
  const shortcut=e.ctrlKey||e.metaKey;
  if(shortcut && !e.altKey){
    if(k.toLowerCase()==='z' && !e.shiftKey){e.preventDefault();undoAction();return;}
    if(k.toLowerCase()==='y' || (k.toLowerCase()==='z'&&e.shiftKey)){e.preventDefault();redoAction();return;}
  }
  if(!shortcut&&['1','2','3','4','5','6','7'].includes(k)){
    e.preventDefault();
    if(tutorialMode){toast('TUTORIAL // 숫자키 도구 전환은 잠겨 있습니다');return;}
    if(!isAdvancedUI()&&Number(k)>=6){toast('MOVE / DELETE // Advanced Mode에서 표시됩니다');return;}
    const b=$(`.toolBtn[data-tool="${['wood','steel','cable','road','roadHeavy','move','delete'][Number(k)-1]}"]`);b?.click();return;
  }
  if(!shortcut&&k.toLowerCase()==='t'){e.preventDefault();startSimulation();return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','=','-','0'].includes(k))e.preventDefault();
  if(k==='ArrowUp')panCamera(0,-55);else if(k==='ArrowDown')panCamera(0,55);else if(k==='ArrowLeft')panCamera(-70,0);else if(k==='ArrowRight')panCamera(70,0);else if(k==='+'||k==='=')zoomCamera(1.12);else if(k==='-')zoomCamera(.89);else if(k==='0')resetCamera();else if(k.toLowerCase()==='g')toggleGrid();else if(k.toLowerCase()==='m')toggleSnap();else if(k.toLowerCase()==='l')toggleLoadPath();else if(k.toLowerCase()==='s'){if(isAdvancedUI()||tutorialMode)scanStructure();else toast('SCAN // Advanced Mode에서 활성화됩니다')}else if(k.toLowerCase()==='r'){if(isAdvancedUI()||tutorialMode)toggleMeasure();else toast('MEASURE // Advanced Mode에서 활성화됩니다')}else if(k.toLowerCase()==='f')toggleFullscreen();
});

$$('.toolBtn').forEach(b=>b.addEventListener('click',()=>{if(sim)return;playSfx('select');if(measureMode){measureMode=false;measureA=null;measureB=null;$('#measureBtn').classList.remove('isOn');updateMeasureTag();}tool=b.dataset.tool;selected=null;dragging=null;$$('.toolBtn').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});updateModeBadge();updateCanvasCursor(pointerWorld);draw()}));
$$('.stageBtn').forEach((b,i)=>b.addEventListener('click',()=>{if(sim)return;const level=levelForStageIndex(i);if(level){if(!isLevelUnlocked(level.id)){toast('LEVEL LOCKED');return}openLevelBriefing(level.id)}else resetStage(i)}));
$('#resetBtn').onclick=()=>{if(sim)stopSimulation();resetStage(stageIndex);toast('스테이지를 초기화했습니다')};
$('#quickResetBtn').onclick=()=>$('#resetBtn')?.click();
$('#undoBtn').onclick=undoAction; $('#redoBtn').onclick=redoAction;
$('#stressBtn').onclick=()=>{if(!isAdvancedUI()){toast('STRESS VIEW // ADVANCED MODE에서 사용할 수 있습니다');return}stressMode=!stressMode;$('#stressBtn').classList.toggle('isOn',stressMode);draw();toast(stressMode?'응력 표시 ON':'응력 표시 OFF')}; $('#loadPathBtn').onclick=toggleLoadPath;
$('#uiModeQuickBtn').onclick=()=>setUIMode(isAdvancedUI()?'basic':'advanced');
$('#uiSettingsBtn').onclick=()=>{$('#uiSettingsModal')?.classList.add('show');updateUIModeUI();updateInspectorModeUI()};
$('#inspectorModeBtn').onclick=()=>setInspectorMode(inspectorMode==='basic'?'detail':'basic');
$('#closeUISettings').onclick=()=>$('#uiSettingsModal')?.classList.remove('show');
$$('.uiModeChoice').forEach(b=>b.onclick=()=>setUIMode(b.dataset.uiMode));
$$('.inspectorModeChoice').forEach(b=>b.onclick=()=>setInspectorMode(b.dataset.inspectorMode));
ui.test.onclick=()=>startSimulation(false);
$('#helpBtn').onclick=()=>ui.intro.classList.add('show');
$('#startBtn').onclick=()=>ui.intro.classList.remove('show');
$('#libraryBtn').onclick=()=>ui.library.classList.add('show');
$('#closeLibrary').onclick=()=>ui.library.classList.remove('show');

// TRUSS EDUCATION access + navigation
const toolsMenuBtn=$('#toolsMenuBtn'),topToolsMenu=$('#topToolsMenu'),topToolsWrap=$('#topToolsWrap');
function setTopToolsOpen(open){if(!toolsMenuBtn||!topToolsMenu)return;topToolsMenu.hidden=!open;toolsMenuBtn.classList.toggle('open',open);toolsMenuBtn.setAttribute('aria-expanded',String(open))}
toolsMenuBtn?.addEventListener('click',e=>{e.stopPropagation();setTopToolsOpen(topToolsMenu.hidden)});
topToolsMenu?.addEventListener('click',e=>{if(e.target.closest('.topMenuItem'))setTopToolsOpen(false)});
document.addEventListener('pointerdown',e=>{if(topToolsWrap&&!topToolsWrap.contains(e.target))setTopToolsOpen(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setTopToolsOpen(false)});
$('#eduTopBtn').onclick=()=>openEducationCenter(0);
$('#titleEduBtn').onclick=()=>openEducationCenter(Number(localStorage.getItem('trusslab-education-last-module')||0));
$('#endingLabBtn').onclick=leaveEducationToLab;
$('#endingEduBtn').onclick=()=>openEducationCenter(0);
$('#endingTitleBtn').onclick=()=>{$('#endingScreen').hidden=true;$('#educationScreen').hidden=true;runLoadingSequence({title:'RETURNING TO MAIN TITLE',statuses:['[01] SAVE COMPLETION','[02] CLOSE EDUCATION','[03] RESET TITLE SYSTEM','[04] VERIFY PROFILE','[05] TITLE READY'],duration:800,hint:'TRUSS LAB'},()=>{updateEducationAccess();$('#titleScreen').hidden=false})};

const TUTORIAL_TRUSS_TOPS=[[350,250],[525,250],[675,250],[850,250]];
const STAGE_TUTORIAL_STEPS=[
  {key:'camera',title:'01 · 방향키로 카메라 이동',text:'키보드의 <strong>↑ ↓ ← → 방향키</strong> 중 하나를 눌러 화면을 직접 움직여 보세요. 이 단계에서는 캔버스에 자재를 설치할 수 없습니다.',hint:'카메라 // 카메라 조작만 활성화되어 있습니다.',mini:'camera',ui:'camera'},
  {key:'grid',title:'02 · 격자 표시 켜기',text:'왼쪽 카메라 패널의 <strong>⌗ 격자</strong> 버튼을 누르거나 키보드 <strong>G</strong>를 눌러 격자를 켜세요. 아직 건설 입력은 잠겨 있습니다.',hint:'격자 // 격자는 관절 높이와 패널 간격을 맞추는 기준선입니다.',mini:'grid',ui:'grid'},
  {key:'snap',title:'03 · 스냅 설정 켜기',text:'<strong>⊕ 스냅</strong> 버튼 또는 <strong>M</strong> 키를 눌러 스냅을 켜세요. 이 단계가 끝나기 전까지 자재 배치는 차단됩니다.',hint:'스냅 // 켜짐 상태에서는 25 단위 격자에 관절이 정렬됩니다.',mini:'snap',ui:'snap'},
  {key:'roadTool',title:'04 · 일반 도로 도구 선택',text:'아래 툴바에서 <strong>일반도로</strong>를 선택하세요. 도구를 고르는 동안에는 아직 캔버스 건설이 시작되지 않습니다.',hint:'도로 // 도로도 직접 만들어야 하는 구조 부재입니다.',mini:'road',tool:'road'},
  {key:'support',title:'05 · 왼쪽 지지점 선택',text:'이제 건설 입력이 열렸습니다. 왼쪽 빨간 <strong>핀 지지점</strong>을 클릭해 도로의 시작점을 선택하세요.',hint:'입력 // 첫 클릭은 시작 관절을 선택합니다.',mini:'start',canvas:[280,390],tool:'road'},
  {key:'roadComplete',title:'06 · 도로를 끝까지 직접 연결',text:'점선 가이드 위의 <strong>정해진 도로 기준점만 차례대로</strong> 클릭해 왼쪽 지지점부터 오른쪽 지지점까지 정확히 4개 도로 패널을 완성하세요. 가이드 밖의 임의 도로는 인정되지 않습니다.',hint:'바닥판 // 0→1→2→3→4의 정확한 4개 가이드 패널과 일반 도로 사용 여부를 검사합니다.',mini:'deck',tool:'road'},
  {key:'woodTool',title:'07 · 목재 구조재 선택',text:'도로가 완성됐습니다. <strong>목재</strong>를 선택하세요. 다음 단계에서 청록색 설계도를 따라 완성형 워런 트러스를 직접 건설합니다.',hint:'재료 // 목재 최대 길이 270. 이 훈련장 치수는 목재로 완성할 수 있습니다.',mini:'tool',tool:'wood'},
  {key:'topChord',title:'08 · 완성형 워런 트러스 건설',text:'청록색 점선 설계도와 똑같이 <strong>상부 관절 4개, 상부 코드, 모든 대각재</strong>를 직접 연결하세요. 완전한 트러스와 구조 안정성이 모두 확인되면 자동으로 다음 단계로 넘어갑니다.',hint:'설계도 // 한 번에 이어지지 않는 부재는 우클릭으로 연속 설치를 종료한 뒤 다른 관절에서 다시 시작하세요.',mini:'triangle',tool:'wood',blueprint:true},
  {key:'rightClick',title:'09 · 우클릭으로 연속 설치 종료',text:'완성형 트러스가 만들어졌습니다. 캔버스에서 <strong>마우스 오른쪽 버튼</strong>을 눌러 연속 설치를 종료하세요.',hint:'입력 // 우클릭 = 현재 설치 연결 종료.',mini:'chain',tool:'wood',blueprint:true},
  {key:'moveTool',title:'10 · GRAB / 이동 도구 선택',text:'훈련용으로 <strong>상부 관절 하나가 설계선에서 살짝 벗어나 있습니다.</strong> 아래의 <strong>이동 ✥</strong> 도구를 선택해서 위치 보정 준비를 하세요.',hint:'이동 // 어긋난 관절을 원래 설계 위치로 되돌리는 훈련입니다.',mini:'move',tool:'move',blueprint:true},
  {key:'dragNode',title:'11 · 어긋난 관절을 목표 위치로 복원',text:'설계선에서 벗어난 상부 관절을 드래그해 <strong>청록색 목표 링의 정확한 위치</strong>로 다시 옮기세요. 목표 위치에 충분히 가까워져야 완료됩니다.',hint:'이동 // 단순히 움직이기만 해서는 완료되지 않습니다. 목표 좌표로 복원해야 합니다.',mini:'move',tool:'move',blueprint:true},
  {key:'test',title:'12 · 완성된 트러스 TEST',text:'도로와 워런 트러스가 모두 준비됐습니다. 오른쪽 위 <strong>▶ 시험</strong>를 직접 눌러 차량이 다리를 끝까지 통과하는지 확인하세요. 차량 주행이 실제로 끝난 뒤 튜토리얼이 완료됩니다.',hint:'준비 완료 // 시험 버튼을 누르면 실제 차량 주행 시뮬레이션이 실행됩니다.',mini:'test',ui:'test',blueprint:true}
];

function tutorialMiniSvg(type){
  const common='<svg viewBox="0 0 120 90" aria-hidden="true">',end='</svg>';
  if(type==='camera')return common+'<path d="M60 18v54M33 45h54" stroke="#65737b" stroke-width="3"/><path d="M60 15l-6 9h12zM60 75l-6-9h12zM30 45l9-6v12zM90 45l-9-6v12z" fill="#62e1ae"/><text x="24" y="86" fill="#d7b94d" font-size="8" font-family="monospace">ARROW KEYS</text>'+end;
  if(type==='grid')return common+'<g stroke="#52616a" stroke-width="1">'+[25,45,65,85].map(x=>`<path d="M${x} 18V72"/>`).join('')+[25,45,65].map(y=>`<path d="M18 ${y}H102"/>`).join('')+'</g><rect x="39" y="39" width="12" height="12" fill="#62e1ae"/><text x="29" y="84" fill="#d7b94d" font-size="8" font-family="monospace">GRID ON</text>'+end;
  if(type==='snap')return common+'<g stroke="#48565e"><path d="M30 20V70M60 20V70M90 20V70M20 30H100M20 60H100"/></g><circle cx="60" cy="60" r="8" fill="#f0d84b" stroke="#10161a" stroke-width="3"/><path d="M39 42L58 58" stroke="#62e1ae" stroke-width="3" stroke-dasharray="4 3"/><text x="25" y="84" fill="#d7b94d" font-size="8" font-family="monospace">SNAP / GRID</text>'+end;
  if(type==='road')return common+'<path d="M15 58H105" stroke="#66524a" stroke-width="14" stroke-linecap="round"/><path d="M15 55H105" stroke="#d6c8bb" stroke-width="2" opacity=".55"/><circle class="support" cx="17" cy="58" r="6"/><circle class="support" cx="103" cy="58" r="6"/>'+end;
  if(type==='tool')return common+'<rect x="16" y="22" width="88" height="46" fill="#12191d" stroke="#46525b"/><path class="solid" d="M30 58L60 31L91 58"/><circle class="node" cx="30" cy="58" r="5"/><circle class="node" cx="60" cy="31" r="5"/><circle class="node" cx="91" cy="58" r="5"/>'+end;
  if(type==='start')return common+'<path class="solid" d="M18 65H104"/><circle class="support" cx="22" cy="65" r="7"/><path class="cursor" d="M39 47l15 8-8 3 4 10-5 2-4-10-6 6z"/>'+end;
  if(type==='deck')return common+'<path class="solid" d="M14 64H106"/><g fill="#f0d84b" stroke="#11171a" stroke-width="2"><circle cx="16" cy="64" r="4"/><circle cx="45" cy="64" r="4"/><circle cx="74" cy="64" r="4"/><circle cx="104" cy="64" r="4"/></g><path class="ghost" d="M16 64H104"/>'+end;
  if(type==='node')return common+'<path class="solid" d="M15 67H105"/><circle class="node" cx="48" cy="67" r="5"/><circle class="node" cx="76" cy="34" r="5"/><path class="cursor" d="M82 17l15 8-8 3 4 10-5 2-4-10-6 6z"/>'+end;
  if(type==='triangle')return common+'<path class="solid" d="M18 68H102M28 68L60 30L94 68"/><circle class="node" cx="28" cy="68" r="5"/><circle class="node" cx="60" cy="30" r="5"/><circle class="node" cx="94" cy="68" r="5"/>'+end;
  if(type==='chain')return common+'<path class="solid" d="M14 68L38 37L62 68L86 37L108 68"/><text x="20" y="84" fill="#d7b94d" font-size="8" font-family="monospace">RIGHT CLICK</text>'+end;
  if(type==='move')return common+'<circle class="node" cx="47" cy="52" r="7"/><path d="M57 48h34m-8-7l8 7-8 7" stroke="#62e1ae" stroke-width="3" fill="none"/><path class="cursor" d="M30 28l15 8-8 3 4 10-5 2-4-10-6 6z"/><text x="34" y="82" fill="#d7b94d" font-size="8" font-family="monospace">GRAB / MOVE</text>'+end;
  return common+'<path class="solid" d="M12 66H108M20 66L45 37L70 66L94 37"/><rect x="45" y="54" width="23" height="10" fill="#53aee6"/><circle cx="50" cy="66" r="4" fill="#2d3337"/><circle cx="64" cy="66" r="4" fill="#2d3337"/>'+end;
}

function tutorialCurrentStep(){return STAGE_TUTORIAL_STEPS[tutorialStep]||null}
function tutorialCanvasInputAllowed(){
  if(!tutorialMode)return true;
  const key=tutorialCurrentStep()?.key;
  return ['support','roadComplete','topChord','dragNode'].includes(key);
}
function tutorialTopNodes(){
  const pool=nodes.filter(n=>n.user&&!n.roadNode&&!n.deck&&!n.support);
  const used=new Set(),out=[];
  for(const [tx,ty] of TUTORIAL_TRUSS_TOPS){
    let best=null,bd=75;
    for(const n of pool){if(used.has(n.id))continue;const d=Math.hypot(n.x-tx,n.y-ty);if(d<bd){bd=d;best=n}}
    if(!best)return null;used.add(best.id);out.push(best);
  }
  return out;
}
function tutorialMemberExists(a,b,mat='wood'){
  return members.some(m=>m.user&&m.mat===mat&&memberKey(m.a,m.b)===memberKey(a,b));
}
function tutorialTopChordReady(){
  const t=tutorialTopNodes();if(!t)return false;
  if(!tutorialMemberExists(0,t[0].id))return false;
  for(let i=0;i<t.length-1;i++)if(!tutorialMemberExists(t[i].id,t[i+1].id))return false;
  return true;
}
function tutorialPerfectTruss(){
  if(!tutorialRoadConnected())return false;
  const t=tutorialTopNodes();if(!t||!tutorialTopChordReady())return false;
  for(let i=0;i<4;i++){
    if(!tutorialMemberExists(t[i].id,i)||!tutorialMemberExists(t[i].id,i+1))return false;
  }
  if(triangleCount()<4)return false;
  try{return !!assemble((stage.deck[0][0]+stage.deck.at(-1)[0])/2,new Set()).ok}catch(_){return false}
}
function prepareTutorialMoveChallenge(){
  const t=tutorialTopNodes();if(!t||tutorialMoveTarget)return;
  const n=t[1]||t[0];
  const target=TUTORIAL_TRUSS_TOPS[1]||TUTORIAL_TRUSS_TOPS[0];
  tutorialMoveTarget={id:n.id,x:target[0],y:target[1]};
  n.x=target[0]+50;n.y=target[1]+25;
  tutorialFlags.moved=false;selected=null;currentAnalysis=null;lastFullAnalysis=null;
}

function drawTutorialBlueprint(){
  if(!tutorialMode||tutorialTestRunning||!tutorialCurrentStep()?.blueprint)return;
  const pts=TUTORIAL_TRUSS_TOPS.map(([x,y])=>({x,y}));
  ctx.save();ctx.lineWidth=2;ctx.setLineDash([8,7]);ctx.strokeStyle='rgba(98,225,174,.58)';ctx.fillStyle='rgba(98,225,174,.16)';
  for(let i=0;i<4;i++){
    const a={x:stage.deck[i][0],y:stage.deck[i][1]},b={x:stage.deck[i+1][0],y:stage.deck[i+1][1]},t=pts[i];
    line(a,t);line(t,b);
  }
  for(let i=0;i<3;i++)line(pts[i],pts[i+1]);
  ctx.setLineDash([]);
  for(const p of pts){ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(98,225,174,.9)';ctx.stroke()}
  if(tutorialMoveTarget&&['moveTool','dragNode','test'].includes(tutorialCurrentStep()?.key)){
    ctx.setLineDash([4,4]);ctx.lineWidth=2.5;ctx.strokeStyle='rgba(215,185,77,.95)';ctx.beginPath();ctx.arc(tutorialMoveTarget.x,tutorialMoveTarget.y,16,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(215,185,77,.95)';ctx.font='800 9px monospace';ctx.fillText('ALIGN',tutorialMoveTarget.x,tutorialMoveTarget.y-22);
  }
  ctx.font='800 10px var(--mono), monospace';ctx.fillStyle='rgba(98,225,174,.9)';ctx.textAlign='center';ctx.fillText('TARGET WARREN TRUSS',600,220);ctx.restore();
}
function tutorialRoadGuideSegmentOK(a,b){
  if(!tutorialMode||tutorialCurrentStep()?.key!=='roadComplete')return true;
  if(tool!=='road')return false;
  const ia=Number(a?.id),ib=Number(b?.id);
  if(!Number.isInteger(ia)||!Number.isInteger(ib))return false;
  if(ia<0||ib<0||ia>=stage.deck.length||ib>=stage.deck.length)return false;
  return Math.abs(ia-ib)===1;
}
function tutorialRoadGuideExact(){
  if(!tutorialMode)return false;
  const roads=members.filter(m=>m.user&&m.road);
  if(roads.length!==stage.deck.length-1)return false;
  if(roads.some(m=>m.mat!=='road'))return false;
  for(let i=0;i<stage.deck.length-1;i++){
    if(!roads.some(m=>memberKey(m.a,m.b)===memberKey(i,i+1)))return false;
  }
  // No off-guide road helper nodes may remain in the tutorial deck.
  if(nodes.some(n=>n.user&&n.roadNode))return false;
  return true;
}
function tutorialRoadConnected(){
  if(!tutorialMode)return false;
  return tutorialRoadGuideExact();
}
function tutorialFreeNode(){return nodes.find(n=>n.user&&!n.deck&&!n.support)}
function clearTutorialFocus(){document.querySelectorAll('.tutorialFocus,.tutorialFocusAmber').forEach(el=>el.classList.remove('tutorialFocus','tutorialFocusAmber'));const m=$('#tutorialCanvasMarker');if(m)m.hidden=true}
function positionTutorialMarker(world){
  const marker=$('#tutorialCanvasMarker');if(!marker||!world)return;
  const p=worldToScreen({x:world[0],y:world[1]}),r=canvas.getBoundingClientRect(),main=document.querySelector('.main').getBoundingClientRect();
  marker.style.left=(r.left-main.left+p.x)+'px';marker.style.top=(r.top-main.top+p.y)+'px';marker.hidden=false;
}
function setTutorialStepUI(s){
  $$('.toolBtn').forEach(b=>b.classList.toggle('tutorialStepHidden',!s.tool||b.dataset.tool!==s.tool));
  const view=$('.viewControls'),pan=$('.panPad'),zoom=$('.zoomStack'),extra=$('.viewExtraStack');
  const showView=['camera','grid','snap'].includes(s.ui);
  view?.classList.toggle('tutorialStepHidden',!showView);
  pan?.classList.toggle('tutorialStepHidden',s.ui!=='camera');
  zoom?.classList.add('tutorialStepHidden');
  extra?.classList.toggle('tutorialStepHidden',!['grid','snap'].includes(s.ui));
  $('#gridBtn')?.classList.toggle('tutorialStepHidden',s.ui!=='grid');
  $('#snapBtn')?.classList.toggle('tutorialStepHidden',s.ui!=='snap');
  ui.test?.classList.toggle('tutorialStepHidden',s.ui!=='test');
  if(s.tool){const el=$(`.toolBtn[data-tool="${s.tool}"]`);el?.classList.add('tutorialFocus')}
  if(s.ui==='grid')$('#gridBtn')?.classList.add('tutorialFocus');
  if(s.ui==='snap')$('#snapBtn')?.classList.add('tutorialFocus');
  if(s.ui==='test')ui.test?.classList.add('tutorialFocus');
}
function renderStageTutorialStep(){
  const t=$('#stageTutorial');if(!tutorialMode||!t||t.hidden)return;
  clearTutorialFocus();
  const s=STAGE_TUTORIAL_STEPS[tutorialStep];
  $('#stageTutorialStep').textContent=String(tutorialStep+1).padStart(2,'0')+' / '+String(STAGE_TUTORIAL_STEPS.length).padStart(2,'0');
  $('#stageTutorialTitle').textContent=s.title;
  $('#stageTutorialText').innerHTML=s.text;
  const parts=s.hint.split('//');$('#stageTutorialHint').innerHTML='<b>'+parts[0]+'//</b>'+parts.slice(1).join('//');
  $('#tutorialMini').innerHTML=tutorialMiniSvg(s.mini);
  const stat=$('#tutorialStatus');if(stat){stat.className='stageTutorialStatus';stat.innerHTML='<i></i><span>입력을 기다리는 중</span>'}
  setTutorialStepUI(s);
  tutorialWindowOnStepChange(s);
  if(s.canvas)positionTutorialMarker(s.canvas);
}
function tutorialActionSatisfied(key,action){
  if(key==='camera')return action==='camera';
  if(key==='grid')return gridVisible;
  if(key==='snap')return snapEnabled;
  if(key==='roadTool')return tool==='road';
  if(key==='support')return !!selected&&selected.id===0;
  if(key==='roadComplete')return tutorialRoadConnected();
  if(key==='woodTool')return tool==='wood';
  if(key==='topChord')return tutorialPerfectTruss();
  if(key==='rightClick')return tutorialFlags.rightClick;
  if(key==='moveTool')return tool==='move';
  if(key==='dragNode'){const n=tutorialMoveTarget?nodeById(tutorialMoveTarget.id):null;return !!(tutorialFlags.moved&&n&&Math.hypot(n.x-tutorialMoveTarget.x,n.y-tutorialMoveTarget.y)<=14);}
  if(key==='test')return action==='test'&&tutorialPerfectTruss();
  return false;
}
function tutorialHandleAction(action='state'){
  if(!tutorialMode||tutorialTransitioning)return false;
  const s=STAGE_TUTORIAL_STEPS[tutorialStep];
  if(!tutorialActionSatisfied(s.key,action))return false;
  tutorialTransitioning=true;
  const stat=$('#tutorialStatus');if(stat){stat.className='stageTutorialStatus done';stat.innerHTML='<i></i><span>입력 확인 완료</span>'}
  if(s.key==='camera')setTimeout(()=>resetCamera(),120);
  if(s.key==='woodTool')selected=null;
  if(s.key==='test'){
    tutorialTransitioning=true;
    tutorialTestRunning=true;
    const panel=$('#stageTutorial');
    if(panel){panel.hidden=true;panel.style.display='none';}
    // TEST view must be completely clean: hide all tutorial guide graphics before the first simulation frame.
    clearTutorialFocus();
    const badge=$('#tutorialStageBadge');if(badge)badge.style.opacity='.45';
    draw();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      tutorialTransitioning=false;
      startSimulation(true);
    }));
    return true;
  }
  setTimeout(()=>{
    tutorialStep=Math.min(STAGE_TUTORIAL_STEPS.length-1,tutorialStep+1);
    if(STAGE_TUTORIAL_STEPS[tutorialStep]?.key==='rightClick')tutorialFlags.rightClick=false;
    if(STAGE_TUTORIAL_STEPS[tutorialStep]?.key==='moveTool')prepareTutorialMoveChallenge();
    tutorialTransitioning=false;
    renderStageTutorialStep();
    draw();
  },420);
  return true;
}
function leaveTutorialVisualMode(){
  document.body.classList.remove('tutorial-mode');
  requestAnimationFrame(()=>resize());
  clearTutorialFocus();
  $$('.tutorialStepHidden').forEach(el=>el.classList.remove('tutorialStepHidden'));
  const t=$('#stageTutorial');if(t)t.hidden=true;
  const badge=$('#tutorialStageBadge');if(badge)badge.remove();
  $('#coachPanel')?.removeAttribute('aria-hidden');
}
function startTutorialStage(force=false){
  setGamePhase(GAME_PHASE.BUILD);
  if(currentGameScreen!==GAME_SCREEN.GAME)changeGameScreen(GAME_SCREEN.GAME);
  tutorialPreviousUIMode=uiMode;
  tutorialMode=true;tutorialStep=0;tutorialTransitioning=false;tutorialFlags={camera:false,rightClick:false,moved:false};tutorialDragStart=null;tutorialMoveTarget=null;tutorialTestRunning=false;
  setUIMode('basic',{persist:false,silent:true});
  document.body.classList.add('tutorial-mode');
  tutorialWindowPrepareForStart();
  requestAnimationFrame(()=>resize());
  stageIndex=-1;stage=TUTORIAL_STAGE;nodes=[];members=[];history=[];redoHistory=[];selected=null;sim=null;currentAnalysis=null;lastFullAnalysis=null;totalCost=0;stressMode=false;loadPathMode=false;measureMode=false;measureA=null;measureB=null;lastBroken=new Set();
  stage.deck.forEach((pt,i)=>nodes.push({id:i,x:pt[0],y:pt[1],deck:true,support:i===0?'pin':i===stage.deck.length-1?'roller':null,user:false,visible:i===0||i===stage.deck.length-1,activated:false}));
  tool='wood';$$('.toolBtn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  gridVisible=false;snapEnabled=false;$('#gridBtn')?.classList.remove('toggled');$('#snapBtn')?.classList.remove('toggled');
  resetStageClock(false);resetCamera();updateHUD();updateModeBadge();
  $('#coachPanel')?.setAttribute('aria-hidden','true');
  let badge=$('#tutorialStageBadge');if(!badge){badge=document.createElement('div');badge.id='tutorialStageBadge';badge.className='tutorialStageBadge';document.querySelector('.main')?.appendChild(badge)}
  badge.innerHTML='<b>TRAINING ENVIRONMENT</b>AUTO-PROGRESS // LIVE INPUT CHECK';
  const t=$('#stageTutorial');if(t){t.hidden=false;t.style.display='';}
  renderStageTutorialStep();draw();
  if(force)toast('TUTORIAL STAGE // 직접 조작하면 자동 진행됩니다');
}
function finishTutorialStage(skipped=false){
  if(!tutorialMode)return;
  tutorialMode=false;leaveTutorialVisualMode();
  const restoreMode=tutorialPreviousUIMode||'basic';tutorialPreviousUIMode=null;
  setUIMode(restoreMode,{persist:false,silent:true});markTutorialComplete();
  if($('#app'))$('#app').style.visibility='hidden';
  runLoadingSequence({title:skipped?'TRAINING BYPASS CONFIRMED':'TRAINING STAGE COMPLETE',statuses:['[01] INPUT MAP VERIFIED','[02] GRID / SNAP PROFILE','[03] ROAD BUILD CONTROLS','[04] PLAYER PROGRESS','[05] SET 01 UNLOCKED'],duration:1350,hint:'CAMPAIGN ACCESS GRANTED'},()=>{changeGameScreen(GAME_SCREEN.TRAINING_COMPLETE)})
}
function startStageOneTutorial(force=false){startTutorialStage(force)}
function closeStageTutorial(){finishTutorialStage(true)}

// Tutorial action observers: no NEXT button. Real input is the progression trigger.
document.addEventListener('click',e=>{if(!tutorialMode)return;setTimeout(()=>tutorialHandleAction('click'),0)});
window.addEventListener('keydown',e=>{if(!tutorialMode)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))setTimeout(()=>tutorialHandleAction('camera'),0);else setTimeout(()=>tutorialHandleAction('key'),0)});
canvas.addEventListener('pointerdown',()=>{if(!tutorialMode)return;setTimeout(()=>tutorialHandleAction('canvas'),0)});
canvas.addEventListener('contextmenu',()=>{if(!tutorialMode)return;tutorialFlags.rightClick=true;setTimeout(()=>tutorialHandleAction('rightClick'),0)});
canvas.addEventListener('pointerdown',()=>{if(!tutorialMode||tool!=='move'||!dragging)return;tutorialDragStart={id:dragging.id,x:dragging.x,y:dragging.y}});
canvas.addEventListener('pointerup',()=>{if(!tutorialMode||!tutorialDragStart)return;const n=nodeById(tutorialDragStart.id);if(n&&Math.hypot(n.x-tutorialDragStart.x,n.y-tutorialDragStart.y)>6)tutorialFlags.moved=true;tutorialDragStart=null;setTimeout(()=>tutorialHandleAction('drag'),0)});

function beginGameSequence(){
  applyDifficultyProfile();pauseStageClock(false);
  if(playerProgress.tutorialCompleted)changeGameScreen(GAME_SCREEN.MAIN_MENU);else changeGameScreen(GAME_SCREEN.WELCOME);
}
function confirmProjectCredit(){
  if($('#creditScreen')?.hidden)return;
  if($('#app'))$('#app').style.visibility='hidden';const d=DIFFICULTY[difficultyMode];
  runLoadingSequence({title:'INITIALIZING TRAINING ENVIRONMENT',statuses:[`[01] PROFILE ${difficultyMode.toUpperCase()}`,'[02] INPUT CONTROL MAP','[03] GRID / SNAP SYSTEM','[04] BUILD TOOLCHAIN','[05] TUTORIAL READY'],duration:1800,hint:d.label},()=>{changeGameScreen(GAME_SCREEN.GAME);resize();startTutorialStage(false);toast('TUTORIAL STAGE // 수행한 행동을 실시간으로 확인합니다')})
}
$$('.difficultyBtn').forEach(b=>b.onclick=()=>setDifficulty(b.dataset.difficulty));
updateDifficultyUI();
document.addEventListener('pointerdown',e=>{const b=e.target.closest?.('button');if(!b)return;ensureAudio();if(!b.matches('.toolBtn,#testBtn,#sfxBtn,.titleStart,.primaryBtn'))playSfx('click')},{capture:true});
$('#titleStartBtn').onclick=beginGameSequence;
$('#creditConfirmBtn').onclick=confirmProjectCredit;



function configureSandboxStartingSite(levelId='empty'){
  const sb=stages[4];
  if(!window.__sandboxBaseSite){window.__sandboxBaseSite={deck:clonePlain(sb.deck),forbidden:clonePlain(sb.forbidden||[]),ship:clonePlain(sb.ship||null),navigationClearance:clonePlain(sb.navigationClearance||null),bg:sb.bg,weather:sb.weather||'clear',environment:sb.environment||'SANDBOX RANGE',extraSupports:clonePlain(sb.extraSupports||[])}}
  const base=window.__sandboxBaseSite;
  if(levelId==='empty'||!getGameLevel(levelId)){
    sb.deck=clonePlain(base.deck);sb.forbidden=clonePlain(base.forbidden);sb.ship=clonePlain(base.ship);sb.navigationClearance=clonePlain(base.navigationClearance);sb.bg=base.bg;sb.weather=base.weather;sb.environment=base.environment;sb.extraSupports=clonePlain(base.extraSupports);sb.startingSiteId='empty';
  }else{
    const src=runtimeStageForLevel(getGameLevel(levelId),{difficulty:false});
    sb.deck=clonePlain(src.deck);sb.forbidden=clonePlain(src.forbidden||[]);sb.ship=clonePlain(src.ship||null);sb.navigationClearance=clonePlain(src.navigationClearance||null);sb.bg=src.bg;sb.weather=src.weather;sb.environment=`SANDBOX // ${src.environment||getGameLevel(levelId).title}`;sb.extraSupports=clonePlain(src.extraSupports||[]);sb.startingSiteId=levelId;
  }
  // Sandbox remains unrestricted: only site geometry is imported.
  sb.materials=null;sb.conditionCodes=[];sb.maxMemberCount=null;sb.maxCableCount=null;sb.targetMaterialLength=null;sb.forcedFailure=null;sb.doubleVehicle=null;sb.axles=[];
  const state=$('#sandboxSiteState'),level=getGameLevel(levelId);if(state)state.textContent=level?`SITE // ${displayContractId(level)} · ${level.title}`:'SITE // EMPTY LAB';
}

function loadPreset(name){
  // Preserve the sandbox experiment settings while rebuilding only the geometry.
  const keepVehicle=stages[4].vehicle||'CAR';
  const keepSkin=stages[4].vehicleSkin||'#53aee6';
  const keepLoad=stages[4].load;
  const keepWind=stages[4].wind||0;
  const keepMemberFailure=stages[4].memberFailure!==false;
  resetStage(4);
  stage=stages[4];
  stage.vehicle=keepVehicle; stage.vehicleSkin=keepSkin; stage.load=keepLoad; stage.wind=keepWind; stage.memberFailure=keepMemberFailure;

  // All road joints are made visible for presets so the load path is legible.
  stage.deck.slice(1,-1).forEach((_,i)=>{const n=nodeById(i+1);n.visible=true;n.activated=true});
  if(name==='blank'){
    lastFullAnalysis=null; currentAnalysis=null; updateHUD(); draw();
    const st=$('#presetStatus'); if(st){st.className='presetStatus';st.textContent='PRESET // EMPTY LAB · 직접 구조를 설계하세요.'}
    toast('빈 샌드박스를 불러왔습니다');
    return;
  }

  function nextId(){return Math.max(-1,...nodes.map(n=>n.id))+1}
  function addNode(x,y){const n={id:nextId(),x,y,user:true,visible:true,deck:false,support:null};nodes.push(n);return n}
  function conn(a,b,mat='steel'){
    if(mat==='steel'&&stage.presetMaterial)mat=stage.presetMaterial;
    if(!a||!b||a.id===b.id)return;
    const key=memberKey(a.id,b.id);
    if(members.some(m=>memberKey(m.a,m.b)===key))return;
    members.push({id:'u'+cryptoRandom(),a:a.id,b:b.id,mat,user:true,road:mat==='road'||mat==='roadHeavy'});
  }
  const d=stage.deck.map((_,i)=>nodeById(i));
  for(let i=0;i<d.length-1;i++)conn(d[i],d[i+1],'road');

  if(name==='warren'){
    // True Warren-style triangulation: one upper node per road panel.
    // Every road panel is a closed triangle and both supports participate in the truss.
    const top=[];
    for(let i=0;i<d.length-1;i++){
      const x=(d[i].x+d[i+1].x)/2;
      const t=addNode(x,(d[i].y+d[i+1].y)/2-(stage.trussHeight||135));
      top.push(t);
      conn(d[i],t,'steel');
      conn(t,d[i+1],'steel');
    }
    for(let i=0;i<top.length-1;i++)conn(top[i],top[i+1],'steel');
  }else if(name==='pratt'){
    // Pratt teaching preset: vertical posts + top chord + diagonals leaning toward mid-span.
    const top=d.map(n=>addNode(n.x,n.y-(stage.trussHeight||135)));
    for(let i=0;i<d.length;i++)conn(d[i],top[i],'steel');
    for(let i=0;i<top.length-1;i++)conn(top[i],top[i+1],'steel');
    for(let i=0;i<d.length-1;i++){
      if(i<(d.length-1)/2) conn(top[i],d[i+1],stage.presetMaterial||'wood');
      else conn(top[i+1],d[i],stage.presetMaterial||'wood');
    }
  }else if(name==='cable'){
    // Cable-stayed teaching preset. Towers are first stabilized with steel triangles,
    // then stay cables support the centre deck. No isolated helper nodes are created.
    const right=d.length-2,towerY=Math.min(...d.map(n=>n.y))-(stage.trussHeight||155)*1.3;
    const lt=addNode(d[1].x,towerY),rt=addNode(d[right].x,towerY);
    conn(d[0],lt,'steel');conn(d[1],lt,'steel');conn(d[2],lt,'steel');
    conn(d[right-1],rt,'steel');conn(d[right],rt,'steel');conn(d[right+1],rt,'steel');
    for(let i=2;i<=right-1;i++)conn(i<d.length/2?lt:rt,d[i],'cable');
    conn(lt,rt,'cable');
  }

  // Remove any accidental isolated user nodes before running the same solver used by TEST.
  const connected=new Set();
  members.forEach(m=>{connected.add(m.a);connected.add(m.b)});
  nodes=nodes.filter(n=>!n.user||connected.has(n.id));

  lastFullAnalysis=null; currentAnalysis=null; updateHUD();
  const center=(stage.deck[0][0]+stage.deck.at(-1)[0])/2;
  const verification=assemble(center,new Set());
  const st=$('#presetStatus');
  if(verification.ok){
    lastFullAnalysis=verification;
    currentAnalysis={ok:true,maxRatio:verification.maxRatio,maxDefl:verification.maxDefl};
    if(st){st.className='presetStatus ok';st.textContent=`PRESET VERIFIED // SOLVER STABLE · ${name.toUpperCase()}`}
    toast('PRESET VERIFIED // 구조가 안정적으로 연결되었습니다');
  }else{
    if(st){st.className='presetStatus bad';st.textContent='현재 지형에서는 구조가 불안정합니다. 지지점과 연결을 보강해 주세요.'}
    toast('현재 예시 구조가 불안정합니다. 연결과 지지 조건을 확인하세요.');
  }
  draw();
}

const SANDBOX_DESIGNS_KEY='trusslab-sandbox-designs-v1';
function hasSandboxDesign(){return stageIndex===4&&stage===stages[4]&&!currentCampaignLevelId}
function readSandboxDesigns(){
  try{const saved=JSON.parse(localStorage.getItem(SANDBOX_DESIGNS_KEY)||'[]');if(!Array.isArray(saved)||saved.some(entry=>entry&&(entry.version!==1||typeof entry.name!=='string'||!Array.isArray(entry.design?.members)||!Array.isArray(entry.design?.nodes)||!Array.isArray(entry.stage?.deck))))throw new Error('Invalid design archive');return saved.slice(0,3)}
  catch(error){console.error('Sandbox archive:',error);toast('보관함을 읽지 못했습니다. 브라우저 저장 데이터를 확인하세요.');return []}
}
function renderSandboxArchive(){
  const saved=readSandboxDesigns(),slot=Number($('#sandboxSlot').value),entry=saved[slot];
  [...$('#sandboxSlot').options].forEach((option,index)=>{option.textContent=`보관함 ${index+1} · ${saved[index]?saved[index].name:'비어 있음'}`});
  $('#sandboxSaveName').value=entry?entry.name:'';
  $('#sandboxSave').disabled=!hasSandboxDesign();$('#sandboxRestore').disabled=!entry;
  $('#sandboxArchiveStatus').textContent=entry?`${entry.design.members.length}개 부재 · ${new Date(entry.savedAt).toLocaleString('ko-KR')}`:hasSandboxDesign()?'현재 작업 중인 구조와 적용된 조건을 저장합니다.':'실험을 시작하면 현재 설계를 저장할 수 있습니다.';
}
function sandboxSelectedPreset(){return $('#sandboxModal .presetBtn.active').dataset.preset}
function selectSandboxPreset(name){
  $$('#sandboxModal .presetBtn').forEach(button=>{const active=button.dataset.preset===name;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
  if(name!=='current')window.__sandboxPreset=name;
  else $('#sandboxSite').value=stages[4].startingSiteId||'empty';
  updateSandboxSetup();
}
function syncSandboxSetup(){
  const sb=stages[4],site=$('#sandboxSite');
  if(!site.options.length){site.add(new Option('빈 실험장 · 경간 직접 설정','empty'));for(const level of LEVEL_LIBRARY)site.add(new Option(`${displayContractId(level)} · ${level.title}`,level.id))}
  site.value=sb.startingSiteId||'empty';
  $('#sandboxSpan').value=sb.deck.at(-1)[0]-sb.deck[0][0];$('#sandboxHeight').value=sb.trussHeight||135;
  $('#sandboxLoad').value=sb.load/1000;$('#sandboxWind').value=(sb.wind||0)/1000;$('#sandboxSpeed').value=sb.vehicleSpeed||82;
  $('#sandboxMaterial').value=sb.presetMaterial||'steel';
  $$('#sandboxModal .vehicleModelBtn').forEach(button=>button.classList.toggle('active',button.dataset.vehicle===sb.vehicle));
  $$('#sandboxModal .vehicleSkinBtn').forEach(button=>button.classList.toggle('active',button.dataset.skin===sb.vehicleSkin));
  $$('#sandboxModal .sandboxFailureBtn').forEach(button=>button.classList.toggle('active',(button.dataset.failure==='on')===(sb.memberFailure!==false)));
  $('#sandboxModal [data-preset="current"]').disabled=!hasSandboxDesign();
  selectSandboxPreset(hasSandboxDesign()?'current':window.__sandboxPreset||'blank');renderSandboxArchive();
}
function updateSandboxSetup(){
  const preset=sandboxSelectedPreset(),current=preset==='current',site=$('#sandboxSite').value,level=getGameLevel(site);
  const span=Number($('#sandboxSpan').value),height=Number($('#sandboxHeight').value),load=Number($('#sandboxLoad').value),wind=Number($('#sandboxWind').value),speed=Number($('#sandboxSpeed').value);
  $('#sandboxSpanOut').textContent=span+' GU';$('#sandboxHeightOut').textContent=height+' GU';
  $('#sandboxLoadLabel').textContent=load+' kN';$('#sandboxWindLabel').textContent=(wind>0?'+':'')+wind+' kN';$('#sandboxSpeedOut').textContent=speed+' GU/s';
  $('#sandboxSpan').disabled=current||site!=='empty';$('#sandboxHeight').disabled=current||preset==='blank';$('#sandboxMaterial').disabled=current||preset==='blank';
  $('#sandboxSiteState').textContent=level?`${level.title} · 지형만 가져옵니다.`:'빈 실험장 · 경간을 자유롭게 조절할 수 있습니다.';
  const names={current:'현재 설계 유지',blank:'빈 실험장',warren:'워런 트러스',pratt:'프랫 트러스',cable:'사장교'};
  $('#sandboxSummaryTitle').textContent=names[preset];$('#sandboxSummary').textContent=`차량 ${load} kN · 횡풍 ${wind>0?'+':''}${wind} kN · 속도 ${speed} GU/s`;
  $('#presetStatus').textContent=current?'현재 관절·부재를 유지합니다. 하중·차량·속도·파단 조건만 변경됩니다.':'새 구조로 시작합니다. 필요한 설계는 먼저 보관함에 저장하세요.';
  const failure=$('#sandboxModal .sandboxFailureBtn.active').dataset.failure==='on';
  $('#sandboxFailureState').textContent=failure?'과부하 파단 켜짐 · 파단 후 남은 하중 경로 관찰':'과부하 파단 꺼짐 · 이용률과 변형 비교';
  $('#enterSandbox').textContent=current?'조건 적용하고 돌아가기 →':'새 실험 시작 →';
  $('#sandboxApplyHint').textContent=current?'설계는 유지하고 시험 조건만 적용합니다.':'새 실험은 현재 작업 공간을 새 구조로 바꿉니다.';
  const peak=130-height*.35;
  const diagrams={blank:'',warren:`M20 130 90 ${peak} 160 130 230 ${peak} 300 130M90 ${peak}H230`,pratt:`M20 130V${peak}H300V130M90 130V${peak}M160 130V${peak}M230 130V${peak}M20 ${peak} 90 130 160 ${peak} 230 130 300 ${peak}`,cable:'M90 130V25M230 130V25M90 25 20 130M90 25 160 130 230 25 300 130'};
  if(current){const minX=Math.min(...nodes.map(node=>node.x)),minY=Math.min(...nodes.map(node=>node.y)),dx=Math.max(...nodes.map(node=>node.x))-minX||1,dy=Math.max(...nodes.map(node=>node.y))-minY||1;const lines=members.map(member=>{const a=nodeById(member.a),b=nodeById(member.b);return `<path d="M${20+(a.x-minX)*280/dx} ${25+(a.y-minY)*105/dy}L${20+(b.x-minX)*280/dx} ${25+(b.y-minY)*105/dy}"/>`}).join('');$('#sandboxPreview').innerHTML=`<svg viewBox="0 0 320 170" fill="none"><g stroke="#8ecab3" stroke-width="1.5">${lines}</g></svg>`}
  else $('#sandboxPreview').innerHTML=level?levelThumbSVG(level):`<svg viewBox="0 0 320 170" fill="none"><path d="M20 130H300M20 150H300M20 145v10M300 145v10" stroke="#49636b"/><path d="${diagrams[preset]}" stroke="#8ecab3" stroke-width="2"/><text x="160" y="166" text-anchor="middle" fill="#a1b7bc" font-size="11" font-family="monospace">${span} GU</text></svg>`;
}
function applySandboxSetup(){
  const sb=stages[4],preset=sandboxSelectedPreset(),keep=preset==='current'&&hasSandboxDesign();
  sb.load=Number($('#sandboxLoad').value)*1000;sb.wind=Number($('#sandboxWind').value)*1000;sb.vehicleSpeed=Number($('#sandboxSpeed').value);
  sb.vehicle=$('#sandboxModal .vehicleModelBtn.active').dataset.vehicle;sb.vehicleLabel=sb.vehicle;sb.vehicleHidden=false;
  sb.vehicleSkin=$('#sandboxModal .vehicleSkinBtn.active').dataset.skin;sb.memberFailure=$('#sandboxModal .sandboxFailureBtn.active').dataset.failure==='on';
  currentCampaignLevelId=null;currentLevelStageOverride=null;
  if(!keep){
    configureSandboxStartingSite($('#sandboxSite').value);sb.trussHeight=Number($('#sandboxHeight').value);sb.presetMaterial=$('#sandboxMaterial').value;
    if(sb.startingSiteId==='empty'){const span=Number($('#sandboxSpan').value),left=(W-span)/2,segments=Math.ceil(span/150);sb.deck=Array.from({length:segments+1},(_,i)=>[left+span*i/segments,390])}
    loadPreset(preset);resetCamera();
  }else{lastBroken=new Set();currentAnalysis=null;lastFullAnalysis=null;updateHUD();updateModeBadge();draw()}
  ui.sandbox.classList.remove('show');changeGameScreen(GAME_SCREEN.GAME);
}
function saveSandboxDesign(){
  if(!hasSandboxDesign())return;
  const slot=Number($('#sandboxSlot').value),saved=readSandboxDesigns();
  if(saved[slot]&&!confirm(`「${saved[slot].name}」을 현재 설계로 덮어쓸까요?`))return;
  saved[slot]={version:1,name:$('#sandboxSaveName').value.trim()||`실험 ${slot+1}`,savedAt:new Date().toISOString(),stage:clonePlain(stages[4]),design:JSON.parse(captureState())};
  try{localStorage.setItem(SANDBOX_DESIGNS_KEY,JSON.stringify(saved))}catch(error){console.error('Sandbox save:',error);toast('저장 공간이 부족하거나 브라우저 저장을 사용할 수 없습니다.');return}
  renderSandboxArchive();toast('설계와 실험 조건을 보관함에 저장했습니다.');
}
function restoreSandboxDesign(){
  const saved=readSandboxDesigns()[Number($('#sandboxSlot').value)];if(!saved)return;
  if(saved.version!==1||!Array.isArray(saved.stage?.deck)||!Array.isArray(saved.design?.nodes)||!Array.isArray(saved.design.members)||saved.stage.deck.length<2||saved.stage.deck.some(point=>point.length!==2||point.some(value=>!Number.isFinite(value)))||saved.design.nodes.some(node=>!Number.isFinite(node.x)||!Number.isFinite(node.y))||saved.design.members.some(member=>!MAT[member.mat])){toast('이 보관함의 설계 형식이 올바르지 않습니다.');return}
  if(hasSandboxDesign()&&members.length&&!confirm('현재 작업 공간을 선택한 보관함의 설계로 바꿀까요?'))return;
  currentCampaignLevelId=null;currentLevelStageOverride=null;Object.assign(stages[4],clonePlain(saved.stage));resetStage(4);restoreSnapshot(saved.design);resetCamera();
  ui.sandbox.classList.remove('show');changeGameScreen(GAME_SCREEN.GAME);toast(`「${saved.name}」 설계를 불러왔습니다.`);
}
$('#sandboxBtn').onclick=()=>openSandboxSetup(GAME_SCREEN.GAME);$('#closeSandbox').onclick=closeSandboxSetup;
$$('#sandboxModal .presetBtn').forEach(button=>button.onclick=()=>selectSandboxPreset(button.dataset.preset));
for(const selector of ['.vehicleModelBtn','.vehicleSkinBtn','.sandboxFailureBtn'])$$('#sandboxModal '+selector).forEach(button=>button.onclick=()=>{$$('#sandboxModal '+selector).forEach(other=>other.classList.toggle('active',other===button));updateSandboxSetup()});
for(const id of ['sandboxSpan','sandboxHeight','sandboxLoad','sandboxWind','sandboxSpeed'])$('#'+id).oninput=updateSandboxSetup;
$('#sandboxMaterial').onchange=updateSandboxSetup;
$('#sandboxSite').onchange=()=>{if(sandboxSelectedPreset()==='current')selectSandboxPreset('blank');else updateSandboxSetup()};
$('#enterSandbox').onclick=applySandboxSetup;$('#sandboxSlot').onchange=renderSandboxArchive;$('#sandboxSave').onclick=saveSandboxDesign;$('#sandboxRestore').onclick=restoreSandboxDesign;

$('#tutorialSkip')?.addEventListener('click',()=>finishTutorialStage(true));
$('#replayStageTutorial')?.addEventListener('click',()=>{ui.intro.classList.remove('show');if(sim)stopSimulation();runLoadingSequence({title:'LOADING TUTORIAL STAGE',statuses:['[01] RESET TRAINING AREA','[02] INPUT MAP','[03] BUILD GUIDES','[04] CAMERA CONTROLS','[05] TUTORIAL READY'],duration:900,hint:'GUIDED TRAINING'},()=>startTutorialStage(true))});



function initTechnicalTooltips(){
  const tip=$('#uiTooltip');
  if(!tip)return;
  const details={
    scanBtn:'Run a static structural analysis at the reference load position.',
    loadPathBtn:'Show applied loads and support-reaction paths.',
    stressBtn:'Visualize tension/compression and member utilization.',
    measureBtn:'Measure distance between construction nodes.',
    testBtn:'Run the live vehicle and structural test.',
    toolsMenuBtn:'Open analysis, view and system tools.',
    mainMenuQuickBtn:'Open the campaign main menu.',
    undoBtn:'Undo the previous design edit.',
    redoBtn:'Redo the most recently undone edit.',
    resetBtn:'Reset the current level design.',
    gridBtn:'Toggle the CAD construction grid.',
    snapBtn:'Toggle node snapping for precise construction.',
    uiModeToolbarBtn:'Switch between Basic and Advanced information density.'
  };
  let active=null;
  const hide=()=>{active=null;tip.hidden=true;};
  const show=(el)=>{
    const raw=el.dataset.tooltip||el.getAttribute('title')||el.getAttribute('aria-label')||el.textContent.trim();
    if(!raw)return;
    if(el.hasAttribute('title')){el.dataset.tooltip=raw;el.removeAttribute('title');}
    const shortcut=(raw.match(/\[([^\]]+)\]/)||[])[1]||'';
    const name=raw.replace(/\[[^\]]+\]/g,'').trim();
    const description=details[el.id]||'';
    tip.querySelector('b').textContent=name;
    tip.querySelector('span').textContent=[shortcut?`[${shortcut}]`:null,description||'Engineering console control'].filter(Boolean).join(' · ');
    const r=el.getBoundingClientRect();
    tip.style.left=`${Math.max(12,Math.min(innerWidth-tip.offsetWidth-12,r.left+r.width/2))}px`;
    tip.style.top=`${Math.max(12,r.top-10)}px`;
    tip.hidden=false;
    const tr=tip.getBoundingClientRect();
    tip.style.left=`${Math.max(12,Math.min(innerWidth-tr.width-12,r.left+r.width/2-tr.width/2))}px`;
    tip.style.top=`${Math.max(12,r.top-tr.height-10)}px`;
    active=el;
  };
  document.addEventListener('pointerover',e=>{const el=e.target.closest('.iconBtn,.toolBtn,.viewBtn,.topMenuItem,.stageBtn');if(el&&!el.disabled)show(el);});
  document.addEventListener('pointerout',e=>{if(active&&(!e.relatedTarget||!active.contains(e.relatedTarget)))hide();});
  document.addEventListener('focusin',e=>{const el=e.target.closest?.('.iconBtn,.toolBtn,.viewBtn,.topMenuItem,.stageBtn');if(el&&!el.disabled)show(el);});
  document.addEventListener('focusout',hide);
}

function bindCampaignFlowUI(){
  $('#welcomeBeginBtn').onclick=()=>changeGameScreen(GAME_SCREEN.CREDIT);$('#welcomeBackBtn').onclick=()=>changeGameScreen(GAME_SCREEN.TITLE);
  $('#menuSetsBtn').onclick=()=>changeGameScreen(GAME_SCREEN.SET_SELECT);$('#menuSandboxBtn').onclick=()=>openSandboxSetup(GAME_SCREEN.MAIN_MENU);$('#menuEducationBtn').onclick=()=>openEducationCenter(Number(localStorage.getItem('trusslab-education-last-module')||0));$('#menuRecordsBtn').onclick=()=>changeGameScreen(GAME_SCREEN.RECORDS);$('#menuSettingsBtn').onclick=()=>changeGameScreen(GAME_SCREEN.SETTINGS);$('#menuTrainingBtn').onclick=()=>{runLoadingSequence({title:'LOADING TRAINING ENVIRONMENT',statuses:['[01] RESET TRAINING AREA','[02] INPUT MAP','[03] BUILD GUIDES','[04] BASIC UI PROFILE','[05] TUTORIAL READY'],duration:900,hint:'GUIDED TRAINING'},()=>startTutorialStage(true))};$('#menuTitleBtn').onclick=()=>changeGameScreen(GAME_SCREEN.TITLE);
  $('#programBonusBtn')?.addEventListener('click',()=>{const target=gameSets.find(set=>bonusLevelsForSet(set.id).some(l=>!levelProgressFor(l.id).completed&&isLevelUnlocked(l.id)))||gameSets.at(-1);openLevelSelect(target.id)});$('#programRecordsBtn')?.addEventListener('click',()=>changeGameScreen(GAME_SCREEN.RECORDS));$('#programMenuBtn')?.addEventListener('click',()=>changeGameScreen(GAME_SCREEN.MAIN_MENU));
$('#contractMenuCrumb').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#contractSetsCrumb').onclick=()=>changeGameScreen(GAME_SCREEN.SET_SELECT);
$('#setMenuCrumb').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#setBackBtn').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#levelBackBtn').onclick=()=>changeGameScreen(GAME_SCREEN.SET_SELECT);$('#levelMenuBtn').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#briefingHomeCrumb').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#briefingSetsCrumb').onclick=()=>changeGameScreen(GAME_SCREEN.SET_SELECT);$('#briefingContractsCrumb').onclick=()=>openLevelSelect(selectedSetId);$('#briefingBackBtn').onclick=()=>openLevelSelect(selectedSetId);$('#briefingMenuBtn').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#briefingStartBtn').onclick=startSelectedCampaignLevel;$('#trainingMenuBtn').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#recordsBackBtn').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);$('#settingsBackBtn').onclick=()=>changeGameScreen(GAME_SCREEN.MAIN_MENU);
  $$('.flowDifficultyBtn').forEach(b=>b.onclick=()=>{setDifficulty(b.dataset.flowDifficulty);renderFlowSettings()});$$('.flowUIModeBtn').forEach(b=>b.onclick=()=>{setUIMode(b.dataset.flowUi);renderFlowSettings()});
  $$('.uiScaleChoices [data-ui-scale]').forEach(b=>b.onclick=()=>setUIScale(b.dataset.uiScale));
  $$('.settingToggleBtn').forEach(b=>b.onclick=()=>setAccessibilityPref(b.dataset.accessibility,b.dataset.value==='on'));
  $('#gameMainMenuBtn')?.addEventListener('click',()=>{if(sim)stopSimulation();pauseStageClock(false);changeGameScreen(GAME_SCREEN.MAIN_MENU)});
  $('#mainMenuQuickBtn')?.addEventListener('click',()=>{if(sim)stopSimulation();pauseStageClock(false);changeGameScreen(GAME_SCREEN.MAIN_MENU)});
}


/* ==========================================================================
   DEVELOPER CONSOLE // STEP 3
   Storage management, backups, recovery, event log, performance and safety.
   All developer data remains local to the current browser origin.
   ========================================================================== */
const DEV_STORAGE_SNAPSHOT_KEY='trusslab-dev-storage-snapshots-v1';
const DEV_STORAGE_FORMAT='TRUSS_LAB_STORAGE';
const DEV_CONFIG_FORMAT='TRUSS_LAB_DEV_CONFIG';
const DEV_STORAGE_FORMAT_VERSION=1;
const DEV_CONFIG_FORMAT_VERSION=1;
const DEV_EVENT_LIMIT=300;
const DEV_PERF={renderMs:0,physicsMs:0,frameMs:0,lastFrameAt:performance.now(),benchmarks:{}};
const DEV_EVENT_LOG=[];
Object.assign(DEV_STATE,{
	storageSearch:'',storageFilter:'ALL',storageRawMode:false,selectedStorageKey:null,
	storageImportPreview:null,configImportPreview:null,pendingChange:null,
	eventFilter:'ALL',eventSearch:'',safeStart:false,keyboardPreview:false,
	canvasDebug:{worldCoords:false,collisionBounds:false,noBuildZones:false,clearance:false,vehicleCollider:false,vesselCollider:false,supportConstraints:false}
});
function devPlainObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function devByteLength(v){return new TextEncoder().encode(String(v??'')).byteLength}
function devSerialize(value){return JSON.stringify(value,(_,v)=>v===Infinity?'__TRUSS_INF__':v,2)}
function devDeserialize(text){return JSON.parse(text,(_,v)=>v==='__TRUSS_INF__'?Infinity:v)}
function devLogEvent(severity='INFO',category='INFO',message='',data=null){
	if(!devSessionActive())return;
	DEV_EVENT_LOG.push({time:Date.now(),severity:String(severity).toUpperCase(),category:String(category).toUpperCase(),message:String(message),data});
	if(DEV_EVENT_LOG.length>DEV_EVENT_LIMIT)DEV_EVENT_LOG.splice(0,DEV_EVENT_LOG.length-DEV_EVENT_LIMIT);
}
function devDownloadJSON(filename,payload){
	try{const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),600);return true}catch(err){devLogEvent('ERROR','STORAGE','Download failed',{message:err?.message});return false}
}
function devStorageObject({includeSnapshotKey=false}={}){const out={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||(!includeSnapshotKey&&k===DEV_STORAGE_SNAPSHOT_KEY))continue;out[k]=localStorage.getItem(k)??''}}catch(_){}return out}
function devStorageType(raw){const s=String(raw??'');if(s==='true'||s==='false')return 'BOOLEAN';if(s.trim()!==''&&Number.isFinite(Number(s)))return 'NUMBER';try{const p=JSON.parse(s);if(p&&typeof p==='object')return 'JSON'}catch(_){}return 'STRING'}
function devStoragePreview(raw){const s=String(raw??'').replace(/\s+/g,' ').trim();return s.length>100?s.slice(0,97)+'…':s}
function devStorageKeys(){const q=DEV_STATE.storageSearch.trim().toLowerCase(),filter=DEV_STATE.storageFilter;return Object.entries(devStorageObject({includeSnapshotKey:true})).map(([key,value])=>({key,value,type:devStorageType(value),size:devByteLength(value)})).filter(x=>(filter==='ALL'||x.type===filter)&&(!q||x.key.toLowerCase().includes(q)||x.value.toLowerCase().includes(q))).sort((a,b)=>a.key.localeCompare(b.key))}
function devStorageSelected(){const all=devStorageKeys();let k=DEV_STATE.selectedStorageKey;if(!k||!Object.prototype.hasOwnProperty.call(devStorageObject({includeSnapshotKey:true}),k)){k=all[0]?.key||null;DEV_STATE.selectedStorageKey=k}if(!k)return null;const raw=localStorage.getItem(k)??'';return {key:k,value:raw,type:devStorageType(raw),size:devByteLength(raw)}}
function devLoadSnapshots(){try{const a=JSON.parse(localStorage.getItem(DEV_STORAGE_SNAPSHOT_KEY)||'[]');return Array.isArray(a)?a:[]}catch(_){return []}}
function devSaveSnapshots(list){try{localStorage.setItem(DEV_STORAGE_SNAPSHOT_KEY,JSON.stringify(list.slice(0,5)));return true}catch(err){devLogEvent('ERROR','STORAGE','Snapshot write failed',{message:err?.message});return false}}
function devCreateSnapshot(reason='MANUAL',{silent=false}={}){if(!devRequire('CREATE SNAPSHOT'))return null;const snap={id:`S${Date.now().toString(36).toUpperCase()}`,createdAt:new Date().toISOString(),reason:String(reason),data:devStorageObject()};const list=[snap,...devLoadSnapshots()].slice(0,5);if(!devSaveSnapshots(list))return null;devLogEvent('INFO','STORAGE',`SNAPSHOT_CREATED // ${reason}`,{id:snap.id,keys:Object.keys(snap.data).length});if(!silent)toast(`DEV SNAPSHOT // ${snap.id}`);return snap}
function devApplyStorageData(data,{snapshotReason='AUTO // STORAGE APPLY'}={}){if(!devPlainObject(data))return false;devCreateSnapshot(snapshotReason,{silent:true});const keep=localStorage.getItem(DEV_STORAGE_SNAPSHOT_KEY);const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));for(const k of keys)if(k&&k!==DEV_STORAGE_SNAPSHOT_KEY)localStorage.removeItem(k);for(const [k,v] of Object.entries(data))if(k!==DEV_STORAGE_SNAPSHOT_KEY)localStorage.setItem(k,String(v));if(keep!=null)localStorage.setItem(DEV_STORAGE_SNAPSHOT_KEY,keep);devReloadStateFromStorage();devLogEvent('INFO','STORAGE','STORAGE_APPLIED',{keys:Object.keys(data).length});return true}
function devRestoreSnapshot(id){if(!devRequire('RESTORE SNAPSHOT'))return false;const snap=devLoadSnapshots().find(s=>s.id===id);if(!snap)return false;if(!confirm(`Restore snapshot ${id}? Current storage will be auto-backed up first.`))return false;devCreateSnapshot('AUTO // BEFORE SNAPSHOT RESTORE',{silent:true});const currentSnaps=localStorage.getItem(DEV_STORAGE_SNAPSHOT_KEY);const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));for(const k of keys)if(k&&k!==DEV_STORAGE_SNAPSHOT_KEY)localStorage.removeItem(k);for(const [k,v] of Object.entries(snap.data||{}))localStorage.setItem(k,String(v));if(currentSnaps!=null)localStorage.setItem(DEV_STORAGE_SNAPSHOT_KEY,currentSnaps);devReloadStateFromStorage();devLogEvent('WARNING','STORAGE','SNAPSHOT_RESTORED',{id});toast(`RESTORED // ${id}`);renderDevConsole();return true}
function devReloadStateFromStorage(){
	playerProgress=loadPlayerProgress();
	difficultyMode=localStorage.getItem('trusslab-difficulty')||projectSettings.difficultyDefault||'easy';if(!DIFFICULTY[difficultyMode])difficultyMode='easy';applyDifficultyProfile?.();
	uiScale=String(readUIPref('scale','110'));if(!['90','100','110','120'].includes(uiScale))uiScale='110';
	accessibilityPrefs.reducedMotion=!!readUIPref('reduced-motion',false);accessibilityPrefs.highContrast=!!readUIPref('high-contrast',false);accessibilityPrefs.colorblindStress=!!readUIPref('colorblind-stress',false);accessibilityPrefs.largeText=!!readUIPref('large-text',true);
	uiMode=readUIPref('mode','basic');if(!['basic','advanced'].includes(uiMode))uiMode='basic';inspectorMode=readUIPref('inspector-mode','basic');if(!['basic','detail'].includes(inspectorMode))inspectorMode='basic';
	applyAccessibilitySettings();updateUIModeUI();updateInspectorModeUI();updateEducationAccess?.();updateStageButtons?.();
}
function devStorageExport(){if(!devRequire('EXPORT STORAGE'))return false;const payload={format:DEV_STORAGE_FORMAT,version:DEV_STORAGE_FORMAT_VERSION,exportedAt:new Date().toISOString(),data:devStorageObject()};devDownloadJSON(`truss-lab-storage-${Date.now()}.json`,payload);devLogEvent('INFO','STORAGE','STORAGE_EXPORTED',{keys:Object.keys(payload.data).length});return true}
function devValidateStorageImport(payload){const errors=[];if(!devPlainObject(payload))errors.push('ROOT MUST BE OBJECT');if(payload?.format!==DEV_STORAGE_FORMAT)errors.push('INVALID FORMAT');if(payload?.version!==DEV_STORAGE_FORMAT_VERSION)errors.push('UNSUPPORTED VERSION');if(!devPlainObject(payload?.data))errors.push('DATA MUST BE OBJECT');else for(const [k,v] of Object.entries(payload.data)){if(typeof k!=='string'||!k)errors.push('INVALID KEY');if(typeof v!=='string')errors.push(`VALUE MUST BE STRING // ${k}`)}return {ok:!errors.length,errors}}
function devStorageDiff(importData){const cur=devStorageObject(),incoming=importData||{},added=[],changed=[],deleted=[];for(const k of Object.keys(incoming)){if(!(k in cur))added.push(k);else if(cur[k]!==incoming[k])changed.push(k)}for(const k of Object.keys(cur))if(!(k in incoming))deleted.push(k);return {added,changed,deleted}}
function devPrepareStorageImport(payload){const v=devValidateStorageImport(payload);if(!v.ok){toast('저장 데이터 파일 형식이 올바르지 않습니다.');devLogEvent('ERROR','STORAGE','IMPORT_VALIDATION_FAILED',{errors:v.errors});return false}DEV_STATE.storageImportPreview={payload,diff:devStorageDiff(payload.data)};devSetPendingChange('storage-import',{payload});renderDevConsole();return true}
function devApplyStorageImport(){const p=DEV_STATE.storageImportPreview?.payload;if(!p)return false;const v=devValidateStorageImport(p);if(!v.ok)return false;devApplyStorageData(p.data,{snapshotReason:'AUTO // BEFORE IMPORT'});DEV_STATE.storageImportPreview=null;devClearPendingChange();toast('저장 데이터를 가져왔습니다.');renderDevConsole();return true}
function devStorageCoerce(type,text){if(type==='STRING')return String(text);if(type==='NUMBER'){const n=Number(text);if(!Number.isFinite(n))throw new Error('NUMBER REQUIRED');return String(n)}if(type==='BOOLEAN'){if(String(text)!=='true'&&String(text)!=='false')throw new Error('BOOLEAN MUST BE true OR false');return String(text)}if(type==='JSON'){const obj=JSON.parse(text);return JSON.stringify(obj)}return String(text)}
function devSaveStorageEditor(){if(!devRequire('EDIT STORAGE'))return false;const key=String($('#devStorageKeyInput')?.value||'').trim(),type=$('#devStorageTypeInput')?.value||'STRING',value=$('#devStorageValueInput')?.value??'';if(!key){toast('저장 키 이름을 입력하세요.');return false}let raw;try{raw=DEV_STATE.storageRawMode?String(value):devStorageCoerce(type,value)}catch(err){toast(`INVALID ${type} // NOT SAVED`);devLogEvent('WARNING','STORAGE','STORAGE_EDIT_REJECTED',{key,type});return false}localStorage.setItem(key,raw);DEV_STATE.selectedStorageKey=key;devLogEvent('INFO','STORAGE','STORAGE_KEY_SAVED',{key,type,size:devByteLength(raw)});devClearPendingChange();renderDevConsole();return true}
function devRenameStorageKey(){if(!devRequire('RENAME STORAGE KEY'))return false;const old=DEV_STATE.selectedStorageKey,newKey=String($('#devStorageKeyInput')?.value||'').trim();if(!old||!newKey||old===newKey)return false;if(localStorage.getItem(newKey)!=null&&!confirm(`Key ${newKey} exists. Replace it?`))return false;devCreateSnapshot('AUTO // BEFORE STORAGE RENAME',{silent:true});const value=localStorage.getItem(old)??'';localStorage.setItem(newKey,value);localStorage.removeItem(old);DEV_STATE.selectedStorageKey=newKey;devClearPendingChange();devLogEvent('WARNING','STORAGE','STORAGE_KEY_RENAMED',{from:old,to:newKey});renderDevConsole();return true}
function devDeleteStorageKey(){if(!devRequire('DELETE STORAGE KEY'))return false;const k=DEV_STATE.selectedStorageKey;if(!k)return false;if(!confirm(`Delete localStorage key?\n${k}`))return false;devCreateSnapshot('AUTO // BEFORE STORAGE DELETE',{silent:true});localStorage.removeItem(k);DEV_STATE.selectedStorageKey=null;devClearPendingChange();devLogEvent('WARNING','STORAGE','STORAGE_KEY_DELETED',{key:k});renderDevConsole();return true}
function devAddStorageKey(){if(!devRequire('ADD STORAGE KEY'))return false;const k=String(prompt('새 저장 키 이름','trusslab-dev-note')||'').trim();if(!k)return false;if(localStorage.getItem(k)!=null){toast('이미 존재하는 저장 키입니다.');DEV_STATE.selectedStorageKey=k;renderDevConsole();return false}localStorage.setItem(k,'');DEV_STATE.selectedStorageKey=k;devLogEvent('INFO','STORAGE','STORAGE_KEY_ADDED',{key:k});renderDevConsole();return true}
function devTypedReset(promptText){return String(prompt(`${promptText}\n실행하려면 RESET을 입력하세요.`,'')||'').trim().toUpperCase()==='RESET'}
function devClearGameStorage(){if(!devRequire('CLEAR GAME STORAGE'))return false;if(!devTypedReset('게임의 브라우저 저장 데이터를 삭제합니다. 복구용 백업은 유지됩니다.'))return false;devCreateSnapshot('AUTO // BEFORE CLEAR GAME STORAGE',{silent:true});const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));for(const k of keys)if(k&&k.startsWith('trusslab-')&&k!==DEV_STORAGE_SNAPSHOT_KEY)localStorage.removeItem(k);devReloadStateFromStorage();devLogEvent('ERROR','STORAGE','CLEAR_GAME_STORAGE');renderDevConsole();return true}
function devResetGameSave(){if(!devRequire('RESET GAME SAVE'))return false;if(!devTypedReset('캠페인·튜토리얼·학습 기록을 초기화합니다. UI 설정은 유지됩니다.'))return false;devCreateSnapshot('AUTO // BEFORE RESET GAME SAVE',{silent:true});for(const k of [PLAYER_PROGRESS_KEY,...LEGACY_PLAYER_PROGRESS_KEYS,'trusslab-tutorial-complete','trusslab-education-complete','trusslab-education-quiz','trusslab-education-last-module'])localStorage.removeItem(k);playerProgress=defaultPlayerProgress();savePlayerProgress();devLogEvent('ERROR','STORAGE','RESET_GAME_SAVE');renderDevConsole();return true}
function devRestoreStorageDefaults(){if(!devRequire('RESTORE DEFAULTS'))return false;if(!devTypedReset('현재 사이트의 브라우저 저장값을 모두 삭제합니다. 복구용 백업은 유지됩니다.'))return false;devCreateSnapshot('AUTO // BEFORE RESTORE DEFAULTS',{silent:true});const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));for(const k of keys)if(k&&k!==DEV_STORAGE_SNAPSHOT_KEY)localStorage.removeItem(k);playerProgress=defaultPlayerProgress();savePlayerProgress();devReloadStateFromStorage();devResetRuntimeOverrides({resetUI:true});devLogEvent('ERROR','STORAGE','RESTORE_DEFAULTS');renderDevConsole();return true}
function devKnownBadges(){return new Set(allBonusLevels().map(l=>l.badge).filter(Boolean))}
function devValidateSaveObject(save=playerProgress){const errors=[],warnings=[];if(!devPlainObject(save))return {ok:false,errors:['SAVE ROOT MUST BE OBJECT'],warnings};const req=['saveVersion','tutorialCompleted','unlockedSets','unlockedLevels','completedLevels','totalStars','badges','levelProgress'];for(const k of req)if(!(k in save))errors.push(`MISSING REQUIRED FIELD // ${k}`);const levels=new Set(LEVEL_LIBRARY.map(l=>l.id)),sets=new Set(SET_DEFINITIONS.map(s=>s.id)),campaigns=new Set(CAMPAIGNS.map(c=>c.id)),badges=devKnownBadges();for(const id of Object.keys(save.levelProgress||{})){if(!levels.has(id))errors.push(`UNKNOWN LEVEL ID // ${id}`);const p=save.levelProgress[id]||{};if(Number(p.stars)<0||Number(p.stars)>3)errors.push(`STARS OUT OF RANGE // ${id}`);if(p.bestTimeMs!=null&&Number(p.bestTimeMs)<0)errors.push(`NEGATIVE TIME // ${id}`);if(p.bestGrade!=null&&!['S','A','B','C'].includes(p.bestGrade))errors.push(`INVALID GRADE // ${id}`)}for(const id of save.unlockedLevels||[])if(!levels.has(id))errors.push(`UNKNOWN UNLOCKED LEVEL // ${id}`);for(const id of save.unlockedSets||[])if(!sets.has(id))errors.push(`UNKNOWN SET // ${id}`);for(const id of save.devUnlockedCampaigns||[])if(!campaigns.has(id))errors.push(`INVALID CAMPAIGN // ${id}`);for(const b of save.badges||[])if(!badges.has(b))errors.push(`UNKNOWN BADGE // ${b}`);const starMax=allMainLevels().length*3;if(Number(save.totalStars)>starMax)errors.push(`TOTAL STARS > MAXIMUM // ${save.totalStars}`);return {ok:!errors.length,errors,warnings}}
function devRepairSave(){if(!devRequire('REPAIR SAVE'))return false;const report=devValidateSaveObject(playerProgress);if(report.ok){toast('저장 데이터가 정상입니다. 복구할 필요가 없습니다.');return true}if(!confirm(`Repair ${report.errors.length} detected save issue(s)? A snapshot will be created first.`))return false;devCreateSnapshot('AUTO // BEFORE REPAIR',{silent:true});const levels=new Set(LEVEL_LIBRARY.map(l=>l.id)),sets=new Set(SET_DEFINITIONS.map(s=>s.id)),campaigns=new Set(CAMPAIGNS.map(c=>c.id)),badges=devKnownBadges(),clean=defaultPlayerProgress();Object.assign(clean,playerProgress);clean.saveVersion=3;clean.unlockedLevels=(playerProgress.unlockedLevels||[]).filter(x=>levels.has(x));clean.completedLevels=(playerProgress.completedLevels||[]).filter(x=>levels.has(x));clean.unlockedBonusLevels=(playerProgress.unlockedBonusLevels||[]).filter(x=>levels.has(x));clean.unlockedSets=(playerProgress.unlockedSets||[]).filter(x=>sets.has(x));clean.badges=(playerProgress.badges||[]).filter(x=>badges.has(x));clean.devUnlockedCampaigns=(playerProgress.devUnlockedCampaigns||[]).filter(x=>campaigns.has(x));clean.levelProgress={};for(const [id,p0] of Object.entries(playerProgress.levelProgress||{})){if(!levels.has(id))continue;const p={...p0};p.stars=clamp(Number(p.stars)||0,0,3);if(p.bestTimeMs!=null&&Number(p.bestTimeMs)<0)p.bestTimeMs=null;if(p.bestGrade!=null&&!['S','A','B','C'].includes(p.bestGrade))p.bestGrade=null;clean.levelProgress[id]=p}playerProgress=clean;recomputeProgressUnlocks();savePlayerProgress();devLogEvent('WARNING','STORAGE','SAVE_REPAIRED',{issues:report.errors.length});renderDevConsole();return true}
function devConfigPayload(){return {format:DEV_CONFIG_FORMAT,version:DEV_CONFIG_FORMAT_VERSION,exportedAt:new Date().toISOString(),runtimeOverride:true,levels:devDeepClone(LEVEL_LIBRARY),materials:devDeepClone(MAT),vehicles:devDeepClone(DEV_VEHICLE_PROFILES),physics:devDeepClone(DEV_PHYSICS_TUNING),sandbox:devDeepClone(stages[4])}}
function devExportConfig(){if(!devRequire('EXPORT DEV CONFIG'))return false;const payload=devConfigPayload();const raw=devSerialize(payload),blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`truss-lab-dev-config-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),600);devLogEvent('INFO','STORAGE','DEV_CONFIG_EXPORTED');return true}
function devValidateConfig(payload){const errors=[];if(!devPlainObject(payload))errors.push('ROOT MUST BE OBJECT');if(payload?.format!==DEV_CONFIG_FORMAT)errors.push('INVALID FORMAT');if(payload?.version!==DEV_CONFIG_FORMAT_VERSION)errors.push('UNSUPPORTED VERSION');if(!Array.isArray(payload?.levels))errors.push('LEVELS MUST BE ARRAY');else{const known=new Set(LEVEL_LIBRARY.map(l=>l.id));for(const l of payload.levels)if(!l?.id||!known.has(l.id))errors.push(`UNKNOWN LEVEL // ${l?.id||'MISSING ID'}`)}if(!devPlainObject(payload?.materials))errors.push('MATERIALS MUST BE OBJECT');if(!devPlainObject(payload?.vehicles))errors.push('VEHICLES MUST BE OBJECT');if(!devPlainObject(payload?.physics))errors.push('PHYSICS MUST BE OBJECT');return {ok:!errors.length,errors}}
function devPrepareConfigImport(payload){const v=devValidateConfig(payload);if(!v.ok){toast('개발 설정을 가져올 수 없습니다. 파일 형식을 확인하세요.');devLogEvent('ERROR','STORAGE','CONFIG_VALIDATION_FAILED',{errors:v.errors});return false}DEV_STATE.configImportPreview=payload;devSetPendingChange('config-import',{payload});DEV_STATE.activeSection='storage';renderDevConsole();return true}
function devApplyConfigImport(){const p=DEV_STATE.configImportPreview;if(!p)return false;const v=devValidateConfig(p);if(!v.ok)return false;for(const incoming of p.levels){const target=getGameLevel(incoming.id);if(target){for(const k of Object.keys(target))delete target[k];Object.assign(target,devDeepClone(incoming))}}for(const [id,incoming] of Object.entries(p.materials))if(MAT[id]){for(const k of Object.keys(MAT[id]))delete MAT[id][k];Object.assign(MAT[id],devDeepClone(incoming))}for(const [id,incoming] of Object.entries(p.vehicles))if(DEV_VEHICLE_PROFILES[id]){for(const k of Object.keys(DEV_VEHICLE_PROFILES[id]))delete DEV_VEHICLE_PROFILES[id][k];Object.assign(DEV_VEHICLE_PROFILES[id],devDeepClone(incoming))}for(const [k,vv] of Object.entries(p.physics))if(k in DEV_PHYSICS_TUNING){const lim=DEV_PHYSICS_LIMITS[k];DEV_PHYSICS_TUNING[k]=lim?clamp(Number(vv),lim[0],lim[1]):Number(vv)}if(p.sandbox){for(const k of Object.keys(stages[4]))delete stages[4][k];Object.assign(stages[4],devDeepClone(p.sandbox))}DEV_STATE.configImportPreview=null;devClearPendingChange();currentAnalysis=null;lastFullAnalysis=null;devLogEvent('WARNING','STORAGE','DEV_CONFIG_IMPORTED');toast('개발 설정을 현재 실행에 적용했습니다.');renderDevConsole();return true}
function devResetRuntimeOverrides({resetUI=false}={}){if(!devRequire('RESET RUNTIME OVERRIDES'))return false;LEVEL_LIBRARY.splice(0,LEVEL_LIBRARY.length,...devDeepClone(DEV_DEFAULTS.levels));for(const set of gameSets)set.levels=LEVEL_LIBRARY.filter(l=>l.setId===set.id);for(const [id,base] of Object.entries(DEV_DEFAULTS.materials))if(MAT[id]){for(const k of Object.keys(MAT[id]))delete MAT[id][k];Object.assign(MAT[id],devDeepClone(base))}for(const [id,base] of Object.entries(DEV_DEFAULTS.vehicles))if(DEV_VEHICLE_PROFILES[id]){for(const k of Object.keys(DEV_VEHICLE_PROFILES[id]))delete DEV_VEHICLE_PROFILES[id][k];Object.assign(DEV_VEHICLE_PROFILES[id],devDeepClone(base))}Object.assign(DEV_PHYSICS_TUNING,devDeepClone(DEV_DEFAULTS.physics));for(const k of Object.keys(stages[4]))delete stages[4][k];Object.assign(stages[4],devDeepClone(DEV_DEFAULTS.sandbox));if(resetUI){uiScale='110';uiMode='basic';inspectorMode='basic';accessibilityPrefs={reducedMotion:false,highContrast:false,colorblindStress:false,largeText:true};applyAccessibilitySettings();updateUIModeUI();updateInspectorModeUI()}currentAnalysis=null;lastFullAnalysis=null;DEV_STATE.safeStart=!!resetUI;devLogEvent('WARNING','INFO',resetUI?'SAFE_START_APPLIED':'RUNTIME_OVERRIDES_RESET');return true}
function devSafeStart(){if(!devRequire('SAFE START'))return false;if(!confirm('현재 실행의 변경값을 무시하고 물리·재료·UI를 기본값으로 시작할까요? 진행도는 유지됩니다.'))return false;devResetRuntimeOverrides({resetUI:true});window.__trussDevUnlockAll=false;toast('기본 설정으로 시작합니다. 진행도는 유지됩니다.');renderDevConsole();return true}
function devSetPendingChange(kind,payload){DEV_STATE.pendingChange={kind,payload};}
function devClearPendingChange(){DEV_STATE.pendingChange=null}
function devDiscardPendingChanges(){DEV_STATE.storageImportPreview=null;DEV_STATE.configImportPreview=null;devClearPendingChange();renderDevConsole();return true}
function devApplyPendingChanges(){const p=DEV_STATE.pendingChange;if(!p)return true;if(p.kind==='storage-edit')return devSaveStorageEditor();if(p.kind==='storage-import')return devApplyStorageImport();if(p.kind==='config-import')return devApplyConfigImport();devClearPendingChange();return true}
function devResolveUnsavedForNavigation(){if(!DEV_STATE.pendingChange)return true;if(confirm('저장하지 않은 변경 사항이 있습니다.\n확인: 변경값을 적용하고 이동\n취소: 변경값 취소 또는 현재 화면 유지 선택'))return !!devApplyPendingChanges();if(confirm('변경 사항을 취소할까요?\n확인: 변경 사항 취소\n취소: 현재 화면 유지')){devDiscardPendingChanges();return true}return false}
function devRequestSectionChange(section){if(!devRequire('DEVELOPER CONSOLE'))return false;if(!devResolveUnsavedForNavigation())return false;DEV_STATE.activeSection=section||'overview';renderDevConsole();return true}
function devRequestExitConsole(){if(!devResolveUnsavedForNavigation())return false;const target=![GAME_SCREEN.DEV_AUTH,GAME_SCREEN.DEV_CONSOLE,GAME_SCREEN.DEV_PREVIEW].includes(DEV_STATE.returnScreen)?DEV_STATE.returnScreen:GAME_SCREEN.MAIN_MENU;changeGameScreen(target||GAME_SCREEN.MAIN_MENU);return true}
function devUnsavedBannerHTML(){if(!DEV_STATE.pendingChange)return '';const label=DEV_STATE.pendingChange.kind.replaceAll('-',' ').toUpperCase();return `<div class="devUnsavedBanner"><span>저장하지 않은 변경 사항 · ${devEsc(devLabel(label))}</span><div class="devUnsavedActions"><button class="flowBtn primary" data-dev-pending="apply">적용</button><button class="flowBtn" data-dev-pending="discard">취소</button></div></div>`}
function devStorageHTML(){
	const items=devStorageKeys(),selected=devStorageSelected(),snapshots=devLoadSnapshots(),validation=devValidateSaveObject(playerProgress),pending=DEV_STATE.pendingChange?.kind==='storage-edit'?DEV_STATE.pendingChange.payload:null;
	const selectedRaw=pending&&pending.originalKey===selected?.key?pending.value:selected?.value??'',selectedType=pending&&pending.originalKey===selected?.key?pending.type:selected?.type||'STRING',selectedKey=pending&&pending.originalKey===selected?.key?pending.key:selected?.key||'';
	const list=items.map(x=>`<button class="devStorageKey ${x.key===selected?.key?'active':''}" data-dev-storage-select="${devEsc(x.key)}"><b>${devEsc(x.key)}</b><span>${devLabel(x.type)} · ${x.size} B</span><small>${devEsc(devStoragePreview(x.value))}</small></button>`).join('')||'<div class="devEmpty">저장된 데이터가 없습니다</div>';
	const preview=DEV_STATE.storageImportPreview;let previewHTML='';if(preview){const d=preview.diff,all=[...d.added.map(k=>['ADDED',k]),...d.changed.map(k=>['CHANGED',k]),...d.deleted.map(k=>['DELETED',k])].slice(0,24);previewHTML=`<div class="devStoragePreview"><div class="devEditorSectionHead"><b>가져올 데이터 미리보기</b><span>검사 완료 · 아직 적용하지 않음</span></div><div class="devDiffGrid"><div class="add"><span>추가</span><b>${d.added.length}</b></div><div class="change"><span>변경</span><b>${d.changed.length}</b></div><div class="delete"><span>삭제</span><b>${d.deleted.length}</b></div></div><table class="devMiniTable"><tbody>${all.map(([t,k])=>`<tr><td>${t}</td><td>${devEsc(k)}</td></tr>`).join('')||'<tr><td>변경 사항이 없습니다</td></tr>'}</tbody></table><div class="devActionBar"><button class="flowBtn primary" data-dev-storage-action="apply-import">가져온 데이터 적용</button><button class="flowBtn" data-dev-storage-action="discard-import">미리보기 취소</button></div></div>`}
	const cfg=DEV_STATE.configImportPreview;const cfgHTML=cfg?`<div class="devStoragePreview"><div class="devEditorSectionHead"><b>개발 설정 가져오기 미리보기</b><span>현재 실행에만 적용</span></div><div class="devDiffGrid"><div class="add"><span>스테이지</span><b>${cfg.levels.length}</b></div><div class="change"><span>재료</span><b>${Object.keys(cfg.materials||{}).length}</b></div><div class="delete"><span>물리 설정 수</span><b>${Object.keys(cfg.physics||{}).length}</b></div></div><div class="devActionBar"><button class="flowBtn primary" data-dev-storage-action="apply-config">개발 설정 적용</button><button class="flowBtn" data-dev-storage-action="discard-config">설정 가져오기 취소</button></div></div>`:'';
	const snapRows=snapshots.map(s=>`<div class="devSnapshotRow"><span><b>${devEsc(s.id)}</b> · ${devEsc(s.reason)}<br>${new Date(s.createdAt).toLocaleString()} · ${Object.keys(s.data||{}).length} KEYS</span><button class="flowBtn" data-dev-restore-snapshot="${devEsc(s.id)}">복원</button><span>${Math.round(devByteLength(JSON.stringify(s.data||{}))/1024)} KB</span></div>`).join('')||'<div class="devEmpty">아직 생성한 백업이 없습니다</div>';
	return `${devSectionHeader('저장 데이터 관리','현재 사이트의 저장 데이터를 조회·편집합니다. 데이터 검사, 복구용 백업, 저장 데이터와 개발 설정의 가져오기·내보내기를 지원합니다.','10 // 저장 관리')}
	<div class="devStorageLayout"><aside class="devStorageListPane"><div class="devStorageToolbar"><input id="devStorageSearch" placeholder="저장 키·값 검색" value="${devEsc(DEV_STATE.storageSearch)}"><select id="devStorageFilter">${['ALL','STRING','NUMBER','BOOLEAN','JSON'].map(x=>`<option value="${x}" ${DEV_STATE.storageFilter===x?'selected':''}>${devLabel(x)}</option>`).join('')}</select><div class="devActionBar"><button class="flowBtn" data-dev-storage-action="add">저장 키 추가</button><button class="flowBtn ${DEV_STATE.storageRawMode?'danger':''}" data-dev-storage-action="raw">원본 편집 ${DEV_STATE.storageRawMode?'켜짐':'꺼짐'}</button></div></div><div class="devStorageKeys">${list}</div></aside>
	<section class="devStorageDetail">${DEV_STATE.storageRawMode?'<div class="devStorageRawWarning">원본 편집 모드 · 저장된 문자열을 그대로 편집합니다. 자동 형 변환과 JSON 들여쓰기를 적용하지 않습니다.</div>':''}<div class="devStorageMeta"><div><span>저장 키 수</span><b>${localStorage.length}</b></div><div><span>현재 사이트 저장 용량</span><b>${(devLocalStorageBytes()/1024).toFixed(1)} KB</b></div><div><span>저장 데이터 검사</span><b class="${validation.ok?'ok':'warn'}">${validation.ok?'정상':`오류 ${validation.errors.length}건`}</b></div></div>
	${selected?`<div class="devStorageForm"><div class="devStorageField"><label>저장 키</label><input id="devStorageKeyInput" value="${devEsc(selectedKey)}"></div><div class="devStorageField"><label>유형</label><select id="devStorageTypeInput" ${DEV_STATE.storageRawMode?'disabled':''}>${['STRING','NUMBER','BOOLEAN','JSON'].map(x=>`<option value="${x}" ${selectedType===x?'selected':''}>${devLabel(x)}</option>`).join('')}</select></div><div class="devStorageField wide"><label>값</label><textarea id="devStorageValueInput" spellcheck="false">${devEsc(DEV_STATE.storageRawMode?selectedRaw:(selectedType==='JSON'?(()=>{try{return JSON.stringify(JSON.parse(selectedRaw),null,2)}catch(_){return selectedRaw}})():selectedRaw))}</textarea></div></div><div class="devActionBar"><button class="flowBtn primary" data-dev-storage-action="save">값 저장</button><button class="flowBtn" data-dev-storage-action="rename">저장 키 이름 변경</button><button class="flowBtn danger" data-dev-storage-action="delete">저장 키 삭제</button></div>`:'<div class="devEmpty">저장 키를 선택하거나 새로 추가하세요</div>'}
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>백업·가져오기·내보내기</b><span>현재 브라우저의 데이터만 사용</span></div><div class="devActionBar"><button class="flowBtn" data-dev-storage-action="snapshot">백업 만들기</button><button class="flowBtn" data-dev-storage-action="export">저장 데이터 내보내기</button><label class="flowBtn" style="display:flex;align-items:center;cursor:pointer">저장 데이터 가져오기<input id="devStorageImportFile" type="file" accept="application/json,.json" hidden></label><button class="flowBtn" data-dev-storage-action="export-config">개발 설정 내보내기</button><label class="flowBtn" style="display:flex;align-items:center;cursor:pointer">개발 설정 가져오기<input id="devConfigImportFile" type="file" accept="application/json,.json" hidden></label></div>${previewHTML}${cfgHTML}</div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>최근 백업</b><span>최대 5개</span></div><div class="devSnapshotList">${snapRows}</div></div>
	<div class="devEditorSection"><div class="devEditorSectionHead"><b>저장 데이터 검사</b><span>검사와 복구는 별도 작업입니다</span></div><div class="devStatusLine ${validation.ok?'ok':'bad'}">${validation.ok?'저장 데이터 형식이 정상입니다.':validation.errors.slice(0,12).map(devEsc).join('<br>')}</div><div class="devActionBar"><button class="flowBtn" data-dev-storage-action="validate-save">저장 데이터 검사</button><button class="flowBtn amber" data-dev-storage-action="repair-save">저장 데이터 복구</button></div></div>
	<div class="devRecoveryPanel"><h3>문제 발생 시 복구</h3><p>저장 데이터나 실행 중 변경값에 문제가 있을 때 사용하세요. 안전 시작과 실행 중 변경값 초기화는 진행도를 삭제하지 않습니다.</p><div class="devActionBar"><button class="flowBtn" data-dev-storage-action="view-raw">원본 데이터 보기</button><button class="flowBtn" data-dev-storage-action="recovery-export">저장 데이터 내보내기</button><button class="flowBtn" data-dev-storage-action="reset-runtime">실행 중 변경값 초기화</button><button class="flowBtn amber" data-dev-storage-action="safe-start">기본 설정으로 안전 시작</button></div></div>
	<div class="devDangerZone"><div class="devEditorSectionHead"><b>데이터 초기화</b><span>확인 문구를 입력해야 실행됩니다</span></div><div class="devActionGrid"><button class="flowBtn danger" data-dev-storage-action="clear-game">게임 저장소 비우기</button><button class="flowBtn danger" data-dev-storage-action="reset-save">게임 진행도 초기화</button><button class="flowBtn danger" data-dev-storage-action="restore-defaults">브라우저 저장값 전체 초기화</button></div></div></section></div>`
}
function devPerformanceHTML(){const solver=lastFullAnalysis?.solveTimeMs??sim?.last?.solveTimeMs??0,frame=DEV_PERF.frameMs||0,render=DEV_PERF.renderMs||0,physics=DEV_PERF.physicsMs||0;const rows=[['FPS',DEV_STATE.fps,60],['프레임 처리 시간',frame,33.3],['구조 해석 시간',solver,16.7],['물리 연산 시간',physics,16.7],['화면 그리기 시간',render,16.7]];return `${devSectionHeader('성능','현재 프레임 속도와 구조 해석·물리 연산·화면 그리기의 실제 처리 시간을 확인합니다.','13 // 성능')}<div class="devMetricGrid">${devMetric('FPS',Math.round(DEV_STATE.fps||0))}${devMetric('프레임 처리 시간',`${frame.toFixed(2)} ms`)}${devMetric('구조 해석 시간',solver?`${solver.toFixed(2)} ms`:'—')}${devMetric('물리 연산 시간',physics?`${physics.toFixed(2)} ms`:'—')}${devMetric('화면 그리기 시간',render?`${render.toFixed(2)} ms`:'—')}${devMetric('관절 수',nodes.length)}${devMetric('부재 수',members.length)}${devMetric('시뮬레이션 상태',sim?.mode||'IDLE')}</div><div class="devPerfBars">${rows.map(([n,v,max])=>`<div class="devPerfBar"><span>${n}</span><b>${n==='FPS'?Math.round(v):Number(v).toFixed(2)}</b><div class="devPerfTrack"><i style="width:${clamp((Number(v)||0)/max*100,0,100)}%"></i></div></div>`).join('')}</div><div class="devEditorSection"><div class="devEditorSectionHead"><b>구조 해석 성능 측정</b><span>시험용 행렬로 측정 · 저장 데이터 변경 없음</span></div><div class="devActionBar">${[10,25,50,100].map(n=>`<button class="flowBtn" data-dev-benchmark="${n}">관절 ${n}개</button>`).join('')}</div><table class="devMiniTable"><thead><tr><th>관절 수</th><th>자유도</th><th>소요 시간</th><th>상태</th></tr></thead><tbody>${Object.entries(DEV_PERF.benchmarks).map(([n,r])=>`<tr><td>${n}</td><td>${r.dof}</td><td>${r.ms.toFixed(2)} ms</td><td>${devLabel(r.ok?'SOLVED':'FAILED')}</td></tr>`).join('')||'<tr><td colspan="4">아직 성능을 측정하지 않았습니다</td></tr>'}</tbody></table></div>`}
function devRunSolverBenchmark(nodeCount){if(!devRequire('SOLVER BENCHMARK'))return false;const dof=Math.max(2,Math.round(nodeCount)*2),A=Array.from({length:dof},(_,i)=>Array.from({length:dof},(_,j)=>i===j?4:(Math.abs(i-j)===1?-1:0))),b=Array.from({length:dof},(_,i)=>1+(i%dof)*.001),t0=performance.now(),x=solve(A,b),ms=performance.now()-t0;DEV_PERF.benchmarks[nodeCount]={dof,ms,ok:!!x};devLogEvent('INFO','SIMULATION','SOLVER_BENCHMARK',{nodes:nodeCount,dof,ms});renderDevConsole();return !!x}
function devDebugHTML(){const flags=DEV_STATE.canvasDebug,log=DEV_EVENT_LOG.filter(e=>(DEV_STATE.eventFilter==='ALL'||e.category===DEV_STATE.eventFilter||e.severity===DEV_STATE.eventFilter)&&(!DEV_STATE.eventSearch||`${e.message} ${e.category} ${e.severity}`.toLowerCase().includes(DEV_STATE.eventSearch.toLowerCase()))).slice().reverse();const debugToggles={worldCoords:'SHOW WORLD COORDINATES',collisionBounds:'SHOW COLLISION BOUNDS',noBuildZones:'SHOW NO BUILD ZONES',clearance:'SHOW CLEARANCE',vehicleCollider:'SHOW VEHICLE COLLIDER',vesselCollider:'SHOW VESSEL COLLIDER',supportConstraints:'SHOW SUPPORT CONSTRAINTS'};return `${devSectionHeader('디버깅','캠페인 데이터를 검사하고 화면 진단·실행 기록·복구 기능을 사용합니다.','12 // 진단')}<div class="devActionGrid"><button class="flowBtn" data-dev-action="validate">캠페인 데이터 검사</button><button class="flowBtn" data-dev-action="debug">진단 표시 전환</button><button class="flowBtn amber" data-dev-debug-action="safe-start">기본 설정으로 안전 시작</button><button class="flowBtn" data-dev-debug-action="reset-runtime">실행 중 변경값 초기화</button></div><div class="devEditorSection"><div class="devEditorSectionHead"><b>게임 화면 진단 표시</b><span>현재 개발자 세션에만 적용</span></div><div class="devCanvasDebugGrid">${Object.entries(debugToggles).map(([k,t])=>`<label class="devCheck"><input type="checkbox" data-dev-canvas-debug="${k}" ${flags[k]?'checked':''}>${devLabel(t)}</label>`).join('')}${Object.entries({nodeIds:'SHOW NODE IDS',memberIds:'SHOW MEMBER IDS',lengths:'SHOW LENGTHS',force:'SHOW MEMBER FORCE',utilization:'SHOW UTILIZATION',reactions:'SHOW REACTIONS',loadVector:'SHOW LOAD VECTOR',original:'SHOW ORIGINAL SHAPE',deformed:'SHOW DEFORMED SHAPE'}).map(([k,t])=>`<label class="devCheck"><input type="checkbox" data-dev-solver-flag="${k}" ${DEV_STATE.solverFlags[k]?'checked':''}>${devLabel(t)}</label>`).join('')}</div></div><div class="devEditorSection"><div class="devEditorSectionHead"><b>실행 기록</b><span>최근 ${DEV_EVENT_LIMIT}건 · 현재 세션</span></div><div class="devLogToolbar"><input id="devEventSearch" placeholder="실행 기록 검색" value="${devEsc(DEV_STATE.eventSearch)}"><select id="devEventFilter">${['ALL','INFO','WARNING','ERROR','SIMULATION','STORAGE'].map(x=>`<option value="${x}" ${DEV_STATE.eventFilter===x?'selected':''}>${devLabel(x)}</option>`).join('')}</select><button class="flowBtn" data-dev-debug-action="clear-log">기록 지우기</button></div><div class="devEventLog">${log.map(e=>`<div class="devLogRow ${e.severity.toLowerCase()} ${e.category.toLowerCase()}"><time>${new Date(e.time).toLocaleTimeString()}</time><span class="sev">${devEsc(devLabel(e.severity))}</span><span class="cat">${devEsc(devLabel(e.category))}</span><span class="msg">${devEsc(e.message)}${e.data?` · ${devEsc(JSON.stringify(e.data).slice(0,220))}`:''}</span></div>`).join('')||'<div class="devEmpty">현재 세션의 실행 기록이 없습니다</div>'}</div></div>${devSimulationControlHTML()}`}
function devUIHTMLStep3(){return `${devSectionHeader('화면·접근성 미리보기','진행도를 변경하지 않고 화면과 접근성 설정을 확인합니다. 이 화면의 접근성 변경은 현재 세션에만 적용됩니다.','11 // 화면')}<div class="devMetricGrid">${devMetric('UI 모드',String(uiMode).toUpperCase())}${devMetric('마우스 검사 정보',String(inspectorMode||'basic').toUpperCase())}${devMetric('UI 크기',(Number(uiScale)||100)+'%')}${devMetric('화면',String(DEV_STATE.returnScreen||currentGameScreen).toUpperCase())}${devMetric('기본 설정으로 안전 시작',DEV_STATE.safeStart?'ACTIVE':'OFF')}${devMetric('키보드 탐색 표시',DEV_STATE.keyboardPreview?'ON':'OFF')}</div><div class="devEditorSection"><div class="devEditorSectionHead"><b>접근성 미리보기</b><span>현재 세션에만 적용</span></div><div class="devActionGrid"><button class="flowBtn" data-dev-a11y="reducedMotion">동작 줄이기 · ${accessibilityPrefs.reducedMotion?'ON':'OFF'}</button><button class="flowBtn" data-dev-a11y="highContrast">고대비 · ${accessibilityPrefs.highContrast?'ON':'OFF'}</button><button class="flowBtn" data-dev-a11y="colorblindStress">색각 보조 · ${accessibilityPrefs.colorblindStress?'ON':'OFF'}</button><button class="flowBtn" data-dev-a11y="largeText">큰 글자 · ${accessibilityPrefs.largeText?'ON':'OFF'}</button><button class="flowBtn" data-dev-a11y="keyboard">키보드 탐색 · ${DEV_STATE.keyboardPreview?'ON':'OFF'}</button></div></div>`}
function drawDevCanvasDiagnostics(analysis,physics){if(!devSessionActive())return;const f=DEV_STATE.canvasDebug;if(!Object.values(f).some(Boolean))return;ctx.save();ctx.font='800 8px ui-monospace,monospace';ctx.textBaseline='top';if(f.noBuildZones){ctx.setLineDash([6,5]);for(const r of stage.forbidden||[]){const q=r.kind==='navigation'?getNavigationEnvelope(r):r;ctx.strokeStyle=r.kind==='navigation'?'rgba(226,181,76,.9)':'rgba(238,92,105,.85)';ctx.strokeRect(q.x,q.y,q.w,q.h)}ctx.setLineDash([])}if(f.clearance){const r=(stage.forbidden||[]).find(x=>x.kind==='navigation');if(r){const q=getNavigationEnvelope(r);ctx.fillStyle='rgba(226,181,76,.08)';ctx.fillRect(q.x,q.y,q.w,q.h);ctx.strokeStyle='#e2b54c';ctx.strokeRect(q.x,q.y,q.w,q.h)}}if(f.supportConstraints){for(const n of nodes.filter(n=>n.support)){ctx.strokeStyle=n.support==='pin'?'#62e1ae':'#5ca9c9';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(n.x,n.y,18,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.fillText(n.support.toUpperCase(),n.x+20,n.y-4)}}if(f.worldCoords&&pointerWorld){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.setLineDash([3,4]);line({x:pointerWorld.x-60,y:pointerWorld.y},{x:pointerWorld.x+60,y:pointerWorld.y});line({x:pointerWorld.x,y:pointerWorld.y-60},{x:pointerWorld.x,y:pointerWorld.y+60});ctx.setLineDash([]);ctx.fillStyle='#dbe5e8';ctx.fillText(`X ${pointerWorld.x.toFixed(1)} / Y ${pointerWorld.y.toFixed(1)}`,pointerWorld.x+8,pointerWorld.y+8)}if(f.vehicleCollider){let x=stage.deck[0][0],y=guideDeckYAt(x)-28;if(physics?.vehicle){x=physics.vehicle.x;y=physics.vehicle.y;const w=physics.vehicle.length||80,h=42;ctx.strokeStyle='#69b7f0';ctx.strokeRect(x-w*.5,y-h*.5,w,h)}else if(sim){const p=sim.progress||0;x=stage.deck[0][0]+p*(stage.deck.at(-1)[0]-stage.deck[0][0]);y=guideDeckYAt(x)-30;const w=stage.vehicleLength||80;ctx.strokeStyle='#69b7f0';ctx.strokeRect(x-w*.5,y-22,w,44)}}if(f.vesselCollider&&stage.ship){const env=(stage.forbidden||[]).find(r=>r.kind==='navigation');if(env){const q=getNavigationEnvelope(env);ctx.strokeStyle='#f0b95b';ctx.setLineDash([4,3]);ctx.strokeRect(q.x,q.y,q.w,q.h);ctx.setLineDash([])}}if(f.collisionBounds){for(const m of members.filter(m=>m.road)){const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)continue;ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=(MAT[m.mat]?.roadWidth||16)+8;line(a,b)}}ctx.restore()}
function devRunConsoleSearch(query){const q=String(query||'').trim().toLowerCase();if(!q)return false;let m=q.match(/(?:level|contract|스테이지|계약|레벨)\s*(\d+)/);if(m){const n=Number(m[1]),l=allMainLevels().find(x=>x.globalNumber===n);if(l){DEV_STATE.selectedLevelId=l.id;return devRequestSectionChange('levels')}}const map=[['중력','physics'],['물리','physics'],['재료','materials'],['목재','materials'],['강철','materials'],['차량','vehicles'],['트럭','vehicles'],['별','progression'],['배지','progression'],['진행','progression'],['저장','storage'],['백업','storage'],['성능','performance'],['디버깅','debug'],['관절','solver'],['해석','solver'],['샌드박스','sandbox'],['캠페인','campaigns'],['접근성','ui'],['화면','ui'],['스테이지','levels'],['gravity','physics'],['physics','physics'],['material','materials'],['wood','materials'],['steel','materials'],['vehicle','vehicles'],['truck','vehicles'],['stars','progression'],['badge','progression'],['save','storage'],['storage','storage'],['backup','storage'],['snapshot','storage'],['fps','performance'],['performance','performance'],['debug','debug'],['node ids','solver'],['solver','solver'],['sandbox','sandbox'],['campaign','campaigns'],['accessibility','ui']];const hit=map.find(([k])=>q.includes(k));if(hit)return devRequestSectionChange(hit[1]);toast('설정을 찾지 못했습니다. 메뉴 이름이나 스테이지 번호로 검색하세요.');return false}
function devRunCommand(command){const q=String(command||'').trim().toLowerCase();if(!q)return false;if(q==='unlock all'){devRunAction('unlock-all');return true}if(q==='reset physics'){Object.assign(DEV_PHYSICS_TUNING,devDeepClone(DEV_DEFAULTS.physics));toast('물리 설정을 초기화했습니다.');return true}if(q==='show node ids'){DEV_STATE.solverFlags.nodeIds=true;draw();return true}if(q==='safe start')return devSafeStart();if(q==='storage')return devRequestSectionChange('storage');const m=q.match(/level\s*(\d+)/);if(m)return devRunConsoleSearch(q);toast('DEV COMMAND // UNKNOWN');return false}
function devStorageAction(action){if(action==='add')return devAddStorageKey();if(action==='raw'){DEV_STATE.storageRawMode=!DEV_STATE.storageRawMode;renderDevConsole();return true}if(action==='save')return devSaveStorageEditor();if(action==='rename')return devRenameStorageKey();if(action==='delete')return devDeleteStorageKey();if(action==='snapshot'){devCreateSnapshot('MANUAL');renderDevConsole();return true}if(action==='export'||action==='recovery-export')return devStorageExport();if(action==='apply-import')return devApplyStorageImport();if(action==='discard-import'){DEV_STATE.storageImportPreview=null;devClearPendingChange();renderDevConsole();return true}if(action==='export-config')return devExportConfig();if(action==='apply-config')return devApplyConfigImport();if(action==='discard-config'){DEV_STATE.configImportPreview=null;devClearPendingChange();renderDevConsole();return true}if(action==='validate-save'){const r=devValidateSaveObject(playerProgress);toast(r.ok?'저장 데이터가 정상입니다.':`저장 데이터에서 오류 ${r.errors.length}건을 발견했습니다.`);devLogEvent(r.ok?'INFO':'WARNING','STORAGE','SAVE_VALIDATED',{errors:r.errors});renderDevConsole();return r.ok}if(action==='repair-save')return devRepairSave();if(action==='view-raw'){DEV_STATE.storageRawMode=true;renderDevConsole();return true}if(action==='reset-runtime'){devResetRuntimeOverrides();toast('실행 중 변경값을 초기화했습니다.');renderDevConsole();return true}if(action==='safe-start')return devSafeStart();if(action==='clear-game')return devClearGameStorage();if(action==='reset-save')return devResetGameSave();if(action==='restore-defaults')return devRestoreStorageDefaults();return false}
function devDebugAction(action){if(action==='safe-start')return devSafeStart();if(action==='reset-runtime'){devResetRuntimeOverrides();toast('실행 중 변경값을 초기화했습니다.');renderDevConsole();return true}if(action==='clear-log'){DEV_EVENT_LOG.length=0;renderDevConsole();return true}return false}
function devToggleA11y(key){if(key==='keyboard'){DEV_STATE.keyboardPreview=!DEV_STATE.keyboardPreview;document.body.classList.toggle('dev-keyboard-preview',DEV_STATE.keyboardPreview)}else{accessibilityPrefs[key]=!accessibilityPrefs[key];applyAccessibilitySettings()}renderDevConsole()}
const devReadOnlySectionHTMLStep2=devReadOnlySectionHTML;
devReadOnlySectionHTML=function(section){if(section==='storage')return devStorageHTML();if(section==='debug')return devDebugHTML();if(section==='performance')return devPerformanceHTML();if(section==='ui')return devUIHTMLStep3();return devReadOnlySectionHTMLStep2(section)};
const renderDevConsoleStep2=renderDevConsole;
renderDevConsole=function(){renderDevConsoleStep2();const c=$('#devConsoleContent');if(c&&DEV_STATE.pendingChange)c.insertAdjacentHTML('afterbegin',devUnsavedBannerHTML());$$('[data-dev-pending]').forEach(b=>b.onclick=()=>b.dataset.devPending==='apply'?devApplyPendingChanges():devDiscardPendingChanges())};
const bindDevConsoleDynamicActionsStep2=bindDevConsoleDynamicActions;
bindDevConsoleDynamicActions=function(){bindDevConsoleDynamicActionsStep2();
	$$('[data-dev-storage-select]').forEach(b=>b.onclick=()=>{if(!devResolveUnsavedForNavigation())return;DEV_STATE.selectedStorageKey=b.dataset.devStorageSelect;renderDevConsole()});
	$('#devStorageSearch')?.addEventListener('input',e=>{DEV_STATE.storageSearch=e.target.value;renderDevConsole()});$('#devStorageFilter')?.addEventListener('change',e=>{DEV_STATE.storageFilter=e.target.value;renderDevConsole()});
	$$('[data-dev-storage-action]').forEach(b=>b.onclick=()=>devStorageAction(b.dataset.devStorageAction));$$('[data-dev-restore-snapshot]').forEach(b=>b.onclick=()=>devRestoreSnapshot(b.dataset.devRestoreSnapshot));
	const markStorageDraft=()=>{const sel=devStorageSelected();if(!sel)return;devSetPendingChange('storage-edit',{originalKey:sel.key,key:$('#devStorageKeyInput')?.value||sel.key,type:$('#devStorageTypeInput')?.value||sel.type,value:$('#devStorageValueInput')?.value??sel.value})};$('#devStorageKeyInput')?.addEventListener('input',markStorageDraft);$('#devStorageTypeInput')?.addEventListener('change',markStorageDraft);$('#devStorageValueInput')?.addEventListener('input',markStorageDraft);
	$('#devStorageImportFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{devPrepareStorageImport(JSON.parse(await f.text()))}catch(err){toast('JSON 형식이 올바르지 않아 가져오지 못했습니다.');devLogEvent('ERROR','STORAGE','IMPORT_JSON_INVALID')}});$('#devConfigImportFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{devPrepareConfigImport(devDeserialize(await f.text()))}catch(err){toast('개발 설정의 JSON 형식이 올바르지 않습니다.');devLogEvent('ERROR','STORAGE','CONFIG_JSON_INVALID')}});
	$$('[data-dev-benchmark]').forEach(b=>b.onclick=()=>devRunSolverBenchmark(Number(b.dataset.devBenchmark)));$$('[data-dev-debug-action]').forEach(b=>b.onclick=()=>devDebugAction(b.dataset.devDebugAction));$$('[data-dev-canvas-debug]').forEach(el=>el.onchange=()=>{DEV_STATE.canvasDebug[el.dataset.devCanvasDebug]=el.checked;draw()});
	$('#devEventSearch')?.addEventListener('input',e=>{DEV_STATE.eventSearch=e.target.value;renderDevConsole()});$('#devEventFilter')?.addEventListener('change',e=>{DEV_STATE.eventFilter=e.target.value;renderDevConsole()});$$('[data-dev-a11y]').forEach(b=>b.onclick=()=>devToggleA11y(b.dataset.devA11y));
};
const drawStep2=draw;
draw=function(){const t0=performance.now();drawStep2();DEV_PERF.renderMs=DEV_PERF.renderMs*.82+(performance.now()-t0)*.18;const physics=sim?.mode==='collapse'?sim.physics:null,analysis=physics?null:(sim?.last?.ok?sim.last:lastFullAnalysis?.ok?lastFullAnalysis:null);ctx.save();const r=canvas.getBoundingClientRect();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.scale(r.width/W,r.height/H);applyCamera();drawDevCanvasDiagnostics(analysis,physics);ctx.restore()};
const stepCollapsePhysicsStep2=stepCollapsePhysics;
stepCollapsePhysics=function(physics,dt){const t0=performance.now(),wasAttached=!!physics?.vehicle?.attached;const r=stepCollapsePhysicsStep2(physics,dt);DEV_PERF.physicsMs=DEV_PERF.physicsMs*.8+(performance.now()-t0)*.2;if(wasAttached&&physics?.vehicle&&!physics.vehicle.attached)devLogEvent('WARNING','SIMULATION','VEHICLE_CONTACT_LOST',{x:physics.vehicle.x,y:physics.vehicle.y});return r};
const devMonitorFrameStep2=devMonitorFrame;
devMonitorFrame=function(t){const dt=t-DEV_PERF.lastFrameAt;if(Number.isFinite(dt)&&dt>0)DEV_PERF.frameMs=DEV_PERF.frameMs*.85+dt*.15;DEV_PERF.lastFrameAt=t;return devMonitorFrameStep2(t)};
const savePlayerProgressStep2=savePlayerProgress;
savePlayerProgress=function(){const r=savePlayerProgressStep2();devLogEvent('INFO','STORAGE','SAVE_WRITTEN',{key:PLAYER_PROGRESS_KEY});return r};
const resetStageStep2=resetStage;
resetStage=function(idx=stageIndex){const r=resetStageStep2(idx);devLogEvent('INFO','SIMULATION','LEVEL_LOADED',{level:currentCampaignLevelId||stage?.title,index:idx});return r};
const startSimulationStep2=startSimulation;
startSimulation=function(fromTutorial=false){devLogEvent('INFO','SIMULATION','TEST_STARTED',{level:currentCampaignLevelId||stage?.title});return startSimulationStep2(fromTutorial)};
const enterCollapseModeStep2=enterCollapseMode;
enterCollapseMode=function(s,reason,analysis,progress,now=performance.now()){devLogEvent('WARNING','SIMULATION','PBD_STARTED',{reason,progress});return enterCollapseModeStep2(s,reason,analysis,progress,now)};
const finishSimulationStep2=finishSimulation;
finishSimulation=function(vehicleSuccess){devLogEvent(vehicleSuccess?'INFO':'WARNING','SIMULATION','TEST_FINISHED',{vehiclePass:!!vehicleSuccess,mode:sim?.mode||'unknown',broken:sim?.brokenCount||0});return finishSimulationStep2(vehicleSuccess)};
const devRunMemberActionStep2=devRunMemberAction;
devRunMemberAction=function(action){if(action==='break')devLogEvent('WARNING','SIMULATION','MEMBER_BROKEN // DEV',{member:hoverMember?.id});return devRunMemberActionStep2(action)};
const devBreakHoveredMemberStep2=devBreakHoveredMember;
devBreakHoveredMember=function(){if(hoverMember)devLogEvent('WARNING','SIMULATION','MEMBER_BROKEN // QUICK',{member:hoverMember.id});return devBreakHoveredMemberStep2()};
const devRunProgressActionStep2=devRunProgressAction;
devRunProgressAction=function(action){if(['unlock-all-persistent','complete-all','reset-campaign','reset-tutorial','reset-education','reset-records','reset-everything'].includes(action))devCreateSnapshot(`AUTO // BEFORE ${String(action).toUpperCase()}`,{silent:true});return devRunProgressActionStep2(action)};
window.addEventListener('error',e=>{if(devSessionActive())devLogEvent('ERROR','ERROR','WINDOW.ERROR',{message:e.message,source:e.filename,line:e.lineno,column:e.colno})});window.addEventListener('unhandledrejection',e=>{if(devSessionActive())devLogEvent('ERROR','ERROR','UNHANDLEDREJECTION',{reason:String(e.reason?.message||e.reason||'unknown')})});
const initDeveloperModeStep2=initDeveloperMode;
initDeveloperMode=function(){initDeveloperModeStep2();$('#devSettingsSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();devRunConsoleSearch(e.target.value)}});document.addEventListener('keydown',e=>{if(!devSessionActive())return;if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();const cmd=prompt('TRUSS LAB DEV COMMAND\nExamples: unlock all · level 16 · reset physics · show node ids · safe start','');if(cmd)devRunCommand(cmd)}})};
const updateDevDebugOverlayStep2=updateDevDebugOverlay;
updateDevDebugOverlay=function(){const el=$('#devDebugOverlay');if(!el||!DEV_STATE.debugOverlay||!devSessionActive())return;const c=devCurrentContext(),parts=['<b>TRUSS LAB // DEV DEBUG</b>',`SCREEN ${String(currentGameScreen).toUpperCase()}`,`FPS ${Math.round(DEV_STATE.fps)} · FRAME ${DEV_PERF.frameMs.toFixed(2)}ms`,`RENDER ${DEV_PERF.renderMs.toFixed(2)}ms · PHYS ${DEV_PERF.physicsMs.toFixed(2)}ms`,`SOLVER ${(lastFullAnalysis?.solveTimeMs??sim?.last?.solveTimeMs??0).toFixed(2)}ms`,`NODES ${nodes?.length||0} / MEMBERS ${members?.length||0}`,`LEVEL ${c.level?.id||'—'}`,`VEHICLE ${sim?.progress!=null?(sim.progress*100).toFixed(1)+'%':'—'}`,`LOAD ${stage?.load!=null?(stage.load/1000).toFixed(1)+' kN':'—'}`,`SIM ${sim?.mode||'IDLE'}`];el.innerHTML=parts.join('<br>')};

const assembleStep2=assemble;
assemble=function(loadX,broken=new Set()){const a=assembleStep2(loadX,broken);if(devSessionActive()){const now=performance.now();if(!DEV_STATE.lastStaticSolveLogAt||now-DEV_STATE.lastStaticSolveLogAt>700){DEV_STATE.lastStaticSolveLogAt=now;devLogEvent(a?.ok?'INFO':'WARNING','SIMULATION','STATIC_SOLVE',{ok:!!a?.ok,solveTimeMs:a?.solveTimeMs??null,maxDeflection:a?.maxDefl??null,maxUtilization:a?.maxRatio??null})}}return a};
const recordCampaignResultStep2=recordCampaignResult;
recordCampaignResult=function(success,s,score,starCount,stageTimeMs){const level=currentCampaignLevel(),before=level?levelProgressFor(level.id):null,priorStars=before?.stars||0;const r=recordCampaignResultStep2(success,s,score,starCount,stageTimeMs);if(success&&level){const after=levelProgressFor(level.id);devLogEvent('INFO','INFO','LEVEL_COMPLETE',{level:level.id,grade:after.bestGrade||null});if((after.stars||0)>priorStars)devLogEvent('INFO','INFO','STAR_EARNED',{level:level.id,stars:after.stars})}return r};
window.TRUSSLAB_DEV.storage={snapshot:()=>devGuard(()=>devCreateSnapshot('API'),'CREATE SNAPSHOT')(),export:()=>devGuard(devStorageExport,'EXPORT STORAGE')(),validate:()=>devGuard(()=>devValidateSaveObject(playerProgress),'VALIDATE SAVE')(),repair:()=>devGuard(devRepairSave,'REPAIR SAVE')(),safeStart:()=>devGuard(devSafeStart,'SAFE START')()};
window.TRUSSLAB_DEV.config={export:()=>devGuard(devExportConfig,'EXPORT DEV CONFIG')(),reset:()=>devGuard(()=>devResetRuntimeOverrides(),'RESET RUNTIME OVERRIDES')()};



/* ===== SMART AI BRIDGE CHAT // WebLLM + Cloudflare Workers AI ===== */
const LOCAL_AI_MODEL_INFO={
  'Phi-4-mini-instruct-q4f16_1-MLC':{label:'Phi-4 Mini',vram:3438},
  'Llama-3.2-3B-Instruct-q4f16_1-MLC':{label:'Llama 3.2 3B',vram:2264},
  'Llama-3.1-8B-Instruct-q4f16_1-MLC':{label:'Llama 3.1 8B',vram:5001}
};
const LOCAL_AI_DEFAULT_MODEL='Phi-4-mini-instruct-q4f16_1-MLC';
const localAiUI={
  dock:$('#localAiDock'),panel:$('#localAiPanel'),tab:$('#localAiTab'),close:$('#localAiCloseBtn'),clear:$('#localAiClearBtn'),mode:$('#localAiModeSelect'),
  localControls:$('#localAiLocalControls'),onlineControls:$('#localAiOnlineControls'),model:$('#localAiModelSelect'),download:$('#localAiDownloadBtn'),
  endpoint:$('#localAiEndpointInput'),onlineCheck:$('#localAiOnlineCheckBtn'),progress:$('#localAiProgressFill'),status:$('#localAiStatusText'),
  device:$('#localAiDeviceText'),messages:$('#localAiMessages'),input:$('#localAiInput'),send:$('#localAiSendBtn')
};
let localAiWebLLM=null,localAiEngine=null,localAiLoadedModel='',localAiBusy=false,localAiHistory=[];
let localAiMode=localStorage.getItem('trusslab-ai-mode')||'local';

function localAiSetOpen(open){
  localAiUI.dock?.classList.toggle('open',!!open);
  localAiUI.tab?.setAttribute('aria-expanded',open?'true':'false');
  localAiUI.panel.inert=!open;
  localAiUI.panel.setAttribute('aria-hidden',String(!open));
  if(open)setTimeout(()=>localAiUI.input?.focus(),90);
}
function localAiSyncTutorialVisibility(){
  const inTutorial=document.body.classList.contains('tutorial-mode');
  if(localAiUI.dock){
    localAiUI.dock.setAttribute('aria-hidden',inTutorial?'true':'false');
    if('inert' in localAiUI.dock)localAiUI.dock.inert=inTutorial;
  }
  if(inTutorial&&localAiUI.dock?.classList.contains('open'))localAiSetOpen(false);
}
function localAiSetStatus(text,tone=''){
  if(localAiUI.status)localAiUI.status.textContent=text;
  if(localAiUI.device){localAiUI.device.classList.remove('ok','warn','bad');if(tone)localAiUI.device.classList.add(tone)}
}
function localAiSetBusy(busy){
  localAiBusy=!!busy;
  if(localAiUI.send)localAiUI.send.disabled=localAiBusy;
  if(localAiUI.download)localAiUI.download.disabled=localAiBusy;
  if(localAiUI.model)localAiUI.model.disabled=localAiBusy;
}
function localAiEsc(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function localAiAddMessage(role,text){
  if(!localAiUI.messages)return null;
  const box=document.createElement('div');box.className=`localAiMsg ${role}`;
  const who=role==='user'?'YOU':role==='assistant'?'LOCAL AI':'SYSTEM';
  box.innerHTML=`<span class="who">${who}</span><span class="localAiMsgText">${localAiEsc(text)}</span>`;
  localAiUI.messages.appendChild(box);localAiUI.messages.scrollTop=localAiUI.messages.scrollHeight;return box.querySelector('.localAiMsgText');
}
function localAiResetChat(){
  localAiHistory=[];
  if(localAiUI.messages)localAiUI.messages.innerHTML='<div class="localAiMsg system"><span class="who">LOCAL AI // CHAT RESET</span>새 대화를 시작합니다. 현재 게임 상태는 질문을 보낼 때마다 다시 읽습니다.</div>';
}
function localAiMaterialSummary(){
  const counts={wood:0,steel:0,cable:0,road:0,roadHeavy:0};
  for(const m of members||[])if(m?.user&&m.mat in counts)counts[m.mat]++;
  return `목재 ${counts.wood}, 강철 ${counts.steel}, 케이블 ${counts.cable}, 일반도로 ${counts.road}, 강화도로 ${counts.roadHeavy}`;
}
function localAiCriticalMembers(a,limit=5){
  if(!a?.ok||!a.forces?.get)return [];
  return (members||[]).filter(m=>m?.user&&a.forces.has(m.id)).map(m=>{
    const info=a.forces.get(m.id)||{},aa=nodeById(m.a),bb=nodeById(m.b);
    return {id:m.id,mat:m.mat,ratio:Number(info.ratio)||0,force:Number(info.force)||0,capacity:Number(info.capacity)||0,
      governing:info.governing||'—',length:Number(info.length)||Math.hypot((aa?.x||0)-(bb?.x||0),(aa?.y||0)-(bb?.y||0))};
  }).sort((x,y)=>y.ratio-x.ratio).slice(0,limit);
}
function localAiBridgeContext(){
  const a=lastFullAnalysis?.ok?lastFullAnalysis:(sim?.last?.ok?sim.last:(currentAnalysis?.ok?currentAnalysis:null));
  const mode=sim?.mode?String(sim.mode).toUpperCase():'BUILD';
  const budget=Number(stage?.budget)||0,cost=Number(totalCost)||0;
  const critical=localAiCriticalMembers(a,5);
  const supportRows=a?.reactions instanceof Map?[...a.reactions.entries()].map(([id,r])=>`#${id}: Rx=${(Number(r.rx)||0).toFixed(0)}, Ry=${(Number(r.ry)||0).toFixed(0)}`).join(' / '):'데이터 없음';
  const lines=[
    '[TRUSS LAB CURRENT STATE]',
    `screen=${String(currentGameScreen||'game')}`,
    `stage_name=${stage?.name||'—'}`,
    `stage_title=${stage?.title||'—'}`,
    `stage_type=${stage?.type||'—'}`,
    `goal=${stage?.goal||'—'}`,
    `vehicle_load=${stage?.load?`${(stage.load/1000).toFixed(2)} kN`:'—'}`,
    `cost=${Math.round(cost)} / budget=${Math.round(budget)} / budget_used=${budget?Math.round(cost/budget*100):0}%`,
    `nodes=${nodes?.length||0} / members=${members?.length||0} / triangles=${triangleCount()}`,
    `materials=${localAiMaterialSummary()}`,
    `test_mode=${mode}`
  ];
  if(a?.ok){
    lines.push('analysis_status=stable');
    lines.push(`max_utilization=${((a.maxRatio||0)*100).toFixed(1)}%`);
    lines.push(`max_deflection=${(a.maxDefl||0).toFixed(2)} u`);
    lines.push(`deck_deflection=${(a.deckDeflection||0).toFixed(2)} u`);
    lines.push(`deck_curvature=${(a.deckCurvature||0).toFixed(3)} deg/100u`);
    lines.push(`load_x=${Number(a.loadX||0).toFixed(1)} u`);
    lines.push(`support_reactions=${supportRows}`);
    if(critical.length){
      lines.push('[TOP CRITICAL MEMBERS]');
      critical.forEach((m,i)=>lines.push(`${i+1}. member #${m.id} / ${MAT[m.mat]?.name||m.mat} / ${m.force<0?'COMPRESSION':'TENSION'} / utilization=${(m.ratio*100).toFixed(1)}% / force=${Math.abs(m.force).toFixed(0)} / capacity=${m.capacity.toFixed(0)} / length=${m.length.toFixed(1)} / governing=${m.governing}`));
    }
  }else if(currentAnalysis&&!currentAnalysis.ok){
    lines.push('analysis_status=unstable_or_failed');
  }else{
    lines.push('analysis_status=no_analysis_data');
  }
  if(stage?.maxDefl!=null)lines.push(`stage_serviceability_limit=${Number(stage.maxDefl).toFixed(1)} u`);
  if(stage?.forbidden?.length)lines.push(`restricted_zones=${stage.forbidden.length}`);
  return lines.join('\n');
}
function localAiSystemPrompt(){
  return `당신은 TRUSS LAB 전용 교량 구조공학 학습 코치입니다. 반드시 한국어 존댓말로 답하세요.

절대 규칙:
1. 아래 CURRENT STATE에 없는 숫자나 부재 상태를 지어내지 마세요.
2. 사용자가 현재 다리를 묻는다면 일반론보다 CURRENT STATE의 수치와 critical member를 먼저 근거로 사용하세요.
3. 축력의 부호가 음수면 압축(COMPRESSION), 양수면 인장(TENSION)으로 해석하세요.
4. utilization은 |force|/capacity 비율입니다. 100%에 가까울수록 여유가 작습니다.
5. 압축재는 재료 강도뿐 아니라 길이에 따른 좌굴이 지배할 수 있습니다. governing 값을 확인하세요.
6. 해석 데이터가 없으면 설계를 단정하지 말고 구조 스캔 또는 시험을 먼저 권하세요.
7. 게임 계산값은 실제 교량의 안전 인증이 아닙니다.
8. 질문과 관계없는 긴 교과서 설명을 하지 마세요.

설계 진단 질문에는 가능하면 다음 순서로 답하세요.
- 문제점: 가장 중요한 것 1~3개
- 근거: CURRENT STATE의 실제 수치/부재 ID
- 수정 방법: 게임에서 바로 시도할 수 있는 행동
- 예상 효과: 어떤 수치가 내려가거나 하중 경로가 개선될지

${localAiBridgeContext()}`;
}
function localAiNormalizeEndpoint(raw){return String(raw||'').trim().replace(/\/+$/,'')}
function localAiSetMode(mode,{quiet=false}={}){
  localAiMode=mode==='online'?'online':'local';
  localStorage.setItem('trusslab-ai-mode',localAiMode);
  if(localAiUI.mode)localAiUI.mode.value=localAiMode;
  if(localAiUI.localControls)localAiUI.localControls.hidden=localAiMode!=='local';
  if(localAiUI.onlineControls)localAiUI.onlineControls.hidden=localAiMode!=='online';
  if(localAiUI.device){
    localAiUI.device.classList.remove('ok','warn','bad');
    if(localAiMode==='online'){localAiUI.device.textContent='ONLINE · GEMMA 4';localAiUI.device.classList.add('ok')}
    else if(!navigator.gpu){localAiUI.device.textContent='NO WEBGPU';localAiUI.device.classList.add('bad')}
    else{localAiUI.device.textContent='WEBGPU READY';localAiUI.device.classList.add('ok')}
  }
  if(!quiet)localAiSetStatus(localAiMode==='online'?'Cloudflare Worker 주소를 입력하면 Gemma 4 26B를 사용합니다. API 키는 페이지에 넣지 않습니다.':'Phi-4 Mini가 기본 모델입니다. GPU 메모리가 부족하면 Llama 3.2 3B를 선택하세요.',localAiMode==='online'?'ok':'');
}
async function localAiCheckOnline(){
  const endpoint=localAiNormalizeEndpoint(localAiUI.endpoint?.value);
  if(!endpoint){localAiSetStatus('Cloudflare Worker 주소를 먼저 입력하세요.','bad');return false}
  localStorage.setItem('trusslab-ai-endpoint',endpoint);localAiSetBusy(true);localAiSetStatus('온라인 AI 연결을 확인하는 중…','warn');
  try{
    const r=await fetch(`${endpoint}/health`,{method:'GET'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json().catch(()=>({}));localAiSetStatus(`온라인 AI 연결 완료 · ${data.model||'Gemma 4 26B'}`,'ok');localAiUI.tab?.classList.add('ready');return true;
  }catch(err){localAiSetStatus(`온라인 AI에 연결하지 못했습니다: ${err?.message||String(err)}`,'bad');return false}
  finally{localAiSetBusy(false)}
}
async function localAiGetWebLLM(){
  if(localAiWebLLM)return localAiWebLLM;
  localAiSetStatus('WebLLM 모듈을 불러오는 중…','warn');
  localAiWebLLM=await import('https://esm.run/@mlc-ai/web-llm');
  return localAiWebLLM;
}
async function localAiLoadModel(){
  if(localAiBusy)return false;
  localAiSetOpen(true);
  const modelId=localAiUI.model?.value||LOCAL_AI_DEFAULT_MODEL;
  if(localAiEngine&&localAiLoadedModel===modelId){localAiSetStatus('모델이 이미 준비되어 있습니다.','ok');return true}
  if(!navigator.gpu){
    localAiSetStatus('이 브라우저에서 WebGPU를 찾지 못했습니다. 최신 Chrome/Edge 계열 브라우저를 확인하세요.','bad');
    if(localAiUI.device)localAiUI.device.textContent='WEBGPU UNSUPPORTED';
    localAiAddMessage('system','WebGPU를 사용할 수 없어 로컬 AI를 실행할 수 없습니다.');return false;
  }
  localAiSetBusy(true);
  if(localAiUI.download)localAiUI.download.textContent='다운로드 중…';
  if(localAiUI.progress)localAiUI.progress.style.width='1%';
  try{
    const adapter=await navigator.gpu.requestAdapter();
    if(!adapter)throw new Error('WebGPU adapter를 만들 수 없습니다.');
    if(localAiUI.device)localAiUI.device.textContent='WEBGPU READY';
    const webllm=await localAiGetWebLLM();
    if(localAiEngine){try{await localAiEngine.unload()}catch(_){}localAiEngine=null;localAiLoadedModel=''}
    const cacheBackend=location.protocol==='file:'?'indexeddb':'cache';
    const appConfig={...webllm.prebuiltAppConfig,cacheBackend};
    const info=LOCAL_AI_MODEL_INFO[modelId];
    localAiSetStatus(`${info?.label||modelId} 모델 준비 중 · 첫 실행은 큰 파일을 내려받습니다.`,'warn');
    localAiEngine=await webllm.CreateMLCEngine(modelId,{
      appConfig,
      initProgressCallback:(report)=>{
        const p=Number(report?.progress);
        if(localAiUI.progress&&Number.isFinite(p))localAiUI.progress.style.width=`${Math.max(1,Math.min(100,p*100))}%`;
        if(report?.text&&localAiUI.status)localAiUI.status.textContent=report.text;
      }
    },{context_window_size:3072});
    localAiLoadedModel=modelId;
    localStorage.setItem('trusslab-local-ai-model',modelId);
    if(localAiUI.progress)localAiUI.progress.style.width='100%';
    if(localAiUI.download)localAiUI.download.textContent='AI 준비 완료';
    if(localAiUI.device){localAiUI.device.textContent='LOCAL · READY';localAiUI.device.classList.remove('warn','bad');localAiUI.device.classList.add('ok')}
    localAiUI.tab?.classList.add('ready');
    localAiSetStatus(`${info?.label||'로컬 AI'}가 준비되었습니다. 이제 대화 내용은 모델 추론을 위해 서버로 전송되지 않습니다.`,'ok');
    localAiAddMessage('system',`${info?.label||'로컬 AI'} 준비 완료. 현재 교량 상태를 읽고 답변할 수 있습니다.`);
    return true;
  }catch(err){
    console.error('[TRUSS LAB LOCAL AI]',err);
    localAiEngine=null;localAiLoadedModel='';
    if(localAiUI.progress)localAiUI.progress.style.width='0%';
    if(localAiUI.download)localAiUI.download.textContent='다시 다운로드';
    if(localAiUI.device){localAiUI.device.textContent='LOAD FAILED';localAiUI.device.classList.remove('ok','warn');localAiUI.device.classList.add('bad')}
    const hint=location.protocol==='file:'?' HTML을 file://로 열었다면 localhost 또는 HTTPS에서 실행해 보세요.':'';
    localAiSetStatus(`모델을 불러오지 못했습니다.${hint}`,'bad');
    localAiAddMessage('system',`AI 모델 로딩 실패: ${err?.message||String(err)}${hint}`);
    return false;
  }finally{
    localAiSetBusy(false);
  }
}
async function localAiSendOnline(text,target){
  const endpoint=localAiNormalizeEndpoint(localAiUI.endpoint?.value||localStorage.getItem('trusslab-ai-endpoint'));
  if(!endpoint)throw new Error('Cloudflare Worker 주소가 없습니다. 온라인 AI 설정에 Worker URL을 입력하세요.');
  localStorage.setItem('trusslab-ai-endpoint',endpoint);
  const payload={message:text,context:localAiBridgeContext(),history:localAiHistory.slice(0,-1).slice(-10),client:'truss-lab-github-pages'};
  const r=await fetch(`${endpoint}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`HTTP ${r.status}`);
  const answer=String(data?.answer||'').trim();if(!answer)throw new Error('온라인 AI가 빈 답변을 반환했습니다.');
  if(target)target.textContent=answer;return answer;
}
async function localAiSend(textOverride=''){
  const text=String(textOverride||localAiUI.input?.value||'').trim();if(!text||localAiBusy)return;
  localAiSetOpen(true);if(localAiUI.input&&!textOverride)localAiUI.input.value='';
  localAiAddMessage('user',text);localAiHistory.push({role:'user',content:text});
  if(localAiMode==='local'&&!localAiEngine){const ok=await localAiLoadModel();if(!ok)return}
  localAiSetBusy(true);const target=localAiAddMessage('assistant',localAiMode==='online'?'온라인 구조 코치가 분석하는 중…':'구조 데이터를 분석하는 중…');
  try{
    let answer='';
    if(localAiMode==='online'){
      answer=await localAiSendOnline(text,target);localAiSetStatus('ONLINE AI · Gemma 4 26B · 현재 교량 상태는 다음 질문 때 다시 읽습니다.','ok');
    }else{
      const messages=[{role:'system',content:localAiSystemPrompt()},...localAiHistory.slice(-10)];
      const stream=await localAiEngine.chat.completions.create({messages,temperature:.22,top_p:.82,max_tokens:650,stream:true});
      for await(const chunk of stream){const delta=chunk?.choices?.[0]?.delta?.content||'';if(!delta)continue;answer+=delta;if(target)target.textContent=answer;if(localAiUI.messages)localAiUI.messages.scrollTop=localAiUI.messages.scrollHeight}
      answer=answer.trim()||'답변을 생성하지 못했습니다. 구조 스캔을 실행한 뒤 다시 질문해 주세요.';if(target)target.textContent=answer;
      localAiSetStatus('LOCAL AI · 현재 구조 데이터 기반 응답 · 다음 질문 때 상태를 다시 읽습니다.','ok');
    }
    localAiHistory.push({role:'assistant',content:answer});if(localAiHistory.length>14)localAiHistory=localAiHistory.slice(-14);
  }catch(err){
    console.error('[TRUSS LAB AI CHAT]',err);const msg=`답변 생성 중 오류가 발생했습니다: ${err?.message||String(err)}`;if(target)target.textContent=msg;else localAiAddMessage('system',msg);
    localAiSetStatus(localAiMode==='online'?'온라인 Worker 주소와 CORS 설정을 확인하세요.':'모델을 다시 불러오거나 더 작은 모델을 선택해 보세요.','bad');
  }finally{localAiSetBusy(false)}
}
function initLocalAiBridgeChat(){
  if(!localAiUI.dock)return;
  const savedModel=localStorage.getItem('trusslab-local-ai-model');if(savedModel&&LOCAL_AI_MODEL_INFO[savedModel]&&localAiUI.model)localAiUI.model.value=savedModel;else if(localAiUI.model)localAiUI.model.value=LOCAL_AI_DEFAULT_MODEL;
  const savedEndpoint=localStorage.getItem('trusslab-ai-endpoint');if(savedEndpoint&&localAiUI.endpoint)localAiUI.endpoint.value=savedEndpoint;
  localAiSetMode(localAiMode,{quiet:true});
  localAiUI.tab?.addEventListener('click',()=>localAiSetOpen(!localAiUI.dock.classList.contains('open')));localAiUI.close?.addEventListener('click',()=>localAiSetOpen(false));localAiUI.clear?.addEventListener('click',localAiResetChat);
  localAiUI.download?.addEventListener('click',localAiLoadModel);localAiUI.onlineCheck?.addEventListener('click',localAiCheckOnline);localAiUI.send?.addEventListener('click',()=>localAiSend());
  localAiUI.input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();localAiSend()}});$$('[data-local-ai-prompt]').forEach(b=>b.addEventListener('click',()=>localAiSend(b.dataset.localAiPrompt||'')));
  localAiUI.mode?.addEventListener('change',()=>localAiSetMode(localAiUI.mode.value));
  localAiUI.endpoint?.addEventListener('change',()=>{const e=localAiNormalizeEndpoint(localAiUI.endpoint.value);localAiUI.endpoint.value=e;localStorage.setItem('trusslab-ai-endpoint',e)});
  localAiUI.model?.addEventListener('change',()=>{const id=localAiUI.model.value,info=LOCAL_AI_MODEL_INFO[id];localStorage.setItem('trusslab-local-ai-model',id);if(localAiLoadedModel&&localAiLoadedModel!==id){localAiSetStatus(`${info?.label||id}로 변경하려면 ‘AI 다운로드’를 누르세요.`,'warn');if(localAiUI.download)localAiUI.download.textContent='AI 다운로드'}});
  localAiSyncTutorialVisibility();
  new MutationObserver(localAiSyncTutorialVisibility).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(localAiMode==='local'){
    if(!navigator.gpu){if(localAiUI.device){localAiUI.device.textContent='NO WEBGPU';localAiUI.device.classList.add('bad')}localAiSetStatus('WebGPU를 지원하는 브라우저가 필요합니다. 온라인 AI 모드도 사용할 수 있습니다.','bad')}
    else{if(localAiUI.device){localAiUI.device.textContent=location.protocol==='file:'?'WEBGPU · FILE MODE':'WEBGPU READY';localAiUI.device.classList.add('ok')}localAiSetStatus('Phi-4 Mini 권장 · 약 3.4GB VRAM이 필요합니다. 부족하면 Llama 3.2 3B를 선택하세요.','ok')}
  }else localAiSetStatus(savedEndpoint?'저장된 Worker 주소로 온라인 AI를 사용할 수 있습니다.':'Cloudflare Worker 주소를 입력한 뒤 연결 확인을 누르세요.',savedEndpoint?'ok':'warn');
}
initLocalAiBridgeChat();


/* ===== Floating tutorial window controller ===== */
let tutorialWindowAutoHide=true;
let tutorialWindowManualMinimized=false;
let tutorialWindowAutoMinimized=false;
let tutorialWindowDrag=null;

function tutorialWindowPanel(){return $('#stageTutorialPanel')}
function tutorialWindowSetMinimized(on,{auto=false}={}){
  const panel=tutorialWindowPanel();if(!panel)return;
  panel.classList.toggle('is-minimized',!!on);
  tutorialWindowAutoMinimized=!!(on&&auto);
  tutorialWindowManualMinimized=!!(on&&!auto);
  const btn=$('#tutorialWindowMin');
  if(btn){btn.textContent=on?'□':'—';btn.title=on?'튜토리얼 창 복원':'최소화';btn.setAttribute('aria-label',btn.title)}
}
function tutorialWindowRestore(){tutorialWindowSetMinimized(false)}
function tutorialWindowToggleManual(){
  const panel=tutorialWindowPanel();if(!panel)return;
  if(panel.classList.contains('is-minimized'))tutorialWindowRestore();
  else tutorialWindowSetMinimized(true,{auto:false});
}
function tutorialWindowUsesBridgeWorkspace(step){
  if(!step)return false;
  return ['support','roadComplete','topChord','rightClick','dragNode','test'].includes(step.key);
}
function tutorialWindowAutoMinimizeForWork(){
  if(!tutorialMode||!tutorialWindowAutoHide)return;
  const step=typeof tutorialCurrentStep==='function'?tutorialCurrentStep():STAGE_TUTORIAL_STEPS?.[tutorialStep];
  if(!tutorialWindowUsesBridgeWorkspace(step))return;
  const panel=tutorialWindowPanel();if(!panel||panel.classList.contains('is-minimized'))return;
  tutorialWindowSetMinimized(true,{auto:true});
}
function tutorialWindowOnStepChange(step){
  const label=$('#tutorialWindowStepLabel');
  if(label&&step){const n=String(tutorialStep+1).padStart(2,'0');label.textContent=`${n}/${String(STAGE_TUTORIAL_STEPS.length).padStart(2,'0')} · ${step.title}`}
  if(tutorialWindowAutoMinimized)tutorialWindowRestore();
}
function tutorialWindowClampPosition(left,top){
  const panel=tutorialWindowPanel();if(!panel)return {left,top};
  const r=panel.getBoundingClientRect();
  const margin=8;
  return {
    left:Math.max(margin,Math.min(left,window.innerWidth-r.width-margin)),
    top:Math.max(margin,Math.min(top,window.innerHeight-r.height-margin))
  };
}
function tutorialWindowSetPosition(left,top){
  const panel=tutorialWindowPanel();if(!panel)return;
  const p=tutorialWindowClampPosition(left,top);
  panel.classList.add('is-moved');
  panel.style.setProperty('left',p.left+'px','important');
  panel.style.setProperty('top',p.top+'px','important');
  panel.style.setProperty('right','auto','important');
  panel.style.setProperty('bottom','auto','important');
}
function tutorialWindowResetPosition(){
  const panel=tutorialWindowPanel();if(!panel)return;
  panel.classList.remove('is-moved');
  for(const prop of ['left','top','right','bottom'])panel.style.removeProperty(prop);
}
function tutorialWindowPrepareForStart(){
  tutorialWindowAutoHide=true;tutorialWindowManualMinimized=false;tutorialWindowAutoMinimized=false;
  tutorialWindowResetPosition();
  tutorialWindowSetMinimized(false);
  const auto=$('#tutorialWindowAuto');if(auto){auto.classList.add('active');auto.setAttribute('aria-pressed','true')}
}
function initTutorialWindowUI(){
  const panel=tutorialWindowPanel(),bar=$('#tutorialWindowBar'),min=$('#tutorialWindowMin'),auto=$('#tutorialWindowAuto');
  if(!panel||!bar)return;
  min?.addEventListener('click',e=>{e.stopPropagation();tutorialWindowToggleManual()});
  auto?.addEventListener('click',e=>{
    e.stopPropagation();tutorialWindowAutoHide=!tutorialWindowAutoHide;
    auto.classList.toggle('active',tutorialWindowAutoHide);auto.setAttribute('aria-pressed',String(tutorialWindowAutoHide));
    auto.title=tutorialWindowAutoHide?'다리 작업을 시작하면 안내 창 자동 최소화':'자동 최소화 꺼짐';
  });
  bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))tutorialWindowToggleManual()});
  bar.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button'))return;
    const r=panel.getBoundingClientRect();
    tutorialWindowDrag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    try{bar.setPointerCapture(e.pointerId)}catch(_){ }
    e.preventDefault();
  });
  bar.addEventListener('pointermove',e=>{
    if(!tutorialWindowDrag||tutorialWindowDrag.id!==e.pointerId)return;
    tutorialWindowSetPosition(e.clientX-tutorialWindowDrag.dx,e.clientY-tutorialWindowDrag.dy);
  });
  const endDrag=e=>{if(!tutorialWindowDrag||tutorialWindowDrag.id!==e.pointerId)return;tutorialWindowDrag=null;try{bar.releasePointerCapture(e.pointerId)}catch(_){}};
  bar.addEventListener('pointerup',endDrag);bar.addEventListener('pointercancel',endDrag);
  window.addEventListener('resize',()=>{
    if(!panel.classList.contains('is-moved'))return;
    const r=panel.getBoundingClientRect();tutorialWindowSetPosition(r.left,r.top);
  });
  // The first real construction interaction clears the bridge workspace automatically.
  canvas?.addEventListener('pointerdown',tutorialWindowAutoMinimizeForWork,{capture:true});
}

initTutorialWindowUI();

bindCampaignFlowUI();initDeveloperMode();applyAccessibilitySettings();initTechnicalTooltips();updateEducationAccess();updateSandboxFailureUI();updateUIModeUI();updateInspectorModeUI();updateModeBadge();updateZoomText();$('#gridBtn').classList.toggle('toggled',gridVisible);$('#snapBtn').classList.toggle('toggled',snapEnabled);$('#loadPathBtn').classList.toggle('isOn',loadPathMode);updateSpeedButton();resetStage(0);pauseStageClock(false);resize();updateCanvasCursor(null);updateStageButtons();setGamePhase(GAME_PHASE.BUILD);changeGameScreen(GAME_SCREEN.TITLE);
})();
