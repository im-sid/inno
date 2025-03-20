const mongoose = require('mongoose');
const User = require('./models/User');
const Branch = require('./models/Branch'); // Reintroduce Branch model
const Skill = require('./models/Skills'); // Reintroduce Skill model
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => console.log('Error connecting to MongoDB:', err));

// Data to seed for branches and skills
const branches = [
  { name: 'Computer Science' },
  { name: 'Mechanical Engineering' },
  { name: 'Electrical Engineering' },
  { name: 'Civil Engineering' },
];

const skills = [
  { name: 'JavaScript' },
  { name: 'Python' },
  { name: 'Java' },
  { name: 'C++' },
  { name: 'React' },
  { name: 'Node.js' },
];

// Admin user data
const adminUser = {
  name: 'Admin User',
  email: 'admin@example.com',
  password: 'Admin12345', // This will be hashed
  role: 'Admin', // Set role to Admin
  bio: 'Administrator account for managing the platform',
  branch: null, // Will be set to CSE after seeding branches
  skills: [], // Will be set to all skills after seeding skills
};

// Seed function
const seedDB = async () => {
  try {
    // Clear existing data
    await Branch.deleteMany({});
    await Skill.deleteMany({});
    await User.deleteMany({});

    // Seed branches
    const seededBranches = await Branch.insertMany(branches);
    console.log('Branches seeded successfully');

    // Seed skills
    const seededSkills = await Skill.insertMany(skills);
    console.log('Skills seeded successfully');

    // Find the "Computer Science" branch
    const cseBranch = seededBranches.find(branch => branch.name === 'Computer Science');
    if (!cseBranch) {
      throw new Error('Computer Science branch not found after seeding');
    }

    // Get all skill IDs
    const allSkillIds = seededSkills.map(skill => skill._id);

    // Hash the admin password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminUser.password, salt);

    // Create the admin user with the CSE branch and all skills
    const admin = new User({
      name: adminUser.name,
      email: adminUser.email,
      password: hashedPassword,
      role: adminUser.role,
      bio: adminUser.bio,
      branch: cseBranch._id, // Assign the CSE branch
      skills: allSkillIds, // Assign all skills
    });

    // Seed the admin user
    await admin.save();
    console.log('Admin user seeded successfully:', adminUser.email);
    console.log('Admin branch:', cseBranch.name);
    console.log('Admin skills:', seededSkills.map(skill => skill.name));

    // Close the connection
    mongoose.connection.close();
    console.log('Database connection closed');
  } catch (err) {
    console.error('Error seeding database:', err);
    mongoose.connection.close();
  }
};

// Run the seed function
seedDB();