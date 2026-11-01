'use strict';

function createBridgeBoothStorage(){
  const prefix='trusslab-booth:',storage=window.sessionStorage;
  const keys=()=>Object.keys(storage).filter(key=>key.startsWith(prefix));
  return {
    getItem:key=>storage.getItem(prefix+key),
    setItem:(key,value)=>storage.setItem(prefix+key,value),
    removeItem:key=>storage.removeItem(prefix+key),
    key:index=>keys()[index]?.slice(prefix.length)||null,
    get length(){return keys().length},
    clear(){for(const key of keys())storage.removeItem(key)}
  };
}

function createBridgeBooth(engine){
  const $=selector=>document.querySelector(selector),storage=engine.storage;
  const storageKey='session-v2';
  const missions=[
    {number:2,id:'booth_v2_long',stageIndex:0,type:'main',globalNumber:2,title:'더 긴 다리',concept:'삼각형으로 하중 나누기',
      objective:'튜토리얼보다 긴 다리에 도로와 목재 골조를 직접 만들고 승용차를 통과시키세요.',
      site:{kind:'flat',leftX:200,rightX:1000,leftY:390,rightY:390,segments:6},
      vehicle:'CAR',load:8500,budget:18000,serviceDeflection:64,materials:['road','wood'],conditionCodes:['ROAD_REQUIRED','TRUSS_SUPPORT'],axles:[[-18,.5],[18,.5]],
      weather:'clear',
      tip:'먼저 양쪽 지지점을 도로로 연결한 뒤, 목재 삼각형으로 도로를 받쳐 보세요.',
      prompt:'이 다리에서 빠진 하중 경로를 어디에 보강하면 좋을까요? 연결할 위치를 쉬운 말로 설명해 주세요.'},
    {number:3,id:'booth_v2_weather',stageIndex:1,type:'main',globalNumber:3,title:'비와 눈 속 오르막',concept:'기상 하중과 강철 보강',
      objective:'비와 눈이 내리는 오르막 다리를 강철로 보강해 버스를 통과시키세요.',
      site:{kind:'slope',leftX:200,rightX:1000,leftY:430,rightY:330,segments:6},
      vehicle:'BUS',load:14000,budget:39000,serviceDeflection:58,materials:['road','roadHeavy','steel'],conditionCodes:['STEEL_INTRO','HIGH_LOAD'],axles:[[-34,.28],[0,.34],[34,.38]],
      weather:'rain',snowfall:true,extraRoadLoad:7,
      tip:'도로에 비·눈 하중 7 N/u가 더해집니다. 강화 도로와 강철 골조를 직접 설치해 하중을 나눠 보세요.',
      prompt:'이 오르막 다리에 비와 눈으로 7 N/u의 추가 하중이 걸리고 버스가 지나갑니다. 강철을 어디에 연결하면 좋을까요? 쉬운 말로 설명해 주세요.'},
    {number:4,id:'booth_v2_harbor',stageIndex:2,type:'main',globalNumber:4,title:'배와 화물차의 교차',concept:'항로 확보와 중량 운송',
      objective:'가운데 항로를 비워 두고, 배와 무거운 화물차를 모두 안전하게 통과시키세요.',
      site:{kind:'crown',leftX:110,rightX:1090,leftY:470,rightY:470,segments:10,curve:-280,rightSupport:'pin',waterY:680,navigation:{centerX:600,minWidth:320,minHeight:430,waterY:680,sweepTop:250}},
      ship:{length:340,height:135,y:565},
      vehicle:'TRUCK',load:18000,budget:68000,serviceDeflection:46,materials:['road','roadHeavy','steel'],conditionCodes:['NAVIGATION_CLEARANCE','HEAVY_TRUCK'],axles:[[-42,.24],[-5,.34],[38,.42]],
      weather:'clear',
      tip:'큰 선박 위로 도로가 아치처럼 솟도록 연결하세요. 노란 항로를 비우고 강철로 보강해 보세요.',
      prompt:'가운데로 큰 배가 지나가고 18 kN 화물차가 다리를 건너야 합니다. 항로 위로 아치형 도로와 강철 골조를 어떻게 만들면 좋을지 쉬운 말로 설명해 주세요.'}
  ];
  const labels=['첫 다리 연습',...missions.map(mission=>mission.title)];
  const fresh=()=>({version:2,current:0,started:false,finished:false,statuses:['ready','ready','ready','ready'],results:{},drafts:{}});
  let state=fresh(),loaded=false,resetting=false;
  try{
    const saved=JSON.parse(storage.getItem(storageKey)||'null');
    if(saved&&saved.version===2&&Number.isInteger(saved.current)&&saved.current>=0&&saved.current<4&&saved.statuses?.length===4)state=saved;
  }catch(error){console.warn('[TRUSS LAB] 시연 기록을 새로 시작합니다.',error)}
  const save=()=>storage.setItem(storageKey,JSON.stringify(state));
  const screen=$('#boothScreen'),hud=$('#boothHUD');
  const toolbar=$('#app .bottom');
  const layoutObserver=new ResizeObserver(()=>{
    document.body.style.setProperty('--booth-hud-height',`${hud.getBoundingClientRect().height}px`);
    document.body.style.setProperty('--booth-toolbar-height',`${toolbar.getBoundingClientRect().height}px`);
  });
  layoutObserver.observe(hud);layoutObserver.observe(toolbar);
  const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
  const button=(text,action,primary=false)=>{const node=element('button','boothButton'+(primary?' isPrimary':''),text);node.type='button';node.onclick=action;return node};
  function remember(){
    if(!loaded||state.current===0||state.finished)return;
    state.drafts[state.current]=engine.capture();save();
  }
  function pause(){remember();engine.stop();loaded=false}
  function launch(){
    if(!state.started||state.finished)return;
    if(state.current===0){engine.startTutorial();loaded=true}
    else {engine.startMission(missions[state.current-1],state.drafts[state.current]);loaded=true}
    save();
  }
  function begin(){
    if(state.finished){engine.showScreen('booth');return}
    if(!state.started){state.started=true;save();launch()}
    else engine.showScreen('booth');
  }
  function next(skipped=false){
    if(skipped&&state.statuses[state.current]!=='complete')state.statuses[state.current]='skipped';
    if(state.current===3){end();return}
    pause();state.current++;save();engine.showScreen('booth');
  }
  function end(){
    pause();state.finished=true;save();hud.hidden=true;engine.showScreen('booth');
  }
  function reset(){resetting=true;storage.clear();location.reload()}
  function askAI(){
    if(state.current===0)return;
    engine.openAI(missions[state.current-1].prompt);
  }
  function render(){
    screen.replaceChildren();screen.hidden=false;
    const shell=element('section','flowShell boothConsole');
    const header=element('header','boothHeader');
    header.append(element('span','boothEyebrow','AI 구조 설계 체험 · 4단계'));
    const title=state.finished?'다리 연구소 체험 완료':state.current===0?'첫 번째 다리부터 시작해요':`${state.current+1}단계 · ${labels[state.current]}`;
    header.append(element('h1','',title),element('p','',state.finished?'직접 설계하고, AI에게 질문하고, 차량 시험으로 확인했습니다.':state.current===0?'짧은 연습을 마친 뒤 세 가지 다리 문제에 도전합니다.':'빈 작업장에서 도로와 골조를 직접 설계해 보세요. AI에게 도움을 요청할 수 있습니다.'));
    shell.append(header);
    const trail=element('ol','boothTrail');
    labels.forEach((label,index)=>{
      const item=element('li',index===state.current?'isCurrent':'');
      const text=state.statuses[index]==='complete'?'완료':state.statuses[index]==='skipped'?'둘러봄':index===state.current&&!state.finished?'진행 중':'대기';
      item.append(element('span','boothStepNumber',String(index+1).padStart(2,'0')),element('strong','',label),element('small','',text));
      trail.append(item);
    });
    shell.append(trail);
    if(state.finished){
      const summary=element('div','boothSummary');
      const passed=state.statuses.filter(status=>status==='complete').length;
      summary.append(element('strong','',`${passed} / 4 단계 완료`),element('p','','각 단계에서 발견한 점을 이야기해 보세요. 삼각형, 강철, 항로는 다리의 어떤 문제를 해결했나요?'));
      shell.append(summary);
    }else if(state.current>0){
      const mission=missions[state.current-1],brief=element('section','boothBrief');
      brief.append(element('h2','','이번 단계의 목표'),element('p','',mission.objective),element('p','boothTip',mission.tip));
      const specs=element('dl','boothSpecs');
      for(const [label,value] of [['차량',mission.vehicle==='CAR'?'승용차':mission.vehicle==='BUS'?'버스':'화물차'],['기본 차량 하중',`${mission.load/1000} kN`],['사용 재료',mission.materials.includes('wood')?'일반 도로 · 목재':'강화 도로 · 강철'],['진행 방식','시간 제한 없음']]){
        const row=element('div');row.append(element('dt','',label),element('dd','',value));specs.append(row);
      }
      brief.append(specs);shell.append(brief);
    }
    const actions=element('div','boothActions');
    if(state.finished)actions.append(button('다음 체험자 · 새로 시작',reset,true));
    else {
      const resume=loaded&&engine.info().stageIndex===(state.current===0?-1:missions[state.current-1].stageIndex);
      actions.append(button(resume?'설계 계속하기':state.current===0?'연습 시작하기':'다리 설계하기',()=>resume?engine.resume():launch(),true));
      if(state.current>0)actions.append(button(state.current===3?'체험 마무리':'다음 단계 둘러보기',()=>next(true)));
      actions.append(button('다음 체험자 · 초기화',()=>{if(confirm('현재 시연 기록과 대화를 비우고 새 체험을 시작할까요?'))reset()}));
    }
    shell.append(actions);screen.append(shell);
    actions.querySelector('button').setAttribute('data-screen-autofocus','');
  }
  function screenChanged(name){
    if(state.finished&&name==='game'){engine.stop();engine.showScreen('booth');return}
    hud.hidden=name!=='game'||!state.started||state.finished;
    if(name==='booth'){render();return}
    if(name==='title'){
      $('#titleStartBtn span').textContent=state.started?'체험 이어하기':'체험 시작';
      if(state.finished)engine.showScreen('booth');
    }
    if(name==='game'){
      $('#boothStepLabel').textContent=`${state.current+1} / 4 · ${labels[state.current]}`;
      $('#boothAskAI').hidden=state.current===0;
    }
  }
  function route(name){
    if(['main-menu','set-select','level-select','briefing','training-complete','program-complete','records','dev-auth','dev-console','dev-preview','sandbox-setup','education'].includes(name)){
      if(loaded&&engine.info().screen==='game')remember();
      engine.stop();if(state.current===0)loaded=false;engine.showScreen('booth');return true;
    }
    return false;
  }
  function result(success,metrics,close){
    screenChanged('result');
    if(success){state.statuses[state.current]='complete';state.results[state.current]=metrics;save()}
    const back=()=>{close();screenChanged('game')};
    $('#closeResult').onclick=back;
    const design=$('#returnDesignBtn');if(design){design.onclick=back;design.classList.remove('isPrimary')}
    const retry=$('#retryLevelBtn');if(retry)retry.onclick=()=>{delete state.drafts[state.current];engine.stop();loaded=false;launch()};
    const overview=$('#resultLevelSelectBtn');if(overview){overview.textContent='체험 단계';overview.onclick=()=>{remember();engine.stop();engine.showScreen('booth')}}
    const learn=$('#goEducationBtn');if(learn){learn.textContent='AI에게 물어보기';learn.onclick=askAI}
    for(const learnButton of document.querySelectorAll('.learnWhyBtn')){learnButton.textContent='AI에게 물어보기';learnButton.onclick=askAI}
    if(success){
      const action=button(state.current===3?'체험 마치기':'다음 단계 →',()=>next(false),true);
      action.id='boothResultNext';$('#resultCard .completionNextSteps').prepend(action);
      $('#resultTitle').textContent=`${state.current+1}단계 완료`;
    }
  }
  $('#boothOverview').onclick=()=>{remember();engine.stop();engine.showScreen('booth')};
  $('#boothAskAI').onclick=askAI;
  window.addEventListener('pagehide',()=>{if(!resetting)remember()});
  return {
    begin,route,screenChanged,result,askAI,
    tutorialFinished(skipped){state.statuses[0]=skipped?'skipped':'complete';next(false)},
    currentMission(){return state.current>0?missions[state.current-1]:null}
  };
}
