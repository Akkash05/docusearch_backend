const express = require('express');
const router = express.Router();
const model = require('../models/filesearch');

router.get('/callback', (req, res, next) => {
    return model.getAccessToken(req, res, next);
})

router.post('/search', (req, res, next) => {
    return model.searchContent(req, res, next);
})

router.get('/authtoken', (req, res, next) => {
    return model.checkToken(req, res, next);
})

router.get('/getenv', (req, res, next) => {
    return model.getEnvProperties(req, res, next);
})

module.exports = router;