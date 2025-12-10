import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import { Project } from '../src/api/project/project.model';
import { Collection } from '../src/api/collection/collection.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vibesquare';

// Path to frontend data
const FRONTEND_DATA_PATH = path.join(__dirname, '../../vibesquare-gallery/src/assets/data');

async function seed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

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

    // Clear existing data
    await Project.deleteMany({});
    await Collection.deleteMany({});
    console.log('Cleared existing data');

    // Insert projects
    if (projectsData.length > 0) {
      await Project.insertMany(projectsData);
      console.log(`Inserted ${projectsData.length} projects`);
    }

    // Insert collections
    if (collectionsData.length > 0) {
      await Collection.insertMany(collectionsData);
      console.log(`Inserted ${collectionsData.length} collections`);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
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
