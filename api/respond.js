// api/respond.js
const WORKFLOW_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";
const API_BASE = "https://api.openai.com/v1/beta"; // Workflows beta

function orgHeader() {
  const org = process.env.OPENAI_ORG_ID;
  return org ? { "OpenAI-Organization": org } : {};
}

// Read a Response body exactly once, then (best-effort) JSON-parse it
async function readOnce(res) {
  const raw = await res.text();
  try { return { json: JSON.parse(raw), raw }; }
  catch { return { json: null, raw }; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    // Read the incoming body safely ONCE
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    let body;
    try { body = JSON.parse(bodyText || "{}"); } catch { body = {}; }

    const { messages } = body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // 1) Start the workflow run
    const start = await fetch(`${API_BASE}/workflows/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...orgHeader(),
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        inputs: { messages },
      }),
    });

    const startData = await readOnce(start);
    if (!start.ok) {
      const msg = startData.json?.error?.message || startData.raw || "Failed to start workflow";
      return res.status(start.status).json({ error: `[start] HTTP ${start.status} — ${msg}` });
    }

    const runId = startData.json?.id;
    if (!runId) {
      return res.status(500).json({ error: "No run id returned from workflow start." });
    }

    // 2) Poll until complete (up to ~60s)
    const deadline = Date.now() + 60_000;
    let status = startData.json?.status;
    let resultJson = null, resultRaw = "";

    while (Date.now() < deadline) {
      const poll = await fetch(`${API_BASE}/workflows/runs/${runId}`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...orgHeader(),
        },
      });
      const polled = await readOnce(poll);

      if (!poll.ok) {
        const msg = polled.json?.error?.message || polled.raw || "Failed to poll workflow";
        return res.status(poll.status).json({ error: `[poll] HTTP ${poll.status} — ${msg}` });
      }

      resultJson = polled.json;
      resultRaw = polled.raw;
      status = resultJson?.status;

      if (status === "completed" || status === "failed" || status === "canceled") break;
      await new Promise(r => setTimeout(r, 1200));
    }

    if (status !== "completed") {
      return res.status(500).json({ error: `Workflow did not complete (status: ${status ?? "unknown"})` });
    }

    // 3) Extract text
    const out = resultJson?.output ?? {};
    let text =
      (typeof out === "string" ? out : "") ||
      out.text ||
      out.output_text ||
      "";

    if (!text) text = resultRaw || "I ran the workflow but didn’t get any text back.";
    return res.status(200).json({ text: String(text).trim() || "…" });

  } catch (e) {
    console.error("Geaux Learn Agent Workflow Error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
