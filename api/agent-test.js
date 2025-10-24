import OpenAI from "openai";
const WORKFLOW_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";

export default async function handler(req, res) {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID || undefined,
    });

    const run = await client.beta.workflows.runs.create({
      workflow_id: WORKFLOW_ID,
      inputs: { prompt: "Say 'Hello from the Geaux Learn Agent!'" }
    });

    const result = await client.beta.workflows.runs.retrieve(run.id);
    const out = result?.output ?? {};
    const text = out.text || out.output_text || JSON.stringify(out) || "(no text)";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
