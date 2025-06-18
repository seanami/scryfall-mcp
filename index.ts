#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch, { Response } from 'node-fetch';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { parse } from 'node:url';
import { z } from 'zod/v4';

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

const ScryfallErrorSchema = z
  .object({
    object: z.literal('error'),
    code: z
      .string()
      .describe('A computer-friendly string representing the appropriate HTTP status code'),
    status: z.number().describe('An integer HTTP status code for this error'),
    details: z.string().describe('A human-readable string explaining the error'),
    type: z
      .string()
      .nullable()
      .describe(
        'A computer-friendly string that provides additional context for the main error. For example, an endpoint many generate HTTP 404 errors for different kinds of input. This field will provide a label for the specific kind of 404 failure, such as ambiguous'
      ),
    warnings: z
      .array(z.string())
      .nullable()
      .describe(
        'If your input also generated non-failure warnings, they will be provided as human-readable strings in this array'
      ),
  })
  .describe('An error object returned by Scryfall');

type ScryfallError = z.infer<typeof ScryfallErrorSchema>;

// Card Face schema for multiface cards
const CardFaceSchema = z.object({
  name: z.string().describe('The name of this particular face'),
  mana_cost: z
    .string()
    .describe(
      'The mana cost for this face. This value will be any empty string "" if the cost is absent'
    ),
  cmc: z.number().describe('The mana value of this particular face'),
  type_line: z.string().describe('The type line of this particular face'),
  oracle_text: z.string().describe('The Oracle text for this face, if any'),
  defense: z.string().nullable().describe("This face's defense, if any"),
  loyalty: z.string().nullable().describe("This face's loyalty, if any"),
  power: z
    .string()
    .nullable()
    .describe(
      "This face's power, if any. Note that some cards have powers that are not numeric, such as *"
    ),
  toughness: z.string().nullable().describe("This face's toughness, if any"),
});

// Scryfall Card object (abbreviated shape)
const ScryfallCardSchema = z.object({
  object: z.literal('card').describe('A content type for this object, always "card"'),
  id: z.string().describe("A unique ID for this card in Scryfall's database"),
  name: z
    .string()
    .describe(
      'The name of this card. If this card has multiple faces, this field will contain both names separated by ␣//␣'
    ),
  mana_cost: z
    .string()
    .describe(
      'The mana cost for this card. This value will be any empty string "" if the cost is absent. Remember that per the game rules, a missing mana cost and a mana cost of {0} are different values'
    ),
  cmc: z
    .number()
    .describe("The card's mana value. Note that some funny cards have fractional mana costs"),
  color_identity: z.array(z.string()).describe("This card's color identity"),
  type_line: z.string().describe('The type line of this card'),
  oracle_text: z.string().describe('The Oracle text for this card, if any'),
  defense: z.string().nullable().describe("This card's defense, if any"),
  loyalty: z.string().nullable().describe("This card's loyalty, if any"),
  power: z
    .string()
    .nullable()
    .describe(
      "This card's power, if any. Note that some cards have powers that are not numeric, such as *"
    ),
  toughness: z.string().nullable().describe("This card's toughness, if any"),
  game_changer: z
    .boolean()
    .nullable()
    .describe('True if this card is on the Commander Game Changer list'),
  produced_mana: z
    .array(z.string())
    .nullable()
    .describe('Colors of mana that this card could produce'),
  set: z.string().describe("This card's set code"),
  set_name: z.string().describe("This card's full set name"),
  collector_number: z.string().describe("This card's collector number"),
  rarity: z
    .string()
    .describe("This card's rarity. One of common, uncommon, rare, special, mythic, or bonus"),
  card_faces: z
    .array(CardFaceSchema)
    .nullable()
    .describe('An array of Card Face objects, if this card is multifaced'),
  prices: z
    .object({
      usd: z.string().nullable().optional().describe('The price of this card in USD'),
      usd_foil: z.string().nullable().optional().describe('The price of this card in USD (foil)'),
      eur: z.string().nullable().optional().describe('The price of this card in EUR'),
      tix: z.string().nullable().optional().describe('The price of this card in MTGO tickets'),
    })
    .describe('An object containing daily price information for this card'),
});

type ScryfallCard = z.infer<typeof ScryfallCardSchema>;

// Scryfall Ruling object
const ScryfallRulingSchema = z.object({
  object: z.literal('ruling').describe('A content type for this object, always ruling'),
  oracle_id: z.string().describe('The Oracle ID of the card this ruling is associated with'),
  source: z
    .string()
    .describe(
      'A computer-readable string indicating which company produced this ruling, either wotc or scryfall'
    ),
  published_at: z.string().describe('The date when the ruling or note was published'),
  comment: z.string().describe('The text of the ruling'),
});

type ScryfallRuling = z.infer<typeof ScryfallRulingSchema>;

// Tools definitions
const SEARCH_CARDS_TOOL: Tool = {
  name: 'search_cards',
  description:
    "Search for MTG cards by a text query, e.g. 'oracle text includes: draw cards'. " +
    'Returns a list of matching cards (with basic fields: name, set, collector_number, ID). ' +
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
    'Retrieve a card by its Scryfall ID (a 36-char UUID). Returns the card data in JSON.',
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
    "Retrieve a card by its exact English name, e.g. 'Black Lotus'. Returns the card data in JSON. " +
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
    "Retrieve multiple cards by their exact names. Returns an array of card objects, with 'Not found' entries for any names that couldn't be found. " +
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
    'Retrieve a random Magic card from Scryfall. Returns JSON data for that random card.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const GET_RULINGS_TOOL: Tool = {
  name: 'get_rulings',
  description:
    'Retrieve official rulings for a specified card by Scryfall ID or Oracle ID. ' +
    "Returns an array of rulings. Each ruling has a 'published_at' date and a 'comment' field.",
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: "A Scryfall ID or Oracle ID. Example: 'c09c71fb-7acb-4ffb-a47b-8961a0cf4990'",
      },
    },
    required: ['id'],
  },
};

const GET_PRICES_BY_ID_TOOL: Tool = {
  name: 'get_prices_by_id',
  description:
    'Retrieve price information for a card by its Scryfall ID. Returns JSON with usd, usd_foil, eur, tix, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Scryfall ID of the card',
      },
    },
    required: ['id'],
  },
};

const GET_PRICES_BY_NAME_TOOL: Tool = {
  name: 'get_prices_by_name',
  description:
    'Retrieve price information for a card by its exact name. Returns JSON with usd, usd_foil, eur, tix, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Exact card name',
      },
    },
    required: ['name'],
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
  GET_PRICES_BY_ID_TOOL,
  GET_PRICES_BY_NAME_TOOL,
] as const;

// Helper to handle Scryfall responses
async function handleScryfallResponse(response: Response) {
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
        content: [
          {
            type: 'text',
            text: `Scryfall error: ${errorObj.details} (code=${errorObj.code}, status=${errorObj.status})`,
          },
        ],
        isError: true,
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `HTTP error ${response.status}: ${response.statusText}`,
          },
        ],
        isError: true,
      };
    }
  }
  // If okay, parse JSON
  const data = await response.json();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
    isError: false,
  };
}

// Actual call handlers
async function handleSearchCards(query: string) {
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  return handleScryfallResponse(response);
}

async function handleGetCardById(id: string) {
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  return handleScryfallResponse(response);
}

async function handleGetCardByName(name: string) {
  // Tilde in URL means 'exact' mode for the card name
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  return handleScryfallResponse(response);
}

async function handleRandomCard() {
  const url = 'https://api.scryfall.com/cards/random';
  const response = await fetch(url);
  return handleScryfallResponse(response);
}

async function handleGetRulings(id: string) {
  // Scryfall docs: /cards/{id}/rulings
  // Also works with /cards/{oracle_id}/rulings
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(id)}/rulings`;
  const response = await fetch(url);
  return handleScryfallResponse(response);
}

async function handleGetPricesById(id: string) {
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return handleScryfallResponse(response);
  }
  const data = (await response.json()) as ScryfallCard;

  if (!data.prices) {
    return {
      content: [
        {
          type: 'text',
          text: 'No price information found for this card.',
        },
      ],
      isError: false,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data.prices, null, 2),
      },
    ],
    isError: false,
  };
}

async function handleGetPricesByName(name: string) {
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return handleScryfallResponse(response);
  }
  const data = (await response.json()) as ScryfallCard;

  if (!data.prices) {
    return {
      content: [
        {
          type: 'text',
          text: 'No price information found for this card.',
        },
      ],
      isError: false,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data.prices, null, 2),
      },
    ],
    isError: false,
  };
}

async function handleGetCardsByNames(names: string[]) {
  // Create an array of promises for each card name
  const cardPromises = names.map(async name => {
    try {
      const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return {
          name,
          status: 'not_found',
          error: `Card not found: ${name}`,
        };
      }
      const data = await response.json();
      return {
        name,
        status: 'found',
        data,
      };
    } catch (error) {
      return {
        name,
        status: 'error',
        error: `Error fetching card ${name}: ${(error as Error).message}`,
      };
    }
  });

  // Wait for all requests to complete
  const results = await Promise.all(cardPromises);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(results, null, 2),
      },
    ],
    isError: false,
  };
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
        case 'get_prices_by_id': {
          const { id } = args as { id: string };
          return await handleGetPricesById(id);
        }
        case 'get_prices_by_name': {
          const { name } = args as { name: string };
          return await handleGetPricesByName(name);
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
