import z from "zod";

export const createRequestSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("git"),
    gitUrl: z.string().url(),
  }),
  z.object({
    sourceType: z.literal("upload"),
    uploadPath: z.string().min(1),
    uploadOriginalName: z.string().min(1),
  }),
]);
