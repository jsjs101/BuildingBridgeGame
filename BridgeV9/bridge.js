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
      prompt:'가운데로 큰 배가 지나가고 18 kN 화물차가 다리를 건너야 합니다. 항로 위로 아치형 도로와 강철 골조를 어떻게 만들면 좋을지 쉬운 말로 설명해 주세요.'},
    {number:5,id:'booth_v2_cable',stageIndex:3,type:'main',globalNumber:5,title:'아래에서 당기는 케이블',concept:'케이블 인장과 강철 압축',
      objective:'강화 도로 가운데에서 아래로 강철 기둥을 내리고, 그 아래 끝을 양쪽 지지점에 케이블로 연결해 버스를 통과시키세요.',
      site:{kind:'flat',leftX:200,rightX:1000,leftY:390,rightY:390,segments:6},
      vehicle:'BUS',load:13000,budget:22000,serviceDeflection:64,materials:['roadHeavy','steel','cable'],
      conditionCodes:['ROAD_REQUIRED'],materialLimits:{roadHeavy:6,steel:1},axles:[[-34,.28],[0,.34],[34,.38]],weather:'clear',snowfall:true,bridgeStyle:'underslung',
      tip:'강화 도로는 최대 6개, 강철은 최대 1개입니다. 가운데에서 아래로 강철 약 140u → 아래 끝과 양쪽 빨간 지지점을 케이블로 연결하세요.',
      prompt:'강화 도로 최대 6개, 강철 최대 1개만 사용할 수 있는 하부 케이블 교량을 처음 만들고 있어요. 가운데 강철 기둥의 아래 끝을 양쪽 지지점에 케이블로 잇는 순서와 케이블의 인장·기둥의 압축 원리를 쉬운 말로 설명하고, 현재 설계에서 다음에 연결할 위치를 알려 주세요.'}
  ];
  const labels=['첫 다리 연습',...missions.map(mission=>mission.title)];
  const lastStage=labels.length-1;
  const fresh=()=>({version:3,current:0,furthest:0,started:false,finished:false,statuses:labels.map(()=>'ready'),results:{},drafts:{},designs:{}});
  let state=fresh(),loaded=false,resetting=false,unmountMap=null,pendingUnlock=null,closeEnding=null,endingOpening=false;
  try{
    const saved=JSON.parse(storage.getItem(storageKey)||'null');
    if(saved&&[2,3].includes(saved.version)&&Number.isInteger(saved.current)&&saved.current>=0&&saved.current<labels.length&&Array.isArray(saved.statuses)&&saved.statuses.length>=4){
      state={...fresh(),...saved,version:3,statuses:labels.map((_,i)=>saved.statuses[i]||'ready')};
      if(saved.version===2&&saved.finished){state.finished=false;state.current=lastStage;state.furthest=lastStage}
    }
  }catch(error){console.warn('[TRUSS LAB] 시연 기록을 새로 시작합니다.',error)}
  state.furthest=Math.min(lastStage,Math.max(state.current,state.furthest||0,...state.statuses.map((status,index)=>status==='ready'?0:index+1)));
  const save=()=>storage.setItem(storageKey,JSON.stringify(state));
  const screen=$('#boothScreen'),hud=$('#boothHUD'),intro=$('#titleScreen'),introStart=$('#titleStartBtn');
  let introLeaving=false;
  const wordmark=intro.querySelector('.introWordmark');
  const bridge=intro.querySelector('.introBridge');
  const ctx=bridge.getContext('2d');
  const glyphs=Array.from(wordmark.querySelectorAll('.introGlyph'),(slot,index)=>{
    slot.style.setProperty('--glyph',index);
    return {slot,ink:slot.firstElementChild,center:0,energy:0,drift:0};
  });

  const surfaces=[];
  const trim=[];
  const road=(t,y=0,offset=0)=>[69*t*t+3.4*(1-t)**5+offset,y,4+43*t];
  const deckWidth=2.9,bridgeEnd=1.6;
  function strip(from,to,low,high,left,right,colors,deckTop=false){
    const a=road(from,low,left),b=road(from,low,right),c=road(to,low,right),d=road(to,low,left);
    const e=road(from,high,left),f=road(from,high,right),g=road(to,high,right),h=road(to,high,left);
    surfaces.push([[e,f,g,h],colors[0],deckTop],[[a,e,h,d],colors[1]],[[b,f,g,c],colors[2]]);
  }
  const deckColors=['#304447','#18292d','#23383b'];
  const curbColors=['#617777','#3b5053','#475e61'];
  const deckSegments=60;
  for(let i=0;i<Math.round(deckSegments*bridgeEnd);i++){
    const from=i/deckSegments,to=(i+1)/deckSegments;
    strip(from,to,-.63,0,-deckWidth,deckWidth,deckColors,true);
    for(const side of [-1,1]){
      const edge=side*deckWidth;
      strip(from,to,0,.12,edge-.09,edge+.09,curbColors);
      trim.push([road(from,.56,edge),road(to,.56,edge),'#607676',.032]);
      if(i%2===0)trim.push([road(from,.1,edge),road(from,.56,edge),'#607676',.03]);
    }
    strip(from,to,-.82,-.57,-1.38,1.38,['#2c4144','#16282c','#24383b']);
    for(const side of [-1,1]){
      const edge=side*deckWidth;
      trim.push([road(from,.33,edge),road(to,.33,edge),'#3e575a',.042]);
      trim.push([road(from,.014,side*2.58),road(to,.014,side*2.58),'#6d8180',.025]);
    }
    if(i%3===0)trim.push([road(from,.017),road(Math.min(bridgeEnd,from+.022),.017),'#87928a',.028]);
  }
  for(const [position,height] of [[.57,11],[.87,10],[1.17,10],[1.46,9.6]]){
    for(const side of [-1,1]){
      const foot=road(position,-3.1,side*3.12);
      const crown=road(position,height,side*1.65);
      const crossSection=(point,w,d)=>{
        const cut=w*.28;
        return [[-w+cut,-d],[w-cut,-d],[w,-d+cut],[w,d-cut],[w-cut,d],[-w+cut,d],[-w,d-cut],[-w,-d+cut]]
          .map(([x,z])=>[point[0]+x,point[1],point[2]+z]);
      };
      const base=crossSection(foot,.54,.78),top=crossSection(crown,.19,.31);
      for(let i=0;i<base.length;i++){
        const next=(i+1)%base.length;
        surfaces.push([[base[i],base[next],top[next],top[i]],['#516467','#65797a','#34494d','#3d5357','#294044','#395154','#43595c','#576e70'][i]]);
      }
      surfaces.push([top,'#748785']);
      for(const direction of [-1,1]){
        for(let index=1;index<=8;index++){
          const t=position+direction*(.022+index*.014);
          const anchor=road(t,.18,side*2.62);
          const stay=road(position,height-.35-index*.28,side*(1.69+index*.03));
          trim.push([anchor,stay,side===-1?'#a3bbb8':'#708c8e',.024+index*.0016]);
          trim.push([road(t-.002,.15,side*2.62),road(t+.002,.15,side*2.62),'#a5b3a8',.17]);
        }
      }
    }
    strip(position-.009,position+.009,-.97,-.71,-3.6,3.6,curbColors);
    strip(position-.014,position+.014,-1.25,-.97,-2.85,2.85,['#41575b','#263c40','#324b4e']);
  }

  function vehicleMesh(length,width,roof,paint,cargo){
    const faces=[];
    function body(back,front,bottom,top,halfWidth,taper,colors){
      const a=[-halfWidth,bottom,back],b=[halfWidth,bottom,back];
      const c=[halfWidth,bottom,front],d=[-halfWidth,bottom,front];
      const e=[-halfWidth*taper,top,back+(front-back)*(1-taper)*.5];
      const f=[-e[0],top,e[2]],g=[f[0],top,front-(front-back)*(1-taper)*.5],h=[e[0],top,g[2]];
      faces.push([[e,f,g,h],colors[0]],[[a,e,h,d],colors[1]],[[b,f,g,c],colors[2]],
        [[a,b,f,e],colors[1]],[[d,c,g,h],colors[2]]);
    }
    const half=length/2,side=width/2,wheel=.16;
    body(-half,half,.16,.38,side,.86,paint);
    body(-half-.015,-half+.09,.16,.23,side,.94,['#7b8e8c','#44585a','#44585a']);
    body(half-.09,half+.015,.16,.23,side,.94,['#728584','#44585a','#44585a']);
    const glass=['#667e80','#253f45','#354e53'];
    if(cargo){
      body(-half+.06,half*.23,.39,roof,side,.98,paint);
      body(half*.27,half*.91,.38,roof-.07,side*.91,.86,glass);
    }else{
      body(-half*.65,half*.51,.37,roof,side*.91,.68,glass);
      body(-half*.48,half*.35,roof-.018,roof+.026,side*.67,.88,paint);
    }
    for(const end of [-1,1]){
      for(const lamp of [-1,1]){
        const x=side*lamp*.67,z=end*(half*.96);
        faces.push([[[x-.055,.27,z],[x+.055,.27,z],[x+.05,.33,z],[x-.05,.33,z]],end===1?'#b6c5bc':'#8d7975']);
      }
    }
    return {faces,wheel,side,half,axles:length>2.4?[-half*.68,-half*.38,half*.58]:[-half*.62,half*.61]};
  }

  const models=[
    vehicleMesh(1.30,.68,.62,['#869d99','#536d70','#637d7e'],false),
    vehicleMesh(1.53,.76,.80,['#718986','#435b60','#506c6d'],false),
    vehicleMesh(1.96,.79,.91,['#9aa8a1','#667b7c','#788d8b'],true),
    vehicleMesh(2.72,.88,1.12,['#788f90','#4f686d','#647b7e'],true)
  ];
  const wheelSides=12;
  const wheelRing=Array.from({length:wheelSides},(_,i)=>{
    const angle=i*2*Math.PI/wheelSides;
    return [Math.cos(angle),Math.sin(angle)];
  });
  const pathStart=-.066,pathEnd=bridgeEnd+.15;
  const roadSamples=[0];
  const sampleCount=180;
  for(let i=1;i<=sampleCount;i++){
    const a=road(pathStart+(pathEnd-pathStart)*(i-1)/sampleCount);
    const b=road(pathStart+(pathEnd-pathStart)*i/sampleCount);
    roadSamples.push(roadSamples[i-1]+Math.hypot(b[0]-a[0],b[2]-a[2]));
  }
  const routeLength=roadSamples[sampleCount];
  const traffic=[
    {lane:-1,model:0,distance:2,cruise:6.2},
    {lane:-1,model:3,distance:40,cruise:3.7},
    {lane:-1,model:1,distance:72,cruise:5.2},
    {lane:1,model:2,distance:21,cruise:4.6},
    {lane:1,model:0,distance:54,cruise:5.8}
  ].map(car=>({...car,travel:car.distance,speed:car.cruise,nextSpeed:car.cruise}));

  function advanceTraffic(dt){
    for(const car of traffic){
      let gap=routeLength;
      for(const other of traffic){
        if(car===other||car.lane!==other.lane)continue;
        const separation=(other.distance-car.distance+routeLength)%routeLength;
        gap=Math.min(gap,separation-models[car.model].half-models[other.model].half);
      }
      const target=Math.min(car.cruise,Math.max(0,(gap-2.1)*.76));
      car.nextSpeed=Math.min(car.speed+(target-car.speed)*(1-Math.exp(-dt*2.8)),Math.max(0,gap-1)/dt);
    }
    for(const car of traffic){
      car.speed=car.nextSpeed;
      car.travel+=car.speed*dt;
      car.distance=(car.distance+car.speed*dt)%routeLength;
    }
  }

  function addTraffic(projectFace,geometry){
    for(const car of traffic){
      let low=0,high=sampleCount;
      while(high-low>1){
        const mid=(high+low)>>1;
        if(roadSamples[mid]<=car.distance)low=mid;else high=mid;
      }
      const fraction=(car.distance-roadSamples[low])/(roadSamples[high]-roadSamples[low]);
      const t=pathStart+(pathEnd-pathStart)*(low+fraction)/sampleCount;
      const opacity=Math.min(1,(bridgeEnd-t)/.045,(t-pathStart)/.04);
      if(opacity<=0)continue;
      const model=models[car.model];
      const [x,,z]=road(t,0,car.lane*1.34);
      const slope=138*t-17*(1-t)**4;
      const norm=Math.hypot(slope,43),forwardX=slope/norm,forwardZ=43/norm;
      const lift=.012*Math.sin(car.travel*3.2);
      const vertex=([across,y,along])=>[x+across*forwardZ+along*forwardX,y,z-across*forwardX+along*forwardZ];
      function add(face,color,alpha=opacity,stroke=0,depthBias=0){
        const points=projectFace(face.map(vertex));
        if(!points.length)return;
        geometry.push({points,color,depth:points.reduce((sum,p)=>sum+p[2],0)/points.length+depthBias,alpha,stroke});
      }
      const shadowScale=model.side*1.3;
      add(wheelRing.map(([a,b])=>[a*shadowScale,.03,b*model.half*1.02]),'#111e20',opacity*.52,0,.13);
      for(const [face,color] of model.faces) add(face.map(([a,y,b])=>[a,y+lift,b]),color);
      const angle=car.travel/model.wheel;
      const spoke=Math.max(.55,18/(z+1.1));
      for(const axle of model.axles){
        for(const side of [-1,1]){
          const rim=side*model.side*.97;
          add(wheelRing.map(([a,b])=>[rim,model.wheel+a*model.wheel,axle+b*model.wheel]),'#121f22');
          const hub=rim+side*.014;
          add(wheelRing.map(([a,b])=>[hub,model.wheel+a*.086,axle+b*.086]),'#657a7b');
          add([[hub,model.wheel+Math.cos(angle)*.066,axle+Math.sin(angle)*.066],
               [hub,model.wheel-Math.cos(angle)*.066,axle-Math.sin(angle)*.066]],'#b4c2bd',opacity,spoke);
        }
      }
    }
  }

  let frame=0,lastTime=0,mouseX=0,mouseY=0,cameraX=-.65,cameraY=.35;
  let cursor=null,direction=0,lastPointer=null,touchUntil=0,sceneDirty=true,radius=1,wordBounds;
  let lastMove=0;

  const approachTime=1.08, rideTime=2.68, dissolveTime=.76;
  const mix=(a,b,t)=>a+(b-a)*t;
  const unit=t=>Math.min(1,Math.max(0,t));
  const ease=t=>{t=unit(t);return t*t*(3-2*t)};
  let departure=null;

  function rideCamera(elapsed){
    const approach=ease(elapsed/approachTime);
    const progress=unit((elapsed-approachTime)/rideTime);
    const t=mix(.15,.985,ease(progress));
    const [x,,z]=road(t);
    const [lookX,,lookZ]=road(t+.09);
    const yaw=Math.atan2(lookX-x,lookZ-z);
    const pace=departure.reduced?0:Math.sin(progress*Math.PI);
    const pitch=.085,bank=-.047*pace;
    const cy=Math.cos(yaw/2),sy=Math.sin(yaw/2);
    const cp=Math.cos(pitch/2),sp=Math.sin(pitch/2);
    const cb=Math.cos(bank/2),sb=Math.sin(bank/2);
    // Interpolate from the title camera's identity orientation to the road orientation.
    const qx=(cy*sp*cb+sy*cp*sb)*approach;
    const qy=(sy*cp*cb-cy*sp*sb)*approach;
    const qz=(cy*cp*sb-sy*sp*cb)*approach;
    const qw=mix(1,cy*cp*cb+sy*sp*sb,approach);
    const length=Math.hypot(qx,qy,qz,qw);
    return {
      x:mix(-departure.panX*.34,x,approach),y:mix(4+departure.panY*.28,1.72,approach),
      z:mix(-1.1,z,approach),qx:qx/length,qy:qy/length,qz:qz/length,qw:qw/length,
      approach,pace
    };
  }

  function clipNear(points){
    const near=.27;
    if(points.every(point=>point[2]>=near))return points;
    if(points.length===2){
      if(points.every(point=>point[2]<near))return [];
      const [a,b]=points;
      const cut=a[2]<near?0:1;
      const amount=(near-a[2])/(b[2]-a[2]);
      return points.map((point,index)=>index===cut?[mix(a[0],b[0],amount),mix(a[1],b[1],amount),near]:point);
    }
    const result=[];
    let previous=points[points.length-1];
    for(const point of points){
      const inside=point[2]>=near,previousInside=previous[2]>=near;
      if(inside!==previousInside){
        const amount=(near-previous[2])/(point[2]-previous[2]);
        result.push([mix(previous[0],point[0],amount),mix(previous[1],point[1],amount),near]);
      }
      if(inside)result.push(point);
      previous=point;
    }
    return result;
  }

  let projectedBridge=[];
  function drawBridge(reproject,view){
    const {width,height}=bridge;
    if(!ctx||!width||!height)return;
    ctx.clearRect(0,0,width,height);
    const narrow=innerWidth<=680;
    const focalX=width*(narrow?.43:.49),focalY=height*.64;
    const horizon=height*(narrow?.67:.55);
    function project([x,y,z]){
      const depth=z+1.1;
      const sway=1-Math.min(1,depth/50);
      return [width*(narrow?.20:.36)+focalX*(x+cameraX*.34*sway)/depth,
        horizon+focalY*(4-y+cameraY*.28*sway)/depth,depth];
    }
    let projectFace=face=>face.map(project);
    if(view){
      const {x,y,z,qx,qy,qz,qw,approach,pace}=view;
      const right=[1-2*(qy*qy+qz*qz),2*(qx*qy+qw*qz),2*(qx*qz-qw*qy)];
      const up=[2*(qx*qy-qw*qz),1-2*(qx*qx+qz*qz),2*(qy*qz+qw*qx)];
      const forward=[2*(qx*qz+qw*qy),2*(qy*qz-qw*qx),1-2*(qx*qx+qy*qy)];
      const centerX=width*mix(.36-departure.panX*.34*.49/50,.5,approach);
      const centerY=height*mix(.55-departure.panY*.28*.64/50,.51,approach);
      const fx=mix(focalX,focalY,approach)*(1-.07*pace),fy=focalY*(1-.07*pace);
      projectFace=face=>clipNear(face.map(([a,b,c])=>{
        const dx=a-x,dy=b-y,dz=c-z;
        const dot=axis=>dx*axis[0]+dy*axis[1]+dz*axis[2];
        return [dot(right),dot(up),dot(forward)];
      })).map(([a,b,depth])=>[centerX+fx*a/depth,centerY-fy*b/depth,depth]);
    }
    const shadow=ctx.createRadialGradient(width*.68,height*.91,0,width*.68,height*.91,width*.33);
    shadow.addColorStop(0,'rgba(0,0,0,.33)');shadow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=shadow;ctx.globalAlpha=1-(view?.approach??0);ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;
    if(reproject){
      projectedBridge=[];
      for(const [face,color,deckTop] of surfaces){
        const points=projectFace(face);
        if(points.length>=3)projectedBridge.push({points,color,deckTop,depth:points.reduce((sum,p)=>sum+p[2],0)/points.length});
      }
      for(const [a,b,color,thickness] of trim){
        const points=projectFace([a,b]);
        if(!points.length)continue;
        const depth=(points[0][2]+points[1][2])/2;
        projectedBridge.push({points,color,depth,stroke:Math.min(18,Math.max(.52,focalX*thickness/depth))});
      }
    }
    const geometry=projectedBridge.slice();
    addTraffic(projectFace,geometry);
    geometry.sort((a,b)=>b.depth-a.depth);
    ctx.lineCap='round';
    for(const {points,color,stroke,depth,deckTop,alpha=1} of geometry){
      ctx.globalAlpha=deckTop?1:alpha*(1-Math.min(.39,depth*.008)+(stroke?cameraX*.035:0));
      ctx.beginPath();
      points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
      if(stroke){ctx.strokeStyle=color;ctx.lineWidth=stroke;ctx.stroke()}
      else{
        ctx.closePath();ctx.fillStyle=color;ctx.fill();
        if(deckTop){ctx.strokeStyle=color;ctx.lineWidth=.9;ctx.stroke()}
      }
    }
    ctx.globalAlpha=1;
    if(view){
      const mist=ease((departure.elapsed-approachTime-rideTime+1.16)/.9);
      const farEnd=projectFace([road(1.03,1.7)])[0];
      if(mist>0&&farEnd){
        const x=Math.max(0,Math.min(width,farEnd[0]));
        const y=Math.max(0,Math.min(height,farEnd[1]));
        const glow=ctx.createRadialGradient(x,y,0,x,y,height*mix(.09,.46,mist));
        glow.addColorStop(0,'rgba(232,250,239,.74)');
        glow.addColorStop(.42,'rgba(190,226,213,.23)');
        glow.addColorStop(1,'rgba(190,226,213,0)');
        ctx.globalAlpha=mist;
        ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
        ctx.globalAlpha=1;
      }
    }
  }

  function scheduleIntro(){
    if(!frame&&(!introLeaving||departure)&&!intro.hidden&&!document.hidden)frame=requestAnimationFrame(animateIntro);
  }
  function animateIntro(now){
    frame=0;
    if(intro.hidden||document.hidden){lastTime=0;return}
    const reduced=engine.reducedMotion();
    const dt=lastTime?Math.min(.05,(now-lastTime)/1000):1/60;
    lastTime=now;
    if(departure){
      advanceTraffic(dt);
      departure.elapsed+=dt;
      drawBridge(true,rideCamera(departure.elapsed));
      const light=ease((departure.elapsed-approachTime-rideTime+.62)/.62);
      departure.light.style.opacity=light;
      if(light===1){finishDeparture();return}
      scheduleIntro();
      return;
    }
    const blend=reduced?1:1-Math.exp(-dt*13);
    if(touchUntil&&now>=touchUntil){touchUntil=0;cursor=null;mouseX=0;mouseY=0}
    const tracking=!reduced&&now-lastMove<650;
    const targetX=tracking?mouseX:0,targetY=tracking?mouseY:0;
    if(dt>0)advanceTraffic(dt);
    const reproject=sceneDirty||Math.abs(cameraX-targetX)+Math.abs(cameraY-targetY)>.001;
    cameraX+=(targetX-cameraX)*blend;cameraY+=(targetY-cameraY)*blend;
    drawBridge(reproject);sceneDirty=false;
    for(const glyph of glyphs){
      const distance=cursor===null?Infinity:Math.abs(cursor-glyph.center);
      const energy=Math.max(0,1-distance/radius)**1.55;
      const spread=Math.sign(glyph.center-(cursor??glyph.center));
      const drift=energy*(direction*.65+spread*.35);
      if(Math.abs(energy-glyph.energy)+Math.abs(drift-glyph.drift)<.001)continue;
      glyph.energy+=(energy-glyph.energy)*blend;
      glyph.drift+=(drift-glyph.drift)*blend;
      const strength=glyph.energy,flow=glyph.drift;
      glyph.ink.style.transform=`translate(${(flow*.27).toFixed(3)}em,${(-strength*.11).toFixed(3)}em) scale(${(1+strength*.22+flow*.26).toFixed(3)},${(1-strength*.12).toFixed(3)})`;
      glyph.ink.style.setProperty('--ink',`${(strength*.046).toFixed(3)}em`);
    }
    scheduleIntro();
  }
  function sizeIntro(){
    if(intro.hidden)return;
    wordBounds=wordmark.getBoundingClientRect();
    radius=wordBounds.width/glyphs.length*2.65;
    const ratio=Math.min(devicePixelRatio,1.5);
    bridge.width=Math.round(bridge.clientWidth*ratio);
    bridge.height=Math.round(bridge.clientHeight*ratio);
    for(const glyph of glyphs){
      const bounds=glyph.slot.getBoundingClientRect();
      glyph.center=bounds.left+bounds.width/2;
    }
    sceneDirty=true;scheduleIntro();
  }
  const introResize=new ResizeObserver(sizeIntro);
  introResize.observe(intro);
  introResize.observe(wordmark);
  intro.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||introLeaving||!wordBounds)return;
    const {clientX,clientY,timeStamp}=event;
    lastMove=performance.now();
    mouseX=clientX/innerWidth*2-1;mouseY=clientY/innerHeight*2-1;
    cursor=clientX>=wordBounds.left&&clientX<=wordBounds.right&&clientY>=wordBounds.top&&clientY<=wordBounds.bottom?clientX:null;
    const speed=lastPointer?(clientX-lastPointer.x)/Math.max(8,timeStamp-lastPointer.time):0;
    direction=Math.max(-1,Math.min(1,speed/1.4));
    lastPointer={x:clientX,time:timeStamp};scheduleIntro();
  },{capture:true});
  intro.addEventListener('pointerleave',()=>{
    cursor=null;mouseX=0;mouseY=0;lastPointer=null;scheduleIntro();
  });
  wordmark.addEventListener('pointerup',event=>{
    if(event.pointerType!=='touch'||engine.reducedMotion()||introLeaving)return;
    cursor=event.clientX;direction=.35;touchUntil=performance.now()+280;scheduleIntro();
  });
  document.addEventListener('visibilitychange',()=>{
    lastTime=0;
    if(!document.hidden)scheduleIntro();
  });
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
    else {engine.startMission(missions[state.current-1],state.drafts[state.current],labels.length);loaded=true}
    save();
  }
  function enterBooth(){
    if(!state.started){state.started=true;save()}
    engine.showScreen('booth');
  }
  function finishDeparture(){
    const {light}=departure;
    departure=null;
    screen.inert=true;
    enterBooth();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const fade=light.animate([{opacity:1},{opacity:0}],{duration:dissolveTime*1000,easing:'ease-out'});
      const controls=screen.querySelectorAll('.boothMapBrand,.dioramaDetails,.boothMapFooter');
      for(const control of controls){
        control.animate([{opacity:0,translate:'0 9px'},{opacity:1,translate:'0 0'}],
          {duration:510,delay:140,easing:'ease-out',fill:'backwards'});
      }
      fade.onfinish=()=>{
        light.remove();screen.inert=false;
        screen.querySelector('[data-screen-autofocus]:not(:disabled)')?.focus({preventScroll:true});
      };
    }));
  }
  function begin(){
    if(introLeaving||intro.hidden||innerWidth<1100)return;
    introLeaving=true;
    introStart.disabled=true;
    intro.inert=true;
    const reduced=engine.reducedMotion();
    const light=element('div','boothDepartureLight');
    light.setAttribute('aria-hidden','true');
    document.body.append(light);
    departure={elapsed:0,panX:cameraX,panY:cameraY,light,reduced};
    intro.classList.add('isLeaving');
    scheduleIntro();
  }
  const isUnlocked=index=>index<=state.furthest;
  function unlockNext(index){
    if(index>=lastStage||isUnlocked(index+1))return;
    state.furthest=index+1;
    pendingUnlock={from:String(index),to:String(index+1)};
  }
  function next(skipped=false){
    const previous=state.current;
    if(skipped&&state.statuses[state.current]!=='complete')state.statuses[state.current]='skipped';
    if(state.current===lastStage){end();return}
    unlockNext(previous);
    pause();state.current=previous+1;save();engine.showScreen('booth');
  }
  function end(){
    pause();state.finished=true;save();hud.hidden=true;engine.showScreen('booth');
    if(state.statuses[lastStage]==='complete')showEnding();
  }
  async function showEnding(){
    if(closeEnding||endingOpening)return;
    endingOpening=true;
    const music=new Audio('source/Truss.mp3');
    music.loop=true;
    music.volume=.65;
    try{
      // Start within the click handler, before fetching the credits.
      const musicStarted=music.play().then(()=>true,error=>{
        console.warn('[TRUSS LAB] 엔딩 음악 재생이 시작되지 않았습니다.',error);
        return false;
      });
      const credits=await loadBoothCredits();
      for(let index=0;index<labels.length;index++){
        const draft=state.drafts[index];
        if(state.designs[index]||state.statuses[index]!=='complete'||!draft)continue;
        const design=typeof draft.design==='string'?JSON.parse(draft.design):draft.design;
        const deck=engine.previewDeck(missions[index-1]);
        state.designs[index]={deck,nodes:[...deck.map(([x,y],id)=>({id,x,y})),...design.nodes],members:design.members};
      }
      save();
      unmountMap?.();unmountMap=null;screen.inert=true;
      closeEnding=mountBoothEnding({
        bridges:labels.map((title,index)=>({title,design:state.designs[index],environment:boothEnvironment(index,missions[index-1]),completed:state.statuses[index]==='complete'})),
        credits,reducedMotion:engine.reducedMotion(),music,musicStarted,
        close:()=>{closeEnding();closeEnding=null;screen.inert=false;render();screen.querySelector('[data-launch]').focus({preventScroll:true})}
      });
    }catch(error){music.pause();console.error('[TRUSS LAB] 엔딩을 열지 못했습니다.',error);alert('엔딩을 불러오지 못했습니다. 페이지 연결을 확인한 뒤 다시 시도해 주세요.')}
    finally{endingOpening=false}
  }
  function reset(){resetting=true;storage.clear();location.reload()}
  function askAI(){
    if(state.current===0)return;
    engine.openAI();
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
        snowfall:mission?.snowfall,bridgeStyle:mission?.bridgeStyle,environment:boothEnvironment(index,mission)
      };
    });
    screen.innerHTML=`<section class="dioramaGallery boothDiorama" aria-label="시연 단계 지도">
      <div class="dioramaViewport">
        <canvas aria-hidden="true"></canvas>
        <button class="dioramaArrow" data-step="-1" aria-label="이전 단계">‹</button>
        <button class="dioramaArrow" data-step="1" aria-label="다음 단계">›</button>
      </div>
      <header class="boothMapBrand"><span>TRUSS LAB</span><strong>교량 현장 지도</strong><small>${state.finished?'체험 완료 · ':''}${passed} / ${labels.length} 단계 완료</small></header>
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
    if(state.current>0&&!state.finished)utilities.append(button(state.current===lastStage?'체험 마무리':'다음 단계 둘러보기',()=>next(true)));
    if(state.finished&&state.statuses[lastStage]==='complete')utilities.append(button('엔딩 다시 보기',showEnding));
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
      introLeaving=false;intro.inert=false;introStart.disabled=false;intro.classList.remove('isLeaving');
      cursor=null;touchUntil=0;mouseX=0;mouseY=0;lastPointer=null;sizeIntro();
      $('#titleStartBtn span').textContent=state.started?'체험 이어하기':'체험 시작';
      if(state.finished)engine.showScreen('booth');
    }
    if(name==='game'){
      $('#boothStepLabel').textContent=`${state.current+1} / ${labels.length} · ${labels[state.current]}`;
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
      state.designs[state.current]=engine.captureBridge();
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
      const action=button(state.current===lastStage?'체험 마치기':'다음 단계 →',()=>next(false),true);
      action.id='boothResultNext';$('#resultCard .completionNextSteps').prepend(action);
      $('#resultTitle').textContent=`${state.current+1}단계 완료`;
    }
  }
  $('#boothOverview').onclick=()=>{remember();engine.stop();engine.showScreen('booth')};
  $('#boothAskAI').onclick=askAI;
  window.addEventListener('pagehide',()=>{if(!resetting)remember()});
  return {
    begin,route,screenChanged,result,askAI,
    tutorialFinished(skipped){state.statuses[0]=skipped?'skipped':'complete';if(!skipped)state.designs[0]=engine.captureBridge();next(false)},
    currentMission(){return state.current>0?missions[state.current-1]:null}
  };
}
