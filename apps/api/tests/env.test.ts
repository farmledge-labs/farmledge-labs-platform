import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Environment Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear the env module cache to allow re-importing with different env vars
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("throws error when required JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.PLATFORM_ADMIN_SECRET = "test-secret";
    process.env.LENDER_API_KEY_SALT = "test-salt";
    process.env.STELLAR_NETWORK = "testnet";
    process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_REGION = "us-east-1";

    const { env: importEnv } = await import("../src/config/env.js");
    expect(() => {
      // Access the env object to trigger validation
      void importEnv.JWT_SECRET;
    }).toThrow("Missing required environment variable: JWT_SECRET");
  });

  it("throws error when required DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = "test-secret";
    process.env.PLATFORM_ADMIN_SECRET = "test-secret";
    process.env.LENDER_API_KEY_SALT = "test-salt";
    process.env.STELLAR_NETWORK = "testnet";
    process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_REGION = "us-east-1";

    const { env: importEnv } = await import("../src/config/env.js");
    expect(() => {
      void importEnv.DATABASE_URL;
    }).toThrow("Missing required environment variable: DATABASE_URL");
  });

  it("throws error when required PLATFORM_ADMIN_SECRET is missing", async () => {
    delete process.env.PLATFORM_ADMIN_SECRET;
    process.env.JWT_SECRET = "test-secret";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.LENDER_API_KEY_SALT = "test-salt";
    process.env.STELLAR_NETWORK = "testnet";
    process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_REGION = "us-east-1";

    const { env: importEnv } = await import("../src/config/env.js");
    expect(() => {
      void importEnv.PLATFORM_ADMIN_SECRET;
    }).toThrow("Missing required environment variable: PLATFORM_ADMIN_SECRET");
  });

  it("does not log secret values in error messages", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = "postgresql://user:password@localhost/db";

    try {
      const { env: importEnv } = await import("../src/config/env.js");
      void importEnv.JWT_SECRET;
    } catch (err) {
      const error = err as Error;
      expect(error.message).not.toContain("password");
      expect(error.message).not.toContain("user");
    }

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("uses default values for optional PORT when not provided", async () => {
    delete process.env.PORT;
    process.env.JWT_SECRET = "test-secret";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.PLATFORM_ADMIN_SECRET = "test-secret";
    process.env.LENDER_API_KEY_SALT = "test-salt";
    process.env.STELLAR_NETWORK = "testnet";
    process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_REGION = "us-east-1";

    const { env: importEnv } = await import("../src/config/env.js");
    expect(importEnv.PORT).toBe("3000");
  });

  it("successfully loads all required environment variables", async () => {
    process.env.JWT_SECRET = "my-jwt-secret";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.PLATFORM_ADMIN_SECRET = "admin-secret";
    process.env.LENDER_API_KEY_SALT = "salt-value";
    process.env.STELLAR_NETWORK = "testnet";
    process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
    process.env.S3_BUCKET = "my-bucket";
    process.env.S3_REGION = "us-west-2";
    process.env.PORT = "8000";

    const { env: importEnv } = await import("../src/config/env.js");
    expect(importEnv.JWT_SECRET).toBe("my-jwt-secret");
    expect(importEnv.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(importEnv.PLATFORM_ADMIN_SECRET).toBe("admin-secret");
    expect(importEnv.PORT).toBe("8000");
  });
});
