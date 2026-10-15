import {
  PaginationQuery,
  pageWindow,
  pageResult,
} from '../../common/pagination';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateComplaintDto, reporterId?: string) {
    const { website, ...data } = dto;
    if (website !== undefined && website !== '') {
      throw new BadRequestException('Unable to submit complaint.');
    }
    return this.prisma.complaint.create({
      data: { ...data, ...(reporterId ? { reporterId } : {}) },
    });
  }

  async findAll(query: PaginationQuery) {
    const rows = await this.prisma.complaint.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }

  async updateStatus(
    id: string,
    status: 'OPEN' | 'REVIEWING' | 'RESOLVED',
    adminNotes?: string,
  ) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    return this.prisma.complaint.update({
      where: { id },
      data: { status, ...(adminNotes !== undefined ? { adminNotes } : {}) },
    });
  }
}
