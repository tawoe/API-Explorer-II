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
import OAuth2AuthorizationMiddleware from '../middlewares/OAuth2AuthorizationMiddleware'

/**
 * OAuth2 Connect Controller
 *
 * Handles the OAuth2/OIDC login initiation endpoint.
 * This controller triggers the OAuth2 authorization flow by delegating to
 * the OAuth2AuthorizationMiddleware which generates PKCE parameters and
 * redirects to the OIDC provider.
 *
 * Endpoint: GET /oauth2/connect
 *
 * Query Parameters:
 *   - redirect (optional): URL to redirect to after successful authentication
 *
 * Flow:
 *   User clicks login → /oauth2/connect → OAuth2AuthorizationMiddleware
 *   → OIDC Provider Authorization Endpoint
 *
 * @example
 * // User initiates login
 * <a href="/oauth2/connect?redirect=/messages">Login</a>
 *
 * // JavaScript redirect
 * window.location.href = '/oauth2/connect?redirect=' + encodeURIComponent(window.location.pathname)
 */
@Service()
@Controller()
@UseBefore(OAuth2AuthorizationMiddleware)
export class OAuth2ConnectController {
  /**
   * Initiate OAuth2/OIDC authentication flow
   *
   * The actual logic is handled by OAuth2AuthorizationMiddleware.
   * This method exists only as the routing endpoint definition.
   *
   * @param {Request} request - Express request object
   * @param {Response} response - Express response object (redirected by middleware)
   * @returns {Response} Response object (handled by middleware)
   */
  @Get('/oauth2/connect')
  connect(@Req() request: Request, @Res() response: Response): Response {
    // The middleware handles all the logic and redirects the user
    // This method should never actually execute
    return response
  }
}
