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

export const BRIEF_ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const MAX_BRIEF_ATTACHMENT_BYTES = 20_000_000;

export class CreatePerformanceBriefAttachmentUploadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  @Matches(/\.(pdf|docx|txt)$/i, {
    message: "fileName must end in .pdf, .docx, or .txt",
  })
  fileName!: string;

  @ApiProperty({ enum: BRIEF_ATTACHMENT_CONTENT_TYPES })
  @IsIn(BRIEF_ATTACHMENT_CONTENT_TYPES)
  contentType!: (typeof BRIEF_ATTACHMENT_CONTENT_TYPES)[number];

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(MAX_BRIEF_ATTACHMENT_BYTES)
  sizeBytes!: number;
}

export class CompletePerformanceBriefAttachmentUploadDto {
  @ApiProperty()
  @IsUUID()
  uploadAttemptId!: string;
}

export class FailPerformanceBriefAttachmentUploadDto extends CompletePerformanceBriefAttachmentUploadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
