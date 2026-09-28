import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

export type PerformanceRequestEmailInput = {
  actorEmail: string;
  actorStageName: string;
  assignmentId: string;
  projectTitle: string;
  userId: string;
};

export type PerformanceRequestEmailResult = { sent: true } | { reason: string; sent: false };

@Injectable()
export class PerformanceRequestEmailService {
  private readonly logger = new Logger(PerformanceRequestEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: PerformanceRequestEmailInput): Promise<PerformanceRequestEmailResult> {
    const apiKey = this.config.get<string>("RESEND_API_KEY")?.trim();
    const from = this.config.get<string>("RESEND_FROM_EMAIL")?.trim();
    const webOrigin = resolveWebOrigin(
      this.config.get<string>("NEXT_PUBLIC_WEB_URL") ?? this.config.get<string>("WEB_ORIGIN"),
    );

    if (!apiKey || !from) {
      const reason = "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured";
      this.logger.warn(`Performance request email skipped: ${reason}.`);
      return { reason, sent: false };
    }
    if (!webOrigin) {
      const reason = "NEXT_PUBLIC_WEB_URL or WEB_ORIGIN is not configured with an HTTP(S) URL";
      this.logger.warn(`Performance request email skipped: ${reason}.`);
      return { reason, sent: false };
    }

    const email = buildPerformanceRequestEmail(input, webOrigin);
    const { error } = await new Resend(apiKey).emails.send(
      {
        from,
        html: email.html,
        subject: email.subject,
        text: email.text,
        to: input.actorEmail,
      },
      {
        idempotencyKey: `performance-request/${input.assignmentId}/${input.userId}`,
      },
    );

    if (error) {
      throw new Error(error.message);
    }
    return { sent: true };
  }
}

export function buildPerformanceRequestEmail(
  input: PerformanceRequestEmailInput,
  webOrigin: string,
) {
  const requestUrl = `${webOrigin}/performances/${input.assignmentId}`;
  const subject = `New ActByMe performance request — ${input.projectTitle}`;
  const actorStageName = escapeHtml(input.actorStageName);
  const projectTitle = escapeHtml(input.projectTitle);
  const escapedRequestUrl = escapeHtml(requestUrl);

  return {
    html: `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#0b0b0d;color:#f5f5f4;font-family:Arial,sans-serif;">
    <div lang="en" dir="ltr" style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;">New performance request</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e4e4e7;">Hi ${actorStageName},</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e4e4e7;">You’ve been selected for a new performance on ActByMe.</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#e4e4e7;"><strong>Project:</strong> ${projectTitle}</p>
      <a href="${escapedRequestUrl}" style="display:inline-block;min-height:44px;box-sizing:border-box;border-radius:10px;background:#fcd34d;color:#18181b;padding:13px 20px;font-size:16px;font-weight:700;text-decoration:none;">Review performance request</a>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#a1a1aa;">Sign in to ActByMe to review the private recording guide and respond.</p>
    </div>
  </body>
</html>`,
    requestUrl,
    subject,
    text: `Hi ${input.actorStageName},\n\nYou’ve been selected for a new performance on ActByMe.\n\nProject: ${input.projectTitle}\n\nReview performance request: ${requestUrl}\n\nSign in to ActByMe to review the private recording guide and respond.`,
  };
}

function resolveWebOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!,
  );
}
