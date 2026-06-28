import OpenAI from "openai";

let _instance: OpenAI | null = null;

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    if (!_instance) {
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        throw new Error(
          "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
        );
      }
      _instance = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
      });
    }
    return Reflect.get(_instance, prop, receiver);
  },
});
