import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { UUID } from '../types';

export interface PromptTemplate {
  id: string;
  template: string;
  variables: string[];
  systemInstructions?: string;
}

export interface IAIService {
  generateText(promptId: string, variables: Record<string, string>): Promise<Result<string>>;
  generateStructured<T>(promptId: string, variables: Record<string, string>, schema: any): Promise<Result<T>>;
}

export interface IRecommendationEngine {
  getRecommendationsForUser(userId: UUID, category: string): Promise<Result<any[]>>;
  getRecommendationsForEntity(entityId: UUID, entityType: string): Promise<Result<any[]>>;
}

export interface IPredictionEngine {
  predictTrend(historicalData: any[], steps: number): Promise<Result<any>>;
  predictCompletionTime(entityId: UUID, entityType: string): Promise<Result<number>>;
}

export interface ISummaryEngine {
  summarizeText(text: string, maxWords?: number): Promise<Result<string>>;
  summarizeTimeline(timelineEntries: any[]): Promise<Result<string>>;
}

export interface IPromptRegistry {
  registerPrompt(prompt: PromptTemplate): void;
  getPrompt(id: string): PromptTemplate | null;
}

export const AI_SERVICE_TOKEN = createToken<IAIService>('AIService');
export const RECOMMENDATION_ENGINE_TOKEN = createToken<IRecommendationEngine>('RecommendationEngine');
export const PREDICTION_ENGINE_TOKEN = createToken<IPredictionEngine>('PredictionEngine');
export const SUMMARY_ENGINE_TOKEN = createToken<ISummaryEngine>('SummaryEngine');
export const PROMPT_REGISTRY_TOKEN = createToken<IPromptRegistry>('PromptRegistry');

export class MockAIService implements IAIService {
  async generateText(): Promise<Result<string>> {
    return Ok('AI Text Generation Stub');
  }
  async generateStructured<T>(): Promise<Result<T>> {
    return Ok({} as T);
  }
}

export class MockRecommendationEngine implements IRecommendationEngine {
  async getRecommendationsForUser(): Promise<Result<any[]>> {
    return Ok([]);
  }
  async getRecommendationsForEntity(): Promise<Result<any[]>> {
    return Ok([]);
  }
}

export class MockPredictionEngine implements IPredictionEngine {
  async predictTrend(): Promise<Result<any>> {
    return Ok({});
  }
  async predictCompletionTime(): Promise<Result<number>> {
    return Ok(0);
  }
}

export class MockSummaryEngine implements ISummaryEngine {
  async summarizeText(): Promise<Result<string>> {
    return Ok('Summary Stub');
  }
  async summarizeTimeline(): Promise<Result<string>> {
    return Ok('Timeline Summary Stub');
  }
}

export class MockPromptRegistry implements IPromptRegistry {
  private prompts = new Map<string, PromptTemplate>();
  registerPrompt(prompt: PromptTemplate): void {
    this.prompts.set(prompt.id, prompt);
  }
  getPrompt(id: string): PromptTemplate | null {
    return this.prompts.get(id) ?? null;
  }
}
