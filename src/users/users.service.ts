import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    })
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async createUser(data: {
    email: string
    password: string
    firstName?: string
    lastName?: string
  }) {
    return this.prisma.user.create({
      data,
    })
  }

  async updateUser(id: string, data: { firstName?: string; lastName?: string }) {
    return this.prisma.user.update({ where: { id }, data })
  }

  async updatePassword(id: string, hashedPassword: string) {
    return this.prisma.user.update({ where: { id }, data: { password: hashedPassword } })
  }
}