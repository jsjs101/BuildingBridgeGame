'use strict';

let boothCreditsRequest;
function loadBoothCredits(){
  if(!boothCreditsRequest)boothCreditsRequest=fetch('credits.json',{cache:'no-cache'}).then(response=>{
    if(!response.ok)throw new Error('credits.json: HTTP '+response.status);
    return response.json();
  }).then(credits=>{
    if(typeof credits.title!=='string'||typeof credits.subtitle!=='string'||typeof credits.message!=='string'||
      !Array.isArray(credits.sections)||credits.sections.some(section=>typeof section.title!=='string'||!Array.isArray(section.names)||section.names.some(name=>typeof name!=='string'))||
      !Array.isArray(credits.chapters)||credits.chapters.some(chapter=>typeof chapter.title!=='string'||typeof chapter.text!=='string')){
      throw new Error('credits.json의 title, subtitle, message, sections, chapters 형식을 확인하세요.');
    }
    return credits;
  }).catch(error=>{boothCreditsRequest=null;throw error});
  return boothCreditsRequest;
}

const ENDING_VALLEY_ROWS=[-410,-320,-245,-185,-135,-95,-75,-60,-45,-30,-15,0,15,30,45,60,75,105,145,195,260,345,450,590,770,1010,1300,1580];
const ENDING_BANK_EDGE=166;
const ENDING_REGION_SPACING=460;
const ENDING_LAKE_COLOR=[67,116,131];

function buildEndingBridge(entry,index){
  const faces=[],detail=[],silhouette=[],terrain=[],banks=[],add=(vertices,color)=>faces.push({vertices,color});
  const snow=entry.environment.snow,harbor=entry.environment.harbor;
  const grass=snow?[192,204,213]:harbor?[159,161,119]:[105,141,104];
  const rock=snow?[105,116,137]:[99,113,104];
  const water=harbor?[68,118,138]:[66,123,133];
  const offset=(index-2)*ENDING_REGION_SPACING;
  let seed=983+index*787;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const tint=(color,amount)=>color.map(c=>Math.max(0,Math.min(255,c+amount)));
  const design=entry.design;
  let route=[],joints=[];
  if(design){
    const deck=design.deck,first=deck[0],last=deck.at(-1),span=last[0]-first[0];
    const scale=216/span,origin=(first[0]+last[0])/2,baseline=Math.max(first[1],last[1]);
    joints=design.nodes.map(node=>({...node,x:(node.x-origin)*scale,y:62+(baseline-node.y)*scale}));
    const byId=new Map(joints.map(node=>[node.id,node]));
    const colors={wood:[176,136,94],steel:[159,180,183],cable:[215,192,122],road:[89,95,97],roadHeavy:[93,111,123]};
    // Road slabs span the width; structural members occupy both side planes.
    for(const member of design.members){
      const a=byId.get(member.a),b=byId.get(member.b);
      if(!a||!b)continue;
      const color=colors[member.mat],isRoad=member.mat==='road'||member.mat==='roadHeavy';
      if(isRoad){
        endingGirder(faces,[a.x,a.y,-8],[b.x,b.y,-8],2.5,16,color);
        const left=a.x<b.x?a:b,right=left===a?b:a;
        route.push({a:left,b:right});
        const length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(length/7));
        for(let n=0;n<steps;n++){
          const t=(n+.5)/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
          boxDiorama(detail,x-1,y+1.38,-.2,2,.08,.4,[220,211,172]);
          for(const z of [-8,7.7])boxDiorama(detail,x-.14,y+1.3,z,.28,3,.3,[165,187,182]);
        }
        for(const z of [-8,7.8])endingGirder(detail,[a.x,a.y+4.3,z],[b.x,b.y+4.3,z],.25,.3,[168,188,181]);
      }else{
        for(const z of [-8.7,8.3]){
          endingGirder(faces,[a.x,a.y,z],[b.x,b.y,z],member.mat==='cable'?.43:1.65,member.mat==='cable'?.43:1.3,color);
          if(member.mat!=='cable')endingGirder(detail,[a.x,a.y+.3,z+.02],[b.x,b.y+.3,z+.02],.22,.15,tint(color,30));
        }
      }
    }
    const used=new Set(design.members.flatMap(member=>[member.a,member.b]));
    for(const node of joints.filter(node=>used.has(node.id)))for(const z of [-9,9]){
      boxDiorama(detail,node.x-.8,node.y-.8,z,1.6,1.6,.6,[183,195,184]);
      boxDiorama(detail,node.x-.27,node.y-.27,z+.65,.54,.54,.2,[224,215,178]);
    }
    const highestDeck=Math.max(62,...route.flatMap(segment=>[segment.a.y,segment.b.y]));
    for(const node of joints.filter(node=>used.has(node.id)&&node.y>highestDeck+12))boxDiorama(detail,node.x-.35,node.y-.35,-8,.7,.7,16,[150,167,161]);
    route.sort((a,b)=>a.a.x-b.a.x);
  }
  const leftY=route[0]?.a.y||62,rightY=route.at(-1)?.b.y||62;
  for(const side of [-1,1]){
    const y=side<0?leftY:rightY;
    const edge=ENDING_VALLEY_ROWS.map(z=>{
      const remote=Math.min(1,Math.abs(z)/240),curve=Math.sin(z*.007+index*.9)*remote*23;
      const inner=side*(z===0?108:110+random()*6)+curve;
      const relief=Math.max(21,y-2+(z===0?0:(random()-.5)*4)-remote*(z>0?28:14));
      const h=Math.abs(z)<=15?Math.min(y-1,relief):relief;
      const outerRelief=h+(z===0?0:random()*6)+remote*Math.sin(z*.021+side)*7;
      const outerHeight=Math.abs(z)<=15?Math.min(y-1,outerRelief):outerRelief;
      const shoreStart=305+index*23+(side>0?34:0),sink=Math.max(0,Math.min(1,(z-shoreStart)/265));
      const top=h+(6-h)*sink,outerTop=outerHeight+(6-outerHeight)*sink;
      return {top:[inner,top,z],outer:[side*ENDING_BANK_EDGE,outerTop,z],mid:[inner-side*(3+random()*3),top*.53,z],foot:[inner-side*7,8.8,z]};
    });
    banks.push(edge);
    for(let n=0;n<edge.length-1;n++){
      const p=edge[n],q=edge[n+1],a=p.top,b=q.top,c=p.outer,d=q.outer;
      terrain.push([a,b,c],[b,d,c]);
      add([a,b,c],tint(grass,random()*12-6));add([b,d,c],tint(grass,random()*12-6));
      add([a,p.mid,b],tint(rock,random()*11));add([b,p.mid,q.mid],tint(rock,-8));
      add([p.mid,p.foot,q.mid],tint(rock,-14));add([q.mid,p.foot,q.foot],tint(rock,-19));
    }
    const roadStart=side<0?-ENDING_BANK_EDGE:108,roadEnd=roadStart+ENDING_BANK_EDGE-108;
    boxDiorama(faces,roadStart,y-2,-8,roadEnd-roadStart,3.25,16,[85,98,102]);
    for(let x=roadStart+2;x+4<roadEnd;x+=8)add([[x,y+1.3,-.22],[x+4,y+1.3,-.22],[x+4,y+1.3,.22],[x,y+1.3,.22]],[215,202,158]);
    for(const z of [-7.35,6.9])add([[roadStart,y+1.3,z],[roadEnd,y+1.3,z],[roadEnd,y+1.3,z+.45],[roadStart,y+1.3,z+.45]],[185,190,174]);
    boxDiorama(detail,side*109-3,y-9,-10,6,8,20,[132,146,143]);
    for(let i=0;i<15;i++){
      const x=side*(121+random()*36),z=(i%2?-1:1)*(20+random()*48),h=13+random()*20;
      if(Math.abs(x-side*140)<18&&(z>8||Math.abs(z+34)<18))continue;
      const shadow=Array.from({length:9},(_,k)=>[x+3+Math.cos(k/9*Math.PI*2)*h*.27,y+.12,z+2+Math.sin(k/9*Math.PI*2)*h*.16]);
      detail.push({vertices:shadow,color:tint(grass,-22)});
      coneDiorama(silhouette,x,y+h*.16,z,h*.85,h*.26,5,snow?[204,215,224]:[79,116,91]);
      boxDiorama(detail,x-.8,y-1,z-.8,1.6,h*.57,1.6,[108,96,81]);
      if(snow||i%3){
        for(let layer=0;layer<3;layer++)coneDiorama(detail,x,y+h*(.2+layer*.2),z,h*.55,h*(.23-layer*.045),7,snow?[218-layer*6,224-layer*5,228-layer*3]:[64+layer*9,99+layer*11,80+layer*8]);
      }else{
        for(const sign of [-1,1])endingGirder(detail,[x,y+h*.28,z],[x+sign*h*.17,y+h*.6,z+sign*2],.6,.6,[119,104,86]);
        sculptDiorama(detail,x,y+h*.36,z,h*.7,h*.3,[91,130,98],random()*6,true);
      }
      if(i%2===0)sculptDiorama(detail,x+3,y,z-4,2+random()*3,3+random()*2,tint(rock,12),random()*6,false);
      if(!snow&&i%3===0)for(let k=0;k<3;k++)coneDiorama(detail,x+k*1.3,y,z+3,2+random()*3,1.2,4,[121,151,99]);
    }
    for(let i=0;i<39;i++){
      const z=(i%3?-1:1)*(84+random()*335),x=side*(126+random()*26),h=11+random()*24;
      const ground=endingTerrainHeight(terrain,x,z,y);
      if(ground<11)continue;
      const variation=random();
      if(Math.abs(z)>245)coneDiorama(faces,x,ground,z,h,h*.25,5,snow?[192,207,212]:[72,101,84]);
      else endingGroveTree(detail,silhouette,x,ground,z,h,snow,variation);
      if(i%4===0)sculptDiorama(detail,x+5,ground,z+3,3+random()*4,5,tint(rock,8),random()*6,false);
    }
  }
  for(let row=0;row<banks[0].length-1;row++){
    const a=banks[0][row].foot,b=banks[1][row].foot,c=banks[1][row+1].foot,d=banks[0][row+1].foot;
    const lakeMix=Math.max(0,Math.min(1,(a[2]-260)/280));
    const riverColor=water.map((channel,j)=>channel+(ENDING_LAKE_COLOR[j]-channel)*lakeMix);
    for(let column=0;column<12;column++){
      const u=column/12,v=(column+1)/12;
      const shallows=(1-lakeMix)*14*Math.abs((u+v)-1)**3;
      faces.push({vertices:[[a[0]+(b[0]-a[0])*u,9,a[2]],[a[0]+(b[0]-a[0])*v,9,a[2]],[d[0]+(c[0]-d[0])*v,9,d[2]],[d[0]+(c[0]-d[0])*u,9,d[2]]],color:tint(riverColor,shallows+Math.sin(column+row*.7)*2),water:true});
    }
    if(Math.abs(a[2])<200)for(let k=0;k<4;k++){
      const x=-80+random()*145,z=a[2]+(d[2]-a[2])*random(),length=8+random()*21;
      add([[x,9.12,z],[x+length,9.12,z+.2],[x+length*.7,9.12,z+.6]],tint(water,19));
    }
  }
  buildEndingLandmarks(faces,index,leftY,rightY,snow,(x,z,y)=>endingTerrainHeight(terrain,x,z,y));
  const prepare=(list,lod)=>list.map(face=>{
    const vertices=face.vertices.map(([x,y,z])=>[x+offset,y,z]);
    return {vertices,color:face.color,lod,water:!!face.water};
  });
  return {offset,faces:[...prepare(faces,0),...prepare(detail,1),...prepare(silhouette,2)],route,entry,leftY,rightY,terrain,banks,grass};
}

function endingGroveTree(detail,silhouette,x,y,z,h,snow,variation){
  const green=[59+variation*27,88+variation*31,72+variation*24];
  const pale=[184+variation*26,201+variation*20,207+variation*17];
  boxDiorama(detail,x-.55,y,z-.55,1.1,h*.46,1.1,[103,91,75]);
  for(let tier=0;tier<3;tier++)coneDiorama(detail,x,y+h*(.19+tier*.18),z,h*.53,h*(.24-tier*.045),6,(snow?pale:green).map(c=>c+tier*6));
  coneDiorama(silhouette,x,y+h*.12,z,h*.95,h*.25,5,snow?pale:green);
}

function buildEndingLandscape(models){
  const patches=[];
  let seed=723157;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const mix=(a,b,t)=>a+(b-a)*t, tint=(color,shade)=>color.map(c=>Math.max(0,Math.min(255,c+shade)));
  const boundary=(model,side)=>model.banks[side].map(({outer:[x,y,z]})=>[x+model.offset,y,z]);
  for(let i=0;i<=models.length;i++){
    const left=models[i-1],right=models[i],outer=!(left&&right),reference=left||right;
    const leftBank=left?boundary(left,1):boundary(right,0).map(([x,y,z])=>[x-1040,y-9+Math.sin(z*.012)*9,z]);
    const rightBank=right?boundary(right,0):boundary(left,1).map(([x,y,z])=>[x+1040,y-9+Math.sin(z*.014)*9,z]);
    const start=leftBank[0][0],end=rightBank[0][0],width=end-start,columns=outer?17:5;
    const startY=left?left.rightY+1.25:right.leftY-8,endY=right?right.leftY+1.25:left.rightY-8;
    const curve=t=>outer?Math.sin(t*Math.PI)*24:Math.sin(t*Math.PI)*4;
    const roadY=t=>mix(startY,endY,t*t*(3-2*t));
    const ground=[],detail=[],silhouette=[],faces=[];
    const leftGrass=left?.grass||reference.grass,rightGrass=right?.grass||reference.grass;
    const grid=Array.from({length:columns+1},(_,column)=>{
      const t=column/columns;
      return ENDING_VALLEY_ROWS.map((z,row)=>{
        const height=mix(leftBank[row][1],rightBank[row][1],t);
        const rough=Math.sin(t*Math.PI)*Math.min(1,Math.abs(z)/35)*(Math.sin(z*.042+column*.8)*3+(outer?Math.sin(t*16+z*.009)*9:0));
        const grade=roadY(t)-2,shoulder=Math.min(1,Math.abs(z)/21);
        const inside=column>0&&column<columns;
        const relief=mix(grade,height+rough,shoulder);
        const y=inside?(Math.abs(z)<=15?Math.min(relief,roadY(t)-1):relief):height;
        const roadBend=inside?curve(t)*Math.max(0,1-Math.max(0,Math.abs(z)-15)/60):0;
        return [mix(start,end,t),y,z+roadBend];
      });
    });
    for(let col=0;col<columns;col++)for(let row=0;row<ENDING_VALLEY_ROWS.length-1;row++){
      const a=grid[col][row],b=grid[col+1][row],c=grid[col+1][row+1],d=grid[col][row+1];
      const grass=leftGrass.map((channel,j)=>mix(channel,rightGrass[j],(col+.5)/columns));
      ground.push([a,b,d],[b,c,d]);
      faces.push({vertices:[a,b,d],color:tint(grass,random()*12-6)},{vertices:[b,c,d],color:tint(grass,random()*12-6)});
    }
    const roadSegments=Math.ceil(width/8);
    for(let n=0;n<roadSegments;n++){
      const a=n/roadSegments,b=(n+1)/roadSegments;
      const at=(t,side,raise=0)=>[mix(start,end,t),roadY(t)+raise,curve(t)+side];
      const strip=(low,high,raise,color)=>faces.push({vertices:[at(a,low,raise),at(b,low,raise),at(b,high,raise),at(a,high,raise)],color});
      strip(-8,8,0,[95,108,111]);
      strip(-7.35,-6.9,.05,[185,190,174]);strip(6.9,7.35,.05,[185,190,174]);
      if(n%2===0)strip(-.22,.22,.06,[215,202,158]);
      if(n%4===1)for(const side of [-1,1]){
        const [x,y,z]=at(a,side*9.5);
        boxDiorama(detail,x-.18,y-.6,z-.17,.36,2.5,.34,[159,172,164]);
        boxDiorama(detail,x-.21,y+1.36,z-.2,.42,.4,.4,[231,208,161]);
      }
    }
    const treeCount=outer?115:56;
    for(let n=0;n<treeCount;n++){
      const x=mix(start+4,end-4,random()),z=(n%3? -1:1)*(27+random()*405);
      const h=11+random()*25,snow=reference.entry.environment.snow;
      const y=endingTerrainHeight(ground,x,z,roadY((x-start)/width)-3);
      if(y<11)continue;
      const variation=random();
      if(Math.abs(z)>235)coneDiorama(faces,x,y,z,h,h*.25,5,snow?[192,207,212]:[72,101,84]);
      else endingGroveTree(detail,silhouette,x,y,z,h,snow,variation);
      if(n%5===0)sculptDiorama(detail,x+3,y,z+4,2+random()*5,4+random()*3,[116,130,122],random()*6,false);
    }
    patches.push({start,end,faces,detail,silhouette});
  }
  const lake=[];
  const lakeRows=ENDING_VALLEY_ROWS.filter(z=>z>=260);
  const west=patches[0].start,east=patches.at(-1).end;
  for(let n=0;n<lakeRows.length-1;n++)for(let column=0;column<36;column++){
    const x=mix(west,east,column/36),next=mix(west,east,(column+1)/36),z=lakeRows[n],far=lakeRows[n+1];
    lake.push({vertices:[[x,8.98,z],[next,8.98,z],[next,8.98,far],[x,8.98,far]],color:tint(ENDING_LAKE_COLOR,Math.sin(column*.8+n)*2)});
  }
  const mountains=[];
  const ridgeColors=[[89,118,122],[101,129,128],[125,149,144]];
  for(let layer=2;layer>=0;layer--){
    const z=-485-layer*215,edge=Array.from({length:28},(_,n)=>{
      const x=-2700+n*200+(n%2?random()*74:0),height=34+layer*47+random()*95;
      return [x,height,z+(random()-.5)*95];
    });
    const shoulders=edge.map(([x,y,peakZ],n)=>[x+Math.sin(n*1.7)*35,y*(.32+random()*.3),peakZ+75+random()*30]);
    const feet=edge.map(([x],n)=>[x,8+random()*4,z+150+Math.sin(n*.8)*15]);
    for(let n=0;n<edge.length-1;n++){
      const a=edge[n],b=edge[n+1],c=shoulders[n],d=shoulders[n+1],e=feet[n],f=feet[n+1];
      mountains.push({vertices:[a,b,c],color:tint(ridgeColors[layer],random()*15-4)},
        {vertices:[b,d,c],color:tint(ridgeColors[layer],-10)},
        {vertices:[c,d,e],color:tint(ridgeColors[layer],8)},
        {vertices:[d,f,e],color:tint(ridgeColors[layer],2)});
    }
  }
  return {patches,mountains,lake};
}

function endingTerrainHeight(triangles,x,z,fallback){
  for(const [a,b,c] of triangles){
    const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator,w=1-u-v;
    if(u>=0&&v>=0&&w>=0)return u*a[1]+v*b[1]+w*c[1];
  }
  return fallback;
}

function buildEndingLandmarks(faces,index,leftY,rightY,snow,heightAt){
  const roof=[91,113,122],timber=[167,140,111],cream=[202,199,173];
  const house=(x,y,z,width=18)=>{
    y=heightAt(x,z,y);
    boxDiorama(faces,x-width/2,y,z-7,width,13,14,timber);
    const ridge=y+21,eave=y+12.7;
    faces.push({vertices:[[x-width/2-1,eave,z-8],[x,ridge,z-8],[x,ridge,z+8],[x-width/2-1,eave,z+8]],color:snow?[225,231,227]:roof},
      {vertices:[[x,ridge,z-8],[x+width/2+1,eave,z-8],[x+width/2+1,eave,z+8],[x,ridge,z+8]],color:snow?[200,215,218]:[72,91,102]},
      {vertices:[[x-width/2,eave,z+7],[x,ridge,z+7],[x+width/2,eave,z+7]],color:cream});
    boxDiorama(faces,x-2,y,z+7.1,4,8,.5,[78,106,111]);
    for(const side of [-1,1]){
      boxDiorama(faces,x+side*width*.32-2.1,y+5,z+7.2,4.2,4.2,.4,[94,116,115]);
      boxDiorama(faces,x+side*width*.32-1.6,y+5.5,z+7.65,3.2,3.2,.1,[233,206,151]);
      boxDiorama(faces,x+side*width*.32-.15,y+5.4,z+7.8,.3,3.5,.1,timber);
    }
    boxDiorama(faces,x+width*.23,y+15,z-3,2.6,11,3,[123,132,126]);
    for(let row=0;row<4;row++)boxDiorama(faces,x-width/2-.1,y+row*3,z+7.1,width,.18,.15,[143,122,101]);
    boxDiorama(faces,x-4,y-.5,z+8,8,.7,4,[139,150,137]);
  };
  house(146,rightY,-33,index===1?24:18);
  if(index===0){
    const mailY=heightAt(-139,24,leftY);
    boxDiorama(faces,-139,mailY,24,1.3,7,1.3,[113,119,103]);
    boxDiorama(faces,-142,mailY+6,22,7,4.6,4,[166,99,82]);
    boxDiorama(faces,-141.5,mailY+8.7,26.1,6,.35,.2,[65,84,87]);
  }else if(index===1){
    for(const x of [-153,-133])boxDiorama(faces,x,leftY,20,.8,13,.8,[129,153,149]);
    boxDiorama(faces,-155,leftY+13,16,25,1.2,12,[99,128,132]);
    boxDiorama(faces,-152,leftY+3,22,17,1,3,[176,154,121]);
    boxDiorama(faces,-151,leftY,23,.7,3,1,[116,129,121]);
    boxDiorama(faces,-137,leftY,23,.7,3,1,[116,129,121]);
    boxDiorama(faces,-128,leftY,22,.65,16,.65,[175,190,177]);
    boxDiorama(faces,-131,leftY+12,22,6,4,.7,[122,162,165]);
  }else if(index===2){
    house(-146,leftY,-34,17);
    for(const x of [-154,-150,-146])boxDiorama(faces,x,leftY,24,3,2.2,5,timber);
  }else if(index===3){
    boxDiorama(faces,112,10,31,43,2,14,[155,135,107]);
    for(const x of [116,132,150])boxDiorama(faces,x,8,32,1.5,12,1.5,[115,130,123]);
    const cx=145,cz=48,lightY=heightAt(cx,cz,rightY);
    for(let ring=0;ring<4;ring++)endingCylinder(faces,cx,lightY+ring*4.8,cz,5-ring*.6,4.8,ring%2?[172,119,96]:cream,10,'y');
    endingCylinder(faces,cx,lightY+19.2,cz,3.3,4.2,[133,168,173],10,'y');
    coneDiorama(faces,cx,lightY+23.4,cz,4,4.2,10,roof);
  }
  for(const x of [-120,120]){
    const y=heightAt(x,14,x<0?leftY:rightY);
    boxDiorama(faces,x,y,14,.6,11,.6,[114,140,137]);
    boxDiorama(faces,x-1.4,y+10,13,3,2,2.8,[210,192,146]);
    boxDiorama(faces,x-.9,y+10.4,15.9,2,1,.1,[246,219,164]);
  }
}

function endingCylinder(faces,x,y,z,r,depth,color,sides=12,axis='z'){
  const point=(angle,end)=>axis==='y'?[x+Math.cos(angle)*r,y+end,z+Math.sin(angle)*r]:[x+Math.cos(angle)*r,y+Math.sin(angle)*r,z+end];
  const front=[],back=[];
  for(let i=0;i<sides;i++){
    const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
    front.push(point(a,0));back.push(point(a,depth));
    faces.push({vertices:[point(a,0),point(b,0),point(b,depth),point(a,depth)],color:color.map(c=>Math.max(0,c+Math.cos(a-1)*10))});
  }
  faces.push({vertices:front,color},{vertices:back,color:color.map(c=>Math.min(255,c+8))});
}

function buildEndingTraveller(child=false){
  const body=[],arm=[],scale=child?.73:1;
  for(const x of [-.65,.65]){
    boxDiorama(body,x-.32,0,-.4,.64,2.9,.8,[67,88,103]);
    boxDiorama(body,x-.37,0,-.35,.74,.5,1.25,[64,75,78]);
  }
  sculptDiorama(body,0,2.5,0,3.1,1.25,child?[180,138,102]:[116,154,155],.4,false);
  sculptDiorama(body,0,5.4,0,1.85,.85,[218,182,145],.2,false);
  sculptDiorama(body,0,6.4,-.07,.9,.91,child?[123,108,88]:[199,180,131],.2,false);
  for(const x of [-.31,.31])boxDiorama(body,x-.075,6.13,.77,.15,.17,.12,[63,76,77]);
  boxDiorama(body,-.12,5.92,.82,.24,.24,.22,[209,169,132]);
  boxDiorama(body,-.8,5.1,.5,1.6,.35,.35,child?[194,164,111]:[158,184,174]);
  endingGirder(body,[-1,4.9,-.1],[-1.25,2.8,-.1],.55,.65,[113,146,148]);
  endingGirder(arm,[0,0,0],[.9,1.3,0],.55,.6,[115,151,152]);
  sculptDiorama(arm,.95,1.3,.25,.65,.32,[219,183,149],.3,false);
  return {body:body.map(face=>({...face,vertices:face.vertices.map(p=>p.map(c=>c*scale))})),arm,scale};
}

function buildEndingVehicle(bus=false){
  const body=[],wheels=[],length=bus?18:13;
  const outline=[[-length/2,2],[-length/2+.5,4.7],[-length/2+2,5.8],[length/2-2,5.8],[length/2-.3,4.6],[length/2,2]];
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    body.push({vertices:[[a[0],a[1],-3.3],[b[0],b[1],-3.3],[b[0],b[1],3.3],[a[0],a[1],3.3]],color:[179+i*3,179+i*2,153+i*2]});
  }
  for(const z of [-3.3,3.3])body.push({vertices:outline.map(([x,y])=>[x,y,z]),color:[181,183,157]});
  boxDiorama(body,bus?-7:-3,5,-2.85,bus?14:6,2.8,5.7,[122,164,171]);
  for(const z of [-3,2.9])for(let x=bus?-6:-2;x<(bus?7:3);x+=2.6)boxDiorama(body,x,5.2,z,.2,2.4,.2,[194,198,174]);
  for(const z of [-2.6,1.8])boxDiorama(body,length/2-.1,3.2,z,.25,1,.8,[247,226,167]);
  boxDiorama(body,-length/2-.25,2,-3.4,.5,.8,6.8,[128,148,148]);
  boxDiorama(body,length/2-.1,2,-3.4,.4,.8,6.8,[148,162,158]);
  if(!bus)for(const z of [-3.4,3.4]){
    boxDiorama(body,-4.3,3,z,3,1.6,.12,[219,212,182]);
    endingGirder(body,[-4.2,4.5,z+.14],[-2.8,3.7,z+.14],.1,.1,[135,150,141]);
    endingGirder(body,[-2.8,3.7,z+.14],[-1.4,4.5,z+.14],.1,.1,[135,150,141]);
  }
  for(const x of [-length*.31,length*.31])for(const z of [-3.65,2.85]){
    const tire=[];endingCylinder(tire,0,0,0,1.55,.85,[48,62,68],14);
    endingCylinder(tire,0,0,z<0?-.06:.85,.87,.1,[171,181,172],10);
    endingCylinder(tire,0,0,z<0?-.12:.95,.28,.1,[100,124,129],8);
    wheels.push({faces:tire,x,y:1.6,z});
  }
  return {body,wheels};
}

function buildEndingFerry(){
  const faces=[],outline=[[-7,-15],[7,-15],[8,9],[0,18],[-8,9]];
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    faces.push({vertices:[[a[0],0,a[1]],[b[0],0,b[1]],[b[0]*.82,-4,b[1]*.88],[a[0]*.82,-4,a[1]*.88]],color:i%2?[115,150,157]:[182,196,184]});
  }
  faces.push({vertices:outline.map(([x,z])=>[x,.2,z]),color:[196,186,154]});
  boxDiorama(faces,-4,0,-9,8,7,12,[220,222,205]);
  for(const x of [-4.1,4])for(let z=-7;z<2;z+=3)boxDiorama(faces,x,4,z,.2,2,2,[102,151,165]);
  boxDiorama(faces,-4,7,-9,8,.6,12,[113,144,151]);
  endingCylinder(faces,0,7,-4,1,7,[168,163,140],8,'y');
  for(const x of [-6.5,6.5])for(let z=-11;z<10;z+=4)boxDiorama(faces,x,.3,z,.25,2,.25,[187,202,191]);
  return faces;
}

function endingCameraKeys(models,chapterSeconds,panoramaSeconds){
  const keys=[];
  const shots=[
    [[-137,99,121],[-139,65,24],[15,115,180],[30,70,0]],
    [[-122,91,118],[-135,66,22],[46,97,139],[66,66,0]],
    [[-55,151,140],[-28,91,0],[89,115,114],[126,72,12]],
    [[-33,53,130],[5,27,29],[104,134,144],[95,86,0]],
    [[-28,69,116],[0,42,0],[117,97,115],[140,67,24]]
  ];
  models.forEach((model,index)=>{
    const shot=shots[index%shots.length],time=index*chapterSeconds;
    const point=p=>[p[0]+model.offset,p[1],p[2]];
    keys.push({time,position:point([-170,135,230]),look:point([-190,59,0]),zoom:.94},
      {time:time+chapterSeconds*.29,position:point(shot[0]),look:point(shot[1]),zoom:1.04},
      {time:time+chapterSeconds*.7,position:point(shot[2]),look:point(shot[3]),zoom:.98});
  });
  const last=models.at(-1).offset,end=models.length*chapterSeconds;
  keys.push({time:end,position:[last+117,97,115],look:[last+140,67,14],zoom:1.02},
    {time:end+panoramaSeconds*.58,position:[70,420,1120],look:[40,43,0],zoom:.89},
    {time:end+panoramaSeconds,position:[0,615,1830],look:[0,42,0],zoom:1});
  return keys;
}

function sampleEndingCamera(keys,time){
  let index=0;while(index<keys.length-2&&time>keys[index+1].time)index++;
  const a=keys[index],b=keys[index+1],before=keys[Math.max(0,index-1)],after=keys[Math.min(keys.length-1,index+2)];
  const duration=b.time-a.time,t=Math.max(0,Math.min(1,(time-a.time)/duration));
  const interpolate=field=>a[field].map((value,axis)=>{
    // Time-scaled Hermite tangents keep velocity continuous between unequal shots.
    const m0=(b[field][axis]-before[field][axis])/(b.time-before.time)*duration;
    const m1=(after[field][axis]-a[field][axis])/(after.time-a.time)*duration;
    return (2*t*t*t-3*t*t+1)*value+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*b[field][axis]+(t*t*t-t*t)*m1;
  });
  return {position:interpolate('position'),look:interpolate('look'),zoom:a.zoom+(b.zoom-a.zoom)*t};
}

function createEndingRenderer(canvas){
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance'});
  if(!gl)return null;
  const compile=(type,source)=>{
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const vertex=compile(gl.VERTEX_SHADER,`
    attribute vec3 position; attribute vec3 color;
    uniform vec3 camera,right,up,forward; uniform vec2 viewport,clipDepth; uniform float focal;
    varying vec3 tint; varying float distanceToCamera;
    void main(){
      vec3 delta=position-camera;
      float depth=dot(delta,forward);
      vec2 screen=vec2(dot(delta,right)*focal/viewport.x*2.0,dot(delta,up)*focal/viewport.y*2.0+0.06*depth);
      gl_Position=vec4(screen,clipDepth.x*depth-clipDepth.y,depth);
      tint=color;distanceToCamera=depth;
    }`);
  const fragment=compile(gl.FRAGMENT_SHADER,`
    precision mediump float;
    varying vec3 tint; varying float distanceToCamera;
    void main(){
      float mist=clamp((distanceToCamera-160.0)/2200.0,0.0,1.0)*0.65;
      gl_FragColor=vec4(mix(tint,vec3(62.0,88.0,103.0)/255.0,mist),1.0);
    }`);
  const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vertex);gl.deleteShader(fragment);gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  let vertices=new Float32Array(262144),length=0;
  gl.bufferData(gl.ARRAY_BUFFER,vertices.byteLength,gl.DYNAMIC_DRAW);
  for(const [name,offset] of [['position',0],['color',12]]){
    const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset);
  }
  const uniforms=Object.fromEntries(['camera','right','up','forward','viewport','focal','clipDepth'].map(name=>[name,gl.getUniformLocation(program,name)]));
  const near=8,far=6000;
  gl.uniform2f(uniforms.clipDepth,(far+near)/(far-near),2*far*near/(far-near));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
  return {
    begin(camera,right,up,forward,width,height,focal){
      length=0;gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      for(const [name,vector] of [['camera',camera],['right',right],['up',up],['forward',forward]])gl.uniform3fv(uniforms[name],vector);
      gl.uniform2f(uniforms.viewport,width,height);gl.uniform1f(uniforms.focal,focal);
    },
    face(points,color){
      const needed=(points.length-2)*18;
      if(length+needed>vertices.length){
        const grown=new Float32Array(Math.max(vertices.length*2,length+needed));grown.set(vertices);vertices=grown;
        gl.bufferData(gl.ARRAY_BUFFER,vertices.byteLength,gl.DYNAMIC_DRAW);
      }
      for(let i=1;i<points.length-1;i++)for(const point of [points[0],points[i],points[i+1]]){
        vertices[length++]=point[0];vertices[length++]=point[1];vertices[length++]=point[2];
        vertices[length++]=color[0]/255;vertices[length++]=color[1]/255;vertices[length++]=color[2]/255;
      }
    },
    paint(){gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices.subarray(0,length));gl.drawArrays(gl.TRIANGLES,0,length/6)},
    dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);const release=gl.getExtension('WEBGL_lose_context');if(release)release.loseContext()}
  };
}

function endingGirder(faces,a,b,thickness,depth,color){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  const nx=-(b[1]-a[1])/length*thickness/2,ny=(b[0]-a[0])/length*thickness/2;
  const ring=point=>[[point[0]+nx,point[1]+ny,point[2]],[point[0]-nx,point[1]-ny,point[2]],[point[0]-nx,point[1]-ny,point[2]+depth],[point[0]+nx,point[1]+ny,point[2]+depth]];
  const p=ring(a),q=ring(b);
  for(let i=0;i<4;i++)faces.push({vertices:[p[i],q[i],q[(i+1)%4],p[(i+1)%4]],color:color.map(c=>Math.max(0,c+[6,-17,-10,16][i]))});
  faces.push({vertices:p,color},{vertices:q,color});
}

function mountBoothEnding({bridges,credits,reducedMotion,close,music,musicStarted}){
  const startedAt=performance.now();
  const root=document.createElement('section');root.className='boothEnding';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','체험 엔딩 · 우리가 만든 길');
  root.innerHTML='<canvas aria-hidden="true"></canvas><div class="endingShade"></div><div class="endingCaption" aria-live="polite"><small></small><h1></h1><p></p></div><div class="endingProgress" aria-hidden="true"></div><section class="endingCredits"><small></small><h2></h2><div class="endingCreditWindow" tabindex="0" role="region" aria-label="제작 크레딧"><div class="endingCreditRoll"></div></div><p class="endingMessage"></p><button class="endingReturn" type="button">단계 지도로 돌아가기</button></section><header class="endingTop"><span>TRUSS LAB / 한 통의 소식이 닿기까지</span><div class="endingControls"><button type="button" data-camera aria-pressed="false">카메라 고정</button><button type="button" data-pause>일시 정지</button><button type="button" data-credits>크레딧 보기</button></div></header>';
  const siblings=[...document.body.children].filter(node=>node instanceof HTMLElement&&!node.inert);
  siblings.forEach(node=>node.inert=true);document.body.append(root);
  const canvas=root.querySelector('canvas'),renderer=createEndingRenderer(canvas);
  const atmosphere=document.createElement('canvas');atmosphere.setAttribute('aria-hidden','true');
  if(renderer){canvas.after(atmosphere);canvas.style.background='radial-gradient(ellipse at 77% 19%,#ead9ad66,transparent 53%),linear-gradient(#263f51,#7e9e9e 57%,#a4ada0)'}
  const ctx=(renderer?atmosphere:canvas).getContext('2d',{alpha:!!renderer});
  const caption=root.querySelector('.endingCaption'),captionNumber=caption.querySelector('small'),captionTitle=caption.querySelector('h1'),captionText=caption.querySelector('p');
  const creditsPanel=root.querySelector('.endingCredits'),creditWindow=root.querySelector('.endingCreditWindow'),creditRoll=root.querySelector('.endingCreditRoll');
  creditsPanel.querySelector('small').textContent=credits.subtitle;creditsPanel.querySelector('h2').textContent=credits.title;
  creditsPanel.querySelector('.endingMessage').textContent=credits.message;
  for(const section of credits.sections){
    const group=document.createElement('section'),title=document.createElement('h3');title.textContent=section.title;group.append(title);
    for(const name of section.names){const line=document.createElement('p');line.textContent=name;group.append(line)}
    creditRoll.append(group);
  }
  const progress=root.querySelector('.endingProgress');
  const bars=Array.from({length:bridges.length+1},()=>{const span=document.createElement('span'),bar=document.createElement('i');span.append(bar);progress.append(span);return bar});
  const pauseButton=root.querySelector('[data-pause]'),skipButton=root.querySelector('[data-credits]'),cameraButton=root.querySelector('[data-camera]');
  const events=new AbortController(),{signal}=events;
  const previousFocus=document.activeElement;
  const models=bridges.map(buildEndingBridge);
  const landscape=buildEndingLandscape(models);
  const chapterSeconds=Math.max(4,Math.min(12,Number(credits.chapterSeconds)||7));
  const panoramaSeconds=Math.max(5,Math.min(15,Number(credits.panoramaSeconds)||9));
  const panoramaAt=bridges.length*chapterSeconds,creditsAt=panoramaAt+panoramaSeconds;
  let width=1,height=1,elapsed=0,lastTime=startedAt,frame=0,paused=false,disposed=false,chapter=-1,creditManual=false,creditDistance=0,renderUntil=0,cameraMotion=true,zoom=1;
  const cameraKeys=endingCameraKeys(models,chapterSeconds,panoramaSeconds),opening=sampleEndingCamera(cameraKeys,0);
  const camera=reducedMotion?[models[0].offset+90,200,370]:[...opening.position],look=reducedMotion?[models[0].offset,55,0]:[...opening.look];
  const mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),clamp=t=>Math.max(0,Math.min(1,t));
  const normalize=v=>{const length=Math.hypot(...v);return v.map(c=>c/length)};
  const vehicles=[buildEndingVehicle(),buildEndingVehicle(true)],travellers=[buildEndingTraveller(),buildEndingTraveller(true)],ferry=buildEndingFerry(),parcel=[];
  boxDiorama(parcel,-1.4,0,-1.3,2.8,2,2.6,[193,154,105]);
  boxDiorama(parcel,-.2,0,-1.36,.4,2.08,2.72,[230,213,172]);
  function resize(){
    width=root.clientWidth;height=root.clientHeight;
    const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
    if(renderer){atmosphere.width=canvas.width;atmosphere.height=canvas.height;ctx.setTransform(ratio,0,0,ratio,0,0)}
    creditDistance=Math.max(0,creditRoll.offsetHeight-creditWindow.clientHeight);
    renderUntil=elapsed+.15;
  }
  const observer=new ResizeObserver(resize);observer.observe(root);resize();
  function enterCredits(){
    if(creditsPanel.classList.contains('isVisible'))return;
    creditsPanel.classList.add('isVisible');caption.classList.add('isHidden');skipButton.hidden=true;
    creditsPanel.querySelector('.endingReturn').focus({preventScroll:true});
  }
  function togglePause(){paused=!paused;pauseButton.textContent=paused?'계속 보기':'일시 정지';pauseButton.setAttribute('aria-pressed',String(paused))}
  pauseButton.addEventListener('click',togglePause,{signal});
  cameraButton.addEventListener('click',()=>{cameraMotion=!cameraMotion;cameraButton.textContent=cameraMotion?'카메라 고정':'카메라 연출 켜기';cameraButton.setAttribute('aria-pressed',String(!cameraMotion));renderUntil=elapsed+.15},{signal});
  skipButton.addEventListener('click',()=>{elapsed=creditsAt;enterCredits()},{signal});
  const returnButton=root.querySelector('.endingReturn');
  let closing=false,fadeTimer;
  if(music){
    const musicButton=document.createElement('button');
    musicButton.type='button';
    musicButton.textContent='음악 재생';
    musicButton.hidden=true;
    root.querySelector('.endingControls').prepend(musicButton);
    musicStarted.then(started=>{
      if(!started&&!closing&&!disposed)musicButton.hidden=false;
    });
    musicButton.addEventListener('click',async()=>{
      try{
        await music.play();
        musicButton.hidden=true;
        if(!closing&&!disposed)pauseButton.focus({preventScroll:true});
      }catch(error){
        console.warn('[TRUSS LAB] 엔딩 음악을 재생하지 못했습니다.',error);
      }
    },{signal});
  }
  function leaveEnding(){
    if(closing)return;
    closing=true;
    returnButton.disabled=true;
    if(!music||music.paused){close();return}
    const fadeStart=performance.now();
    const initialVolume=music.volume;
    const fadeDuration=1500;
    fadeTimer=setInterval(()=>{
      const remaining=Math.max(0,1-(performance.now()-fadeStart)/fadeDuration);
      music.volume=initialVolume*remaining*remaining;
      if(remaining===0){
        clearInterval(fadeTimer);
        music.pause();
        close();
      }
    },25);
  }
  returnButton.addEventListener('click',leaveEnding,{signal});
  creditWindow.addEventListener('wheel',event=>{creditManual=true;creditWindow.scrollTop+=event.deltaY;event.preventDefault()},{signal,passive:false});
  creditWindow.addEventListener('keydown',()=>creditManual=true,{signal});
  root.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();if(elapsed<creditsAt){elapsed=creditsAt;enterCredits()}else leaveEnding()}
    if(event.key===' '&&event.target===pauseButton){event.preventDefault();togglePause()}
    if(event.key==='Tab'){
      const focusable=[...root.querySelectorAll('button:not([hidden]),[tabindex="0"]')].filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  },{signal});
  root.addEventListener('keyup',event=>event.stopPropagation(),{signal});
  document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){cancelAnimationFrame(frame);frame=0}else if(!disposed)frame=requestAnimationFrame(draw)},{signal});
  pauseButton.focus({preventScroll:true});
  function draw(now){
    if(disposed)return;
    const dt=lastTime?Math.max(0,(now-lastTime)/1000):0;lastTime=now;
    if(!paused)elapsed+=dt;
    if(elapsed>=creditsAt+4&&elapsed>renderUntil){
      if(!creditManual&&!paused)creditWindow.scrollTop=creditDistance*smooth(clamp((elapsed-creditsAt-2)/Math.max(16,credits.sections.length*4)));
      frame=requestAnimationFrame(draw);return;
    }
    const current=Math.min(bridges.length,Math.floor(elapsed/chapterSeconds)),panorama=elapsed>=panoramaAt;
    const index=panorama?bridges.length-1:current,model=models[index];
    const phase=panorama?clamp((elapsed-panoramaAt)/panoramaSeconds):(elapsed%chapterSeconds)/chapterSeconds;
    if(chapter!==current&&elapsed<creditsAt){
      chapter=current;
      const text=panorama?{title:'길은 이어지고, 이야기는 계속됩니다.',text:'한 통의 소식과 평범한 하루가 건너간 길. 그 모든 연결의 시작에 당신이 있었습니다.'}:credits.chapters[index]||{title:bridges[index].title,text:'당신이 완성한 다리를 돌아봅니다.'};
      captionNumber.textContent=panorama?'함께 이어 온 길':String(index+1).padStart(2,'0')+' / '+bridges[index].title+(bridges[index].design?'':' · 저장된 설계 없음');
      captionTitle.textContent=text.title;captionText.textContent=text.text;
    }
    if(elapsed>=creditsAt)enterCredits();
    else caption.classList.toggle('isHidden',!panorama&&(phase<.09||phase>.89));
    const shot=sampleEndingCamera(cameraKeys,Math.min(elapsed,creditsAt)),t=smooth(clamp(phase));
    const target=reducedMotion&&!panorama?[model.offset+90-145*t,200-22*Math.sin(t*Math.PI),370]:shot.position;
    const targetLook=reducedMotion&&!panorama?[model.offset,55,0]:shot.look;
    const damping=1-Math.exp(-Math.min(dt,.1)*(reducedMotion?2:8));
    if(!paused&&cameraMotion){
      for(let axis=0;axis<3;axis++){camera[axis]=mix(camera[axis],target[axis],damping);look[axis]=mix(look[axis],targetLook[axis],damping)}
      zoom=mix(zoom,reducedMotion?1:shot.zoom,damping);
    }
    const forward=normalize(look.map((c,i)=>c-camera[i])),right=normalize([-forward[2],0,forward[0]]),up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
    const focal=Math.min(width*.83,height*1.32)*zoom,fog=[62,88,103],packets=[];
    if(renderer){renderer.begin(camera,right,up,forward,width,height,focal);ctx.clearRect(0,0,width,height)}
    function project(point){
      const x=point[0]-camera[0],y=point[1]-camera[1],z=point[2]-camera[2];
      const depth=x*forward[0]+y*forward[1]+z*forward[2];
      return [width*.5+(x*right[0]+y*right[1]+z*right[2])*focal/depth,height*.47-(x*up[0]+y*up[1]+z*up[2])*focal/depth,depth];
    }
    function submit(vertices,color,water=false){
      if(renderer){renderer.face(vertices,color);return}
      const points=vertices.map(project);
      if(points.some(p=>p[2]<8)||points.every(p=>p[0]<-40)||points.every(p=>p[0]>width+40)||points.every(p=>p[1]<-40)||points.every(p=>p[1]>height+40))return;
      packets.push({points,color,water,depth:points.reduce((sum,p)=>sum+p[2],0)/points.length});
    }
    function place(mesh,x,y,z,angle=0){
      const cos=Math.cos(angle),sin=Math.sin(angle);
      for(const face of mesh)submit(face.vertices.map(([vx,vy,vz])=>[x+vx*cos-vy*sin,y+vx*sin+vy*cos,z+vz]),face.color);
    }
    function person(template,x,y,z,phase,waving){
      place(template.body,x,y,z);
      const angle=waving?-.2+Math.sin(phase*9)*.3:-1.3;
      const cos=Math.cos(angle),sin=Math.sin(angle),scale=template.scale;
      for(const face of template.arm)submit(face.vertices.map(([vx,vy,vz])=>[x+scale*(1+vx*cos-vy*sin),y+scale*(4.9+vx*sin+vy*cos),z+vz*scale]),face.color);
    }
    if(!renderer){
      const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#263f51');sky.addColorStop(.57,'#7e9e9e');sky.addColorStop(1,'#a4ada0');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
      const sun=ctx.createRadialGradient(width*.77,height*.19,3,width*.77,height*.19,height*.37);sun.addColorStop(0,'#f8e6b767');sun.addColorStop(1,'#e6d1a100');ctx.fillStyle=sun;ctx.fillRect(0,0,width,height);
    }
    for(const face of landscape.mountains)submit(face.vertices,face.color);
    if(camera[2]>260)for(const face of landscape.lake)submit(face.vertices,face.color,true);
    for(const patch of landscape.patches){
      const distance=Math.max(patch.start-look[0],look[0]-patch.end,0);
      if(!panorama&&distance>740)continue;
      for(const face of patch.faces)submit(face.vertices,face.color);
      const scenery=camera[2]>620||distance>235?patch.silhouette:patch.detail;
      for(const face of scenery)submit(face.vertices,face.color);
    }
    for(const [islandIndex,island] of models.entries()){
      if(!panorama&&!reducedMotion&&Math.abs(island.offset-look[0])>740)continue;
      const distant=Math.abs(island.offset-look[0])>320||camera[2]>650;
      for(const face of island.faces){if(distant&&face.lod===1||!distant&&face.lod===2)continue;submit(face.vertices,face.color,face.water)}
      if(!distant)for(let ripple=0;ripple<16;ripple++){
        const x=-90+(ripple*37.7)%175,z=-65+((ripple*23.3+(reducedMotion?0:elapsed*1.6))%130);
        const light=12+Math.sin(elapsed*.8+ripple)*4;
        submit([[island.offset+x,9.16,z],[island.offset+x+8,9.16,z+.25],[island.offset+x+12,9.16,z+.5]],[84+light,141+light,149+light]);
      }
      const localPhase=clamp((elapsed-islandIndex*chapterSeconds)/chapterSeconds),storyTime=reducedMotion?localPhase:elapsed;
      if(!distant||panorama){
        person(travellers[0],island.offset-140,endingTerrainHeight(island.terrain,-140,24,island.leftY),24,storyTime,true);
        const walk=smooth(clamp((localPhase-.65)/.3));
        person(travellers[1],island.offset+140,endingTerrainHeight(island.terrain,140,24-10*walk,island.rightY),24-10*walk,storyTime,localPhase>.55);
        if(islandIndex===1)person(travellers[1],island.offset-146,endingTerrainHeight(island.terrain,-146,24,island.leftY),24,storyTime,true);
        if(islandIndex===3){
          const boatZ=58-116*smooth(localPhase);
          for(const face of ferry)submit(face.vertices.map(([x,y,z])=>[island.offset+x,10+y+Math.sin(storyTime*1.4)*.2,z+boatZ]),face.color);
          for(let wake=0;wake<6;wake++){
            const z=boatZ-19-wake*3.6;
            if(z>-73)submit([[island.offset-5-wake,9.12,z],[island.offset+5+wake,9.12,z],[island.offset+7+wake,9.12,z-.5],[island.offset-7-wake,9.12,z-.5]],[134-wake*5,177-wake*4,178-wake*3]);
          }
        }
      }
      if(!island.route.length)continue;
      const journey=smooth(clamp((localPhase-.06)/.76)),x=mix(-148,142,journey);
      const segment=island.route.find(segment=>x>=segment.a.x&&x<=segment.b.x);
      if(segment||x<=island.route[0].a.x||x>=island.route.at(-1).b.x){
        const slope=segment?(segment.b.y-segment.a.y)/(segment.b.x-segment.a.x):0,angle=Math.atan(slope);
        const y=(segment?segment.a.y+(x-segment.a.x)*slope:x<0?island.leftY:island.rightY)+1.6;
        const vehicle=vehicles[islandIndex===1?1:0];
        place(vehicle.body,island.offset+x,y,0,angle);
        const spin=(x+148)/1.55,cos=Math.cos(angle),sin=Math.sin(angle);
        for(const wheel of vehicle.wheels){
          const wheelX=island.offset+x+wheel.x*cos-wheel.y*sin,wheelY=y+wheel.x*sin+wheel.y*cos;
          place(wheel.faces,wheelX,wheelY,wheel.z,angle-spin);
        }
        if(islandIndex!==1){
          const handoff=smooth(clamp((localPhase-.79)/.2));
          place(parcel,mix(island.offset+x-4,island.offset+141,handoff),mix(y+5,endingTerrainHeight(island.terrain,140,14,island.rightY)+3,handoff)+Math.sin(handoff*Math.PI)*4,mix(0,14,handoff));
        }
      }
    }
    if(renderer)renderer.paint();
    packets.sort((a,b)=>b.depth-a.depth);
    for(const face of packets){
      const mist=clamp((face.depth-160)/2200)*.65;
      ctx.fillStyle='rgb('+face.color.map((c,i)=>Math.round(mix(c,fog[i],mist))).join(',')+')';
      ctx.beginPath();ctx.moveTo(face.points[0][0],face.points[0][1]);for(let i=1;i<face.points.length;i++)ctx.lineTo(face.points[i][0],face.points[i][1]);ctx.closePath();ctx.fill();
      if(face.water){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.6;ctx.stroke()}
    }
    if(!panorama&&!reducedMotion)drawBoothPrecipitation(ctx,point=>project([point[0]+model.offset,point[1],point[2]-75]),model.entry.environment,elapsed,{width:330,depth:150,count:65,height:180,opacity:.38});
    for(let i=0;i<bars.length;i++)bars[i].style.transform='scaleX('+clamp(i===bridges.length?(elapsed-panoramaAt)/panoramaSeconds:(elapsed-i*chapterSeconds)/chapterSeconds)+')';
    if(elapsed>=creditsAt&&!creditManual&&!paused){
      creditWindow.scrollTop=creditDistance*smooth(clamp((elapsed-creditsAt-2)/Math.max(16,credits.sections.length*4)));
    }
    frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return ()=>{disposed=true;clearInterval(fadeTimer);if(music)music.pause();cancelAnimationFrame(frame);events.abort();observer.disconnect();if(renderer)renderer.dispose();root.remove();siblings.forEach(node=>{if(node.isConnected)node.inert=false});if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});models.length=0};
}
