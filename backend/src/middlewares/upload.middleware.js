const multer = require('multer');

const storage = multer.memoryStorage();

const ALLOWED_EXT = ['.txt', '.csv', '.xlsx'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    if (ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use .txt, .csv ou .xlsx'));
    }
  },
});

module.exports = upload;
