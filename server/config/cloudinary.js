const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key:    process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// ── Chat file uploads (unchanged — Cloudinary managed storage) ────────────────
// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'flowdesk-chat',
//     resource_type: 'auto', // auto-detects image/video/raw
//     allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'mp4', 'mov', 'avi', 'mkv'],
//   },
// });

// Fallback to memoryStorage since Cloudinary is hidden
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Expense bill uploads — memory storage ─────────────────────────────────────
// We use memoryStorage so the raw buffer is available for both a manual
// Cloudinary upload AND a Google Drive upload inside the controller.
const uploadBill = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, JPEG, PNG and WEBP images are allowed.'));
        }
    },
});

// ── Helper: upload a Buffer directly to Cloudinary ───────────────────────────
/**
 * @param {Buffer} buffer
 * @param {string} [mimeType]  – used to detect resource_type; defaults to image
 * @returns {Promise<import('cloudinary').UploadApiResponse>}
 */
const uploadBufferToCloudinary = (buffer, mimeType = 'image/jpeg') => {
    // return new Promise((resolve, reject) => {
    //   const stream = cloudinary.uploader.upload_stream(
    //     {
    //       folder:        'flowdesk-expense-bills',
    //       resource_type: 'image',
    //     },
    //     (error, result) => {
    //       if (error) reject(error);
    //       else resolve(result);
    //     },
    //   );
    //   stream.end(buffer);
    // });
    return Promise.resolve({ secure_url: null });
};

module.exports = { cloudinary, upload, uploadBill, uploadBufferToCloudinary };
