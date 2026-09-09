import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";

import type { Environment } from "#config";
import { AuthController } from "#controllers";
import { User } from "#entities";
import { JwtAuthGuard, RolesGuard } from "#guards";
import { AuthService } from "#services";
import { JwtStrategy } from "#strategies";

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get("jwtSecret", { infer: true }),
        signOptions: { expiresIn: 24 * 60 * 60 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtStrategy, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}