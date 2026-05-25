import { Injectable, NotFoundException } from "@nestjs/common";
import { AgencyRequestStatus } from "@actbyme/shared";
import { PrismaService } from "../database/prisma.service.js";
import type {
  CreateAgencyAccessRequestDto,
  UpdateAgencyRequestStatusDto,
} from "./dto/agency-access.dto.js";

@Injectable()
export class AgencyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgencyAccessRequestDto): Promise<unknown> {
    const request = await this.prisma.client.agencyAccessRequest.create({
      data: {
        ...dto,
        status: AgencyRequestStatus.New,
      },
    });

    await this.prisma.audit({
      action: "AGENCY_REQUEST_SUBMITTED",
      entityId: request.id,
      entityType: "AgencyAccessRequest",
      metadata: {
        companyName: request.companyName,
        email: request.email,
      },
    });

    return request;
  }

  async findOne(id: string): Promise<unknown> {
    const request = await this.prisma.client.agencyAccessRequest.findUnique({
      where: {
        id,
      },
    });

    if (!request) {
      throw new NotFoundException("Agency access request not found.");
    }

    return request;
  }

  findAll(): Promise<unknown> {
    return this.prisma.client.agencyAccessRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async updateStatus(id: string, dto: UpdateAgencyRequestStatusDto): Promise<unknown> {
    await this.findOne(id);

    return this.prisma.client.agencyAccessRequest.update({
      data: {
        status: dto.status,
      },
      where: {
        id,
      },
    });
  }
}
