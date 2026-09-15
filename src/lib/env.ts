import { z } from "zod";

/**
 * Server-only environment variables.
 * Never import this module from client components.
 */
export const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * Variables exposed to the browser.
 * Must be prefixed with NEXT_PUBLIC_ and listed explicitly (Next.js inlines
 * them at build time; they cannot be read dynamically from process.env).
 */
export const publicSchema = z.object({});

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

export const serverEnv = parseEnv(serverSchema, {
  NODE_ENV: process.env.NODE_ENV,
});

export const publicEnv = parseEnv(publicSchema, {});
