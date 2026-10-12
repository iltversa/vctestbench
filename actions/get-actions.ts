"use server";

import { getActionsService } from "@/services/get-test-actions";
import { requireUserIfEnabled } from "@/services/require-user";

export default async function getActionsAction() {
    try {
        await requireUserIfEnabled();
        const actions = await getActionsService();
        return { success: true, data: actions };

    } catch (error) {
        console.log("getActionsAction error:", error);
        return { success: false, data: [], message: error instanceof Error ? error.message : "Failed to fetch actions." };
    }
}
