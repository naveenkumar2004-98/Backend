const mongoose = require('mongoose');

const freelancerSchema = new mongoose.Schema({
  name: String,
  skills: String,
  bio: String,
  image: String, // image path stored here
}, { timestamps: true });

module.exports = mongoose.model('Freelancer', freelancerSchema);
const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/freelancers', { name, skills, bio }); // No need for `data`
      // Optionally navigate or show a success message
    } catch (error) {
      console.error('Error', error);
    }
  };
  