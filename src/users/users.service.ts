import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private repo: UsersRepository) {}

  findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  findByGoogleSub(googleSub: string) {
    return this.repo.findByGoogleSub(googleSub);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  create(data: Prisma.UserCreateInput) {
    return this.repo.create(data);
  }

  linkGoogle(id: string, googleSub: string, avatarUrl?: string) {
    return this.repo.linkGoogle(id, googleSub, avatarUrl);
  }
}
