import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SkillCategory } from "@actbyme/shared";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class ActorSkillItemDto {
  @ApiProperty({ enum: SkillCategory })
  @IsEnum(SkillCategory)
  category!: SkillCategory;

  @ApiPropertyOptional({ example: "Contemporary dance" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number;
}

export class AddActorSkillsDto {
  @ApiProperty({ type: [ActorSkillItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ActorSkillItemDto)
  skills!: ActorSkillItemDto[];
}
