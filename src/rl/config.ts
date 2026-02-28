export interface RLConfig {
  enabled: boolean;
  serviceUrl: string;
  serviceTimeout: number;
  confidenceThreshold: number;
  collectInLLMMode: boolean;
  trainEveryNSteps: number;
  trainingBatchSteps: number;
  warmupSteps: number;
  reactiveLoopInterval: number;
  strategicLoopInterval: number;
}

export function loadRLConfig(): RLConfig {
  return {
    enabled: process.env.RL_ENABLED !== "false",
    serviceUrl: process.env.RL_SERVICE_URL ?? "http://localhost:8000",
    serviceTimeout: parseInt(process.env.RL_SERVICE_TIMEOUT ?? "2000", 10),
    confidenceThreshold: parseFloat(process.env.RL_CONFIDENCE_THRESHOLD ?? "0.6"),
    collectInLLMMode: true,
    trainEveryNSteps: 500,
    trainingBatchSteps: 100,
    warmupSteps: 1000,
    reactiveLoopInterval: 2000,
    strategicLoopInterval: 8000,
  };
}
