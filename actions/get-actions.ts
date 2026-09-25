"use server";

import { getActionsService } from "@/services/get-test-actions";

export default async function getActionsAction() {
    try {
        const actions = await getActionsService();
        return { success: true, data: actions };

    } catch (error) {
        console.log("getActionsAction error:", error);
        return { success: false, data: [], message: error instanceof Error ? error.message : "Failed to fetch actions." };
    }
}
