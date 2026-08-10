import type { getDb } from "../../../db";
import { notifications } from "../../../db/schema";

type WorkflowDb = ReturnType<typeof getDb>;

export async function notifyUsers(
  db: WorkflowDb,
  userIds: string[],
  notification: {
    type: string;
    title: string;
    message: string;
    recordId?: string;
    taskId?: string;
    requestId?: string;
  },
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  await db.insert(notifications).values(unique.map((userId) => ({ id: crypto.randomUUID(), userId, ...notification })));
}
