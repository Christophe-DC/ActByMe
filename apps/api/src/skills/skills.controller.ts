import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SKILL_CATEGORY_LABELS } from "@actbyme/shared";

@ApiTags("skills")
@Controller("skills")
export class SkillsController {
  @Get()
  findSkillCategories() {
    return Object.entries(SKILL_CATEGORY_LABELS).map(([value, label]) => ({
      label,
      value,
    }));
  }
}
