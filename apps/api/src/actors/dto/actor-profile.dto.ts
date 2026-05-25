import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class UpsertActorProfileDto {
  @ApiProperty({ example: "Maya Laurent" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  stageName!: string;

  @ApiPropertyOptional({ example: "Cinematic actor with dance-led motion range." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: "France" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiPropertyOptional({ example: "Paris" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: "https://cdn.actbyme.test/profile.jpg" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  profileImageUrl?: string;

  @ApiPropertyOptional({ example: "https://cdn.actbyme.test/hero.mp4" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  heroVideoUrl?: string;
}

export class UpdateActorProfileDto {
  @ApiPropertyOptional({ example: "Maya Laurent" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  stageName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  heroVideoUrl?: string;
}
