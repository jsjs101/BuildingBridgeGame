'use strict';

function boothEnvironment(index,mission){
  const profiles=[
    {sky:[79,126,135],horizon:[243,222,167],ground:'#627755',shoulder:'#a19372',road:'#505b5d',treeDensity:3},
    {sky:[48,89,88],horizon:[191,210,170],ground:'#425f49',shoulder:'#7d8061',road:'#485958',treeDensity:5},
    {sky:[54,70,94],horizon:[185,196,218],ground:'#c2cdd5',shoulder:'#dde5e7',road:'#384952',treeDensity:5},
    {sky:[77,131,146],horizon:[246,211,159],ground:'#a39570',shoulder:'#b9a780',road:'#4c5759',treeDensity:3}
  ];
  return {...profiles[index],rain:mission?.weather==='rain',snow:!!mission?.snowfall,harbor:!!mission?.ship,
    grade:mission?.site.kind==='slope'?(mission.site.leftY-mission.site.rightY)/(mission.site.rightX-mission.site.leftX)*.36:0};
}

function drawBoothPrecipitation(ctx,project,environment,time,{width,depth,count,height,opacity=1,splashes=false,split=0,foreground=false,perspective=false}){
  if(!opacity||(!environment.rain&&!environment.snow))return;
  ctx.save();
  ctx.lineCap='round';
  for(const type of ['rain','snow']){
    if(!environment[type])continue;
    ctx.strokeStyle=type==='rain'?'#bedbea':'#f5f7ff';
    ctx.fillStyle='#ecf5ff';
    for(let i=0;i<count;i++){
      const fraction=(i*.6180339)%1, distance=i*.371%1;
      const z=depth*(.025+.975*(perspective?distance**2:distance));
      if(foreground?z>=split:z<split)continue;
      const fall=type==='rain'?height*(1.3+fraction):height*(.14+fraction*.28);
      const phase=(fraction+time*fall/height)%1;
      const y=height*(1-phase);
      const spread=perspective?width*(.4+.6*z/depth):width;
      const x=(i*.4142%1-.5)*spread+Math.sin(time*.9+i)*(type==='rain'?.14:.48)+y*.11;
      const [px,py]=project([x,y,z]);
      const [scaleX]=project([x+1,y,z]);
      const scale=Math.abs(scaleX-px);
      ctx.globalAlpha=opacity*(type==='rain'?(perspective?.72:.36):.9)*(1-.58*z/depth);
      ctx.beginPath();
      if(type==='rain'){
        const trail=height*(.028+fraction*.043);
        const [tx,ty]=project([x+trail*.11,y+trail,z]);
        ctx.lineWidth=Math.max(.65,Math.min(2.4,scale*(.023+fraction*.025)));
        ctx.moveTo(px,py);ctx.lineTo(tx,ty);ctx.stroke();
        if(splashes&&phase>.92&&Math.abs(x)<4.4){
          const impact=(phase-.92)/.08, groundX=x-y*.11;
          const [sx,sy]=project([groundX,.018,z]),radius=scale*(.06+.22*impact);
          ctx.globalAlpha*=1-impact;
          ctx.beginPath();ctx.ellipse(sx,sy,radius,radius*.27,0,0,Math.PI*2);ctx.stroke();
          const [dx,dy]=project([groundX+impact*.16,Math.sin(impact*Math.PI)*.14,z]);
          ctx.beginPath();ctx.arc(dx,dy,Math.max(.55,scale*.016),0,Math.PI*2);ctx.fill();
        }
      }else{
        ctx.arc(px,py,Math.max(.55,Math.min(3.2,scale*(.024+fraction*.025))),0,Math.PI*2);ctx.fill();
      }
    }
  }
  ctx.restore();
}

function mountBoothDrive({title, vehicle, environment, reducedMotion, weatherMotionReduced, cancel, arrive}) {
  const scene=document.createElement('section');
  scene.className='boothDrive';
  scene.setAttribute('aria-label','스테이지 진입');
  scene.innerHTML='<canvas aria-hidden="true"></canvas><header><span>TRUSS LAB / FIELD ROUTE</span><h1></h1></header><button class="boothButton driveBack" type="button">← 단계 지도</button><div class="driveControls"><p>Space 키 또는 아래 버튼을 누르는 동안 달립니다.</p><button class="boothButton isPrimary" type="button">누르고 달리기</button></div><div class="driveLight"></div>';
  scene.querySelector('h1').textContent=title;
  document.body.append(scene);
  const canvas=scene.querySelector('canvas'), ctx=canvas.getContext('2d');
  const scenery=document.createElement('canvas'), background=scenery.getContext('2d');
  const back=scene.querySelector('.driveBack'), pedal=scene.querySelector('.driveControls button');
  const light=scene.querySelector('.driveLight');
  const reveal=document.createElement('div');
  reveal.className='boothSceneCurtain';
  reveal.style.opacity='1';
  reveal.setAttribute('aria-hidden','true');
  scene.append(reveal);
  back.disabled=true;pedal.disabled=true;
  const events=new AbortController(), {signal}=events;
  const portal=145, lane=1.65, road=4.4, cameraHeight=4.8, cameraDepth=-9;
  const tilt=.11, sin=Math.sin(tilt),cos=Math.cos(tilt);
  let w=1,h=1,focal=1,ratio=1,position=0,speed=0,held=false,pointer=null;
  let frame=0,previous=null,entry=null,fadeIn=null,committed=false,disposed=false;
  let revealStart=null,ready=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>t*t*(3-2*t);
  const project=([x,y,z])=>{
    const forward=z-cameraDepth, up=y+Math.max(0,z)*environment.grade-cameraHeight;
    const depth=forward*cos-up*sin;
    return [w*.5+x*focal/depth,h*.45-(up*cos+forward*sin)*focal/depth];
  };
  function polygon(target,points,color) {
    target.fillStyle=color;target.beginPath();
    points.forEach((point,i)=>{const [x,y]=project(point);if(i)target.lineTo(x,y);else target.moveTo(x,y)});
    target.closePath();target.fill();
  }
  function box(faces,x,y,z,width,height,length,color,side,top){
    const a=[x,y,z],b=[x+width,y,z],c=[x+width,y,z+length],d=[x,y,z+length];
    const lift=p=>[p[0],p[1]+height,p[2]];
    faces.push([[a,d,lift(d),lift(a)],side],[[b,c,lift(c),lift(b)],side],
      [[a,b,lift(b),lift(a)],color],[[lift(a),lift(b),lift(c),lift(d)],top]);
  }
  function paintFaces(target,faces){
    const depth=face=>face[0].reduce((sum,p)=>sum+p[2]-.11*p[1],0)/face[0].length;
    faces.sort((a,b)=>depth(b)-depth(a));
    for(const [points,color] of faces)polygon(target,points,color);
  }
  let seed=7813;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const forest=[];
  for(const side of [-1,1])for(let row=0;row<environment.treeDensity;row++)for(let i=0;i<23;i++){
    const x=side*(6+row*5+random()*3),z=i*7+random()*6;
    if(environment.harbor&&side>0&&x>9&&z>48&&z<158)continue;
    forest.push({x,z,y:Math.sin(z*.09+row)*.42+row*.24,height:3.4+random()*5.6,wide:.78+random()*.72,tone:random()});
  }
  const ground=[];
  for(let i=0;i<200;i++)ground.push({x:(random()<.5?-1:1)*(4.8+random()*17),z:random()*155,size:.15+random()*.65});
  forest.sort((a,b)=>b.z-a.z);
  const nearTrees=forest.filter(tree=>tree.z<24);
  function tree(target,{x,y,z,height,wide,tone},wind=0){
    const faces=[];
    box(faces,x-.16,y,z-.16,.32,height*.48,.32,'#665143','#4e453c','#836b51');
    const palettes=tone>.66?['#416c54','#557e5b','#6c9569']:tone>.33?['#254f46','#38675a','#4f8168']:['#34574b','#466d57','#638565'];
    const tiers=z>85?2:3;
    for(let tier=0;tier<tiers;tier++){
      const base=y+height*(.21+tier*.19),tip=[x+.16+wind*(tier+1),base+height*.48,z],radius=height*.25*wide*(1-tier*.21);
      const ring=Array.from({length:5},(_,i)=>[x+Math.cos(i*1.257+tier*.45)*radius,base+(i%2)*.2,z+Math.sin(i*1.257+tier*.45)*radius]);
      for(let i=0;i<5;i++){
        const a=ring[i],b=ring[(i+1)%5];
        faces.push([[a,b,tip],palettes[i%3]]);
        if(environment.snow){
          const cap=p=>p.map((value,k)=>value+(tip[k]-value)*.27+(k===1?.045:0));
          faces.push([[cap(a),cap(b),[tip[0],tip[1]+.06,tip[2]]],['#d8e4e9','#eef4f2','#bdcfdc'][i%3]]);
        }
      }
    }
    target.globalAlpha=1-clamp((z-42)/155,0,.68);
    paintFaces(target,faces);target.globalAlpha=1;
  }
  function bake(){
    background.setTransform(ratio,0,0,ratio,0,0);
    const sky=background.createLinearGradient(0,0,0,h*.68);
    sky.addColorStop(0,'rgb('+environment.sky.join(',')+')');sky.addColorStop(1,'rgb('+environment.horizon.join(',')+')');
    background.fillStyle=sky;background.fillRect(0,0,w,h);
    const horizon=project([0,0,400])[1];
    const sun=background.createRadialGradient(w*.57,horizon-12,4,w*.57,horizon-12,h*.37);
    sun.addColorStop(0,environment.rain?'#dce5f195':'#fff3cc');sun.addColorStop(.45,environment.rain?'#bdcddd49':'#f1dba76b');sun.addColorStop(1,'#f1dba700');
    background.fillStyle=sun;background.fillRect(0,0,w,h);
    polygon(background,[[-180,-.08,-7],[180,-.08,-7],[180,-.08,250],[-180,-.08,250]],environment.ground);
    polygon(background,[[-road-.7,-.025,-5],[road+.7,-.025,-5],[road+.7,-.025,172],[-road-.7,-.025,172]],environment.shoulder);
    polygon(background,[[-road,0,-5],[road,0,-5],[road,0,172],[-road,0,172]],environment.road);
    for(let z=-4;z<168;z+=8){
      for(const x of [-road+.25,road-.32,0]){
        polygon(background,[[x,.012,z],[x+.075,.012,z],[x+.075,.012,z+(x?8:3.1)],[x,.012,z+(x?8:3.1)]],x?'#d6d6ba':'#e7bd77');
      }
    }
    if(environment.rain){
      const [,,farRight,farLeft]=[[-road,.015,-5],[road,.015,-5],[road,.015,172],[-road,.015,172]].map(project);
      const sheen=background.createLinearGradient(0,Math.min(farRight[1],farLeft[1]),0,h);
      sheen.addColorStop(0,'#a5bfd65c');
      sheen.addColorStop(.48,'#7d9baa28');
      sheen.addColorStop(1,'#99b6c723');
      polygon(background,[[-road,.015,-5],[road,.015,-5],[road,.015,172],[-road,.015,172]],sheen);
      for(let i=0;i<26;i++){
        const z=3+i*5.8,x=(i*.618%1-.5)*7.5;
        polygon(background,[[x-.6,.019,z],[x+.45,.019,z+.1],[x+.7,.019,z+2],[x-.32,.019,z+3]],i%2?'#7996a653':'#c2d6df37');
      }
    }
    if(environment.harbor){
      polygon(background,[[9,-.03,48],[130,-.03,48],[130,-.03,158],[9,-.03,158]],'#4d8e9c');
      for(let z=50;z<155;z+=5)polygon(background,[[10,-.02,z],[85,-.02,z+1],[77,-.02,z+2],[10,-.02,z+1]],'#8dc0c26a');
    }
    background.globalAlpha=.18;
    for(const {x,z,size} of ground){
      const grit=x*.19;
      polygon(background,[[grit,.014,z],[grit+size*.2,.014,z],[grit+.1,.014,z+size*.36]],'#aab0a3');
    }
    background.globalAlpha=1;
    for(const {x,z,size} of ground){
      if(environment.harbor&&x>9&&z>48&&z<158)continue;
      const y=-.06;
      const peak=[x+.2,y+size,z+.24],left=[x-size,y,z],right=[x+size,y,z],rear=[x+.1,y,z+size];
      polygon(background,[left,peak,rear],environment.snow?'#d5dce3':'#777c69');
      polygon(background,[left,right,peak],environment.snow?'#eef1f1':'#87917a');
      polygon(background,[peak,right,rear],environment.snow?'#a9b7c5':'#596960');
    }
    for(const item of forest){
      if(item.z>100)continue;
      const [x,y]=project([item.x,0,item.z]),scale=focal/(item.z-cameraDepth);
      background.fillStyle='#182e293f';background.beginPath();
      background.ellipse(x+scale*.65,y,scale*1.45,scale*.38,-.14,0,Math.PI*2);background.fill();
    }
    for(const item of forest)if(reducedMotion||item.z>=24)tree(background,item);
  }
  function resize(){
    w=scene.clientWidth;h=scene.clientHeight;
    ratio=Math.min(devicePixelRatio||1,1.5);
    focal=h*1.13;
    for(const surface of [canvas,scenery]){surface.width=Math.round(w*ratio);surface.height=Math.round(h*ratio)}
    bake();schedule();
  }
  function car(target,travel){
    const z=position,truck=vehicle==='TRUCK',bus=vehicle==='BUS';
    const length=truck||bus?4.15:3.1, width=truck||bus?1.95:1.7;
    const x=lane-width*.5, bounce=reducedMotion?0:Math.sin(travel*4.2)*.025*clamp(speed/12,0,1);
    const faces=[];
    const [sx,sy]=project([lane,.025,z+length*.5]),scale=focal/(z-cameraDepth);
    target.fillStyle='#1725288c';target.beginPath();target.ellipse(sx,sy,scale*width*.72,scale*length*.24,0,0,Math.PI*2);target.fill();
    box(faces,x,.33+bounce,z,width,.57,length,'#b65e39','#944c37','#e7a065');
    box(faces,x-.04,.3+bounce,z-.12,width+.08,.19,.28,'#38474b','#303e42','#67716d');
    const rear=z+(truck?.75:.48),roof=bus?1.99:truck?1.85:1.55;
    const pillars=[[x+.12,.88+bounce,rear],[x+width-.12,.88+bounce,rear],[x+width-.22,roof+bounce,rear+.37],[x+.22,roof+bounce,rear+.37]];
    faces.push([pillars,'#294a52']);
    const cabinEnd=z+length-.55;
    faces.push([[pillars[0],pillars[3],[x+.22,roof+bounce,cabinEnd],[x+.12,.88+bounce,cabinEnd+.3]],'#49747a'],
      [[pillars[1],pillars[2],[x+width-.22,roof+bounce,cabinEnd],[x+width-.12,.88+bounce,cabinEnd+.3]],'#31565f'],
      [[pillars[3],pillars[2],[x+width-.22,roof+bounce,cabinEnd],[x+.22,roof+bounce,cabinEnd]],'#dc945c']);
    if(truck)box(faces,x+.09,.9+bounce,z+.07,width-.18,.47,2.15,'#807b67','#716c5d','#b5a38a');
    for(const side of [x+.1,x+width-.37]){
      box(faces,side,.62+bounce,z-.06,.27,.15,.07,'#ff6959','#c33f36','#ffae75');
      box(faces,side,.68+bounce,z+length,.26,.14,.08,'#f2deaa','#bdab84','#fff2c7');
    }
    box(faces,lane-.18,.51+bounce,z-.08,.36,.14,.05,'#e5d6b4','#858e7a','#e9e1c9');
    for(const side of [x-.045,x+width+.045])for(const axle of [z+.62,z+length-.62]){
      const wheelX=side, radius=.32;
      const ring=Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return [wheelX,radius+Math.sin(a)*radius,axle+Math.cos(a)*radius]});
      faces.push([ring,'#263237']);
      const angle=travel/radius;
      for(let i=0;i<5;i++){
        const a=angle+i*Math.PI*2/5;
        faces.push([[[wheelX,.32,axle],[wheelX,.32+Math.sin(a)*.23,axle+Math.cos(a)*.23],[wheelX,.32+Math.sin(a+.18)*.23,axle+Math.cos(a+.18)*.23]],'#9eaaa5']);
      }
    }
    faces.push([[[x+.26,1.02+bounce,rear-.015],[x+width-.26,1.02+bounce,rear-.015],[x+width-.32,1.07+bounce,rear+.025],[x+.29,1.07+bounce,rear+.025]],'#85a2a47a']);
    if(environment.rain){
      const [lx,ly]=project([lane,.018,z-.45]);
      const reflection=target.createRadialGradient(lx,ly,0,lx,ly,Math.max(1,scale*1.2));
      reflection.addColorStop(0,'#f4815e52');reflection.addColorStop(1,'#f4815e00');
      target.fillStyle=reflection;target.fillRect(lx-scale*1.2,ly-scale*1.2,scale*2.4,scale*2.4);
    }
    paintFaces(target,faces);
  }
  function schedule(){if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(draw)}
  function draw(now){
    frame=0;
    const dt=previous===null?0:clamp((now-previous)/1000,0,.055);
    previous=now;
    if(!ready){
      revealStart??=now;
      const progress=clamp((now-revealStart)/(reducedMotion?160:470),0,1);
      reveal.style.opacity=1-ease(progress);
      if(progress===1){
        ready=true;reveal.remove();back.disabled=false;pedal.disabled=false;
        back.focus({preventScroll:true});
      }
    }
    if(!committed){
      const target=held||pointer!==null||entry!==null?39:0;
      speed+=(target-speed)*(1-Math.exp(-(target?1.65:4.8)*dt));
      if(speed<.035&&!target)speed=0;
      position+=speed*dt;
      if(position>=portal-4&&entry===null){
        entry=now;back.disabled=true;pedal.disabled=true;scene.classList.add('isEntering');
      }
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.drawImage(scenery,0,0,w,h);
      if(!reducedMotion)for(const treeModel of nearTrees)tree(ctx,treeModel,Math.sin(now*.0014+treeModel.x*.8)*.037);
      const [px,py]=project([lane,1.5,portal]);
      const approach=ease(clamp((position-68)/75,0,1)),radius=h*(.07+approach*.19);
      const glow=ctx.createRadialGradient(px,py,0,px,py,radius);
      glow.addColorStop(0,'#fff9de');glow.addColorStop(.22,'#ffebae9e');glow.addColorStop(1,'#ffebae00');
      ctx.fillStyle=glow;ctx.fillRect(px-radius,py-radius,radius*2,radius*2);
      const time=weatherMotionReduced?0:now/1000;
      const weather={width:38,depth:125,count:environment.rain&&environment.snow?128:144,height:12,perspective:true,splashes:!weatherMotionReduced,split:position+2};
      drawBoothPrecipitation(ctx,project,environment,time,weather);
      ctx.save();ctx.globalAlpha=1-clamp((position-portal+2)/10,0,1);car(ctx,position);ctx.restore();
      if(environment.rain&&speed>2&&!reducedMotion){
        ctx.save();ctx.fillStyle='#bad5e0';
        for(let i=0;i<16;i++){
          const age=(i*.618+time*2.5)%1,side=i%2?1:-1;
          const [sx,sy]=project([lane+side*(.78+age*.46),.05+Math.sin(age*Math.PI)*speed*.009,position+.6-age*speed*.08]);
          ctx.globalAlpha=(1-age)*Math.min(.55,speed*.014);
          ctx.beginPath();ctx.arc(sx,sy,Math.max(.65,focal/(position-cameraDepth)*.018),0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }
      drawBoothPrecipitation(ctx,project,environment,time,{...weather,foreground:true});
      if(entry!==null){
        const progress=clamp((now-entry)/(reducedMotion?330:700),0,1);
        light.style.opacity=ease(progress);
        if(progress===1){
          committed=true;
          scene.classList.add('isArrived');
          arrive();
          fadeIn=now;
        }
      }
    }else{
      const progress=clamp((now-fadeIn-100)/(reducedMotion?280:620),0,1);
      light.style.opacity=1-ease(progress);
      if(progress===1){dispose();return}
    }
    schedule();
  }
  function release(){held=false;pointer=null;pedal.classList.remove('isHeld')}
  function dispose(){
    if(disposed)return;
    disposed=true;events.abort();cancelAnimationFrame(frame);
    scene.remove();scenery.width=0;canvas.width=0;
  }
  function goBack(){if(entry!==null)return;dispose();cancel()}
  back.addEventListener('click',goBack,{signal});
  window.addEventListener('keydown',event=>{
    if(event.code==='Space'){
      event.preventDefault();event.stopImmediatePropagation();
      if(ready&&entry===null&&!event.repeat){held=true;pedal.classList.add('isHeld');schedule()}
    }else if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();goBack()}
  },{signal,capture:true});
  window.addEventListener('keyup',event=>{
    if(event.code==='Space'){event.preventDefault();event.stopImmediatePropagation();held=false;pedal.classList.toggle('isHeld',pointer!==null)}
  },{signal,capture:true});
  pedal.addEventListener('pointerdown',event=>{
    if(!ready||event.button!==0||entry!==null)return;
    pointer=event.pointerId;pedal.setPointerCapture(pointer);pedal.classList.add('isHeld');schedule();
  },{signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])pedal.addEventListener(type,event=>{
    if(pointer===event.pointerId){pointer=null;pedal.classList.toggle('isHeld',held)}
  },{signal});
  window.addEventListener('blur',release,{signal});
  window.addEventListener('resize',resize,{signal});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){release();cancelAnimationFrame(frame);frame=0;previous=null}
    else schedule();
  },{signal});
  resize();
  return dispose;
}
