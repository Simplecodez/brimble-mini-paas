import z from "zod";

export const createDeploymentSchema = z.object({
  repoUrl: z.url("Invalid repository URL"),
});
