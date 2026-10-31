'use strict';
function createWinterEnvironment({width:W,height:H}){
  const left=-360,span=W+720,layerHeight=H+160;
  let scene=null,builds=0;
  function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
  function shape(points){const path=new Path2D();path.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)path.lineTo(points[i][0],points[i][1]);path.closePath();return path}
  function surface(width,height,scale){const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);const context=canvas.getContext('2d');context.scale(scale,scale);return {canvas,context}}
  function polygon(context,points,color){context.fillStyle=color;context.fill(shape(points))}
  const pines=Array.from({length:3},(_,variant)=>{
    const rand=random(119+variant*61),parts=[];
    for(let tier=0;tier<3;tier++){
      const top=-122+tier*31,width=19+tier*8+rand()*5,base=top+45+rand()*10,lean=(rand()-.5)*9;
      parts.push({path:shape([[lean,top],[-width,base],[width*.9,base-2]]),color:['#e9e2f3','#e3dced','#ddd5e9'][tier]});
      parts.push({path:shape([[lean,top],[width*.9,base-2],[lean+3,base-6]]),color:['#b7accb','#afa4c3','#a89dbd'][tier]});
      parts.push({path:shape([[lean,top],[-width*.72,base-10],[lean-3,base-16]]),color:'#f4effa'});
    }
    return parts;
  });
  const rock=shape([[-1,-14],[-15,-7],[-19,4],[8,7],[18,-1],[10,-12]]);
  const rockShade=shape([[2,-12],[-1,5],[18,-1],[10,-12]]);
  const rockSnow=shape([[-1,-14],[-15,-7],[-9,-3],[0,-6],[9,-4],[10,-12]]);
  function pine(context,x,y,size,variant,shadow=true){
    context.save();context.translate(x,y);context.scale(size,size);
    if(shadow){context.fillStyle='#51486530';context.beginPath();context.ellipse(12,3,37,8,-.12,0,Math.PI*2);context.fill()}
    context.fillStyle='#635775';context.fillRect(-3,-55,6,55);
    for(const part of pines[variant]){context.fillStyle=part.color;context.fill(part.path)}
    context.restore();
  }
  function makeMountains(index,count,simple,optimized){
    const scale=optimized?0.5:0.85,layer=surface(span,layerHeight,scale),context=layer.context,rand=random(841+index*719);
    const bases=[210,285,370,450],amplitudes=[74,110,145,124];
    const colors=['#bcb2d1','#a89cbe','#9183ab','#7e7098'];
    const base=bases[index],amp=amplitudes[index],points=[];
    let x=left-40;
    while(x<left+span+180){points.push([x,base-amp*(.3+rand()*.9)]);x+=(simple?210:88)+rand()*(simple?190:128)}
    context.translate(-left,0);
    polygon(context,[[left,H+160],...points,[left+span+180,H+160]],colors[index]);
    if(!simple){
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1],foot=[a[0]+(b[0]-a[0])*(.25+rand()*.65),base+65+rand()*100];
        polygon(context,[a,b,foot],i%3===0?'#e7dff014':'#44335310');
        if(a[1]<b[1]-22&&a[1]<base-amp*.64){
          polygon(context,[a,[a[0]+(b[0]-a[0])*.25,a[1]+(b[1]-a[1])*.25],[a[0]+8,a[1]+26],[a[0]-17,a[1]+21]],index<2?'#e5ddef55':'#d1c6df55');
        }
      }
      if(index===count-1){
        const total=optimized?8:18;
        for(let i=0;i<total;i++){
          const tx=left+rand()*span;
          const segment=points.findIndex((point,j)=>j<points.length-1&&point[0]<=tx&&points[j+1][0]>tx);
          if(segment<0)continue;
          const a=points[segment],b=points[segment+1],groundY=a[1]+(b[1]-a[1])*(tx-a[0])/(b[0]-a[0]);
          pine(context,tx,groundY+2,.12+rand()*.15,i%3,false);
        }
      }
    }
    if(!optimized){
      const fog=context.createLinearGradient(0,base-20,0,base+120);fog.addColorStop(0,'#d4c9e000');fog.addColorStop(.6,index<2?'#d8cee452':'#bfb2d32b');fog.addColorStop(1,'#c4b6d000');context.fillStyle=fog;context.fillRect(left,base-20,span,140);
    }
    if(index===count-1&&!simple){
      const valley=context.createLinearGradient(0,base-10,0,H+160);valley.addColorStop(0,'#c7bbd800');valley.addColorStop(.55,'#bbacd02b');valley.addColorStop(1,'#b8a8ccad');context.fillStyle=valley;context.fillRect(left,base-10,span,H+170-base);
    }
    return {canvas:layer.canvas,depth:[.055,.12,.23,.36][index]};
  }
  function makeTerrain(stage,simple,optimized){
    const rand=random(4097),terrain=[],trees=[],rocks=[],mounds=[],banks=[];
    for(const side of [0,1]){
      const lip=side?stage.deck.at(-1):stage.deck[0],direction=side?1:-1,outside=side?W+1500:-1500;
      const profile=[];
      const ground=x=>lip[1]+13-Math.min(25,Math.abs(x-lip[0])*.035)+Math.sin(x*.017+side*2)*3;
      const steps=10;
      for(let i=0;i<=steps;i++){const x=lip[0]+(outside-lip[0])*i/steps;profile.push([x,ground(x)])}
      const wall=[[lip[0]+direction*24,H+1600],[lip[0]+direction*14,lip[1]+350],[lip[0]-direction*6,lip[1]+200],[lip[0]+direction*13,lip[1]+95]];
      const bank=shape([...profile,[outside,H+1600],...wall]);banks.push(bank);
      terrain.push({path:bank,color:side?'#796b8f':'#847597'});
      const faces=simple?3:optimized?6:13;
      for(let i=0;i<faces;i++){
        const x=lip[0]+direction*(5+rand()*340),y=ground(x)+18+rand()*220,w=65+rand()*110,h=70+rand()*135;
        const points=[[x,y],[x+direction*w,y-35],[x+direction*w*.65,y+h],[x-direction*26,y+h*.5]];
        terrain.push({path:shape(points),color:i%3===0?'#c1afd545':i%3===1?'#48385250':'#65537640',clip:side,minX:Math.min(...points.map(point=>point[0])),maxX:Math.max(...points.map(point=>point[0])),minY:Math.min(...points.map(point=>point[1])),maxY:Math.max(...points.map(point=>point[1]))});
      }
      terrain.push({path:shape([...profile,...profile.slice().reverse().map(([x,y])=>[x,y+8+rand()*6])]),color:'#d9d0e8'});
      const treeCount=simple?2:optimized?4:7;
      for(let i=0;i<treeCount;i++){
        const distance=55+i*(simple?140:62)+rand()*22,x=lip[0]+direction*distance;
        trees.push({x,y:ground(x)+1,size:(.42+rand()*.55)*(i%3===0?1.14:1),variant:i%3});
      }
      if(!simple){
        for(let i=0;i<(optimized?2:5);i++){
          const x=lip[0]+direction*(38+rand()*425);
          rocks.push({x,y:ground(x)+3,size:.4+rand()*.55});
          mounds.push({x:x+direction*25,y:ground(x)+2,size:10+rand()*14});
        }
      }
    }
    return {terrain,trees,rocks,mounds,banks};
  }
  function rebuild(stage,preferences){
    if(scene){scene.sky.width=scene.sky.height=1;for(const layer of scene.layers)layer.canvas.width=layer.canvas.height=1}
    const simple=preferences.simple,optimized=preferences.optimized,count=simple?(optimized?1:2):(optimized?3:4);
    const sky=surface(W,H,1),context=sky.context;
    const gradient=context.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#d9d1ed');gradient.addColorStop(.48,'#c6bbdf');gradient.addColorStop(1,'#9f91b6');context.fillStyle=gradient;context.fillRect(0,0,W,H);
    if(!simple){
      if(!optimized){const light=context.createRadialGradient(894,78,15,894,78,195);light.addColorStop(0,'#faf5ff61');light.addColorStop(.45,'#f8eff522');light.addColorStop(1,'#f8eff500');context.fillStyle=light;context.fillRect(690,0,420,290)}
      context.fillStyle='#f5effb99';context.beginPath();context.arc(894,78,21,0,Math.PI*2);context.fill();
      context.fillStyle='#d7cde633';for(let i=0;i<3;i++){context.beginPath();context.arc(884+i*8,72+i%2*9,3+i,0,Math.PI*2);context.fill()}
    }
    const details=makeTerrain(stage,simple,optimized),rand=random(7803);
    const particles=Array.from({length:simple?0:optimized?12:44},()=>({x:rand()*W,y:rand()*H,speed:5+rand()*12,drift:3+rand()*9,radius:.65+rand()*1.25,phase:rand()*Math.PI*2}));
    scene={stage,firstX:stage.deck[0][0],firstY:stage.deck[0][1],lastX:stage.deck.at(-1)[0],lastY:stage.deck.at(-1)[1],simple,optimized,sky:sky.canvas,layers:Array.from({length:count},(_,i)=>makeMountains(i,count,simple,optimized)),...details,particles};
    scene.leftBank=scene.banks[0];scene.rightBank=scene.banks[1];
    builds++;
  }
  function draw(context,camera,stage,preferences,reducedMotion,pixelScaleX,pixelScaleY,now){
    if(!scene||scene.stage!==stage||scene.simple!==preferences.simple||scene.optimized!==preferences.optimized||scene.firstX!==stage.deck[0][0]||scene.firstY!==stage.deck[0][1]||scene.lastX!==stage.deck.at(-1)[0]||scene.lastY!==stage.deck.at(-1)[1])rebuild(stage,preferences);
    context.save();context.setTransform(pixelScaleX,0,0,pixelScaleY,0,0);context.drawImage(scene.sky,0,0,W,H);
    for(const layer of scene.layers){
      const depth=reducedMotion?0:layer.depth,zoom=1+(camera.zoom-1)*layer.depth;
      context.save();context.translate(W/2,H/2);context.scale(zoom,zoom);context.translate(-W/2-(camera.x-W/2)*depth,-H/2-(camera.y-H/2)*depth);
      context.drawImage(layer.canvas,left,0,span,layerHeight);context.restore();
    }
    if(!reducedMotion&&stage.weather!=='rain'&&stage.weather!=='storm'){
      const time=now*.001;
      context.fillStyle='#f7f1ff';context.beginPath();
      for(const particle of scene.particles){
        const x=((particle.x+time*particle.drift*(stage.wind<0?-1:1)+Math.sin(time*.18+particle.phase)*15)%W+W)%W,y=(particle.y+time*particle.speed)%H;
        context.moveTo(x+particle.radius,y);context.arc(x,y,particle.radius,0,Math.PI*2);
      }
      context.globalAlpha=preferences.optimized?0.34:0.49;context.fill();context.globalAlpha=1;
    }
    context.restore();
    const xMin=camera.x-W/(2*camera.zoom),xMax=camera.x+W/(2*camera.zoom),yMin=camera.y-H/(2*camera.zoom),yMax=camera.y+H/(2*camera.zoom);
    for(const part of scene.terrain){
      if(part.clip!==undefined&&(part.maxX<xMin||part.minX>xMax||part.maxY<yMin||part.minY>yMax))continue;
      context.save();if(part.clip!==undefined)context.clip(part.clip?scene.rightBank:scene.leftBank);context.fillStyle=part.color;context.fill(part.path);context.restore();
    }
    for(const mound of scene.mounds){if(mound.x+mound.size<xMin||mound.x-mound.size>xMax||mound.y-mound.size*.24>yMax||mound.y<yMin)continue;context.fillStyle='#e4dced';context.beginPath();context.ellipse(mound.x,mound.y,mound.size,mound.size*.24,0,Math.PI,Math.PI*2);context.fill()}
    for(const stone of scene.rocks){
      if(stone.x+20<xMin||stone.x-20>xMax||stone.y-14*stone.size>yMax||stone.y+7*stone.size<yMin)continue;
      context.save();context.translate(stone.x,stone.y);context.scale(stone.size,stone.size);context.fillStyle='#857695';context.fill(rock);context.fillStyle='#665778';context.fill(rockShade);context.fillStyle='#eee7f5';context.fill(rockSnow);context.restore();
    }
    for(let i=0;i<scene.trees.length;i++){
      const tree=scene.trees[i];
      if(tree.x+40*tree.size<xMin||tree.x-40*tree.size>xMax||tree.y-125*tree.size>yMax||tree.y<yMin)continue;
      if(camera.zoom<.85&&i%3===1)continue;
      pine(context,tree.x,tree.y,tree.size,tree.variant,!preferences.simple);
    }
  }
  return {draw,stats:()=>({builds,surfaces:scene?scene.layers.length+1:0,pixels:scene?scene.sky.width*scene.sky.height+scene.layers.reduce((sum,layer)=>sum+layer.canvas.width*layer.canvas.height,0):0,particles:scene?scene.particles.length:0})};
}
