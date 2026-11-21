const fs = require('fs');
const CDP = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:8765/index.html';
const OUT = 'assets/screenshots';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  let target;
  for (let i = 0; i < 20 && !target; i++) {
    const list = await fetch(CDP + '/json/list').then(r => r.json());
    target = list.find(t => t.type === 'page' && t.url.startsWith('http://127.0.0.1:8765'));
    if (!target) await sleep(500);
  }
  if (!target) throw new Error('No local app tab in Edge CDP');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  ws.onmessage = async event => {
    const message = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };

  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    const timer = setTimeout(() => {
      pending.delete(mid);
      reject(new Error(`${method} timed out`));
    }, 10000);
    pending.set(mid, {
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); }
    });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const sid = undefined;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  }, sid);

  await send('Page.navigate', { url: APP }, sid);
  for (let i = 0; i < 40; i++) {
    const result = await send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true
    }, sid);
    if (result.result.value === 'complete') break;
    await sleep(250);
  }
  await sleep(1000);

  const evalJs = async expression => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    }, sid);
    return result.result.value;
  };

  async function shot(name, prep, selector) {
    if (prep) await evalJs(prep);
    await sleep(600);

    let clip;
    if (selector) {
      const rect = await evalJs(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {x:b.x,y:b.y,width:b.width,height:b.height};
      })()`);
      if (rect && rect.width > 50 && rect.height > 50) {
        clip = { ...rect, scale: 1 };
      }
    }

    const image = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: !clip
    }, sid);
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(image.data, 'base64'));
    console.log(`wrote ${OUT}/${name}.png`, clip ? '(clipped)' : '(full)');
  }

  await shot('01-pipelines-kanban', '', '.kanban-board');
  await shot('02-deal-cards-detail', '', '[aria-labelledby="model-underwriting-title"]');
  await shot('03-underwriting-charts',
    `(function(){
      window.scrollTo(0, 0);
      return true;
    })()`,
    '#sector-allocation-chart');
  await shot('04-settings-byok',
    `(function(){
      const b=[...document.querySelectorAll('button')].find(e=>/Business Model/i.test(e.textContent||''));
      if(b)b.click();
      const s=document.querySelector('[role="dialog"] select');
      if(s){
        s.value='international';
        s.dispatchEvent(new Event('change',{bubbles:true}));
      }
      return !!b;
    })()`,
    '[role="dialog"][aria-labelledby="business-model-settings-title"]');
  await shot('05-support-this-project',
    `(function(){
      const close=[...document.querySelectorAll('button')].find(e=>/Close business model settings/i.test(e.getAttribute('aria-label')||''));
      if(close) close.click();
      const b=[...document.querySelectorAll('button')].find(e=>/Support This Project/i.test(e.textContent||''));
      if(b)b.click();
      return !!b;
    })()`,
    '[role="dialog"][aria-labelledby="support-project-title"]');

  ws.close();
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
