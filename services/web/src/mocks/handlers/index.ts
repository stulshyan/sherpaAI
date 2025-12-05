import { authHandlers } from './auth';
import { decompositionHandlers } from './decomposition';
import { featureDetailHandlers } from './featureDetail';
import { featureHandlers } from './features';
import { intakeHandlers } from './intake';
import { projectHandlers } from './projects';
import { settingsHandlers } from './settings';
import { testHarnessHandlers } from './testHarness';

export const handlers = [
  ...authHandlers,
  ...projectHandlers,
  ...featureHandlers,
  ...featureDetailHandlers,
  ...intakeHandlers,
  ...decompositionHandlers,
  ...settingsHandlers,
  ...testHarnessHandlers,
];
