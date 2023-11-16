const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mysql = require('mysql');
const html2canvas = require('html2canvas');
const jsPDF = require('jspdf');
//const cryptoHash = require('crypto-hash');

const app = express();
var count=0;
// Define the functionalities
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; font-src 'self' http://localhost:3002/confirm");
    next();
});

// Generate a random 4-digit code
// Create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: "",
    database: 'bank'
});
app.post('/login', (req, res) => {
  const uname = req.body.username;
  const pwd = req.body.pwd;
  connection.query(
      "SELECT * FROM login WHERE username = ? AND password = ?", [uname, pwd],
      (err, result) => {
          if (err) {
              console.error('MySQL Error:', err);
              res.status(500).send({ message: 'Internal Server Error' });
          }
          if (Array.isArray(result) && result.length > 0) {
              console.log(uname);
              res.send(result);
          } else {
              res.send({ message: "error" });
          }
      }
  );
});

// Handle the insert route and send the verification email
app.post('/insert', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const name = req.body.name;
  const gmail = req.body.gmail;
  const panNum = req.body.pan_num;
  const aadhar = req.body.aadhar;
  const amount = req.body.amount;
  const mobile = req.body.mobile;

  // Check if the username already exists in the 'login' table
  const checkUsernameQuery = 'SELECT * FROM login WHERE username = ?';
  connection.query(checkUsernameQuery, [username], (err, result) => {
    if (err) {
      console.log(err);
      res.send({ message: 'Error checking for existing username' });
    } else {
      console.log('Result:', result);  // Add this line to inspect the result
      if (result.length > 0) {
        // Username already exists, send a message
        res.send({ message: 'Username already exists' });
      } else {
        // Username is not present, proceed with the insertion
        const insertLoginQuery = `INSERT INTO login (username, password) VALUES (?, ?)`;
        connection.query(insertLoginQuery, [username, password], (err, result) => {
        if (err) {
          console.log(err);
          res.send({ message: 'Error inserting data into login table' });
        } else {
          // Insert data into the 'user_data' table
          const insertUserDataQuery = `INSERT INTO user_data (username, email, pan_num, aadhar_num, mobile_num) VALUES (?, ?, ?, ?, ?)`;
          connection.query(insertUserDataQuery, [username, gmail, panNum, aadhar, mobile], (err, result) => {
            if (err) {
              console.log(err);
              res.send({ message: 'Error inserting data into user_data table' });
            } else {
              console.log('Data inserted into login and user_data tables');
              res.send({ message: 'Registration successful' });
            }
          });
        }
      });
    }
  };
});
});



  
const transporter = nodemailer.createTransport({
  service: 'Outlook365', // e.g., 'Gmail'
  auth: {
      user: 'kannan.20it@sonatech.ac.in',
      pass: 'sm@_2003'
  }
});
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}
const otps = new Map();

// ... (Previous code)

app.post('/generate-otp', (req, res) => {
  const email = req.body.email;
  const otp = generateOTP();
  const timestamp = Date.now(); // Get the current timestamp in milliseconds

  // Store the OTP with email and timestamp association
  otps.set(email, { otp: otp.toString(), timestamp: timestamp });

  // Send the OTP via email
  const mailOptions = {
    from: 'kannan.20it@sonatech.ac.in',
    to: email,
    subject: 'Your OTP',
    text: `Your OTP is: ${otp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Email Error:', error);
      res.status(500).send({ message: 'Internal Server Error' });
    } else {
      res.send({ message: 'OTP generated and sent via email' });
    }
  });
});

// ... (Continue with the rest of your code)




  
app.get('/get-user-details', (req, res) => {
  const email = req.query.email; // Get the email as a query parameter

  // Query the database to get user details by email
  const sql = 'SELECT pan_num, aadhar, mobile FROM login WHERE gmail = ?';
  connection.query(sql, [email], (err, result) => {
      if (err) {
          console.error('MySQL Error:', err);
          res.status(500).send({ message: 'Internal Server Error' });
      } else {
          if (result.length > 0) {
              res.send(result[0]); // Assuming a single user is found
          } else {
              res.send({ message: 'User not found' });
          }
      }
  });
});
app.post('/verify-otp', (req, res) => {
  const email = req.body.email;
  const userOTP = req.body.otp;

  const storedData = otps.get(email);

  if (storedData && userOTP === storedData.otp) {
    // Check if the OTP is still valid (within 5 minutes)
    const currentTime = Date.now();
    const otpTimestamp = storedData.timestamp;
    const timeDifference = currentTime - otpTimestamp;
    const validityPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (timeDifference <= validityPeriod) {
      res.send({ message: 'OTP is correct and within the validity period!' });
    } else {
      res.send({ message: 'OTP is correct but has expired. Please request a new OTP.' });
    }
  } else {
    res.send({ message: 'OTP is incorrect or expired. Please try again.' });
  }
});

app.post('/generate-certificate', (req, res) => {
  const { email, aadhar, pan_num, mobile } = req.body;

  // Create a certificate HTML element
  const certificateHTML = `
    <div id="certificate">
      <h1>Certificate of Achievement</h1>
      <p>Aadhar: ${aadhar}</p>
      <p>PAN Number: ${pan_num}</p>
      <p>Mobile Number: ${mobile}</p>
    </div>
  `;

  // Generate the certificate as a PDF and send it to the client
  html2canvas(document.querySelector('#certificate')).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('portrait', 'px', 'a4');
    pdf.addImage(imgData, 'PNG', 0, 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=certificate.pdf');
    res.send(pdf.output('blob'));
  });
});


// Start the server
app.listen(3000, () => {
  console.log('Server is running');
});
