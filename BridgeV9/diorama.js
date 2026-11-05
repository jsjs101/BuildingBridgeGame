'use strict';

function mountLevelDiorama(root, levels, {selectedId, unlock, reducedMotion, start, briefing, fullscreen=false}) {
  const canvas=root.querySelector('canvas'), context=canvas.getContext('2d');
  const viewport=canvas.parentElement, details=root.querySelector('.dioramaDetails');
  const curtain=fullscreen?document.createElement('div'):null;
  if(curtain){curtain.className='boothSceneCurtain';curtain.setAttribute('aria-hidden','true');root.append(curtain)}
  const previous=root.querySelector('[data-step="-1"]'), next=root.querySelector('[data-step="1"]');
  const launch=root.querySelector('[data-launch]'), brief=root.querySelector('[data-brief]');
  const jumps=[...root.querySelectorAll('[data-level-index]')];
  const events=new AbortController(), {signal}=events;
  const targetIndex=id=>levels.findIndex(level=>level.id===id);
  const unlockedIndex=unlock?targetIndex(unlock.to):-1;
  const clearedIndex=unlock?targetIndex(unlock.from):-1;
  const models=levels.map((level,index)=>buildDiorama(level,index,fullscreen));
  let selected=Math.max(0,targetIndex(selectedId)), camera=selected, width=1,height=1,pixelRatio=1;
  let sequence=unlockedIndex>=0&&!reducedMotion;
  let sequenceStart=null, launchStart=null, frame=0, lastTime=0, launchLevel=null;
  let drag=null, dragOffset=0, suppressClick=false, hover=-1, wheelAt=-Infinity,wheelTravel=0;
  let hitRegions=[];
  let started=false;
  if(unlockedIndex>=0){
    selected=sequence&&clearedIndex>=0?clearedIndex:unlockedIndex;
    camera=selected;
  }
  const ease=t=>t*t*(3-2*t);
  const clamp01=t=>Math.max(0,Math.min(1,t));
  let cameraVelocity=0,yaw=0,pitch=0,detailOpacity=1,displayed=selected,settled=true;
  const copy=details.firstElementChild;
  function paintDetails(index){
    displayed=index;
    const level=levels[index],locked=!level.unlocked;
    details.querySelector('[data-number]').textContent=level.number;
    details.querySelector('h2').textContent=level.title;
    details.querySelector('[data-status]').textContent=sequence&&index===unlockedIndex?'지역 해금 중':level.completed?'✓ 완료':locked?'잠김':level.status||'도전 가능';
    details.querySelector('[data-summary]').textContent=locked?level.lockedHint:level.summary;
    details.querySelector('[data-record]').textContent=level.record;
  }
  function sync(updateDetails=true){
    const level=levels[selected],locked=!level.unlocked;
    if(updateDetails)paintDetails(selected);
    launch.textContent=level.actionLabel||(level.completed?'다시 도전 →':'설계 시작 →');
    launch.hidden=locked;
    launch.disabled=sequence||!!launchLevel||!settled;
    if(brief){brief.hidden=locked;brief.disabled=launch.disabled}
    previous.disabled=sequence||!!launchLevel||selected===0;
    next.disabled=sequence||!!launchLevel||selected===levels.length-1;
    jumps.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===selected)));
  }
  function moveTo(index){
    if(index===selected&&settled&&!dragOffset)return;
    selected=index;
    if(reducedMotion)camera=selected;
    if(fullscreen&&!reducedMotion)settled=false;
    sync(!fullscreen||reducedMotion);
    schedule();
  }
  function select(index){
    if(sequence||launchLevel||started)return;
    moveTo(Math.max(0,Math.min(levels.length-1,index)));
  }
  function schedule(){
    if(!frame&&!started&&!document.hidden)frame=requestAnimationFrame(draw);
  }
  function resize(){
    const box=canvas.getBoundingClientRect();
    if(!box.width||!box.height)return;
    width=box.width;height=box.height;
    pixelRatio=Math.min(devicePixelRatio||1,1.75);
    canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);
    schedule();
  }
  const observer=new ResizeObserver(resize);
  observer.observe(viewport);
  const hitAt=event=>{
    const box=canvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    return [...hitRegions].reverse().find(hit=>Math.abs(x-hit.x)<hit.w&&Math.abs(y-hit.y)<hit.h)?.index??-1;
  };
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||sequence||launchLevel)return;
    drag={id:event.pointerId,x:event.clientX,start:camera,moved:false};
    canvas.setPointerCapture(event.pointerId);
  },{signal});
  canvas.addEventListener('pointermove',event=>{
    if(drag&&event.pointerId===drag.id){
      const delta=event.clientX-drag.x;
      if(Math.abs(delta)>8)drag.moved=true;
      if(drag.moved){
        const position=Math.max(0,Math.min(levels.length-1,drag.start-delta/Math.max(115,width*.28)));
        dragOffset=position-selected;
        if(reducedMotion)camera=position;
        schedule();
      }
    }else if(event.pointerType==='mouse'){
      hover=hitAt(event);schedule();
    }
  },{signal});
  function endDrag(event){
    if(!drag||event.pointerId!==drag.id)return;
    const {moved}=drag;
    drag=null;
    suppressClick=moved;
    if(moved)select(Math.round(selected+dragOffset));
    dragOffset=0;
  }
  canvas.addEventListener('pointerup',endDrag,{signal});
  canvas.addEventListener('pointercancel',endDrag,{signal});
  canvas.addEventListener('pointerleave',()=>{hover=-1;schedule()},{signal});
  canvas.addEventListener('click',event=>{
    if(suppressClick){suppressClick=false;return}
    const index=hitAt(event);
    if(index>=0)select(index);
  },{signal});
  viewport.addEventListener('wheel',event=>{
    if(sequence||launchLevel)return;
    const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(!delta)return;
    event.preventDefault();
    const now=performance.now();
    if(now-wheelAt>180||Math.sign(delta)!==Math.sign(wheelTravel))wheelTravel=0;
    wheelAt=now;
    wheelTravel+=delta*(event.deltaMode===1?16:event.deltaMode===2?height:1);
    if(Math.abs(wheelTravel)<72)return;
    select(selected+Math.sign(wheelTravel));
    wheelTravel=0;
  },{signal,passive:false});
  root.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    select(event.key==='Home'?0:event.key==='End'?levels.length-1:selected+(event.key==='ArrowLeft'?-1:1));
  },{signal});
  previous.addEventListener('click',()=>select(selected-1),{signal});
  next.addEventListener('click',()=>select(selected+1),{signal});
  jumps.forEach((button,index)=>button.addEventListener('click',()=>select(index),{signal}));
  if(brief)brief.addEventListener('click',()=>briefing(levels[selected].id),{signal});
  launch.addEventListener('click',()=>{
    if(!levels[selected].unlocked||sequence||launchLevel)return;
    if(reducedMotion&&!fullscreen){started=true;start(levels[selected].id);return}
    launchLevel=levels[selected];
    root.classList.add('isLaunching');
    sync();schedule();
  },{signal});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;lastTime=0}
    else schedule();
  },{signal});
  function draw(now){
    frame=0;
    const dt=Math.min(100,lastTime?now-lastTime:16);
    lastTime=now;
    let unlockTime=Infinity;
    if(sequence){
      sequenceStart??=now;
      unlockTime=now-sequenceStart;
      if(unlockTime>=700&&selected!==unlockedIndex)moveTo(unlockedIndex);
      if(unlockTime>=2700){sequence=false;sync()}
    }
    let zoom=0;
    if(launchLevel){
      launchStart??=now;
      const progress=clamp01((now-launchStart)/(reducedMotion?140:fullscreen?580:520));
      zoom=reducedMotion?0:ease(progress);
      if(curtain)curtain.style.opacity=ease(clamp01((progress-.18)/.82));
      if(progress===1){started=true;start(launchLevel.id);return}
    }
    const target=selected+dragOffset;
    if(fullscreen&&!reducedMotion){
      // Exact critically damped integration keeps velocity across retargets.
      const seconds=dt/1000, response=8.5;
      const displacement=camera-target;
      const motion=cameraVelocity+response*displacement;
      const decay=Math.exp(-response*seconds);
      camera=target+(displacement+motion*seconds)*decay;
      cameraVelocity=(cameraVelocity-response*motion*seconds)*decay;
      const rest=Math.abs(camera-target)<.002&&Math.abs(cameraVelocity)<.025;
      if(rest){camera=target;cameraVelocity=0}
      const orientationBlend=1-Math.exp(-6*seconds);
      yaw+=(Math.max(-.15,Math.min(.15,cameraVelocity*.034))-yaw)*orientationBlend;
      pitch+=(Math.min(.045,Math.abs(cameraVelocity)*.012)-pitch)*orientationBlend;
      if(rest&&Math.abs(yaw)+Math.abs(pitch)<.001){yaw=0;pitch=0}
      if(settled!==rest){settled=rest;sync(false)}

      const showTarget=displayed===selected||Math.abs(camera-selected)<.58;
      const opacityTarget=displayed===selected?1:0;
      detailOpacity+=(opacityTarget-detailOpacity)*(1-Math.exp(-(opacityTarget?10:19)*seconds));
      if(displayed!==selected&&showTarget&&detailOpacity<.045)paintDetails(selected);
      if(detailOpacity>.998)detailOpacity=1;
      copy.style.opacity=detailOpacity;
      copy.style.transform=`translateY(${(1-detailOpacity)*(displayed===selected?13:-13)}px)`;
    }else{
      camera+=(target-camera)*(reducedMotion?1:1-Math.exp(-dt/105));
      if(Math.abs(target-camera)<.001)camera=target;
    }
    context.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    context.clearRect(0,0,width,height);
    if(fullscreen){
      const position=Math.max(0,Math.min(levels.length-1,camera));
      const base=Math.floor(position),blend=ease(position-base);
      const from=levels[base].environment,to=levels[Math.ceil(position)].environment;
      const mix=key=>from[key].map((value,i)=>Math.round(value+(to[key][i]-value)*blend));
      const sky=context.createLinearGradient(0,0,0,height);
      sky.addColorStop(0,`rgba(${mix('sky').join(',')},.26)`);
      sky.addColorStop(.49,`rgba(${mix('horizon').join(',')},.18)`);
      sky.addColorStop(1,'#101b2400');
      context.fillStyle=sky;context.fillRect(0,0,width,height);
    }
    const size=fullscreen?Math.min(width*.0025,height*.0036):Math.min(width*.00245,height*.00415), visible=[];
    for(let index=Math.max(0,Math.floor(camera)-2);index<=Math.min(levels.length-1,Math.ceil(camera)+2);index++){
      const delta=index-camera, distance=Math.abs(delta);
      if(!fullscreen&&distance>1.85)continue;
      visible.push({index,delta,distance});
    }
    visible.sort((a,b)=>b.distance-a.distance);
    hitRegions=[];
    for(const {index,delta,distance} of visible){
      const level=levels[index], model=models[index];
      const activating=index===unlockedIndex&&unlockTime<2700;
      const warmth=level.unlocked?(activating?clamp01((unlockTime-1150)/850):1):0;
      const lock=level.unlocked?(activating?1-clamp01((unlockTime-1850)/440):0):1;
      const clearing=index===clearedIndex&&unlockTime<1100;
      const pop=activating?Math.sin(Math.PI*clamp01((unlockTime-1800)/650))*12:0;
      const focused=index===selected;
      const hovered=index===hover&&!reducedMotion;
      const lifted=hovered?7:0;
      // Fixed world positions viewed by a camera dollying along the exhibit.
      const depthDistance=fullscreen?Math.hypot(delta,.22)-.22:distance;
      const depth=fullscreen?1+depthDistance*.49+delta*Math.sin(yaw)*.23:1+distance*.6;
      const x=width*(fullscreen?.47:.5)+delta*width*(fullscreen?.77:width<600?.43:.32)*(1+zoom)/(fullscreen?depth:1);
      const y=height*.58-depthDistance*height*.11+pitch*height*.42-pop-lifted;
      const scale=size/depth*(1+(focused?zoom*.9:0)+(hovered?.025:0));
      if(x+180*scale<0||x-180*scale>width)continue;
      const emphasis=1-ease(clamp01(distance/.8));
      const alpha=(fullscreen?1-ease(clamp01((distance-1.07)/.93)):Math.max(.25,1-distance*.31))*(focused?1:1-zoom);
      if(alpha<=0)continue;
      context.save();context.globalAlpha=alpha;
      drawDiorama(context,model,x,y,scale,{warmth,time:reducedMotion?0:now/1000,animate:!reducedMotion&&warmth>.1,
        complete:level.completed,clear:clearing?clamp01(unlockTime/760):null,lock,unlockTime:activating?unlockTime:Infinity,focus:fullscreen?emphasis:focused||index===hover,orbit:fullscreen?yaw:0});
      if(fullscreen&&warmth&&emphasis){
        const projectWeather=([px,py,pz])=>[x+(px*.94-(pz-80)*.34)*scale,y+(px*.20+(pz-80)*.48-py*.93)*scale];
        drawBoothPrecipitation(context,projectWeather,level.environment,reducedMotion?0:now/1000,
          {width:250,depth:160,count:32,height:84,opacity:warmth*emphasis*alpha});
      }
      if(zoom<.01&&distance<1.55){
        context.globalAlpha*=1-ease(clamp01((distance-1.18)/.37));
        context.fillStyle=focused?'#e4f4ee':'#c3d0d2';
        context.font=(focused?'600 13px':'500 11px')+' "Malgun Gothic",sans-serif';
        context.textAlign='center';
        const caption=level.number+' · '+level.title+(level.completed?' ✓':lock>0?' · 잠김':'');
        context.fillText(caption,x,Math.min(height-(fullscreen?90:12),y+scale*76+16),width*.39);
      }
      context.restore();
      hitRegions.push({index,x,y:y-scale*15,w:scale*150,h:scale*96});
    }
    if(sequence||launchLevel||!settled||displayed!==selected||detailOpacity<1||yaw||pitch||camera!==target||(!reducedMotion&&visible.some(({index})=>levels[index].unlocked)))schedule();
  }
  sync();resize();schedule();
  return ()=>{
    events.abort();observer.disconnect();cancelAnimationFrame(frame);
    for(const model of models)if(model.surface)model.surface.width=0;
    root.classList.remove('isLaunching');
    curtain?.remove();
  };
}

function buildDiorama(level,index,fullscreen){
  const palettes=[
    [[165,199,151],[147,129,109],[76,155,173],[60,113,93]],
    [[177,188,221],[124,112,156],[104,149,191],[100,129,159]],
    [[221,185,131],[171,117,94],[74,159,170],[113,137,91]],
    [[145,187,168],[109,126,133],[63,141,167],[55,119,99]]
  ];
  let seed=2166136261;
  for(const letter of level.id)seed=Math.imul(seed^letter.charCodeAt(0),16777619)>>>0;
  const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const boothPalettes=[palettes[0],[[139,180,134],[127,113,95],[51,130,148],[48,103,81]],
    [[188,202,216],[128,130,151],[78,135,170],[102,142,150]],[[209,180,126],[146,115,99],[65,151,164],[83,130,103]],[[199,207,216],[133,132,151],[78,135,170],[102,142,150]]];
  const [grass,stone,water,leaf]=fullscreen?boothPalettes[index]:palettes[(index+level.setNumber-1)%palettes.length];
  const faces=[],foundation=[],trees=[];
  const tint=(color,amount)=>color.map(c=>Math.max(0,Math.min(255,c+amount)));
  const face=(vertices,color)=>faces.push({vertices,color});
  const [leftX,leftY]=level.deck[0], [rightX,rightY]=level.deck.at(-1);
  const halfGap=Math.min(69,39+(rightX-leftX)*.027);
  const road=level.deck.map(([x,y])=>[(x-leftX)/(rightX-leftX)*halfGap*2-halfGap,Math.max(26,Math.min(76,44+((leftY+rightY)*.5-y)*.22))]);
  const edge=(a,b,y,z,depth,color)=>boxDiorama(faces,a,y,z,b-a,3,depth,color);
  boxDiorama(foundation,-142,-12,-89,284,12,178,[55,73,82]);
  if(fullscreen){
    boxDiorama(foundation,-141,-7,-88,282,2,176,[111,119,116]);
    boxDiorama(foundation,-139,-2,-86,278,2,172,[157,161,146]);
  }
  boxDiorama(foundation,-137,0,-84,274,8,168,water);
  for(const side of [-1,1]){
    const end=side<0?road[0]:road.at(-1), top=end[1]-3;
    const boundary=Array.from({length:7},(_,i)=>{
      const z=-83+i*27.6;
      return [side*(halfGap+(i===3?0:(random()-.5)*25)),top+(i===3?0:(random()-.5)*8),z];
    });
    const outer=fullscreen?boundary.map((point,i)=>[side*(126+random()*7),
      top+Math.sin(i*Math.PI/6)*5+(i===3?0:random()*7),point[2]]):null;
    const feet=fullscreen?boundary.map(([x,,z])=>[x-side*(7+random()*5),8,z]):null;
    const ledge=fullscreen?boundary.map(([x,y,z],i)=>[x-side*(2+random()*5),y*.52+6+Math.sin(i*1.7)*3,z]):null;
    const ridge=fullscreen?boundary.map(([x,y,z],i)=>[(x+outer[i][0])*.5,(y+outer[i][1])*.5+(i===3?0:Math.sin(i*.8)*3),z]):null;
    for(let i=0;i<6;i++){
      const p=boundary[i],q=boundary[i+1];
      const pOuter=outer?outer[i]:[side*(126+random()*9),top+random()*6,p[2]];
      const qOuter=outer?outer[i+1]:[pOuter[0],top+random()*6,q[2]];
      const pFoot=feet?feet[i]:[p[0]-side*(6+random()*6),7,p[2]];
      const qFoot=feet?feet[i+1]:[q[0]-side*(6+random()*6),7,q[2]];
      if(ridge){
        const a=ridge[i],b=ridge[i+1];
        face([p,q,a],tint(grass,random()*12-7));
        face([q,b,a],tint(grass,random()*14-5));
        face([a,b,pOuter],tint(grass,random()*13-6));
        face([b,qOuter,pOuter],tint(grass,random()*15-8));
      }else{
        face([p,q,pOuter],tint(grass,random()*18-9));
        face([q,qOuter,pOuter],tint(grass,random()*20-10));
      }
      if(fullscreen){
        const ps=ledge[i],qs=ledge[i+1];
        face([p,ps,q],tint(stone,random()*14+4));
        face([q,ps,qs],tint(stone,random()*18-9));
        face([ps,pFoot,qs],tint(stone,random()*13-22));
        face([qs,pFoot,qFoot],tint(stone,random()*11-28));
        const seam=(upper,lower,t)=>upper.map((value,k)=>value+(lower[k]-value)*t);
        for(const t of [.32,.67]){
          const a=seam(p,ps,t),b=seam(q,qs,t),c=seam(q,qs,t+.045),d=seam(p,ps,t+.045);
          for(const v of [a,b,c,d])v[0]-=side*.12;
          face([a,b,c,d],tint(stone,t<.5?-13:15));
        }
        const shore=(point,reach)=>[point[0]-side*reach,8.08,point[2]];
        face([shore(pFoot,0),shore(qFoot,0),shore(qFoot,8),shore(pFoot,8)],tint(water,25+i%3*4));
        face([shore(pFoot,8),shore(qFoot,8),shore(qFoot,16),shore(pFoot,16)],tint(water,12));
      }else{
        face([p,pFoot,q],tint(stone,random()*22-10));
        face([q,pFoot,qFoot],tint(stone,random()*24-24));
      }
      face([pOuter,qOuter,[qOuter[0],7,qOuter[2]],[pOuter[0],7,pOuter[2]]],tint(stone,-21));
      if(i===0||i===5){
        const outer=i===0?pOuter:qOuter,inner=i===0?p:q,foot=i===0?pFoot:qFoot;
        face([outer,inner,foot,[outer[0],7,outer[2]]],tint(stone,-14));
      }
    }
    const from=side<0?-132:halfGap,to=side<0?-halfGap:132;
    edge(from,to,top+7,-12,24,[76,89,93]);
    if(fullscreen){
      for(const z of [-10.6,9.7])face([[from,top+10.1,z],[to,top+10.1,z],[to,top+10.1,z+1],[from,top+10.1,z+1]],[181,186,172]);
      for(let x=from+3;x+6<to;x+=12)face([[x,top+10.2,-.65],[x+6,top+10.2,-.65],[x+6,top+10.2,.65],[x,top+10.2,.65]],[221,196,128]);
      for(let n=0;n<30;n++){
        const x=from+random()*(to-from),z=(random()-.5)*17,d=.28+random()*1.3;
        face([[x,top+10.18,z],[x+d,top+10.18,z+.24],[x+d*.3,top+10.18,z+.5]],n%3?[87,101,105]:[101,114,115]);
      }
    }else edge(side<0?-131:halfGap,side<0?-halfGap:131,top+10,-1.1,2.2,[212,198,156]);
    for(let n=0;n<7;n++){
      const x=side*(halfGap+14+random()*(113-halfGap)),z=(random()<.55?-1:1)*(25+random()*47);
      const h=13+random()*17;
      trees.push({x,y:top+3,z,h,phase:random()*6,broad:fullscreen&&(index===0||index===3)&&n%3===0});
    }
    for(let n=0;n<7;n++){
      const x=side*(halfGap+15+random()*(112-halfGap)),z=(random()<.5?-1:1)*(19+random()*57);
      const h=2+random()*5;
      if(fullscreen)sculptDiorama(faces,x,top+3,z,h,h*1.45,tint(stone,9),random()*6,false);
      else coneDiorama(faces,x,top+3,z,h,h*1.3,5,tint(stone,18));
    }
    if(fullscreen){
      for(let n=0;n<34;n++){
        const x=side*(halfGap+15+random()*(113-halfGap)),z=(random()<.5?-1:1)*(22+random()*52),h=2+random()*4;
        for(let blade=0;blade<3;blade++){
          const offset=blade-1;
          face([[x+offset-.6,top+4,z],[x+offset+.6,top+4,z+.4],[x+offset*1.65,top+4+h*(blade===1?1:.68),z+.7]],tint(grass,level.snowfall?24:-18-blade*5));
        }
        if(!level.snowfall&&n%5===0)face([[x-1,top+4+h,z],[x+1,top+4+h,z],[x+.5,top+4+h+.7,z+1],[x-.5,top+4+h+.7,z+1]],index===3?[242,205,132]:[242,229,191]);
      }
      for(let n=0;n<6;n++){
        const x=side*(halfGap+8+n*10);
        boxDiorama(faces,x-1,top+7,-15,2,5,2,[169,160,137]);
      }
      boxDiorama(faces,end[0]+side*31-25,top+11,-15,50,2,2,[153,157,144]);
    }
    boxDiorama(faces,end[0]-4,top-1,-17,8,8,34,[192,162,109]);
  }
  if(level.optionalSupport)boxDiorama(faces,-6,8,-8,12,23,16,[166,157,135]);
  if(level.ship){
    const hull=[[ -12,10,35],[12,10,35],[14,14,62],[0,14,72],[-14,14,62]];
    face(hull,[227,220,198]);
    face([hull[0],hull[1],[11,6,36],[-11,6,36]],[65,108,128]);
    boxDiorama(faces,-7,13,45,14,9,13,[228,220,199]);
    boxDiorama(faces,-4,22,49,8,4,7,[181,126,92]);
    if(fullscreen){
      face([hull[1],hull[2],hull[3],[0,9,71],[13,8,61],[11,6,36]],[97,126,130]);
      face([hull[0],hull[4],hull[3],[0,9,71],[-13,8,61],[-11,6,36]],[166,140,105]);
      for(let i=0;i<3;i++)boxDiorama(faces,-5+i*4,19,57,2.2,2.4,.65,[73,106,115]);
      boxDiorama(faces,1,26,52,1,9,1,[181,132,90]);
    }
  }
  return {foundation:foundation.map(cacheDioramaFace),terrain:faces.map(cacheDioramaFace),trees,road,leaf,halfGap,vehicle:level.vehicle,wind:level.wind,
    water,fullscreen,phase:index,snowfall:level.snowfall,steel:level.materials?.includes('steel'),bridgeStyle:level.bridgeStyle};
}

function boxDiorama(faces,x,y,z,w,h,d,color){
  const p=[[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d],[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]];
  for(const [indices,shade] of [[[0,3,7,4],-25],[[1,2,6,5],-19],[[0,1,5,4],-24],[[3,2,6,7],-12],[[4,5,6,7],10]]){
    faces.push({vertices:indices.map(i=>p[i]),color:color.map(c=>Math.max(0,Math.min(255,c+shade)))});
  }
}
function coneDiorama(faces,x,y,z,h,r,sides,color,lean=0){
  const tip=[x+lean,y+h,z],ring=Array.from({length:sides},(_,i)=>[x+Math.cos(i/sides*Math.PI*2)*r,y,z+Math.sin(i/sides*Math.PI*2)*r]);
  for(let i=0;i<sides;i++)faces.push({vertices:[ring[i],ring[(i+1)%sides],tip],color:color.map(c=>Math.max(0,Math.min(255,c+Math.cos(i/sides*Math.PI*2)*18)))});
}

function sculptDiorama(faces,x,y,z,h,r,color,phase,foliage,lean=0){
  const sides=7;
  const rings=[[0,.7],[.28,1],[.69,foliage?.7:.79],[1,foliage?.19:.42]].map(([height,radius],tier)=>
    Array.from({length:sides},(_,i)=>{
      const angle=i*Math.PI*2/sides+phase+tier*.16;
      const relief=1+Math.sin(i*3.7+phase+tier)*.19;
      return [x+Math.cos(angle)*r*radius*relief+lean*height,y+h*(height+Math.sin(i*2.2+phase)*.065),z+Math.sin(angle)*r*radius*relief];
    }));
  for(let tier=0;tier<rings.length-1;tier++)for(let i=0;i<sides;i++){
    const j=(i+1)%sides;
    const shade=Math.cos(i*6.283/sides+phase-1.15)*15+(tier-1)*6+Math.sin(i*2+tier)*6;
    const lit=color.map(value=>Math.max(0,Math.min(255,value+shade)));
    faces.push({vertices:[rings[tier][i],rings[tier][j],rings[tier+1][j],rings[tier+1][i]],color:lit});
  }
  faces.push({vertices:rings.at(-1),color:color.map(value=>Math.min(255,value+17))});
}

function projectDioramaFace({vertices,color}){
  const points=vertices.map(([x,y,z])=>[x*.94-z*.34,x*.20+z*.48-y*.93]);
  let depth=0,worldX=0;
  for(const [x,y,z] of vertices){depth+=x*.28+z*.72+y*.48;worldX+=x}
  return {points,depth:depth/vertices.length,color,worldX:worldX/vertices.length};
}

function cacheDioramaFace(face){
  const projected=projectDioramaFace(face);
  const path=new Path2D();
  path.moveTo(...projected.points[0]);
  for(let i=1;i<projected.points.length;i++)path.lineTo(...projected.points[i]);
  path.closePath();
  const [r,g,b]=face.color;
  const gray=Math.round((r*.21+g*.72+b*.07)*.62+18);
  return {...projected,path,lit:`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`,muted:`rgb(${gray},${gray},${gray})`};
}

function beamDiorama(add,ax,ay,bx,by,z,thickness,color){
  const length=Math.hypot(bx-ax,by-ay)||1;
  const nx=-(by-ay)/length*thickness*.5,ny=(bx-ax)/length*thickness*.5;
  const a=[ax+nx,ay+ny,z],b=[bx+nx,by+ny,z];
  add([a,b,[bx-nx,by-ny,z],[ax-nx,ay-ny,z]],color);
  add([a,b,[b[0],b[1],z+thickness],[a[0],a[1],z+thickness]],color.map(c=>Math.min(255,c+16)));
}

function paintDiorama(ctx,model,x,y,scale,state){
  const {warmth,time,animate,complete:finished,clear}=state;
  const complete=finished||model.bridgeStyle==='underslung';
  const faces=[], {road,halfGap}=model;
  const add=(vertices,color)=>faces.push({vertices,color});
  for(let i=0;i<15;i++){
    const z=-76+((i*29+(animate?time*(5+Math.abs(model.wind||0)/400):0))%150),wx=Math.sin(i*9.11)*halfGap*.63;
    add([[wx,8.2,z],[wx+9+(i%3)*4,8.2,z],[wx+13,8.2,z+2],[wx,8.2,z+2]],[143,197,200]);
  }
  if(model.fullscreen){
    for(let i=0;i<8;i++){
      const z=-76+i*20+Math.sin(animate?time*.85+i:i)*3,x=-halfGap*.58+Math.sin(i*2.6)*halfGap*.24;
      const light=12+Math.sin(animate?time*.7+i:i)*5;
      add([[x,8.12,z],[x+halfGap*.62,8.12,z+3],[x+halfGap*.32,8.12,z+7]],model.water.map(c=>c+light));
      add([[x+halfGap*.22,8.1,z+4],[x+halfGap*.8,8.1,z+5],[x+halfGap*.56,8.1,z+12]],model.water.map(c=>Math.round(c*.93)));
    }
  }
  for(const {x:tx,y:ty,z,h,phase,broad} of model.trees){
    const sway=animate?Math.sin(time*1.7+phase)*h*.09:0;
    if(model.fullscreen){
      add([[tx-4,ty+.12,z-4],[tx+11,ty+.12,z-2],[tx+17,ty+.12,z+5],[tx+9,ty+.12,z+10],[tx-2,ty+.12,z+5]],model.leaf.map(c=>Math.round(c*.9)));
      add([[tx-3,ty+.16,z-2],[tx+6,ty+.16,z-1],[tx+8,ty+.16,z+5],[tx,ty+.16,z+4]],model.leaf.map(c=>Math.round(c*.72)));
    }
    boxDiorama(faces,tx-1,ty,z-1,2,h*.33,2,[117,92,74]);
    if(model.fullscreen){
      const twig=model.leaf.map(c=>Math.round(c*.72));
      for(const side of [-1,1]){
        add([[tx,ty+h*.24,z],[tx+side*h*.28,ty+h*.54,z+side*1.8],[tx+side*h*.24,ty+h*.52,z+side*1.8],[tx,ty+h*.29,z]],[105,88,67]);
        sculptDiorama(faces,tx+side*h*.17+sway*.25,ty+h*.38,z+side*h*.08,h*.39,h*.24,twig,phase+side,true,sway*.6);
      }
      sculptDiorama(faces,tx+sway*.25,ty+h*.5,z,h*.56,h*(broad?.34:.26),model.leaf,phase,true,sway);
      if(model.snowfall)sculptDiorama(faces,tx+sway*.72,ty+h*.76,z,h*.3,h*.17,[211,225,232],phase,true,sway*.3);
    }else if(broad){
      coneDiorama(faces,tx-2+sway*.2,ty+h*.44,z,h*.46,h*.32,6,model.leaf,sway);
      coneDiorama(faces,tx+4+sway*.5,ty+h*.56,z+2,h*.46,h*.26,6,model.leaf.map(c=>c+18),sway*.65);
      coneDiorama(faces,tx+sway*.5,ty+h*.71,z-2,h*.38,h*.23,6,model.leaf.map(c=>c+28),sway*.72);
    }else{
      coneDiorama(faces,tx,ty+h*.23,z,h*.64,h*.30,5,model.leaf,sway*.65);
      coneDiorama(faces,tx+sway*.3,ty+h*.51,z,h*.55,h*.24,5,model.leaf.map(c=>c+13),sway);
    }
    if(model.snowfall&&!model.fullscreen)coneDiorama(faces,tx+sway*.55,ty+h*.74,z,h*.33,h*.13,5,[210,225,231],sway*.75);
  }
  for(let i=1;i<road.length;i++){
    const [a,ay]=road[i-1],[b,by]=road[i],w=complete?11:3.5;
    const left=complete?a:a+(b-a)*.21,right=complete?b:b-(b-a)*.21;
    const ly=complete?ay:ay+(by-ay)*.21,ry=complete?by:by-(by-ay)*.21;
    add([[left,ly+5,-w],[right,ry+5,-w],[right,ry+5,w],[left,ly+5,w]],complete?[89,110,112]:[232,193,104]);
    if(complete){
      if(model.fullscreen){
        add([[a,8.1,-7],[b,8.1,-7],[b+5,8.1,17],[a+5,8.1,17]],model.water.map(c=>Math.round(c*.76)));
        const metal=model.steel?[151,183,194]:[198,157,101],mid=(a+b)/2,top=(ay+by)/2+19;
        add([[a,ay+5,11],[b,by+5,11],[b,by+1,11],[a,ay+1,11]],[62,82,86]);
        add([[a,ay+5.04,-10.7],[b,by+5.04,-10.7],[b,by+5.04,-9.9],[a,ay+5.04,-9.9]],model.steel?[185,193,188]:[160,124,79]);
        boxDiorama(faces,a-.65,ay+1,-12,1.3,2.3,24,model.steel?[84,110,123]:[132,95,61]);
        add([[a+1,ay+5.1,-.8],[mid,top-13.9,-.8],[mid,top-13.9,.8],[a+1,ay+5.1,.8]],[224,204,150]);
        for(const z of [-11,11]){
          beamDiorama(add,a,ay+4,b,by+4,z,3.5,metal);
          if(model.bridgeStyle!=='underslung'){
            beamDiorama(add,a,ay+5,mid,top,z,2.4,metal);
            beamDiorama(add,mid,top,b,by+5,z,2.4,metal);
          }
          boxDiorama(faces,a-1.5,ay+3,z-2,3,4,4,model.steel?[105,130,137]:[224,204,162]);
          boxDiorama(faces,a-.65,ay+4.5,z+1.8,1.3,1.3,.7,[221,221,196]);
        }
      }else for(const z of [-11,11]){
        add([[a,ay+3,z],[b,by+3,z],[b,by+7,z],[a,ay+7,z]],[197,159,103]);
        add([[a,ay+6,z],[b,by+6,z],[(a+b)/2,(ay+by)/2+20,z]],[176,138,91]);
      }
    }
  }
  if(model.bridgeStyle==='underslung'){
    const [left,leftY]=road[0],[right,rightY]=road.at(-1),middle=(left+right)/2;
    const deckY=(leftY+rightY)/2,foot=deckY-26;
    for(const z of [-10,10]){
      beamDiorama(add,middle,deckY+4,middle,foot,z,3.4,[159,182,191]);
      beamDiorama(add,left,leftY+4,middle,foot,z,1.35,[205,188,117]);
      beamDiorama(add,middle,foot,right,rightY+4,z,1.35,[205,188,117]);
      for(const [x,y] of [[left,leftY+4],[middle,foot],[right,rightY+4]]){
        boxDiorama(faces,x-1.7,y-1.7,z-1.7,3.4,3.4,3.4,[158,174,177]);
      }
    }
    beamDiorama(add,left,8.2,right,8.2,12,1.2,model.water.map(c=>Math.round(c*.78)));
  }
  const carT=clear!==null?clear:animate?(time*.21)%1:.46;
  const carX=complete?-125+carT*250:-128+carT*(121-halfGap);
  let carY=carX<0?road[0][1]:road.at(-1)[1];
  for(let i=1;i<road.length;i++){
    const [a,ay]=road[i-1],[b,by]=road[i];
    if(carX>=a&&carX<=b){carY=ay+(by-ay)*(carX-a)/(b-a);break}
  }
  const long=model.vehicle==='CAR'?16:24, paint=model.vehicle==='TRUCK'?[222,157,86]:[216,119,94];
  boxDiorama(faces,carX-long/2,carY+6,-6,long,5,12,paint);
  boxDiorama(faces,carX-4,carY+11,-5,long-8,5,10,[115,160,176]);
  for(const wheel of [-1,1])for(const z of [-7,5])boxDiorama(faces,carX+wheel*(long*.31)-2,carY+4,z,4,4,2,[40,55,61]);
  boxDiorama(faces,carX+long/2-.4,carY+8,-5,1,2,2,[252,227,161]);
  const projected=model.terrain.concat(faces.map(projectDioramaFace)).sort((a,b)=>a.depth-b.depth);
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  for(const {points,color,worldX,path,lit,muted} of model.foundation.concat(projected)){
    if(path&&clear===null&&(warmth===0||warmth===1)){
      ctx.fillStyle=warmth===1?lit:muted;
      ctx.fill(path);
      continue;
    }
    const activation=warmth===0||warmth===1?warmth:Math.max(0,Math.min(1,warmth*1.5-(worldX+142)/568));
    const gray=(color[0]*.21+color[1]*.72+color[2]*.07)*.62+18;
    const light=clear===null?0:Math.sin(clear*Math.PI)*24;
    ctx.fillStyle='rgb('+color.map(c=>Math.round(gray+(c-gray)*activation+light)).join(',')+')';
    if(path){ctx.fill(path);continue}
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

function drawDiorama(ctx,model,x,y,scale,state){
  const {warmth,time,animate,clear,lock,unlockTime,focus,orbit}=state;
  ctx.save();
  if(model.fullscreen){
    const radius=169*scale;
    ctx.save();ctx.translate(x,y+48*scale);ctx.scale(1,.28);
    const shade=ctx.createRadialGradient(0,0,radius*.35,0,0,radius);
    shade.addColorStop(0,'#07131cc4');shade.addColorStop(.72,'#07131c72');shade.addColorStop(1,'#07131c00');
    ctx.fillStyle=shade;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
  }else{
    ctx.fillStyle=focus?'#122b32':'#112329';
    ctx.beginPath();ctx.ellipse(x,y+34*scale,151*scale,37*scale,0,0,Math.PI*2);ctx.fill();
  }
  if(focus){
    ctx.save();ctx.globalAlpha*=Number(focus);
    ctx.strokeStyle=clear===null?'#7bb7a754':'#b2f0bc';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(x,y+34*scale,156*scale,41*scale,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  if(model.fullscreen){
    // The 3D mesh is rasterized at the environment cadence. Camera transforms
    // use the cached surface on every frame, independent of mesh complexity.
    const sample=animate?Math.floor((time+model.phase/72)*20):-1;
    const glow=clear===null?-1:Math.round(clear*24);
    const warmthStep=Math.round(warmth*32);
    if(!model.surface){
      const surface=document.createElement('canvas');
      surface.width=960;surface.height=672;
      model.surface=surface;model.surfaceContext=surface.getContext('2d');
    }
    if(sample!==model.sample||glow!==model.glow||warmthStep!==model.warmthStep){
      const painter=model.surfaceContext;
      painter.clearRect(0,0,960,672);
      paintDiorama(painter,model,480,372,2.7,state);
      model.sample=sample;model.glow=glow;model.warmthStep=warmthStep;
    }
    ctx.save();ctx.translate(x,y);ctx.transform(Math.cos(orbit),orbit*.18,-orbit*.35,1,0,0);
    ctx.drawImage(model.surface,-480*scale/2.7,-372*scale/2.7,960*scale/2.7,672*scale/2.7);
    ctx.restore();
  }else paintDiorama(ctx,model,x,y,scale,state);
  if(lock>0){
    ctx.save();ctx.translate(x,y-76*scale);ctx.globalAlpha*=lock;
    const shake=unlockTime>=1790&&unlockTime<2050?Math.sin((unlockTime-1790)*.065)*.12:0;
    ctx.rotate(shake);ctx.scale(.65+lock*.35,.65+lock*.35);
    ctx.fillStyle='#20333c';ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c2cfd4';ctx.lineWidth=2.2;ctx.lineCap='round';
    const open=unlockTime>1980;
    ctx.beginPath();
    ctx.moveTo(-4.6,-2);
    ctx.lineTo(-4.6,-6);
    ctx.arc(0,-6,4.6,Math.PI,0);
    ctx.lineTo(4.6,open?-4.5:-2);
    ctx.stroke();
    ctx.beginPath();ctx.roundRect(-8,-2,16,12,2.4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(0,5.5);ctx.stroke();
    ctx.restore();
  }
  if(unlockTime>=2050&&unlockTime<2540){
    const t=(unlockTime-2050)/490;
    ctx.fillStyle='#b9f4d4';ctx.globalAlpha*=1-t;
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9;
      ctx.beginPath();ctx.arc(x+Math.cos(a)*t*90,y-64*scale+Math.sin(a)*t*42,2,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}
