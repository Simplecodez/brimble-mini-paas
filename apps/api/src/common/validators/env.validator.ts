import z from "zod";

const isProd = process.env.NODE_ENV === "production";

export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),

  STORAGE_DIR: z
    .string()
    .min(1)
    .default(isProd ? "/workspace/data" : "./data"),

  WORK_DIR: z
    .string()
    .min(1)
    .default(isProd ? "/workspace/deployments" : "./deployments"),

  BUILDKIT_HOST: z.string().default("tcp://brimble-buildkit:1234"),
  CADDY_BASE_URL: z.string().default("http://caddy:2019"),
  CADDY_ADMIN_URL: z.string().default("http://caddy:2019/load"),
  DOCKER_NETWORK: z.string().default("brimble-network"),
  APP_PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().default("http://localhost:8080"),
});
