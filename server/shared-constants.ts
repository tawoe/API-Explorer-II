/*
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

// DEFAULT_OBP_API_VERSION is used in case the environment variable VITE_OBP_API_VERSION is not set
export const DEFAULT_OBP_API_VERSION = 'v5.1.0'

// Hardcoded API versions for all application endpoints
// Using v5.1.0 as the standard stable version - more stable than v6.0.0 and bugs can be fixed
// These versions should NOT change based on user's documentation version selection in the UI

/**
 * Resource documentation endpoint version
 * Endpoint: GET /obp/{version}/resource-docs/{docVersion}/obp
 */
export const RESOURCE_DOCS_API_VERSION = 'v5.1.0'

/**
 * Message documentation endpoint version
 * Endpoint: GET /obp/{version}/message-docs/{connector}
 */
export const MESSAGE_DOCS_API_VERSION = 'v5.1.0'

/**
 * API versions list endpoint version
 * Endpoint: GET /obp/{version}/api/versions
 */
export const API_VERSIONS_LIST_API_VERSION = 'v5.1.0'

/**
 * Glossary endpoint version
 * Endpoint: GET /obp/{version}/api/glossary
 */
export const GLOSSARY_API_VERSION = 'v5.1.0'

