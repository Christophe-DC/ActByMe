import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateEarlyAccessSignupDto } from "./dto/early-access.dto.js";
import { EarlyAccessService } from "./early-access.service.js";

@ApiTags("early access")
@Controller("early-access")
export class EarlyAccessController {
  constructor(private readonly earlyAccess: EarlyAccessService) {}

  @Post()
  @ApiOperation({ summary: "Capture an email for the temporary early access homepage" })
  create(@Body() dto: CreateEarlyAccessSignupDto): Promise<unknown> {
    return this.earlyAccess.create(dto);
  }
}
