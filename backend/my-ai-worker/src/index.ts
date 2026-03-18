// src/index.ts — Cloudflare Worker for AI inference with CORS support

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Expected POST request', {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    try {
      const body = await request.json();

      // Support both old format (prompt) and new format (context + question)
      let prompt;
      if (body.context && body.question) {
        prompt = `You are a precise assistant answering questions from documents.

STRICT RULES:
- Answer using ONLY the context provided below
- If asked about multiple items (projects, skills, jobs), list ALL of them
- Never truncate a list — if there are 4 projects, mention all 4
- Use bullet points for lists to ensure clarity
- If information is not in the context, say "Not found in this document"
- Never hallucinate or add information not in the context

CONTEXT:
---
${body.context}
---

QUESTION: ${body.question}

Answer completely and thoroughly:`;
      } else if (body.prompt) {
        prompt = body.prompt;
      } else {
        return new Response('Missing "prompt" or "context"+"question" in request body', {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      const messages = [{ role: 'user', content: prompt }];

      const stream = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages,
        stream: true,
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          ...CORS_HEADERS,
        },
      });
    } catch (e) {
      console.error(e);
      return new Response(e.message, {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};