import { authHandlers } from './auth';
import { decompositionHandlers } from './decomposition';
import { featureDetailHandlers } from './featureDetail';
import { featureHandlers } from './features';
import { intakeHandlers } from './intake';
import { projectHandlers } from './projects';

export const handlers = [
  ...authHandlers,
  ...projectHandlers,
  ...featureHandlers,
  ...featureDetailHandlers,
  ...intakeHandlers,
  ...decompositionHandlers,
];
