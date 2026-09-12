import { Module } from "@nestjs/common";

import { ClientLogsController, HealthController } from "#controllers";
import { BetterStackLogger } from "#services";

@Module({
	controllers: [ClientLogsController, HealthController],
	exports: [BetterStackLogger],
	providers: [BetterStackLogger],
})
export class HealthModule {}