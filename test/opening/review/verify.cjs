const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

async function verify() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'truss-opening-'));
  const executable = process.env.CHROME_PATH || path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe');
  const browser = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--remote-debugging-pipe', '--user-data-dir=' + profile], {windowsHide:true, stdio:['ignore','ignore','pipe','pipe','pipe']});
  const pending = new Map();
  const errors = [];
  let sequence = 0;
  let session;
  let received = '';
  browser.stdio[4].on('data', chunk => {
    received += chunk.toString();
    let end;
    while ((end = received.indexOf('\0')) !== -1) {
      const message = JSON.parse(received.slice(0, end));
      received = received.slice(end + 1);
      if (message.id) {
        const operation = pending.get(message.id);
        if (!operation) continue;
        pending.delete(message.id);
        clearTimeout(operation.timer);
        message.error ? operation.reject(Error(message.error.message)) : operation.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      else if (message.method === 'Fetch.requestPaused') send('Fetch.failRequest', {requestId:message.params.requestId, errorReason:'Failed'}).catch(error => errors.push(error.message));
    }
  });
  browser.on('error', error => {for (const operation of pending.values()) operation.reject(error);});
  function send(method, params = {}, sessionId = session) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => reject(Error('Protocol timeout: ' + method)), 15000);
      pending.set(id, {resolve, reject, timer});
      browser.stdio[3].write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}) + '\0');
    });
  }
  try {
    const {targetId} = await send('Target.createTarget', {url:'about:blank'}, null);
    session = (await send('Target.attachToTarget', {targetId, flatten:true}, null)).sessionId;
    await send('Page.enable');
    await send('Runtime.enable');
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true, userGesture:true});
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function until(expression, attempts = 200) {
      for (let i = 0; i < attempts; i++) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw Error('Condition failed: ' + expression);
    }
    const base = process.env.OPENING_URL || 'http://127.0.0.1:8878';
    async function navigate(preview = true) {
      await send('Page.navigate', {url:base + '/opening/scene.html' + (preview ? '?preview=1' : '')});
      await until("document.body && document.body.dataset.state === 'ready'");
    }
    async function screenshot(name) {
      const result = await send('Page.captureScreenshot', {format:'png'});
      fs.writeFileSync(path.join(__dirname, name + '.png'), Buffer.from(result.data, 'base64'));
    }
    const seekTo = seconds => evaluate(`document.getElementById('seek').value=${seconds};document.getElementById('seek').dispatchEvent(new Event('input'))`);
    await send('Emulation.setDeviceMetricsOverride', {width:1600,height:900,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await navigate();
    await screenshot('01-start-desktop');
    await evaluate("document.getElementById('start').click()");
    await until("document.body.dataset.state === 'playing'");
    await evaluate("document.getElementById('pause').click()");
    assert.equal(await evaluate('document.body.dataset.state'), 'paused');
    await seekTo(13);
    assert.equal(await evaluate("document.getElementById('chapterName').textContent"), 'A SINGLE CONNECTION');
    assert.equal(await evaluate("document.getElementById('captionText').textContent"), '작은 연결이 모이고,');
    const still = await evaluate("document.getElementById('elapsed').textContent");
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(await evaluate("document.getElementById('elapsed').textContent"), still);
    await screenshot('02-joint-desktop');
    await seekTo(22);
    await screenshot('03-crossing-desktop');
    await evaluate("document.getElementById('sound').click()");
    assert.equal(await evaluate("document.getElementById('sound').getAttribute('aria-pressed')"), 'false');
    await seekTo(30);
    await screenshot('04-title-desktop');
    await seekTo(34.85);
    await evaluate("document.getElementById('pause').click()");
    await until("document.body.dataset.state === 'ended'");
    assert.equal(await evaluate("document.querySelector('.end-card').hidden"), false);
    await evaluate("document.getElementById('replay').click()");
    assert.equal(await evaluate('document.body.dataset.state'), 'playing');
    assert.equal(await evaluate("document.querySelector('.end-card').hidden"), true);
    await evaluate("document.getElementById('pause').click()");
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await navigate();
    await screenshot('05-start-mobile');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate("document.getElementById('start').click();document.getElementById('pause').click()");
    await seekTo(13);
    assert.match(await evaluate("document.getElementById('motionNote').textContent"), /동작 줄이기/);
    assert.equal(await evaluate("document.querySelector('.shot img').style.transform"), 'translate(0%, 0%) scale(1.05)');
    await send('Network.enable');
    await send('Network.setCacheDisabled', {cacheDisabled:true});
    await send('Fetch.enable', {patterns:[{urlPattern:'*joint.png', requestStage:'Request'}]});
    await send('Page.navigate', {url:base + '/opening/scene.html?preview=1'});
    await until("document.body && document.body.dataset.state === 'error'");
    assert.equal(await evaluate("document.getElementById('retry').hidden"), false);
    await send('Fetch.disable');
    await evaluate("document.getElementById('retry').click()");
    await until("document.body && document.body.dataset.state === 'ready'");
    await send('Emulation.setDeviceMetricsOverride', {width:1600,height:900,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await navigate(false);
    await evaluate("document.getElementById('sound').click();document.getElementById('start').click()");
    const playbackStart = Date.now();
    console.log('Running the complete 35-second opening...');
    await until("location.pathname === '/index.html'", 1000);
    assert.ok(Date.now() - playbackStart >= 34500, 'Full playback must not skip ahead');
    await navigate();
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until("location.pathname === '/index.html'");
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log('PASS: loading, playback, pause, seeking, captions, sound, preview/replay, mobile, reduced motion, missing-image recovery, full 35-second playback, index entry, Escape skip; no runtime exceptions.');
  } finally {
    browser.kill();
    for (const operation of pending.values()) clearTimeout(operation.timer);
  }
}
verify().catch(error => {console.error(error); process.exitCode = 1;});
