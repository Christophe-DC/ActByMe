import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { buildPerformanceRequestEmail } from "./performance-request-email.service.js";

type StoredNotification = {
  id: string;
  userId: string;
  readAt: Date | null;
  createdAt: Date;
};

function notificationHarness() {
  const notifications: StoredNotification[] = [
    { id: "notification-actor", userId: "actor", readAt: null, createdAt: new Date("2026-09-28") },
    { id: "notification-other", userId: "other", readAt: null, createdAt: new Date("2026-09-27") },
  ];
  const matches = (item: StoredNotification, where: Record<string, unknown>) =>
    (where.id === undefined || item.id === where.id) &&
    (where.userId === undefined || item.userId === where.userId) &&
    (where.readAt === undefined || item.readAt === where.readAt);
  const prisma = {
    client: {
      notification: {
        count: async ({ where }: { where: Record<string, unknown> }) =>
          notifications.filter((item) => matches(item, where)).length,
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          notifications.find((item) => matches(item, where)) ?? null,
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          notifications.filter((item) => matches(item, where)),
        update: async ({ data, where }: { data: { readAt: Date }; where: { id: string } }) => {
          const item = notifications.find((candidate) => candidate.id === where.id)!;
          item.readAt = data.readAt;
          return item;
        },
        updateMany: async ({
          data,
          where,
        }: {
          data: { readAt: Date };
          where: Record<string, unknown>;
        }) => {
          const items = notifications.filter((item) => matches(item, where));
          items.forEach((item) => (item.readAt = data.readAt));
          return { count: items.length };
        },
      },
    },
  };
  return { notifications, service: new NotificationsService(prisma as never) };
}

test("notifications are listed and counted only for their authenticated owner", async () => {
  const { service } = notificationHarness();
  const actor = { id: "actor" } as never;
  const other = { id: "other" } as never;

  assert.deepEqual(
    ((await service.findAll(actor)) as StoredNotification[]).map((item) => item.id),
    ["notification-actor"],
  );
  assert.deepEqual(
    ((await service.findAll(other)) as StoredNotification[]).map((item) => item.id),
    ["notification-other"],
  );
  assert.deepEqual(await service.unreadCount(actor), { count: 1 });
  await assert.rejects(() => service.markRead(actor, "notification-other"), NotFoundException);
});

test("marking a notification read updates the unread count", async () => {
  const { service } = notificationHarness();
  const actor = { id: "actor" } as never;

  await service.markRead(actor, "notification-actor");
  assert.deepEqual(await service.unreadCount(actor), { count: 0 });
});

test("performance request email contains the assignment URL and never the creator AI prompt", () => {
  const email = buildPerformanceRequestEmail(
    {
      actorEmail: "actor@example.com",
      actorStageName: "Alex Stage",
      assignmentId: "assignment-123",
      projectTitle: "Autumn Campaign",
      userId: "actor-user",
      aiEnginePrompt: "CREATOR_ONLY_SECRET_PROMPT",
    } as never,
    "https://actbyme.example",
  );

  assert.equal(email.requestUrl, "https://actbyme.example/performances/assignment-123");
  assert.match(email.html, /Review performance request/);
  assert.match(email.text, /\/performances\/assignment-123/);
  assert.doesNotMatch(email.html, /CREATOR_ONLY_SECRET_PROMPT/);
  assert.doesNotMatch(email.text, /CREATOR_ONLY_SECRET_PROMPT/);
});
