// To start : 
// cd 'login-signup system'
// npx nodemon start

const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const bcrypt = require("bcryptjs"); // for secure password hashing
const mysql = require('mysql2');
const ejs = require("ejs");
const session = require('express-session'); // to make mysql attributes global vairables
const multer = require('multer'); // for profile picture upload
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));


app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

app.get ("/", function (req, res) {
    res.render("login", {error: null});

})

app.get ("/login", function (req, res) {
    res.render("login", {error: null});

})

app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.get('/dashboard', function (req, res) {
  if (!req.session.user_id) {
    return res.redirect('/login');
  }

  const sql = `
  SELECT posts.*, users.username 
  FROM posts 
  JOIN users ON posts.user_id = users.id 
  ORDER BY posts.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
        console.error("Error fetching posts:", err);
        return res.status(500).send("Database error");
    }

    res.render("dashboard", {
        username: req.session.username,
        posts: results,
        contact: req.session.contact,
        email: req.session.email,
        profile_pic: req.session.profile_pic,
        id: req.session.user_id,
        currentUser: req.session.username
    });
  });

})

app.get('/new_post', function (req , res) {
  res.render("new_post", {
    username: req.session.username
  });
})

app.get('/profile', function (req, res) {
  res.render("profile", {
    username: req.session.username ,
    name: req.session.full_name,
    contact: req.session.contact,
    email: req.session.email,
    profile_pic: req.session.profile_pic,
    id: req.session.user_id
  });
})

app.get ('/posts', function (req, res) {

    // 1. Safety check: redirect to login if session is empty
    if (!req.session.user_id) {
        return res.redirect('/login');
    }

    // 2. Fetch only this user's posts, newest first
    const sql = "SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC";
    
    db.query(sql, [req.session.user_id], (err, results) => {
        if (err) {
            console.error("Error fetching posts:", err);
            return res.status(500).send("Database error");
        }

        // 3. Render the page and pass the posts array
        res.render("posts", {
            username: req.session.username,
            posts: results,
            contact: req.session.contact,
            email: req.session.email,
            profile_pic: req.session.profile_pic,
            id: req.session.user_id
        });
    });
});


const db = mysql.createConnection({
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,        
    database: process.env.database,
    port: process.env.port
  });

  db.connect((err) => {
    if (err) {
      console.error('MySQL connection failed:', err.stack);
      return;
    }
    console.log('Connected to MySQL as ID', db.threadId);
  });
  
  // Signup Route
  app.post('/signup', async (req, res) => {
    const { username, email, password, full_name, contact, id } = req.body;
  
    if (!username || !email || !password || !full_name || !contact) {
      return res.render('signup', { error: 'All fields are required' });
    }
  
    try {
      const checkUserQuery = 'SELECT * FROM users WHERE username = ?';
      db.query(checkUserQuery, [username], async (err, results) => {
        if (err) {
          console.error('DB error:', err);
          return res.render('signup', { error: 'Database error' });
        }
  
        if (results.length > 0) {
          return res.render('signup', { error: 'Username already taken. Please choose another.' });
        }
  
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertQuery = `
          INSERT INTO users (username, email, password_hash, full_name, contact)
          VALUES (?, ?, ?, ?, ?)`;
  
        db.query(insertQuery, [username, email, hashedPassword, full_name, contact], (err) => {
          if (err) {
            console.error('Insert error:', err);
            return res.render('signup', { error: 'Database error' });
          }
  
          res.sendFile(__dirname + '/signup_successful.html');
        });
      });
    } catch (err) {
      console.error('Signup error:', err);
      res.render('signup', { error: 'Server error' });
    }
  });




app.post('/login', (req, res) => {
  const { username, password, email, full_name, contact, id} = req.body;

  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], async (err, results) => {
      if (err) {
          console.error('Database error:', err);
          return res.render('login', { error: 'Database error. Please try again.' });
      }

      if (results.length === 0) {
          // username not found
          return res.render('login', { error: 'Wrong username or password.' });
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
          // password does not match
          return res.render('login', { error: 'Wrong username or password.' });
      }
      
      // fetching values of database attributes to be used globally
      req.session.username = user.username
      req.session.email = user.email
      req.session.full_name = user.full_name
      req.session.contact = user.contact
      req.session.profile_pic = user.profile_pic
      req.session.user_id = user.id

      // SUCCESS: redirect to success page
      res.redirect("/dashboard");
        
  });
}); 

app.post('/upload_profile', upload.single('profile_pic'), (req, res) => {

  const imagePath = "/uploads/" + req.file.filename;

  const sql = "UPDATE users SET profile_pic = ? WHERE id = ?";

  db.query(sql, [imagePath, req.session.user_id], (err) => {

      if(err){
          console.log(err);
          return res.send("Upload failed");
      }

      req.session.profile_pic = imagePath;
      res.redirect("/profile");

  });

});


app.post('/create_post', upload.single('post_image'), (req, res) => {
  // 1. Check if user is logged in
  if (!req.session.user_id) {
      return res.redirect('/login');
  }

  const { title, caption } = req.body;
  const image_url = "/uploads/" + req.file.filename; // The path for the <img> tag
  const user_id = req.session.user_id;

  const sql = "INSERT INTO posts (user_id, title, caption, image_url) VALUES (?, ?, ?, ?)";
  
  db.query(sql, [user_id, title, caption, image_url], (err, result) => {
      if (err) {
          console.error(err);
          return res.send("Error saving post to database.");
      }
      res.redirect('/posts');
  });
});



app.listen(3000, function () {
    console.log("server running on port 3000");
})