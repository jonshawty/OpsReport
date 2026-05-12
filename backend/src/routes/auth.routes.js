const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.get('/me', auth, ctrl.me);

module.exports = router;
