import { createFullTestService } from "@/services/create-full-test";

export async function POST(req: Request) {
  try {
    const { title, description } = await req.json();

    if (!title || typeof title !== "string") {
      return Response.json(
        { error: "Test title is required" },
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
    return Response.json(
      { error: "Failed to create test" },
      { status: 500 }
    );
  }
}
