const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // Add mongoose for transactions
const Project = require('../models/Project');
const Application = require('../models/Application');
const User = require('../models/User');
const Message = require('../models/Message');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(404).json({ message: 'User not found' });
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// @route   GET /api/projects/me
router.get('/me', auth, async (req, res) => {
  try {
    console.log('Fetching user:', req.user._id);
    const response = {
      _id: req.user._id,
      username: req.user.username,
      userType: req.user.userType,
    };
    if (req.user.userType === 'freelancer') {
      response.skills = req.user.skills || [];
      response.bio = req.user.bio || '';
      response.photo = req.user.photo || '';
      response.schooling = req.user.schooling || '';
      response.degree = req.user.degree || '';
      response.certification = req.user.certification || '';
      response.totalEarned = req.user.totalEarned || 0;
      response.pendingPayments = req.user.pendingPayments || 0;
      response.ratings = req.user.ratings || 0;
    } else if (req.user.userType === 'employer') {
      response.bio = req.user.bio || '';
      response.company = req.user.company || '';
      response.totalSpent = req.user.totalSpent || 0;
    }
    res.json(response);
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/projects/update-profile
router.put('/update-profile', auth, async (req, res) => {
  try {
    const updateData = {};
    if (req.user.userType === 'freelancer') {
      const { skills, bio, photo, schooling, degree, certification } = req.body;
      if (skills !== undefined && skills !== '') {
        updateData.skills = skills.split(',').map((s) => s.trim());
      }
      if (bio !== undefined) updateData.bio = bio;
      if (photo !== undefined) updateData.photo = photo;
      if (schooling !== undefined) updateData.schooling = schooling;
      if (degree !== undefined) updateData.degree = degree;
      if (certification !== undefined) updateData.certification = certification;
    } else if (req.user.userType === 'employer') {
      const { bio, company } = req.body;
      if (bio !== undefined) updateData.bio = bio;
      if (company !== undefined) updateData.company = company;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const response = {
      _id: updatedUser._id,
      username: updatedUser.username,
      userType: updatedUser.userType,
    };
    if (updatedUser.userType === 'freelancer') {
      response.skills = updatedUser.skills || [];
      response.bio = updatedUser.bio || '';
      response.photo = updatedUser.photo || '';
      response.schooling = updatedUser.schooling || '';
      response.degree = updatedUser.degree || '';
      response.certification = updatedUser.certification || '';
      response.totalEarned = updatedUser.totalEarned || 0;
      response.pendingPayments = updatedUser.pendingPayments || 0;
      response.ratings = updatedUser.ratings || 0;
    } else if (updatedUser.userType === 'employer') {
      response.bio = updatedUser.bio || '';
      response.company = updatedUser.company || '';
      response.totalSpent = updatedUser.totalSpent || 0;
    }
    res.json(response);
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(400).json({ message: 'Failed to update profile: ' + error.message });
  }
});

// @route   GET /api/projects/freelancers/search
router.get('/freelancers/search', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can search freelancers' });
    }
    const { name, minRating, skills } = req.query;
    const query = { userType: 'freelancer' };

    if (name) {
      query.username = { $regex: name, $options: 'i' };
    }
    if (minRating) {
      query.ratings = { $gte: parseFloat(minRating) };
    }
    if (skills) {
      const skillArray = skills.split(',').map((s) => s.trim());
      query.skills = { $in: skillArray };
    }

    const freelancers = await User.find(query).select('username skills bio ratings');
    res.json(freelancers);
  } catch (error) {
    console.error('Search freelancers error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching all open projects');
    const projects = await Project.find({ status: 'open' });
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/my-projects
router.get('/my-projects', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can view their projects' });
    }
    console.log('Fetching projects for employer:', req.user._id);
    const projects = await Project.find({ postedBy: req.user._id })
      .populate('postedBy', 'username')
      .populate('assignedTo', 'username');
    res.json(projects);
  } catch (error) {
    console.error('Get my projects error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/create
router.post('/create', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can create projects' });
    }
    const { title, description, budget, skillsRequired } = req.body;
    if (!title || !description || !budget) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    console.log('Creating project:', { title, postedBy: req.user._id });
    const project = new Project({
      title,
      description,
      budget,
      skillsRequired: skillsRequired ? skillsRequired.split(',').map((s) => s.trim()) : [],
      postedBy: req.user._id,
      status: 'open',
    });
    await project.save();
    console.log('Project created:', project);
    res.json({ message: 'Project created', project });
  } catch (error) {
    console.error('Create project error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/projects/delete/:id
router.delete('/delete/:id', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can delete projects' });
    }
    console.log('Deleting project:', req.params.id);
    const project = await Project.findOne({ _id: req.params.id, postedBy: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or not authorized' });
    }
    await Project.deleteOne({ _id: req.params.id });
    await Application.deleteMany({ project: req.params.id });
    console.log('Project deleted:', req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/assign-project
router.post('/assign-project', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can assign projects' });
    }
    const { projectId, freelancerId } = req.body;
    console.log('Assigning project:', { projectId, freelancerId });
    const project = await Project.findOne({ _id: projectId, postedBy: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or not authorized' });
    }
    if (project.status !== 'open') {
      return res.status(400).json({ message: 'Project already assigned or closed' });
    }
    const freelancer = await User.findById(freelancerId);
    if (!freelancer || freelancer.userType !== 'freelancer') {
      return res.status(404).json({ message: 'Freelancer not found' });
    }
    project.status = 'assigned';
    project.assignedTo = freelancerId;
    await project.save();

    const employer = await User.findById(req.user._id);
    employer.totalSpent = (employer.totalSpent || 0) + project.budget;
    await employer.save();

    await Application.updateMany(
      { project: projectId, freelancer: freelancerId },
      { $set: { status: 'accepted' } }
    );
    await Application.updateMany(
      { project: projectId, freelancer: { $ne: freelancerId } },
      { $set: { status: 'rejected' } }
    );
    console.log('Project assigned:', project);
    res.json({ message: 'Project assigned', project });
  } catch (error) {
    console.error('Assign project error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/open
router.get('/open', auth, async (req, res) => {
  try {
    console.log('Fetching open projects for user:', req.user._id);
    const projects = await Project.find({ status: 'open', assignedTo: null });
    console.log('Open projects:', projects);
    res.json(projects);
  } catch (error) {
    console.error('Open projects error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/apply
router.post('/apply', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can apply' });
    }
    const { projectId, coverLetter } = req.body;
    console.log('Applying to project:', { projectId, freelancer: req.user._id, coverLetter });
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }
    const project = await Project.findById(projectId);
    if (!project || project.status !== 'open') {
      return res.status(404).json({ message: 'Project not found or not open' });
    }
    const existingApplication = await Application.findOne({
      project: projectId,
      freelancer: req.user._id,
    });
    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this project' });
    }
    const application = new Application({
      project: projectId,
      freelancer: req.user._id,
      coverLetter: coverLetter || '',
      status: 'pending',
    });
    await application.save();
    console.log('Application saved:', application);
    res.json({ message: 'Application submitted', application });
  } catch (error) {
    console.error('Apply error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/applications
router.get('/applications', auth, async (req, res) => {
  try {
    if (req.user.userType === 'freelancer') {
      console.log('Fetching applications for freelancer:', req.user._id);
      const applications = await Application.find({ freelancer: req.user._id })
        .populate('project', 'title budget status description');
      console.log('Freelancer applications:', applications);
      res.json(applications);
    } else if (req.user.userType === 'employer') {
      console.log('Fetching applications for employer:', req.user._id);
      const projects = await Project.find({ postedBy: req.user._id }).select('_id');
      const projectIds = projects.map((p) => p._id);
      console.log('Employer project IDs:', projectIds);
      const applications = await Application.find({ project: { $in: projectIds } })
        .populate('project', 'title budget status description paymentStatus')
        .populate('freelancer', 'username skills ratings');
      console.log('Employer applications:', applications);
      res.json(applications);
    }
  } catch (error) {
    console.error('Get applications error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/:projectId/applications
router.get('/:projectId/applications', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can view project applications' });
    }
    const project = await Project.findById(req.params.projectId);
    if (!project || project.postedBy.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Project not found or not authorized' });
    }
    console.log('Fetching applications for project:', req.params.projectId);
    const applications = await Application.find({ project: req.params.projectId })
      .populate('project', 'title budget status description paymentStatus')
      .populate('freelancer', 'username skills ratings');
    console.log('Project applications:', applications);
    res.json({ project, applications });
  } catch (error) {
    console.error('Get project applications error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/applications/:id
router.get('/applications/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('freelancer', 'username skills bio schooling degree certification')
      .populate('project', 'title budget description paymentStatus');
    if (!application) return res.status(404).json({ message: 'Application not found' });
    if (application.project.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(application);
  } catch (error) {
    console.error('Get application error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/applications/:id/accept
router.post('/applications/:id/accept', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can accept applications' });
    }
    console.log('Accepting application:', req.params.id);
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    const project = await Project.findById(application.project);
    if (!project || project.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    application.status = 'accepted';
    project.status = 'assigned';
    project.assignedTo = application.freelancer;
    await application.save();
    await project.save();
    console.log('Application accepted:', application);
    res.json({ message: 'Application accepted', application });
  } catch (error) {
    console.error('Accept application error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/applications/:id/reject
router.post('/applications/:id/reject', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can reject applications' });
    }
    console.log('Rejecting application:', req.params.id);
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    const project = await Project.findById(application.project);
    if (!project || project.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    application.status = 'rejected';
    await application.save();
    console.log('Application rejected:', application);
    res.json({ message: 'Application rejected' });
  } catch (error) {
    console.error('Reject application error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/messages/:projectId
router.get('/messages/:projectId', auth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    console.log('Fetching messages for project:', projectId);
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (
      project.postedBy.toString() !== req.user._id.toString() &&
      (!project.assignedTo || project.assignedTo.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const messages = await Message.find({ project: projectId })
      .populate('sender', 'username')
      .sort('createdAt');
    console.log('Messages:', messages);
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/payment/request
router.post('/payment/request', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can request payment' });
    }
    const { projectId, amount } = req.body;
    console.log('Payment request:', { projectId, freelancer: req.user._id, amount });
    const project = await Project.findById(projectId);
    if (!project || project.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const message = new Message({
      project: projectId,
      sender: req.user._id,
      content: `Payment request: $${amount}`,
    });
    await message.save();
    res.json({ message: 'Payment requested' });
  } catch (error) {
    console.error('Payment request error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/payment/pay
router.post('/payment/pay', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can make payments' });
    }
    const { projectId, freelancerId, amount } = req.body;
    console.log('Payment:', { projectId, freelancerId, amount, userId: req.user._id });

    // Validate inputs
    if (!projectId || !freelancerId || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Missing or invalid required fields' });
    }

    // Fetch project and application within session
    const project = await Project.findById(projectId).session(session);
    if (!project) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.postedBy.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (project.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Payment already made' });
    }

    const application = await Application.findOne({ project: projectId, freelancer: freelancerId }).session(session);
    if (!application || application.status !== 'accepted') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No accepted application found for this freelancer' });
    }
    if (application.paymentStatus === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Payment already processed for this application' });
    }

    const freelancer = await User.findById(freelancerId).session(session);
    if (!freelancer || freelancer.userType !== 'freelancer') {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Freelancer not found' });
    }

    // Update project and application
    project.paymentStatus = 'paid';
    application.paymentStatus = 'paid';
    await project.save({ session });
    console.log('Project saved:', project);
    await application.save({ session });
    console.log('Application saved:', application);

    // Update freelancer and employer
    freelancer.totalEarned = (freelancer.totalEarned || 0) + amount;
    freelancer.pendingPayments = (freelancer.pendingPayments || 0) - Math.max(0, (freelancer.pendingPayments || 0) - amount);
    await freelancer.save({ session });
    console.log('Freelancer saved:', freelancer);

    const employer = await User.findById(req.user._id).session(session);
    employer.totalSpent = (employer.totalSpent || 0) + amount;
    await employer.save({ session });
    console.log('Employer saved:', employer);

    // Save payment message
    const message = new Message({
      project: projectId,
      sender: req.user._id,
      content: `Payment sent: $${amount}`,
    });
    await message.save({ session });
    console.log('Message saved:', message);

    // Commit transaction
    await session.commitTransaction();
    console.log('Payment transaction committed for project:', projectId);

    // Emit Socket.IO event
    if (req.io) {
      req.io.to(projectId).emit('payment_updated', { project: { _id: projectId, paymentStatus: 'paid' } });
      console.log('Emitted payment_updated event for project:', projectId);
    } else {
      console.warn('Socket.IO not initialized on req.io');
    }

    res.json({ message: 'Payment sent', project });
  } catch (error) {
    console.error('Payment error:', error.message, error.stack);
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// @route   POST /api/projects/applications/:applicationId/rate
router.post('/applications/:applicationId/rate', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can rate applications' });
    }
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Invalid rating value (must be between 1 and 5)' });
    }
    console.log('Submitting rating for application:', req.params.applicationId);
    const application = await Application.findById(req.params.applicationId)
      .populate('project')
      .populate('freelancer');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (application.project.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (application.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Payment must be completed before rating' });
    }
    if (application.rating) {
      return res.status(400).json({ message: 'Rating already submitted' });
    }
    application.rating = rating;
    await application.save();

    // Update freelancer's average rating
    const freelancerApplications = await Application.find({ freelancer: application.freelancer._id, rating: { $exists: true } });
    const averageRating =
      freelancerApplications.reduce((sum, app) => sum + app.rating, 0) / freelancerApplications.length || 0;
    application.freelancer.ratings = averageRating;
    await application.freelancer.save();

    req.io.emit('rating_updated', { applicationId: req.params.applicationId, rating });
    res.json({ message: 'Rating submitted', rating });
  } catch (error) {
    console.error('Submit rating error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/applications/:applicationId/feedback
router.post('/applications/:applicationId/feedback', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'employer') {
      return res.status(403).json({ message: 'Only employers can provide feedback' });
    }
    const { feedback } = req.body;
    if (!feedback) {
      return res.status(400).json({ message: 'Feedback is required' });
    }
    console.log('Submitting feedback for application:', req.params.applicationId);
    const application = await Application.findById(req.params.applicationId).populate('project');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (application.project.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (application.feedback) {
      return res.status(400).json({ message: 'Feedback already submitted' });
    }
    application.feedback = feedback;
    await application.save();
    req.io.emit('feedback_updated', { applicationId: req.params.applicationId, feedback });
    res.json({ message: 'Feedback submitted', feedback });
  } catch (error) {
    console.error('Submit feedback error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;