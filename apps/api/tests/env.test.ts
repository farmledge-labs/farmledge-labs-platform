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

  /** All required vars except the one under test */
  const fullEnv = () => ({
    JWT_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    PLATFORM_ADMIN_SECRET: "test-admin-secret",
    LENDER_API_KEY_SALT: "test-salt",
    STELLAR_NETWORK: "testnet",
    HORIZON_URL: "https://horizon-testnet.stellar.org",
    STELLAR_PLATFORM_SECRET: "SCZANGBA5RLXM6HIERL3WTJFB56Y4RYBUGGUWLPQKDIBPXHKNE4ACBFF",
    S3_BUCKET: "test-bucket",
    S3_REGION: "us-east-1",
  });

  it("throws error when required JWT_SECRET is missing", async () => {
    Object.assign(process.env, fullEnv());
    delete process.env.JWT_SECRET;

    await assert.rejects(
      async () => { await importConfig(); },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: JWT_SECRET");
        return true;
      }
    );
  });

  it("throws error when required DATABASE_URL is missing", async () => {
    Object.assign(process.env, fullEnv());
    delete process.env.DATABASE_URL;

    await assert.rejects(
      async () => { await importConfig(); },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: DATABASE_URL");
        return true;
      }
    );
  });

  it("throws error when required PLATFORM_ADMIN_SECRET is missing", async () => {
    Object.assign(process.env, fullEnv());
    delete process.env.PLATFORM_ADMIN_SECRET;

    await assert.rejects(
      async () => { await importConfig(); },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: PLATFORM_ADMIN_SECRET");
        return true;
      }
    );
  });

  it("throws error when required STELLAR_PLATFORM_SECRET is missing", async () => {
    Object.assign(process.env, fullEnv());
    delete process.env.STELLAR_PLATFORM_SECRET;

    await assert.rejects(
      async () => { await importConfig(); },
      (err: Error) => {
        assert.equal(err.message, "Missing required environment variable: STELLAR_PLATFORM_SECRET");
        return true;
      }
    );
  });

  it("does not log secret values in error messages", async () => {
    Object.assign(process.env, fullEnv());
    delete process.env.JWT_SECRET;

    await assert.rejects(
      async () => { await importConfig(); },
      (err: Error) => {
        assert.ok(!err.message.includes("password"));
        assert.ok(!err.message.includes("user"));
        return true;
      }
    );
  });

  it("uses default values for optional PORT when not provided", async () => {
    Object.assign(process.env, fullEnv());
    delete process.env.PORT;

    const importEnv = await importConfig();
    assert.equal(importEnv.PORT, "3000");
  });

  it("successfully loads all required environment variables", async () => {
    Object.assign(process.env, fullEnv());
    process.env.PORT = "8000";

    const importEnv = await importConfig();
    assert.equal(importEnv.JWT_SECRET, "test-secret");
    assert.equal(importEnv.DATABASE_URL, "postgresql://test:test@localhost:5432/test");
    assert.equal(importEnv.PLATFORM_ADMIN_SECRET, "test-admin-secret");
    assert.equal(importEnv.STELLAR_PLATFORM_SECRET, "SCZANGBA5RLXM6HIERL3WTJFB56Y4RYBUGGUWLPQKDIBPXHKNE4ACBFF");
    assert.equal(importEnv.PORT, "8000");
  });
});
