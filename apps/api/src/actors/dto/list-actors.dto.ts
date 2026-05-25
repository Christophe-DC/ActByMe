import { IsOptional, IsString, IsNumber, Min, Max, IsIn } from "class-validator";

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
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
