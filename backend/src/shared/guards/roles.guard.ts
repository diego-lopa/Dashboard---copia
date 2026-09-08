import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Acceso denegado: Usuario no autenticado');
    }

    // Role hierarchy: admin has full rights, operator can do operations, viewer read-only
    if (user.role === 'admin') return true;
    if (requiredRoles.includes(user.role)) return true;

    throw new ForbiddenException(
      `Acceso denegado: El rol '${user.role}' no tiene permisos suficientes para esta operación`,
    );
  }
}
