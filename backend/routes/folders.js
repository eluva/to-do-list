const express = require('express');
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const router = express.Router();

router.use(auth);

//Get
router.get('/', async (req, res) => {
  try {
    const folders = await Folder.find({ userId: req.userId }).sort({ order: 1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Create 
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name required' });
    const maxOrderFolder = await Folder.findOne({ userId: req.userId }).sort('-order');
    const order = maxOrderFolder ? maxOrderFolder.order + 1 : 0;
    const folder = new Folder({ userId: req.userId, name, tasks: [], order });
    await folder.save();
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Delete
router.delete('/:id', async (req, res) => {
  try {
    const folder = await Folder.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.put('/order', async (req, res) => {
  try {
    const { folders } = req.body; // [{ _id, order }, ...]
    if (!Array.isArray(folders)) return res.status(400).json({ message: 'Invalid format' });
    const bulkOps = folders.map(f => ({
      updateOne: {
        filter: { _id: f._id, userId: req.userId },
        update: { $set: { order: f.order } }
      }
    }));
    await Folder.bulkWrite(bulkOps);
    res.json({ message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Update
router.put('/:id', async (req, res) => {
  try {
    const { name, borderColor, fillFolder } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name required' });
    const updateFields = { name };
    if (borderColor !== undefined) updateFields.borderColor = borderColor;
    if (fillFolder !== undefined) updateFields.fillFolder = fillFolder;
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updateFields },
      { new: true }
    );
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



module.exports = router;