const dashboardService = require('../services/dashboard.service');

async function metrics(req, res, next) {
  try {
    const data = await dashboardService.dashboardMetrics();
    res.json(data);
  } catch (e) { next(e); }
}

module.exports = { metrics };
