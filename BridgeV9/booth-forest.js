'use strict';

function createBoothForest({width,height}){
  let scene;
  const margin=320,span=width+margin*2;
  const rgb=values=>'rgb('+values.join(',')+')';
  const polygon=(ctx,points,color)=>{
    ctx.beginPath();
    points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };

  const crowns=[false,true].map(pine=>{
    const levels=pine?[[-104,11],[-82,19],[-57,26]]:[[-97,16],[-79,25],[-61,20]];
    return levels.reverse().flatMap(([top,wide])=>{
      const base=top+(pine?33:38);
      const ring=Array.from({length:6},(_,j)=>{
        const angle=j*Math.PI/3;
        const z=wide*Math.sin(angle);
        return [wide*Math.cos(angle),base+z*.26];
      });
      return [3,4,5,0,1,2].map(j=>{
        const path=new Path2D();
        path.moveTo(-wide*.21,top);path.lineTo(...ring[j]);path.lineTo(...ring[(j+1)%6]);path.closePath();
        return {path,shade:[1,0,0,2,2,1][j]};
      });
    });
  });

  // Shared faceted crowns. Depth gives the sun-facing and shaded sides separate silhouettes.
  function crown(ctx,x,y,size,pine,lean,colors){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    ctx.transform(1,0,-lean/104,1,0,0);
    polygon(ctx,[[-3,0],[4,0],[2,-84],[-2,-84]],'#655c43');
    for(const {path,shade} of crowns[Number(pine)]){ctx.fillStyle=colors[shade];ctx.fill(path)}
    ctx.restore();
  }

  function rebuild(stage,index,profile,preferences){
    const deep=index===1,quiet=preferences.simple,low=preferences.optimized;
    let seed=deep?32771:51473;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const landscape=document.createElement('canvas');
    landscape.width=width;landscape.height=height;
    const sky=landscape.getContext('2d');
    const gradient=sky.createLinearGradient(0,0,0,height*.64);
    gradient.addColorStop(0,rgb(profile.sky));gradient.addColorStop(1,rgb(profile.horizon));
    sky.fillStyle=gradient;sky.fillRect(0,0,width,height);
    const light=sky.createRadialGradient(width*.29,80,10,width*.29,80,deep?280:390);
    light.addColorStop(0,'#fff0bdc9');light.addColorStop(.32,'#f7df9c53');light.addColorStop(1,'#f7df9c00');
    sky.fillStyle=light;sky.fillRect(0,0,width,height);
    const layers=[];
    const ridgeColors=deep?['#8ca68d','#738e7b','#597563','#496852']:['#a1b499','#8fa789','#789777','#668769'];
    const greens=deep?['#627f51','#486b48','#304f40']:['#94a85e','#6d8c50','#476845'];
    const ridgeCount=quiet?2:low?3:4;
    for(let layer=0;layer<ridgeCount;layer++){
      const canvas=document.createElement('canvas'),scale=low?.55:.8;
      canvas.width=Math.ceil(span*scale);canvas.height=Math.ceil(height*scale);
      const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(margin,0);
      const ridge=[],base=220+layer*48;
      for(let x=-margin;x<=width+margin+175;x+=45+random()*115){
        const wave=Math.sin(x*(deep?.007:.004)+layer*2.1)*(deep?35:25);
        ridge.push([x,base+wave-random()*(deep?49:29)]);
      }
      polygon(ctx,[...ridge,[ridge.at(-1)[0],height],[-margin,height]],ridgeColors[layer]);
      for(let i=0;i<ridge.length-1;i++){
        const [x,y]=ridge[i],next=ridge[i+1],run=next[0]-x;
        if(random()<.76){
          const shoulder=[x+run*(.16+random()*.65),Math.max(y,next[1])+18+random()*42];
          const foot=[x+run*(random()*1.55-.27),shoulder[1]+20+random()*74];
          polygon(ctx,[[x,y],next,shoulder,foot],deep?'#21483b19':'#395a3816');
          if(run>70&&random()<.58){
            polygon(ctx,[[x,y],shoulder,foot,[x-run*.26,y+run*.47]],'#f6e0ac10');
          }
        }
        if(layer>0&&!quiet){
          const density=deep?3.8:2.9;
          const count=Math.round(run/75*density*(low?.55:1)*(random()<.22?.24:.6+random()*.65));
          const cluster=.25+random()*.5;
          ctx.globalAlpha=layer===ridgeCount-1?.48:.29;
          for(let j=0;j<count;j++){
            const t=cluster+(random()-.5)*.48;
            crown(ctx,x+t*run,y+(next[1]-y)*t+12+random()*34,
              (.11+random()*.26)*(deep?1.38:1),deep||j%3===0,random()*9-4,greens);
          }
          ctx.globalAlpha=1;
        }
      }
      const fog=ctx.createLinearGradient(0,base-70,0,base+145);
      fog.addColorStop(0,'#dce6c300');fog.addColorStop(1,deep?'#d2dfbb7d':'#e2e6b995');
      ctx.fillStyle=fog;
      ctx.globalCompositeOperation='source-atop';ctx.fillRect(-margin,base-70,span,height);ctx.globalCompositeOperation='source-over';
      layers.push({canvas,depth:.06+layer*.073});
    }

    const a=stage.deck[0],b=stage.deck.at(-1);
    const bank=document.createElement('canvas'),offset=850;
    bank.width=width+offset*2;bank.height=height+480;
    const ctx=bank.getContext('2d');ctx.translate(offset,0);
    const trees=[];
    const waterY=Math.min(a[1],b[1])+(deep?132:103);
    for(const [lip,direction] of [[a,-1],[b,1]]){
      const [x,y]=lip;
      const run=[0,13+random()*15];
      while(run.at(-1)<1450){
        const distance=run.at(-1);
        run.push(distance+22+random()*74+distance*.16);
      }
      const ground=d=>y+10-Math.min(36,d*.074)+Math.sin(d*.022)*Math.min(7,d*.045);
      const rim=run.map(d=>[x+direction*d,ground(d)]);
      const wall=deep?[[x-direction*26,waterY+38],[x+direction*4,y+82],[x-direction*9,y+36]]:[[x-direction*58,waterY+45],[x-direction*27,y+72],[x+direction*3,y+28]];
      polygon(ctx,[...rim,[rim.at(-1)[0],height+480],[wall[0][0],height+480],...wall],deep?'#404f42':'#63704e');
      ctx.save();ctx.clip();
      const shelves=[rim];
      const depths=deep?[32,84,161,260]:[22,58,115,213];
      for(const depth of depths){
        shelves.push(rim.map(([u,v],i)=>{
          const space=Math.min(Math.abs(u-rim[Math.max(0,i-1)][0]),Math.abs(rim[Math.min(i+1,rim.length-1)][0]-u));
          const offset=(random()-.5)*Math.min(48,space*.69);
          return [u+offset+direction*depth*.14,v+depth+(random()-.5)*Math.min(34,depth*.52)];
        }));
      }
      const strata=deep?['#46584e','#556559','#4d6055','#63736a','#53635e']:['#606951','#71745a','#59664e','#7c7b60','#657157'];
      for(let row=0;row<shelves.length-1;row++){
        for(let i=0;i<rim.length-1;i++){
          const a=shelves[row][i],b=shelves[row][i+1],c=shelves[row+1][i+1],d=shelves[row+1][i];
          const color=strata[Math.floor(random()*strata.length)];
          polygon(ctx,[a,b,c,d],color);
          if(random()<.58){
            const facet=random()<.5?[a,b,d]:[a,c,d];
            polygon(ctx,facet,random()<.48?'#c7bf8d17':'#253c3429');
          }
        }
      }
      for(let i=0;i<rim.length-1;i++){
        const [u,v]=rim[i],[nextX,nextY]=rim[i+1];
        const edge=3+random()*6;
        polygon(ctx,[[u,v],[nextX,nextY],[nextX,nextY+edge],[u+(nextX-u)*.42,v+edge+random()*8],[u,v+edge]],deep?'#829c59':'#b2b86e');
      }
      ctx.restore();
      polygon(ctx,[[x,y+13],...wall,[x+direction*(deep?39:77),waterY+55],[x+direction*42,y+34]],deep?'#647061':'#8b8463');
      polygon(ctx,[wall[0],wall[1],[x+direction*42,y+34],[x+direction*28,waterY+48]],deep?'#4c5a51':'#73755b');
      let treeDistance=92+random()*24;
      for(let i=0;i<(quiet?2:low?4:deep?9:6);i++){
        const d=treeDistance,tx=x+direction*d,ty=ground(d)+1;
        treeDistance+=22+random()*(deep?59:105)+(i%3===2?32:0);
        const size=(.43+random()*.40)*(deep?1.52:1);
        ctx.fillStyle='#24382d45';ctx.beginPath();ctx.ellipse(tx+size*20,ty+2,size*37,size*6,-.08,0,Math.PI*2);ctx.fill();
        trees.push({x:tx,y:ty,size,pine:deep||i%3===0,phase:random()*6});
      }
      for(let i=0;i<(quiet?7:low?18:deep?40:30);i++){
        const d=15+random()*580,px=x+direction*d,py=ground(d)+random()*7,s=2+random()*8;
        if(i%4===0){
          polygon(ctx,[[px-s,py],[px-s*.6,py-s*.7],[px+s*.3,py-s],[px+s,py]],'#a0a486');
          polygon(ctx,[[px+s*.3,py-s],[px+s,py],[px-s,py]],'#777f67');
        }else{
          polygon(ctx,[[px-s,py],[px-s*.6,py-s],[px,py-3],[px+s*.4,py-s*1.2],[px+s,py]],greens[i%3]);
          if(!deep&&i%5===0){ctx.fillStyle='#f6dda1';ctx.fillRect(px+2,py-s,2,2)}
        }
      }
    }
    const water=ctx.createLinearGradient(0,waterY,0,height+170);
    water.addColorStop(0,deep?'#8fae95':'#b7cbaa');water.addColorStop(.23,deep?'#678e83':'#8db7a2');water.addColorStop(1,'#436d6d');
    const ripples=Array.from({length:quiet?12:low?25:49},()=>({x:random(),y:random(),length:7+random()*52,phase:random()*6}));
    scene={stage,index,quiet,low,landscape,layers,bank,offset,trees,greens,water,waterY,ripples,a,b};
  }

  return function drawForest(ctx,camera,stage,index,profile,preferences,reduced,scaleX,scaleY,now){
    if(!scene||scene.stage!==stage||scene.index!==index||scene.quiet!==preferences.simple||scene.low!==preferences.optimized)rebuild(stage,index,profile,preferences);
    ctx.save();ctx.setTransform(scaleX,0,0,scaleY,0,0);
    ctx.drawImage(scene.landscape,0,0);
    for(const layer of scene.layers){
      const zoom=1+(camera.zoom-1)*layer.depth;
      ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);
      ctx.translate(-width/2-(camera.x-width/2)*layer.depth,-height/2-(camera.y-height/2)*layer.depth);
      ctx.drawImage(layer.canvas,-margin,0,span,height);ctx.restore();
    }
    ctx.restore();
    const {waterY,a,b}=scene,x0=a[0]-110,x1=b[0]+110;
    ctx.save();ctx.beginPath();ctx.rect(x0,waterY,x1-x0,height+560-waterY);ctx.clip();
    ctx.fillStyle=scene.water;ctx.fillRect(x0,waterY,x1-x0,height+560-waterY);
    const time=reduced?0:now/1000;
    for(const ripple of scene.ripples){
      const x=x0+((ripple.x+time*.011)%1)*(x1-x0),y=waterY+5+ripple.y**1.7*(height-waterY+75);
      ctx.fillStyle=ripple.phase>3?'#e1eed044':'#2b626c25';
      ctx.beginPath();ctx.ellipse(x,y,ripple.length*(.4+ripple.y*.8),.6+ripple.y,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    ctx.drawImage(scene.bank,-scene.offset,0);
    const half=width/(2*camera.zoom);
    for(const tree of scene.trees){
      if(Math.abs(tree.x-camera.x)>half+50*tree.size)continue;
      crown(ctx,tree.x,tree.y,tree.size,tree.pine,Math.sin(time*1.12+tree.phase)*2.8,scene.greens);
    }
  };
}
