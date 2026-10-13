const express = require('express');
const app = express()

//USE PROXY SERVER TO REDIRECT THE INCOMMING REQUEST
const httpProxy = require('http-proxy')
const proxy = httpProxy.createProxyServer();

const jwt = require('jsonwebtoken')
require('dotenv').config()
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRETE || 'development-secret-change-me';
const userServiceTargets = (
    process.env.USER_SERVICE_URLS ||
    process.env.USER_SERVICE_URL ||
    'http://127.0.0.1:5000'
).split(',').map((target) => target.trim()).filter(Boolean);
if (userServiceTargets.length === 0) {
    throw new Error('Configure at least one User Service URL');
}
let nextUserServiceIndex = 0;

function authToken(req, res, next) {
    const authorization = req.headers.authorization || '';
    const [scheme, token, ...extra] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token || extra.length > 0) {
        return res.status(401).json({ message: 'Bearer token is required' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
}

function authRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        next();
    }
}

// REDIRECT TO THE REGISTRATION MICROSERVICE
app.use('/register', (req, res) => {
    proxy.web(req, res, {
        target: process.env.REGISTRATION_SERVICE_URL || 'http://127.0.0.1:5001'
    });
})

// REDIRECT TO THE USER MICROSERVICE
app.use('/user', authToken, authRole('user'), (req, res) => {
    const target = userServiceTargets[nextUserServiceIndex];
    nextUserServiceIndex = (nextUserServiceIndex + 1) % userServiceTargets.length;
    console.log(`Routing user request to ${target}`);
    proxy.web(req, res, { target }, (error) => {
        console.error(`Unable to reach User Service at ${target}`, error);
        if (!res.headersSent && !res.destroyed) {
            res.status(502).json({ message: 'User Service is unavailable' });
        }
    });
})

// REDIRECT TO THE ADMIN MICROSERVICE
app.use('/admin', authToken, authRole('admin'), (req, res) => {
    proxy.web(req, res, { target: process.env.ADMIN_SERVICE_URL || 'http://127.0.0.1:5003' });
})

//REDIRECT TO THE LOGIN(Authentication) MICROSERVICE
app.use('/auth', (req, res) => {
    proxy.web(req, res, {
        target: process.env.LOGIN_SERVICE_URL || 'http://127.0.0.1:5002'
    });
})

if (require.main === module) {
    app.listen(4000, () => {
        console.log("API Gateway Service is running on port 4000")
    })
}

module.exports = app;