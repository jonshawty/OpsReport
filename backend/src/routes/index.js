const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/tickets', require('./tickets.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/imports', require('./imports.routes'));

router.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

module.exports = router;
