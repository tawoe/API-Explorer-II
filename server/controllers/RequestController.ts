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

import { Controller, Session, Req, Res, Get, Delete, Post, Put } from 'routing-controllers'
import { Request, Response } from 'express'
import OBPClientService from '../services/OBPClientService.js'
import { Service, Container } from 'typedi'

@Service()
@Controller()
export class OBPController {
  private obpClientService: OBPClientService

  constructor() {
    // Explicitly get OBPClientService from the container to avoid injection issues
    this.obpClientService = Container.get(OBPClientService)
  }

  @Get('/get')
  async get(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    const path = request.query.path
    const oauthConfig = session['clientConfig']

    try {
      const result = await this.obpClientService.get(path as string, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      // 401 errors are expected when user is not authenticated - log as info, not error
      if (error.status === 401) {
        console.log(
          `[RequestController] 401 Unauthorized for path: ${path} (user not authenticated)`
        )
      } else {
        console.error('[RequestController] GET request error:', error)
      }
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }

  @Post('/create')
  async create(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    const path = request.query.path
    const data = request.body
    const oauthConfig = session['clientConfig']

    // Debug logging to diagnose authentication issues
    console.log('RequestController.create - Debug Info:')
    console.log('  Path:', path)
    console.log('  Session exists:', !!session)
    console.log('  Session keys:', session ? Object.keys(session) : 'N/A')
    console.log('  clientConfig exists:', !!oauthConfig)
    console.log('  oauth2 exists:', oauthConfig?.oauth2 ? 'YES' : 'NO')
    console.log('  accessToken exists:', oauthConfig?.oauth2?.accessToken ? 'YES' : 'NO')
    console.log('  oauth2_user exists:', session?.oauth2_user ? 'YES' : 'NO')

    try {
      const result = await this.obpClientService.create(path as string, data, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      console.error('RequestController.create error:', error)
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }

  @Put('/update')
  async update(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    const path = request.query.path
    const data = request.body
    const oauthConfig = session['clientConfig']

    try {
      const result = await this.obpClientService.update(path as string, data, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      console.error('RequestController.update error:', error)
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }

  @Delete('/delete')
  async delete(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    const path = request.query.path
    const oauthConfig = session['clientConfig']

    try {
      const result = await this.obpClientService.discard(path as string, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      console.error('RequestController.delete error:', error)
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }
}
