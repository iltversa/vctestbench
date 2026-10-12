import { getChatGPTUser } from "@/app/chatgpt-auth";

// Server actions are public POST endpoints. Set REQUIRE_AUTH=true on a hosted
// deployment to reject callers that carry no signed-in user. Local development
// stays open because there is no identity header on localhost.
export async function requireUserIfEnabled(): Promise<void> {
  if (process.env.REQUIRE_AUTH !== "true") return;

  const user = await getChatGPTUser();
  if (!user) {
    throw new Error("Sign in required");
  }
}
