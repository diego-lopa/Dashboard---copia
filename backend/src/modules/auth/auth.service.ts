import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const res = await this.db.query(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role, u.enabled, t.name as tenant_name
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()],
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const user = res.rows[0];
    if (!user.enabled) {
      throw new UnauthorizedException('La cuenta de usuario está desactivada');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(user: any) {
    const payload = {
      sub: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
