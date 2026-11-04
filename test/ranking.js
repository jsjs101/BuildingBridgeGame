const rankingPageKey='trusslab-ranking-page';

function rankingElement(tag, className, text) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}

function createBridgeRanking(settings, storage=localStorage) {
  let request=null;
  let pendingTab=null;
  function stop(){
    if(request)request.abort();
    if(pendingTab&&!pendingTab.closed)pendingTab.close();
    request=null;
    pendingTab=null;
  }
  function show(container, snapshot) {
    stop();
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
    container.append(form);

    if(snapshot.ineligible||!settings.webAppUrl){
      input.disabled=true;
      submit.disabled=true;
      note.textContent=snapshot.ineligible?'기본 설정으로 완료한 기록만 등록할 수 있습니다.':'랭킹 서버 연결을 준비 중입니다.';
      return;
    }

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
      const tab=window.open('','_blank');
      pendingTab=tab;
      if(tab){
        tab.document.title='랭킹 등록 중 · TRUSS LAB';
        tab.document.body.textContent='랭킹 기록을 등록하고 있습니다…';
      }
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
        storage.setItem('trusslab-ranking-name',nickname);
        const result={
          levelTitle:snapshot.levelTitle,difficulty:snapshot.difficulty,
          cost:snapshot.cost,buildTimeMs:snapshot.buildTimeMs,
          origin:document.body.classList.contains('booth-mode')?'bridge.html':'index.html',
          total:board.total,comparison:board.comparison,
          entries:board.entries.map(({rank,nickname,cost,buildTimeMs,mine})=>({rank,nickname,cost,buildTimeMs,mine}))
        };
        const rankingUrl=new URL('ranking.html',location.href);
        if(tab&&!tab.closed){
          tab.sessionStorage.setItem(rankingPageKey,JSON.stringify({...result,newTab:true}));
          tab.opener=null;
          tab.location.replace(rankingUrl.href);
          pendingTab=null;
        }
        sessionStorage.setItem(rankingPageKey,JSON.stringify(result));
        const link=rankingElement('a','completionAction','랭킹 페이지 열기');
        link.href=rankingUrl.href;
        status.replaceChildren('기록을 등록했습니다. ',link);
      }catch(error){
        if(request!==controller)return;
        if(tab&&!tab.closed)tab.close();
        pendingTab=null;
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

function renderRankingPage(page) {
  const back=page.querySelector('#rankingBack');
  const content=page.querySelector('#rankingContent');
  const empty=page.querySelector('#rankingEmpty');
  const stored=sessionStorage.getItem(rankingPageKey);
  let result=null;
  if(stored){
    try{result=JSON.parse(stored)}catch{sessionStorage.removeItem(rankingPageKey)}
  }
  if(!result||!Array.isArray(result.entries))return;

  const money=cost=>'₩'+cost.toLocaleString('ko-KR');
  const buildTime=ms=>{
    if(!Number.isFinite(ms)||ms<0)return '—';
    const cs=Math.floor(ms/10);
    return [Math.floor(cs/6000),Math.floor(cs/100)%60].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(cs%100).padStart(2,'0');
  };
  back.href=result.origin==='bridge.html'?'bridge.html':'index.html';
  if(result.newTab)back.addEventListener('click',event=>{
    event.preventDefault();
    window.close();
    if(!window.closed)location.replace(back.href);
  });
  page.querySelector('#rankingContract').textContent=result.levelTitle+' · '+(result.difficulty==='easy'?'쉬움':'어려움');
  page.querySelector('#rankingCost').textContent=money(result.cost);
  page.querySelector('#rankingTime').textContent=buildTime(result.buildTimeMs);
  page.querySelector('#rankingCount').textContent='전체 '+result.total+'개 기록 · 비용이 낮을수록 높은 순위';
  if(result.comparison){
    const {rank,total,percentile}=result.comparison;
    page.querySelector('#rankingPercentile').textContent='상위 '+percentile.toFixed(1)+'%';
    page.querySelector('#rankingPlace').textContent=rank+'위 / '+total+'개 기록';
    const bar=page.querySelector('#rankingPercentBar');
    bar.firstElementChild.style.height=Math.max(0,Math.min(100,100-percentile))+'%';
    bar.setAttribute('aria-label','상위 '+percentile.toFixed(1)+'%');
  }
  const rows=page.querySelector('#rankingRows');
  for(const entry of result.entries){
    const row=rankingElement('tr',entry.mine?'isMine':'');
    row.append(rankingElement('td','',entry.rank+'위'),rankingElement('td','',entry.nickname+(entry.mine?' · 나':'')),
      rankingElement('td','',money(entry.cost)),rankingElement('td','',buildTime(entry.buildTimeMs)));
    rows.append(row);
  }
  empty.hidden=true;
  content.hidden=false;
}

const rankingPage=document.querySelector('#rankingPage');
if(rankingPage)renderRankingPage(rankingPage);
