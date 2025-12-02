// Backlog routes

import type { BacklogSummary, Feature } from '@entropy/shared';
import { Router, type IRouter } from 'express';

export const backlogRouter: IRouter = Router();

// Get backlog summary with all views
backlogRouter.get('/', async (_req, res, next) => {
  try {
    // TODO: Fetch from database
    const summary: BacklogSummary = {
      nowPlaying: { name: 'Now Playing', features: [], count: 0 },
      readySoon: { name: 'Ready Soon', features: [], count: 0 },
      needsAttention: { name: 'Needs Attention', features: [], count: 0 },
      waiting: { name: 'Waiting', features: [], count: 0 },
    };

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// Get "Now Playing" features
backlogRouter.get('/now-playing', async (_req, res, next) => {
  try {
    const features: Feature[] = [];
    res.json({ features, count: 0 });
  } catch (error) {
    next(error);
  }
});

// Get "Ready Soon" features
backlogRouter.get('/ready-soon', async (_req, res, next) => {
  try {
    const features: Feature[] = [];
    res.json({ features, count: 0 });
  } catch (error) {
    next(error);
  }
});

// Get "Needs Attention" features
backlogRouter.get('/needs-attention', async (_req, res, next) => {
  try {
    const features: Feature[] = [];
    res.json({ features, count: 0 });
  } catch (error) {
    next(error);
  }
});

// Get "Waiting" features
backlogRouter.get('/waiting', async (_req, res, next) => {
  try {
    const features: Feature[] = [];
    res.json({ features, count: 0 });
  } catch (error) {
    next(error);
  }
});
