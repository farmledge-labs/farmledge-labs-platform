import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("Environment Validation", () => {
  const originalEnv = { ...process.env };
  let importCount = 0;

  const importConfig = async () => {
    const { env } = await import(`../src/config/env.js?update=${importCount++}`);
    return env;
  };

  beforeEach(() => {
    // Clear and restore process.env to clean state
    process.env = { ...originalEnv };
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

    await assert.rejects(
      async () => {
        await importConfig();
      },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: JWT_SECRET");
        return true;
      }
    );
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

    await assert.rejects(
      async () => {
        await importConfig();
      },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: DATABASE_URL");
        return true;
      }
    );
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

    await assert.rejects(
      async () => {
        await importConfig();
      },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: PLATFORM_ADMIN_SECRET");
        return true;
      }
    );
  });

  it("does not log secret values in error messages", async () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = "postgresql://user:password@localhost/db";

    await assert.rejects(
      async () => {
        await importConfig();
      },
      (err: Error) => {
        assert.ok(!err.message.includes("password"));
        assert.ok(!err.message.includes("user"));
        return true;
      }
    );
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

    const importEnv = await importConfig();
    assert.equal(importEnv.PORT, "3000");
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

    const importEnv = await importConfig();
    assert.equal(importEnv.JWT_SECRET, "my-jwt-secret");
    assert.equal(importEnv.DATABASE_URL, "postgresql://user:pass@localhost:5432/db");
    assert.equal(importEnv.PLATFORM_ADMIN_SECRET, "admin-secret");
    assert.equal(importEnv.PORT, "8000");
  });
});
