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

import { ExpressMiddlewareInterface } from 'routing-controllers'
import { Request, Response } from 'express'
import { Service, Container } from 'typedi'
import { OAuth2Service } from '../services/OAuth2Service'
import { DEFAULT_OBP_API_VERSION } from '../../src/shared-constants'
import jwt from 'jsonwebtoken'

/**
 * OAuth2 Callback Middleware
 *
 * Handles the OAuth2/OIDC callback after user authentication.
 * This middleware:
 * 1. Validates the state parameter (CSRF protection)
 * 2. Retrieves the PKCE code verifier from session
 * 3. Exchanges the authorization code for tokens
 * 4. Fetches user information from the UserInfo endpoint
 * 5. Stores tokens and user info in the session
 * 6. Redirects the user back to the original page
 *
 * Flow:
 * OIDC Provider → /oauth2/callback?code=XXX&state=YYY → This Middleware → Original Page
 *
 * @see OAuth2AuthorizationMiddleware for the authorization initiation
 *
 * @example
 * // Usage in controller:
 * @UseBefore(OAuth2CallbackMiddleware)
 * export class OAuth2CallbackController {
 *   @Get('/oauth2/callback')
 *   callback(@Req() request: Request, @Res() response: Response): Response {
 *     return response
 *   }
 * }
 */
@Service()
export default class OAuth2CallbackMiddleware implements ExpressMiddlewareInterface {
  private oauth2Service: OAuth2Service

  constructor() {
    // Explicitly get OAuth2Service from the container to avoid injection issues
    this.oauth2Service = Container.get(OAuth2Service)
  }

  /**
   * Handle the OAuth2 callback
   *
   * @param {Request} request - Express request object
   * @param {Response} response - Express response object
   */
  async use(request: Request, response: Response): Promise<void> {
    console.log('OAuth2CallbackMiddleware: Processing OAuth2 callback')

    const session = request.session
    const code = request.query.code as string
    const state = request.query.state as string
    const error = request.query.error as string
    const errorDescription = request.query.error_description as string

    // Check for OAuth2 errors from provider
    if (error) {
      console.error('OAuth2CallbackMiddleware: OAuth2 error from provider:', error)
      console.error('  Description:', errorDescription || 'No description provided')

      this.cleanupSession(session)

      response.status(400).send(`
        <html>
          <head>
            <title>Authentication Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background-color: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
              h1 { color: #c00; }
              a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #0056b3; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Authentication Error</h1>
              <p><strong>Error:</strong> ${this.escapeHtml(error)}</p>
              ${errorDescription ? `<p><strong>Description:</strong> ${this.escapeHtml(errorDescription)}</p>` : ''}
              <p>Authentication failed. Please try again.</p>
            </div>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `)
      return
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('OAuth2CallbackMiddleware: Missing code or state parameter')
      console.error('  Code present:', !!code)
      console.error('  State present:', !!state)

      this.cleanupSession(session)

      response.status(400).send(`
        <html>
          <head>
            <title>Invalid Request</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background-color: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
              h1 { color: #c00; }
              a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #0056b3; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Invalid Callback Request</h1>
              <p>The authorization callback is missing required parameters.</p>
              <p>Please try logging in again.</p>
            </div>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `)
      return
    }

    // Validate state parameter (CSRF protection)
    const storedState = session['oauth2_state']
    if (!state || state !== storedState) {
      console.error('OAuth2CallbackMiddleware: State validation failed')
      console.error('  Received state:', state?.substring(0, 10) + '...')
      console.error('  Expected state:', storedState?.substring(0, 10) + '...')

      this.cleanupSession(session)

      response.status(400).send(`
        <html>
          <head>
            <title>Security Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background-color: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
              h1 { color: #c00; }
              a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #0056b3; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Security Validation Failed</h1>
              <p>The state parameter validation failed. This could indicate a CSRF attack.</p>
              <p>Please try logging in again.</p>
            </div>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `)
      return
    }

    // Get code verifier from session
    const codeVerifier = session['oauth2_code_verifier']
    if (!codeVerifier) {
      console.error('OAuth2CallbackMiddleware: Code verifier not found in session')
      console.error('  This could indicate session timeout or invalid session state')

      this.cleanupSession(session)

      response.status(400).send(`
        <html>
          <head>
            <title>Session Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background-color: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
              h1 { color: #c00; }
              a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #0056b3; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Session Error</h1>
              <p>Your session has expired or is invalid. The authentication process cannot continue.</p>
              <p>Please start the login process again.</p>
            </div>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `)
      return
    }

    // Check flow timestamp (prevent replay attacks)
    const flowTimestamp = session['oauth2_flow_timestamp']
    if (flowTimestamp) {
      const flowAge = Date.now() - flowTimestamp
      const maxFlowAge = 10 * 60 * 1000 // 10 minutes
      if (flowAge > maxFlowAge) {
        console.error('OAuth2CallbackMiddleware: Authorization flow expired')
        console.error('  Flow age:', Math.floor(flowAge / 1000), 'seconds')
        console.error('  Max age:', Math.floor(maxFlowAge / 1000), 'seconds')

        this.cleanupSession(session)

        response.status(400).send(`
          <html>
            <head>
              <title>Token Exchange Error</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { background-color: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
                h1 { color: #c00; }
                a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                a:hover { background-color: #0056b3; }
              </style>
            </head>
            <body>
              <div class="error">
                <h1>Token Exchange Failed</h1>
                <p>Failed to exchange authorization code for access token.</p>
                <p>Please try logging in again.</p>
              </div>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `)
        return
      }
    }

    try {
      console.log('OAuth2CallbackMiddleware: Exchanging authorization code for tokens')

      // Exchange authorization code for tokens
      const tokens = await this.oauth2Service.exchangeCodeForTokens(code, codeVerifier)

      console.log('OAuth2CallbackMiddleware: Tokens received successfully')
      console.log('  Access token present:', !!tokens.accessToken)
      console.log('  Refresh token present:', !!tokens.refreshToken)
      console.log('  ID token present:', !!tokens.idToken)

      // Get user info from UserInfo endpoint
      console.log('OAuth2CallbackMiddleware: Fetching user info')
      const userInfo = await this.oauth2Service.getUserInfo(tokens.accessToken)

      // Debug: Decode access token to see what user ID OBP-API will see
      try {
        const accessTokenDecoded: any = jwt.decode(tokens.accessToken)
        console.log('\n\n========================================')
        console.log('🔍 ACCESS TOKEN DECODED - THIS IS WHAT OBP-API SEES')
        console.log('========================================')
        console.log('  sub (user ID):', accessTokenDecoded?.sub)
        console.log('  email:', accessTokenDecoded?.email)
        console.log('  preferred_username:', accessTokenDecoded?.preferred_username)
        console.log('  Full payload:', JSON.stringify(accessTokenDecoded, null, 2))
        console.log('========================================\n\n')
      } catch (error) {
        console.warn('OAuth2CallbackMiddleware: Failed to decode access token:', error)
      }

      // Store tokens in session
      session['oauth2_access_token'] = tokens.accessToken
      session['oauth2_refresh_token'] = tokens.refreshToken || null
      session['oauth2_id_token'] = tokens.idToken || null
      session['oauth2_token_type'] = tokens.tokenType
      session['oauth2_expires_in'] = tokens.expiresIn
      session['oauth2_token_timestamp'] = Date.now()

      // Store user info
      session['oauth2_user_info'] = userInfo

      // Decode ID token for additional user data
      let idTokenPayload: any = null
      if (tokens.idToken) {
        try {
          idTokenPayload = this.oauth2Service.decodeIdToken(tokens.idToken)
        } catch (error) {
          console.warn('OAuth2CallbackMiddleware: Failed to decode ID token:', error)
        }
      }

      // Create unified user object combining UserInfo and ID token data
      const user = {
        sub: userInfo.sub,
        email: userInfo.email || idTokenPayload?.email,
        email_verified: userInfo.email_verified || idTokenPayload?.email_verified,
        name: userInfo.name || idTokenPayload?.name,
        given_name: userInfo.given_name || idTokenPayload?.given_name,
        family_name: userInfo.family_name || idTokenPayload?.family_name,
        preferred_username: userInfo.preferred_username || idTokenPayload?.preferred_username,
        username: userInfo.preferred_username || userInfo.email || userInfo.sub,
        picture: userInfo.picture || idTokenPayload?.picture,
        provider: 'oauth2'
      }

      session['oauth2_user'] = user

      // Create clientConfig for OBP API calls with OAuth2 Bearer token
      // This allows OBPClientService to work with OAuth2 authentication
      // Store session data for authenticated requests
      // Always use v5.1.0 for application infrastructure - stable and debuggable
      session['clientConfig'] = {
        baseUri: process.env.VITE_OBP_API_HOST || 'http://localhost:8080',
        version: DEFAULT_OBP_API_VERSION,
        oauth2: {
          accessToken: tokens.accessToken,
          tokenType: tokens.tokenType || 'Bearer'
        }
      }

      console.log('OAuth2CallbackMiddleware: User authenticated successfully')
      console.log('  User ID (sub):', user.sub)
      console.log('  Username:', user.username)
      console.log('  Email:', user.email)
      console.log('  Name:', user.name)
      console.log('OAuth2CallbackMiddleware: Created clientConfig for OBP API calls')

      // Clear OAuth2 flow parameters (keep tokens and user data)
      delete session['oauth2_state']
      delete session['oauth2_code_verifier']
      delete session['oauth2_flow_timestamp']

      // Get redirect page and clean up
      const redirectPage =
        (session['oauth2_redirect_page'] as string) || process.env.VITE_OBP_API_EXPLORER_HOST || '/'
      delete session['oauth2_redirect_page']

      console.log('OAuth2CallbackMiddleware: Redirecting to:', redirectPage)
      console.log('OAuth2CallbackMiddleware: Authentication flow complete')

      // Redirect to original page
      response.redirect(redirectPage)
    } catch (error: any) {
      console.error('OAuth2CallbackMiddleware: Token exchange or user info failed:', error)
      console.error('  Error message:', error.message)
      console.error('  Error stack:', error.stack)

      this.cleanupSession(session)

      response.status(500).send(`
        <html>
          <head>
            <title>Authentication Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background-color: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
              h1 { color: #c00; }
              a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #0056b3; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Authentication Failed</h1>
              <p>An unexpected error occurred during authentication.</p>
              <p>Please try logging in again.</p>
            </div>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `)
      return
    }
  }

  /**
   * Clean up OAuth2 session data
   *
   * @param {any} session - Express session object
   */
  private cleanupSession(session: any): void {
    delete session['oauth2_state']
    delete session['oauth2_code_verifier']
    delete session['oauth2_flow_timestamp']
    delete session['oauth2_redirect_page']
    delete session['oauth2_access_token']
    delete session['oauth2_refresh_token']
    delete session['oauth2_id_token']
    delete session['oauth2_token_type']
    delete session['oauth2_expires_in']
    delete session['oauth2_token_timestamp']
    delete session['oauth2_user_info']
    delete session['oauth2_user']
  }

  /**
   * Escape HTML to prevent XSS
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
  }
}
