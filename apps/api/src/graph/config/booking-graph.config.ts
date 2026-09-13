import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { BookingGraphSchema, type BookingGraph } from '../graph.schema';

const YAML_CONFIG_FILENAME = 'booking-graph.yml';

export default (): { bookingGraph: BookingGraph } => {
  const filePath =
    process.env.GRAPH_CONFIG_PATH || join(__dirname, YAML_CONFIG_FILENAME);

  const rawConfig = yaml.load(readFileSync(filePath, 'utf8'));

  return {
    bookingGraph: BookingGraphSchema.parse(rawConfig),
  };
};
