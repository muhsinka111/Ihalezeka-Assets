import Anthropic from "@anthropic-ai/sdk";

let _instance: Anthropic | null = null;

export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    if (!_instance) {
      if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
        throw new Error(
          "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
        );
      }
      _instance = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      });
    }
    return Reflect.get(_instance, prop, receiver);
  },
});
