import { authHandlers } from './auth';
import { decompositionHandlers } from './decomposition';
import { featureDetailHandlers } from './featureDetail';
import { featureHandlers } from './features';
import { healthHandlers } from './health';
import { intakeHandlers } from './intake';
import { projectHandlers } from './projects';
import { settingsHandlers } from './settings';

export const handlers = [
  ...authHandlers,
  ...projectHandlers,
  ...featureHandlers,
  ...featureDetailHandlers,
  ...healthHandlers,
  ...intakeHandlers,
  ...decompositionHandlers,
  ...settingsHandlers,
];
