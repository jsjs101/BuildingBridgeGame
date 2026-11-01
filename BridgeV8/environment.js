'use strict';
function createWinterEnvironment({width:W,height:H}){
  const left=-360,span=W+720,layerHeight=H+160;
  let scene=null,builds=0;
  function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
  function shape(points){const path=new Path2D();path.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)path.lineTo(points[i][0],points[i][1]);path.closePath();return path}
  function surface(width,height,scale){const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);const context=canvas.getContext('2d');context.scale(scale,scale);return {canvas,context}}
  function polygon(context,points,color){context.fillStyle=color;context.fill(shape(points))}
  const pines=Array.from({length:5},(_,variant)=>{
    const rand=random(119+variant*61),parts=[],tiers=variant%2?4:3;
    for(let tier=0;tier<tiers;tier++){
      const top=-132+tier*(tiers===4?27:35),width=14+tier*8+rand()*5,base=top+48+rand()*4,lean=(rand()-.5)*9;
      parts.push({path:shape([[lean,top],[-width,base-3],[-width*.18,base-7],[width,base],[lean+5,top+13]]),color:['#667884','#61717e','#596b79','#516472'][tier]});
      parts.push({path:shape([[lean,top],[-width*.95,base-9],[-width*.27,base-12],[width*.88,base-7],[lean+6,top+15]]),color:['#f4eff9','#e9e3f1','#ddd6e8','#d2cadd'][tier]});
      parts.push({path:shape([[lean,top],[width*.88,base-7],[lean+4,base-12]]),color:['#c6bfd7','#b8afca','#afa5c2','#a397b7'][tier]});
      parts.push({path:shape([[lean,top],[-width*.75,base-15],[-width*.32,base-18],[lean-2,top+12]]),color:'#fff8ff80'});
    }
    return parts;
  });
  const rock=shape([[-1,-14],[-15,-7],[-19,4],[8,7],[18,-1],[10,-12]]);
  const rockShade=shape([[2,-12],[-1,5],[18,-1],[10,-12]]);
  const rockSnow=shape([[-1,-14],[-15,-7],[-9,-3],[0,-6],[9,-4],[10,-12]]);
  function pine(context,x,y,size,variant,shadow=true){
    context.save();context.translate(x,y);context.scale(size,size);
    if(shadow){context.fillStyle='#51486530';context.beginPath();context.ellipse(12,3,37,8,-.12,0,Math.PI*2);context.fill()}
    context.fillStyle='#625970';context.fillRect(-2.7,-58,5.4,58);context.fillStyle='#b0a1b9';context.fillRect(-2.5,-50,1.4,49);
    for(const part of pines[variant]){context.fillStyle=part.color;context.fill(part.path)}
    context.restore();
  }
  function makeMountains(index,count,simple,optimized){
    const scale=optimized?.5:.85,layer=surface(span,layerHeight,scale),context=layer.context,rand=random(841+index*719);
    const depthIndex=count===1?1:Math.round(index*3/(count-1));
    const base=[235,295,375,470][depthIndex],amplitude=[95,155,190,165][depthIndex];
    const colors=['#bfb4d2','#ac9dbe','#9382aa','#7b6a94'];
    const points=[],summits=[];let x=left-320;
    while(x<left+span+360){
      const width=(simple?430:270)+rand()*260,height=amplitude*(.62+rand()*.62),peak=x+width*(.32+rand()*.27);
      const valley=base+rand()*38;
      points.push([x,valley],[x+width*.18,base-height*(.24+rand()*.17)]);
      summits.push({index:points.length,x:peak,y:base-height,width,height});
      points.push([peak,base-height],[x+width*.78,base-height*(.30+rand()*.28)]);
      x+=width;
    }
    points.push([x,base+25]);context.translate(-left,0);
    const silhouette=shape([[left-400,H+160],...points,[x,H+160]]);
    context.fillStyle=colors[depthIndex];context.fill(silhouette);
    if(!simple){
      context.save();context.clip(silhouette);
      for(const peak of summits){
        const ridge=[peak.x+peak.width*(.06+rand()*.18),peak.y+peak.height*.75];
        const foot=[peak.x+peak.width*.32,base+170];
        polygon(context,[[peak.x,peak.y],ridge,foot,[peak.x+peak.width*.7,base+160]],depthIndex<2?'#63517620':'#3e34552e');
        polygon(context,[[peak.x,peak.y],[peak.x-peak.width*.17,peak.y+peak.height*.51],ridge],depthIndex<2?'#f0e7fa2b':'#eadff22b');
        polygon(context,[ridge,[peak.x-peak.width*.24,base+80],foot],depthIndex<2?'#8f7ca51a':'#b9a9cf22');
        const a=points[peak.index-1],b=points[peak.index+1],snowDepth=peak.height*(.24+rand()*.12);
        const t1=Math.min(.65,snowDepth/Math.max(1,a[1]-peak.y)),t2=Math.min(.7,snowDepth/Math.max(1,b[1]-peak.y));
        const snowLeft=[peak.x+(a[0]-peak.x)*t1,peak.y+(a[1]-peak.y)*t1],snowRight=[peak.x+(b[0]-peak.x)*t2,peak.y+(b[1]-peak.y)*t2];
        polygon(context,[[peak.x,peak.y],snowRight,[peak.x+peak.width*.035,peak.y+snowDepth*.65],[peak.x-peak.width*.025,peak.y+snowDepth*.85],snowLeft],depthIndex<2?'#eee7f5a1':'#ded5e7a1');
        polygon(context,[[peak.x,peak.y],snowRight,[peak.x+peak.width*.035,peak.y+snowDepth*.65]],'#afa3c45c');
      }
      if(index===count-1){
        context.globalAlpha=.40;
        for(let i=0;i<(optimized?20:50);i++){
          const tx=left+rand()*span,segment=points.findIndex((point,j)=>j<points.length-1&&point[0]<=tx&&points[j+1][0]>tx);
          if(segment<0)continue;
          const a=points[segment],b=points[segment+1],ground=a[1]+(b[1]-a[1])*(tx-a[0])/(b[0]-a[0]);
          pine(context,tx,ground+3,.07+rand()*.13,i%pines.length,false);
        }
        context.globalAlpha=1;
      }
      context.restore();
    }
    const fog=context.createLinearGradient(0,base-55,0,H+160);fog.addColorStop(0,'#dbd2e900');fog.addColorStop(.28,depthIndex<2?'#d8cde94d':'#c7badc24');fog.addColorStop(1,'#c7b9dcbc');context.fillStyle=fog;context.fillRect(left,base-55,span,H+215-base);
    return {canvas:layer.canvas,depth:[.04,.1,.21,.34][depthIndex]};
  }
  function makeTerrain(stage,simple,optimized){
    const rand=random(4097),rainRand=random(3301),terrain=[],trees=[],rocks=[],mounds=[],banks=[],splashes=[];
    function face(points,color,clip){
      terrain.push({path:shape(points),color,clip,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))});
    }
    for(const side of [0,1]){
      const lip=side?stage.deck.at(-1):stage.deck[0],direction=side?1:-1,outside=side?W+1500:-1500;
      const ground=x=>lip[1]+13-Math.min(25,Math.abs(x-lip[0])*.035)+Math.sin(x*.017+side*2)*3;
      const distances=[0,22,54,100,170,260,390,560,840,1200,1800,Math.abs(outside-lip[0])];
      const profile=distances.filter(d=>d<=Math.abs(outside-lip[0])).map(d=>{const x=lip[0]+direction*d;return [x,ground(x)]});
      if(!simple)for(let i=0;i<(optimized?3:7);i++){const x=lip[0]+direction*(24+rainRand()*240);splashes.push({x,y:ground(x),phase:rainRand()})}
      const wall=[[lip[0]+direction*24,H+1600],[lip[0]+direction*14,lip[1]+350],[lip[0]-direction*6,lip[1]+200],[lip[0]+direction*13,lip[1]+95]];
      const bank=shape([...profile,[outside,H+1600],...wall]);banks.push(bank);
      terrain.push({path:bank,color:side?'#75647e':'#81718e'});
      const depths=simple?[18,160,450,1600]:optimized?[18,105,255,520,1100,1700]:[18,75,160,280,440,680,1050,1700];
      const columns=simple?[0,200,750,2600]:optimized?[0,90,240,500,1050,2600]:[0,65,150,290,490,800,1350,2600];
      const mesh=depths.map((depth,row)=>columns.map((distance,column)=>[lip[0]+direction*(distance+(column?((rand()-.5)*36):0)),lip[1]+depth+(row?(rand()-.5)*38:0)]));
      const palette=side?['#81708e','#74627f','#6a5977','#8d7b97','#786784']:['#93819d','#84728f','#766382','#a08da9','#887794'];
      for(let row=0;row<mesh.length-1;row++)for(let column=0;column<columns.length-1;column++){
        const a=mesh[row][column],b=mesh[row][column+1],c=mesh[row+1][column+1],d=mesh[row+1][column];
        face([a,b,d],palette[(row*2+column)%palette.length],side);face([b,c,d],palette[(row+column+2)%palette.length],side);
      }
      if(!simple)for(let layer=0;layer<(optimized?2:4);layer++){
        const distance=100+layer*110,ribbon=[];
        for(let i=0;i<7;i++)ribbon.push([lip[0]+direction*i*120,lip[1]+distance+i*10+Math.sin(i+layer)*9]);
        face([...ribbon,...ribbon.slice().reverse().map(([x,y])=>[x,y+4+layer*1.4])],layer%2?'#c1afd02a':'#43374e39',side);
      }
      if(!simple){
        face([[lip[0],lip[1]+18],[lip[0]+direction*60,lip[1]+31],[lip[0]+direction*34,lip[1]+160],[lip[0]+direction*13,lip[1]+95]],side?'#9a88a23b':'#4a3c5a33',side);
        for(let i=0;i<(optimized?2:4);i++){const x=lip[0]+direction*(7+i*9),y=ground(x)+12;face([[x,y],[x+direction*4,y+2],[x+direction*2,y+20+rand()*26],[x-direction,y+14]],'#d8dfee66',side)}
      }
      const lower=profile.map(([x,y],i)=>[x,y+9+(i%3)*2+rand()*3]);
      terrain.push({path:shape([...profile,...lower.slice().reverse().map(([x,y])=>[x,y+6])]),color:'#41354f52'});
      terrain.push({path:shape([...profile,...lower.slice().reverse()]),color:'#c9bfd9'});
      terrain.push({path:shape([...profile,...profile.slice().reverse().map(([x,y],i)=>[x,y+4+(i%2)*2])]),color:'#f0eaf7'});
      face([[lip[0]-direction*7,ground(lip[0])-1],[lip[0]+direction*22,ground(lip[0]+direction*22)-1],[lip[0]+direction*13,ground(lip[0])+12],[lip[0]-direction*2,ground(lip[0])+9]],'#ece5f4',null);
      const treeCount=simple?2:optimized?4:8,clusters=[45,92,168,230,340,460,610,790];
      for(let i=0;i<treeCount;i++){
        const x=lip[0]+direction*(clusters[i]+rand()*38);
        trees.push({x,y:ground(x)+1,size:(.43+rand()*.66)*(i%3===0?1.12:1),variant:i%pines.length});
      }
      if(!simple)for(let i=0;i<(optimized?3:7);i++){
        const x=lip[0]+direction*(24+rand()*520);
        rocks.push({x,y:ground(x)+3,size:.3+rand()*.7});mounds.push({x:x+direction*22,y:ground(x)+2,size:10+rand()*18});
      }
    }
    return {terrain,trees,rocks,mounds,banks,splashes};
  }
  function rebuild(stage,preferences){
    if(scene){scene.sky.width=scene.sky.height=1;for(const layer of scene.layers)layer.canvas.width=layer.canvas.height=1}
    const simple=preferences.simple,optimized=preferences.optimized,count=simple?(optimized?1:2):(optimized?3:4);
    const weather=stage.weather||'clear',wet=weather==='rain'||weather==='storm',clouded=wet||weather==='overcast';
    const sky=surface(W,H,1),context=sky.context;
    const gradient=context.createLinearGradient(0,0,0,H);gradient.addColorStop(0,clouded?'#b8b1cb':'#d9d1ed');gradient.addColorStop(.48,clouded?'#a49ab9':'#c6bbdf');gradient.addColorStop(1,clouded?'#8c819f':'#9f91b6');context.fillStyle=gradient;context.fillRect(0,0,W,H);
    if(!simple){
      context.globalAlpha=clouded?.35:1;
      if(!optimized){const light=context.createRadialGradient(894,78,15,894,78,195);light.addColorStop(0,'#faf5ff61');light.addColorStop(.45,'#f8eff522');light.addColorStop(1,'#f8eff500');context.fillStyle=light;context.fillRect(690,0,420,290)}
      context.fillStyle='#f5effb99';context.beginPath();context.arc(894,78,21,0,Math.PI*2);context.fill();
      context.fillStyle='#d7cde633';for(let i=0;i<3;i++){context.beginPath();context.arc(884+i*8,72+i%2*9,3+i,0,Math.PI*2);context.fill()}
    }
    context.globalAlpha=1;
    const mist=context.createLinearGradient(0,0,0,H);mist.addColorStop(0,'#e2deed00');mist.addColorStop(.45,wet?'#d3d8eb0a':'#d3d8eb00');mist.addColorStop(1,wet?'#d3d8eb32':'#d3d8eb0c');
    const details=makeTerrain(stage,simple,optimized),rand=random(7803);
    const snowCount=stage.snowfall?(simple?(optimized?12:20):(optimized?24:88)):simple||wet?0:(optimized?12:36);
    const rainCount=!wet?0:simple?(optimized?16:28):optimized?40:weather==='storm'?180:stage.snowfall?108:136;
    const particles=Array.from({length:snowCount},()=>({x:rand()*W,y:rand()*H,speed:14+rand()*25,drift:5+rand()*18,radius:.8+rand()*1.9,phase:rand()*Math.PI*2}));
    const rain=Array.from({length:rainCount},()=>({x:rand()*W,y:rand()*H,speed:370+rand()*220,length:11+rand()*16,phase:rand()*Math.PI*2}));
    scene={stage,weather,snowfall:!!stage.snowfall,mist,rain,firstX:stage.deck[0][0],firstY:stage.deck[0][1],lastX:stage.deck.at(-1)[0],lastY:stage.deck.at(-1)[1],simple,optimized,sky:sky.canvas,layers:Array.from({length:count},(_,i)=>makeMountains(i,count,simple,optimized)),...details,particles};
    scene.leftBank=scene.banks[0];scene.rightBank=scene.banks[1];
    builds++;
  }
  function draw(context,camera,stage,preferences,reducedMotion,pixelScaleX,pixelScaleY,now){
    if(!scene||scene.stage!==stage||scene.weather!==(stage.weather||'clear')||scene.snowfall!==!!stage.snowfall||scene.simple!==preferences.simple||scene.optimized!==preferences.optimized||scene.firstX!==stage.deck[0][0]||scene.firstY!==stage.deck[0][1]||scene.lastX!==stage.deck.at(-1)[0]||scene.lastY!==stage.deck.at(-1)[1])rebuild(stage,preferences);
    context.save();context.setTransform(pixelScaleX,0,0,pixelScaleY,0,0);context.drawImage(scene.sky,0,0,W,H);
    for(const layer of scene.layers){
      const depth=reducedMotion?0:layer.depth,zoom=1+(camera.zoom-1)*layer.depth;
      context.save();context.translate(W/2,H/2);context.scale(zoom,zoom);context.translate(-W/2-(camera.x-W/2)*depth,-H/2-(camera.y-H/2)*depth);
      context.drawImage(layer.canvas,left,0,span,layerHeight);context.restore();
    }
    if(!preferences.simple){context.fillStyle=scene.mist;context.fillRect(0,0,W,H)}
    drawPrecipitation(context,stage,reducedMotion?0:now,false);
    context.restore();
    const xMin=camera.x-W/(2*camera.zoom),xMax=camera.x+W/(2*camera.zoom),yMin=camera.y-H/(2*camera.zoom),yMax=camera.y+H/(2*camera.zoom);
    for(const part of scene.terrain){
      if(part.clip!=null&&(part.maxX<xMin||part.minX>xMax||part.maxY<yMin||part.minY>yMax))continue;
      context.save();if(part.clip!=null)context.clip(part.clip?scene.rightBank:scene.leftBank);context.fillStyle=part.color;context.fill(part.path);context.restore();
    }
    for(const mound of scene.mounds){if(mound.x+mound.size<xMin||mound.x-mound.size>xMax||mound.y-mound.size*.24>yMax||mound.y<yMin)continue;context.fillStyle='#e4dced';context.beginPath();context.ellipse(mound.x,mound.y,mound.size,mound.size*.24,0,Math.PI,Math.PI*2);context.fill()}
    for(const stone of scene.rocks){
      if(stone.x+32*stone.size<xMin||stone.x-24*stone.size>xMax||stone.y-14*stone.size>yMax||stone.y+12*stone.size<yMin)continue;
      context.save();context.translate(stone.x,stone.y);context.scale(stone.size,stone.size);context.fillStyle='#57466333';context.beginPath();context.ellipse(7,6,24,5,0,0,Math.PI*2);context.fill();context.fillStyle='#8f7e9d';context.fill(rock);context.fillStyle='#665778';context.fill(rockShade);context.fillStyle='#eee7f5';context.fill(rockSnow);context.restore();
    }
    for(let i=0;i<scene.trees.length;i++){
      const tree=scene.trees[i];
      if(tree.x+48*tree.size<xMin||tree.x-48*tree.size>xMax||tree.y-132*tree.size>yMax||tree.y<yMin)continue;
      if(camera.zoom<.85&&i%3===1)continue;
      pine(context,tree.x,tree.y,tree.size,tree.variant,!preferences.simple);
    }
  }
  function drawPrecipitation(context,stage,now,foreground){
    const time=now*.001,wind=Math.max(-1,Math.min(1,(stage.wind||0)/14000)),gust=Math.sin(time*.32)*3;
    const snowSplit=Math.ceil(scene.particles.length*.65),rainSplit=Math.ceil(scene.rain.length*.65);
    context.save();
    context.fillStyle=foreground?'#fff9ff':'#ede9fa';context.globalAlpha=foreground?.72:.40;context.beginPath();
    for(let i=foreground?snowSplit:0;i<(foreground?scene.particles.length:snowSplit);i++){
      const flake=scene.particles[i],depth=foreground?1.25:.72,speed=stage.snowfall?1:.45;
      const drift=(flake.drift+wind*35+gust)*time+Math.sin(time*.7+flake.phase)*12;
      const x=((flake.x+drift*depth)%(W+48)+W+48)%(W+48)-24,y=(flake.y+time*flake.speed*depth*speed)%(H+32)-16,r=flake.radius*depth;
      context.moveTo(x+r,y);context.arc(x,y,r,0,Math.PI*2);
    }
    context.fill();
    context.strokeStyle=foreground?'#e3f0fb':'#cfdcea';context.globalAlpha=foreground?.48:.24;context.lineWidth=foreground?1.25:.8;context.lineCap='round';context.beginPath();
    for(let i=foreground?rainSplit:0;i<(foreground?scene.rain.length:rainSplit);i++){
      const drop=scene.rain[i],depth=foreground?1.1:.8,slant=-8+wind*19+gust;
      const x=((drop.x+time*slant*15*depth)%(W+80)+W+80)%(W+80)-40,y=(drop.y+time*drop.speed*depth)%(H+60)-30;
      context.moveTo(x,y);context.lineTo(x+slant*depth,y+drop.length*depth);
    }
    context.stroke();context.restore();
  }
  function drawWeather(context,camera,stage,preferences,reducedMotion,pixelScaleX,pixelScaleY,now){
    if(!scene)return;
    const weatherNow=reducedMotion?0:now;
    context.save();context.setTransform(pixelScaleX,0,0,pixelScaleY,0,0);
    drawPrecipitation(context,stage,weatherNow,true);
    if(scene.rain.length){
      const time=weatherNow*.001;context.strokeStyle='#e2edf7';context.lineWidth=1;
      for(const site of scene.splashes){
        const age=(time*1.4+site.phase)%1;if(age>.36)continue;
        const x=W/2+(site.x-camera.x)*camera.zoom,y=H/2+(site.y-camera.y)*camera.zoom;
        if(x<0||x>W||y<0||y>H)continue;
        const spread=(2+age*23)*camera.zoom;context.globalAlpha=(1-age/.36)*.5;
        context.beginPath();context.ellipse(x,y,spread,spread*.24,0,0,Math.PI*2);context.moveTo(x-spread*.6,y-2);context.lineTo(x-spread,y-5);context.moveTo(x+spread*.6,y-2);context.lineTo(x+spread,y-5);context.stroke();
      }
    }
    context.restore();
  }
  return {draw,drawWeather,stats:()=>({builds,surfaces:scene?scene.layers.length+1:0,pixels:scene?scene.sky.width*scene.sky.height+scene.layers.reduce((sum,layer)=>sum+layer.canvas.width*layer.canvas.height,0):0,particles:scene?scene.particles.length:0,rain:scene?scene.rain.length:0,splashes:scene?scene.splashes.length:0})};
}
