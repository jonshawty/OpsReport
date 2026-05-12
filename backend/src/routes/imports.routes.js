const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/imports.controller');

router.get('/', auth, ctrl.list);
router.get('/:id/tickets', auth, ctrl.tickets);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
