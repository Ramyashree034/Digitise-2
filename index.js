const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const sgMail = require("@sendgrid/mail");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Registration schema
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
  paymentConfirmed: Boolean,
  createdAt: { type: Date, default: Date.now },
});
const Registration = mongoose.model("Registration", registrationSchema);

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Registration API
app.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      college,
      year,
      experience,
      usn,
      event,
      participants,
      paymentConfirmed,
    } = req.body;

    // ✅ Stop Hackathon registrations
    if (event && event.toLowerCase().includes("hackathon")) {
      return res.status(400).json({
        message: "🚫 Registrations for Hackathon are now closed.",
      });
    }

    // ✅ Checkbox validation
    if (!paymentConfirmed) {
      return res
        .status(400)
        .json({ message: "Please confirm that you have sent payment via WhatsApp!" });
    }

    const registration = new Registration({
      teamLeader: { name, email, phone, college, year, experience, usn },
      event,
      teamSize: (participants?.length || 0) + 1,
      participants,
      paymentConfirmed,
    });

    await registration.save();

    // Email to participant
    await sgMail.send({
      to: email,
      from: process.env.NOTIFY_EMAIL,
      subject: `✅ Registration Confirmed - ${event}`,
      html: `<h2>Thank you for registering, ${name}!</h2>
             <p>Your registration for <strong>${event}</strong> is confirmed.</p>
             <p><strong>Payment Status:</strong> ✔ Confirmed via WhatsApp</p>`,
    });

    // Email to organizer(s)
    await sgMail.send({
      to: process.env.NOTIFY_EMAIL.split(","),
      from: process.env.NOTIFY_EMAIL,
      subject: `📥 New Registration - ${event}`,
      html: `<h2>New Registration Alert</h2>
             <p><strong>Leader:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Phone:</strong> ${phone}</p>
             <p><strong>Event:</strong> ${event}</p>
             <p><strong>Payment Confirmed:</strong> ✔ Yes</p>
             <p><strong>Team Size:</strong> ${registration.teamSize}</p>`,
    });

    res.status(200).json({ message: "Registration submitted successfully! and mails sent" });
  } catch (err) {
    console.error("❌ Error submitting registration:", err);
    res.status(500).json({ message: "Error submitting registration" });
  }
});

// Serve frontend build
app.use(express.static("dist"));
app.get(/.*/, (req, res) => {
  res.sendFile("index.html", { root: "dist" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
