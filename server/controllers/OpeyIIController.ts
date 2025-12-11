import { Controller, Session, Req, Res, Post, Get } from 'routing-controllers'
import { Request, Response } from 'express'
import { Readable } from 'node:stream'
import { ReadableStream as WebReadableStream } from 'stream/web'
import { Service, Container } from 'typedi'
import OBPClientService from '../services/OBPClientService'
import OpeyClientService from '../services/OpeyClientService'
import OBPConsentsService from '../services/OBPConsentsService'

import { UserInput, OpeyConfig } from '../schema/OpeySchema'
import {
  APIApi,
  Configuration,
  ConsentApi,
  ConsumerConsentrequestsBody,
  InlineResponse20151
} from 'obp-api-typescript'

@Service()
@Controller('/opey')
export class OpeyController {
  public obpClientService: OBPClientService
  public opeyClientService: OpeyClientService
  public obpConsentsService: OBPConsentsService

  constructor() {
    // Explicitly get services from the container to avoid injection issues
    this.obpClientService = Container.get(OBPClientService)
    this.opeyClientService = Container.get(OpeyClientService)
    this.obpConsentsService = Container.get(OBPConsentsService)
  }

  @Get('/')
  async getStatus(@Res() response: Response): Promise<Response | any> {
    try {
      const opeyStatus = await this.opeyClientService.getOpeyStatus()
      console.log('Opey status: ', opeyStatus)
      return response.status(200).json({ status: 'Opey is running' })
    } catch (error) {
      console.error('Error in /opey endpoint: ', error)
      return response.status(500).json({ error: 'Internal Server Error' })
    }
  }

  @Post('/stream')
  async streamOpey(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    if (!session) {
      console.error('Session not found')
      return response.status(401).json({ error: 'Session Time Out' })
    }
    // Check if the consent is in the session, and can be added to the headers
    const opeyConfig = session['opeyConfig']
    if (!opeyConfig) {
      console.error('Opey config not found in session')
      return response.status(500).json({ error: 'Internal Server Error' })
    }

    // Read user input from request body
    let user_input: UserInput
    try {
      console.log('Request body: ', request.body)
      user_input = {
        message: request.body.message,
        thread_id: request.body.thread_id,
        is_tool_call_approval: request.body.is_tool_call_approval
      }
    } catch (error) {
      console.error('Error in stream endpoint, could not parse into UserInput: ', error)
      return response.status(500).json({ error: 'Internal Server Error' })
    }

    // Transform to decode and log the stream
    const frontendTransformer = new TransformStream({
      transform(chunk, controller) {
        // Decode the chunk to a string
        const decodedChunk = new TextDecoder().decode(chunk)

        console.log('Sending chunk', decodedChunk)
        controller.enqueue(decodedChunk)
      },
      flush(controller) {
        console.log('[flush]')
        // Close ReadableStream when done
        controller.terminate()
      }
    })

    let stream: ReadableStream | null = null

    try {
      // Read web stream from OpeyClientService
      console.log('Calling OpeyClientService.stream')
      stream = await this.opeyClientService.stream(user_input, opeyConfig)
    } catch (error) {
      console.error('Error reading stream: ', error)
      return response.status(500).json({ error: 'Internal Server Error' })
    }

    if (!stream) {
      console.error('Stream is not recieved or not readable')
      return response.status(500).json({ error: 'Internal Server Error' })
    }

    // Transform our stream if needed, right now this is just a passthrough
    const frontendStream: ReadableStream = stream.pipeThrough(frontendTransformer)

    // If we need to split the stream into two, we can use the tee method as below

    // const streamTee = langchainStream.tee()
    // if (!streamTee) {
    //   console.error("Stream is not tee'd")
    //   return response.status(500).json({ error: 'Internal Server Error' })
    // }
    // const [stream1, stream2] = streamTee

    // function to convert a web stream to a node stream
    const safeFromWeb = (webStream: WebReadableStream<any>): Readable => {
      if (typeof Readable.fromWeb === 'function') {
        return Readable.fromWeb(webStream)
      } else {
        console.warn('Readable.fromWeb is not available, using a polyfill')

        // Create a Node.js Readable stream
        const nodeReadable = new Readable({
          read() {}
        })

        // Pump data from webreadable to node readable stream
        const reader = webStream.getReader()

        ;(async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()

              if (done) {
                nodeReadable.push(null) // end stream
                break
              }

              nodeReadable.push(value)
            }
          } catch (error) {
            console.error('Error reading from web stream:', error)
            nodeReadable.destroy(error instanceof Error ? error : new Error(error))
          }
        })()

        return nodeReadable
      }
    }

    const nodeStream = safeFromWeb(frontendStream as WebReadableStream<any>)

    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')

    nodeStream.pipe(response)

    return new Promise<Response>((resolve, reject) => {
      nodeStream.on('end', () => {
        resolve(response)
      })
      nodeStream.on('error', (error) => {
        console.error('Stream error:', error)
        reject(error)
      })

      // Add a timeout to prevent hanging promises
      const timeout = setTimeout(() => {
        console.warn('Stream timeout reached')
        resolve(response)
      }, 30000)

      // Clear the timeout when stream ends
      nodeStream.on('end', () => clearTimeout(timeout))
      nodeStream.on('error', () => clearTimeout(timeout))
    })
  }

  @Post('/invoke')
  async invokeOpey(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response | any> {
    // Check if the consent is in the session, and can be added to the headers
    const opeyConfig = session['opeyConfig']
    if (!opeyConfig) {
      console.error('Opey config not found in session')
      return response.status(500).json({ error: 'Internal Server Error' })
    }

    let user_input: UserInput
    try {
      user_input = {
        message: request.body.message,
        thread_id: request.body.thread_id,
        is_tool_call_approval: request.body.is_tool_call_approval
      }
    } catch (error) {
      console.error('Error in invoke endpoint, could not parse into UserInput: ', error)
      return response.status(500).json({ error: 'Internal Server Error' })
    }

    try {
      const opey_response = await this.opeyClientService.invoke(user_input, opeyConfig)

      //console.log("Opey response: ", opey_response)
      return response.status(200).json(opey_response)
    } catch (error) {
      console.error(error)
      return response.status(500).json({ error: 'Internal Server Error' })
    }
  }

  // @Post('/consent/request')
  // /**
  //  * Retrieves a consent request from OBP
  //  *
  //  */
  // async getConsentRequest(
  //     @Session() session: any,
  //     @Req() request: Request,
  //     @Res() response: Response,
  // ): Promise<Response | any> {
  //   try {

  //     let obpToken: string

  //     obpToken = await this.obpClientService.getDirectLoginToken()
  //     console.log("Got token: ", obpToken)
  //     const authHeader = `DirectLogin token="${obpToken}"`
  //     console.log("Auth header: ", authHeader)

  //     //const obpOAuthHeaders = await this.obpClientService.getOAuthHeader('/consents', 'POST')
  //     //console.log("OBP OAuth Headers: ", obpOAuthHeaders)

  //     const obpConfig: Configuration = {
  //       apiKey: authHeader,
  //       basePath: process.env.VITE_OBP_API_HOST,
  //     }

  //     console.log("OBP Config: ", obpConfig)

  //     const consentAPI = new ConsentApi(obpConfig, process.env.VITE_OBP_API_HOST)

  //     // OBP sdk naming is a bit mad, can be rectified in the future
  //     const consentRequestResponse = await consentAPI.oBPv500CreateConsentRequest({
  //         accountAccess: [],
  //         everything: false,
  //         entitlements: [],
  //         consumerId: '',
  //       } as unknown as ConsumerConsentrequestsBody,
  //       {
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //       }
  //     )

  //     //console.log("Consent request response: ", consentRequestResponse)

  //     console.log({consentId: consentRequestResponse.data.consent_request_id})
  //     session['obpConsentRequestId'] = consentRequestResponse.data.consent_request_id

  //     return response.status(200).json(JSON.stringify({consentId: consentRequestResponse.data.consent_request_id}))
  //     //console.log(await response.body.json())

  //   } catch (error) {
  //     console.error("Error in consent/request endpoint: ", error);
  //     return response.status(500).json({ error: 'Internal Server Error' });
  //   }
  // }

  @Post('/consent')
  /**
   * Retrieves a consent from OBP for the current user
   */
  async getConsent(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response | any> {
    try {
      // create consent as logged in user
      const opeyConfig = await this.opeyClientService.getOpeyConfig()
      session['opeyConfig'] = opeyConfig

      // Check if user already has a consent for opey
      // If so, return the consent id
      const consentId = await this.obpConsentsService.getExistingOpeyConsentId(session)

      if (consentId) {
        console.log('Existing consent ID: ', consentId)
        // If we have a consent id, we can get the consent from OBP
        const consent = await this.obpConsentsService.getConsentByConsentId(session, consentId)

        return response.status(200).json({ consent_id: consent.consent_id, jwt: consent.jwt })
      } else {
        console.log('No existing consent ID found')
      }
      // Either here or in this method, we should check if there is already a consent stored in the session

      await this.obpConsentsService.createConsent(session)

      console.log('Consent at controller: ', session['opeyConfig'])

      const authConfig = session['opeyConfig']['authConfig']

      return response
        .status(200)
        .json({ consent_id: authConfig?.obpConsent.consent_id, jwt: authConfig?.obpConsent.jwt })
    } catch (error) {
      console.error('Error in consent endpoint: ', error)
      return response.status(500).json({ error: 'Internal Server Error ' })
    }
  }

  // @Post('/consent/answer-challenge')
  // /**
  //  * Endpoint to answer the consent challenge with code i.e. SMS or email OTP for SCA
  //  * If successful, returns a Consent-JWT for use by Opey to access endpoints/ roles that the consenting user has
  //  * This completes (i.e. is the final step in) the consent flow
  //  */
  // async answerConsentChallenge(
  //   @Session() session: any,
  //   @Req() request: Request,
  //   @Res() response: Response
  // ): Promise<Response | any> {
  //   try {
  //     const oauthConfig = session['clientConfig']
  //     const version = this.obpClientService.getOBPVersion()

  //     const obpConsent = session['obpConsent']
  //     if (!obpConsent) {
  //       return response.status(400).json({ message: 'Consent not found in session' });
  //     } else if (obpConsent.status === 'ACCEPTED') {
  //       return response.status(400).json({ message: 'Consent already accepted' });
  //     }
  //     const answerBody = request.body

  //     const consentJWT = await this.obpClientService.create(`/obp/${version}/banks/gh.29.uk/consents/${obpConsent.consent_id}/challenge`, answerBody, oauthConfig)
  //     console.log("Consent JWT: ", consentJWT)
  //     // store consent JWT in session, return consent JWT 200 OK
  //     session['obpConsentJWT'] = consentJWT
  //     return response.status(200).json(true);

  //   } catch (error) {
  //     console.error("Error in consent/answer-challenge endpoint: ", error);
  //     return response.status(500).json({ error: 'Internal Server Error' });
  //   }

  // }
}
