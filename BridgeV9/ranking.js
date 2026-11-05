const rankingPageKey='trusslab-ranking-page';

function rankingElement(tag, className, text) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}

function createBridgeRanking(settings, storage=localStorage) {
  let request=null;
  let preview=null,panel=null;
  function stop(){
    if(request)request.abort();
    preview?.abort();preview=null;
    panel?.remove();panel=null;
    request=null;
  }
  function show(container, snapshot) {
    stop();
    panel=rankingElement('aside','rankingResultPanel');
    panel.setAttribute('aria-label','계약 랭킹 등록');
    const heading=rankingElement('h2','','계약 랭킹');
    const comparison=rankingElement('p','rankingResultComparison','예상 순위를 불러오는 중…');
    comparison.setAttribute('role','status');
    panel.append(heading,comparison);
    container.after(panel);
    function showStanding(standing,confirmed){
      if(!standing){
        comparison.textContent=confirmed?'순위 정보를 확인할 수 없습니다.':'아직 비교할 기록이 없습니다.';
        return;
      }
      comparison.replaceChildren(
        rankingElement('span','',confirmed?'등록 순위':'등록 시 예상'),
        rankingElement('strong','',standing.rank+'위'),
        rankingElement('b','','상위 '+standing.percentile.toFixed(1)+'%')
      );
    }
    const form=rankingElement('form','rankingSubmit');
    const label=rankingElement('label','','공개 닉네임');
    const input=rankingElement('input');
    input.type='text';
    input.maxLength=20;
    input.required=true;
    input.autocomplete='nickname';
    input.value=storage.getItem('trusslab-ranking-name')||'';
    label.append(input);
    const submit=rankingElement('button','completionAction isPrimary','랭킹 등록');
    submit.type='submit';
    const status=rankingElement('p','rankingStatus');
    status.setAttribute('role','status');
    const note=rankingElement('p','rankingNote','등록하면 닉네임·비용·건설 시간·설계가 공개됩니다.');
    form.append(label,submit,note,status);
    panel.append(form);

    if(snapshot.ineligible||!settings.webAppUrl){
      comparison.hidden=true;
      input.disabled=true;
      submit.disabled=true;
      note.textContent=snapshot.ineligible?'기본 설정으로 완료한 기록만 등록할 수 있습니다.':'랭킹 서버 연결을 준비 중입니다.';
      return;
    }

    const lookup=new AbortController();
    preview=lookup;
    const previewTimeout=setTimeout(()=>lookup.abort(),12000);
    const url=new URL(settings.webAppUrl);
    for(const [key,value] of Object.entries({season:settings.season,levelId:snapshot.levelId,difficulty:snapshot.difficulty,cost:snapshot.cost})){
      url.searchParams.set(key,value);
    }
    fetch(url,{signal:lookup.signal,credentials:'omit'})
      .then(response=>{
        if(!response.ok)throw new Error('랭킹 조회 오류');
        return response.json();
      })
      .then(board=>{
        if(preview!==lookup)return;
        if(!board.ok)throw new Error(board.error);
        showStanding(board.comparison,false);
      })
      .catch(()=>{if(preview===lookup)comparison.textContent='예상 순위를 불러오지 못했습니다.'})
      .finally(()=>{
        clearTimeout(previewTimeout);
        if(preview===lookup)preview=null;
      });

    const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const attemptId=randomId();
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(request||submit.disabled)return;
      const nickname=input.value.trim();
      if(!nickname){
        status.textContent='닉네임을 입력해 주세요.';
        input.focus();
        return;
      }
      const controller=new AbortController();
      request=controller;
      submit.disabled=true;
      input.disabled=true;
      status.textContent='기록을 등록하고 있습니다…';
      const timeout=setTimeout(()=>controller.abort(),20000);
      try{
        let token=storage.getItem('trusslab-ranking-token');
        if(!token){
          token=randomId();
          storage.setItem('trusslab-ranking-token',token);
        }
        const response=await fetch(settings.webAppUrl,{
          method:'POST',
          signal:controller.signal,
          credentials:'omit',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({...snapshot,action:'submit',season:settings.season,token,attemptId,nickname})
        });
        if(!response.ok)throw new Error('서버 응답 오류 ('+response.status+')');
        const board=await response.json();
        if(!board.ok)throw new Error(board.error||'랭킹 응답을 확인할 수 없습니다.');
        if(board.registered!==true||board.buildTimeSupported!==true)throw new Error('랭킹 서버의 Code.gs를 새 버전으로 배포해 주세요.');
        if(request!==controller)return;
        preview?.abort();preview=null;
        comparison.hidden=false;showStanding(board.comparison,true);
        storage.setItem('trusslab-ranking-name',nickname);
        const result={
          levelId:snapshot.levelId,season:settings.season,levelTitle:snapshot.levelTitle,difficulty:snapshot.difficulty,
          cost:snapshot.cost,buildTimeMs:snapshot.buildTimeMs,
          origin:document.body.classList.contains('booth-mode')?'bridge.html':'index.html',
          total:board.total,comparison:board.comparison,timeBoard:board.timeBoard,
          entries:board.entries.map(({rank,nickname,cost,buildTimeMs,mine})=>({rank,nickname,cost,buildTimeMs,mine}))
        };
        const rankingUrl=new URL('ranking.html',location.href);
        rankingUrl.searchParams.set('levelId',snapshot.levelId);
        rankingUrl.searchParams.set('difficulty',snapshot.difficulty);
        sessionStorage.setItem(rankingPageKey,JSON.stringify(result));
        window.localStorage.setItem(rankingPageKey,JSON.stringify(result));
        const link=rankingElement('a','completionAction','랭킹 페이지 열기');
        link.href=rankingUrl.href;
        link.addEventListener('click',event=>{
          const tab=window.open('','_blank');
          if(!tab)return;
          event.preventDefault();
          tab.sessionStorage.setItem(rankingPageKey,JSON.stringify({...result,newTab:true}));
          tab.opener=null;
          tab.location.replace(rankingUrl.href);
        });
        status.replaceChildren('기록을 등록했습니다. ',link);
      }catch(error){
        if(request!==controller)return;
            status.textContent=controller.signal.aborted?'응답 시간이 초과되었습니다. 다시 시도해 주세요.':'랭킹 등록 실패: '+error.message;
        submit.disabled=false;
        input.disabled=false;
        input.focus();
      }finally{
        clearTimeout(timeout);
        if(request===controller)request=null;
      }
    });
  }
  return {show,stop};
}

async function renderRankingPage(page) {
  const back=page.querySelector('#rankingBack'),content=page.querySelector('#rankingContent');
  const status=page.querySelector('#rankingEmpty'),rows=page.querySelector('#rankingRows');
  const level=page.querySelector('#rankingLevel'),difficulty=page.querySelector('#rankingDifficulty');
  const sort=page.querySelector('#rankingSort'),refresh=page.querySelector('#rankingRefresh');
  let result=null,settings=null,board=null,request=null,timer=null,closed=false;
  const stored=sessionStorage.getItem(rankingPageKey)||window.localStorage.getItem(rankingPageKey);
  if(stored){
    try{result=JSON.parse(stored)}catch{sessionStorage.removeItem(rankingPageKey);window.localStorage.removeItem(rankingPageKey)}
  }
  const money=cost=>Number.isFinite(cost)?'₩'+cost.toLocaleString('ko-KR'):'—';
  const buildTime=ms=>{
    if(!Number.isFinite(ms)||ms<0)return '—';
    const cs=Math.floor(ms/10);
    return [Math.floor(cs/6000),Math.floor(cs/100)%60].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(cs%100).padStart(2,'0');
  };
  back.href=result?.origin==='bridge.html'?'bridge.html':'index.html';
  if(result?.newTab)back.addEventListener('click',event=>{
    event.preventDefault();window.close();
    if(!window.closed)location.replace(back.href);
  });
  function showBoard(){
    const byTime=sort.value==='time'&&Array.isArray(board.timeBoard?.entries);
    const selected=byTime?board.timeBoard:board;
    const entries=selected.entries;
    page.querySelector('#rankingCount').textContent=(byTime?'건설 시간 기록 ':'전체 ')+selected.total+'개 · '+(byTime?'짧을수록 높은 순위':'비용이 낮을수록 높은 순위');
    rows.replaceChildren();
    for(const entry of entries){
      const row=rankingElement('tr');
      row.append(rankingElement('td','',entry.rank+'위'),rankingElement('td','',entry.nickname),
        rankingElement('td','',money(entry.cost)),rankingElement('td','',buildTime(entry.buildTimeMs)));
      rows.append(row);
    }
    if(!entries.length){
      const row=rankingElement('tr'),cell=rankingElement('td','','아직 등록된 기록이 없습니다.');
      cell.colSpan=4;row.append(cell);rows.append(row);
    }
    const own=result?.levelId===level.value&&result.difficulty===difficulty.value&&(!result.season||result.season===settings.season);
    const standing=own?(byTime?result.timeBoard?.comparison:result.comparison):null;
    page.querySelector('#rankingPercentile').textContent=standing?'등록 당시 상위 '+standing.percentile.toFixed(1)+'%':'플레이어 랭킹';
    page.querySelector('#rankingPlace').textContent=standing?'등록 당시 '+standing.rank+'위 / '+standing.total+'개 기록':'계약을 완료하고 내 기록을 등록해 보세요.';
    page.querySelector('#rankingCost').textContent=money(own?result.cost:null);
    page.querySelector('#rankingTime').textContent=buildTime(own?result.buildTimeMs:null);
    const bar=page.querySelector('#rankingPercentBar');
    bar.firstElementChild.style.height=(standing?Math.max(0,100-standing.percentile):0)+'%';
    bar.setAttribute('aria-label',standing?'등록 당시 상위 '+standing.percentile.toFixed(1)+'%':'내 등록 기록 없음');
    const timeAvailable=Array.isArray(board.timeBoard?.entries);
    sort.querySelector('[value="time"]').disabled=!timeAvailable;
    page.querySelector('#rankingSortNote').hidden=timeAvailable;
    page.querySelector('#rankingContract').textContent=level.selectedOptions[0].textContent+' · '+(difficulty.value==='easy'?'쉬움':'어려움');
    content.hidden=false;
  }
  async function loadBoard(cancel=false){
    clearTimeout(timer);timer=null;
    if(closed||document.hidden||!settings)return;
    if(request){
      if(!cancel)return;
      request.abort();
    }
    const controller=new AbortController();
    request=controller;
    refresh.disabled=true;
    status.textContent='최신 랭킹을 불러오는 중입니다…';
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const url=new URL(settings.webAppUrl);
      for(const [key,value] of Object.entries({season:settings.season,levelId:level.value,difficulty:difficulty.value,cost:0})){
        url.searchParams.set(key,value);
      }
      url.searchParams.set('_',Date.now());
      const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});
      if(!response.ok)throw new Error('서버 응답 오류 ('+response.status+')');
      const next=await response.json();
      if(!next.ok)throw new Error(next.error||'랭킹 응답을 확인할 수 없습니다.');
      if(!Array.isArray(next.entries)||!Number.isFinite(next.total))throw new Error('랭킹 서버의 응답 형식을 확인해 주세요.');
      if(request!==controller||closed)return;
      board=next;showBoard();
      status.textContent='마지막 갱신 '+new Date().toLocaleTimeString('ko-KR')+' · 10초마다 자동 갱신';
    }catch(error){
      if(request!==controller||closed)return;
      status.textContent=controller.signal.aborted?'응답 시간이 초과되었습니다. 다시 시도해 주세요.':'랭킹 조회 실패 · '+error.message;
    }finally{
      clearTimeout(timeout);
      if(request===controller){
        request=null;refresh.disabled=false;
        if(!closed&&!document.hidden)timer=setTimeout(loadBoard,10000);
      }
    }
  }
  const change=()=>{
    board=null;content.hidden=true;
    const url=new URL(location.href);
    url.searchParams.set('levelId',level.value);url.searchParams.set('difficulty',difficulty.value);
    history.replaceState(null,'',url);
    loadBoard(true);
  };
  level.addEventListener('change',change);difficulty.addEventListener('change',change);
  refresh.addEventListener('click',()=>loadBoard(true));
  sort.addEventListener('change',()=>{if(board)showBoard()});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearTimeout(timer);timer=null;request?.abort()}
    else loadBoard(true);
  });
  window.addEventListener('focus',()=>loadBoard(true));
  window.addEventListener('storage',event=>{
    if(event.key!==rankingPageKey||!event.newValue)return;
    try{result=JSON.parse(event.newValue)}catch{return}
    loadBoard(true);
  });
  window.addEventListener('pagehide',()=>{closed=true;clearTimeout(timer);request?.abort()});
  window.addEventListener('pageshow',event=>{if(event.persisted){closed=false;loadBoard(true)}});
  try{
    const [configResponse,contentResponse]=await Promise.all([fetch('project-settings.json',{cache:'no-store'}),fetch('campaign-content.json',{cache:'no-store'})]);
    if(!configResponse.ok||!contentResponse.ok)throw new Error('랭킹 설정 파일을 불러오지 못했습니다.');
    const config=await configResponse.json(),campaign=await contentResponse.json();
    settings=config.ranking;
    if(!settings?.enabled||!settings.webAppUrl)throw new Error('project-settings.json의 랭킹 연결 주소를 확인해 주세요.');
    const booth=rankingElement('optgroup');booth.label='AI 체험 시연';
    for(const [id,title] of [['booth_v2_long','2단계 · 더 긴 다리'],['booth_v2_weather','3단계 · 비와 눈 속 오르막'],['booth_v2_harbor','4단계 · 배와 화물차의 교차'],['booth_v2_cable','5단계 · 아래에서 당기는 케이블']]){
      const option=rankingElement('option','',title);option.value=id;booth.append(option);
    }
    level.append(booth);
    const main=rankingElement('optgroup');main.label='본편 계약';
    for(const [id,briefing] of Object.entries(campaign.briefings)){
      const option=rankingElement('option','',id.replace('set','세트 ').replace('_level',' · 계약 ').replace('_bonus',' · 보너스 ')+' · '+briefing.title);
      option.value=id;main.append(option);
    }
    level.append(main);
    const query=new URLSearchParams(location.search);
    const selected=query.get('levelId')||result?.levelId||'booth_v2_long';
    level.value=Array.from(level.options).some(option=>option.value===selected)?selected:'booth_v2_long';
    const selectedDifficulty=query.get('difficulty')||result?.difficulty;
    difficulty.value=selectedDifficulty==='hard'?'hard':'easy';
    await loadBoard();
  }catch(error){
    settings=null;refresh.disabled=true;
    status.textContent='랭킹을 준비하지 못했습니다. '+error.message;
  }
}

const rankingPage=document.querySelector('#rankingPage');
if(rankingPage)renderRankingPage(rankingPage);
