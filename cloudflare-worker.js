export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
    if (request.method !== "POST") return json({error:"POST only"},405,cors);
    if (!env.OPENAI_API_KEY) return json({error:"OPENAI_API_KEY is not configured"},500,cors);

    try {
      const body = await request.json();
      const allowed = new Set(["gpt-5.6-luna","gpt-5.6-terra"]);
      const model = allowed.has(body.model) ? body.model : "gpt-5.6-luna";
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20).map(m=>({
        role:m.role==="assistant"?"assistant":"user",
        content:String(m.content||"").slice(0,4000)
      })) : [];

      const r = await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          model,
          instructions:String(body.instructions||"").slice(0,12000),
          input:messages,
          reasoning:{effort:"none"},
          max_output_tokens:220,
          store:false
        })
      });
      const d = await r.json();
      if(!r.ok) return json({error:d?.error?.message||`OpenAI API error ${r.status}`},r.status,cors);

      let text=d.output_text||"";
      if(!text && Array.isArray(d.output)){
        text=d.output.flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text||"").join("");
      }
      return json({text,model},200,cors);
    } catch(e) {
      return json({error:e?.message||String(e)},500,cors);
    }
  }
};
function json(v,status,cors){return new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
