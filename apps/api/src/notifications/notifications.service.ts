import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";

const publicNotificationSelect = {
  body: true,
  createdAt: true,
  id: true,
  link: true,
  metadata: true,
  performanceAssignmentId: true,
  readAt: true,
  title: true,
  type: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser): Promise<unknown> {
    return this.prisma.client.notification.findMany({
      orderBy: { createdAt: "desc" },
      select: publicNotificationSelect,
      take: 50,
      where: { userId: user.id },
    });
  }

  async unreadCount(user: AuthenticatedUser) {
    const count = await this.prisma.client.notification.count({
      where: { readAt: null, userId: user.id },
    });
    return { count };
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    const notification = await this.prisma.client.notification.findFirst({
      select: publicNotificationSelect,
      where: { id: notificationId, userId: user.id },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }
    if (notification.readAt) return notification;

    return this.prisma.client.notification.update({
      data: { readAt: new Date() },
      select: publicNotificationSelect,
      where: { id: notification.id },
    });
  }

  async markAllRead(user: AuthenticatedUser) {
    const result = await this.prisma.client.notification.updateMany({
      data: { readAt: new Date() },
      where: { readAt: null, userId: user.id },
    });
    return { count: result.count };
  }
}
