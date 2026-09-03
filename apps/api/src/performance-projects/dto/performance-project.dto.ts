import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PerformancePath, PerformanceWorkflowStatus } from "@actbyme/shared";

export class PerformanceCompanyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  website!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  type!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(160)
  contactName!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(160)
  contactRole!: string;
}

export class PerformanceLocationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  label!: string;

  @ApiProperty({ enum: ["remote", "manual", "google"] })
  @IsIn(["remote", "manual", "google"])
  provider!: "remote" | "manual" | "google";

  @ApiProperty()
  @IsBoolean()
  isRemote!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  placeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string | null;
}

export class PerformanceProjectDetailsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  type!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4000)
  objective!: string;

  @ApiProperty({ type: () => PerformanceLocationDto })
  @ValidateNested()
  @Type(() => PerformanceLocationDto)
  location!: PerformanceLocationDto;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  targetAiTool!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  language!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4000)
  notes!: string;
}

export class PerformanceBriefDto {
  @ApiProperty()
  @IsString()
  @MaxLength(12000)
  globalDirection!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  talentRequirements!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  @IsObject()
  capturePlan!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  qaCriteria!: string[];
}

export class PerformanceSceneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(120)
  duration!: string;

  @IsString()
  @MaxLength(2000)
  reference!: string;

  @IsString()
  @MaxLength(8000)
  dialogue!: string;

  @IsString()
  @MaxLength(8000)
  direction!: string;

  @IsString()
  @MaxLength(2000)
  bodyPosition!: string;

  @IsString()
  @MaxLength(2000)
  eyeline!: string;

  @IsString()
  @MaxLength(2000)
  gestures!: string;

  @IsString()
  @MaxLength(2000)
  framing!: string;

  @IsString()
  @MaxLength(8000)
  captureRequirements!: string;
}

export class SavePerformanceProjectDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => PerformanceCompanyDto)
  company!: PerformanceCompanyDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PerformanceProjectDetailsDto)
  project!: PerformanceProjectDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceBriefDto)
  brief?: PerformanceBriefDto;

  @ApiProperty({ type: [PerformanceSceneDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PerformanceSceneDto)
  scenes!: PerformanceSceneDto[];

  @ApiPropertyOptional({ enum: PerformancePath, nullable: true })
  @IsOptional()
  @IsEnum(PerformancePath)
  performerPath?: PerformancePath | null;

  @ApiProperty({ enum: PerformanceWorkflowStatus })
  @IsEnum(PerformanceWorkflowStatus)
  workflowStatus!: PerformanceWorkflowStatus;

  @ApiProperty({
    enum: ["company", "project", "review", "director", "brief", "source", "progress", "qa"],
  })
  @IsIn(["company", "project", "review", "director", "brief", "source", "progress", "qa"])
  currentStep!: string;
}

export class SelectPerformancePathDto {
  @ApiProperty({ enum: PerformancePath })
  @IsEnum(PerformancePath)
  performerPath!: PerformancePath;
}
