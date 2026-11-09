import { describe, it, expect } from 'vitest';
import { loadQuery } from '../../../server/services/graphql/loader';

describe('GraphQL loader', () => {
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

    it('reads no order details on the list', () => {
      const query = loadQuery('quotes/list-quotations.graphql');

      expect(query).not.toContain('orderDetails');
      expect(query).not.toMatch(/^\s*request \{/m);
    });

    it("reads only the quotation's number for the order's link back", () => {
      const query = loadQuery('quotes/quotation-number.graphql');

      expect(query).toMatch(
        /getQuotationCart\(quotationId: \$quotationId, languageId: \$languageId\)/,
      );
      expect(query).toMatch(/quotation \{\s*quotationNumber\s*\}/);
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

    it('reads no configuration for the list, which only counts the lines', () => {
      const query = loadQuery('quotes/list-quotations.graphql');

      expect(query).not.toContain('QuotationLineConfiguration');
      expect(query).not.toContain('configuration');
    });

    it.each([
      ['quotes/accept-quotation.graphql', 'acceptQuotation'],
      ['quotes/reject-quotation.graphql', 'rejectQuotation'],
      ['quotes/finalize-quotation.graphql', 'finalizeQuotation'],
    ])('selects nothing on %s: Geins answers a Boolean', (file, field) => {
      const query = loadQuery(file);

      // The field takes `quotationId:`; the operation line takes `$quotationId:`.
      expect(query).toMatch(new RegExp(`${field}\\(quotationId:`));
      expect(query).not.toMatch(
        new RegExp(`${field}\\(quotationId:[^)]*\\)\\s*\\{`),
      );
    });
  });
});
