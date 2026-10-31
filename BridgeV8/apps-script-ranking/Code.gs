const RANKING_SEASON = 'v8-1';
const RANKING_SHEET = 'Rankings';
const RANKING_COLUMNS = ['board','player','nickname','cost','timeMs','peakRatio','design','updatedAt','attemptId'];
const RANKING_COSTS = {wood:2.7,steel:5,cable:3.7,road:2.2,roadHeavy:4.4};

function setupRanking() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Google Sheets의 확장 프로그램 > Apps Script에서 실행하세요.');
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  if (!properties.getProperty('PLAYER_SALT')) properties.setProperty('PLAYER_SALT', Utilities.getUuid());
  let sheet = spreadsheet.getSheetByName(RANKING_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(RANKING_SHEET);
  if (!sheet.getLastRow()) {
    sheet.appendRow(RANKING_COLUMNS);
    sheet.setFrozenRows(1);
  } else if (sheet.getRange(1,1,1,8).getValues()[0].join('|') === RANKING_COLUMNS.slice(0,8).join('|')) {
    sheet.getRange(1,9,1,1).setValues([['attemptId']]);
  }
}

function rankingSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('관리자가 setupRanking을 먼저 실행해야 합니다.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(RANKING_SHEET);
  if (!sheet || sheet.getRange(1,1,1,9).getValues()[0].join('|') !== RANKING_COLUMNS.join('|')) throw new Error('관리자가 새 Code.gs를 저장하고 setupRanking을 다시 실행해야 합니다. 기존 기록은 유지됩니다.');
  return sheet;
}

function rankingJson_(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function rankingBoardId_(input) {
  if (input.season !== RANKING_SEASON) throw new Error('랭킹 시즌이 다릅니다. 게임 설정을 확인하세요.');
  if (!/^set0[1-6]_(level0[1-6]|bonus0[12])$/.test(input.levelId)) throw new Error('지원하지 않는 계약입니다.');
  if (!['easy','hard'].includes(input.difficulty)) throw new Error('난이도를 확인하세요.');
  return [input.season,input.levelId,input.difficulty].join('/');
}

function rankingNumber_(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('기록의 숫자 범위를 확인하세요.');
  return value;
}

function rankingDesign_(design) {
  if (!design || !Array.isArray(design.nodes) || !Array.isArray(design.members) || design.nodes.length < 2 || design.nodes.length > 300 || !design.members.length || design.members.length > 500) throw new Error('설계는 연결점 2~300개, 부재 1~500개까지 등록할 수 있습니다.');
  const nodes = design.nodes.map(node => {
    if (!Array.isArray(node) || node.length !== 2) throw new Error('연결점 형식을 확인하세요.');
    return node.map(coordinate => rankingNumber_(coordinate,-10000,10000));
  });
  const seen = new Set();
  let cost = 0;
  const members = design.members.map(member => {
    if (!Array.isArray(member) || member.length !== 3) throw new Error('부재 형식을 확인하세요.');
    const [a,b,material] = member;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= nodes.length || b >= nodes.length || a === b || !Object.prototype.hasOwnProperty.call(RANKING_COSTS,material)) throw new Error('부재 연결과 재료를 확인하세요.');
    const key = Math.min(a,b)+'/'+Math.max(a,b);
    if (seen.has(key)) throw new Error('중복 부재는 등록할 수 없습니다.');
    seen.add(key);
    const length = Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);
    if (length < 1) throw new Error('부재 길이를 확인하세요.');
    cost += length * RANKING_COSTS[material];
    return [a,b,material];
  });
  const clean = {nodes,members}, serialized = JSON.stringify(clean);
  if (serialized.length > 40000) throw new Error('공개 설계 데이터가 너무 큽니다.');
  return {design:clean,serialized,cost:Math.round(cost/10)*10};
}

function rankingRows_(sheet) {
  const count=sheet.getLastRow()-1;
  if (!count) return [];
  // Read numeric metadata in bulk; load only the visible designs below.
  const rows=sheet.getRange(2,1,count,6).getValues(), dates=sheet.getRange(2,8,count,2).getValues();
  return rows.map((row,index)=>[...row,null,...dates[index]]);
}

function rankingSummary_(rows, boardId, candidateCost, player, sheet, attemptId) {
  const entries = rows.map((row,index) => ({board:row[0],row:index+2,player:row[1],nickname:row[2],cost:Number(row[3]),timeMs:Number(row[4]),peakRatio:Number(row[5]),design:row[6],updatedAt:row[7],attemptId:row[8]})).filter(entry=>entry.board===boardId);
  entries.sort((a,b)=>a.cost-b.cost || String(a.updatedAt).localeCompare(String(b.updatedAt)));
  const total=entries.length, minCost=total?entries[0].cost:0, maxCost=total?entries[total-1].cost:0, histogram=Array(16).fill(0);
  for (const entry of entries) histogram[Math.min(15,Math.floor((entry.cost-minCost)/Math.max(1,maxCost-minCost)*16))]++;
  const own = player ? entries.find(entry=>entry.player===player && entry.attemptId===attemptId) : null;
  let comparison = null;
  if (own || total) {
    const cost = own ? own.cost : candidateCost;
    const count = own ? total : total+1;
    const rank = 1+entries.filter(entry=>entry.cost<cost).length;
    comparison = {rank,total:count,percentile:Math.ceil(rank/count*1000)/10,cost};
  }
  const visible = entries.slice(0,8);
  if (own && !visible.includes(own)) visible.push(own);
  return {ok:true,total,minCost,maxCost,histogram,comparison,entries:visible.map(entry=>({rank:1+entries.filter(other=>other.cost<entry.cost).length,nickname:entry.nickname,cost:entry.cost,timeMs:entry.timeMs,peakRatio:entry.peakRatio,design:JSON.parse(entry.design||sheet.getRange(entry.row,7,1,1).getValues()[0][0]),mine:entry===own}))};
}

function doGet(e) {
  try {
    const input=e.parameter, boardId=rankingBoardId_(input);
    const cost=rankingNumber_(Number(input.cost),0,10000000);
    const sheet=rankingSheet_(), rows=rankingRows_(sheet);
    return rankingJson_(rankingSummary_(rows,boardId,cost,null,sheet));
  } catch(error) { console.error(error);return rankingJson_({ok:false,error:error.message}); }
}

function doPost(e) {
  const lock=LockService.getScriptLock();
  try {
    if (!e.postData || e.postData.contents.length > 100000) throw new Error('전송 데이터 크기를 확인하세요.');
    const input=JSON.parse(e.postData.contents), boardId=rankingBoardId_(input);
    if (input.action !== 'submit' || !/^[a-f0-9]{64}$/.test(input.token)) throw new Error('등록 데이터를 확인하세요.');
    if (!/^[a-f0-9]{64}$/.test(input.attemptId)) throw new Error('게임을 새로고침한 뒤 새 클리어 기록을 등록하세요.');
    if (typeof input.nickname !== 'string' || !input.nickname.trim() || input.nickname.length > 20 || /^[=+\-@]/.test(input.nickname.trim()) || /[\x00-\x1f<>]/.test(input.nickname)) throw new Error('닉네임은 특수 명령문을 제외한 1~20자로 입력하세요.');
    const design=rankingDesign_(input.design);
    if (input.cost !== design.cost) throw new Error('설계 비용이 일치하지 않습니다. 기본 재료 설정으로 다시 시험하세요.');
    rankingNumber_(input.timeMs,1,604800000);
    rankingNumber_(input.peakRatio,0,1000);
    const salt=PropertiesService.getScriptProperties().getProperty('PLAYER_SALT');
    if (!salt) throw new Error('관리자가 setupRanking을 먼저 실행해야 합니다.');
    const player=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,input.token+salt).map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
    if (!lock.tryLock(8000)) throw new Error('다른 기록을 저장 중입니다. 잠시 후 다시 시도하세요.');
    const sheet=rankingSheet_(), rows=rankingRows_(sheet);
    const existing=rows.find(row=>row[0]===boardId && row[1]===player && row[8]===input.attemptId);
    if (existing) return rankingJson_({...rankingSummary_(rows,boardId,design.cost,player,sheet,input.attemptId),registered:true,duplicate:true});
    const cache=CacheService.getScriptCache();
    if (cache.get(player)) throw new Error('기록 등록은 10초 간격으로 가능합니다.');
    if (rows.length>=5000) throw new Error('현재 시즌 저장 공간이 가득 찼습니다. 관리자에게 알려주세요.');
    const row=[boardId,player,input.nickname.trim(),design.cost,Math.round(input.timeMs),input.peakRatio,design.serialized,new Date().toISOString(),input.attemptId];
    sheet.appendRow(row);rows.push(row);
    SpreadsheetApp.flush();
    cache.put(player,'1',10);
    return rankingJson_({...rankingSummary_(rows,boardId,design.cost,player,sheet,input.attemptId),registered:true,duplicate:false});
  } catch(error) { console.error(error);return rankingJson_({ok:false,error:error.message}); }
  finally { if(lock.hasLock())lock.releaseLock(); }
}
