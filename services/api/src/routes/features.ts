// Features routes

import type { Feature } from '@entropy/shared';
import { Router, type IRouter } from 'express';

export const featuresRouter: IRouter = Router();

// List features with filtering
featuresRouter.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    // TODO: Use status, minReadiness, search for filtering

    // TODO: Fetch from database with filters
    const features: Feature[] = [];

    res.json({
      data: features,
      total: 0,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      hasMore: false,
    });
  } catch (error) {
    next(error);
  }
});

// Get feature by ID
featuresRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Fetch from database
    res.json({
      id,
      status: 'pending',
      message: 'Not implemented yet',
    });
  } catch (error) {
    next(error);
  }
});

// Update feature
featuresRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // TODO: Update in database
    res.json({
      id,
      ...updates,
      message: 'Feature updated',
    });
  } catch (error) {
    next(error);
  }
});

// Approve feature for next loop
featuresRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Update status and start next loop
    res.json({
      id,
      status: 'approved',
      message: 'Feature approved for next loop',
    });
  } catch (error) {
    next(error);
  }
});

// Answer clarification question
featuresRouter.post('/:id/answer', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId } = req.body;

    // TODO: Store answer and recalculate readiness
    res.json({
      featureId: id,
      questionId,
      answered: true,
      message: 'Question answered',
    });
  } catch (error) {
    next(error);
  }
});
