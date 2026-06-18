---
name: Anthropic claude-opus-4-8 constraints
description: Critical API differences vs OpenAI when using claude-opus-4-8 via Replit AI Integrations
---

## Rule
When using `claude-opus-4-8` via `@workspace/integrations-anthropic-ai`:

1. **No temperature/top_p/top_k** — omit entirely or get 400 error
2. **System is a separate param** — `{ system: "...", messages: [...] }` not in the messages array
3. **Content is an array of blocks** — `response.content[0]` with `type: "text" | "tool_use"`; not `response.choices[0].message.content`
4. **Tools use `input_schema`** — not `parameters`; format: `{ name, description, input_schema: { type: "object", properties } }`
5. **Tool use streaming** — `content_block_start` event gives `id`/`name`; `content_block_delta` with `input_json_delta` gives partial JSON
6. **Tool results in next user message** — `{ role: "user", content: [{ type: "tool_result", tool_use_id, content: JSON.stringify(result) }] }`
7. **Streaming**: `anthropic.messages.stream({...})` returns async iterable; `for await (const event of stream)`
8. **JSON output**: No `response_format`. Use explicit "respond with only valid JSON" in system prompt; parse with `raw.match(/\{[\s\S]*\}/)` regex as safety net

**Why:** OpenAI and Anthropic have fundamentally different API shapes. Mixing them causes silent failures (wrong content extraction) or 400 errors (temperature param).

**How to apply:** Any new AI call must use Anthropic SDK pattern, not OpenAI. Import from `@workspace/integrations-anthropic-ai`.
