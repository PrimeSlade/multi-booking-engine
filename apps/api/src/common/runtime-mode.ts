export function isTestSimulationMode(): boolean {
  return process.env.NODE_ENV === 'test' && !process.env.JEST_WORKER_ID;
}
