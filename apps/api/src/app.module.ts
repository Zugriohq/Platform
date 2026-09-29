import { LaneBController } from "./alpha/lane-b.controller.js";
import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from "@nestjs/common";
import { AlphaController } from "./alpha/alpha.controller.js";
import { DecisionCaseService } from "./alpha/decision-case.service.js";
import { ScenarioCatalog } from "./alpha/scenario-catalog.js";
import type { ApiConfig } from "./config.js";
import { HealthController } from "./health.controller.js";
import type { DecisionCaseStore } from "./persistence/decision-case-store.js";
import { MemoryDecisionCaseStore } from "./persistence/memory-decision-case-store.js";
import { PrismaDecisionCaseStore } from "./persistence/prisma-decision-case-store.js";
import { API_CONFIG, DECISION_CASE_STORE } from "./tokens.js";

export function createStore(config: ApiConfig): DecisionCaseStore {
  return config.persistence.kind === "postgres"
    ? new PrismaDecisionCaseStore(config.persistence.databaseUrl)
    : new MemoryDecisionCaseStore();
}

@Module({})
export class AppModule implements OnApplicationShutdown {
  constructor(@Inject(DECISION_CASE_STORE) private readonly store: DecisionCaseStore) {}

  static forRoot(config: ApiConfig, store: DecisionCaseStore = createStore(config)): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, AlphaController, LaneBController],
      providers: [
        { provide: API_CONFIG, useValue: config },
        { provide: DECISION_CASE_STORE, useValue: store },
        ScenarioCatalog,
        DecisionCaseService,
      ],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.store.close();
  }
}

