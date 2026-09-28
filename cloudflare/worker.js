/**
 * snip.ly — serverless URL shortener on Cloudflare Workers + KV.
 *
 *   GET  /          -> the web UI (served from the Worker itself)
 *   POST /shorten   -> {"url": "https://..."}  => 201 {"code": "aB3xYz"}
 *   GET  /{code}    -> 301 redirect (+ click counter)
 *
 * Deploy: paste this file into a new Worker, create a KV namespace,
 * and bind it as `URLS`.
 */

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 6;

const UI = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>snip.ly — serverless URL shortener</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#0b1020;color:#e8ecf8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{width:100%;max-width:520px;background:#141b33;border:1px solid #263056;border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
h1{font-size:1.6rem;margin-bottom:6px}h1 span{color:#7c9cff}
p.sub{color:#9aa4c7;font-size:.9rem;margin-bottom:24px}
.row{display:flex;gap:10px}
input{flex:1;padding:12px 14px;border-radius:10px;border:1px solid #2c3763;background:#0e1430;color:#e8ecf8;font-size:.95rem;outline:none}
input:focus{border-color:#7c9cff}
button{padding:12px 20px;border:none;border-radius:10px;background:#7c9cff;color:#0b1020;font-weight:700;cursor:pointer;font-size:.95rem;white-space:nowrap}
button:disabled{opacity:.6;cursor:wait}
#result{margin-top:20px;display:none}
#result .box{display:flex;align-items:center;gap:10px;background:#0e1430;border:1px dashed #3a4670;border-radius:10px;padding:12px 14px}
#shortUrl{flex:1;color:#8fd0ff;word-break:break-all;font-size:.9rem}
#copyBtn{padding:8px 14px;font-size:.85rem}
#error{margin-top:14px;color:#ff8f8f;font-size:.85rem;display:none}
.foot{margin-top:24px;font-size:.75rem;color:#5c6690;text-align:center}
</style>
</head>
<body>
<div class="card">
<h1>snip<span>.ly</span></h1>
<p class="sub">serverless URL shortener &mdash; Cloudflare Workers + KV</p>
<div class="row">
<input id="urlInput" type="url" placeholder="paste a long URL&hellip;" autocomplete="off" />
<button id="shortenBtn">Shorten</button>
</div>
<div id="error"></div>
<div id="result"><div class="box"><span id="shortUrl"></span><button id="copyBtn">Copy</button></div></div>
<p class="foot">runs on serverless &mdash; $0 when nobody uses it</p>
</div>
<script>
const input=document.getElementById("urlInput"),btn=document.getElementById("shortenBtn"),
result=document.getElementById("result"),shortUrlEl=document.getElementById("shortUrl"),
errorEl=document.getElementById("error"),copyBtn=document.getElementById("copyBtn");
function showError(m){errorEl.textContent=m;errorEl.style.display="block";result.style.display="none"}
async function shorten(){
const url=input.value.trim();errorEl.style.display="none";
if(!url)return showError("paste a URL first 🙂");
btn.disabled=true;btn.textContent="…";
try{
const res=await fetch("/shorten",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
const data=await res.json();
if(!res.ok)throw new Error(data.error||"something went wrong");
shortUrlEl.textContent=location.origin+"/"+data.code;result.style.display="block";
}catch(e){showError(e.message)}
finally{btn.disabled=false;btn.textContent="Shorten"}
}
btn.addEventListener("click",shorten);
input.addEventListener("keydown",e=>{if(e.key==="Enter")shorten()});
copyBtn.addEventListener("click",async()=>{await navigator.clipboard.writeText(shortUrlEl.textContent);copyBtn.textContent="Copied ✓";setTimeout(()=>copyBtn.textContent="Copy",1500)});
</script>
</body>
</html>`;

function genCode(length = CODE_LENGTH) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

function isValidUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Web UI
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return new Response(UI, {
        headers: { ...cors, "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    // POST /shorten
    if (request.method === "POST" && url.pathname === "/shorten") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON" }, 400, cors);
      }
      const target = (body.url || "").trim();
      if (!target) return json({ error: "Missing 'url' in request body" }, 400, cors);
      if (!isValidUrl(target))
        return json({ error: "URL must start with http:// or https://" }, 400, cors);

      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const existing = await env.URLS.get(code);
        if (existing === null) {
          await env.URLS.put(
            code,
            JSON.stringify({ url: target, created: Date.now(), clicks: 0 })
          );
          return json({ code, url: target }, 201, cors);
        }
      }
      return json({ error: "Could not generate a unique code, try again" }, 500, cors);
    }

    // GET /{code} -> redirect
    if (request.method === "GET" && url.pathname.length > 1) {
      const code = url.pathname.slice(1).split("/")[0];
      const raw = await env.URLS.get(code);
      if (raw === null) return json({ error: "Short URL not found" }, 404, cors);
      const rec = JSON.parse(raw);
      rec.clicks = (rec.clicks || 0) + 1;
      await env.URLS.put(code, JSON.stringify(rec)); // best-effort counter
      return new Response(null, {
        status: 301,
        headers: { ...cors, Location: rec.url },
      });
    }

    return json({ error: "Not found. POST /shorten or GET /{code}" }, 404, cors);
  },
};
