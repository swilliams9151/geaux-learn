// api/respond.js
const WORKFLOW_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";

// NOTE: some beta endpoints require this header
const BETA_HEADER = { "OpenAI-Beta": "workflows=v1" };

// Newer beta base
const API_BASE = "https://api.openai.com/v1/beta";

function orgHeader() {
  const org = process.env.OPENAI_ORG_ID;
  return org ? { "OpenAI-Organization": org } : {};
}

async function readOnce(resp) {
  const raw = await resp.text();
  try { return { json: JSON.parse(raw), raw }; }
  catch { return { json: null, raw }; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    // read incoming body once
    const bufs = [];
    for await (const chunk of req) bufs.push(chunk);
    let body = {};
    try { body = JSON.parse(Buffer.concat(bufs).toString("utf8") || "{}"); } catch {}

    const { messages } = body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: "Missing messages" });

    // 1) Start run — NOTE the path change: /workflows/{id}/runs
    const startResp = await fetch(`${API_BASE}/workflows/${WORKFLOW_ID}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...orgHeader(),
        ...BETA_HEADER,
      },
      body: JSON.stringify({ inputs: { messages } }),
    });

    const start = await readOnce(startResp);
    if (!startResp.ok) {
      const msg = start.json?.error?.message || start.raw || "Failed to start workflow";
      return res.status(startResp.status).json({ error: `[start] HTTP ${startResp.status} — ${msg}` });
    }

    const runId = start.json?.id;
    if (!runId) return res.status(500).json({ error: "No run id returned from workflow start." });

    // 2) Poll until completion
    const deadline = Date.now() + 60_000;
    let result, status = start.json?.status;

    while (Date.now() < deadline) {
      const pollResp = await fetch(`${API_BASE}/workflows/runs/${runId}`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...orgHeader(),
          ...BETA_HEADER,
        },
      });
      const polled = await readOnce(pollResp);

      if (!pollResp.ok) {
        const msg = polled.json?.error?.message || polled.raw || "Failed to poll workflow";
        return res.status(pollResp.status).json({ error: `[poll] HTTP ${pollResp.status} — ${msg}` });
      }

      result = polled.json;
      status = result?.status;
      if (status === "completed" || status === "failed" || status === "canceled") break;
      await new Promise(r => setTimeout(r, 1200));
    }

    if (status !== "completed") {
      return res.status(500).json({ error: `Workflow did not complete (status: ${status ?? "unknown"})` });
    }

    // 3) Extract text
    const out = result?.output ?? {};
    let text =
      (typeof out === "string" ? out : "") ||
      out.text ||
      out.output_text ||
      "";

    if (!text) text = JSON.stringify(out || result, null, 2);
    if (!text.trim()) text = "I ran the workflow but didn’t get any text back.";

    return res.status(200).json({ text: text.trim() });
  } catch (e) {
    console.error("Geaux Learn Agent Workflow Error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
