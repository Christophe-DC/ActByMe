import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SkillCategory, VideoType, Visibility } from "@actbyme/shared";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";

export class AddActorVideoDto {
  @ApiProperty({ example: "Intro video" })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @ApiProperty({ example: "s3://bucket/key.mp4" })
  @IsString()
  videoUrl!: string;

  @ApiPropertyOptional({ example: "https://cdn.actbyme.test/thumb.jpg" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  thumbnailUrl?: string;

  @ApiProperty({ enum: VideoType })
  @IsEnum(VideoType)
  type!: VideoType;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.Public })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60 * 60)
  durationSeconds?: number;

  @ApiPropertyOptional({ enum: SkillCategory })
  @IsOptional()
  @IsEnum(SkillCategory)
  skillCategory?: SkillCategory;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
