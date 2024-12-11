const bodyParser = require('body-parser');
const ejs = require('ejs');
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Prasad@1998',
    database: 'admin_bmg',
    port : 3306,
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

let users = {};

// Middleware to fetch data for items and rates
const fetchDataMiddleware = (req, res, next) => {
    connection.query('SELECT * FROM items', (itemErr, itemResults) => {
        if (itemErr) throw itemErr;

        res.locals.items = itemResults;

        connection.query('SELECT * FROM rates', (rateErr, rateResults) => {
            if (rateErr) throw rateErr;

            if (rateResults.length > 0) {
                const latestRates = rateResults[rateResults.length - 1];
                res.locals.metalRates = {
                    newGoldRateValue24: latestRates.rate24,
                    newGoldRateValue22: latestRates.rate22,
                    newGoldRateValue18: latestRates.rate18,
                    newSilverRateValue: latestRates.rateSil,
                };
            } else {
                res.locals.metalRates = {
                    newGoldRateValue24: '-',
                    newGoldRateValue22: '-',
                    newGoldRateValue18: '-',
                    newSilverRateValue: '-',
                };
            }

            connection.query('SELECT * FROM schemes', (schemeErr, schemeResults) => {
                if (schemeErr) throw schemeErr;

                res.locals.schemes = schemeResults || [];

                next();
            });
        });
    });
};

// Routes

app.get('/', fetchDataMiddleware, (req, res) => {
    res.locals.metalRates = res.locals.metalRates || {};

    const recentItems = res.locals.items.slice(0, 10);
    res.render('index', { items: recentItems, schemes: res.locals.schemes, metalRates: res.locals.metalRates });
});

app.get('/admin-login', (req, res) => {
    res.render('admin-login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/Schemes', (req, res) => {
    res.render('Schemes');
});

app.get('/admin', fetchDataMiddleware, (req, res) => {

    res.render('admin', { items: res.locals.items, schemes: res.locals.schemes, metalRates: res.locals.metalRates });
});

app.get('/jewellery', fetchDataMiddleware, (req, res) => {
    const itemsByCategory = res.locals.items.reduce((acc, item) => {
        const category = item.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {});

    Object.keys(itemsByCategory).forEach(category => {
        itemsByCategory[category].sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
    });

    res.render('jewellery', { itemsByCategory, metalRates: res.locals.metalRates });
});

app.post('/signin', (req, res) => {
    const { username, password } = req.body;

    // Query the database to find the user
    connection.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, results) => {
            if (err) {
                console.error('Error querying the database:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Check if a user with the provided username exists
            if (results.length === 0) {
                // User not found, render the login page with an error message
                return res.render('admin-login', { errorMessage: 'Invalid username or password' });
            }

            // Check if the password matches
            const user = results[0];
            if (user.password !== password) {
                // Password does not match, render the login page with an error message
                return res.render('admin-login', { errorMessage: 'Invalid username or password' });
            }

            // Authentication successful, redirect to the admin page
            res.redirect('/admin');
        }
    );
});

app.post('/updateRates', (req, res) => {
    const { rate24, rate22, rate18, rateSil } = req.body;

    // Validate input values
    if (!Number.isFinite(parseFloat(rate24)) || !Number.isFinite(parseFloat(rate22)) ||
        !Number.isFinite(parseFloat(rate18)) || !Number.isFinite(parseFloat(rateSil))) {
        return res.status(400).send('Invalid rate values. Please provide valid numeric values.');
    }
    connection.query(
        'INSERT INTO rates (rate24, rate22, rate18, rateSil) VALUES (?, ?, ?, ?)',
        [rate24, rate22, rate18, rateSil],
        (insertErr, insertResults) => {
            if (insertErr) {
                console.error('Error inserting rates into the MySQL database:', insertErr);
                res.status(500).send('Error updating rates');
            } else {
                console.log('Rates inserted into the MySQL database');

                connection.query('SELECT * FROM rates', (fetchErr, fetchResults) => {
                    if (fetchErr) {
                        console.error('Error fetching rates from the MySQL database:', fetchErr);
                        res.status(500).send('Error fetching rates');
                    } else {
                        if (fetchResults.length > 0) {
                            const latestRates = fetchResults[fetchResults.length - 1];
                    
                            // Initialize metalRates if not already set
                            res.locals.metalRates = res.locals.metalRates || {};
                        
                            res.locals.metalRates.newGoldRateValue24 = latestRates.rate24;
                            res.locals.metalRates.newGoldRateValue22 = latestRates.rate22;
                            res.locals.metalRates.newGoldRateValue18 = latestRates.rate18;
                            res.locals.metalRates.newSilverRateValue = latestRates.rateSil;
                      
                            console.log('Rates fetched from the MySQL database');
                            res.redirect('/');
                          }  else {
                            console.log('No rates found in the MySQL database');
                            res.status(500).send('No rates found');
                        }
                    }
                });
            }
        }
    );
});

app.post('/addItem', upload.single('itemImage'), (req, res) => {
    const { itemName, itemDescription, itemCategory, itemWeight, itemPurity, itemId } = req.body;

    // Validate input values
    if (!Number.isFinite(parseFloat(itemWeight)) || !Number.isFinite(parseFloat(itemPurity))) {
        return res.status(400).send('Invalid weight or purity. Please provide valid numeric values.');
    }

    const imageFile = req.file;
    if (!imageFile) {
        res.status(400).send('Please select an image file.');
        return;
    }

    const imageDataURL = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}`;

    connection.query(
        'INSERT INTO items (id, name, description, category, weight, purity, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, itemName, itemDescription, itemCategory, itemWeight, itemPurity, imageFile.buffer],
        (err, results) => {
            if (err) {
                // Check for duplicate key error (error code 1062)
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send('Item with this ID already exists.');
                } else {
                    throw err;
                }
            }

            console.log('Item added to MySQL database');
            res.redirect('/');
        }
    );
});

app.post('/addScheme', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), (req, res) => {
    const { title, description } = req.body;

    const schemeImages = req.files;

    if (!schemeImages || !schemeImages.image1 || !schemeImages.image1[0]) {
        res.status(400).send('Please upload at least the first scheme image.');
        return;
    }

    const imageBuffers = [
        schemeImages.image1[0].buffer,
        schemeImages.image2 ? schemeImages.image2[0].buffer : null,
        schemeImages.image3 ? schemeImages.image3[0].buffer : null,
        schemeImages.image4 ? schemeImages.image4[0].buffer : null
    ];

    connection.query(
        'INSERT INTO schemes (title, description, image1, image2, image3, image4) VALUES (?, ?, ?, ?, ?, ?)',
        [title, description, ...imageBuffers],
        (err, results) => {
            if (err) throw err;
            console.log('Scheme added to MySQL database');
            res.redirect('/');
        }
    );
});

app.post('/register', (req, res) => {
    const { mobileNumber, username, password, retypePassword } = req.body;

    // Validate password match
    if (password !== retypePassword) {
        return res.render('register', { errorMessage: 'Passwords do not match.' });
    }

    // Check if the mobile number is already registered
    if (users[mobileNumber]) {
        return res.render('register', { errorMessage: 'Mobile number is already registered.' });
    }

    // Store user data in the MySQL database
    connection.query(
        'INSERT INTO users (mobileNumber, username, password) VALUES (?, ?, ?)',
        [mobileNumber, username, password],
        (err, results) => {
            if (err) {
                console.error('Error inserting user data into the MySQL database:', err);
                return res.status(500).send('Error registering user');
            }

            // Redirect to the login page after successful registration
            res.redirect('/admin-login');
        }
    );
});

app.post('/deleteItem', (req, res) => {
    const itemId = req.body.itemId;

    connection.query('DELETE FROM items WHERE id = ?', [itemId], (err, results) => {
        if (err) {
            console.error('Error deleting item:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            console.log('Item deleted from MySQL database');
            res.json({ message: 'Item deleted successfully' });
        }
    });
});

app.post('/deleteScheme', (req, res) => {
    const schemeId = req.body.schemeId;

    connection.query('DELETE FROM schemes WHERE id = ?', [schemeId], (err, results) => {
        if (err) {
            console.error('Error deleting scheme:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            console.log('Scheme deleted from MySQL database');
            res.json({ message: 'Scheme deleted successfully' });
        }
    });
});

app.post('/editSchemeDescription', (req, res) => {
    const { schemeId, newDescription } = req.body;

    connection.query('UPDATE schemes SET description = ? WHERE id = ?', [newDescription, schemeId], (err, results) => {
        if (err) {
            console.error('Error updating scheme description:', err);
            res.status(500).json({ message: 'Error updating scheme description.' });
        } else {
            console.log('Scheme description updated in MySQL database');
            res.json({ message: 'Scheme description updated successfully.' });
        }
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening at http://localhost:${port}`);
});