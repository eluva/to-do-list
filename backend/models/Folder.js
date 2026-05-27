const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const folderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  borderColor: { type: String, default: null }, 
  tasks: [taskSchema],
  createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Folder', folderSchema);