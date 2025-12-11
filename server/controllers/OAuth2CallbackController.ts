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

import { Controller, Req, Res, Get, UseBefore } from 'routing-controllers'
import { Request, Response } from 'express'
import { Service } from 'typedi'
import OAuth2CallbackMiddleware from '../middlewares/OAuth2CallbackMiddleware'

/**
 * OAuth2 Callback Controller
 *
 * Handles the OAuth2/OIDC callback from the identity provider.
 * This controller receives the authorization code and state parameter
 * after the user authenticates with the OIDC provider.
 *
 * The OAuth2CallbackMiddleware handles:
 * - State validation (CSRF protection)
 * - Authorization code exchange for tokens
 * - User info retrieval
 * - Session storage
 * - Redirect to original page
 *
 * Endpoint: GET /oauth2/callback
 *
 * Query Parameters (from OIDC provider):
 *   - code: Authorization code to exchange for tokens
 *   - state: State parameter for CSRF validation
 *   - error (optional): Error code if authentication failed
 *   - error_description (optional): Human-readable error description
 *
 * Flow:
 *   OIDC Provider → /oauth2/callback?code=XXX&state=YYY
 *   → OAuth2CallbackMiddleware → Original Page (with authenticated session)
 *
 * Success Flow:
 *   1. Validate state parameter
 *   2. Exchange authorization code for tokens (access, refresh, ID)
 *   3. Fetch user information from UserInfo endpoint
 *   4. Store tokens and user data in session
 *   5. Redirect to original page or home
 *
 * Error Flow:
 *   1. Parse error from query parameters
 *   2. Display user-friendly error page
 *   3. Allow user to retry authentication
 *
 * @example
 * // Successful callback URL from OIDC provider
 * http://localhost:5173/oauth2/callback?code=abc123&state=xyz789
 *
 * // Error callback URL from OIDC provider
 * http://localhost:5173/oauth2/callback?error=access_denied&error_description=User%20cancelled
 */
@Service()
@Controller()
@UseBefore(OAuth2CallbackMiddleware)
export class OAuth2CallbackController {
  /**
   * Handle OAuth2/OIDC callback
   *
   * The actual logic is handled by OAuth2CallbackMiddleware.
   * This method exists only as the routing endpoint definition.
   *
   * @param {Request} request - Express request object with query params (code, state)
   * @param {Response} response - Express response object (redirected by middleware)
   * @returns {Response} Response object (handled by middleware)
   */
  @Get('/oauth2/callback')
  callback(@Req() request: Request, @Res() response: Response): Response {
    // The middleware handles all the logic and redirects the user
    // This method should never actually execute
    return response
  }
}
