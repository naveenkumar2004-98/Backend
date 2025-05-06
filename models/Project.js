const mongoose = require('mongoose');
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  budget: { type: Number, required: true },
  skillsRequired: [{ type: String }],
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'assigned', 'in-progress'], default: 'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
});
module.exports = mongoose.model('Project', projectSchema);