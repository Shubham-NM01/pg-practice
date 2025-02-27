const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const { PDFDocument } = require("pdf-lib");

const app = express();
const port = process.env.PORT || 3009;

// Create the uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// JSON file to store metadata
const metadataPath = path.join(__dirname, "pdf_metadata.json");
if (!fs.existsSync(metadataPath)) {
  fs.writeFileSync(metadataPath, JSON.stringify([]));
}

// Load metadata
function loadMetadata() {
  const data = fs.readFileSync(metadataPath, "utf8");
  return JSON.parse(data);
}

// Save metadata
function saveMetadata(metadata) {
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed!"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10000000 }, // 10MB limit
});

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Set up EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
  const pdfs = loadMetadata();
  res.render("index", { pdfs });
});

app.post("/upload", upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded or file is not a PDF" });
    }

    const { filename } = req.file;
    const originalFilename = req.file.originalname;

    const metadata = loadMetadata();
    const newPdf = {
      id: Date.now().toString(), // Use timestamp as ID
      filename,
      originalFilename,
      uploadDate: new Date().toISOString(),
    };

    metadata.push(newPdf);
    saveMetadata(metadata);

    res.json({ success: true, pdf: newPdf });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error uploading file" });
  }
});

app.get("/pdf/:id", (req, res) => {
  const metadata = loadMetadata();
  const pdf = metadata.find((p) => p.id === req.params.id);

  if (!pdf) {
    return res.status(404).json({ error: "PDF not found" });
  }

  res.json({ pdf });
});

app.get("/download/:id", (req, res) => {
  const metadata = loadMetadata();
  const pdf = metadata.find((p) => p.id === req.params.id);

  if (!pdf) {
    return res.status(404).send("PDF not found");
  }

  const filePath = path.join(uploadsDir, pdf.filename);

  res.download(filePath, pdf.originalFilename);
});

app.delete("/delete/:id", (req, res) => {
  try {
    const metadata = loadMetadata();
    const pdfIndex = metadata.findIndex((p) => p.id === req.params.id);

    if (pdfIndex === -1) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const pdf = metadata[pdfIndex];
    const filePath = path.join(uploadsDir, pdf.filename);

    // Delete file from filesystem
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from metadata
    metadata.splice(pdfIndex, 1);
    saveMetadata(metadata);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add new route for signing page
app.get('/sign/:id', (req, res) => {
    const metadata = loadMetadata();
    const pdf = metadata.find(p => p.id === req.params.id);
    
    if (!pdf) {
        return res.status(404).send('PDF not found');
    }

    res.render('signing-page', {
        pdfName: pdf.originalFilename,
        pdfFilename: pdf.filename
    });
});

// New route to add signatures to a PDF
app.post("/sign-pdf/:id", async (req, res) => {
  try {
    const { signatures } = req.body;
    console.log("Received signatures:", signatures);
    const metadata = loadMetadata();
    const pdf = metadata.find((p) => p.id === req.params.id);

    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const inputPath = path.join(uploadsDir, pdf.filename);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = uniqueSuffix + "-signed-" + pdf.originalFilename;
    const outputPath = path.join(uploadsDir, newFilename);

    // Read the PDF file
    const pdfBytes = fs.readFileSync(inputPath);

    // Create a new PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // For each signature, add it to the PDF
    for (const sig of signatures) {
      const pageIndex = sig.pageNumber - 1; // PDF pages are 0-indexed
      console.log("Processing signature:", {
        pageIndex,
        x: sig.x,
        y: sig.y,
        width: sig.width,
        height: sig.height,
      }); // Add this log

      if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
        console.error(`Invalid page number: ${sig.pageNumber}`);
        continue;
      }

      const page = pdfDoc.getPage(pageIndex);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      console.log("Page dimensions:", { pageWidth, pageHeight });

      // Decode the base64 image (skip the data:image/png;base64, prefix)
      let signatureImageData = sig.imageData;
      if (signatureImageData.includes(",")) {
        signatureImageData = signatureImageData.split(",")[1];
      }

      try {
        const signatureBytes = Buffer.from(signatureImageData, "base64");
        let signatureImage;

        // Determine if PNG or JPEG based on data
        if (sig.imageData.includes("data:image/png")) {
          signatureImage = await pdfDoc.embedPng(signatureBytes);
        } else {
          signatureImage = await pdfDoc.embedJpg(signatureBytes);
        }

        // Transform coordinates
        const pdfX = sig.x / 1.5; // Divide by the scale used in the viewer (1.5)
        const pdfY = pageHeight - (sig.y / 1.5 + sig.height / 1.5); // Adjust Y coordinate
        const sigWidth = sig.width / 1.5;
        const sigHeight = sig.height / 1.5;

        console.log("Final PDF coordinates:", {
          pdfX,
          pdfY,
          sigWidth,
          sigHeight,
        });

        // Add the signature to the page
        page.drawImage(signatureImage, {
          x: pdfX,
          y: pdfY,
          width: sigWidth,
          height: sigHeight,
        });
      } catch (err) {
        console.error("Error embedding signature:", err);
      }
    }

    // Save the PDF
    const newPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, newPdfBytes);

    // Add to metadata
    const newPdf = {
      id: Date.now().toString(),
      filename: newFilename,
      originalFilename: "signed-" + pdf.originalFilename,
      uploadDate: new Date().toISOString(),
    };

    metadata.push(newPdf);
    saveMetadata(metadata);

    res.json({ success: true, newPdfId: newPdf.id });
  } catch (err) {
    console.error("Error adding signatures to PDF:", err);
    res
      .status(500)
      .json({ error: "Error adding signatures to PDF: " + err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
