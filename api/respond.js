import OpenAI from "openai";

// Your Agent Builder workflow ID
const WORKFLOW_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Add this if your workflow is in a different org than the key:
  organization: process.env.OPENAI_ORG_ID || undefined,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // 1) Start a workflow run (Beta API)
    const run = await client.beta.workflows.runs.create({
      workflow_id: WORKFLOW_ID,
      inputs: { messages }, // pass your chat history to the workflow
    });

    // 2) Retrieve the finished run
    const result = await client.beta.workflows.runs.retrieve(run.id);

    // 3) Extract text output robustly
    const out = result?.output ?? {};
    let text =
      out.text ||
      out.output_text ||
      (typeof out === "string" ? out : "") ||
      "";

    if (!text) {
      // try to stringify whatever came back
      text = JSON.stringify(out || result, null, 2);
    }
    if (!text) text = "I ran the workflow but didn’t get any text back.";

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Geaux Learn Agent Workflow Error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
