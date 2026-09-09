import { type Environment } from "#config";
import type { JwtPayload } from "#contracts";
import { User } from "#entities";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Environment, true>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("jwtSecret", { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.users.findOneBy({ id: payload.sub, isActive: true });
    if (!user) throw new UnauthorizedException("Account is inactive or unavailable");
    return user;
  }
}