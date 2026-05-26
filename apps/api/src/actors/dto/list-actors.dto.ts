import { Type } from "class-transformer";
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from "class-validator";

export class ListActorsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  accent?: string;

  @IsOptional()
  @IsString()
  skill?: string;

  @IsOptional()
  @IsString()
  motionSkill?: string;

  @IsOptional()
  @IsIn(["featured", "score", "newest"])
  sort?: "featured" | "score" | "newest";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
