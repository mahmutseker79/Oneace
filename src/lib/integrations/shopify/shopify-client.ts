/**
 * Phase E: Shopify OAuth 2.0 client.
 *
 * Handles OAuth flow, token management, and GraphQL API calls to Shopify.
 * Uses Shopify's GraphQL API for flexible queries and mutations.
 */

import { IntegrationClient, type OAuthConfig, type OAuthToken } from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

const SHOPIFY_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.SHOPIFY_CLIENT_ID || "",
  clientSecret: process.env.SHOPIFY_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/shopify/callback`,
  authorizationUrl: (shop: string) =>
    `https://${shop}.myshopify.com/admin/oauth/authorize`,
  tokenUrl: (shop: string) =>
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
  revokeUrl: (shop: string) =>
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
} as unknown as OAuthConfig;

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  sku?: string;
  price?: number;
  inventory?: number;
  vendor?: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ShopifyOrder {
  id: string;
  orderNumber: number;
  email: string;
  totalPrice: number;
  createdAt: string;
  lineItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
  }>;
}

/**
 * Shopify integration client using GraphQL API.
 */
export class ShopifyClient extends IntegrationClient {
  private shop: string = "";
  private apiVersion: string = "2024-01";

  constructor(credentials: OAuthToken, shop: string) {
    const config = { ...SHOPIFY_OAUTH_CONFIG };
    super(config, credentials);
    this.shop = shop;
    this.baseUrl = `https://${shop}.myshopify.com/admin/api/${this.apiVersion}/graphql.json`;
  }

  /**
   * Get the authorization URL for OAuth flow.
   */
  getAuthorizationUrl(state: string, scope: string[] = []): string {
    const authUrl = new URL(
      `https://${this.shop}.myshopify.com/admin/oauth/authorize`,
    );
    authUrl.searchParams.append("client_id", this.oauthConfig.clientId);
    authUrl.searchParams.append("redirect_uri", this.oauthConfig.redirectUri);
    authUrl.searchParams.append("scope", (scope.length > 0 ? scope : this.getScopes()).join(","));
    authUrl.searchParams.append("state", state);

    return authUrl.toString();
  }

  /**
   * Get required OAuth scopes.
   */
  private getScopes(): string[] {
    return [
      "read_products",
      "read_orders",
      "read_customers",
      "write_inventory",
    ];
  }

  /**
   * Execute a GraphQL query.
   */
  private async graphql<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await this.apiCall<{ data: T; errors?: unknown[] }>(
      "/graphql.json",
      {
        method: "POST",
        body: {
          query,
          variables: variables || {},
        },
      },
    );

    if (response.data.errors) {
      const errorMsg = JSON.stringify(response.data.errors);
      throw this.createError("GRAPHQL_ERROR", errorMsg, false);
    }

    return response.data.data;
  }

  /**
   * Fetch products from Shopify.
   */
  async getProducts(
    limit: number = 50,
    after?: string,
  ): Promise<{
    products: ShopifyProduct[];
    pageInfo: { hasNextPage: boolean; endCursor?: string };
  }> {
    try {
      const query = `
        query getProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                title
                handle
                vendor
                variants(first: 1) {
                  edges {
                    node {
                      sku
                      price
                      inventoryQuantity
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const result = (await this.graphql<{
        products: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              handle: string;
              vendor?: string;
              variants: {
                edges: Array<{
                  node: {
                    sku?: string;
                    price: number;
                    inventoryQuantity: number;
                  };
                }>;
              };
            };
            cursor: string;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor?: string;
          };
        };
      }>(query, { first: limit, after })) as {
        products: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              handle: string;
              vendor?: string;
              variants: {
                edges: Array<{
                  node: {
                    sku?: string;
                    price: number;
                    inventoryQuantity: number;
                  };
                }>;
              };
            };
            cursor: string;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor?: string;
          };
        };
      };

      const products = result.products.edges.map((edge) => {
        const variant = edge.node.variants.edges[0]?.node;

        return {
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          sku: variant?.sku,
          price: variant?.price,
          inventory: variant?.inventoryQuantity,
          vendor: edge.node.vendor,
        };
      });

      return {
        products,
        pageInfo: result.products.pageInfo,
      };
    } catch (error) {
      logger.error("Failed to fetch Shopify products", { error });
      throw error;
    }
  }

  /**
   * Fetch orders from Shopify.
   */
  async getOrders(
    limit: number = 50,
    after?: string,
  ): Promise<{
    orders: ShopifyOrder[];
    pageInfo: { hasNextPage: boolean; endCursor?: string };
  }> {
    try {
      const query = `
        query getOrders($first: Int!, $after: String) {
          orders(first: $first, after: $after) {
            edges {
              node {
                id
                orderNumber
                email
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                createdAt
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      productId
                      quantity
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                        }
                      }
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const result = (await this.graphql<{
        orders: {
          edges: Array<{
            node: {
              id: string;
              orderNumber: number;
              email: string;
              totalPriceSet: {
                shopMoney: { amount: string };
              };
              createdAt: string;
              lineItems: {
                edges: Array<{
                  node: {
                    id: string;
                    productId: string;
                    quantity: number;
                    originalUnitPriceSet: {
                      shopMoney: { amount: string };
                    };
                  };
                }>;
              };
            };
            cursor: string;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor?: string;
          };
        };
      }>(query, { first: limit, after })) as {
        orders: {
          edges: Array<{
            node: {
              id: string;
              orderNumber: number;
              email: string;
              totalPriceSet: {
                shopMoney: { amount: string };
              };
              createdAt: string;
              lineItems: {
                edges: Array<{
                  node: {
                    id: string;
                    productId: string;
                    quantity: number;
                    originalUnitPriceSet: {
                      shopMoney: { amount: string };
                    };
                  };
                }>;
              };
            };
            cursor: string;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor?: string;
          };
        };
      };

      const orders = result.orders.edges.map((edge) => ({
        id: edge.node.id,
        orderNumber: edge.node.orderNumber,
        email: edge.node.email,
        totalPrice: Number(edge.node.totalPriceSet.shopMoney.amount),
        createdAt: edge.node.createdAt,
        lineItems: edge.node.lineItems.edges.map((lineEdge) => ({
          id: lineEdge.node.id,
          productId: lineEdge.node.productId,
          quantity: lineEdge.node.quantity,
          price: Number(
            lineEdge.node.originalUnitPriceSet.shopMoney.amount,
          ),
        })),
      }));

      return {
        orders,
        pageInfo: result.orders.pageInfo,
      };
    } catch (error) {
      logger.error("Failed to fetch Shopify orders", { error });
      throw error;
    }
  }

  /**
   * Update inventory for a product variant.
   */
  async updateInventory(
    variantId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      const mutation = `
        mutation updateInventory($input: InventoryAdjustQuantitiesInput!) {
          inventoryAdjustQuantities(input: $input) {
            inventoryAdjustmentGroup {
              reason
            }
            userErrors {
              message
            }
          }
        }
      `;

      await this.graphql(mutation, {
        input: {
          changes: [
            {
              inventoryItemId: variantId,
              availableDelta: quantity,
            },
          ],
        },
      });

      return true;
    } catch (error) {
      logger.error("Failed to update Shopify inventory", { error });
      return false;
    }
  }

  /**
   * Set the shop name.
   */
  setShop(shop: string): void {
    this.shop = shop;
    this.baseUrl = `https://${shop}.myshopify.com/admin/api/${this.apiVersion}/graphql.json`;
  }

  /**
   * Get the current shop.
   */
  getShop(): string {
    return this.shop;
  }
}

export default ShopifyClient;
