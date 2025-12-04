import { authHandlers } from './auth';
import { decompositionHandlers } from './decomposition';
import { featureHandlers } from './features';
import { featureDetailHandlers } from './featureDetail';
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
