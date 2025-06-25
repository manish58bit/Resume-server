const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-netlify-app.netlify.app',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Resume Schema
const resumeSchema = new mongoose.Schema({
  personalInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    address: String,
    linkedin: String,
    github: String,
    website: String
  },
  summary: String,
  experience: [{
    company: String,
    position: String,
    startDate: String,
    endDate: String,
    description: String,
    current: { type: Boolean, default: false }
  }],
  education: [{
    institution: String,
    degree: String,
    field: String,
    startDate: String,
    endDate: String,
    gpa: String
  }],
  skills: [{
    category: String,
    items: [String]
  }],
  projects: [{
    name: String,
    description: String,
    technologies: [String],
    url: String,
    github: String
  }],
  certifications: [{
    name: String,
    issuer: String,
    date: String,
    url: String
  }],
  languages: [{
    name: String,
    proficiency: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Resume = mongoose.model('Resume', resumeSchema);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create new resume
app.post('/api/resumes', async (req, res) => {
  try {
    const resumeData = req.body;
    
    // Validate required fields
    if (!resumeData.personalInfo?.fullName || !resumeData.personalInfo?.email) {
      return res.status(400).json({ 
        error: 'Full name and email are required' 
      });
    }

    const resume = new Resume(resumeData);
    const savedResume = await resume.save();
    
    res.status(201).json({
      success: true,
      message: 'Resume saved successfully',
      data: {
        id: savedResume._id,
        createdAt: savedResume.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving resume:', error);
    res.status(500).json({ 
      error: 'Failed to save resume',
      details: error.message 
    });
  }
});

// Get resume by ID
app.get('/api/resumes/:id', async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    res.json({
      success: true,
      data: resume
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ 
      error: 'Failed to fetch resume',
      details: error.message 
    });
  }
});

// Update resume
app.put('/api/resumes/:id', async (req, res) => {
  try {
    const resumeData = { ...req.body, updatedAt: new Date() };
    
    const resume = await Resume.findByIdAndUpdate(
      req.params.id,
      resumeData,
      { new: true, runValidators: true }
    );
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: resume
    });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({ 
      error: 'Failed to update resume',
      details: error.message 
    });
  }
});

// Delete resume
app.delete('/api/resumes/:id', async (req, res) => {
  try {
    const resume = await Resume.findByIdAndDelete(req.params.id);
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ 
      error: 'Failed to delete resume',
      details: error.message 
    });
  }
});

// Get all resumes (with pagination)
app.get('/api/resumes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const resumes = await Resume.find()
      .select('personalInfo.fullName personalInfo.email createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Resume.countDocuments();

    res.json({
      success: true,
      data: resumes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch resumes',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});