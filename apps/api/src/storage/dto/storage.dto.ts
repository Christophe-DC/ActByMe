import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UploadUrlRequestDto {
  @ApiProperty({ example: "intro-video.mp4" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: "video/mp4" })
  @IsString()
  @MaxLength(120)
  contentType!: string;

  @ApiProperty({ enum: ["actor-video", "actor-image"] })
  @IsIn(["actor-video", "actor-image"])
  namespace!: "actor-video" | "actor-image";
}

export class ReadUrlRequestDto {
  @ApiProperty({ example: "actor-video/mock-key.mp4" })
  @IsString()
  @MaxLength(240)
  key!: string;

  @ApiPropertyOptional({ example: "Actor intro video" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
