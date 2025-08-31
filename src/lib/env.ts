
import { z } from "zod";

const envSchema = z.object({
  DB_HOST: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive(),
  SESSION_COOKIE_NAME: z.string(),
  NODE_ENV: z.enum(["development", "production"]),
});

export const env = envSchema.parse(process.env);
