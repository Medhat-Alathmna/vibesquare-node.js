import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Import models
import { Project } from '../src/api/project/project.model';
import { Collection } from '../src/api/collection/collection.model';

const MONGODB_URI = process.env.MONGODB_URI;

// PostgreSQL Pool
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  ssl: true
});

// Path to frontend data
const FRONTEND_DATA_PATH = path.join(__dirname, '../../vibesquare-gallery/src/assets/data');

async function createPostgresTables() {
  const client = await pgPool.connect();
  try {
    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        short_description VARCHAR(500),
        thumbnail VARCHAR(500),
        screenshots JSONB DEFAULT '[]',
        demo_url VARCHAR(500),
        download_url VARCHAR(500),
        prompt JSONB,
        framework VARCHAR(100),
        tags JSONB DEFAULT '[]',
        styles JSONB DEFAULT '[]',
        category VARCHAR(100),
        likes INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        collection_ids JSONB DEFAULT '[]',
        code_files JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create collections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail VARCHAR(500),
        project_ids JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        featured BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('PostgreSQL tables created successfully');
  } finally {
    client.release();
  }
}

async function seedPostgres(projectsData: any[], collectionsData: any[]) {
  const client = await pgPool.connect();
  try {
    // Clear existing data
    await client.query('DELETE FROM projects');
    await client.query('DELETE FROM collections');
    console.log('Cleared existing PostgreSQL data');

    // Insert projects
    for (const project of projectsData) {
      await client.query(`
        INSERT INTO projects (
          id, title, description, short_description, thumbnail, screenshots,
          demo_url, download_url, prompt, framework, tags, styles, category,
          likes, views, downloads, collection_ids, code_files, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        project.id,
        project.title,
        project.description,
        project.shortDescription,
        project.thumbnail,
        JSON.stringify(project.screenshots || []),
        project.demoUrl,
        project.downloadUrl,
        JSON.stringify(project.prompt || {}),
        project.framework,
        JSON.stringify(project.tags || []),
        JSON.stringify(project.styles || []),
        project.category,
        project.likes || 0,
        project.views || 0,
        project.downloads || 0,
        JSON.stringify(project.collectionIds || []),
        JSON.stringify(project.codeFiles || []),
        project.createdAt || new Date(),
        project.updatedAt || new Date()
      ]);
    }
    console.log(`Inserted ${projectsData.length} projects into PostgreSQL`);

    // Insert collections
    for (const collection of collectionsData) {
      await client.query(`
        INSERT INTO collections (
          id, title, description, thumbnail, project_ids, tags, featured, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        collection.id,
        collection.title,
        collection.description,
        collection.thumbnail,
        JSON.stringify(collection.projectIds || []),
        JSON.stringify(collection.tags || []),
        collection.featured || false,
        collection.createdAt || new Date()
      ]);
    }
    console.log(`Inserted ${collectionsData.length} collections into PostgreSQL`);

  } finally {
    client.release();
  }
}

async function seedMongoDB(projectsData: any[], collectionsData: any[]) {
  if (!MONGODB_URI) {
    console.log('MongoDB URI not provided, skipping MongoDB seeding');
    return;
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Project.deleteMany({});
  await Collection.deleteMany({});
  console.log('Cleared existing MongoDB data');

  // Insert projects
  if (projectsData.length > 0) {
    await Project.insertMany(projectsData);
    console.log(`Inserted ${projectsData.length} projects into MongoDB`);
  }

  // Insert collections
  if (collectionsData.length > 0) {
    await Collection.insertMany(collectionsData);
    console.log(`Inserted ${collectionsData.length} collections into MongoDB`);
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

async function seed() {
  try {
    // Read JSON files from frontend
    const projectsPath = path.join(FRONTEND_DATA_PATH, 'projects.json');
    const collectionsPath = path.join(FRONTEND_DATA_PATH, 'collections.json');

    let projectsData: any[] = [];
    let collectionsData: any[] = [];

    if (fs.existsSync(projectsPath)) {
      const projectsJson = fs.readFileSync(projectsPath, 'utf-8');
      projectsData = JSON.parse(projectsJson);
      console.log(`Found ${projectsData.length} projects in JSON file`);
    } else {
      console.log('No projects.json found, using sample data');
      projectsData = getSampleProjects();
    }

    if (fs.existsSync(collectionsPath)) {
      const collectionsJson = fs.readFileSync(collectionsPath, 'utf-8');
      collectionsData = JSON.parse(collectionsJson);
      console.log(`Found ${collectionsData.length} collections in JSON file`);
    } else {
      console.log('No collections.json found, using sample data');
      collectionsData = getSampleCollections();
    }

    // Seed PostgreSQL
    console.log('\n--- Seeding PostgreSQL ---');
    await createPostgresTables();
    await seedPostgres(projectsData, collectionsData);

    // Seed MongoDB (if available)
    console.log('\n--- Seeding MongoDB ---');
    await seedMongoDB(projectsData, collectionsData);

    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await pgPool.end();
  }
}

function getSampleProjects() {
  return [
    {
      id: 'proj-001',
      title: 'NeuroFlow Dashboard',
      description: 'A comprehensive analytics dashboard for monitoring machine learning model training progress with real-time metrics visualization.',
      shortDescription: 'Analytics dashboard for ML training',
      thumbnail: 'https://picsum.photos/seed/neuroflow/800/600',
      screenshots: [],
      demoUrl: 'https://demo.vibesquare.io/neuroflow',
      downloadUrl: '/downloads/neuroflow.zip',
      prompt: {
        text: 'Create a modern analytics dashboard for monitoring machine learning training with dark theme, neon accents, and real-time charts',
        model: 'Claude Sonnet 4.5',
        version: '20250929'
      },
      framework: 'Angular',
      tags: ['dashboard', 'analytics', 'machine-learning', 'charts'],
      styles: ['dark', 'neon', 'modern'],
      category: 'Dashboard',
      likes: 342,
      views: 1520,
      downloads: 89,
      createdAt: new Date('2025-11-15T10:30:00Z'),
      updatedAt: new Date('2025-11-15T10:30:00Z'),
      collectionIds: ['col-001'],
      codeFiles: []
    },
    {
      id: 'proj-002',
      title: 'E-Commerce Landing',
      description: 'A beautiful e-commerce landing page with product showcase and smooth animations.',
      shortDescription: 'Modern e-commerce landing page',
      thumbnail: 'https://picsum.photos/seed/ecommerce/800/600',
      screenshots: [],
      demoUrl: 'https://demo.vibesquare.io/ecommerce',
      downloadUrl: '/downloads/ecommerce.zip',
      prompt: {
        text: 'Create a modern e-commerce landing page with hero section, featured products, and testimonials',
        model: 'GPT-5',
        version: '1.0'
      },
      framework: 'React',
      tags: ['e-commerce', 'landing', 'shop', 'modern'],
      styles: ['light', 'minimal', 'clean'],
      category: 'E-commerce',
      likes: 256,
      views: 980,
      downloads: 67,
      createdAt: new Date('2025-11-10T14:20:00Z'),
      updatedAt: new Date('2025-11-10T14:20:00Z'),
      collectionIds: ['col-002'],
      codeFiles: []
    }
  ];
}

function getSampleCollections() {
  return [
    {
      id: 'col-001',
      title: 'Dashboard Collection',
      description: 'A curated collection of beautiful dashboard designs',
      thumbnail: 'https://picsum.photos/seed/dashboards/800/600',
      projectIds: ['proj-001'],
      tags: ['dashboard', 'analytics'],
      createdAt: new Date('2025-11-01T00:00:00Z'),
      featured: true
    },
    {
      id: 'col-002',
      title: 'E-Commerce Templates',
      description: 'Modern e-commerce templates and landing pages',
      thumbnail: 'https://picsum.photos/seed/shop/800/600',
      projectIds: ['proj-002'],
      tags: ['e-commerce', 'shop'],
      createdAt: new Date('2025-11-05T00:00:00Z'),
      featured: true
    }
  ];
}

seed();
