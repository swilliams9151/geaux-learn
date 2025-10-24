// api/respond.js
const WORKFLOW_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";
const API_BASE = "https://api.openai.com/v1";

function orgHeader() {
  const org = process.env.OPENAI_ORG_ID;
  return org ? { "OpenAI-Organization": org } : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // 1) Start the workflow run
    const startResp = await fetch(`${API_BASE}/workflows/runs`, {
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

    if (!startResp.ok) {
      const err = await safeJson(startResp);
      return res
        .status(startResp.status)
        .json({ error: explainError("start", err, startResp.status) });
    }

    const started = await startResp.json(); // { id, status, ... }
    const runId = started.id;

    // 2) Poll until the run completes (simple loop with timeout)
    const deadline = Date.now() + 60_000; // 60s timeout
    let result, status = started.status;
    while (Date.now() < deadline) {
      const poll = await fetch(`${API_BASE}/workflows/runs/${runId}`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...orgHeader(),
        },
      });
      if (!poll.ok) {
        const err = await safeJson(poll);
        return res
          .status(poll.status)
          .json({ error: explainError("poll", err, poll.status) });
      }
      result = await poll.json(); // { status, output, ... }
      status = result.status;
      if (status === "completed" || status === "failed" || status === "canceled") break;
      await sleep(1200);
    }

    if (status !== "completed") {
      return res.status(500).json({ error: `Workflow did not complete (status: ${status}).` });
    }

    // 3) Extract text from the workflow's output
    const out = result?.output ?? {};
    let text =
      out.text ||
      out.output_text ||
      (typeof out === "string" ? out : "") ||
      "";

    if (!text) {
      // last resort: dump something useful
      text = JSON.stringify(out || result, null, 2);
    }
    if (!text.trim()) {
      text = "I ran the workflow but didn’t get any text back.";
    }

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Geaux Learn Agent Workflow Error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return { message: await resp.text() }; }
}

function explainError(stage, errJson, status) {
  const base = `[${stage}] HTTP ${status}`;
  if (!errJson) return base;
  const msg = errJson.error?.message || errJson.message || JSON.stringify(errJson);
  return `${base} — ${msg}`;
}
