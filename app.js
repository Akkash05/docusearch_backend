const express = require("express");
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

require('dotenv').config();

const fileSearch = require('./controllers/filesearch');
const model = require('./models/filesearch')

model.createInitialTables();

app.use('/filesearch', fileSearch);

app.use('/welcome', (req, res, next) => {
    return res.status(200).send({
        success: true,
        message: 'Welcome to file search - services',
        data: null,
        error: null
    });
});

app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
})

app.use((error, req, res, next) => {
    return res.status(error.status || 500).json({
        success: false,
        message: 'Error Occured',
        data: null,
        error: error.message
    })
})

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.listen(process.env.PORT, (err) => {
    if (err) {
        console.log(`Server failed to start : ${err}`);
    }
    else {
        console.log(`Server is running at http://localhost:${process.env.PORT}`);
    }
});
