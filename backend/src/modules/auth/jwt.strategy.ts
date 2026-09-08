import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../shared/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    const result = await this.db.query(
      'SELECT id, tenant_id, email, role, enabled FROM users WHERE id = $1',
      [payload.sub],
    );

    if (result.rows.length === 0 || !result.rows[0].enabled) {
      throw new UnauthorizedException('Usuario no válido o deshabilitado');
    }

    const user = result.rows[0];
    return {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    };
  }
}
