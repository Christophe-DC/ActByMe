import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { AgencyRequestStatus } from "@actbyme/shared";

export class CreateAgencyAccessRequestDto {
  @ApiProperty({ example: "Alex Morgan" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "Northstar Studio" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @ApiPropertyOptional({ example: "Creative director" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @ApiProperty({ example: "alex@northstar.example" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "https://northstar.example" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @ApiPropertyOptional({ example: "United States" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  needs!: string;

  @ApiPropertyOptional({ example: "6-20 videos / month" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  expectedMonthlyVolume?: string;

  @ApiProperty({ example: ["UGC actors", "Voice/accent"] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  interestedSkills!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  message?: string;
}

export class UpdateAgencyRequestStatusDto {
  @ApiProperty({ enum: AgencyRequestStatus })
  @IsEnum(AgencyRequestStatus)
  status!: AgencyRequestStatus;
}
