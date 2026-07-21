/**
 * Environment variable validation and configuration
 * Ensures all required environment variables are set and properly typed
 */

const requireEnv = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

export const env = {
  PORT: process.env.PORT || "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: requireEnv("JWT_SECRET"),
  LENDER_API_KEY_SALT: requireEnv("LENDER_API_KEY_SALT"),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  STELLAR_NETWORK: requireEnv("STELLAR_NETWORK"),
  HORIZON_URL: requireEnv("HORIZON_URL"),
  PLATFORM_ADMIN_SECRET: requireEnv("PLATFORM_ADMIN_SECRET"),
  S3_BUCKET: requireEnv("S3_BUCKET"),
  S3_REGION: requireEnv("S3_REGION"),
} as const;

// Validate that no secrets are accidentally logged
if (
  process.env.DEBUG_LOGS === "true" ||
  process.env.NODE_ENV === "development"
) {
  const secrets = [
    "JWT_SECRET",
    "DATABASE_URL",
    "PLATFORM_ADMIN_SECRET",
    "LENDER_API_KEY_SALT",
  ];
  for (const secret of secrets) {
    if (process.env[secret]) {
      console.debug(`✓ ${secret} is set (value hidden)`);
    }
  }
}
