import { authHandlers } from './auth';
import { featureHandlers } from './features';
import { intakeHandlers } from './intake';
import { projectHandlers } from './projects';

export const handlers = [
  ...authHandlers,
  ...projectHandlers,
  ...featureHandlers,
  ...intakeHandlers,
];
