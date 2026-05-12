const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const dashboardCtrl = require('../controllers/dashboard.controller');

router.get('/metrics', auth, dashboardCtrl.metrics);

module.exports = router;
