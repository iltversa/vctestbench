import { createFullTestService } from "@/services/create-full-test";
import { requireUserIfEnabled } from "@/services/require-user";

export async function POST(req: Request) {
  try {
    await requireUserIfEnabled();

    const { title, description } = await req.json();

    if (!title || typeof title !== "string" || title.length > 200) {
      return Response.json(
        { error: "Test title is required (200 characters at most)" },
        { status: 400 }
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.length > 2000)) {
      return Response.json(
        { error: "Description must be text of 2000 characters or fewer" },
        { status: 400 }
      );
    }

    const test = await createFullTestService({
      title: title.trim(),
      description: description?.trim() || "",
      flow: [],
    });

    return Response.json({
      testId: test.id,
      success: true,
    });
  } catch (error) {
    console.error("Failed to create test:", error);
    if (error instanceof Error && error.message === "Sign in required") {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    return Response.json(
      { error: "Failed to create test" },
      { status: 500 }
    );
  }
}
