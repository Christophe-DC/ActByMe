import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ActorLanguageItemDto {
  @ApiProperty({ example: "English" })
  @IsString()
  @MaxLength(80)
  language!: string;

  @ApiPropertyOptional({ example: "Fluent" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  proficiency?: string;
}

export class AddActorLanguagesDto {
  @ApiProperty({ type: [ActorLanguageItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ActorLanguageItemDto)
  languages!: ActorLanguageItemDto[];
}

export class AddActorAccentsDto {
  @ApiProperty({ example: ["General American", "French"] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  accents!: string[];
}
