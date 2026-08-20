export type GeneratedMetadata = {
  titles: string[];
  description: string;
  hashtags: string[];
  thumbnailText?: string;
};

export function validateGeneratedMetadata(
  input: GeneratedMetadata
): GeneratedMetadata {
  return {
    titles: input.titles
      .filter(title => title.trim().length > 0)
      .slice(0, 5)
      .map(title => title.trim().slice(0, 60)),
    description: input.description.trim().slice(0, 500),
    hashtags: Array.from(
      new Set(
        input.hashtags
          .map(tag => tag.trim().replace(/^#/, "#").slice(0, 40))
          .filter(Boolean)
      )
    ).slice(0, 10),
    thumbnailText: input.thumbnailText?.trim().toUpperCase().slice(0, 42),
  };
}

export type ThumbnailRequest = {
  sourceArtifactKey: string;
  outputArtifactKey: string;
  text: string;
  frameTimeSeconds: number;
  composition: "pil" | "playwright";
};
