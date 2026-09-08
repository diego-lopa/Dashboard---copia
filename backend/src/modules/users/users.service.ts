import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(tenantId: string) {
    const res = await this.db.query(
      `SELECT id, email, role, enabled, created_at, updated_at 
       FROM users 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return res.rows;
  }

  async findOne(id: string, tenantId: string) {
    const res = await this.db.query(
      `SELECT id, email, role, enabled, created_at, updated_at 
       FROM users 
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return res.rows[0];
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.db.query('SELECT id FROM users WHERE email = $1', [
      dto.email.toLowerCase().trim(),
    ]);
    if (existing.rows.length > 0) {
      throw new ConflictException('El correo ya se encuentra registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const enabled = dto.enabled !== undefined ? dto.enabled : true;

    const res = await this.db.query(
      `INSERT INTO users (tenant_id, email, password_hash, role, enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, enabled, created_at, updated_at`,
      [tenantId, dto.email.toLowerCase().trim(), hashedPassword, dto.role, enabled],
    );

    return res.rows[0];
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    await this.findOne(id, tenantId);

    const updates: string[] = ['updated_at = now()'];
    const values: any[] = [id, tenantId];
    let paramIndex = 3;

    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(hashed);
    }
    if (dto.role) {
      updates.push(`role = $${paramIndex++}`);
      values.push(dto.role);
    }
    if (dto.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(dto.enabled);
    }

    const res = await this.db.query(
      `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, email, role, enabled, created_at, updated_at`,
      values,
    );

    return res.rows[0];
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.db.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return { success: true, message: 'Usuario eliminado correctamente' };
  }
}
