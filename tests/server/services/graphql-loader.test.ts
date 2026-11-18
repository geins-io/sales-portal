import { describe, it, expect } from 'vitest';
import {
  loadQuery,
  withFragments,
} from '../../../server/services/graphql/loader';

describe('GraphQL loader', () => {
  describe('withFragments', () => {
    it('adds the fragments a query built at runtime spreads, each once', () => {
      const query = withFragments(
        'query q($a0: String!) {\n  a0_0: product(alias: $a0) { ...ProductCard }\n  a0_1: product(alias: $a0) { ...ProductCard }\n}',
      );

      for (const fragment of [
        'fragment ProductCard on ProductType',
        'fragment Price on PriceType',
        'fragment Sku on SkuType',
        'fragment Stock on StockType',
      ]) {
        expect(query.split(fragment)).toHaveLength(2);
      }
      expect(query.startsWith('query q($a0: String!)')).toBe(true);
    });

    it('leaves a query without spreads as it is', () => {
      expect(withFragments('query q { brands { name } }')).toBe(
        'query q { brands { name } }',
      );
    });
  });

  it('loads the product cards by ids with the card fragment', () => {
    expect(loadQuery('products/product-cards-by-ids.graphql')).toContain(
      'fragment ProductCard on ProductType',
    );
  });

  describe('loadQuery', () => {
    it('should load a simple query without fragments', () => {
      const query = loadQuery('brands/brands.graphql');

      expect(query).toContain('query brands');
      expect(query).toContain('brandId');
      expect(query).toContain('canonicalUrl');
    });

    it('should load a query and resolve fragment dependencies', () => {
      const query = loadQuery('products/product.graphql');

      // Should contain the query
      expect(query).toContain('query product');
      expect(query).toContain('$alias: String!');

      // Should contain resolved fragments
      expect(query).toContain('fragment Price on PriceType');
      expect(query).toContain('fragment Stock on StockType');
      expect(query).toContain('fragment Sku on SkuType');
      expect(query).toContain('fragment Variant on VariantType');
      expect(query).toContain('fragment Meta on MetadataType');
      expect(query).toContain('fragment Campaign on CampaignRuleType');
    });

    it('should resolve nested fragment dependencies', () => {
      // Sku depends on Stock, ListProduct depends on Price + Stock + Sku + Campaign
      const query = loadQuery('product-lists/products.graphql');

      expect(query).toContain('fragment ListProduct on ProductType');
      expect(query).toContain('fragment Price on PriceType');
      expect(query).toContain('fragment Stock on StockType');
      expect(query).toContain('fragment Sku on SkuType');
      expect(query).toContain('fragment Campaign on CampaignRuleType');
    });

    it('should not duplicate fragments', () => {
      const query = loadQuery('products/product.graphql');

      // Count occurrences of fragment Stock — should appear exactly once
      const stockMatches = query.match(/fragment Stock on StockType/g);
      expect(stockMatches).toHaveLength(1);
    });

    it('should cache queries on repeated loads', () => {
      const query1 = loadQuery('brands/brands.graphql');
      const query2 = loadQuery('brands/brands.graphql');

      // Same reference means cache hit
      expect(query1).toBe(query2);
    });

    it('should load mutation files', () => {
      const query = loadQuery('products/post-review.graphql');

      expect(query).toContain('mutation postProductReview');
      expect(query).toContain('$alias: String!');
      expect(query).toContain('$rating: Int!');
    });

    it('should load search query with Price fragment', () => {
      const query = loadQuery('search/search.graphql');

      expect(query).toContain('query products');
      expect(query).toContain('$filter: FilterInputType');
      expect(query).toContain('fragment Price on PriceType');
    });

    it('should load category page with ListInfo and Meta fragments', () => {
      const query = loadQuery('product-lists/category-page.graphql');

      expect(query).toContain('query listPageInfo');
      expect(query).toContain('fragment ListInfo on PageInfoType');
      expect(query).toContain('fragment Meta on MetadataType');
    });

    it('should load channel query', () => {
      const query = loadQuery('channels/channel.graphql');

      expect(query).toContain('query channel');
      expect(query).toContain('defaultMarketId');
      expect(query).toContain('allowedLanguages');
    });

    it('should load newsletter mutation', () => {
      const query = loadQuery('newsletter/subscribe.graphql');

      expect(query).toContain('mutation subscribeToNewsletter');
      expect(query).toContain('$email: String!');
    });

    it('selects relationType, not the deprecated relation, on related products', () => {
      // Geins fails the whole call on `relation` for accessory and similar rows.
      const query = loadQuery('products/related-products.graphql');

      expect(query).toMatch(/^\s*relationType$/m);
      expect(query).not.toMatch(/^\s*relation$/m);
    });

    it.each([
      'quotes/get-quotation.graphql',
      'quotes/create-quotation-request.graphql',
      'quotes/update-quotation-request.graphql',
      'quotes/release-quotation-request.graphql',
    ])("reads each line's configuration and price on %s", (file) => {
      const query = loadQuery(file);

      expect(query).toContain('...QuotationLineConfiguration');
      expect(query.match(/fragment QuotationLineConfiguration /g)).toHaveLength(
        1,
      );
      expect(query).toMatch(/^\s*configurationId$/m);
      expect(query).toMatch(/summary \{\s*label\s*value\s*\}/);
      // Fragments cannot recurse: the read goes four sections deep.
      expect(query.match(/\.\.\.QuotationCommittedSection\b/g)).toHaveLength(4);
      // The specification reads the line's VAT and currency.
      for (const price of ['unitPrice', 'totalPrice']) {
        expect(query).toMatch(
          new RegExp(
            `${price} \\{[^}]*\\svat\\s[^}]*currency \\{\\s*code\\s*\\}`,
          ),
        );
      }
      expect(query.match(/fragment Price on PriceType/g)).toHaveLength(1);
      // The product name links to the product page by its alias.
      expect(query).toMatch(/product \{[^}]*\salias\s/);
    });

    it('reads what the order will get, its payment names and its order on the single quotation', () => {
      const query = loadQuery('quotes/get-quotation.graphql');

      const details =
        'customerOrderNumber\\s+customerReference\\s+desiredDeliveryDate\\s+goodsLabel\\s*\\}';
      expect(query).toMatch(new RegExp(`orderDetails \\{\\s*${details}`));
      // What the buyer sent also carries their message.
      expect(query).toMatch(new RegExp(`request \\{\\s*comment\\s+${details}`));
      expect(query).toMatch(/validPaymentMethods \{[^}]*\sdisplayName\s/);
      expect(query).toMatch(/^\s*orderPublicId$/m);
    });

    it("reads only the quotation's number for the order's link back", () => {
      const query = loadQuery('quotes/quotation-number.graphql');

      expect(query).toMatch(
        /getQuotationCart\(quotationId: \$quotationId, languageId: \$languageId\)/,
      );
      expect(query).toMatch(
        /quotation \{\s*quotationNumber\s+externalReference \{\s*number\s*\}\s*\}/,
      );
      expect(query).not.toContain('items');
    });

    it("writes only the message on the quotation cart's checkout", () => {
      const query = loadQuery('quotes/quotation-checkout.graphql');

      expect(query).toMatch(/^mutation /);
      expect(query).toMatch(
        /createOrUpdateCheckout\(\s*cartId: \$cartId\s+checkout: \$checkout\b/,
      );
      expect(query).toMatch(/\)\s*\{\s*message\s*\}\s*\}\s*$/);
    });

    describe('the quotation list reads only what each place shows', () => {
      it('reads a page of rows: the row fragment and the count, no lines or addresses', () => {
        const query = loadQuery('quotes/quotation-cart-page.graphql');

        expect(query).toMatch(
          /quotationCarts\(\s*filter: \$filter,?\s+skip: \$skip,?\s+take: \$take,?\s+languageId: \$languageId,?\s*\)\s*\{\s*count\s+quotationCarts \{\s*\.\.\.QuotationListRow\s*\}\s*\}/,
        );
        expect(
          query.split('fragment QuotationListRow on CartType'),
        ).toHaveLength(2);
        expect(query).not.toContain('listQuotationCarts');
        for (const field of [
          'items',
          'billingAddress',
          'shippingAddress',
          'product',
          'subTotal',
          'terms',
        ]) {
          expect(query, field).not.toMatch(new RegExp(`\\b${field}\\b`));
        }
      });

      it('gives a row its number, both kinds, and the four total amounts', () => {
        const query = loadQuery('quotes/quotation-cart-page.graphql');

        expect(query).toMatch(/externalReference \{\s*number\s*\}/);
        expect(query).toMatch(
          /total \{\s*sellingPriceIncVat\s+sellingPriceIncVatFormatted\s+sellingPriceExVat\s+sellingPriceExVatFormatted\s*\}/,
        );
      });

      it('counts the four tabs in one request, the count alone', () => {
        const query = loadQuery('quotes/quotation-cart-counts.graphql');

        for (const tab of ['all', 'drafts', 'requests', 'quotations']) {
          expect(query, tab).toMatch(
            new RegExp(
              `${tab}: quotationCarts\\([^)]*take: 1\\b[^)]*\\)\\s*\\{\\s*count\\s*\\}`,
            ),
          );
        }
        expect(query).not.toContain('QuotationListRow');
      });

      it('reads the overview in one request: five pending rows, then every pending expiry', () => {
        const query = loadQuery('quotes/quotation-pending-overview.graphql');

        expect(query).toMatch(
          /recent: quotationCarts\([^)]*statuses: \[PENDING\][^)]*take: 5\b[^)]*\)\s*\{\s*count\s+quotationCarts \{\s*\.\.\.QuotationListRow\s*\}\s*\}/,
        );
        expect(query).toMatch(
          /expiry: quotationCarts\([^)]*statuses: \[PENDING\][^)]*take: 100\b[^)]*\)\s*\{\s*quotationCarts \{\s*id\s+quotation \{\s*validTo\s*\}\s*\}\s*\}/,
        );
      });

      it("reads the add-to-quote menu's drafts: id, name, last change and the line ids", () => {
        const query = loadQuery('quotes/quotation-draft-menu.graphql');

        expect(query).toMatch(
          /quotationCarts\([^)]*statuses: \[REQUEST_DRAFT\][^)]*take: 100\b[^)]*\)\s*\{\s*quotationCarts \{\s*id\s+quotation \{\s*name\s+modifiedAt\s*\}\s+items \{\s*id\s*\}\s*\}\s*\}/,
        );
      });

      it('reads only the names the search finds', () => {
        const query = loadQuery('quotes/quotation-names.graphql');

        expect(query).toMatch(
          /quotationCarts\([^)]*search: \$search[^)]*take: 100\b[^)]*\)\s*\{\s*quotationCarts \{\s*quotation \{\s*name\s*\}\s*\}\s*\}/,
        );
      });
    });

    it.each([
      ['quotes/accept-quotation.graphql', 'acceptQuotation'],
      ['quotes/reject-quotation.graphql', 'rejectQuotation'],
      ['quotes/finalize-quotation.graphql', 'finalizeQuotation'],
    ])('selects nothing on %s: Geins answers a Boolean', (file, field) => {
      const query = loadQuery(file);

      // The field takes `quotationId:`; the operation line takes `$quotationId:`.
      expect(query).toMatch(new RegExp(`${field}\\(\\s*quotationId:`));
      expect(query).not.toMatch(
        new RegExp(`${field}\\(\\s*quotationId:[^)]*\\)\\s*\\{`),
      );
    });
  });
});
