import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { BookingGraphSchema, type BookingGraph } from '../graph.schema';
import { isTestSimulationMode } from '@/common/runtime-mode';

const YAML_CONFIG_FILENAME = 'booking-graph.yml';
const TEST_DECISION_TTL_MS = 15_000;

export default (): { bookingGraph: BookingGraph } => {
  const filePath =
    process.env.GRAPH_CONFIG_PATH || join(__dirname, YAML_CONFIG_FILENAME);

  const bookingGraph = BookingGraphSchema.parse(
    yaml.load(readFileSync(filePath, 'utf8')),
  );
  if (isTestSimulationMode()) {
    bookingGraph.itinerary.decisionTtlMs = TEST_DECISION_TTL_MS;
  }

  return {
    bookingGraph,
  };
};
