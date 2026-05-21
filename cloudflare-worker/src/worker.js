const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request, env, ctx) {
    try { return await handleFetch(request, env, ctx); }
    catch (e) { return json({ ok:false, error: safeError(e) }, 500); }
  },
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try { await processTask(msg.body.id, env, msg.body.keyCipher); msg.ack(); }
      catch (e) { await failOrRetry(msg.body.id, env, e, msg.body.keyCipher); msg.ack(); }
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(runCron(env)); }
};

async function handleFetch(request, env, ctx) {
  if (request.method === 'OPTIONS') return new Response('', { headers: JSON_HEADERS });
  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '/health') return json({ ok:true, service:'Image2Studio Cloud', version:'2.3.0-security' });
  if (url.pathname === '/admin') return adminPage(request, env, url);
  if (url.pathname === '/api/admin/stats' && request.method === 'GET') return adminStats(request, env, url);
  const rm = url.pathname.match(/^\/api\/tasks\/([^/]+)\/kv\/(\d+)$/);
  if (rm && request.method === 'GET') return getKvResult(rm[1], rm[2], env, url);
  if (url.pathname.match(/^\/api\/tasks\/[^/]+\/retry$/) && request.method === 'POST') return retryTask(url.pathname.split('/')[3], env, url);
  if (url.pathname === '/api/tasks' && request.method === 'POST') return createTask(request, env);
  if (url.pathname === '/api/tasks' && request.method === 'GET') return listTasks(request, env, url, Number(url.searchParams.get('limit') || 30));
  const m = url.pathname.match(/^\/api\/tasks\/([^/]+)(?:\/(result|cancel))?$/);
  if (m && request.method === 'GET') {
    if (!m[2]) return getTask(m[1], env, url);
    if (m[2] === 'result') return getResult(m[1], env, url);
  }
  if (m && request.method === 'POST' && m[2] === 'cancel') return cancelTask(m[1], env, url);
  return json({ ok:false, error:'not found' }, 404);
}

async function createTask(request, env) {
  const body = await request.json().catch(() => ({}));
  const mode = clean(body.mode || 'text');
  if (!['text','edit'].includes(mode)) return json({ ok:false, error:'mode must be text or edit' }, 400);
  const prompt = String(body.prompt || '').trim();
  if (!prompt) return json({ ok:false, error:'prompt required' }, 400);
  const key = String(body.apiKey || '').trim();
  if (!key) return json({ ok:false, error:'apiKey required for cloud task' }, 400);
  if (key.length < 12 || key.length > 300) return json({ ok:false, error:'bad apiKey length' }, 400);
  const clientTaskId = clean(body.clientTaskId || crypto.randomUUID());
  const existed = await env.DB.prepare('SELECT * FROM tasks WHERE client_task_id=?').bind(clientTaskId).first();
  if (existed) return json({ ok:true, task: publicTask(existed), idempotent:true });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const baseUrl = allowedBase(body.baseUrl || 'https://factory.pub', env);
  const model = clean(body.model || 'gpt-image-2');
  const negative = String(body.negativePrompt || body.negative_prompt || '').slice(0, 2000);
  const ratio = clean(body.ratio || 'Auto');
  const quality = clean(body.quality || 'Auto');
  const n = Math.max(1, Math.min(4, Number(body.n || 1)));
  const deviceToken = clean(body.deviceToken || '');
  if (!deviceToken || deviceToken.length < 16) return json({ ok:false, error:'deviceToken required' }, 400);
  const deviceHash = await sha256(deviceToken);
  const limited = await rateLimit(env, 'create:'+deviceHash, 20, 3600);
  if (!limited.ok) return json({ ok:false, error:'rate limited', retryAfter:limited.retryAfter }, 429);
  const input = { editImages: sanitizeEditImages(body.editImages || body.images || []) };
  const reqHash = await sha256([mode, model, prompt, negative, ratio, quality, n, JSON.stringify(input.editImages||[])].join('\n'));
  await env.DB.prepare(`INSERT INTO tasks (id,client_task_id,mode,status,base_url,model,prompt,negative_prompt,ratio,quality,n,retry_count,max_retries,input_json,result_json,error,created_at,updated_at,request_hash,device_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, clientTaskId, mode, 'queued', baseUrl, model, prompt, negative, ratio, quality, n, 0, 4, JSON.stringify(input), '[]', '', now, now, reqHash, deviceHash).run();
  await env.TASK_QUEUE.send({ id, keyCipher: await encryptApiKey(key, env) });
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
  return json({ ok:true, task: publicTask(task), idempotent:false });
}

async function processTask(id, env, keyCipher) {
  const t = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
  if (!t || ['succeeded','cancelled'].includes(t.status)) return;
  const input = JSON.parse(t.input_json || '{}');
  const apiKey = await decryptApiKey(keyCipher, env);
  if (!apiKey) throw new Error('apiKey missing in queue message');
  await updateTask(env, id, { status:'running', started_at:t.started_at || new Date().toISOString(), error:'' });
  let upstream = t.mode === 'text' ? await callText(t, apiKey) : await callEdit(t, apiKey, input.editImages || []);
  const results = await storeResults(id, upstream, env);
  if (!results.length) throw new Error('upstream returned no image data');
  await updateTask(env, id, { status:'succeeded', result_json:JSON.stringify(results), finished_at:new Date().toISOString(), error:'' });
}

async function callText(t, apiKey) {
  const req = { model:t.model, prompt:promptPlus(t.prompt,t.ratio,t.quality), n:Number(t.n||1) };
  const size = sizeFor(t.ratio,t.quality); if (size) req.size = size;
  if (t.negative_prompt) req.negative_prompt = t.negative_prompt;
  return fetchJsonWithRetry(`${trimBase(t.base_url)}/v1/images/generations`, { method:'POST', headers:{ 'authorization':`Bearer ${apiKey}`, 'content-type':'application/json', 'accept':'application/json' }, body:JSON.stringify(req) });
}

async function callEdit(t, apiKey, images) {
  if (!images.length) throw new Error('editImages required for edit mode');
  const fd = new FormData();
  fd.append('model', t.model); fd.append('prompt', promptPlus(t.prompt,t.ratio,t.quality)); fd.append('n', String(t.n||1));
  const size = sizeFor(t.ratio,t.quality); if (size) fd.append('size', size);
  for (let i=0;i<Math.min(4,images.length);i++) {
    const img = images[i];
    let bytes, type='image/png';
    if (String(img).startsWith('data:')) { const p = dataUrlToBytes(img); bytes=p.bytes; type=p.type; }
    else { throw new Error('edit image must be data URL'); }
    fd.append('image', new Blob([bytes], { type }), `ref${i}.png`);
  }
  return fetchJsonWithRetry(`${trimBase(t.base_url)}/v1/images/edits`, { method:'POST', headers:{ 'authorization':`Bearer ${apiKey}`, 'accept':'application/json' }, body:fd });
}

async function fetchJsonWithRetry(url, init) {
  let last;
  for (let i=1;i<=4;i++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort('timeout'), 14*60*1000);
      const r = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(timer);
      const text = await r.text();
      if (!r.ok) throw new Error(parseUpstreamError(text) || `upstream HTTP ${r.status}`);
      return JSON.parse(text || '{}');
    } catch(e) {
      last = e;
      if (i>=4 || !isTransient(safeError(e))) throw e;
      await sleep(retryDelay(i)*1000);
    }
  }
  throw last;
}


async function storeResults(id, upstream, env) {
  const arr = upstream.data || [];
  const out = [];
  for (let i=0;i<arr.length;i++) {
    const it = arr[i]; const url = it.url || ''; const b64 = it.b64_json || it.b64 || '';
    if (b64) {
      await env.RESULTS.put(`tasks/${id}/${i}.b64`, b64, { expirationTtl: 60*60 });
      out.push({ index:i, url:'', kv:true, fileUrl:`/api/tasks/${id}/kv/${i}` });
    } else if (url) out.push({ index:i, url, kv:false, fileUrl:url });
  }
  return out;
}
async function getKvResult(id, index, env, url) {
  const t=await env.DB.prepare('SELECT client_task_id,device_hash FROM tasks WHERE id=?').bind(id).first(); if(!t) return json({ok:false,error:'task not found'},404); if(!(await authorizedAsync(t,url))) return json({ok:false,error:'clientTaskId/deviceToken required'},403);
  const b64 = await env.RESULTS.get(`tasks/${id}/${Number(index)||0}.b64`);
  if (!b64) return json({ ok:false, error:'result not found or expired' }, 404);
  return json({ ok:true, index:Number(index)||0, b64_json:b64, fileUrl:'data:image/png;base64,'+b64 });
}

function normalizeResults(upstream) {
  const arr = upstream.data || [];
  return arr.map((it,i) => {
    const b64 = it.b64_json || it.b64 || '';
    const url = it.url || '';
    const dataUrl = b64 ? (String(b64).startsWith('data:') ? b64 : 'data:image/png;base64,' + b64) : '';
    return { index:i, url, b64_json:b64, fileUrl:dataUrl || url };
  }).filter(x => x.url || x.b64_json);
}

async function failOrRetry(id, env, e, keyCipher) {
  const t = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
  if (!t) return;
  const retry = Number(t.retry_count || 0) + 1;
  const now = new Date().toISOString();
  const msg = safeError(e);
  if (retry <= Number(t.max_retries || 4) && isTransient(msg) && !['cancelled','succeeded'].includes(t.status)) {
    await env.DB.prepare("UPDATE tasks SET status='retrying', retry_count=?, error=?, updated_at=? WHERE id=?").bind(retry, msg, now, id).run();
    await env.TASK_QUEUE.send({ id, keyCipher }, { delaySeconds: retryDelay(retry) });
  } else {
    await env.DB.prepare("UPDATE tasks SET status='failed', retry_count=?, error=?, updated_at=?, finished_at=? WHERE id=?").bind(retry, msg, now, now, id).run();
  }
}

async function runCron(env) {
  await requeueStalled(env);
  await cleanupOldTasks(env);
}

async function cleanupOldTasks(env) {
  const cutoff = new Date(Date.now() - 60*60*1000).toISOString();
  const rs = await env.DB.prepare("SELECT id,result_json FROM tasks WHERE created_at < ? LIMIT 200").bind(cutoff).all();
  for (const t of rs.results || []) {
    try {
      const results = JSON.parse(t.result_json || '[]');
      for (const r of results) {
        if (r && r.kv) await env.RESULTS.delete(`tasks/${t.id}/${Number(r.index)||0}.b64`);
      }
    } catch(e) {}
  }
  await env.DB.prepare("DELETE FROM tasks WHERE created_at < ?").bind(cutoff).run();
}

async function requeueStalled(env) {
  const cutoff = new Date(Date.now() - 12*60*1000).toISOString();
  const rs = await env.DB.prepare("SELECT id,retry_count,max_retries FROM tasks WHERE status IN ('running','retrying') AND updated_at < ? LIMIT 20").bind(cutoff).all();
  for (const t of rs.results || []) {
    if (Number(t.retry_count||0) < Number(t.max_retries||4)) {
      await env.DB.prepare("UPDATE tasks SET status='retrying', retry_count=retry_count+1, error='stalled; requeued by cron', updated_at=? WHERE id=?").bind(new Date().toISOString(), t.id).run();
      await env.DB.prepare("UPDATE tasks SET status='failed', error='stalled; app must resubmit with api key', updated_at=?, finished_at=? WHERE id=?").bind(new Date().toISOString(), new Date().toISOString(), t.id).run();
    }
  }
}

async function listTasks(request, env, url, limit) { if(!adminAuthorized(request, env, url)) return json({ ok:false, error:'admin auth required' }, 401); await cleanupOldTasks(env); const rs = await env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?').bind(Math.max(1, Math.min(100, limit))).all(); return json({ ok:true, tasks:(rs.results||[]).map(redactedTask) }); }
async function getTask(id, env, url) { const t = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first(); if(!t) return json({ ok:false, error:'task not found' }, 404); if(!(await authorizedAsync(t,url))) return json({ ok:false, error:'clientTaskId/deviceToken required' }, 403); return json({ ok:true, task:publicTask(t) }); }
async function getResult(id, env, url) { const t = await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first(); if (!t) return json({ ok:false, error:'task not found' }, 404); if(!(await authorizedAsync(t,url))) return json({ ok:false, error:'clientTaskId/deviceToken required' }, 403); return json({ ok:true, status:t.status, results:JSON.parse(t.result_json||'[]'), error:t.error||'' }); }
async function cancelTask(id, env, url) { const t=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first(); if(!t) return json({ok:false,error:'task not found'},404); if(!(await authorizedAsync(t,url))) return json({ok:false,error:'clientTaskId/deviceToken required'},403); const now = new Date().toISOString(); await env.DB.prepare("UPDATE tasks SET status='cancelled', updated_at=?, finished_at=? WHERE id=? AND status IN ('queued','retrying','running')").bind(now, now, id).run(); return getTask(id, env, url); }
async function retryTask(id, env, url) { const t=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first(); if(!t) return json({ok:false,error:'task not found'},404); if(!(await authorizedAsync(t,url))) return json({ok:false,error:'clientTaskId/deviceToken required'},403); return json({ok:false,error:'retry requires resubmit from app so apiKey is not stored'},400); }
async function adminStats(request, env, url){ if(!adminAuthorized(request, env, url)) return json({ok:false,error:'admin auth required'},401); await cleanupOldTasks(env); const rs=await env.DB.prepare("SELECT status, COUNT(*) c FROM tasks GROUP BY status").all(); return json({ok:true,stats:rs.results||[]});}
async function updateTask(env, id, fields) { fields.updated_at = new Date().toISOString(); const keys = Object.keys(fields); await env.DB.prepare('UPDATE tasks SET '+keys.map(k=>`${k}=?`).join(', ')+' WHERE id=?').bind(...keys.map(k=>fields[k]), id).run(); }
async function authorizedAsync(t,url){if(url.searchParams.get('clientTaskId')!==t.client_task_id)return false;if(!t.device_hash)return false;const dt=url.searchParams.get('deviceToken')||'';if(!dt)return false;return await sha256(dt)===t.device_hash}
function redactedTask(t) { const results=JSON.parse(t.result_json||'[]'); return { idShort:String(t.id||'').slice(0,8)+'…', mode:t.mode, status:t.status, model:t.model, ratio:t.ratio, quality:t.quality, n:t.n, retryCount:t.retry_count, resultCount:results.length, hasError:!!t.error, createdAt:t.created_at, updatedAt:t.updated_at, startedAt:t.started_at, finishedAt:t.finished_at }; }
function publicTask(t) { return { id:t.id, clientTaskId:t.client_task_id, mode:t.mode, status:t.status, model:t.model, prompt:t.prompt, ratio:t.ratio, quality:t.quality, n:t.n, retryCount:t.retry_count, results:JSON.parse(t.result_json||'[]'), error:t.error||'', createdAt:t.created_at, updatedAt:t.updated_at, startedAt:t.started_at, finishedAt:t.finished_at }; }
function promptPlus(p,r,q){let e='';if(r&&r!=='Auto')e+=`, ${r} aspect ratio`;if(q==='4K')e+=', true 4K, ultra detailed';return p+e;} function sizeFor(r,q){if(q!=='4K')return'';return {'16:9':'3840x2160','9:16':'2160x3840','1:1':'2880x2880','4:3':'3200x2400','3:4':'2400x3200'}[r]||'2880x2880';}
function json(obj, status=200) { return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS }); } function clean(s) { return String(s || '').trim().slice(0, 4000); } function trimBase(s) { s = clean(s) || 'https://factory.pub'; while (s.endsWith('/')) s=s.slice(0,-1); return s; } function safeError(e) { return String(e && e.message ? e.message : e).replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer ***').replace(/sk-[A-Za-z0-9._-]+/g,'sk-***').slice(0,800); }
function isTransient(m) { m=String(m).toLowerCase(); return ['abort','reset','timeout','timed out','econn','502','503','504','network','fetch failed','unexpected end','internal error'].some(x=>m.includes(x)); } function retryDelay(n) { return [0,3,10,30,90][Math.min(4,n)] || 90; } function sleep(ms){return new Promise(r=>setTimeout(r,ms));}


async function encryptionKey(env){const secret=String(env.API_KEY_ENCRYPTION_SECRET||env.IMAGE2STUDIO_ADMIN_TOKEN||''); if(secret.length<16) throw new Error('API_KEY_ENCRYPTION_SECRET not configured'); const hash=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt','decrypt']);}
function b64enc(buf){let bin=''; const a=new Uint8Array(buf); for(let i=0;i<a.length;i++) bin+=String.fromCharCode(a[i]); return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64dec(s){s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; const bin=atob(s); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i); return a.buffer;}
async function encryptApiKey(apiKey, env){const iv=crypto.getRandomValues(new Uint8Array(12)); const key=await encryptionKey(env); const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(apiKey)); return b64enc(iv)+'.'+b64enc(ct);}
async function decryptApiKey(cipher, env){if(!cipher) return ''; const [iv,ct]=String(cipher).split('.'); if(!iv||!ct) return ''; const key=await encryptionKey(env); const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b64dec(iv))}, key, b64dec(ct)); return new TextDecoder().decode(pt);}

function adminToken(env){return String(env.IMAGE2STUDIO_ADMIN_TOKEN||env.ADMIN_TOKEN||env.ADMIN_PASSWORD||'').trim();}
function adminAuthorized(request, env, url){const tok=adminToken(env); if(!tok) return false; const h=request.headers.get('authorization')||''; if(h===`Bearer ${tok}`) return true; if((request.headers.get('x-admin-token')||'')===tok) return true; if(url.searchParams.get('token')===tok) return true; const ck=request.headers.get('cookie')||''; return ck.split(';').map(x=>x.trim()).includes('i2_admin='+encodeURIComponent(tok));}
function loginPage(){return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Image2Studio Admin Login</title><style>body{margin:0;background:#07111f;color:#eef7ff;font-family:system-ui;padding:28px}.box{max-width:420px;margin:12vh auto;background:#111c2e;border:1px solid #243247;border-radius:22px;padding:22px}input,button{width:100%;height:48px;border-radius:14px;border:1px solid #2a354a;margin-top:12px;font-size:16px}input{background:#090e18;color:#fff;padding:0 12px}button{background:#38bdf8;color:#06111f;font-weight:800}</style></head><body><form class="box" method="get"><h1>Admin Login</h1><p>请输入后台令牌。</p><input name="token" type="password" autofocus><button>进入</button></form></body></html>`,{status:401,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}
function allowedBase(v, env){const base=trimBase(v||'https://factory.pub'); let u; try{u=new URL(base)}catch(e){throw new Error('bad baseUrl')} if(u.protocol!=='https:') throw new Error('baseUrl must be https'); const allowed=String(env.ALLOWED_BASE_ORIGINS||'https://factory.pub').split(',').map(x=>x.trim()).filter(Boolean); if(!allowed.includes(u.origin)) throw new Error('baseUrl not allowed'); return u.origin;}
function sanitizeEditImages(images){if(!Array.isArray(images)) return []; const out=[]; let total=0; for(const img of images.slice(0,4)){const s=String(img||''); if(!s.startsWith('data:image/')) throw new Error('edit image must be data URL'); if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(s)) throw new Error('unsupported edit image type'); total+=s.length; if(s.length>8*1024*1024 || total>18*1024*1024) throw new Error('edit image too large'); out.push(s);} return out;}
async function rateLimit(env,key,max,windowSec){try{const now=Math.floor(Date.now()/1000); const row=await env.DB.prepare('SELECT count,window_start FROM rate_limits WHERE key=?').bind(key).first(); if(!row||now-Number(row.window_start||0)>=windowSec){await env.DB.prepare('INSERT OR REPLACE INTO rate_limits (key,count,window_start) VALUES (?,?,?)').bind(key,1,now).run(); return {ok:true};} const count=Number(row.count||0)+1; await env.DB.prepare('UPDATE rate_limits SET count=? WHERE key=?').bind(count,key).run(); if(count>max) return {ok:false,retryAfter:windowSec-(now-Number(row.window_start||0))}; return {ok:true};}catch(e){return {ok:true};}}

async function sha256(s) { const b = new TextEncoder().encode(s); const h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function parseUpstreamError(text){try{const j=JSON.parse(text);return j.error?.message||j.message||text.slice(0,500)}catch{return text.slice(0,500)}}
function base64ToBytes(b64){const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a.buffer;} function dataUrlToBytes(s){const m=s.match(/^data:([^;]+);base64,(.*)$/);if(!m)throw new Error('bad data url');return {type:m[1],bytes:base64ToBytes(m[2])};}


function adminPage(request, env, url){if(!adminAuthorized(request, env, url)) return loginPage(); const set=url.searchParams.get('token')?{'set-cookie':'i2_admin='+encodeURIComponent(adminToken(env))+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800'}:{}; return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Image2Studio Cloud Admin</title><style>body{margin:0;background:#07111f;color:#eef7ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.wrap{max-width:1180px;margin:auto;padding:22px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.card{background:#111c2e;border:1px solid #243247;border-radius:20px;padding:16px;margin:12px 0}button{border:0;border-radius:12px;padding:9px 12px;background:#38bdf8;color:#06111f;font-weight:800}.ghost{background:#253044;color:#eef7ff}.bad{background:#dc2626;color:white}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.task{display:grid;grid-template-columns:1.2fr .8fr .8fr .8fr auto;gap:10px;align-items:start}.muted{color:#93a4bd}.err{color:#fca5a5;white-space:pre-wrap}.prompt{white-space:pre-wrap;max-height:70px;overflow:auto}.res{font-size:12px;word-break:break-all;max-height:80px;overflow:auto}.ok{color:#86efac}.fail{color:#fca5a5}@media(max-width:820px){.grid,.task{grid-template-columns:1fr}.top{display:block}}</style></head><body><main class="wrap"><div class="top"><div><h1>Image2Studio Cloud Admin</h1><div class="muted">隐私模式：提示词、错误详情、结果内容默认隐藏</div></div><button id="refresh">刷新</button></div><div id="error" class="err"></div><div id="stats" class="grid"></div><div id="list"></div></main><script>const statsEl=document.getElementById('stats');const listEl=document.getElementById('list');const errEl=document.getElementById('error');document.getElementById('refresh').onclick=load;async function j(u,o){let r=await fetch(u,o);let t=await r.text();try{return JSON.parse(t)}catch(e){throw new Error('JSON解析失败 '+r.status+' '+t.slice(0,200))}}function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}async function act(id,a){if(!confirm(a+' '+id+' ?'))return;if(a==='cancel')await j('/api/tasks/'+id+'/cancel',{method:'POST'});if(a==='retry')await j('/api/tasks/'+id+'/retry',{method:'POST'});load()}function cls(s){return s==='succeeded'?'ok':(s==='failed'?'fail':'')}function fmtTime(s){if(!s)return '-';try{return new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}catch(e){return s}}function card(t){let err=t.hasError?'有错误（已隐藏）':'';return '<div class="card task"><div><b class="'+cls(t.status)+'">'+esc(t.status)+'</b><div class="muted">任务 '+esc(t.idShort)+'</div><div class="muted">创建 '+esc(fmtTime(t.createdAt))+'</div><div class="muted">完成 '+esc(fmtTime(t.finishedAt))+'</div></div><div><b>'+esc(t.mode)+' · '+esc(t.model)+'</b><div>'+esc(t.ratio)+' / '+esc(t.quality)+' / n='+esc(t.n)+'</div><div>retry '+esc(t.retryCount)+'</div></div><div class="prompt muted">提示词已隐藏</div><div><div class="err">'+esc(err)+'</div><div class="res muted">结果数量：'+esc(t.resultCount)+'（详情已隐藏）</div></div><div class="muted">公开后台不提供详情操作</div></div>'}async function load(){try{errEl.textContent='';let st=await j('/api/admin/stats');statsEl.innerHTML=(st.stats||[]).map(function(x){return '<div class="card"><b class="'+cls(x.status)+'">'+esc(x.status)+'</b><h2>'+esc(x.c)+'</h2></div>'}).join('')||'<div class="card muted">暂无统计</div>';let r=await j('/api/tasks?limit=100');listEl.innerHTML=(r.tasks||[]).map(card).join('')||'<div class="card muted">暂无任务</div>';}catch(e){errEl.textContent='后台加载失败：'+(e.message||e)}}load();setInterval(load,10000);</script></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',...set}})}
