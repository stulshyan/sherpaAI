#!/usr/bin/env npx tsx
/**
 * Demo Data Generator (S-054)
 *
 * Creates realistic demo data including projects, requirements, features,
 * clarification questions, and feature dependencies.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts           # Seed demo data
 *   npx tsx scripts/seed-demo.ts --clean   # Clean and re-seed
 *   npx tsx scripts/seed-demo.ts --env staging  # Seed to staging
 *
 * @see Epic E-009: End-to-End Integration
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface SeedOptions {
  clean: boolean;
  env: 'local' | 'staging';
  verbose: boolean;
}

interface DemoProject {
  id: string;
  name: string;
  description: string;
  client_id: string;
  tech_stack: string[];
  status: 'active' | 'paused' | 'completed' | 'archived';
  wip_limit: number;
  is_demo_data: boolean;
}

interface DemoRequirement {
  id: string;
  project_id: string;
  title: string;
  source_type: 'document' | 'api' | 'manual';
  source_file_s3_key: string;
  type: 'new_feature' | 'enhancement' | 'epic' | 'bug_fix' | 'unknown';
  type_confidence: number;
  status:
    | 'uploaded'
    | 'extracting'
    | 'extracted'
    | 'classifying'
    | 'classified'
    | 'decomposing'
    | 'decomposed'
    | 'failed';
}

interface DemoFeature {
  id: string;
  requirement_id: string;
  project_id: string;
  title: string;
  description: string;
  feature_type: 'new_feature' | 'enhancement' | 'bug_fix' | 'epic' | 'technical';
  status:
    | 'draft'
    | 'needs_clarification'
    | 'ready'
    | 'in_progress'
    | 'completed'
    | 'blocked'
    | 'cancelled';
  priority_score: number;
  readiness_score: number;
  complexity_score: number;
  business_value: number;
  urgency_score: number;
  current_loop: 'loop_0' | 'loop_a' | 'loop_b' | 'loop_c' | null;
  theme: string;
}

interface DemoFeatureReadiness {
  feature_id: string;
  business_clarity: number;
  technical_clarity: number;
  testability: number;
  ambiguity_score: number;
}

interface DemoClarificationQuestion {
  id: string;
  feature_id: string;
  question: string;
  question_type: 'multiple_choice' | 'yes_no' | 'text' | 'dropdown';
  options: string[];
  answer: string | null;
  priority: 'blocking' | 'important' | 'nice_to_have';
}

interface DemoFeatureDependency {
  feature_id: string;
  depends_on_feature_id: string;
  dependency_type: 'blocks' | 'related' | 'parent';
  description: string;
}

interface DemoAtomicRequirement {
  id: string;
  feature_id: string;
  text: string;
  theme: string;
  clarity_score: number;
  sequence_order: number;
}

// ============================================================================
// Demo Data Definitions
// ============================================================================

// IDs are deterministic for idempotency
const DEMO_CLIENT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

const DEMO_PROJECT_IDS = {
  ecommerce: 'demo-0001-0000-0000-000000000001',
  banking: 'demo-0002-0000-0000-000000000002',
};

const DEMO_REQUIREMENT_IDS = {
  ecommerce_main: 'demo-req1-0000-0000-000000000001',
  ecommerce_phase2: 'demo-req2-0000-0000-000000000002',
  ecommerce_phase3: 'demo-req3-0000-0000-000000000003',
  banking_main: 'demo-req4-0000-0000-000000000004',
};

const DEMO_FEATURE_IDS = {
  // E-Commerce Project Features
  user_auth: 'demo-feat-0001-0000-000000000001',
  product_catalog: 'demo-feat-0002-0000-000000000002',
  shopping_cart: 'demo-feat-0003-0000-000000000003',
  payment_gateway: 'demo-feat-0004-0000-000000000004',
  order_management: 'demo-feat-0005-0000-000000000005',
  inventory_sync: 'demo-feat-0006-0000-000000000006',
  email_notifications: 'demo-feat-0007-0000-000000000007',
  analytics_dashboard: 'demo-feat-0008-0000-000000000008',
  // Mobile Banking Project Features
  account_overview: 'demo-feat-0009-0000-000000000009',
  fund_transfer: 'demo-feat-0010-0000-000000000010',
  bill_payment: 'demo-feat-0011-0000-000000000011',
  security_settings: 'demo-feat-0012-0000-000000000012',
};

const DEMO_PROJECTS: DemoProject[] = [
  {
    id: DEMO_PROJECT_IDS.ecommerce,
    name: 'E-Commerce Platform Rebuild',
    description:
      'Complete rewrite of legacy e-commerce platform with modern architecture, microservices, and improved UX. Target launch Q2 2025.',
    client_id: DEMO_CLIENT_ID,
    tech_stack: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'Stripe', 'AWS'],
    status: 'active',
    wip_limit: 3,
    is_demo_data: true,
  },
  {
    id: DEMO_PROJECT_IDS.banking,
    name: 'Mobile Banking App',
    description:
      'New mobile banking application with modern UX, biometric authentication, and real-time notifications.',
    client_id: DEMO_CLIENT_ID,
    tech_stack: ['React Native', 'TypeScript', 'Node.js', 'PostgreSQL', 'Plaid'],
    status: 'active',
    wip_limit: 2,
    is_demo_data: true,
  },
];

const DEMO_REQUIREMENTS: DemoRequirement[] = [
  {
    id: DEMO_REQUIREMENT_IDS.ecommerce_main,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'E-Commerce Platform Core Requirements',
    source_type: 'document',
    source_file_s3_key: `projects/${DEMO_PROJECT_IDS.ecommerce}/requirements/core-requirements.pdf`,
    type: 'epic',
    type_confidence: 0.95,
    status: 'decomposed',
  },
  {
    id: DEMO_REQUIREMENT_IDS.ecommerce_phase2,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Payment and Order Processing Requirements',
    source_type: 'document',
    source_file_s3_key: `projects/${DEMO_PROJECT_IDS.ecommerce}/requirements/payment-requirements.pdf`,
    type: 'new_feature',
    type_confidence: 0.88,
    status: 'decomposed',
  },
  {
    id: DEMO_REQUIREMENT_IDS.ecommerce_phase3,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Analytics and Reporting Enhancement',
    source_type: 'document',
    source_file_s3_key: `projects/${DEMO_PROJECT_IDS.ecommerce}/requirements/analytics-requirements.pdf`,
    type: 'enhancement',
    type_confidence: 0.92,
    status: 'decomposing',
  },
  {
    id: DEMO_REQUIREMENT_IDS.banking_main,
    project_id: DEMO_PROJECT_IDS.banking,
    title: 'Mobile Banking Core Features',
    source_type: 'document',
    source_file_s3_key: `projects/${DEMO_PROJECT_IDS.banking}/requirements/banking-features.pdf`,
    type: 'epic',
    type_confidence: 0.91,
    status: 'decomposed',
  },
];

const DEMO_FEATURES: DemoFeature[] = [
  // E-Commerce Project Features
  {
    id: DEMO_FEATURE_IDS.user_auth,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_main,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'User Authentication',
    description:
      'Implement secure user login with OAuth2 providers (Google, Microsoft), JWT tokens, session management, and refresh token rotation. Includes MFA support.',
    feature_type: 'new_feature',
    status: 'ready',
    priority_score: 92,
    readiness_score: 92,
    complexity_score: 65,
    business_value: 95,
    urgency_score: 90,
    current_loop: 'loop_a',
    theme: 'Security',
  },
  {
    id: DEMO_FEATURE_IDS.product_catalog,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_main,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Product Catalog',
    description:
      'Build a comprehensive product catalog with categories, search, filtering, and product detail pages. Support for variants, pricing tiers, and inventory display.',
    feature_type: 'new_feature',
    status: 'ready',
    priority_score: 88,
    readiness_score: 88,
    complexity_score: 70,
    business_value: 90,
    urgency_score: 85,
    current_loop: 'loop_a',
    theme: 'Commerce',
  },
  {
    id: DEMO_FEATURE_IDS.shopping_cart,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_main,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Shopping Cart',
    description:
      'Implement shopping cart functionality with add/remove items, quantity updates, saved carts, and guest checkout support.',
    feature_type: 'new_feature',
    status: 'in_progress',
    priority_score: 85,
    readiness_score: 75,
    complexity_score: 55,
    business_value: 88,
    urgency_score: 80,
    current_loop: 'loop_a',
    theme: 'Commerce',
  },
  {
    id: DEMO_FEATURE_IDS.payment_gateway,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_phase2,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Payment Gateway Integration',
    description:
      'Integrate with Stripe for payment processing including credit cards, Apple Pay, Google Pay. Handle subscriptions and refunds.',
    feature_type: 'new_feature',
    status: 'needs_clarification',
    priority_score: 82,
    readiness_score: 65,
    complexity_score: 75,
    business_value: 92,
    urgency_score: 75,
    current_loop: 'loop_0',
    theme: 'Payments',
  },
  {
    id: DEMO_FEATURE_IDS.order_management,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_phase2,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Order Management System',
    description:
      'Build order processing workflow including order creation, status tracking, fulfillment integration, and order history.',
    feature_type: 'new_feature',
    status: 'draft',
    priority_score: 78,
    readiness_score: 45,
    complexity_score: 80,
    business_value: 85,
    urgency_score: 70,
    current_loop: 'loop_0',
    theme: 'Commerce',
  },
  {
    id: DEMO_FEATURE_IDS.inventory_sync,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_main,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Inventory Synchronization',
    description:
      'Real-time inventory sync with warehouse management system. Handle stock updates, low stock alerts, and backorder management.',
    feature_type: 'new_feature',
    status: 'blocked',
    priority_score: 75,
    readiness_score: 70,
    complexity_score: 70,
    business_value: 80,
    urgency_score: 65,
    current_loop: null,
    theme: 'Operations',
  },
  {
    id: DEMO_FEATURE_IDS.email_notifications,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_main,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Email Notification System',
    description:
      'Transactional email system for order confirmations, shipping updates, password resets, and marketing emails with template management.',
    feature_type: 'new_feature',
    status: 'completed',
    priority_score: 70,
    readiness_score: 95,
    complexity_score: 50,
    business_value: 75,
    urgency_score: 60,
    current_loop: 'loop_c',
    theme: 'Communication',
  },
  {
    id: DEMO_FEATURE_IDS.analytics_dashboard,
    requirement_id: DEMO_REQUIREMENT_IDS.ecommerce_phase3,
    project_id: DEMO_PROJECT_IDS.ecommerce,
    title: 'Analytics Dashboard',
    description:
      'Business intelligence dashboard with sales metrics, conversion funnels, customer analytics, and custom report builder.',
    feature_type: 'enhancement',
    status: 'completed',
    priority_score: 68,
    readiness_score: 98,
    complexity_score: 65,
    business_value: 78,
    urgency_score: 55,
    current_loop: 'loop_c',
    theme: 'Analytics',
  },

  // Mobile Banking Project Features
  {
    id: DEMO_FEATURE_IDS.account_overview,
    requirement_id: DEMO_REQUIREMENT_IDS.banking_main,
    project_id: DEMO_PROJECT_IDS.banking,
    title: 'Account Overview',
    description:
      'Dashboard showing account balances, recent transactions, and account summaries. Support for multiple account types.',
    feature_type: 'new_feature',
    status: 'ready',
    priority_score: 90,
    readiness_score: 90,
    complexity_score: 45,
    business_value: 95,
    urgency_score: 88,
    current_loop: 'loop_a',
    theme: 'Core Banking',
  },
  {
    id: DEMO_FEATURE_IDS.fund_transfer,
    requirement_id: DEMO_REQUIREMENT_IDS.banking_main,
    project_id: DEMO_PROJECT_IDS.banking,
    title: 'Fund Transfer',
    description:
      'Transfer funds between accounts, to other users, and external bank accounts. Support for scheduled and recurring transfers.',
    feature_type: 'new_feature',
    status: 'needs_clarification',
    priority_score: 85,
    readiness_score: 70,
    complexity_score: 70,
    business_value: 90,
    urgency_score: 82,
    current_loop: 'loop_0',
    theme: 'Transactions',
  },
  {
    id: DEMO_FEATURE_IDS.bill_payment,
    requirement_id: DEMO_REQUIREMENT_IDS.banking_main,
    project_id: DEMO_PROJECT_IDS.banking,
    title: 'Bill Payment',
    description:
      'Pay bills to registered billers, manage payees, and schedule automatic payments. Support for bill reminders.',
    feature_type: 'new_feature',
    status: 'draft',
    priority_score: 78,
    readiness_score: 50,
    complexity_score: 60,
    business_value: 80,
    urgency_score: 70,
    current_loop: 'loop_0',
    theme: 'Transactions',
  },
  {
    id: DEMO_FEATURE_IDS.security_settings,
    requirement_id: DEMO_REQUIREMENT_IDS.banking_main,
    project_id: DEMO_PROJECT_IDS.banking,
    title: 'Security Settings',
    description:
      'User security preferences including biometric login, PIN management, device management, and security alerts configuration.',
    feature_type: 'new_feature',
    status: 'draft',
    priority_score: 72,
    readiness_score: 30,
    complexity_score: 55,
    business_value: 85,
    urgency_score: 65,
    current_loop: null,
    theme: 'Security',
  },
];

const DEMO_FEATURE_READINESS: DemoFeatureReadiness[] = DEMO_FEATURES.map((f) => ({
  feature_id: f.id,
  business_clarity: Math.min(100, f.readiness_score + Math.floor(Math.random() * 10) - 5),
  technical_clarity: Math.min(100, f.readiness_score + Math.floor(Math.random() * 10) - 5),
  testability: Math.min(100, f.readiness_score + Math.floor(Math.random() * 10) - 5),
  ambiguity_score: Math.max(0, 100 - f.readiness_score) / 100,
}));

const DEMO_QUESTIONS: DemoClarificationQuestion[] = [
  // Payment Gateway questions (2 pending)
  {
    id: 'demo-q001-0000-0000-000000000001',
    feature_id: DEMO_FEATURE_IDS.payment_gateway,
    question: 'Should we support cryptocurrency payments (Bitcoin, Ethereum)?',
    question_type: 'yes_no',
    options: [],
    answer: null,
    priority: 'important',
  },
  {
    id: 'demo-q002-0000-0000-000000000002',
    feature_id: DEMO_FEATURE_IDS.payment_gateway,
    question: 'Which payment providers should we integrate first?',
    question_type: 'multiple_choice',
    options: ['Stripe', 'PayPal', 'Square', 'Braintree', 'Adyen'],
    answer: null,
    priority: 'blocking',
  },

  // Fund Transfer questions (3 pending)
  {
    id: 'demo-q003-0000-0000-000000000003',
    feature_id: DEMO_FEATURE_IDS.fund_transfer,
    question: 'What is the maximum single transfer limit?',
    question_type: 'text',
    options: [],
    answer: null,
    priority: 'blocking',
  },
  {
    id: 'demo-q004-0000-0000-000000000004',
    feature_id: DEMO_FEATURE_IDS.fund_transfer,
    question: 'Should international transfers (SWIFT) be supported in Phase 1?',
    question_type: 'yes_no',
    options: [],
    answer: null,
    priority: 'important',
  },
  {
    id: 'demo-q005-0000-0000-000000000005',
    feature_id: DEMO_FEATURE_IDS.fund_transfer,
    question: 'Which transfer speed options should be available?',
    question_type: 'multiple_choice',
    options: ['Instant (Real-time)', 'Same Day', 'Next Business Day', '2-3 Business Days'],
    answer: null,
    priority: 'important',
  },

  // Answered questions (for demo of answered state)
  {
    id: 'demo-q006-0000-0000-000000000006',
    feature_id: DEMO_FEATURE_IDS.user_auth,
    question: 'Should we support social login (Google, Facebook)?',
    question_type: 'yes_no',
    options: [],
    answer: 'Yes',
    priority: 'important',
  },
  {
    id: 'demo-q007-0000-0000-000000000007',
    feature_id: DEMO_FEATURE_IDS.user_auth,
    question: 'What MFA methods should be supported?',
    question_type: 'multiple_choice',
    options: ['SMS', 'Email', 'Authenticator App', 'Hardware Key'],
    answer: 'Authenticator App, Email',
    priority: 'blocking',
  },
  {
    id: 'demo-q008-0000-0000-000000000008',
    feature_id: DEMO_FEATURE_IDS.product_catalog,
    question: 'How many products are expected in the initial catalog?',
    question_type: 'text',
    options: [],
    answer: 'Approximately 10,000 SKUs at launch, scaling to 50,000 within 6 months',
    priority: 'important',
  },
  {
    id: 'demo-q009-0000-0000-000000000009',
    feature_id: DEMO_FEATURE_IDS.account_overview,
    question: 'Should we display pending transactions?',
    question_type: 'yes_no',
    options: [],
    answer: 'Yes',
    priority: 'nice_to_have',
  },
];

const DEMO_DEPENDENCIES: DemoFeatureDependency[] = [
  {
    feature_id: DEMO_FEATURE_IDS.inventory_sync,
    depends_on_feature_id: DEMO_FEATURE_IDS.product_catalog,
    dependency_type: 'blocks',
    description: 'Inventory sync requires product catalog to be complete for SKU mapping',
  },
  {
    feature_id: DEMO_FEATURE_IDS.order_management,
    depends_on_feature_id: DEMO_FEATURE_IDS.shopping_cart,
    dependency_type: 'blocks',
    description: 'Order management depends on shopping cart for order creation flow',
  },
  {
    feature_id: DEMO_FEATURE_IDS.order_management,
    depends_on_feature_id: DEMO_FEATURE_IDS.payment_gateway,
    dependency_type: 'related',
    description: 'Payment integration needed for order completion',
  },
  {
    feature_id: DEMO_FEATURE_IDS.bill_payment,
    depends_on_feature_id: DEMO_FEATURE_IDS.fund_transfer,
    dependency_type: 'related',
    description: 'Bill payment uses fund transfer infrastructure',
  },
];

const DEMO_ATOMIC_REQUIREMENTS: DemoAtomicRequirement[] = [
  // User Authentication atomic requirements
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.user_auth,
    text: 'User shall be able to register with email and password',
    theme: 'Security',
    clarity_score: 0.95,
    sequence_order: 1,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.user_auth,
    text: 'User shall be able to login with OAuth2 providers (Google, Microsoft)',
    theme: 'Security',
    clarity_score: 0.92,
    sequence_order: 2,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.user_auth,
    text: 'System shall issue JWT tokens on successful authentication',
    theme: 'Security',
    clarity_score: 0.98,
    sequence_order: 3,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.user_auth,
    text: 'System shall implement refresh token rotation for security',
    theme: 'Security',
    clarity_score: 0.90,
    sequence_order: 4,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.user_auth,
    text: 'User shall be able to enable multi-factor authentication',
    theme: 'Security',
    clarity_score: 0.88,
    sequence_order: 5,
  },
  // Product Catalog atomic requirements
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.product_catalog,
    text: 'System shall display products in a grid/list view with pagination',
    theme: 'Commerce',
    clarity_score: 0.94,
    sequence_order: 1,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.product_catalog,
    text: 'User shall be able to search products by name, description, or SKU',
    theme: 'Commerce',
    clarity_score: 0.91,
    sequence_order: 2,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.product_catalog,
    text: 'System shall support product filtering by category, price, and attributes',
    theme: 'Commerce',
    clarity_score: 0.89,
    sequence_order: 3,
  },
  {
    id: randomUUID(),
    feature_id: DEMO_FEATURE_IDS.product_catalog,
    text: 'Product detail page shall display images, description, pricing, and variants',
    theme: 'Commerce',
    clarity_score: 0.93,
    sequence_order: 4,
  },
];

// ============================================================================
// Database Operations
// ============================================================================

interface DbConnection {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
  end: () => Promise<void>;
}

async function createDbConnection(env: string): Promise<DbConnection> {
  // Dynamic import to handle environments without pg
  const { Pool } = await import('pg');

  const connectionString =
    env === 'staging'
      ? process.env.STAGING_DATABASE_URL
      : process.env.DATABASE_URL || 'postgresql://entropy:entropy@localhost:5432/entropy_dev';

  const pool = new Pool({ connectionString });

  return {
    query: async (text: string, params?: unknown[]) => {
      const result = await pool.query(text, params);
      return { rows: result.rows, rowCount: result.rowCount || 0 };
    },
    end: async () => {
      await pool.end();
    },
  };
}

// ============================================================================
// Seed Functions
// ============================================================================

async function checkDemoDataExists(db: DbConnection): Promise<boolean> {
  const result = await db.query(
    `SELECT COUNT(*) as count FROM projects WHERE id = $1 OR id = $2`,
    [DEMO_PROJECT_IDS.ecommerce, DEMO_PROJECT_IDS.banking]
  );
  const count = parseInt((result.rows[0] as { count: string }).count, 10);
  return count > 0;
}

async function cleanDemoData(db: DbConnection): Promise<void> {
  console.log('  Cleaning existing demo data...');

  // Delete in order of dependencies
  const demoProjectIds = Object.values(DEMO_PROJECT_IDS);

  // Delete clarification questions for demo features
  await db.query(
    `DELETE FROM clarification_questions
     WHERE feature_id IN (SELECT id FROM features WHERE project_id = ANY($1))`,
    [demoProjectIds]
  );

  // Delete atomic requirements for demo features
  await db.query(
    `DELETE FROM atomic_requirements
     WHERE feature_id IN (SELECT id FROM features WHERE project_id = ANY($1))`,
    [demoProjectIds]
  );

  // Delete feature dependencies for demo features
  await db.query(
    `DELETE FROM feature_dependencies
     WHERE feature_id IN (SELECT id FROM features WHERE project_id = ANY($1))
        OR depends_on_feature_id IN (SELECT id FROM features WHERE project_id = ANY($1))`,
    [demoProjectIds]
  );

  // Delete feature readiness for demo features
  await db.query(
    `DELETE FROM feature_readiness
     WHERE feature_id IN (SELECT id FROM features WHERE project_id = ANY($1))`,
    [demoProjectIds]
  );

  // Delete features
  await db.query(`DELETE FROM features WHERE project_id = ANY($1)`, [demoProjectIds]);

  // Delete requirements
  await db.query(`DELETE FROM requirements WHERE project_id = ANY($1)`, [demoProjectIds]);

  // Delete projects
  await db.query(`DELETE FROM projects WHERE id = ANY($1)`, [demoProjectIds]);

  console.log('  Demo data cleaned successfully.');
}

async function seedProjects(db: DbConnection): Promise<void> {
  console.log('  Creating projects...');

  for (const project of DEMO_PROJECTS) {
    await db.query(
      `INSERT INTO projects (id, name, description, client_id, tech_stack, status, wip_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         tech_stack = EXCLUDED.tech_stack,
         status = EXCLUDED.status,
         wip_limit = EXCLUDED.wip_limit`,
      [
        project.id,
        project.name,
        project.description,
        project.client_id,
        JSON.stringify(project.tech_stack),
        project.status,
        project.wip_limit,
      ]
    );
  }

  console.log(`  Created ${DEMO_PROJECTS.length} projects.`);
}

async function seedRequirements(db: DbConnection): Promise<void> {
  console.log('  Creating requirements...');

  for (const req of DEMO_REQUIREMENTS) {
    await db.query(
      `INSERT INTO requirements (id, project_id, title, source_type, source_file_s3_key, type, type_confidence, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         status = EXCLUDED.status,
         type = EXCLUDED.type,
         type_confidence = EXCLUDED.type_confidence`,
      [
        req.id,
        req.project_id,
        req.title,
        req.source_type,
        req.source_file_s3_key,
        req.type,
        req.type_confidence,
        req.status,
        DEMO_USER_ID,
      ]
    );
  }

  console.log(`  Created ${DEMO_REQUIREMENTS.length} requirements.`);
}

async function seedFeatures(db: DbConnection): Promise<void> {
  console.log('  Creating features...');

  for (const feature of DEMO_FEATURES) {
    await db.query(
      `INSERT INTO features (id, requirement_id, project_id, title, description, feature_type, status,
                             priority_score, readiness_score, complexity_score, business_value, urgency_score,
                             current_loop, theme)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         priority_score = EXCLUDED.priority_score,
         readiness_score = EXCLUDED.readiness_score,
         current_loop = EXCLUDED.current_loop`,
      [
        feature.id,
        feature.requirement_id,
        feature.project_id,
        feature.title,
        feature.description,
        feature.feature_type,
        feature.status,
        feature.priority_score,
        feature.readiness_score,
        feature.complexity_score,
        feature.business_value,
        feature.urgency_score,
        feature.current_loop,
        feature.theme,
      ]
    );
  }

  console.log(`  Created ${DEMO_FEATURES.length} features.`);
}

async function seedFeatureReadiness(db: DbConnection): Promise<void> {
  console.log('  Creating feature readiness records...');

  for (const readiness of DEMO_FEATURE_READINESS) {
    await db.query(
      `INSERT INTO feature_readiness (feature_id, business_clarity, technical_clarity, testability, ambiguity_score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (feature_id) DO UPDATE SET
         business_clarity = EXCLUDED.business_clarity,
         technical_clarity = EXCLUDED.technical_clarity,
         testability = EXCLUDED.testability,
         ambiguity_score = EXCLUDED.ambiguity_score`,
      [
        readiness.feature_id,
        readiness.business_clarity,
        readiness.technical_clarity,
        readiness.testability,
        readiness.ambiguity_score,
      ]
    );
  }

  console.log(`  Created ${DEMO_FEATURE_READINESS.length} feature readiness records.`);
}

async function seedQuestions(db: DbConnection): Promise<void> {
  console.log('  Creating clarification questions...');

  for (const question of DEMO_QUESTIONS) {
    await db.query(
      `INSERT INTO clarification_questions (id, feature_id, question, question_type, options, answer, answered_at, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         question = EXCLUDED.question,
         options = EXCLUDED.options,
         answer = EXCLUDED.answer,
         answered_at = EXCLUDED.answered_at`,
      [
        question.id,
        question.feature_id,
        question.question,
        question.question_type,
        JSON.stringify(question.options),
        question.answer,
        question.answer ? new Date() : null,
        question.priority,
      ]
    );
  }

  const answered = DEMO_QUESTIONS.filter((q) => q.answer).length;
  const pending = DEMO_QUESTIONS.filter((q) => !q.answer).length;
  console.log(`  Created ${DEMO_QUESTIONS.length} questions (${answered} answered, ${pending} pending).`);
}

async function seedDependencies(db: DbConnection): Promise<void> {
  console.log('  Creating feature dependencies...');

  for (const dep of DEMO_DEPENDENCIES) {
    await db.query(
      `INSERT INTO feature_dependencies (feature_id, depends_on_feature_id, dependency_type, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (feature_id, depends_on_feature_id) DO UPDATE SET
         dependency_type = EXCLUDED.dependency_type,
         description = EXCLUDED.description`,
      [dep.feature_id, dep.depends_on_feature_id, dep.dependency_type, dep.description]
    );
  }

  console.log(`  Created ${DEMO_DEPENDENCIES.length} feature dependencies.`);
}

async function seedAtomicRequirements(db: DbConnection): Promise<void> {
  console.log('  Creating atomic requirements...');

  for (const ar of DEMO_ATOMIC_REQUIREMENTS) {
    await db.query(
      `INSERT INTO atomic_requirements (id, feature_id, text, theme, clarity_score, sequence_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         text = EXCLUDED.text,
         clarity_score = EXCLUDED.clarity_score`,
      [ar.id, ar.feature_id, ar.text, ar.theme, ar.clarity_score, ar.sequence_order]
    );
  }

  console.log(`  Created ${DEMO_ATOMIC_REQUIREMENTS.length} atomic requirements.`);
}

// ============================================================================
// Output Helpers
// ============================================================================

function printSummary(): void {
  console.log('\n┌────────────────────────────────────────────────────────────┐');
  console.log('│                    DEMO DATA SUMMARY                       │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│ Projects:              ${DEMO_PROJECTS.length.toString().padStart(3)}                                  │`);
  console.log(`│ Requirements:          ${DEMO_REQUIREMENTS.length.toString().padStart(3)}                                  │`);
  console.log(`│ Features:              ${DEMO_FEATURES.length.toString().padStart(3)}                                  │`);
  console.log(`│ Clarification Questions: ${DEMO_QUESTIONS.length.toString().padStart(2)}                                  │`);
  console.log(`│   - Answered:          ${DEMO_QUESTIONS.filter((q) => q.answer).length.toString().padStart(3)}                                  │`);
  console.log(`│   - Pending:           ${DEMO_QUESTIONS.filter((q) => !q.answer).length.toString().padStart(3)}                                  │`);
  console.log(`│ Dependencies:          ${DEMO_DEPENDENCIES.length.toString().padStart(3)}                                  │`);
  console.log(`│ Atomic Requirements:   ${DEMO_ATOMIC_REQUIREMENTS.length.toString().padStart(3)}                                  │`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│                   FEATURE STATUS DISTRIBUTION              │');
  console.log('├────────────────────────────────────────────────────────────┤');

  const statusCounts = DEMO_FEATURES.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`│ ${status.padEnd(20)} ${count.toString().padStart(3)}                                  │`);
  });

  console.log('└────────────────────────────────────────────────────────────┘');
}

// ============================================================================
// Main Execution
// ============================================================================

async function seedDemoData(options: SeedOptions): Promise<void> {
  console.log(`\n🌱 Seeding demo data to: ${options.env}\n`);

  let db: DbConnection | null = null;
  const startTime = Date.now();

  try {
    db = await createDbConnection(options.env);
    console.log('  Connected to database.');

    // Check for existing demo data
    const exists = await checkDemoDataExists(db);

    if (exists && !options.clean) {
      console.log('\n⚠️  Demo data already exists. Use --clean to reset.\n');
      return;
    }

    if (options.clean && exists) {
      console.log('\n🧹 Cleaned existing demo data. Creating fresh data...\n');
      await cleanDemoData(db);
    }

    // Seed data in order
    await seedProjects(db);
    await seedRequirements(db);
    await seedFeatures(db);
    await seedFeatureReadiness(db);
    await seedQuestions(db);
    await seedDependencies(db);
    await seedAtomicRequirements(db);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Demo data seeded successfully in ${duration}s!\n`);
    printSummary();
  } catch (error) {
    console.error('\n❌ Error seeding demo data:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

// Parse CLI arguments
function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  return {
    clean: args.includes('--clean'),
    env: (args.find((a) => a.startsWith('--env='))?.split('=')[1] as 'local' | 'staging') || 'local',
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

// Run
const options = parseArgs();
seedDemoData(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
