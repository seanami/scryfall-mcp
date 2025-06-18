#!/usr/bin/env node
import fetch, { Response } from 'node-fetch';
import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { parse } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  ScryfallCardListSchema,
  ScryfallCardSchema,
  renderCard,
  renderCardList,
} from './src/scryfall/card';
import { ScryfallError } from './src/scryfall/error';
import { ScryfallRulingListSchema, renderRulingList } from './src/scryfall/ruling';

/**
 * Scryfall API references:
 *  - https://api.scryfall.com
 *  - https://scryfall.com/docs/api
 *
 * The server below exposes several tools:
 * 1) search_cards        - Perform a text query and list matching cards
 * 2) get_card_by_id      - Get a card by Scryfall ID (UUID)
 * 3) get_card_by_name    - Get a card by exact name
 * 4) get_cards_by_names  - Get cards by exact names
 * 5) random_card         - Get a random card
 * 6) get_rulings         - Retrieve rulings (official text on card interactions) by card ID
 * 7) get_prices          - Get card prices for a specified card ID or exact name
 *
 * Each tool returns data in JSON format as a single text field.
 */

// Tools definitions
const SEARCH_CARDS_TOOL: Tool = {
  name: 'search_cards',
  description:
    "Search for MTG cards by a text query, e.g. 'oracle text includes: draw cards'. " +
    'Returns a list of matching cards with fields as Markdown, including their Scryfall IDs. ' +
    'If no matches are found, returns an error message from Scryfall.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "A full text query, e.g. 't:goblin pow=2 o:haste'",
      },
    },
    required: ['query'],
  },
};

const GET_CARD_BY_ID_TOOL: Tool = {
  name: 'get_card_by_id',
  description:
    'Retrieve a card by its Scryfall ID (a 36-char UUID). Returns the card data as Markdown.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: "The Scryfall UUID, e.g. 'c09c71fb-7acb-4ffb-a47b-8961a0cf4990'",
      },
    },
    required: ['id'],
  },
};

const GET_CARD_BY_NAME_TOOL: Tool = {
  name: 'get_card_by_name',
  description:
    "Retrieve a card by its exact English name, e.g. 'Black Lotus'. Returns the card data as Markdown, including its Scryfall ID. " +
    'If multiple cards share that exact name, Scryfall returns one (usually the most relevant printing).',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: "Exact name of the card, e.g. 'Lightning Bolt'",
      },
    },
    required: ['name'],
  },
};

const GET_CARDS_BY_NAMES_TOOL: Tool = {
  name: 'get_cards_by_names',
  description:
    'Retrieve multiple cards by their exact names. Returns a Markdown string for each card, including their Scryfall IDs. ' +
    'All requests are made in parallel for better performance, so use this when you need to get multiple cards at once.',
  inputSchema: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Array of exact card names to look up',
      },
    },
    required: ['names'],
  },
};

const RANDOM_CARD_TOOL: Tool = {
  name: 'random_card',
  description:
    'Retrieve a random Magic card from Scryfall. Returns data for that random card as Markdown.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const GET_RULINGS_TOOL: Tool = {
  name: 'get_rulings',
  description:
    'Retrieve official rulings for a specified card by Scryfall ID. ' +
    'Returns list of rulings as Markdown. Rulings can help to understand how a card works in the game.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: "A Scryfall ID. Example: 'c09c71fb-7acb-4ffb-a47b-8961a0cf4990'",
      },
    },
    required: ['id'],
  },
};

// Return our set of tools
const SCRYFALL_TOOLS = [
  SEARCH_CARDS_TOOL,
  GET_CARD_BY_ID_TOOL,
  GET_CARD_BY_NAME_TOOL,
  GET_CARDS_BY_NAMES_TOOL,
  RANDOM_CARD_TOOL,
  GET_RULINGS_TOOL,
] as const;

// Helper to handle Scryfall responses
async function handleScryfallResponse(
  response: Response
): Promise<{ isError: true; error: string } | { isError: false; data: unknown }> {
  if (!response.ok) {
    // Attempt to parse Scryfall error
    let errorObj: ScryfallError | null = null;
    try {
      errorObj = (await response.json()) as ScryfallError;
    } catch {
      // fall back to generic
    }
    if (errorObj && errorObj.object === 'error') {
      return {
        error: `Scryfall error: ${errorObj.details} (code=${errorObj.code}, status=${errorObj.status})`,
        isError: true,
      };
    } else {
      return {
        error: `HTTP error ${response.status}: ${response.statusText}`,
        isError: true,
      };
    }
  }
  // If okay, parse JSON
  const data = await response.json();
  return {
    data,
    isError: false,
  };
}

// MCP helpers
function mcpError(error: string) {
  return {
    content: [{ type: 'text', text: error }],
    isError: true,
  };
}

function mcpText(text: string) {
  return {
    content: [{ type: 'text', text }],
    isError: false,
  };
}

function mcpCombinedTextOrError(
  results: (ReturnType<typeof mcpText> | ReturnType<typeof mcpError>)[]
) {
  const errors = results.filter(result => result.isError);
  if (errors.length > 0) {
    return { content: errors.map(error => error.content), isError: true };
  }
  return { content: results.map(result => result.content), isError: false };
}

// Actual call handlers
async function handleSearchCards(query: string) {
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
  const response = await handleScryfallResponse(await fetch(url));
  if (response.isError) {
    return mcpError(response.error);
  }
  const cardListResult = await ScryfallCardListSchema.safeParseAsync(response.data);
  if (!cardListResult.success) {
    return mcpError(`Invalid response from Scryfall: ${cardListResult.error.message}`);
  }
  // TODO: Handle pagination
  const cardList = cardListResult.data;
  const renderedCards = renderCardList(cardList, { depth: 1 });
  return mcpText(renderedCards);
}

async function handleGetCardById(id: string) {
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(id)}`;
  const response = await handleScryfallResponse(await fetch(url));
  if (response.isError) {
    return mcpError(response.error);
  }
  const cardResult = await ScryfallCardSchema.safeParseAsync(response.data);
  if (!cardResult.success) {
    return mcpError(`Invalid response from Scryfall: ${cardResult.error.message}`);
  }
  const card = cardResult.data;
  const renderedCard = renderCard(card, { depth: 1 });
  return mcpText(renderedCard);
}

async function handleGetCardByName(name: string) {
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  const response = await handleScryfallResponse(await fetch(url));
  if (response.isError) {
    return mcpError(response.error);
  }
  const cardResult = await ScryfallCardSchema.safeParseAsync(response.data);
  if (!cardResult.success) {
    return mcpError(`Invalid response from Scryfall: ${cardResult.error.message}`);
  }
  const card = cardResult.data;
  const renderedCard = renderCard(card, { depth: 1 });
  return mcpText(renderedCard);
}

async function handleGetCardsByNames(names: string[]) {
  const results = await Promise.all(names.map(handleGetCardByName));
  return mcpCombinedTextOrError(results);
}

async function handleRandomCard() {
  const url = 'https://api.scryfall.com/cards/random';
  const response = await handleScryfallResponse(await fetch(url));
  if (response.isError) {
    return mcpError(response.error);
  }
  const cardResult = await ScryfallCardSchema.safeParseAsync(response.data);
  if (!cardResult.success) {
    return mcpError(`Invalid response from Scryfall: ${cardResult.error.message}`);
  }
  const card = cardResult.data;
  const renderedCard = renderCard(card, { depth: 1 });
  return mcpText(renderedCard);
}

async function handleGetRulings(id: string) {
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(id)}/rulings`;
  const response = await handleScryfallResponse(await fetch(url));
  if (response.isError) {
    return mcpError(response.error);
  }
  const rulingListResult = await ScryfallRulingListSchema.safeParseAsync(response.data);
  if (!rulingListResult.success) {
    return mcpError(`Invalid response from Scryfall: ${rulingListResult.error.message}`);
  }
  const rulingList = rulingListResult.data;
  const renderedRulings = renderRulingList(rulingList, { depth: 1 });
  return mcpText(renderedRulings);
}

// A map of sessionId -> { transport, server } for SSE connections
const transportsBySession = new Map<string, { transport: SSEServerTransport; server: Server }>();

// Create a new server instance with all our handlers
function createScryfallServer() {
  const newServer = new Server(
    {
      name: 'mcp-server/scryfall',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Set up our request handlers
  newServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: SCRYFALL_TOOLS,
  }));

  newServer.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const { name, arguments: args } = request.params;
      switch (name) {
        case 'search_cards': {
          const { query } = args as { query: string };
          return await handleSearchCards(query);
        }
        case 'get_card_by_id': {
          const { id } = args as { id: string };
          return await handleGetCardById(id);
        }
        case 'get_card_by_name': {
          const { name } = args as { name: string };
          return await handleGetCardByName(name);
        }
        case 'get_cards_by_names': {
          const { names } = args as { names: string[] };
          return await handleGetCardsByNames(names);
        }
        case 'random_card': {
          return await handleRandomCard();
        }
        case 'get_rulings': {
          const { id } = args as { id: string };
          return await handleGetRulings(id);
        }
        default:
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unknown tool name "${name}"`,
              },
            ],
            isError: true,
          };
      }
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return newServer;
}

// Start the server with either stdio or SSE transport
async function runServer() {
  const argv = await yargs(hideBin(process.argv))
    .option('sse', {
      type: 'boolean',
      description: 'Use SSE transport instead of stdio',
      default: false,
    })
    .option('port', {
      type: 'number',
      description: 'Port to use for SSE transport',
      default: 3000,
    })
    .help().argv;

  if (argv.sse) {
    const httpServer = createServer(
      async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const url = parse(req.url ?? '', true);

        if (req.method === 'GET' && url.pathname === '/sse') {
          // Client establishing SSE connection
          const transport = new SSEServerTransport('/messages', res);
          const scryfallServer = createScryfallServer();

          // Store them in our map for routing POSTs
          transportsBySession.set(transport.sessionId, {
            transport,
            server: scryfallServer,
          });

          // Set SSE headers
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          // Connect transport to server
          scryfallServer.connect(transport).catch(err => {
            console.error('Error attaching SSE transport:', err);
            res.end();
          });

          console.error(`New SSE connection established (session: ${transport.sessionId})`);

          // Return here - the response will be kept open for SSE
          return;
        } else if (req.method === 'POST' && url.pathname === '/messages') {
          // Client sending an MCP message over POST
          const sessionId = url.query.sessionId as string;
          const record = transportsBySession.get(sessionId);

          if (!record) {
            res.writeHead(404, 'Unknown session');
            res.end();
            return;
          }

          // Forward the POST body to this session's transport
          await record.transport.handlePostMessage(req, res);
          return;
        } else {
          res.writeHead(404, 'Not Found');
          res.end();
          return;
        }
      }
    );

    httpServer.listen(argv.port, () => {
      console.error(`Scryfall MCP Server listening on http://localhost:${argv.port}`);
    });
  } else {
    // Standard stdio mode
    const server = createScryfallServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Scryfall MCP Server running on stdio');
  }
}

runServer().catch(error => {
  console.error('Fatal error running Scryfall server:', error);
  process.exit(1);
});
