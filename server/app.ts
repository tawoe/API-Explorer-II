/*
 * Open Bank Project -  API Explorer II
 * Copyright (C) 2023-2024, TESOBE GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Email: contact@tesobe.com
 * TESOBE GmbH
 * Osloerstrasse 16/17
 * Berlin 13359, Germany
 *
 *   This product includes software developed at
 *   TESOBE (http://www.tesobe.com/)
 *
 */

import 'reflect-metadata'
import 'dotenv/config'
import session from 'express-session'
import RedisStore from 'connect-redis'
import { createClient } from 'redis'
import express, { Application } from 'express'
import { useExpressServer, useContainer } from 'routing-controllers'
import { Container } from 'typedi'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { OAuth2Service } from './services/OAuth2Service'

// Fix __dirname for ESM/tsx compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const port = 8085
const app: Application = express()

// Initialize Redis client.
console.log(`--- Redis setup -------------------------------------------------`)
process.env.VITE_OBP_REDIS_URL
  ? console.log(`VITE_OBP_REDIS_URL: ${process.env.VITE_OBP_REDIS_URL}`)
  : console.log(`VITE_OBP_REDIS_URL: undefined connects to localhost on port 6379`)

const redisPassword = process.env.VITE_OBP_REDIS_PASSWORD
  ? process.env.VITE_OBP_REDIS_PASSWORD // Redis instance is protected with a password
  : '' // Specify an empty password (i.e., no password) when connecting to Redis
if (!redisPassword) {
  console.warn(`VITE_OBP_REDIS_PASSWORD is not provided.`)
}
const redisUsername = process.env.VITE_OBP_REDIS_USERNAME
  ? process.env.VITE_OBP_REDIS_USERNAME // Redis instance is protected with a username/password
  : '' // Specify an empty username (i.e., no username) when connecting to Redis
if (!redisUsername) {
  console.warn(`VITE_OBP_REDIS_USERNAME is not provided.`)
}
console.log(`-----------------------------------------------------------------`)
const redisClient = process.env.VITE_OBP_REDIS_URL
  ? createClient({
      url: process.env.VITE_OBP_REDIS_URL,
      username: redisUsername,
      password: redisPassword
    })
  : createClient()
redisClient.connect().catch(console.error)

const redisUrl = process.env.VITE_OBP_REDIS_URL
  ? process.env.VITE_OBP_REDIS_URL
  : 'localhost on port 6379'

// Provide feedback in case of successful connection to Redis
redisClient.on('connect', () => {
  console.log(`Connected to Redis instance: ${redisUrl}`)
})
// Provide feedback in case of unsuccessful connection to Redis
redisClient.on('error', (err) => {
  console.error(`Error connecting to Redis instance: ${redisUrl}`, err)
})

// Initialize store.
let redisStore = new RedisStore({
  client: redisClient,
  prefix: 'api-explorer-ii:'
})

console.info(`Environment: ${app.get('env')}`)
app.use(express.json())
let sessionObject = {
  store: redisStore,
  secret: process.env.VITE_OPB_SERVER_SESSION_PASSWORD,
  resave: false,
  saveUninitialized: false, // Don't save empty sessions (better for authenticated apps)
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: process.env.VITE_SESSION_MAX_AGE
      ? parseInt(process.env.VITE_SESSION_MAX_AGE) * 1000
      : 60 * 60 * 1000 // Default: 1 hour in milliseconds (value in env should be in seconds)
  }
}
if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sessionObject.cookie.secure = true // serve secure cookies
}
app.use(session(sessionObject))
useContainer(Container)

// Initialize OAuth2 Service
console.log(`--- OAuth2/OIDC setup -------------------------------------------`)
const wellKnownUrl = process.env.VITE_OBP_OAUTH2_WELL_KNOWN_URL

// Async IIFE to initialize OAuth2 and start server
let instance: any
;(async function initializeAndStartServer() {
  if (!wellKnownUrl) {
    console.warn('VITE_OBP_OAUTH2_WELL_KNOWN_URL not set. OAuth2 will not function.')
    console.warn('Server will start but OAuth2 authentication will be unavailable.')
  } else {
    console.log(`OIDC Well-Known URL: ${wellKnownUrl}`)

    // Get OAuth2Service from container
    const oauth2Service = Container.get(OAuth2Service)

    // Initialize OAuth2 service from OIDC discovery document (await it!)
    try {
      await oauth2Service.initializeFromWellKnown(wellKnownUrl)
      console.log('OAuth2Service: Initialization successful')
      console.log('  Client ID:', process.env.VITE_OBP_OAUTH2_CLIENT_ID || 'NOT SET')
      console.log('  Redirect URI:', process.env.VITE_OBP_OAUTH2_REDIRECT_URL || 'NOT SET')
      console.log('OAuth2/OIDC ready for authentication')
    } catch (error: any) {
      console.error('OAuth2Service: Initialization failed:', error.message)
      console.error('OAuth2/OIDC authentication will not be available')
      console.error('Please check:')
      console.error('  1. OBP-OIDC server is running')
      console.error('  2. VITE_OBP_OAUTH2_WELL_KNOWN_URL is correct')
      console.error('  3. Network connectivity to OIDC provider')
      console.warn('Server will start but OAuth2 authentication will fail.')
    }
  }
  console.log(`-----------------------------------------------------------------`)

  const routePrefix = '/api'

  const server = useExpressServer(app, {
    routePrefix: routePrefix,
    controllers: [path.join(__dirname + '/controllers/*.*s')],
    middlewares: [path.join(__dirname + '/middlewares/*.*s')]
  })

  instance = server.listen(port)

  console.log(
    `Backend is running. You can check a status at http://localhost:${port}${routePrefix}/status`
  )

  // Get commit ID
  try {
    // Try to get the commit ID
    commitId = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
    console.log('Current Commit ID:', commitId)
  } catch (error) {
    // Log the error but do not terminate the process
    console.error('Warning: Failed to retrieve the commit ID. Proceeding without it.')
    console.error('Error details:', error.message)
    commitId = 'unknown' // Assign a fallback value
  }
  // Continue execution with or without a valid commit ID
  console.log('Execution continues with commitId:', commitId)

  // Error Handling to Shut Down the App
  instance.on('error', (err) => {
    redisClient.disconnect()
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`)
      process.exit(1)
      // Shut down the app
    } else {
      console.error('An error occurred:', err)
    }
  })
})()

// Export instance for use in other modules
export { instance }

// Commit ID variable
export let commitId = ''

export default app
