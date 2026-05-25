import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { accessRequestSchema } from "@actbyme/shared";

@Controller("access-requests")
export class AccessRequestsController {
  @Post()
  create(@Body() body: unknown) {
    const result = accessRequestSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return {
      status: "accepted",
      request: result.data,
    };
  }
}
