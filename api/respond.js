import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID || undefined
});

// Your Agent Builder workflow ID
const AGENT_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // Call your Agent Workflow instead of the Responses API
    const run = await client.workflows.create({
      workflow_id: AGENT_ID,
      inputs: {
        messages
      }
    });

    // Wait for the workflow to complete
    const result = await client.workflows.runs.retrieve(run.id);

    // Extract text output
    const outputs = result.output ?? {};
    const text =
      outputs.text ||
      outputs.output_text ||
      JSON.stringify(outputs, null, 2) ||
      "(no text returned)";

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Geaux Learn Agent Workflow Error:", e);
    res.status(500).json({ error: e?.message || String(e) });
  }
}
