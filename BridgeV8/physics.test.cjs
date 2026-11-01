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
