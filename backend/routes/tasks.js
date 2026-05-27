const express = require('express');
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const router = express.Router();

router.use(auth);

// Get all tasks for a folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.folderId, userId: req.userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json(folder.tasks.sort((a,b) => a.order - b.order));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create task in folder
router.post('/folder/:folderId', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    const folder = await Folder.findOne({ _id: req.params.folderId, userId: req.userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    const maxOrder = folder.tasks.reduce((max, t) => Math.max(max, t.order || 0), 0);
    const newTask = { title, completed: false, order: maxOrder + 1 };
    folder.tasks.push(newTask);
    await folder.save();
    res.status(201).json(folder.tasks[folder.tasks.length-1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Update task (toggle complete / edit title)
router.put('/:taskId', async (req, res) => {
  try {
    const { title, completed } = req.body;
    const folder = await Folder.findOne({ userId: req.userId, 'tasks._id': req.params.taskId });
    if (!folder) return res.status(404).json({ message: 'Task not found' });
    const task = folder.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (title !== undefined) task.title = title;
    if (completed !== undefined) task.completed = completed;
    await folder.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Delete
router.delete('/:taskId', async (req, res) => {
  try {
    const folder = await Folder.findOne({ userId: req.userId, 'tasks._id': req.params.taskId });
    if (!folder) return res.status(404).json({ message: 'Task not found' });
    folder.tasks.pull({ _id: req.params.taskId });
    await folder.save();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Load
router.put('/folder/:folderId/order', async (req, res) => {
  try {
    const { tasks } = req.body; // [{ _id, order }, ...]
    const folder = await Folder.findOne({ _id: req.params.folderId, userId: req.userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    tasks.forEach(update => {
      const task = folder.tasks.id(update._id);
      if (task) task.order = update.order;
    });
    await folder.save();
    res.json({ message: 'Tasks order updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;