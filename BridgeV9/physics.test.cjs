const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync(__dirname+'/script.js','utf8');
const modeFunction=source.slice(source.indexOf('function globalBucklingMode('),source.indexOf('function solve(A,b){'));
function column(force,stiffness=100){
  const nodes=[{id:31,x:0,y:0},{id:94,x:0,y:100}],member={id:'column',a:31,b:94,user:true};
  const context=vm.createContext({members:[member],nodeById:id=>nodes.find(node=>node.id===id),dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y)});
  vm.runInContext(modeFunction,context);
  const K=Array.from({length:4},()=>new Float64Array(4));K[2][2]=stiffness;
  return context.globalBucklingMode(K,[2],new Map([[31,0],[94,1]]),new Map([['column',{force}]]));
}

test('compression below the tangent critical load remains stable',()=>{
  assert.equal(column(-9000),null);
});
test('a negative tangent mode reports the analytical load ratio and compressed member',()=>{
  const mode=column(-11000);
  assert.equal(mode.member.id,'column');
  assert.ok(Math.abs(mode.ratio-1.1)<1e-12);
});
test('an actual lateral restraint increases the buckling threshold',()=>{
  assert.equal(column(-11000,200),null);
  assert.ok(Math.abs(column(-22000,200).ratio-1.1)<1e-12);
});
test('tension stabilizes the member rather than causing compression buckling',()=>{
  assert.equal(column(11000),null);
});
test('the neutral mode lies at the analytical critical load',()=>{
  assert.ok(Math.abs(column(-10000).ratio-1)<1e-12);
});

const solveSource=source.slice(source.indexOf('function solve(A,b){'),source.indexOf('/* ===== REAL-TIME COLLAPSE PHYSICS'));
const solveContext=vm.createContext({});vm.runInContext(solveSource,solveContext);
test('a near-mechanism is rejected instead of generating enormous displacements',()=>{
  assert.equal(solveContext.solve([[1e10,1e10],[1e10,1e10+1e-6]],[0,1]),null);
});
test('different finite stiffness scales still solve a stable structure',()=>{
  const displacement=solveContext.solve([[1e10,0],[0,1e6]],[1e5,1e5]);
  assert.ok(Math.abs(displacement[0]-1e-5)<1e-12);
  assert.ok(Math.abs(displacement[1]-.1)<1e-12);
});

const collapseContext=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function roadJointAngle('),source.indexOf('function solveCollapseConstraints(')),collapseContext);

test('a straight road joint resists sag with both outer joints fixed',()=>{
  const left={x:0,y:0,invMass:0},right={x:200,y:0,invMass:0};
  const mid={x:100,y:4,invMass:1};
  const restAngle=collapseContext.roadJointAngle(left,{x:100,y:0},right);
  collapseContext.solveRoadJoint(left,mid,right,{restAngle,stiffness:.22});
  assert.ok(mid.y>0&&mid.y<4);
  assert.deepEqual([left.y,right.y],[0,0]);
});

test('a designed arch keeps its angle through the signed angle wrap',()=>{
  const left={x:0,y:80,invMass:0},right={x:200,y:80,invMass:0};
  const mid={x:100,y:30,invMass:1};
  const restAngle=collapseContext.roadJointAngle(left,mid,right);
  collapseContext.solveRoadJoint(left,mid,right,{restAngle,stiffness:.22});
  assert.deepEqual(mid,{x:100,y:30,invMass:1});
  assert.ok(Math.abs(collapseContext.roadJointRotation(left,mid,right,restAngle+2*Math.PI))<1e-12);
});

test('a position correction cannot inject launch velocity during collapse',()=>{
  const falling={x:0,y:1,px:0,py:0,mass:1,invMass:1};
  const physics={particles:new Map([['falling',falling]])};
  const energy=collapseContext.collapseKineticEnergy(physics);
  falling.y=30;
  collapseContext.limitCollapseEnergy(physics,energy);
  assert.equal(falling.y,1);
  assert.equal(falling.py,0);
  assert.equal(falling.y-falling.py,1);
  falling.stepX=falling.x;falling.stepY=falling.y;
  falling.y=-20;
  collapseContext.limitCollapseEnergy(physics,0);
  assert.equal(falling.y,1);
  assert.equal(falling.y-falling.py,0);
});


test('collapse starts from the visible deformation even when raw deflection exceeds the limit',()=>{
  const nodes=[{id:0,x:0,y:0,support:'pin'},{id:1,x:100,y:0},{id:2,x:200,y:0,support:'roller'}];
  const context=vm.createContext({
    nodes,members:[{id:'left',a:0,b:1,mat:'road',road:true},{id:'right',a:1,b:2,mat:'road',road:true}],
    leftSupportId:()=>0,rightSupportId:()=>2,nodeById:id=>nodes.find(n=>n.id===id),
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),memberLineWeight:()=>1,
    MAT:{road:{weight:1,compression:100}},
    DEV_PHYSICS_TUNING:{roadBendingNormal:.095,roadBendingHeavy:.22,gravity:980,airDrag:.99},
    compressionCapacity:()=>({capacity:100}),clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
    roadJointAngle:collapseContext.roadJointAngle,
    vehiclePoseAt:(progress,analysis,scale)=>({x:40,y:analysis.U[3]*scale-31,angle:0,rot:0}),
    devVehicleRenderScale:()=>1,devVehicleSpeed:()=>80,
    stage:{vehicle:'CAR',load:8000},simSpeed:1,W:1200
  });
  vm.runInContext(source.slice(source.indexOf('function createCollapsePhysics('),source.indexOf('function collapseParticle(')),context);
  const analysis={ok:true,index:new Map([[0,0],[1,1],[2,2]]),U:[0,0,0,50000,0,0],shapeScale:.001,maxDefl:50000};
  const physics=context.createCollapsePhysics('solver-instability',analysis,.2);
  const middle=physics.particles.get(1);
  assert.equal(middle.y,50);
  assert.equal(middle.py,middle.y);
  assert.equal(physics.vehicle.y,19);
  assert.equal(physics.constraints[0].rest,100);
  assert.equal(physics.constraints[1].rest,100);
});


test('collapse projection preserves downward inertia instead of pulling a sagging deck upward',()=>{
  const node={x:0,y:20,px:0,py:20,mass:1,invMass:1,stepX:0,stepY:50,stepDX:0,stepDY:.1};
  const physics={particles:new Map([[1,node]])};
  collapseContext.limitCollapseEnergy(physics,.01);
  assert.ok(Math.abs(node.y-50.1)<1e-12);
  assert.equal(node.py,50);
});


test('overlapping roads select a continuous upper ramp instead of the lower guide',()=>{
  const nodes=[{id:0,x:0,y:100},{id:1,x:200,y:100},{id:2,x:400,y:100},{id:3,x:200,y:50}];
  const members=[[0,1],[1,2],[0,3],[3,2]].map(([a,b],id)=>({id,a,b,road:true}));
  const context=vm.createContext({nodes,members,nodeById:id=>nodes.find(n=>n.id===id),leftSupportId:()=>0,rightSupportId:()=>2});
  vm.runInContext(source.slice(source.indexOf('function drivableRoadPath('),source.indexOf('function findRoadSegmentAtX(')),context);
  assert.deepEqual([...context.drivableRoadPath(new Set())],[2,3]);
  assert.deepEqual([...context.drivableRoadPath(new Set([3]))],[0,1]);
  assert.equal(context.drivableRoadPath(new Set([1,3])),null);
});
