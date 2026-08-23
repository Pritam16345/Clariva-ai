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
        prompt = `You are an expert AI research assistant. Your task is to provide a clear, professional, and concise answer to the user's question based strictly on the provided context.

CRITICAL INSTRUCTIONS:
1. ONLY use the provided context to answer. Do not use outside knowledge.
2. If the answer is not contained in the context, output EXACTLY: "Not found in this document." Do not try to guess.
3. Be concise and professional. Do not write filler intros or conclusions. Get straight to the point.
4. Use formatting (bullet points, bold text) to make your answer highly readable.
5. If the user asks for a list, provide it fully without omitting items found in the context.

CONTEXT:
================
${body.context}
================

QUESTION: ${body.question}

ANSWER:`;
      } else if (body.prompt) {
        prompt = body.prompt;
      } else {
        return new Response('Missing "prompt" or "context"+"question" in request body', {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      const messages = [{ role: 'user', content: prompt }];

      const streamRequested = body.stream !== false;

      if (streamRequested) {
        const stream = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages,
          max_tokens: 1024,
          stream: true,
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            ...CORS_HEADERS,
          },
        });
      } else {
        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages,
          max_tokens: 1024,
          stream: false,
        });

        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        });
      }
    } catch (e) {
      console.error(e);
      return new Response(e.message, {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};