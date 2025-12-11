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
import { OAuth2Service } from '../services/OAuth2Service.js'
import { PKCEUtils } from '../utils/pkce.js'

/**
 * OAuth2 Authorization Middleware
 *
 * Initiates the OAuth2/OIDC authorization code flow with PKCE.
 * This middleware:
 * 1. Generates PKCE code verifier and challenge
 * 2. Generates state parameter for CSRF protection
 * 3. Stores these values in the session
 * 4. Redirects the user to the OIDC provider's authorization endpoint
 *
 * Flow:
 * User → /oauth2/connect → This Middleware → OIDC Authorization Endpoint
 *
 * @see OAuth2CallbackMiddleware for the callback handling
 *
 * @example
 * // Usage in controller:
 * @UseBefore(OAuth2AuthorizationMiddleware)
 * export class OAuth2ConnectController {
 *   @Get('/oauth2/connect')
 *   connect(@Req() request: Request, @Res() response: Response): Response {
 *     return response
 *   }
 * }
 */
@Service()
export default class OAuth2AuthorizationMiddleware implements ExpressMiddlewareInterface {
  private oauth2Service: OAuth2Service

  constructor() {
    // Explicitly get OAuth2Service from the container to avoid injection issues
    this.oauth2Service = Container.get(OAuth2Service)
  }

  /**
   * Handle the authorization request
   *
   * @param {Request} request - Express request object
   * @param {Response} response - Express response object
   */
  async use(request: Request, response: Response): Promise<void> {
    console.log('OAuth2AuthorizationMiddleware: Starting OAuth2 authorization flow')

    // Check if OAuth2 service exists and is initialized
    if (!this.oauth2Service) {
      console.error('OAuth2AuthorizationMiddleware: OAuth2 service is null/undefined')
      response.status(500).send('OAuth2 service not available. Please check server configuration.')
      return
    }

    if (!this.oauth2Service.isInitialized()) {
      console.error('OAuth2AuthorizationMiddleware: OAuth2 service not initialized')
      response
        .status(500)
        .send(
          'OAuth2 service not initialized. Please check server configuration and OIDC provider availability.'
        )
      return
    }

    const session = request.session
    const redirectPage = request.query.redirect

    // Store redirect page in session for post-authentication redirect
    if (redirectPage && typeof redirectPage === 'string') {
      session['oauth2_redirect_page'] = redirectPage
      console.log('OAuth2AuthorizationMiddleware: Will redirect to:', redirectPage)
    } else {
      // Default redirect to explorer home
      session['oauth2_redirect_page'] = process.env.VITE_OBP_API_EXPLORER_HOST || '/'
    }

    try {
      // Generate PKCE parameters
      const codeVerifier = PKCEUtils.generateCodeVerifier()
      const codeChallenge = PKCEUtils.generateCodeChallenge(codeVerifier)
      const state = PKCEUtils.generateState()

      // Validate generated values
      if (!PKCEUtils.isValidCodeVerifier(codeVerifier)) {
        throw new Error('Generated code verifier is invalid')
      }
      if (!PKCEUtils.isValidState(state)) {
        throw new Error('Generated state parameter is invalid')
      }

      // Store PKCE and state parameters in session for callback validation
      session['oauth2_state'] = state
      session['oauth2_code_verifier'] = codeVerifier
      session['oauth2_flow_timestamp'] = Date.now()

      console.log('OAuth2AuthorizationMiddleware: PKCE parameters generated')
      console.log('  Code verifier length:', codeVerifier.length)
      console.log('  Code challenge length:', codeChallenge.length)
      console.log('  State:', state.substring(0, 10) + '...')

      // Create authorization URL with OIDC scopes
      const scopes = ['openid', 'profile', 'email']
      const authUrl = this.oauth2Service.createAuthorizationURL(state, scopes)

      // Add PKCE challenge to authorization URL
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')

      console.log('OAuth2AuthorizationMiddleware: Authorization URL created')
      console.log('  URL:', authUrl.toString())
      console.log('  Scopes:', scopes.join(' '))
      console.log('  PKCE method: S256')

      // Redirect user to OIDC provider
      console.log('OAuth2AuthorizationMiddleware: Redirecting to OIDC provider...')
      response.redirect(authUrl.toString())
    } catch (error: any) {
      console.error('OAuth2AuthorizationMiddleware: Error creating authorization URL:', error)

      // Clean up session data on error
      delete session['oauth2_state']
      delete session['oauth2_code_verifier']
      delete session['oauth2_flow_timestamp']
      delete session['oauth2_redirect_page']

      response.status(500).send(`Failed to initiate OAuth2 flow: ${error.message}`)
      return
    }
  }
}
