import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreatePerformanceTakeUploadDto {
  @ApiProperty({ example: "living-room-take.mp4" })
  @IsString()
  @MaxLength(180)
  @Matches(/\.(mp4|mov)$/i, { message: "Only MP4 and MOV files are supported." })
  fileName!: string;

  @ApiProperty({ enum: ["video/mp4", "video/quicktime"] })
  @IsIn(["video/mp4", "video/quicktime"])
  contentType!: "video/mp4" | "video/quicktime";

  @ApiProperty({ example: 12500000 })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  sizeBytes!: number;
}

export class CompletePerformanceTakeUploadDto {
  @ApiProperty()
  @IsUUID()
  uploadAttemptId!: string;
}

export class FailPerformanceTakeUploadDto extends CompletePerformanceTakeUploadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
