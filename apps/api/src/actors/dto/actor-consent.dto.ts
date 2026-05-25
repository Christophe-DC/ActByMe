import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class AcceptActorConsentDto {
  @ApiProperty()
  @IsBoolean()
  publicProfileConsent!: boolean;

  @ApiProperty()
  @IsBoolean()
  marketingUsageConsent!: boolean;

  @ApiProperty()
  @IsBoolean()
  ownsUploadedContentConfirmation!: boolean;

  @ApiProperty()
  @IsBoolean()
  futurePaidWorkRequiresSeparateApproval!: boolean;
}
