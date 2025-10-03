const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const sgMail = require("@sendgrid/mail");
const fs = require("fs");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploads folder temporarily (optional)
app.use("/uploads", express.static(uploadDir));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Schema
const registrationSchema = new mongoose.Schema({
  teamLeader: {
    name: String,
    email: String,
    phone: String,
    college: String,
    year: String,
    experience: String,
    usn: String,
  },
  event: String,
  teamSize: Number,
  participants: [{ name: String, email: String, usn: String }],
  paymentDone: Boolean,
  paymentFile: String,
  createdAt: { type: Date, default: Date.now },
});
const Registration = mongoose.model("Registration", registrationSchema);

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Registration API
app.post("/register", upload.single("paymentScreenshot"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Payment screenshot is required!" });
    }

    const { name, email, phone, college, year, experience, usn, event, participants } = req.body;

    const registration = new Registration({
      teamLeader: { name, email, phone, college, year, experience, usn },
      event,
      teamSize: JSON.parse(participants || "[]").length + 1,
      participants: JSON.parse(participants || "[]"),
      paymentDone: true,
      paymentFile: req.file.filename,
    });

    await registration.save();

    // Email to participant
    await sgMail.send({
      to: email,
      from: process.env.NOTIFY_EMAIL,
      subject: `✅ Registration Confirmed - ${event}`,
      html: `<h2>Thank you for registering, ${name}!</h2>
             <p>Your registration for <strong>${event}</strong> is confirmed.</p>
             <p><strong>Payment Status:</strong> ✔ Payment Received</p>`,
      attachments: [
        {
          content: fs.readFileSync(req.file.path).toString("base64"),
          filename: req.file.originalname,
          type: "image/png",
          disposition: "attachment",
        },
      ],
    });

    // Email to organizer
    await sgMail.send({
      to: process.env.NOTIFY_EMAIL,
      from: process.env.NOTIFY_EMAIL,
      subject: `📥 New Registration - ${event}`,
      html: `<h2>New Registration Alert</h2>
             <p><strong>Leader:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Phone:</strong> ${phone}</p>
             <p><strong>Event:</strong> ${event}</p>
             <p><strong>Payment Received:</strong> ✔ Yes</p>
             <p><strong>Team Size:</strong> ${registration.teamSize}</p>`,
      attachments: [
        {
          content: fs.readFileSync(req.file.path).toString("base64"),
          filename: req.file.originalname,
          type: "image/png",
          disposition: "attachment",
        },
      ],
    });

    res.status(200).json({ message: "Registration submitted successfully!" });
  } catch (err) {
    console.error("❌ Error submitting registration:", err);
    res.status(500).json({ message: "Error submitting registration" });
  }
});

// ✅ Serve frontend build
app.use(express.static(path.join(__dirname, "dist"))); // Make sure 'dist' folder is here

// Send index.html for all unmatched routes (safe wildcard)
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
