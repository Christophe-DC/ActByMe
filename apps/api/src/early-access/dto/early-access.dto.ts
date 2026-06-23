import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateEarlyAccessSignupDto {
  @ApiProperty({ example: "creator@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: "homepage-under-construction" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;
}
