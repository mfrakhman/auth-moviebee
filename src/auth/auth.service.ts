import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(config.get('GOOGLE_CLIENT_ID'));
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email.toLowerCase());
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      displayName: dto.displayName,
    });
    return { accessToken: this.signJwt(user), user: this.toPublic(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { accessToken: this.signJwt(user), user: this.toPublic(user) };
  }

  async googleLogin(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.config.get('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException('Invalid Google token');

    const { sub, email, name, picture } = payload;
    if (!email) throw new UnauthorizedException('Google account has no email');

    let user = await this.users.findByGoogleSub(sub);

    if (!user) {
      user = await this.users.findByEmail(email.toLowerCase());
      if (user) {
        user = await this.users.linkGoogle(user.id, sub, picture);
      } else {
        user = await this.users.create({
          email: email.toLowerCase(),
          googleSub: sub,
          displayName: name,
          avatarUrl: picture,
        });
      }
    }

    return { accessToken: this.signJwt(user), user: this.toPublic(user) };
  }

  private signJwt(user: User) {
    return this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '7d') },
    );
  }

  toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}
