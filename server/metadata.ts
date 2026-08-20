import { invokeLLM } from "./_core/llm";
import {
  validateGeneratedMetadata,
  GeneratedMetadata,
} from "../shared/content";

export async function generateClipMetadata(
  transcript: string,
  category: string
): Promise<GeneratedMetadata> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Você é especialista em metadados para Shorts, Reels e TikTok. Não invente fatos e não use clickbait enganoso.",
      },
      {
        role: "user",
        content: `Categoria: ${category}\nTranscrição:\n${transcript}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "clip_metadata",
        strict: true,
        schema: {
          type: "object",
          properties: {
            titles: { type: "array", items: { type: "string" } },
            description: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
            thumbnailText: { type: "string" },
          },
          required: ["titles", "description", "hashtags", "thumbnailText"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("LLM did not return metadata JSON");
  return validateGeneratedMetadata(JSON.parse(content) as GeneratedMetadata);
}
