const router = require('express').Router();
const ctrl = require('../controllers/tickets.controller');
const auth = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.post('/preview', auth, ctrl.preview);
router.post('/preview-file', auth, upload.single('file'), ctrl.previewFile);
router.post('/export', auth, ctrl.exportTickets);

router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.save);
router.get('/:id', auth, ctrl.getOne);
router.patch('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
