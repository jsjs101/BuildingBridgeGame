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
  const fresh=()=>({version:2,current:0,furthest:0,started:false,finished:false,statuses:['ready','ready','ready','ready'],results:{},drafts:{}});
  let state=fresh(),loaded=false,resetting=false,unmountMap=null,pendingUnlock=null;
  try{
    const saved=JSON.parse(storage.getItem(storageKey)||'null');
    if(saved&&saved.version===2&&Number.isInteger(saved.current)&&saved.current>=0&&saved.current<4&&saved.statuses?.length===4)state=saved;
  }catch(error){console.warn('[TRUSS LAB] 시연 기록을 새로 시작합니다.',error)}
  state.furthest=Math.min(3,Math.max(state.current,state.furthest||0,...state.statuses.map((status,index)=>status==='ready'?0:index+1)));
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
    if(!state.started){state.started=true;save()}
    engine.showScreen('booth');
  }
  const isUnlocked=index=>index<=state.furthest;
  function unlockNext(index){
    if(index>=3||isUnlocked(index+1))return;
    state.furthest=index+1;
    pendingUnlock={from:String(index),to:String(index+1)};
  }
  function next(skipped=false){
    const previous=state.current;
    if(skipped&&state.statuses[state.current]!=='complete')state.statuses[state.current]='skipped';
    if(state.current===3){end();return}
    unlockNext(previous);
    pause();state.current=previous+1;save();engine.showScreen('booth');
  }
  function end(){
    pause();state.finished=true;save();hud.hidden=true;engine.showScreen('booth');
  }
  function reset(){resetting=true;storage.clear();location.reload()}
  function askAI(){
    if(state.current===0)return;
    engine.openAI(missions[state.current-1].prompt);
  }
  function play(index){
    if(!isUnlocked(index))return;
    const completed=state.statuses[index]==='complete';
    if(index>0&&!completed&&loaded&&state.current===index&&engine.info().screen==='booth'){
      engine.resume();return;
    }
    pause();
    state.current=index;state.finished=false;
    if(completed)delete state.drafts[index];
    launch();
  }
  function render(){
    unmountMap?.();
    screen.hidden=false;
    const passed=state.statuses.filter(status=>status==='complete').length;
    const levels=labels.map((title,index)=>{
      const mission=missions[index-1],completed=state.statuses[index]==='complete',record=state.results[index];
      const feature=index===0?'도로 · 목재 · AI 도움':mission.concept+' · '+(mission.vehicle==='CAR'?'승용차':mission.vehicle==='BUS'?'버스':'화물차');
      return {
        id:String(index),number:'단계 '+String(index+1).padStart(2,'0'),title,setNumber:1,
        unlocked:isUnlocked(index),completed,status:state.statuses[index]==='skipped'?'둘러봄':'도전 가능',
        lockedHint:'‘'+labels[index-1]+'’ 단계에서 다음 단계로 이동하면 열립니다.',
        summary:mission?.objective||'도로와 목재로 첫 다리를 만들고 차량 시험과 AI 도움을 익혀 보세요.',
        record:record?'최소 비용 ₩'+record.cost.toLocaleString('ko-KR')+' · '+engine.formatTime(record.buildTimeMs):feature,
        actionLabel:completed?'다시 도전 →':index===0?'연습 시작 →':state.drafts[index]||loaded&&index===state.current?'설계 계속하기 →':'다리 설계하기 →',
        deck:engine.previewDeck(mission),ship:mission?.ship,vehicle:mission?.vehicle||'CAR',materials:mission?.materials||['road','wood'],
        snowfall:mission?.snowfall,environment:boothEnvironment(index,mission)
      };
    });
    screen.innerHTML=`<section class="dioramaGallery boothDiorama" aria-label="시연 단계 지도">
      <div class="dioramaViewport">
        <canvas aria-hidden="true"></canvas>
        <button class="dioramaArrow" data-step="-1" aria-label="이전 단계">‹</button>
        <button class="dioramaArrow" data-step="1" aria-label="다음 단계">›</button>
      </div>
      <header class="boothMapBrand"><span>TRUSS LAB</span><strong>교량 현장 지도</strong><small>${state.finished?'체험 완료 · ':''}${passed} / 4 단계 완료</small></header>
      <div class="dioramaDetails" aria-live="polite"><div><div class="dioramaIdentity"><span data-number></span><b data-status></b></div><h2></h2><p data-summary></p><p data-record></p></div></div>
      <footer class="boothMapFooter">
        <div class="dioramaIndex" role="group" aria-label="시연 단계 바로 선택">
          ${levels.map((level,index)=>`<button type="button" data-level-index="${index}" aria-label="${level.title}" aria-pressed="false">${index+1}${level.completed?' ✓':level.unlocked?'':' ·'}</button>`).join('')}
        </div>
        <button class="boothButton isPrimary" data-launch data-screen-autofocus type="button"></button>
        <div class="boothMapUtilities"></div>
      </footer>
    </section>`;
    const gallery=screen.querySelector('.boothDiorama');
    const utilities=screen.querySelector('.boothMapUtilities');
    if(state.current>0&&!state.finished)utilities.append(button(state.current===3?'체험 마무리':'다음 단계 둘러보기',()=>next(true)));
    utilities.append(button(state.finished?'다음 체험자 · 새로 시작':'다음 체험자 · 초기화',()=>{
      if(state.finished||confirm('현재 시연 기록과 대화를 비우고 새 체험을 시작할까요?'))reset();
    }));
    unmountMap=mountLevelDiorama(gallery,levels,{
      selectedId:String(state.current),unlock:pendingUnlock,fullscreen:true,reducedMotion:engine.reducedMotion(),
      start:id=>{
        const index=Number(id);
        if(!isUnlocked(index))return;
        unmountMap();unmountMap=null;
        screen.inert=true;
        mountBoothDrive({
          title:labels[index],environment:levels[index].environment,vehicle:missions[index-1]?.vehicle||'CAR',
          reducedMotion:engine.reducedMotion(),weatherMotionReduced:engine.weatherMotionReduced(),
          cancel:()=>{screen.inert=false;render()},
          arrive:()=>{screen.inert=false;play(index)}
        });
      }
    });
    pendingUnlock=null;
  }
  function screenChanged(name){
    if(state.finished&&name==='game'){engine.stop();engine.showScreen('booth');return}
    hud.hidden=name!=='game'||!state.started||state.finished;
    if(name==='booth'){render();return}
    unmountMap?.();unmountMap=null;
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
    if(success){
      state.statuses[state.current]='complete';
      unlockNext(state.current);
      const previous=state.results[state.current];
      if(!previous||metrics.cost<previous.cost||metrics.cost===previous.cost&&metrics.buildTimeMs<previous.buildTimeMs)state.results[state.current]=metrics;
      save();
    }
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
