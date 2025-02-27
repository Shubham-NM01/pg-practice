// app.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const app = express();

// Set up EJS
app.set("view engine", "ejs");

// Serve static files
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Ensure directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir("uploads");
ensureDir("public");
ensureDir("temp");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Routes
app.get("/", (req, res) => {
  // Read uploads directory for existing files
  fs.readdir("uploads", (err, files) => {
    const uploadedFiles = err ? [] : files;
    res.render("index", { files: uploadedFiles });
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
  });
});

// View file route - handles on-demand conversion using LibreOffice
// app.get("/view/:filename", async (req, res) => {
//   try {
//     const filename = req.params.filename;
//     const filePath = path.join(__dirname, "uploads", filename);

//     if (!fs.existsSync(filePath)) {
//       return res.status(404).send("File not found");
//     }

//     // If it's a DOCX file, convert it on-the-fly
//     if (filename.toLowerCase().endsWith(".docx")) {
//       // Create a temp PDF filename - using a hash to make it deterministic for caching
//       const fileHash = require("crypto")
//         .createHash("md5")
//         .update(filename)
//         .digest("hex");
//       const tempPdfPath = path.join(__dirname, "temp", `${fileHash}.pdf`);

//       // Check if we already have a cached version
//       const needsConversion =
//         !fs.existsSync(tempPdfPath) ||
//         fs.statSync(filePath).mtime > fs.statSync(tempPdfPath).mtime;

//       if (needsConversion) {
//         try {
//           // Use LibreOffice for high-quality conversion that preserves formatting and images
//           // First, check if LibreOffice is installed
//           try {
//             await execPromise("libreoffice --version");
//             // LibreOffice is installed, use it for conversion
//             console.log("INSTALLED");
//             await execPromise(
//               `libreoffice --headless --convert-to pdf --outdir "${path.join(
//                 __dirname,
//                 "temp"
//               )}" "${filePath}"`
//             );

//             // LibreOffice outputs with original filename, so we need to rename
//             const libreOfficePdf = path.join(
//               __dirname,
//               "temp",
//               path.basename(filename, ".docx") + ".pdf"
//             );
//             if (fs.existsSync(libreOfficePdf)) {
//               fs.renameSync(libreOfficePdf, tempPdfPath);
//             }
//           } catch (loError) {
//             // LibreOffice might not be installed, fallback to CloudConvert API
//             // This is where you'd implement an API-based conversion
//             // For now, we'll just return an error
//             console.error("LibreOffice not found or error:", loError);
//             return res
//               .status(500)
//               .send(
//                 "PDF conversion failed. LibreOffice is not installed on the server."
//               );
//           }
//         } catch (convError) {
//           console.error("Conversion error:", convError);
//           return res.status(500).send("Error during document conversion");
//         }
//       }

//       // Stream the PDF to client
//       if (fs.existsSync(tempPdfPath)) {
//         res.setHeader("Content-Type", "application/pdf");
//         fs.createReadStream(tempPdfPath).pipe(res);
//       } else {
//         res.status(500).send("PDF conversion failed");
//       }
//     } else {
//       // For non-DOCX files, just serve the file directly
//       res.sendFile(filePath);
//     }
//   } catch (error) {
//     console.error("Error processing file:", error);
//     res.status(500).send("Error processing file");
//   }
// });

// Replace the existing /view/:filename route with this:
// app.get("/view/:filename", async (req, res) => {
//   try {
//     const filename = req.params.filename;
//     const filePath = path.join(__dirname, "uploads", filename);

//     if (!fs.existsSync(filePath)) {
//       return res.status(404).send("File not found");
//     }

//     if (filename.toLowerCase().endsWith(".docx")) {
//       const buffer = fs.readFileSync(filePath);
      
//       // Define custom style map for better formatting
//       const options = {
//         styleMap: [
//           "p[style-name='Title'] => h1.document-title",
//           "p[style-name='Heading 1'] => h1.heading1",
//           "p[style-name='Heading 2'] => h2.heading2",
//           "p[style-name='Heading 3'] => h3.heading3",
//           "p[style-name='Quote'] => blockquote",
//           "r[style-name='Strong'] => strong",
//           "r[style-name='Emphasis'] => em"
//         ],
//         convertImage: mammoth.images.imgElement(function(image) {
//           return image.read("base64").then(function(imageBuffer) {
//             return {
//               src: "data:" + image.contentType + ";base64," + imageBuffer
//             };
//           });
//         })
//       };

//       const result = await mammoth.convertToHtml({ buffer: buffer }, options);
//       const html = result.value;

//       res.send(`
//         <!DOCTYPE html>
//         <html>
//         <head>
//           <meta charset="utf-8">
//           <title>${filename}</title>
//           <style>
//             body {
//               font-family: 'Calibri', 'Arial', sans-serif;
//               line-height: 1.6;
//               max-width: 850px;
//               margin: 0 auto;
//               padding: 20px;
//               color: #333;
//             }

//             /* Enhanced Typography */
//             h1, h2, h3, h4, h5, h6 {
//               color: #2c3e50;
//               margin-top: 1.5em;
//               margin-bottom: 0.5em;
//               font-weight: 600;
//             }

//             h1.document-title {
//               font-size: 2.5em;
//               text-align: center;
//               color: #1a365d;
//               margin-bottom: 1em;
//             }

//             /* Table Styles */
//             table {
//               border-collapse: collapse;
//               width: 100%;
//               margin: 1em 0;
//             }

//             th, td {
//               border: 1px solid #ddd;
//               padding: 8px;
//             }

//             th {
//               background-color: #f5f5f5;
//             }

//             /* List Styles */
//             ul, ol {
//               padding-left: 2em;
//             }

//             /* Image Styles */
//             img {
//               max-width: 100%;
//               height: auto;
//               display: block;
//               margin: 1em auto;
//             }

//             /* Block Quote Styles */
//             blockquote {
//               border-left: 4px solid #ccc;
//               margin: 1em 0;
//               padding-left: 1em;
//               color: #666;
//             }

//             /* Link Styles */
//             a {
//               color: #2980b9;
//               text-decoration: none;
//             }

//             a:hover {
//               text-decoration: underline;
//             }

//             /* Paragraph Spacing */
//             p {
//               margin: 0.8em 0;
//             }

//             /* Code Block Styles */
//             pre, code {
//               background-color: #f8f9fa;
//               border: 1px solid #eee;
//               border-radius: 3px;
//               padding: 0.2em 0.4em;
//               font-family: 'Consolas', monospace;
//             }

//             /* Print Styles */
//             @media print {
//               body {
//                 max-width: none;
//                 padding: 1cm;
//               }
//             }
//           </style>
//         </head>
//         <body>
//           ${html}
//         </body>
//         </html>
//       `);
//     } else {
//       res.sendFile(filePath);
//     }
//   } catch (error) {
//     console.error("Error processing file:", error);
//     res.status(500).send("Error processing file");
//   }
// });

app.get("/view/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  
  res.sendFile(filePath);
});

// Alternative method using Google Docs Viewer for preview
app.get("/preview/:filename", (req, res) => {
  const filename = req.params.filename;

  // Instead of converting, we'll redirect to a page that uses Google Docs Viewer
  res.render("preview", {
    filename,
    fileUrl: `${req.protocol}://${req.get("host")}/uploads/${filename}`,
  });
});

// Clean up temporary files periodically (run every hour)
setInterval(() => {
  const tempDir = path.join(__dirname, "temp");
  fs.readdir(tempDir, (err, files) => {
    if (err) return;

    const now = Date.now();
    files.forEach((file) => {
      const filePath = path.join(tempDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        // Delete files older than 24 hours
        if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
