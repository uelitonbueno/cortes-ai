import { beforeAll, describe, expect, it } from "vitest";
import { pipelineCallback } from "./pipelineCallback";

function responseMock() {
  return { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
}

describe("pipeline callback authentication", () => {
  beforeAll(() => { process.env.PIPELINE_CALLBACK_TOKEN = "test-callback-token"; });
  it("rejects a wrong worker token", async () => {
    const response = responseMock();
    await pipelineCallback({ body: {}, header: () => "wrong-token" } as never, response as never);
    expect(response.statusCode).toBe(401);
  });

  it("accepts the configured token before validating payload", async () => {
    const response = responseMock();
    await pipelineCallback({ body: {}, header: () => "test-callback-token" } as never, response as never);
    expect(response.statusCode).toBe(400);
  });
});
