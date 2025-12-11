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

import { Controller, Session, Req, Res, Get } from 'routing-controllers'
import { Request, Response } from 'express'
import OBPClientService from '../services/OBPClientService'
import { Service, Container } from 'typedi'
import { OAuth2Service } from '../services/OAuth2Service'
import { DEFAULT_OBP_API_VERSION } from '../../src/shared-constants'

@Service()
@Controller('/user')
export class UserController {
  private obpExplorerHome = process.env.VITE_OBP_API_EXPLORER_HOST
  private obpClientService: OBPClientService
  private oauth2Service: OAuth2Service

  constructor() {
    // Explicitly get services from the container to avoid injection issues
    this.obpClientService = Container.get(OBPClientService)
    this.oauth2Service = Container.get(OAuth2Service)
  }

  @Get('/logoff')
  async logout(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    console.log('UserController: Logging out user')

    // Clear OAuth2 session data
    delete session['oauth2_access_token']
    delete session['oauth2_refresh_token']
    delete session['oauth2_id_token']
    delete session['oauth2_token_type']
    delete session['oauth2_expires_in']
    delete session['oauth2_token_timestamp']
    delete session['oauth2_user_info']
    delete session['oauth2_user']
    delete session['clientConfig']
    delete session['opeyConfig']

    // Destroy the session completely
    session.destroy((err: any) => {
      if (err) {
        console.error('UserController: Error destroying session:', err)
      } else {
        console.log('UserController: Session destroyed successfully')
      }
    })

    const redirectPage = (request.query.redirect as string) || this.obpExplorerHome || '/'

    if (!this.obpExplorerHome) {
      console.error(`VITE_OBP_API_EXPLORER_HOST: ${this.obpExplorerHome}`)
    }

    console.log('UserController: Redirecting to:', redirectPage)
    response.redirect(redirectPage)

    return response
  }

  @Get('/current')
  async current(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    console.log('UserController: Getting current user')

    // Check OAuth2 session
    if (session['oauth2_user']) {
      console.log('UserController: Returning OAuth2 user info')
      const oauth2User = session['oauth2_user']

      // Check if access token is expired and needs refresh
      const accessToken = session['oauth2_access_token']
      const refreshToken = session['oauth2_refresh_token']

      if (accessToken && this.oauth2Service.isTokenExpired(accessToken)) {
        console.log('UserController: Access token expired')

        if (refreshToken) {
          console.log('UserController: Attempting token refresh')
          try {
            const newTokens = await this.oauth2Service.refreshAccessToken(refreshToken)

            // Update session with new tokens
            session['oauth2_access_token'] = newTokens.accessToken
            session['oauth2_refresh_token'] = newTokens.refreshToken || refreshToken
            session['oauth2_id_token'] = newTokens.idToken
            session['oauth2_token_timestamp'] = Date.now()
            session['oauth2_expires_in'] = newTokens.expiresIn

            console.log('UserController: Token refresh successful')
          } catch (error) {
            console.error('UserController: Token refresh failed:', error)
            // Return empty object to indicate user needs to re-authenticate
            return response.json({})
          }
        } else {
          console.log('UserController: No refresh token available, user needs to re-authenticate')
          return response.json({})
        }
      }

      // Get actual user ID from OBP-API
      let obpUserId = oauth2User.sub // Default to sub if OBP call fails
      const clientConfig = session['clientConfig']

      if (clientConfig && clientConfig.oauth2?.accessToken) {
        try {
          // Always use v5.1.0 for application infrastructure - stable and debuggable
          const version = DEFAULT_OBP_API_VERSION
          console.log('UserController: Fetching OBP user from /obp/' + version + '/users/current')
          const obpUser = await this.obpClientService.get(
            `/obp/${version}/users/current`,
            clientConfig
          )
          if (obpUser && obpUser.user_id) {
            obpUserId = obpUser.user_id
            console.log('UserController: Got OBP user ID:', obpUserId, '(was:', oauth2User.sub, ')')
          } else {
            console.warn('UserController: OBP user response has no user_id:', obpUser)
          }
        } catch (error: any) {
          console.warn(
            'UserController: Could not fetch OBP user ID, using token sub:',
            oauth2User.sub
          )
          console.warn('UserController: Error details:', error.message)
        }
      } else {
        console.warn(
          'UserController: No valid clientConfig or access token, using token sub:',
          oauth2User.sub
        )
      }

      // Return user info in format compatible with frontend
      return response.json({
        user_id: obpUserId,
        username: oauth2User.username,
        email: oauth2User.email,
        email_verified: oauth2User.email_verified,
        name: oauth2User.name,
        given_name: oauth2User.given_name,
        family_name: oauth2User.family_name,
        provider: oauth2User.provider || 'oauth2'
      })
    }

    // No authentication session found
    console.log('UserController: No authentication session found')
    return response.json({})
  }
}
