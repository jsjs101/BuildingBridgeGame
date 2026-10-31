function createBridgeRanking(settings) {
  'use strict';
  let request = null;
  const money = cost => '₩' + cost.toLocaleString('ko-KR');
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function stop() { if(request) request.abort(); request=null; }
  function show(panel, snapshot) {
    stop();
    panel.replaceChildren();
    panel.hidden=false;
    const header=element('header','rankingHeader');
    header.append(element('h2','','설계 리더보드'),element('p','',snapshot.levelTitle+' · '+(snapshot.difficulty==='easy'?'쉬움':'어려움')));
    const current=element('div','rankingCurrent');
    current.append(element('span','','이번 설계 비용'),element('strong','',money(snapshot.cost)));
    const status=element('p','rankingStatus',''), results=element('div','rankingResults');
    status.setAttribute('role','status');
    panel.append(header,current,status,results);
    if(!settings || !settings.enabled || !settings.webAppUrl) {
      status.textContent='랭킹 서버 연결 준비 중';
      results.append(element('p','rankingNote','Apps Script 배포 주소를 연결하면 비용 순위가 표시됩니다.'));
      return;
    }
    const controller=new AbortController(); request=controller;
    let pending=false,registered=false;
    const attemptId=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    const form=element('form','rankingSubmit'), label=element('label','','공개 닉네임'), input=element('input');
    input.type='text';input.maxLength=20;input.required=true;input.autocomplete='nickname';input.value=localStorage.getItem('trusslab-ranking-name')||'';
    label.append(input);
    const submit=element('button','completionAction isPrimary','기록 등록');submit.type='submit';
    const retry=element('button','completionAction','새로고침');retry.type='button';
    const note=element('p','rankingNote','등록 시 닉네임·비용·설계가 공개됩니다.');
    form.append(label,submit,retry,note);panel.append(form);
    if(snapshot.ineligible) { submit.disabled=true;input.disabled=true;note.textContent='개발자 기능 또는 사용자 설정이 적용된 실행은 조회만 가능합니다. 기본 설정으로 새로 실행한 뒤 등록하세요.'; }
    function render(board, submitted) {
      results.replaceChildren();
      if(board.comparison) {
        const summary=element('div','rankingStanding');
        const percentile=board.comparison.percentile;
        const bar=element('div','rankingPercentBar'),fill=element('span');
        bar.setAttribute('role','img');bar.setAttribute('aria-label','상위 '+percentile.toFixed(1)+'%. 상위에 가까울수록 막대가 높습니다.');
        fill.style.height=Math.max(0,Math.min(100,100-percentile))+'%';bar.append(fill);
        const caption=element('div','rankingPercentCaption');
        caption.append(element('strong','','상위 '+percentile.toFixed(1)+'%'),element('span','',board.comparison.rank+'위 / '+board.comparison.total+'개 기록'+(submitted?' · 이번 기록':' · 등록 시 예상')));
        summary.append(bar,caption);
        results.append(summary);
      }
      if(!board.entries.length) {
        results.append(element('p','rankingEmpty','아직 등록된 기록이 없습니다.'));
        return;
      }
      results.append(element('h3','','플레이어 순위'));
      for(const entry of board.entries) {
        const row=element('div','rankingEntry');
        if(entry.mine) row.classList.add('isMine');
        row.append(element('span','rankingPlace',String(entry.rank)),element('span','rankingName',entry.nickname+(entry.mine?' · 나':'')),element('b','',money(entry.cost)));
        results.append(row);
      }
    }
    async function load(submitting=false) {
      if(pending || controller.signal.aborted || (submitting&&registered))return;
      pending=true;submit.disabled=true;retry.disabled=true;
      status.hidden=false;
      status.textContent=submitting?'기록을 등록하고 있습니다…':'순위를 불러오고 있습니다…';
      const timeout=setTimeout(()=>controller.abort(),20000);
      try {
        const url=new URL(settings.webAppUrl);
        let options={signal:controller.signal,redirect:'follow',credentials:'omit'};
        if(submitting||registered) {
          let token=localStorage.getItem('trusslab-ranking-token');
          if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('trusslab-ranking-token',token)}
          options={...options,method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...snapshot,action:'submit',season:settings.season,token,attemptId,nickname:input.value.trim()})};
        } else {
          for(const [key,value] of Object.entries({season:settings.season,levelId:snapshot.levelId,difficulty:snapshot.difficulty,cost:snapshot.cost}))url.searchParams.set(key,value);
        }
        const response=await fetch(url,options);
        if(!response.ok)throw new Error('랭킹 서버 응답 오류 ('+response.status+')');
        const board=await response.json();
        if(!board.ok)throw new Error(board.error||'랭킹 응답을 확인할 수 없습니다.');
        if((submitting||registered)&&board.registered!==true)throw new Error('랭킹 서버의 Code.gs를 새 버전으로 배포해 주세요.');
        if(controller.signal.aborted)return;
        render(board,submitting||registered);
        status.hidden=!submitting;
        status.textContent=submitting?'기록을 등록했습니다.':'';
        panel.scrollTop=0;
        if(submitting){registered=true;submit.textContent='등록 완료';input.disabled=true;localStorage.setItem('trusslab-ranking-name',input.value.trim())}
      } catch(error) {
        if(request!==controller || !panel.isConnected || !panel.closest('.show'))return;
        status.textContent=controller.signal.aborted?'요청이 종료되었습니다. 결과창을 다시 열어 주세요.':'랭킹 연결 실패: '+error.message+' 새로고침으로 다시 시도할 수 있습니다.';
        console.error('[TRUSS LAB] Ranking',error);
      } finally {clearTimeout(timeout);pending=false;submit.disabled=!!snapshot.ineligible||registered;retry.disabled=false;}
    }
    form.addEventListener('submit',event=>{event.preventDefault();if(!snapshot.ineligible)load(true)});
    retry.addEventListener('click',()=>load());
    load();
  }
  return {show,stop};
}
