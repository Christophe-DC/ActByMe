import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectActorDto {
  @ApiPropertyOptional({ example: "Profile needs clearer video consent." })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  reason?: string;
}
